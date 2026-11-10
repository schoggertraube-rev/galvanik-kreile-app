import 'server-only';
import {qualifyStorageOrigin,storageOriginIsCurrent,type StorageOrigin} from './pickupAppointmentPort';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from './privilegedDb';
import {COLLECTION_REMINDER_COPY} from '@/ui/situationCatalog';
import {readCommunicationDeliveryFailures} from './communicationDeliveryPort';
import {readPostalCollectionHistory} from './storagePostalPort';

export type CollectionReminderRequest={targetId:string;clientRequestId:string;subject:string;body:string;collectionReminder:{stage:'E1'|'E2'|'E4';handover:'pickup'|'shipping';dueDate:string;clientKey?:string}};
export type CollectionReminderMeta={customerMessage?:{subject:string;body:string};stage:'E1'|'E2'|'E4';customerId:string;handover:'pickup'|'shipping';dueDate:string;stageKey:string;intent:string;orders:Array<{id:string;number:string;version:number}>;storageDeadline?:{date:string;due:string|null};storageOrigin?:StorageOrigin;replacesForReply?:{documentId:string;replyEventId:string};replacesForAppointment?:{documentId:string;appointmentEventId:string}};
export type CollectionReminderHistoryEntry={stage:'E1'|'E2'|'E4';stageKey:string;dueDate:string;storageDeadline?:CollectionReminderMeta['storageDeadline'];storageOrigin?:CollectionReminderMeta['storageOrigin'];sentAt:string|null;threadId:string|null;orderIds:string[];deliveryFailedAt:string|null;postalDocumentId?:string;postalTaskId?:string;voidId?:string};
export function collectionReminderIntent(input:CollectionReminderRequest){return createHash('sha256').update(JSON.stringify([input.targetId,input.subject.trim(),input.body.trim(),input.collectionReminder.stage,input.collectionReminder.handover,input.collectionReminder.dueDate,...(input.collectionReminder.stage==='E4'?[input.collectionReminder.clientKey]:[])])).digest('hex');}
const hash=(body:string)=>createHash('sha256').update(body.trim()).digest('hex');

export async function readCollectionReminderReceipt(auth:AuthorizationSnapshot,input:CollectionReminderRequest){
 if(!hasAuthorizationArea(auth,'mails')||!hasAuthorizationArea(auth,'auftraege'))return {code:'FORBIDDEN' as const,message:COLLECTION_REMINDER_COPY.forbidden};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<{payload:{meta:CollectionReminderMeta;threadId:string;bodySha256:string};user_id:string;status:string;message_id:string|null;sent_body:string|null;sent_subject:string;recorded_at:string;sent_intent:string|null;proof_ok:boolean}>(sql`SELECT prepared.payload,prepared.user_id::text,thread.status,message.id::text AS message_id,message.body AS sent_body,thread.subject AS sent_subject,thread.created_at::text AS recorded_at,sent.payload->>'intent' AS sent_intent,
   (thread.created_by=prepared.user_id AND sent.user_id=prepared.user_id AND sent.correlation_id=prepared.correlation_id AND sent.payload->>'messageId'=message.id::text AND sent.payload->'meta'=prepared.payload->'meta') AS proof_ok
   FROM public.events prepared JOIN public.communication_threads thread ON thread.tenant_id=prepared.tenant_id AND thread.id::text=prepared.payload->>'threadId' AND thread.source=${'MS_GRAPH_OUT:'+input.clientRequestId} AND thread.order_id IS NULL
   LEFT JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id AND message.direction='outgoing' AND message.channel='email'
   LEFT JOIN public.events sent ON sent.tenant_id=thread.tenant_id AND sent.event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND sent.payload->>'threadId'=thread.id::text
   WHERE prepared.tenant_id=${auth.tenantId} AND prepared.event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND prepared.correlation_id=${input.clientRequestId}::uuid`);
  if(!rows.length)return {code:'NOT_FOUND' as const};
  const row=rows[0];if(rows.length!==1||row.user_id!==auth.userId||row.payload.meta.intent!==collectionReminderIntent(input))return {code:'CONFLICT' as const,message:COLLECTION_REMINDER_COPY.keyConflict};
  if(row.status!=='sent')return {code:'CONFLICT' as const,message:COLLECTION_REMINDER_COPY.unclear};
  if(row.proof_ok!==true||!row.message_id||!row.sent_body||hash(row.sent_body)!==row.payload.bodySha256||row.sent_subject!==(row.payload.meta.customerMessage?.subject??input.subject.trim())||row.sent_intent!==row.payload.meta.intent)throw Error('COLLECTION_REMINDER_RECEIPT_INVALID');
  return {code:'OK' as const,data:{threadId:row.payload.threadId,messageId:row.message_id,customerId:input.targetId,orderId:null,recordedAt:new Date(row.recorded_at).toISOString(),replayed:true}};
 });}catch(error){console.error('[COLLECTION_REMINDER_RECEIPT_FAILED]',error instanceof Error?error.name:'UnknownError');return {code:'UNAVAILABLE' as const,message:COLLECTION_REMINDER_COPY.proofUnavailable};}
}

