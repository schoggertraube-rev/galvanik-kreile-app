import 'server-only';
import {berlinCalendarDay, berlinUhrzeit} from '@/lib/domain/workingDays';
import {withTaktStatementTimeout} from '@/lib/server/privilegedDb';
import {type TaktJob, type TaktLeser} from '../public';
import type {PackageSwitchId} from '@/modules/fundament/public';
import {beendeLauf, loescheAlteLaeufe, reserviereLauf, type LaufAbschluss} from './laeufe';

export type FaelligerJob = Readonly<{job: TaktJob; faelligFuer: string}>;
export type JobErgebnis = 'nicht_reserviert' | 'ok' | 'ohne_arbeit' | 'übersprungen' | 'fehler' | 'abgebrochen';

/** Preserve registration order while qualifying each job against its own success. */
export async function liesFaelligeJobs(
  jobs: readonly TaktJob[], jetzt: Date, letzterOk: (schluessel: string) => Promise<Date | null>,
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
): Promise<JobErgebnis> {
  const {job, faelligFuer} = faellig;
  const reservierung = await reserviereLauf(tenantId, job.schluessel, faelligFuer, job.fristMs);
  if (!reservierung) return 'nicht_reserviert';

  const start = performance.now();
  let status: LaufAbschluss = 'ok';
  let ergebnis: JobErgebnis = 'ok';
  let fehlercode: string | null = null;
  const signal = AbortSignal.timeout(job.fristMs);
  try {
    await withTaktStatementTimeout(job.fristMs, async () => {
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
          try { await loescheAlteLaeufe(tenantId, tage, reservierung.id); }
          catch { fehlercode = 'takt_aufbewahrung'; throw Error(fehlercode); }
        }
      }
    }
    });
  } catch {
    status = signal.aborted ? 'abgebrochen' : 'fehler';
    ergebnis = status;
    if (status === 'fehler') fehlercode ??= 'takt_ausfuehrung';
  }
  await beendeLauf(tenantId, reservierung, status, Math.max(0, Math.floor(performance.now() - start)), fehlercode);
  return ergebnis;
}
