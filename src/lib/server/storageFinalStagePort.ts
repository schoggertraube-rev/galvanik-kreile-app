import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from './privilegedDb';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {readCommunicationDeliveryFailures} from './communicationDeliveryPort';
import {handedOverProofs} from './dispatchCallPort';
import {verifyPostalDispatch,finishPostalTaskAfterGoodsOut} from './storagePostalPort';
import type {StorageEligibility} from '@/modules/orders/public';
import {COLLECTION_REMINDER_COPY as copy} from '@/ui/situationCatalog';
import {readOrderPickupAppointmentInTransaction,readPickupAppointmentReceiptInTransaction} from './pickupAppointmentPort';

type Letter=NonNullable<StorageEligibility['letter']>;
type Meta={customerId:string;handover:string;letterKey:string;threadId:string|null;postalDocumentId?:string;recipientId:string;due:string;orders:Array<{id:string;number:string;version:number}>;freezes:Letter['freezes']};
type Source={payload:{meta:Meta;taskId:string};user_id:string;proof_ok:boolean};
function finalKey(letterKey:string){const h=createHash('sha256').update('storage-final:'+letterKey).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);}
async function verifyLetter(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,origin:{threadId:string|null;postalDocumentId?:string;customerId:string;letterKey:string}){
 if(origin.postalDocumentId){if(origin.threadId!==null)throw Error('STORAGE_LETTER_CHANNEL_INVALID');return verifyPostalDispatch(tx,auth,{customerId:origin.customerId,letterKey:origin.letterKey,documentId:origin.postalDocumentId});}
 if(!origin.threadId)throw Error('STORAGE_LETTER_SOURCE_MISSING');
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
  const rows=await tx.execute<{status:'offen'|'erledigt';version:number;actor:string|null;note:string|null}>(sql`SELECT status,version,erledigt_von::text AS actor,erledigt_notiz AS note FROM public.tasks WHERE tenant_id=${auth.tenantId} AND id=${source.payload.taskId}::uuid`);
  if(rows.length!==1)throw Error('STORAGE_FINAL_TASK_MISSING');
  const ends=await tx.execute<{user_id:string;payload:{appointmentEventId:string;version:number;note:string;letterKey:string}}>(sql`SELECT user_id::text,payload FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_COLLECTION_TASK_ENDED_FOR_APPOINTMENT_V1' AND status='success' AND event_schema_version=1 AND payload->>'taskId'=${source.payload.taskId}`);
  if(ends.length){const end=ends[0];if(ends.length!==1||rows[0].status!=='erledigt'||rows[0].actor!==end.user_id||rows[0].note!==end.payload.note||rows[0].version!==end.payload.version||end.payload.letterKey!==letterKey)throw Error('STORAGE_FINAL_APPOINTMENT_END_INVALID');const appointment=await readPickupAppointmentReceiptInTransaction(tx,auth,end.payload.appointmentEventId);if(appointment.actorId!==end.user_id||!source.payload.meta.freezes.some(proof=>proof.orderId===appointment.orderId&&proof.freezeId===appointment.freezeId))throw Error('STORAGE_FINAL_APPOINTMENT_SOURCE_INVALID');}
  return {taskId:source.payload.taskId,status:rows[0].status,recipientId:source.payload.meta.recipientId,due:source.payload.meta.due};
 });
}
export async function finishFinalTasksForAppointment(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,appointment:{eventId:string;orderId:string;freezeId:string;date:string},complete:(taskId:string,note:string)=>Promise<void>){
 const rows=await tx.execute<{key:string}>(sql`SELECT event.correlation_id::text AS key FROM public.tasks task JOIN public.events event ON event.tenant_id=task.tenant_id AND event.payload->>'taskId'=task.id::text WHERE task.tenant_id=${auth.tenantId} AND task.status='offen' AND event.event_type='ORDER_STORAGE_FINAL_TASK_CREATED_V1' AND event.payload->'meta'->'freezes' @> ${JSON.stringify([{orderId:appointment.orderId,freezeId:appointment.freezeId}])}::jsonb ORDER BY task.id FOR UPDATE OF task NOWAIT`);
 for(const row of rows){
  const original=await receipt(tx,auth,row.key);if(!original)throw Error('FINAL_APPOINTMENT_SOURCE_MISSING');
  const note=copy.appointmentAgreed(appointment.date);await complete(original.payload.taskId,note);
  const closed=await tx.execute<{version:number}>(sql`SELECT version FROM public.tasks WHERE tenant_id=${auth.tenantId} AND id=${original.payload.taskId}::uuid AND status='erledigt' AND erledigt_von=${auth.userId}::uuid AND erledigt_notiz=${note}`);if(closed.length!==1)throw Error('FINAL_APPOINTMENT_TASK_NOT_ENDED');
  const id=randomUUID(),saved=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,event_type,description,status,user_id,event_schema_version,payload,created_at) VALUES(${id},${auth.tenantId},'ORDER_COLLECTION_TASK_ENDED_FOR_APPOINTMENT_V1',${note},'success',${auth.userId}::uuid,1,${JSON.stringify({appointmentEventId:appointment.eventId,taskId:original.payload.taskId,version:closed[0].version,note,letterKey:row.key})}::jsonb,statement_timestamp()) RETURNING id`);
  if(saved.length!==1||saved[0].id!==id)throw Error('FINAL_APPOINTMENT_END_NOT_SAVED');
 }
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
export async function lockStorageFinalTasksForGoodsOut(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,orderId:string){
 await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${auth.tenantId+':storage-final-order:'+orderId},0))`);
 const rows=await tx.execute<{id:string;letter_key:string;kind:'final'|'postal'}>(sql`SELECT task.id::text,event.correlation_id::text AS letter_key,CASE WHEN event.event_type='ORDER_STORAGE_FINAL_TASK_CREATED_V1' THEN 'final' ELSE 'postal' END AS kind FROM public.tasks task JOIN public.events event ON event.tenant_id=task.tenant_id AND (event.event_type='ORDER_STORAGE_FINAL_TASK_CREATED_V1' OR event.event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND event.payload->>'channel'='post') AND event.payload->>'taskId'=task.id::text WHERE task.tenant_id=${auth.tenantId} AND task.status='offen' AND event.payload->'meta'->'orders' @> ${JSON.stringify([{id:orderId}])}::jsonb ORDER BY task.id FOR UPDATE OF task`);
 return rows.map(row=>({id:row.id,letter_key:row.letter_key,kind:row.kind}));
}
export async function finishStorageFinalTasksAfterGoodsOut(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,sources:ReadonlyArray<{id:string;letter_key:string;kind:'final'|'postal'}>,complete:(input:{taskId:string;orderId:string;clientKey:string})=>Promise<void>){
 for(const source of sources){
  if(source.kind==='postal'){await finishPostalTaskAfterGoodsOut(tx,auth,{taskId:source.id,letterKey:source.letter_key},complete);continue;}
  const created=await receipt(tx,auth,source.letter_key);if(!created||created.payload.taskId!==source.id)throw Error('STORAGE_FINAL_CLOSE_SOURCE_INVALID');
  const meta=created.payload.meta,proofs=await handedOverProofs(tx,auth,meta.orders.map(order=>order.id));if(!proofs)continue;
  await complete({taskId:source.id,orderId:meta.orders[0].id,clientKey:finalKey(meta.letterKey)});
  await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,status,user_id,client_event_id,correlation_id,event_schema_version,payload,created_at) VALUES(${randomUUID()},${auth.tenantId},'ORDER_STORAGE_FINAL_TASK_CLOSED_V1',${copy.finalTaskGoodsGone},'success',${auth.userId}::uuid,${randomUUID()}::uuid,${meta.letterKey}::uuid,1,${JSON.stringify({taskId:source.id,goodsOutProofs:proofs})}::jsonb,statement_timestamp())`);
 }
}
export async function createStorageFinalTask(auth:AuthorizationSnapshot,input:{customerId:string;handover:string;clientKey:string},letter:Letter,orders:Meta['orders'],settingsUpdatedAt:string,createTask:(tx:PrivilegedTenantTransaction,input:{orderId:string;clientKey:string;title:string;note:string;kind:'aufgabe';forLogin:string;dueDate:string})=>Promise<string>){
 if(!hasAuthorizationArea(auth,'mails')||!hasAuthorizationArea(auth,'auftraege'))return {code:'FORBIDDEN' as const,message:copy.forbidden};
 if(letter.state!=='SENT'||letter.clientKey!==input.clientKey||letter.finalStage.state!=='DUE'||!letter.finalStage.recipientId||!letter.finalStage.due||!letter.threadId&&!letter.postalDocumentId||!orders.length)return {code:'CONFLICT' as const,message:copy.notReady};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${auth.tenantId+':storage-final:'+input.clientKey},0))`);
  const prior=await receipt(tx,auth,input.clientKey);if(prior){if(prior.user_id!==auth.userId)return {code:'CONFLICT' as const,message:copy.keyConflict};return {code:'OK' as const,taskId:prior.payload.taskId,replayed:true};}
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'task:'+auth.tenantId+':'+finalKey(input.clientKey)},0))`);
  const occupied=await tx.execute(sql`SELECT id FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=${finalKey(input.clientKey)}::uuid`);
  if(occupied.length)return {code:'CONFLICT' as const,message:copy.keyConflict};
  // Shared with goods-out before its task scan: a newly committed task cannot escape that scan.
  for(const order of [...orders].sort((a,b)=>a.id.localeCompare(b.id)))await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${auth.tenantId+':storage-final-order:'+order.id},0))`);
  const settings=await tx.execute(sql`SELECT id FROM public.company_settings WHERE tenant_id=${auth.tenantId} AND updated_at=${settingsUpdatedAt}::timestamptz FOR SHARE`);if(settings.length!==1)throw Error('STORAGE_FINAL_SETTINGS_CHANGED');
  await verifyLetter(tx,auth,{threadId:letter.threadId,postalDocumentId:letter.postalDocumentId,customerId:input.customerId,letterKey:input.clientKey});
  const current=await tx.execute<{id:string;version:number;freeze_id:string}>(sql`SELECT o.id,o.version,f.freeze_id::text FROM public.orders o JOIN private.v_order_freeze_state_v1 f ON f.tenant_id=o.tenant_id AND f.order_id=o.id AND f.active AND f.integrity_ok WHERE o.tenant_id=${auth.tenantId} AND o.customer_id=${input.customerId} AND o.handover_mode=${input.handover} AND o.id=ANY(ARRAY[${sql.join(orders.map(order=>sql`${order.id}`),sql`, `)}]::text[]) AND o.station='fertig' AND o.status='fertig' AND o.current_station='fertig' AND o.current_station_id='fertig' ORDER BY o.id FOR UPDATE OF o`);
  if(current.length!==orders.length||current.some(row=>orders.find(order=>order.id===row.id)?.version!==row.version||!letter.freezes.some(f=>f.orderId===row.id&&f.freezeId===row.freeze_id)))throw Error('STORAGE_FINAL_ORDERS_CHANGED');
  for(const order of current)if(await readOrderPickupAppointmentInTransaction(tx,auth,order.id))return {code:'CONFLICT' as const,message:copy.notReady};
  const members=[...orders].sort((a,b)=>a.id.localeCompare(b.id)),meta:Meta={customerId:input.customerId,handover:input.handover,letterKey:input.clientKey,threadId:letter.threadId,...(letter.postalDocumentId?{postalDocumentId:letter.postalDocumentId}:{}),recipientId:letter.finalStage.recipientId!,due:letter.finalStage.due!,orders:members,freezes:letter.freezes};
  const taskId=await createTask(tx,{orderId:members[0].id,clientKey:finalKey(input.clientKey),title:copy.finalTaskTitle,note:copy.finalTaskNote(members.map(order=>order.number)),kind:'aufgabe',forLogin:meta.recipientId,dueDate:meta.due});
  await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,status,user_id,client_event_id,correlation_id,event_schema_version,payload,created_at) VALUES(${randomUUID()},${auth.tenantId},'ORDER_STORAGE_FINAL_TASK_CREATED_V1',${copy.finalTaskTitle},'success',${auth.userId}::uuid,${finalKey(input.clientKey)}::uuid,${input.clientKey}::uuid,1,${JSON.stringify({meta,taskId})}::jsonb,statement_timestamp())`);
  return {code:'OK' as const,taskId,replayed:false};
 });}catch(error){console.error('[STORAGE_FINAL_TASK_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const,message:copy.proofUnavailable};}
}