export async function prepareCollectionReminder(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,meta:CollectionReminderMeta,input:{threadId:string;clientRequestId:string;body:string}){
 if(!hasAuthorizationArea(auth,'mails')||!hasAuthorizationArea(auth,'auftraege'))throw Error('COLLECTION_REMINDER_FORBIDDEN');
 await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${auth.tenantId+':collection:'+meta.stageKey},0))`);
 const prior=await tx.execute(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND client_event_id=${meta.stageKey}::uuid`);
 if(prior.length)throw Error('COLLECTION_REMINDER_ALREADY_PREPARED');
  const orders=await tx.execute<{id:string;order_number:string;version:number;customer_id:string;handover_mode:string;station:string;current_station:string;current_station_id:string;status:string}>(sql`SELECT id,order_number,version,customer_id,handover_mode,station,current_station,current_station_id,status FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=ANY(ARRAY[${sql.join(meta.orders.map(order=>sql`${order.id}`),sql`, `)}]::text[]) ORDER BY id FOR UPDATE`);
 if(orders.length!==meta.orders.length||orders.some(order=>order.customer_id!==meta.customerId||order.handover_mode!==meta.handover||[order.station,order.current_station,order.current_station_id,order.status].some(state=>state!=='fertig')||order.version!==meta.orders.find(member=>member.id===order.id)?.version||order.order_number!==meta.orders.find(member=>member.id===order.id)?.number))throw Error('COLLECTION_REMINDER_COHORT_CHANGED');
 if(meta.stage==='E4'){
  if(!meta.storageOrigin||meta.storageOrigin.freezes.length!==meta.orders.length||!await storageOriginIsCurrent(tx,auth,meta.storageOrigin,meta.dueDate))throw Error('STORAGE_LETTER_ORIGIN_MISSING');
  const current=await tx.execute<{order_id:string;freeze_id:string}>(sql`SELECT order_id,freeze_id::text FROM private.v_order_freeze_state_v1 WHERE tenant_id=${auth.tenantId} AND order_id=ANY(ARRAY[${sql.join(meta.orders.map(order=>sql`${order.id}`),sql`, `)}]::text[]) AND active AND integrity_ok`);
  if(current.length!==meta.orders.length||current.some(row=>!meta.storageOrigin!.freezes.some(proof=>proof.orderId===row.order_id&&proof.freezeId===row.freeze_id)))throw Error('STORAGE_LETTER_CYCLE_CHANGED');
 }
 await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,status,user_id,client_event_id,correlation_id,event_schema_version,payload,created_at)
 VALUES(${randomUUID()},${auth.tenantId},'ORDER_COLLECTION_REMINDER_PREPARED_V1','Sammelerinnerung ausdrücklich freigegeben','success',${auth.userId}::uuid,${meta.stageKey}::uuid,${input.clientRequestId}::uuid,1,${JSON.stringify({meta,threadId:input.threadId,bodySha256:hash(input.body)})}::jsonb,statement_timestamp())`);
}

export async function appendCollectionReminderSent(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,meta:CollectionReminderMeta,threadId:string,messageId:string,requestId:string){
 const prepared=await tx.execute(sql`SELECT event.id FROM public.events event JOIN public.communication_threads thread ON thread.tenant_id=event.tenant_id AND thread.id=${threadId}::uuid AND thread.status='sent' AND thread.customer_id=${meta.customerId}
  JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.id=${messageId}::uuid AND message.thread_id=thread.id AND message.direction='outgoing' AND message.channel='email'
  WHERE event.tenant_id=${auth.tenantId} AND event.event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND event.client_event_id=${meta.stageKey}::uuid AND event.user_id=${auth.userId}::uuid AND event.payload->>'threadId'=thread.id::text AND event.payload->'meta'->>'intent'=${meta.intent} AND event.payload->>'bodySha256'=encode(sha256(convert_to(message.body,'UTF8')),'hex')`);
 if(prepared.length!==1)throw Error('COLLECTION_REMINDER_SENT_PROOF_INVALID');
 await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,status,user_id,client_event_id,correlation_id,event_schema_version,payload,created_at)
 VALUES(${randomUUID()},${auth.tenantId},'ORDER_COLLECTION_REMINDER_SENT_V1','Sammelerinnerung an Microsoft 365 übergeben','success',${auth.userId}::uuid,${randomUUID()}::uuid,${requestId}::uuid,1,${JSON.stringify({threadId,messageId,intent:meta.intent,meta})}::jsonb,statement_timestamp())`);
}

