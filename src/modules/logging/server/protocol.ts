import 'server-only';
import {sql} from 'drizzle-orm';
import {createHash} from 'node:crypto';
import {resolveAuthorization,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {actionObservationActive,withActionObservation} from '@/lib/server/actionObservation';
import {hasAuthorizationArea} from '@/lib/auth/authorizationContract';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {TechnicalEvent,TechnicalLogRow,ClickLogRow,LogFilter,LogSubject,LogReason,LoggingSettingsReader} from '../public';

// PL16.11: instance-local loss is explicitly accepted at cold start. Not a second log source.
let missed=0;
const id=/^[A-Za-z0-9_.:~/-]{1,200}$/;
const command=/^[A-Za-z][A-Za-z0-9_.:-]{0,99}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reasons:readonly LogReason[]=['FORBIDDEN','VALIDATION','CONFLICT','NOT_FOUND','UNAVAILABLE','UNAUTHENTICATED','SERVER_ERROR','UNKNOWN'];
const services=['microsoft365','belegerkennung','versand','druck'];
const outcomes=['ok','fehler','zeitueberschreitung','unklar'];
function lose(count=1){missed=Math.min(2147483647,missed+count);}

/** Diagnostics take only a named UUID reference, never a request body or free text.
 * Groups use their request key rather than an arbitrary first object. */
export function subjectForAction(name:string,input:unknown):LogSubject{
 if(input&&typeof input==='object'&&!Array.isArray(input)){
  const fields=[['invoiceId','invoice'],['quoteId','quote'],['orderId','order'],['customerId','customer'],['sourceItemId','intake'],['itemId','item'],['taskId','task'],['fileId','file'],['targetId','target'],['clientEventId','request'],['clientRequestId','request'],['clientKey','request']] as const;
  for(const [field,type] of fields){
   const descriptor=Object.getOwnPropertyDescriptor(input,field),value:unknown=descriptor?.value;
   if(typeof value==='string'&&uuid.test(value))return {type,id:value};
  }
 }
 return {type:'action',id:name};
}

/** Only named scalar fields cross the sink. Error objects, inputs and extra properties never do. */
export async function logTechnical(auth:AuthorizationSnapshot|null,event:TechnicalEvent):Promise<boolean>{
 if(!auth||auth.active!==true||!auth.tenantId||!uuid.test(auth.userId)){lose();return false;}
 const lost=missed;missed=0;
 try{
  if(!command.test(event.command)||!event.subject||!/^[a-z][a-z0-9_]{0,39}$/.test(event.subject.type)||!id.test(event.subject.id))throw Error('LOG_REFERENCE_INVALID');
  const type=event.type;
  if(!['rejected','server_error','slow','external','offline_sync','offline_conflict','offline_quarantine'].includes(type))throw Error('LOG_TYPE_INVALID');
  const occurredAt=event.occurredAt===undefined?new Date().toISOString():event.occurredAt;
  if(!Number.isFinite(Date.parse(occurredAt)))throw Error('LOG_TIME_INVALID');
  const reason=type==='rejected'||type==='server_error'?event.reason:null;
  if(reason!==null&&!reasons.includes(reason))throw Error('LOG_REASON_INVALID');
  const duration=type==='slow'?event.durationMs:null;
  if(duration!==null&&(!Number.isSafeInteger(duration)||duration<0||duration>2147483647))throw Error('LOG_DURATION_INVALID');
  const dienst=type==='external'?event.dienst:null,ergebnis=type==='external'?event.ergebnis:null;
  if(type==='external'&&(!services.includes(event.dienst)||!outcomes.includes(event.ergebnis)))throw Error('LOG_EXTERNAL_INVALID');
  const original=type==='external'?event.original:undefined;
  if(original&&(!id.test(original.ref)||!/^[a-f0-9]{64}$/.test(original.sha256)))throw Error('LOG_ORIGINAL_INVALID');
  const written=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{id:string}>(sql`
   INSERT INTO public.technical_protocol(tenant_id,user_id,occurred_at,event_type,command,subject_type,subject_id,duration_ms,reason,dienst,ergebnis,original_ref,original_sha256,verpasst)
   VALUES(${auth.tenantId},${auth.userId}::uuid,${occurredAt}::timestamptz,${type},${event.command},${event.subject.type},${event.subject.id},${duration},${reason},${dienst},${ergebnis},${original?original.ref:null},${original?original.sha256:null},${lost}) RETURNING id`));
  if(written.length!==1)throw Error('LOG_WRITE_RECEIPT_MISSING');
  return true;
 }catch{lose(lost+1);return false;}
}

