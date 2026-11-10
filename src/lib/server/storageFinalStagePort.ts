import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from './privilegedDb';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {readCommunicationDeliveryFailures} from './communicationDeliveryPort';
import type {StorageEligibility} from '@/modules/orders/public';
import {COLLECTION_REMINDER_COPY as copy} from '@/ui/situationCatalog';

type Letter=NonNullable<StorageEligibility['letter']>;
type Meta={customerId:string;handover:string;letterKey:string;threadId:string;recipientId:string;due:string;orders:Array<{id:string;number:string;version:number}>;freezes:Letter['freezes']};
type Source={payload:{meta:Meta;taskId:string};user_id:string;proof_ok:boolean};
function finalKey(letterKey:string){const h=createHash('sha256').update('storage-final:'+letterKey).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);}
async function verifyLetter(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,origin:{threadId:string;customerId:string;letterKey:string}){
  const proof=await tx.execute(sql`SELECT sent.id FROM public.events sent JOIN public.events prepared ON prepared.tenant_id=sent.tenant_id AND prepared.event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND prepared.payload->>'threadId'=${origin.threadId} AND prepared.payload->'meta'=sent.payload->'meta' AND prepared.correlation_id=sent.correlation_id AND prepared.user_id=sent.user_id AND prepared.status='success' AND prepared.event_schema_version=1
   JOIN public.communication_threads thread ON thread.tenant_id=sent.tenant_id AND thread.id=${origin.threadId}::uuid AND thread.status='sent' AND thread.customer_id=${origin.customerId} AND thread.created_by=sent.user_id AND thread.source='MS_GRAPH_OUT:'||sent.correlation_id::text
   JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id AND message.id::text=sent.payload->>'messageId' AND message.direction='outgoing' AND message.channel='email' AND encode(sha256(convert_to(message.body,'UTF8')),'hex')=prepared.payload->>'bodySha256'
   WHERE sent.tenant_id=${auth.tenantId} AND sent.event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND sent.status='success' AND sent.event_schema_version=1 AND sent.payload->>'threadId'=${origin.threadId} AND sent.payload->'meta'->>'stage'='E4' AND sent.payload->'meta'->>'stageKey'=${origin.letterKey}`);
  if(proof.length!==1||(await readCommunicationDeliveryFailures(tx,auth,[origin.threadId])).length)throw Error('STORAGE_FINAL_LETTER_INVALID');
}
async function receipt(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,letterKey:string){
 const rows=await tx.execute<Source>(sql`SELECT payload,user_id::text,(status='success' AND event_schema_version=1 AND client_event_id::text=${finalKey(letterKey)} AND correlation_id::text=${letterKey}) AS proof_ok FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_STORAGE_FINAL_TASK_CREATED_V1' AND correlation_id=${letterKey}::uuid`);
 if(!rows.length)return null;if(rows.length!==1||!rows[0].proof_ok)throw Error('STORAGE_FINAL_SOURCE_INVALID');
 const row=rows[0],meta=row.payload.meta;
 const task=await tx.execute(sql`SELECT id FROM public.tasks WHERE tenant_id=${auth.tenantId} AND id=${row.payload.taskId}::uuid AND client_key=${finalKey(letterKey)}::uuid AND erstellt_von=${row.user_id}::uuid AND art='aufgabe' AND titel=${copy.finalTaskTitle} AND notiz=${copy.finalTaskNote(meta.orders.map(order=>order.number))} AND fuer_login=${meta.recipientId}::uuid AND fuer_bereich IS NULL AND bezug_typ='auftrag' AND bezug_id=${meta.orders[0]?.id} AND status IN ('offen','erledigt')`);
 if(task.length!==1||meta.letterKey!==letterKey)throw Error('STORAGE_FINAL_TASK_INVALID');await verifyLetter(tx,auth,meta);return row;
}
export async function readStorageFinalTaskReceipt(auth:AuthorizationSnapshot,input:{customerId:string;handover:string;clientKey:string}){
 if(!hasAuthorizationArea(auth,'mails')||!hasAuthorizationArea(auth,'auftraege'))return {code:'FORBIDDEN' as const,message:copy.forbidden};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{const row=await receipt(tx,auth,input.clientKey);if(!row)return {code:'NOT_FOUND' as const};
  if(row.user_id!==auth.userId||row.payload.meta.customerId!==input.customerId||row.payload.meta.handover!==input.handover)return {code:'CONFLICT' as const,message:copy.keyConflict};
  return {code:'OK' as const,taskId:row.payload.taskId,replayed:true};
 });}catch(error){console.error('[STORAGE_FINAL_RECEIPT_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const,message:copy.proofUnavailable};}
}
export async function readStorageFinalTaskState(auth:AuthorizationSnapshot,letterKey:string){
 if(!hasAuthorizationArea(auth,'auftraege'))throw Error('STORAGE_FINAL_READ_FORBIDDEN');
 return withPrivilegedTenantTransaction(auth,async tx=>{
  const source=await receipt(tx,auth,letterKey);if(!source)return null;
  const rows=await tx.execute<{status:'offen'|'erledigt'}>(sql`SELECT status FROM public.tasks WHERE tenant_id=${auth.tenantId} AND id=${source.payload.taskId}::uuid`);
  if(rows.length!==1)throw Error('STORAGE_FINAL_TASK_MISSING');
  return {taskId:source.payload.taskId,status:rows[0].status,recipientId:source.payload.meta.recipientId,due:source.payload.meta.due};
 });
}
export async function protectStorageFinalTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{taskId:string;action:string}){
 if(input.action!=='geaendert')return;
 const sources=await tx.execute<{correlation_id:string}>(sql`SELECT correlation_id::text FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_STORAGE_FINAL_TASK_CREATED_V1' AND payload->>'taskId'=${input.taskId}`);
 for(const source of sources){
  try{await receipt(tx,auth,source.correlation_id);}catch(error){
   console.error('[STORAGE_FINAL_TASK_EDIT_BLOCKED]',error instanceof Error?error.message:'UnknownError');
   if(error instanceof Error&&error.message==='STORAGE_FINAL_TASK_INVALID')return {code:'CONFLICT' as const,message:copy.finalTaskProtected};
   throw error;
  }
 }
}
export async function createStorageFinalTask(auth:AuthorizationSnapshot,input:{customerId:string;handover:string;clientKey:string},letter:Letter,orders:Meta['orders'],settingsUpdatedAt:string,createTask:(tx:PrivilegedTenantTransaction,input:{orderId:string;clientKey:string;title:string;note:string;kind:'aufgabe';forLogin:string;dueDate:string})=>Promise<string>){
 if(!hasAuthorizationArea(auth,'mails')||!hasAuthorizationArea(auth,'auftraege'))return {code:'FORBIDDEN' as const,message:copy.forbidden};
 if(letter.state!=='SENT'||letter.clientKey!==input.clientKey||letter.finalStage.state!=='DUE'||!letter.finalStage.recipientId||!letter.finalStage.due||!letter.threadId||!orders.length)return {code:'CONFLICT' as const,message:copy.notReady};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${auth.tenantId+':storage-final:'+input.clientKey},0))`);
  const prior=await receipt(tx,auth,input.clientKey);if(prior){if(prior.user_id!==auth.userId)return {code:'CONFLICT' as const,message:copy.keyConflict};return {code:'OK' as const,taskId:prior.payload.taskId,replayed:true};}
  const settings=await tx.execute(sql`SELECT id FROM public.company_settings WHERE tenant_id=${auth.tenantId} AND updated_at=${settingsUpdatedAt}::timestamptz FOR SHARE`);if(settings.length!==1)throw Error('STORAGE_FINAL_SETTINGS_CHANGED');
  await verifyLetter(tx,auth,{threadId:letter.threadId!,customerId:input.customerId,letterKey:input.clientKey});
  const current=await tx.execute<{id:string;version:number;freeze_id:string}>(sql`SELECT o.id,o.version,f.freeze_id::text FROM public.orders o JOIN private.v_order_freeze_state_v1 f ON f.tenant_id=o.tenant_id AND f.order_id=o.id AND f.active AND f.integrity_ok WHERE o.tenant_id=${auth.tenantId} AND o.customer_id=${input.customerId} AND o.handover_mode=${input.handover} AND o.id=ANY(ARRAY[${sql.join(orders.map(order=>sql`${order.id}`),sql`, `)}]::text[]) AND o.station='fertig' AND o.status='fertig' AND o.current_station='fertig' AND o.current_station_id='fertig' ORDER BY o.id FOR UPDATE OF o`);
  if(current.length!==orders.length||current.some(row=>orders.find(order=>order.id===row.id)?.version!==row.version||!letter.freezes.some(f=>f.orderId===row.id&&f.freezeId===row.freeze_id)))throw Error('STORAGE_FINAL_ORDERS_CHANGED');
  const members=[...orders].sort((a,b)=>a.id.localeCompare(b.id)),meta:Meta={customerId:input.customerId,handover:input.handover,letterKey:input.clientKey,threadId:letter.threadId!,recipientId:letter.finalStage.recipientId!,due:letter.finalStage.due!,orders:members,freezes:letter.freezes};
  const taskId=await createTask(tx,{orderId:members[0].id,clientKey:finalKey(input.clientKey),title:copy.finalTaskTitle,note:copy.finalTaskNote(members.map(order=>order.number)),kind:'aufgabe',forLogin:meta.recipientId,dueDate:meta.due});
  await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,status,user_id,client_event_id,correlation_id,event_schema_version,payload,created_at) VALUES(${randomUUID()},${auth.tenantId},'ORDER_STORAGE_FINAL_TASK_CREATED_V1',${copy.finalTaskTitle},'success',${auth.userId}::uuid,${finalKey(input.clientKey)}::uuid,${input.clientKey}::uuid,1,${JSON.stringify({meta,taskId})}::jsonb,statement_timestamp())`);
  return {code:'OK' as const,taskId,replayed:false};
 });}catch(error){console.error('[STORAGE_FINAL_TASK_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const,message:copy.proofUnavailable};}
}