export async function readCollectionReminderHistory(auth:AuthorizationSnapshot,customerId:string,handover:'pickup'|'shipping',orderIds:readonly string[]):Promise<CollectionReminderHistoryEntry[]>{
 return withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<{prepared_id:string;payload:{meta:CollectionReminderMeta;threadId:string;bodySha256:string};sent_at:string|null;sent_intent:string|null;body:string|null;status:string;proof_ok:boolean}>(sql`SELECT prepared.id::text AS prepared_id,prepared.payload,thread.status,(sent.created_at AT TIME ZONE 'UTC')::text AS sent_at,sent.payload->>'intent' AS sent_intent,message.body,
    (prepared.status='success' AND prepared.event_schema_version=1 AND sent.status='success' AND sent.event_schema_version=1 AND prepared.user_id=thread.created_by AND sent.user_id=prepared.user_id AND sent.correlation_id=prepared.correlation_id
     AND thread.source='MS_GRAPH_OUT:'||prepared.correlation_id::text AND sent.payload->>'messageId'=message.id::text AND sent.payload->'meta'=prepared.payload->'meta') AS proof_ok
   FROM public.events prepared JOIN public.communication_threads thread ON thread.tenant_id=prepared.tenant_id AND thread.id::text=prepared.payload->>'threadId'
   LEFT JOIN public.events sent ON sent.tenant_id=thread.tenant_id AND sent.event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND sent.payload->>'threadId'=thread.id::text
   LEFT JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id AND message.direction='outgoing' AND message.channel='email'
   WHERE prepared.tenant_id=${auth.tenantId} AND prepared.event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND prepared.payload->'meta'->>'customerId'=${customerId} AND prepared.payload->'meta'->>'handover'=${handover} ORDER BY prepared.created_at,prepared.id`);
  const relevant=rows.filter(row=>row.payload.meta.orders.some(member=>orderIds.includes(member.id)));
  if(new Set(relevant.map(row=>row.prepared_id)).size!==relevant.length)throw Error('COLLECTION_HISTORY_PROOF_AMBIGUOUS');
  if(relevant.some(row=>row.payload.meta.stage==='E4'&&(!row.payload.meta.storageOrigin||!Array.isArray(row.payload.meta.storageOrigin.freezes)||row.payload.meta.storageOrigin.freezes.length!==row.payload.meta.orders.length||row.payload.meta.orders.some(order=>!row.payload.meta.storageOrigin!.freezes.some(proof=>proof.orderId===order.id&&typeof proof.freezeId==='string')))))throw Error('STORAGE_LETTER_HISTORY_ORIGIN_INVALID');
  if(relevant.some(row=>row.sent_at&&(row.proof_ok!==true||row.status!=='sent'||row.sent_intent!==row.payload.meta.intent||!row.body||hash(row.body)!==row.payload.bodySha256)))throw Error('COLLECTION_HISTORY_PROOF_INVALID');
  for(const row of relevant)if(row.payload.meta.stage==='E4')await qualifyStorageOrigin(tx,auth,row.payload.meta.storageOrigin!);
  const failures=await readCommunicationDeliveryFailures(tx,auth,relevant.map(row=>row.payload.threadId));
  return [...relevant.map(row=>({stage:row.payload.meta.stage,stageKey:row.payload.meta.stageKey,dueDate:row.payload.meta.dueDate,storageDeadline:row.payload.meta.storageDeadline,storageOrigin:row.payload.meta.storageOrigin,sentAt:row.sent_at?new Date(row.sent_at).toISOString():null,threadId:row.payload.threadId,orderIds:row.payload.meta.orders.map(member=>member.id),deliveryFailedAt:failures.find(proof=>proof.threadId===row.payload.threadId)?.recordedAt??null})),...await readPostalCollectionHistory(tx,auth,customerId,handover,orderIds)];
 });
}
