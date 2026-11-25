import 'server-only';
import {TAKT_BUDGET_MS, TAKT_NACHHOLEN_BUDGET_MS} from '../public';
import {TAKT_JOBS, bauePaketAktiv, baueTaktLeser} from '../jobs';
import type {PackageSwitchId} from '@/modules/fundament/public';
import {liesTodayModellVeraltet} from '@/lib/server/todayProjectionSchedule';
import {fuehreHeuteAuffrischung} from '@/lib/today/taktJobs';
import {beendeLauf, liesLetztenOk, liesTaktMandanten, reserviereLauf} from './laeufe';
import {fuehreFaelligenJobAus, liesFaelligeJobs, nachholMinuteBerlin} from './lauf';

/** A bounded pass uses the one Today tenant list and never reserves work past its budget. */
export async function fuehreTaktAus(options: Readonly<{
  tenantId?: string;
  jetzt?: Date;
  budgetMs?: number;
  nurJob?: 'heute_neuaufbau';
  paketAktiv?: (tenantId: string, paket: PackageSwitchId) => Promise<boolean>;
}> = {}): Promise<Readonly<{mandanten: number; laeufe: number; restOffen: boolean}>> {
  const budgetMs = options.budgetMs ?? TAKT_BUDGET_MS;
  if (!Number.isSafeInteger(budgetMs) || budgetMs < 1 || budgetMs > TAKT_BUDGET_MS) throw Error('TAKT_BUDGET_INVALID');
  const mandanten = options.tenantId ? [options.tenantId] : await liesTaktMandanten();
  const started = performance.now();
  const jetzt = options.jetzt ?? new Date();
  let laeufe = 0;
  let restOffen = false;
  for (const tenantId of mandanten) {
    if (performance.now() - started >= budgetMs) { restOffen = true; break; }
    const leser = baueTaktLeser(tenantId);
    const paketAktiv = options.paketAktiv ? (paket:PackageSwitchId)=>options.paketAktiv!(tenantId,paket) : bauePaketAktiv(tenantId);
    const jobs = options.nurJob ? TAKT_JOBS.filter(job => job.schluessel === options.nurJob) : TAKT_JOBS;
    const faellige = await liesFaelligeJobs(jobs, jetzt, schluessel => liesLetztenOk(tenantId, schluessel, schluessel === 'heute_neuaufbau'));
    if (!faellige.some(eintrag => eintrag.job.schluessel === 'heute_neuaufbau')) {
      const heute = jobs.find(job => job.schluessel === 'heute_neuaufbau');
      if (heute && await liesTodayModellVeraltet(tenantId, jetzt)) {
        const minute = nachholMinuteBerlin(jetzt);
        const gerundet = Math.floor(Number(minute.slice(-2)) / 5) * 5;
        faellige.push({job: {...heute, ausfuehren: fuehreHeuteAuffrischung}, faelligFuer: `${minute.slice(0, -2)}${String(gerundet).padStart(2, '0')}`});
      }
    }
    for (const eintrag of faellige) {
      if (performance.now() - started >= budgetMs) { restOffen = true; break; }
      const result = await fuehreFaelligenJobAus(tenantId, eintrag, leser, paketAktiv);
      if (result !== 'nicht_reserviert') laeufe++;
    }
    if (restOffen) break;
  }
  return {mandanten: mandanten.length, laeufe, restOffen};
}

/** A repeated home read in the same Berlin minute never starts a second follow-up. */
export async function holeTaktNach(tenantId: string): Promise<boolean> {
  const start = performance.now();
  const reservierung = await reserviereLauf(tenantId, 'takt.nachholen', nachholMinuteBerlin(new Date()), TAKT_NACHHOLEN_BUDGET_MS);
  if (!reservierung) return false;
  try {
    await fuehreTaktAus({tenantId, budgetMs: TAKT_NACHHOLEN_BUDGET_MS});
    await beendeLauf(tenantId, reservierung, 'ok', Math.max(0, Math.floor(performance.now() - start)));
    return true;
  } catch {
    await beendeLauf(tenantId, reservierung, 'fehler', Math.max(0, Math.floor(performance.now() - start)), 'takt_nachholen');
    return false;
  }
}
