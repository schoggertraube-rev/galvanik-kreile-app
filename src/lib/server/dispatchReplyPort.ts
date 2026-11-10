import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {canonicalJson} from '@/lib/domain/canonicalJson';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from './privilegedDb';
import {readDispatchResponseScope,type DispatchResponseCheck} from './dispatchResponsePort';
import {COLLECTION_REMINDER_COPY,DISPATCH_CALL_COPY} from '@/ui/situationCatalog';
import {berlinCalendarDay} from '@/lib/domain/workingDays';

type Proof=DispatchResponseCheck['proofs'][number];
export type DispatchReplyReceipt={eventId:string;customerId:string;handover:'pickup'|'shipping';proof:Proof;actorId:string;recordedAt:string;note:string};
const hash=(value:unknown)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
function sourceKey(customerId:string,handover:string,proof:Proof){const h=hash([customerId,handover,proof.itemId,proof.threadId,proof.originalSha256,proof.freezes.slice().sort((a,b)=>(a.orderId+a.freezeId).localeCompare(b.orderId+b.freezeId))]);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;}

/** Validate only the narrowly projected original evidence, never mail text. */
async function qualify(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,receipt:DispatchReplyReceipt){
 const proof=receipt.proof;
 if(!proof||!Array.isArray(proof.freezes)||!proof.freezes.length||!Number.isFinite(Date.parse(proof.receivedAt))||!/^[a-f0-9]{64}$/.test(proof.originalSha256))throw Error('DISPATCH_REPLY_PROOF_INVALID');
 const originals=await tx.execute<{customer_id:string;received_at:Date|string;reply_chain:{source:string;status:string;originalSha256:string;inReplyTo:string[]};proof_ok:boolean}>(sql`SELECT customer_id,received_at,reply_chain,proof_ok FROM private.v_intake_reply_evidence_v1 WHERE tenant_id=${auth.tenantId} AND item_id=${proof.itemId}`);
 const original=originals[0];
 if(originals.length!==1||!original.proof_ok||original.customer_id!==receipt.customerId||new Date(original.received_at).toISOString()!==proof.receivedAt||original.reply_chain?.source!=='original_mime'||original.reply_chain.status!=='present'||original.reply_chain.originalSha256!==proof.originalSha256||JSON.stringify(original.reply_chain.inReplyTo)!==JSON.stringify([proof.inReplyTo]))throw Error('DISPATCH_REPLY_ORIGINAL_INVALID');
 const threads=await tx.execute(sql`SELECT id FROM public.communication_threads WHERE tenant_id=${auth.tenantId} AND id=${proof.threadId}::uuid AND customer_id=${receipt.customerId} AND status='sent' AND source LIKE 'MS_GRAPH_OUT:%'`);
 if(threads.length!==1)throw Error('DISPATCH_REPLY_THREAD_INVALID');
 const scope=await readDispatchResponseScope(tx,auth,proof.threadId);
 const sorted=(values:Proof['freezes'])=>values.slice().sort((a,b)=>(a.orderId+a.freezeId).localeCompare(b.orderId+b.freezeId));
 if(hash(sorted(scope))!==hash(sorted(proof.freezes))||JSON.stringify([...new Set(scope.map(row=>row.orderId))].sort())!==JSON.stringify(proof.orderIds.slice().sort()))throw Error('DISPATCH_REPLY_FREEZE_INVALID');
}

export async function readDispatchReplyReceipt(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,eventId:string){
 const rows=await tx.execute<{id:string;user_id:string;client_event_id:string;created_at:Date|string;status:string;event_schema_version:number;payload:{receipt:DispatchReplyReceipt;sha256:string}}>(sql`SELECT id,user_id::text,client_event_id::text,(created_at AT TIME ZONE 'UTC')::text AS created_at,status,event_schema_version,payload FROM public.events WHERE tenant_id=${auth.tenantId} AND id=${eventId} AND event_type='ORDER_COLLECTION_REPLY_RECORDED_V1'`);
 const row=rows[0],receipt=row?.payload?.receipt;
 if(rows.length!==1||!receipt||row.status!=='success'||row.event_schema_version!==1||row.id!==receipt.eventId||row.user_id!==receipt.actorId||new Date(row.created_at).toISOString()!==receipt.recordedAt||row.payload.sha256!==hash(receipt)||row.client_event_id!==sourceKey(receipt.customerId,receipt.handover,receipt.proof))throw Error('DISPATCH_REPLY_RECEIPT_INVALID');
 await qualify(tx,auth,receipt);
 return receipt;
}

