import 'server-only';
import {taeglichFaelligAb} from '@/lib/domain/workingDays';
import {TAKT_JOB_BUDGET_MS} from '@/modules/takt/public';

/** The stale path uses the existing bounded projector, with the same receipt key. */
export async function fuehreHeuteAuffrischung(tenantId: string, signal: AbortSignal): Promise<'ok' | 'ohne_arbeit'> {
  signal.throwIfAborted();
  const {refreshTodayModel}=await import('@/lib/server/todayProjection');
  const result = await refreshTodayModel(tenantId, undefined, {bounded: true, signal});
  signal.throwIfAborted();
  if (result.code === 'BUSY') throw Error('TAKT_HEUTE_BESETZT');
  if (result.code !== 'OK' || result.stale > 0) throw Error('TAKT_HEUTE_AUFFRISCHUNG_INCOMPLETE');
  return result.built > 0 ? 'ok' : 'ohne_arbeit';
}

/** Refresh the one outage source after the real job receipt has committed. */
export async function frischeTaktAusfallNachErgebnis(tenantId:string,signal?:AbortSignal):Promise<void>{
  try {
    const {refreshTodayModel}=await import('@/lib/server/todayProjection');
    const result=await refreshTodayModel(tenantId,undefined,{bounded:true,signal,taktErgebnis:true});
    if(result.code==='BUSY')return;
    if(result.code!=='OK'||result.stale>0)throw Error('TAKT_AUSFALL_AUFFRISCHUNG_INCOMPLETE');
  } catch {
    console.error('[TODAY_TAKT_SOURCE_FAILED]',{code:'SOURCE_INCOMPLETE'});
  }
}

/** The regular job uses the existing full projector; stale catch-up is selected by the runner. */
export const HEUTE_TAKT_JOBS = [{
  schluessel: 'heute_neuaufbau',
  paket: null,
  faellig: (jetzt: Date, letzterTermin: Date | null) => taeglichFaelligAb(jetzt, letzterTermin, '02:00'),
  fristMs: TAKT_JOB_BUDGET_MS,
  ausfuehren: async (tenantId: string, signal: AbortSignal) => {
    signal.throwIfAborted();
    const {rebuildTodayModel}=await import('@/lib/server/todayProjection');
    const result = await rebuildTodayModel(tenantId, undefined, {bounded: true, signal});
    signal.throwIfAborted();
    if (result.code === 'BUSY') throw Error('TAKT_HEUTE_BESETZT');
    if (result.code !== 'OK' || result.stale > 0) throw Error('TAKT_HEUTE_NEUAUFBAU_INCOMPLETE');
    return result.built > 0 ? 'ok' as const : 'ohne_arbeit' as const;
  },
}] as const;
