import 'server-only';
import {TAKT_BUDGET_MS, TAKT_NACHHOLEN_BUDGET_MS, type TaktJob} from '../public';
import {TAKT_JOBS, bauePaketAktiv, baueTaktLeser} from '../jobs';
import type {PackageSwitchId} from '@/modules/fundament/public';
import {PageReadTimeout} from '@/db/readBudget';
import {withTaktStatementTimeout} from '@/lib/server/privilegedDb';
import {liesTodayModellBesetzt, liesTodayModellVeraltet} from '@/lib/server/todayProjectionSchedule';
import {fuehreHeuteAuffrischung} from '@/lib/today/taktJobs';
import {beendeLauf, liesLetztenOk, liesOffeneWiederholungen, liesTaktMandanten, reserviereLauf, TAKT_NACHHOLEN} from './laeufe';
import {fuehreFaelligenJobAus, liesFaelligeJobs, nachholMinuteBerlin, type FaelligerJob} from './lauf';
import {liesTaktAusfallFakten} from './tagQuellen';

/** Ein Neustart verwendet dieselbe Reservierung und ist nur für eine belegte Störung möglich. */
export async function starteTaktStoerungsjob(tenantId: string, schluessel: string, jetzt = new Date()) {
  const job = TAKT_JOBS.find(eintrag => eintrag.schluessel === schluessel);
  if (!job) return null;
  const ausfuehrung = job.schluessel === 'heute_neuaufbau' ? {...job, ausfuehren: fuehreHeuteAuffrischung} : job;
  const ergebnis = await fuehreFaelligenJobAus(tenantId, {
    job: ausfuehrung,
    faelligFuer: nachholMinuteBerlin(jetzt),
    vorReservierung: async () => {
      const stand = await liesTaktAusfallFakten({tenantId}, jetzt);
      if (stand.code !== 'OK') throw Error('TAKT_STOERUNGSQUELLE_FEHLT');
      return stand.ausfaelle.some(ausfall => ausfall.laufstand.schluessel === schluessel);
    },
  }, baueTaktLeser(tenantId), bauePaketAktiv(tenantId));
  return {schluessel: job.schluessel, ergebnis};
}

function zeitUebrig(start: number, budgetMs: number): number {
  return Math.max(0, budgetMs - Math.ceil(performance.now() - start));
}

async function liesAnstehendeJobs(
  tenantId: string, jobs: readonly TaktJob[], jetzt: Date,
): Promise<FaelligerJob[]> {
  const wiederholungen = await liesOffeneWiederholungen(tenantId, jobs.map(job => job.schluessel));
  const blockiert = new Set<string>();
  const zuerst: FaelligerJob[] = [];
  for (const eintrag of wiederholungen) {
    if (blockiert.has(eintrag.schluessel)) continue;
    blockiert.add(eintrag.schluessel);
    const job = jobs.find(job => job.schluessel === eintrag.schluessel);
    if (!job || !eintrag.bereit) continue;
    zuerst.push({
      job: job.schluessel === 'heute_neuaufbau' && eintrag.faelligFuer.includes('T')
        ? {...job, ausfuehren: fuehreHeuteAuffrischung} : job,
      faelligFuer: eintrag.faelligFuer,
      wiederholung: true,
    });
  }
  const frei = jobs.filter(job => !blockiert.has(job.schluessel));
  const faellige = await liesFaelligeJobs(frei, jetzt, schluessel => liesLetztenOk(tenantId, schluessel));
  if (!faellige.some(eintrag => eintrag.job.schluessel === 'heute_neuaufbau')) {
    const heute = frei.find(job => job.schluessel === 'heute_neuaufbau');
    if (heute && await liesTodayModellVeraltet(tenantId, jetzt)) {
      faellige.push({job: {...heute, ausfuehren: fuehreHeuteAuffrischung}, faelligFuer: nachholMinuteBerlin(jetzt, 5)});
    }
  }
  return [...zuerst, ...faellige];
}

