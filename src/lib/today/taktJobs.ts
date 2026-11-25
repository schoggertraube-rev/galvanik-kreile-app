import 'server-only';
import {taeglichFaelligAb} from '@/lib/domain/workingDays';
import {rebuildTodayModel, refreshTodayModel} from '@/lib/server/todayProjection';

/** The stale path uses the existing bounded projector, with the same receipt key. */
export async function fuehreHeuteAuffrischung(tenantId: string, signal: AbortSignal): Promise<'ok' | 'ohne_arbeit'> {
  signal.throwIfAborted();
  const result = await refreshTodayModel(tenantId, undefined, {bounded: true, signal});
  signal.throwIfAborted();
  if (result.code === 'BUSY') throw Error('TAKT_HEUTE_BESETZT');
  if (result.code !== 'OK' || result.stale > 0) throw Error('TAKT_HEUTE_AUFFRISCHUNG_INCOMPLETE');
  return result.built > 0 ? 'ok' : 'ohne_arbeit';
}

/** The regular job uses the existing full projector; stale catch-up is selected by the runner. */
export const HEUTE_TAKT_JOBS = [{
  schluessel: 'heute_neuaufbau',
  paket: null,
  faellig: (jetzt: Date, letzterTermin: string | null) => taeglichFaelligAb(jetzt, letzterTermin, '02:00'),
  fristMs: 25_000,
  ausfuehren: async (tenantId: string, signal: AbortSignal) => {
    signal.throwIfAborted();
    const result = await rebuildTodayModel(tenantId, undefined, {bounded: true, signal});
    signal.throwIfAborted();
    if (result.code === 'BUSY') throw Error('TAKT_HEUTE_BESETZT');
    if (result.code !== 'OK' || result.stale > 0) throw Error('TAKT_HEUTE_NEUAUFBAU_INCOMPLETE');
    return result.built > 0 ? 'ok' as const : 'ohne_arbeit' as const;
  },
}] as const;