/** Same hash is used by the click writer and the authorized user filter. */
export function actorPseudonym(userId:string){return createHash('sha256').update(userId).digest('hex');}

export async function readLog(auth:AuthorizationSnapshot,filter:LogFilter,readSettings:LoggingSettingsReader){
 if(!hasAuthorizationArea(auth,'protokoll'))return {code:'FORBIDDEN' as const};
 if(!filter||typeof filter!=='object'||(filter.userId!==undefined&&!uuid.test(filter.userId))
  ||(filter.subjectId!==undefined&&!id.test(filter.subjectId))
  ||(filter.from!==undefined&&!Number.isFinite(Date.parse(filter.from)))
  ||(filter.until!==undefined&&!Number.isFinite(Date.parse(filter.until)))
  ||(filter.limit!==undefined&&(!Number.isSafeInteger(filter.limit)||filter.limit<1||filter.limit>500)))return {code:'VALIDATION_ERROR' as const};
 try{
  const settings=await readSettings(auth);
  if(!settings)return {code:'SOURCE_INCOMPLETE' as const};
  if(!settings.enabled)return {code:'DISABLED' as const};
  return await withPrivilegedTenantTransaction(auth,async tx=>{
   if(settings.retentionDays!==null){
    await tx.execute(sql`DELETE FROM public.technical_protocol WHERE tenant_id=${auth.tenantId} AND recorded_at<statement_timestamp()-(${settings.retentionDays}*interval '1 day')`);
    await tx.execute(sql`DELETE FROM public.app_usage_events WHERE tenant_id=${auth.tenantId} AND received_at<statement_timestamp()-(${settings.retentionDays}*interval '1 day')`);
   }
   const technical=await tx.execute<TechnicalLogRow>(sql`SELECT id,user_id::text AS "userId",occurred_at::text AS "occurredAt",recorded_at::text AS "recordedAt",event_type AS type,command,subject_type AS "subjectType",subject_id AS "subjectId",duration_ms AS "durationMs",reason,dienst,ergebnis,original_ref AS "originalRef",original_sha256 AS "originalSha256",verpasst
    FROM public.technical_protocol WHERE tenant_id=${auth.tenantId}
    ${filter.userId?sql`AND user_id=${filter.userId}::uuid`:sql``}
    ${filter.subjectId?sql`AND subject_id=${filter.subjectId}`:sql``}
    ${filter.from?sql`AND occurred_at>=${filter.from}::timestamptz`:sql``}
    ${filter.until?sql`AND occurred_at<=${filter.until}::timestamptz`:sql``}
    ORDER BY occurred_at DESC,id DESC LIMIT ${filter.limit===undefined?100:filter.limit}`);
   const clicks=filter.subjectId!==undefined?null:await tx.execute<ClickLogRow>(sql`SELECT client_event_id::text AS id,target,route,occurred_at::text AS "occurredAt",duration_ms AS "durationMs",outcome,click_count AS "clickCount",(duration_ms>=${settings.hangMs}) AS hang
    FROM public.app_usage_events WHERE tenant_id=${auth.tenantId} AND event_type='action'
    ${filter.userId?sql`AND actor_pseudonym=${actorPseudonym(filter.userId)}`:sql``}
    ${filter.from?sql`AND occurred_at>=${filter.from}::timestamptz`:sql``}
    ${filter.until?sql`AND occurred_at<=${filter.until}::timestamptz`:sql``}
    ORDER BY occurred_at DESC,client_event_id DESC LIMIT ${filter.limit===undefined?100:filter.limit}`);
   return {code:'OK' as const,technical,clicks,datenluecken:clicks===null?['CLICK_SUBJECT_NOT_RECORDED']:[]};
  });
 }catch{return {code:'UNAVAILABLE' as const};}
}