/** A bounded pass uses the one Today tenant list and never reserves work after its deadline. */
export async function fuehreTaktAus(options: Readonly<{
  tenantId?: string;
  jetzt?: Date;
  budgetMs?: number;
  nurJob?: 'heute_neuaufbau';
  signal?: AbortSignal;
  paketAktiv?: (tenantId: string, paket: PackageSwitchId) => Promise<boolean>;
}> = {}): Promise<Readonly<{mandanten: number; laeufe: number; restOffen: boolean; erfolglos?: true; besetzt?: true}>> {
  const budgetMs = options.budgetMs ?? TAKT_BUDGET_MS;
  if (!Number.isSafeInteger(budgetMs) || budgetMs < 1 || budgetMs > TAKT_BUDGET_MS) throw Error('TAKT_BUDGET_INVALID');
  if (options.nurJob && !options.tenantId) throw Error('TAKT_HANDLAUF_MANDANT_FEHLT');
  const started = performance.now();
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(budgetMs)]) : AbortSignal.timeout(budgetMs);
  const rest = () => zeitUebrig(started, budgetMs);
  const lies = <T>(work: () => Promise<T>) => {
    const timeout = rest();
    if (signal.aborted || timeout < 1) throw new PageReadTimeout();
    return withTaktStatementTimeout(timeout, work, signal);
  };
  const jetzt = options.jetzt ?? new Date();
  const jobs = options.nurJob ? TAKT_JOBS.filter(job => job.schluessel === options.nurJob) : TAKT_JOBS;
  let mandanten: string[] = [];
  let laeufe = 0;
  let erfolglos = false;
  let besetzt = false;
  try {
    mandanten = options.tenantId ? [options.tenantId] : await lies(liesTaktMandanten);
  } catch (error) {
    if (signal.aborted || error instanceof PageReadTimeout) return {mandanten: 0, laeufe, restOffen: true, erfolglos: true};
    throw error;
  }
  for (const tenantId of mandanten) {
    if (signal.aborted || rest() < 1) break;
    try {
      if (options.nurJob === 'heute_neuaufbau' && await lies(() => liesTodayModellBesetzt(tenantId))) {
        return {mandanten: mandanten.length, laeufe, restOffen: false, erfolglos: true, besetzt: true};
      }
      const leser = baueTaktLeser(tenantId);
      const paketAbfrage = options.paketAktiv;
      const paketAktiv = paketAbfrage ? (paket: PackageSwitchId) => paketAbfrage(tenantId, paket) : bauePaketAktiv(tenantId);
      const faellige: readonly FaelligerJob[] = options.nurJob
        ? jobs.map(job => ({job, faelligFuer: `hand:${jetzt.toISOString().slice(0, 16)}Z`}))
        : await lies(() => liesAnstehendeJobs(tenantId, jobs, jetzt));
      const ausfuehren = async (eintrag: FaelligerJob) => {
        const budget = rest();
        if (signal.aborted || budget < 1) throw new PageReadTimeout();
        const result = await fuehreFaelligenJobAus(tenantId, eintrag, leser, paketAktiv, budget, signal);
        if (result !== 'nicht_reserviert') laeufe++;
        if (result === 'besetzt') besetzt = true;
        if (result === 'fehler' || result === 'abgebrochen' || result === 'besetzt') erfolglos = true;
        return result;
      };
      for (const eintrag of faellige) {
        const result = await ausfuehren(eintrag);
        if (eintrag.wiederholung && (result === 'ok' || result === 'ohne_arbeit')) {
          const regulaer = jobs.find(job => job.schluessel === eintrag.job.schluessel);
          if (!regulaer) throw Error('TAKT_JOB_NICHT_REGISTRIERT');
          const [heute] = await lies(() => liesFaelligeJobs([regulaer], jetzt, key => liesLetztenOk(tenantId, key)));
          if (heute && heute.faelligFuer !== eintrag.faelligFuer) await ausfuehren(heute);
        }
      }
    } catch {
      erfolglos = true;
      if (!signal.aborted && rest() > 0) console.error('[TAKT_TENANT_FAILED]', {code: 'SOURCE_INCOMPLETE'});
    }
  }
  const restOffen = signal.aborted || rest() < 1;
  return {mandanten: mandanten.length, laeufe, restOffen, ...(erfolglos || restOffen ? {erfolglos: true as const} : {}), ...(besetzt ? {besetzt: true as const} : {})};
}

/** A repeated home read in the same Berlin minute never starts a second follow-up. */
export async function holeTaktNach(tenantId: string): Promise<boolean> {
  const start = performance.now();
  const fristMs = TAKT_NACHHOLEN_BUDGET_MS;
  const reservierung = await withTaktStatementTimeout(fristMs, () => reserviereLauf(tenantId, TAKT_NACHHOLEN, nachholMinuteBerlin(new Date()), fristMs));
  if (!reservierung) return false;
  let status: 'ok' | 'fehler' | 'abgebrochen';
  try {
    const budgetMs = zeitUebrig(start, fristMs);
    const result = budgetMs > 0 ? await fuehreTaktAus({tenantId, budgetMs}) : {restOffen: true};
    status = result.restOffen ? 'abgebrochen' : 'erfolglos' in result && result.erfolglos ? 'fehler' : 'ok';
  } catch (error) {
    status = error instanceof PageReadTimeout ? 'abgebrochen' : 'fehler';
  }
  await beendeLauf(tenantId, reservierung, status, Math.max(0, Math.floor(performance.now() - start)), status === 'fehler' ? 'takt_nachholen' : null);
  return status === 'ok';
}
