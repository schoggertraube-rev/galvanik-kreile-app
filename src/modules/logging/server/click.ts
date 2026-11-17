import 'server-only';
import {sql} from 'drizzle-orm';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import type {LoggingSettingsReader,ProtocolRejection,ProtocolReply} from '../public';
import {parseClick,PROTOCOL_EVENT_ID} from '../clickContract';
import {actorPseudonym,countMissedEntries} from './protocol';

function sqlState(error:unknown):string|null{
 for(let depth=0;depth<4&&error&&typeof error==='object';depth++){
  if('code'in error&&typeof error.code==='string'&&/^[0-9A-Z]{5}$/.test(error.code))return error.code;
  error='cause'in error?error.cause:null;
 }
 return null;
}
/** Existing click source, now independent receipts: a bad entry never rolls
 * another click back. Only unavailable storage is retriable. PL19:41 K1/K4. */
export async function logClick(auth:AuthorizationSnapshot,input:unknown,readSettings:LoggingSettingsReader):Promise<ProtocolReply>{
 if(!Array.isArray(input)||input.length<1||input.length>50)return {code:'VALIDATION_ERROR',accepted:[],rejected:[]};
 const accepted:string[]=[],rejected:ProtocolRejection[]=[];let unavailable=false;
 let settings:Awaited<ReturnType<LoggingSettingsReader>>;
 try{settings=await readSettings(auth);}catch{countMissedEntries();return {code:'UNAVAILABLE',accepted,rejected};}
 const seen=new Set<string>();
 for(const raw of input){
  const entry=parseClick(raw),rawId=raw&&typeof raw==='object'&&typeof raw.id==='string'&&PROTOCOL_EVENT_ID.test(raw.id)?raw.id:null;
  if(rawId&&seen.has(rawId))continue;
  if(rawId)seen.add(rawId);
  if(!entry){if(rawId)rejected.push({id:rawId,code:'VALIDATION_ERROR'});continue;}
  if(input.filter(row=>row&&typeof row==='object'&&row.id===entry.id).some(row=>JSON.stringify(parseClick(row))!==JSON.stringify(entry))){rejected.push({id:entry.id,code:'CONFLICT'});continue;}
  if(!settings){rejected.push({id:entry.id,code:'SOURCE_INCOMPLETE'});continue;}
  if(!settings.enabled){rejected.push({id:entry.id,code:'DISABLED'});continue;}
  try{
   await withPrivilegedTenantTransaction(auth,async tx=>{
    await tx.execute(sql`SET LOCAL statement_timeout='2000ms'`);
    const pseudonym=actorPseudonym(auth.userId);
    await tx.execute(sql`INSERT INTO public.app_usage_events(tenant_id,client_event_id,actor_pseudonym,actor_role,session_id,event_type,route,target,device_class,outcome,duration_ms,click_count,occurred_at)
     VALUES(${auth.tenantId},${entry.id}::uuid,${pseudonym},${auth.role},${entry.sessionId}::uuid,'action',${entry.route},${entry.target},${entry.deviceClass},${entry.outcome},${entry.durationMs},${entry.clickCount},${entry.occurredAt}::timestamptz)
     ON CONFLICT(tenant_id,client_event_id) DO NOTHING`);
    const receipt=await tx.execute<{same:boolean}>(sql`SELECT (actor_pseudonym=${pseudonym}
     AND session_id=${entry.sessionId}::uuid AND event_type='action' AND route=${entry.route} AND target=${entry.target}
     AND device_class=${entry.deviceClass} AND outcome IS NOT DISTINCT FROM ${entry.outcome} AND duration_ms IS NOT DISTINCT FROM ${entry.durationMs}
     AND click_count=${entry.clickCount} AND occurred_at=${entry.occurredAt}::timestamptz) AS same
     FROM public.app_usage_events WHERE tenant_id=${auth.tenantId} AND client_event_id=${entry.id}::uuid`);
    if(receipt.length!==1)throw Error('CLICK_WRITE_RECEIPT_MISSING');
    if(receipt[0].same!==true)throw Error('CLICK_RETRY_CONFLICT');
   });
   accepted.push(entry.id);
  }catch(error){
   if(error instanceof Error&&error.message==='CLICK_RETRY_CONFLICT')rejected.push({id:entry.id,code:'CONFLICT'});
   else if(sqlState(error)==='23514'||sqlState(error)?.startsWith('22'))rejected.push({id:entry.id,code:'VALIDATION_ERROR'});
   else{unavailable=true;countMissedEntries();}
  }
 }
 return {code:unavailable?'UNAVAILABLE':accepted.length?'OK':rejected[0]?.code??'VALIDATION_ERROR',accepted,rejected};
}
