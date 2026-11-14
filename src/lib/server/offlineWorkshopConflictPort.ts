import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {canonicalJson} from '@/lib/domain/canonicalJson';
import {isPendingWorkshopOriginal,type PendingWorkshopOriginal} from '@/lib/offline/pendingStore';
import {isWorkshopRejectionCode,type WorkshopRejectionCode,type WorkshopRejectionReceipt} from '@/lib/offline/workshopRejectionContract';
import {OFFLINE_RECONCILIATION_COPY as copy} from '@/ui/situationCatalog';
import type {AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from './privilegedDb';

type Rejection=WorkshopRejectionCode;
type Original=Pick<PendingWorkshopOriginal,'command'|'input'|'deviceCapturedAt'>;
function identity(auth:AuthorizationSnapshot,entry:PendingWorkshopOriginal){
 if(!isPendingWorkshopOriginal(entry)||!entry.deviceCapturedAt||!Number.isFinite(Date.parse(entry.deviceCapturedAt)))throw Error('OFFLINE_WORKSHOP_ORIGINAL_INVALID');
 const original:Original={command:entry.command,input:entry.input,deviceCapturedAt:entry.deviceCapturedAt};
 const intent=canonicalJson(original),bytes=createHash('sha256').update('offline-workshop:'+auth.tenantId+':'+entry.id).digest();bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
 const h=bytes.subarray(0,16).toString('hex'),id=h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
 return {id,intent,original};
}
type Saved={id:string;user_id:string;payload:{intent:string;rejection:Rejection;message?:string};task_id:string|null;proof_ok:boolean};
async function previous(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string){
 return tx.execute<Saved>(sql`SELECT original.id::text,original.user_id::text,original.payload,link.payload->>'taskId' AS task_id,
  (original.event_type='OFFLINE_WORKSHOP_REJECTED_V1' AND original.status='success' AND original.event_schema_version=1
   AND link.user_id::text=original.user_id::text AND link.status='success' AND link.event_schema_version=1
   AND task.erstellt_von::text=original.user_id::text AND task.id::text=link.payload->>'taskId'
   AND NOT EXISTS(SELECT 1 FROM public.events effect WHERE effect.tenant_id=original.tenant_id
     AND effect.client_event_id=(original.payload#>>'{original,input,clientEventId}')::uuid)) AS proof_ok
  FROM public.events original LEFT JOIN public.events link ON link.tenant_id=original.tenant_id
   AND link.event_type='OFFLINE_WORKSHOP_REJECTED_TASK_V1' AND link.correlation_id::text=original.id::text
  LEFT JOIN public.tasks task ON task.tenant_id=original.tenant_id AND task.id::text=link.payload->>'taskId'
  WHERE original.tenant_id=${auth.tenantId} AND original.client_event_id=${id}::uuid`);
}
/** Serialize one original around the existing command. A rejected original is
 * terminal evidence: a later retry cannot silently turn it into a new command.
 * Infrastructure/session failures remain in the device queue, without a task.
 */
export async function reconcileOfflineWorkshop<T extends {code:string}>(auth:AuthorizationSnapshot,entry:PendingWorkshopOriginal,apply:()=>Promise<T>,createTask:(tx:PrivilegedTenantTransaction,eventId:string)=>Promise<string>){
 const source=identity(auth,entry);
 const buildReceipt=(taskId:string,rejection:Rejection):Omit<WorkshopRejectionReceipt,'scope'>=>({eventId:source.id,taskId,actorId:auth.userId,clientEventId:entry.id,deviceCapturedAt:entry.deviceCapturedAt!,originalCanonical:source.intent,rejection});
 return withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${auth.tenantId+':offline-workshop:'+entry.id},0))`);
  const prior=await previous(tx,auth,source.id);
  if(prior.length){
   if(prior.length!==1||prior[0].id!==source.id||prior[0].user_id!==auth.userId||prior[0].payload.intent!==source.intent||prior[0].proof_ok!==true||!prior[0].task_id||!isWorkshopRejectionCode(prior[0].payload.rejection))throw Error('OFFLINE_WORKSHOP_ORIGINAL_CHANGED');
   return {code:'PRESERVED' as const,eventId:source.id,taskId:prior[0].task_id,replayed:true,message:prior[0].payload.message??copy.reason,rejectionReceipt:buildReceipt(prior[0].task_id,prior[0].payload.rejection)};
  }
  const result=await apply();
  if(!isWorkshopRejectionCode(result.code))return result;
  const orderId='orderId'in entry.input?entry.input.orderId:null;
  const [order]=orderId===null?[]:await tx.execute<{id:string}>(sql`SELECT id FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=${orderId}`);
  const message='message'in result&&typeof result.message==='string'?result.message:copy.reason;
  const inserted=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version)
   VALUES(${source.id}::uuid,${auth.tenantId},${order?.id??null},'OFFLINE_WORKSHOP_REJECTED_V1',${copy.reason},${JSON.stringify({quelle:'offline_abgleich',reason:copy.reason,original:source.original,intent:source.intent,rejection:result.code,message})}::jsonb,'success',${auth.userId}::uuid,${source.id}::uuid,1) RETURNING id::text`);
  if(inserted.length!==1||inserted[0].id!==source.id)throw Error('OFFLINE_WORKSHOP_ORIGINAL_NOT_SAVED');
  const taskId=await createTask(tx,source.id);
  const linked=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,correlation_id,event_schema_version)
   VALUES(gen_random_uuid(),${auth.tenantId},${order?.id??null},'OFFLINE_WORKSHOP_REJECTED_TASK_V1',${copy.reason},${JSON.stringify({taskId})}::jsonb,'success',${auth.userId}::uuid,${randomUUID()}::uuid,${source.id}::uuid,1) RETURNING id::text`);
  if(linked.length!==1)throw Error('OFFLINE_WORKSHOP_TASK_LINK_NOT_SAVED');
  const proof=await previous(tx,auth,source.id);if(proof.length!==1||proof[0].proof_ok!==true)throw Error('OFFLINE_WORKSHOP_RECEIPT_NOT_READABLE');
  return {code:'PRESERVED' as const,eventId:source.id,taskId,replayed:false,message,rejectionReceipt:buildReceipt(taskId,result.code)};
 });
}

/** Exact source gate used only by the existing task writer. */
export async function readOfflineWorkshopConflictSource(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,eventId:string){
 const rows=await tx.execute<{id:string;user_id:string;order_id:string|null;payload:{quelle:string;reason:string;rejection:string;original:Original;intent:string}}>(sql`SELECT id::text,user_id::text,order_id,payload FROM public.events
  WHERE tenant_id=${auth.tenantId} AND id=${eventId} AND event_type='OFFLINE_WORKSHOP_REJECTED_V1' AND status='success' AND event_schema_version=1`);
 const row=rows[0];if(rows.length!==1||row.user_id!==auth.userId||row.payload.quelle!=='offline_abgleich'||row.payload.reason!==copy.reason||!['CONFLICT','FORBIDDEN','NOT_FOUND','VALIDATION_ERROR'].includes(row.payload.rejection))throw Error('OFFLINE_WORKSHOP_SOURCE_INVALID');
 const original=row.payload.original,itemId='orderId'in original.input?original.input.orderId:'invoiceId'in original.input?original.input.invoiceId:original.input.customerId;
 const entry={...original,kind:'workshop' as const,id:original.input.clientEventId,itemId} as PendingWorkshopOriginal;
 const expected=identity(auth,entry);if(expected.id!==row.id||expected.intent!==row.payload.intent||row.order_id!==null&&(!('orderId'in original.input)||row.order_id!==original.input.orderId))throw Error('OFFLINE_WORKSHOP_SOURCE_CHANGED');
 return {orderId:row.order_id,deviceCapturedAt:original.deviceCapturedAt!};
}
