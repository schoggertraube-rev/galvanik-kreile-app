import 'server-only';
import {sql} from 'drizzle-orm';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import type {LoggingSettingsReader} from '../public';
import {parseClick} from '../clickContract';
import {actorPseudonym} from './protocol';

/** Existing app_usage_events is the sole click source; a batch is all-or-nothing. */
export async function logClick(auth:AuthorizationSnapshot,input:unknown,readSettings:LoggingSettingsReader){
 if(!Array.isArray(input)||input.length<1||input.length>50)return {code:'VALIDATION_ERROR' as const};
 const entries=input.map(parseClick);
 if(entries.some(entry=>entry===null))return {code:'VALIDATION_ERROR' as const};
 try{
  const settings=await readSettings(auth);
  if(!settings)return {code:'SOURCE_INCOMPLETE' as const};
  if(!settings.enabled)return {code:'DISABLED' as const};
  return await withPrivilegedTenantTransaction(auth,async tx=>{
   const pseudonym=actorPseudonym(auth.userId),accepted:string[]=[];
   for(const entry of entries){
    if(entry===null)throw Error('CLICK_INVALID');
    await tx.execute(sql`INSERT INTO public.app_usage_events(tenant_id,client_event_id,actor_pseudonym,actor_role,session_id,event_type,route,target,device_class,outcome,duration_ms,click_count,occurred_at)
     VALUES(${auth.tenantId},${entry.id}::uuid,${pseudonym},${auth.role},${entry.sessionId}::uuid,'action',${entry.route},${entry.target},${entry.deviceClass},${entry.outcome},${entry.durationMs},${entry.clickCount},${entry.occurredAt}::timestamptz)
     ON CONFLICT(tenant_id,client_event_id) DO NOTHING`);
    // An authenticated role change does not rewrite or invalidate this user's original.
    const receipt=await tx.execute<{same:boolean}>(sql`SELECT (actor_pseudonym=${pseudonym}
     AND session_id=${entry.sessionId}::uuid AND event_type='action' AND route=${entry.route} AND target=${entry.target}
     AND device_class=${entry.deviceClass} AND outcome=${entry.outcome} AND duration_ms=${entry.durationMs}
     AND click_count=${entry.clickCount} AND occurred_at=${entry.occurredAt}::timestamptz) AS same
     FROM public.app_usage_events WHERE tenant_id=${auth.tenantId} AND client_event_id=${entry.id}::uuid`);
    if(receipt.length!==1||receipt[0].same!==true)throw Error('CLICK_RETRY_CONFLICT');
    accepted.push(entry.id);
   }
   return {code:'OK' as const,accepted};
  });
 }catch(error){return {code:error instanceof Error&&error.message==='CLICK_RETRY_CONFLICT'?'CONFLICT' as const:'UNAVAILABLE' as const};}
}