/** One observer for Action compositions. It never changes the command's result or transaction. */
export async function observeAction<T>(name:string,subject:LogSubject,work:()=>Promise<T>,readSettings:LoggingSettingsReader,options:{errorIdentifier?:string}={}):Promise<T>{
 if(actionObservationActive())return work();
 return withActionObservation(async readAuthorization=>{
 // A rejected input is not a verified object reference (and may contain secrets).
 // The command itself remains the known subject when a supplied ID is malformed.
 const source=subject&&uuid.test(subject.id)?subject:{type:'action',id:name};
 const start=performance.now();
 let result:T;
 try{result=await work();}
 catch(error){
  if(!readAuthorization().attempted){try{await resolveAuthorization();}catch{lose();}}
  const observation=readAuthorization();
  if(observation.failures.size){for(const identifier of observation.failures)await logTechnical(observation.authorization,{type:'server_error',command:identifier,subject:source,reason:'UNKNOWN'});}
  else await logTechnical(observation.authorization,{type:'server_error',command:options.errorIdentifier??name,subject:source,reason:'SERVER_ERROR'});
  throw error;
 }
 const durationMs=Math.round(performance.now()-start);
 const objectResult=result!==null&&typeof result==='object'?result as Record<string,unknown>:null;
 const rawCode=objectResult&&typeof objectResult.code==='string'?objectResult.code:null;
 const legacyFailure=objectResult!==null&&objectResult.ok===false;
 const legacyCode=legacyFailure&&typeof objectResult.error==='string'?objectResult.error:null;
 const code=rawCode??(legacyFailure?(legacyCode==='DB_ERROR'?'UNAVAILABLE':legacyCode==='UNAUTHORIZED'||legacyCode==='AUTH_ERROR'?'UNAUTHENTICATED':legacyCode??'UNKNOWN_FAILURE'):null);
 const failure=code!==null&&['FORBIDDEN','VALIDATION_ERROR','CONFLICT','NOT_FOUND','UNAUTHENTICATED','UNAVAILABLE','SOURCE_INCOMPLETE','NOT_AVAILABLE','UNKNOWN_FAILURE'].includes(code);
 // Validation may return before the command's first auth lookup. Resolve only
 // that missing identity, never repeat a lookup or replace a rejected session.
 if(failure&&!readAuthorization().attempted){try{await resolveAuthorization();}catch{lose();}}
 const auth=readAuthorization().authorization;
 const reported=readAuthorization().failures;
 for(const identifier of reported)await logTechnical(auth,{type:'server_error',command:identifier,subject:source,reason:'UNKNOWN'});
 let slowMs:number|null=null;
 if(auth){try{const settings=await readSettings(auth);if(settings)slowMs=settings.slowMs;else lose();}catch{lose();}}
 if(failure&&code!==null&&reported.size===0){
  const reason=code==='VALIDATION_ERROR'?'VALIDATION':reasons.includes(code as LogReason)?code as LogReason:'UNKNOWN';
  await logTechnical(auth,{type:code==='UNAVAILABLE'?'server_error':'rejected',command:code==='UNAVAILABLE'?options.errorIdentifier??name:name,subject:source,reason});
 }
 if(auth&&slowMs!==null&&durationMs>slowMs)await logTechnical(auth,{type:'slow',command:name,subject:source,durationMs});
 return result;
 },logTechnical);
}