/** Record the server-qualified relation to the original mail, not a second mail. */
export async function recordDispatchReply(auth:AuthorizationSnapshot,input:{customerId:string;handover:'pickup'|'shipping';proof:Proof},ports:{readCustomerName:(tx:PrivilegedTenantTransaction)=>Promise<string>;afterRecord:(tx:PrivilegedTenantTransaction,receipt:DispatchReplyReceipt)=>Promise<void>}){
 if(!hasAuthorizationArea(auth,'auftraege')||!hasAuthorizationArea(auth,'mails'))throw Error('DISPATCH_REPLY_FORBIDDEN');
 return withPrivilegedTenantTransaction(auth,async tx=>{
  const key=sourceKey(input.customerId,input.handover,input.proof);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${auth.tenantId+':collection-reply:'+key},0))`);
  await tx.execute(sql`SELECT id FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=ANY(ARRAY[${sql.join(input.proof.orderIds.slice().sort().map(id=>sql`${id}`),sql`, `)}]::text[]) ORDER BY id FOR UPDATE NOWAIT`);
  const previous=await tx.execute<{id:string}>(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND client_event_id=${key}::uuid`);
  if(previous.length){if(previous.length!==1)throw Error('DISPATCH_REPLY_KEY_CONFLICT');const receipt=await readDispatchReplyReceipt(tx,auth,previous[0].id);await ports.afterRecord(tx,receipt);return receipt;}
  const name=await ports.readCustomerName(tx);if(!name.trim())throw Error('DISPATCH_REPLY_CUSTOMER_MISSING');
  const date=berlinCalendarDay(new Date(input.proof.receivedAt));
  const receipt:DispatchReplyReceipt={eventId:randomUUID(),...input,actorId:auth.userId,recordedAt:new Date().toISOString(),note:COLLECTION_REMINDER_COPY.replyReceived(name,date)};
  await qualify(tx,auth,receipt);
  const saved=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,event_type,description,status,user_id,client_event_id,correlation_id,event_schema_version,created_at,payload)
   VALUES(${receipt.eventId},${auth.tenantId},'ORDER_COLLECTION_REPLY_RECORDED_V1',${receipt.note},'success',${auth.userId}::uuid,${key}::uuid,${key}::uuid,1,${receipt.recordedAt}::timestamptz,${JSON.stringify({receipt,sha256:hash(receipt)})}::jsonb) RETURNING id`);
  if(saved.length!==1||saved[0].id!==receipt.eventId)throw Error('DISPATCH_REPLY_RECEIPT_NOT_SAVED');
  await ports.afterRecord(tx,receipt);
  return receipt;
 });
}

export function replyCoversFreezes(reply:DispatchReplyReceipt,freezes:Proof['freezes']){
 return freezes.length>0&&freezes.every(proof=>reply.proof.freezes.some(source=>source.orderId===proof.orderId&&source.freezeId===proof.freezeId));
}
export async function recordReplyTaskEnd(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,reply:DispatchReplyReceipt,context:{taskId:string;meta?:unknown;documentId?:string;documentSha256?:string;letterKey?:string}){
 const tasks=await tx.execute<{version:number}>(sql`SELECT version FROM public.tasks WHERE tenant_id=${auth.tenantId} AND id=${context.taskId}::uuid AND status='erledigt' AND erledigt_am IS NOT NULL AND erledigt_von=${auth.userId}::uuid AND erledigt_notiz=${reply.note}`);
 if(tasks.length!==1)throw Error('DISPATCH_REPLY_TASK_NOT_ENDED');
 const id=randomUUID(),saved=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,event_type,description,status,user_id,event_schema_version,payload)
 VALUES(${id},${auth.tenantId},'ORDER_COLLECTION_TASK_ENDED_FOR_REPLY_V1',${reply.note},'success',${auth.userId}::uuid,1,${JSON.stringify({...context,replyEventId:reply.eventId,version:tasks[0].version,note:reply.note})}::jsonb) RETURNING id`);
 if(saved.length!==1||saved[0].id!==id)throw Error('DISPATCH_REPLY_TASK_END_NOT_SAVED');
}
export async function readReplyTaskEnd(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,taskId:string){
 const rows=await tx.execute<{id:string;user_id:string;proof_ok:boolean;payload:{replyEventId:string;taskId:string;version:number;note:string;meta?:unknown;documentId?:string;documentSha256?:string;letterKey?:string}}>(sql`SELECT event.id,event.user_id::text,event.payload,
 (event.status='success' AND event.event_schema_version=1 AND task.status='erledigt' AND task.erledigt_am IS NOT NULL AND task.version=(event.payload->>'version')::integer AND task.erledigt_von=event.user_id AND task.erledigt_notiz=event.payload->>'note') AS proof_ok
 FROM public.events event JOIN public.tasks task ON task.tenant_id=event.tenant_id AND task.id::text=event.payload->>'taskId' WHERE event.tenant_id=${auth.tenantId} AND event.event_type='ORDER_COLLECTION_TASK_ENDED_FOR_REPLY_V1' AND event.payload->>'taskId'=${taskId}`);
 if(!rows.length)return null;if(rows.length!==1||rows[0].proof_ok!==true)throw Error('DISPATCH_REPLY_TASK_END_INVALID');
 const row=rows[0],reply=await readDispatchReplyReceipt(tx,auth,row.payload.replyEventId);if(row.payload.note!==reply.note)throw Error('DISPATCH_REPLY_TASK_NOTE_INVALID');
 return {...row,reply};
}

