import 'server-only';
import {berlinCalendarDay, berlinUhrzeit} from '@/lib/domain/workingDays';
import {withTaktStatementTimeout} from '@/lib/server/privilegedDb';
import {PageReadTimeout} from '@/db/readBudget';
import {type TaktJob, type TaktLeser} from '../public';
import type {PackageSwitchId} from '@/modules/fundament/public';
import {beendeAbgelaufenenLauf, beendeLauf, loescheAlteLaeufe, mitTaktLaufsperre, reserviereLauf, type LaufAbschluss} from './laeufe';

export type FaelligerJob = Readonly<{job: TaktJob; faelligFuer: string}>;
export type JobErgebnis = 'nicht_reserviert' | 'ok' | 'ohne_arbeit' | 'übersprungen' | 'fehler' | 'abgebrochen' | 'besetzt';

/** Preserve registration order while qualifying each job against its own success. */
export async function liesFaelligeJobs(
  jobs: readonly TaktJob[], jetzt: Date, letzterOk: (schluessel: string) => Promise<string | null>,
): Promise<FaelligerJob[]> {
  if (!Number.isFinite(jetzt.getTime())) throw Error('TAKT_ZEIT_INVALID');
  const faellige: FaelligerJob[] = [];
  for (const job of jobs) {
    const faelligFuer = job.faellig(jetzt, await letzterOk(job.schluessel));
    if (faelligFuer !== null) faellige.push({job, faelligFuer});
  }
  return faellige;
}

/** Catch-up is unique per Berlin minute, even during the repeated autumn hour. */
export function nachholMinuteBerlin(jetzt: Date): string {
  if (!Number.isFinite(jetzt.getTime())) throw Error('TAKT_ZEIT_INVALID');
  return `${berlinCalendarDay(jetzt)}T${berlinUhrzeit(jetzt)}`;
}

/** One reserved run is the only receipt for a job and its retention follow-up. */
export async function fuehreFaelligenJobAus(
  tenantId: string, faellig: FaelligerJob, leser: TaktLeser,
  paketAktiv: (paket: PackageSwitchId) => Promise<boolean>,
  restbudgetMs = faellig.job.fristMs, abbruch?: AbortSignal,
): Promise<JobErgebnis> {
  const {job, faelligFuer} = faellig;
  if (abbruch?.aborted || restbudgetMs < 1) return 'nicht_reserviert';
  const start = performance.now();
  const innerhalb = await mitTaktLaufsperre(tenantId, job.schluessel, async (): Promise<JobErgebnis> => {
    const budget = Math.min(job.fristMs, Math.floor(restbudgetMs - (performance.now() - start)));
    if (budget < 1 || abbruch?.aborted) return 'nicht_reserviert';
    const reservierungStart = performance.now();
    const deadline = AbortSignal.timeout(budget);
    const signal = abbruch ? AbortSignal.any([deadline, abbruch]) : deadline;
    const vorbereitung = await withTaktStatementTimeout(budget, async () => {
      if (await beendeAbgelaufenenLauf(tenantId, job.schluessel, faelligFuer)) return 'abgebrochen' as const;
      return reserviereLauf(tenantId, job.schluessel, faelligFuer, budget);
    }, signal);
    if (vorbereitung === 'abgebrochen') return vorbereitung;
    const reservierung = vorbereitung;
    if (!reservierung) return 'nicht_reserviert';

    let status: LaufAbschluss = 'ok';
    let ergebnis: JobErgebnis = 'ok';
    let fehlercode: string | null = null;
    try {
      signal.throwIfAborted();
      const uebrig = Math.max(1, budget - Math.floor(performance.now() - reservierungStart));
      await withTaktStatementTimeout(uebrig, async () => {
        let aktiv = true;
        if (job.paket !== null) {
          try { aktiv = await paketAktiv(job.paket); }
          catch { fehlercode = 'takt_paket_lesen'; throw Error(fehlercode); }
        }
        if (!aktiv) {
          status = 'übersprungen';
          ergebnis = 'übersprungen';
        } else {
          ergebnis = await job.ausfuehren(tenantId, signal, leser);
          signal.throwIfAborted();
          if (job.schluessel === 'protokoll_aufbewahrung' && ergebnis === 'ok') {
            const tage = await leser.protokollAufbewahrungTage();
            if (tage !== null) {
              try { await loescheAlteLaeufe(tenantId, tage, reservierung.id, signal); }
              catch { fehlercode = 'takt_aufbewahrung'; throw Error(fehlercode); }
            }
          }
        }
      }, signal);
    } catch (error) {
      status = signal.aborted || error instanceof PageReadTimeout ? 'abgebrochen' : 'fehler';
      const besetzt = status === 'fehler' && error instanceof Error && error.message === 'TAKT_HEUTE_BESETZT';
      ergebnis = besetzt ? 'besetzt' : status;
      if (besetzt) fehlercode = 'takt_heute_besetzt';
      fehlercode = status === 'fehler' ? fehlercode ?? 'takt_ausfuehrung' : null;
    }
    await beendeLauf(tenantId, reservierung, status, Math.max(0, Math.floor(performance.now() - start)), fehlercode);
    return ergebnis;
  }, {budgetMs: Math.min(job.fristMs, Math.floor(restbudgetMs)), signal: abbruch});
  return innerhalb ?? 'nicht_reserviert';
}