export async function readRecordedDispatchReplies(auth:AuthorizationSnapshot,customerId:string,handover:'pickup'|'shipping'){
 if(!hasAuthorizationArea(auth,'auftraege'))throw Error('DISPATCH_REPLY_READ_FORBIDDEN');
 return withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<{id:string}>(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_COLLECTION_REPLY_RECORDED_V1' AND payload->'receipt'->>'customerId'=${customerId} AND payload->'receipt'->>'handover'=${handover} ORDER BY created_at,id LIMIT 1001`);
  if(rows.length>1000)throw Error('DISPATCH_REPLY_LIMIT');
  return Promise.all(rows.map(row=>readDispatchReplyReceipt(tx,auth,row.id)));
 });
}
export async function readLatestReplyForFreeze(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,orderId:string,freezeId:string){
 const rows=await tx.execute<{id:string}>(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_COLLECTION_REPLY_RECORDED_V1' AND payload->'receipt'->'proof'->'freezes' @> ${JSON.stringify([{orderId,freezeId}])}::jsonb ORDER BY (payload->'receipt'->'proof'->>'receivedAt')::timestamptz DESC,created_at DESC,id DESC LIMIT 1`);
 return rows.length?readDispatchReplyReceipt(tx,auth,rows[0].id):null;
}
export function replyDefersToAppointment(reply:DispatchReplyReceipt,appointment:{date:string;recordedAt:string}){
 return appointment.date>=berlinCalendarDay(new Date(reply.proof.receivedAt))||Date.parse(appointment.recordedAt)>=Date.parse(reply.proof.receivedAt);
}

/** Narrow source port for the one task writer; no ordinary task gains rights. */
export async function collectionTaskHasReplySource(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,taskId:string,eventId:string){
 if(!hasAuthorizationArea(auth,'auftraege'))return false;
 const receipt=await readDispatchReplyReceipt(tx,auth,eventId);
 const sources=await tx.execute<{payload:{meta:{customerId:string;handover:string;freezes?:Proof['freezes'];storageOrigin?:{freezes:Proof['freezes']}}}}>(sql`SELECT payload FROM public.events WHERE tenant_id=${auth.tenantId} AND status='success' AND event_schema_version=1 AND payload->>'taskId'=${taskId}
 AND (event_type IN ('ORDER_COLLECTION_CALL_CREATED_V1','ORDER_COLLECTION_CALL_UPDATED_V1','ORDER_STORAGE_FINAL_TASK_CREATED_V1','ORDER_STORAGE_FINAL_TASK_UPDATED_V1') OR event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND payload->>'channel'='post') ORDER BY created_at DESC,id DESC LIMIT 1`);
 const meta=sources[0]?.payload.meta,freezes=meta?.storageOrigin?.freezes??meta?.freezes;
 return !!meta&&meta.customerId===receipt.customerId&&meta.handover===receipt.handover&&!!freezes?.length&&(freezes.every(proof=>receipt.proof.freezes.some(source=>source.orderId===proof.orderId&&source.freezeId===proof.freezeId))||await postalReplyReplacementProved(tx,auth,taskId,receipt));
}
/** A partial postal task can end only after its exact unaffected original replacement exists in this transaction. */
export async function postalReplyReplacementProved(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,taskId:string,reply:DispatchReplyReceipt){
 type Prepared={document:{id:string;sha256:string;pdfBase64:string};taskId:string;meta:{customerId:string;handover:string;stageKey:string;orders:Array<{id:string}>;storageOrigin:{freezes:Proof['freezes']};replacesForReply?:{documentId:string;replyEventId:string}}};
 const old=await tx.execute<{payload:Prepared}>(sql`SELECT payload FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND status='success' AND event_schema_version=1 AND payload->>'channel'='post' AND payload->>'taskId'=${taskId}`);
 if(old.length!==1)return false;const source=old[0].payload;
 if(source.meta.customerId!==reply.customerId||source.meta.handover!==reply.handover)return false;
 const expected=source.meta.storageOrigin.freezes.filter(proof=>!reply.proof.freezes.some(item=>item.orderId===proof.orderId&&item.freezeId===proof.freezeId));
 if(!expected.length||expected.length===source.meta.storageOrigin.freezes.length)return false;
 const rows=await tx.execute<{payload:Prepared;proof_ok:boolean}>(sql`SELECT event.payload,(event.id::text=event.payload->'document'->>'id' AND event.client_event_id::text=event.payload->'meta'->>'stageKey' AND event.correlation_id=event.client_event_id AND task.client_key=event.client_event_id AND task.erstellt_von=event.user_id AND task.art='aufgabe' AND task.bezug_typ='auftrag' AND task.bezug_id=event.payload->'meta'->'orders'->0->>'id') AS proof_ok FROM public.events event JOIN public.tasks task ON task.tenant_id=event.tenant_id AND task.id::text=event.payload->>'taskId' WHERE event.tenant_id=${auth.tenantId} AND event.event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND event.status='success' AND event.event_schema_version=1 AND event.payload->>'channel'='post' AND event.payload->'meta'->'replacesForReply'->>'documentId'=${source.document.id} AND event.payload->'meta'->'replacesForReply'->>'replyEventId'=${reply.eventId}`);
 if(rows.length!==1||!rows[0].proof_ok)return false;const replacement=rows[0].payload,bytes=Buffer.from(replacement.document.pdfBase64,'base64');
 const key=(values:Proof['freezes'])=>values.map(proof=>proof.orderId+':'+proof.freezeId).sort();
 return replacement.taskId!==taskId&&replacement.meta.customerId===reply.customerId&&replacement.meta.handover===reply.handover&&hash(key(expected))===hash(key(replacement.meta.storageOrigin.freezes))&&hash(expected.map(proof=>proof.orderId).sort())===hash(replacement.meta.orders.map(order=>order.id).sort())&&bytes.subarray(0,5).toString()==='%PDF-'&&createHash('sha256').update(bytes).digest('hex')===replacement.document.sha256;
}

/** Only the unaffected remainder of a qualified shared collection task may change. */
export async function collectionTaskReplyRemainder(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,taskId:string,eventId:string){
 if(!hasAuthorizationArea(auth,'auftraege'))return null;
 const reply=await readDispatchReplyReceipt(tx,auth,eventId);
 const rows=await tx.execute<{event_type:string;payload:{meta:{customerId:string;handover:string;freezes:Proof['freezes'];orderIds?:string[];orderNumbers?:string[];orders?:Array<{id:string;number:string}>}}}>(sql`SELECT event_type,payload FROM public.events WHERE tenant_id=${auth.tenantId} AND status='success' AND event_schema_version=1 AND payload->>'taskId'=${taskId} AND event_type IN ('ORDER_COLLECTION_CALL_CREATED_V1','ORDER_COLLECTION_CALL_UPDATED_V1','ORDER_STORAGE_FINAL_TASK_CREATED_V1','ORDER_STORAGE_FINAL_TASK_UPDATED_V1') ORDER BY created_at DESC,id DESC LIMIT 1`);
 const source=rows[0],meta=source?.payload.meta;if(!meta||meta.customerId!==reply.customerId||meta.handover!==reply.handover)return null;
 const remaining=meta.freezes.filter(proof=>!reply.proof.freezes.some(item=>item.orderId===proof.orderId&&item.freezeId===proof.freezeId));
 if(!remaining.length||remaining.length===meta.freezes.length)return null;
 const numbers=meta.orders?meta.orders.filter(order=>remaining.some(proof=>proof.orderId===order.id)).map(order=>order.number):meta.orderIds?.flatMap((id,index)=>remaining.some(proof=>proof.orderId===id)?[meta.orderNumbers![index]]:[]);
 if(!numbers||numbers.length!==remaining.length||numbers.some(number=>!number))throw Error('REPLY_TASK_REMAINDER_INVALID');
 return {freezes:remaining,note:source.event_type.startsWith('ORDER_COLLECTION_CALL_')?DISPATCH_CALL_COPY.note+numbers.join(', '):COLLECTION_REMINDER_COPY.finalTaskNote(numbers)};
}
export async function qualifyReplyRestriction(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,eventId:string,before:Proof['freezes'],after:Proof['freezes']){
 const reply=await readDispatchReplyReceipt(tx,auth,eventId),expected=before.filter(proof=>!reply.proof.freezes.some(item=>item.orderId===proof.orderId&&item.freezeId===proof.freezeId));
 const key=(values:Proof['freezes'])=>values.map(proof=>proof.orderId+':'+proof.freezeId).sort();
 if(!expected.length||expected.length===before.length||JSON.stringify(key(expected))!==JSON.stringify(key(after)))throw Error('REPLY_TASK_RESTRICTION_INVALID');
}
