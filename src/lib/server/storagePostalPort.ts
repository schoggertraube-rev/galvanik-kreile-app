import 'server-only';
import {CUSTOMER_COLLECTION_COPY} from '@/ui/situationCatalog';
import {readPickupCustomerName} from './pickupAppointmentPort';
import {restrictStorageLetterSnapshot} from './storageDeadline';
import {canonicalJson} from '@/lib/domain/canonicalJson';
import {readReplyTaskEnd,recordReplyTaskEnd,replyCoversFreezes,postalReplyReplacementProved,postalAppointmentReplacementProved,qualifyReplyRestriction,type DispatchReplyReceipt} from './dispatchReplyPort';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from './privilegedDb';
import type {TaskRecord,TaskCompleteInput,TaskFailure} from '@/modules/tasks/public';
import type {CollectionReminderMeta,CollectionReminderHistoryEntry} from './collectionReminderPort';
import type {StorageLetterSnapshot} from '@/lib/pdf/StorageLetterDocument';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import {handedOverProofs} from './dispatchCallPort';
import {COLLECTION_REMINDER_COPY as copy} from '@/ui/situationCatalog';
import {storageLetterKey} from './storageLetterKey';
import {readPickupAppointmentReceiptInTransaction,qualifyAppointmentRestriction,storageTaskHasAppointmentSource,qualifyStorageOrigin,storageOriginIsCurrent} from './pickupAppointmentPort';

type Document={id:string;snapshot:StorageLetterSnapshot;snapshotSha256:string;pdfBase64:string;sha256:string};
type Payload={channel:'post';meta:CollectionReminderMeta;document:Document;taskId:string;title:string;note:string};
type Source={id:string;payload:Payload;user_id:string;proof_ok:boolean};
const fail=(code:TaskFailure['code'],message:string):TaskFailure=>({code,message});
const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
function snapshotHash(value:StorageLetterSnapshot){const c=value.company,r=value.recipient;return digest(JSON.stringify([value.date,c.companyName,c.street,c.zip,c.city,c.country,r.name,r.street,r.zip,r.city,r.country,value.orderNumbers,value.body,...(value.deadline?[value.deadline.date,value.deadline.due]:[]),...(value.customerText?[canonicalJson(value.customerText)]:[])]));}
function postedDayValid(value:unknown,earliest:string):value is string{return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value&&value>=earliest&&value<=berlinCalendarDay();}
type TaskState={id:string;client_key:string;art:string;bezug_typ:string;bezug_id:string;erstellt_von:string;titel:string;notiz:string;fuer_bereich:string;fuer_login:string|null;status:string;version:number;erledigt_von:string|null;erledigt_notiz:string|null};
async function source(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,letterKey:string){
 const rows=await tx.execute<Source>(sql`SELECT id::text,payload,user_id::text,(status='success' AND event_schema_version=1 AND client_event_id::text=payload->'meta'->>'stageKey' AND correlation_id=client_event_id AND payload->'meta'->>'stage'='E4') AS proof_ok FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND client_event_id=${letterKey}::uuid AND payload->>'channel'='post'`);
 if(!rows.length)return null;if(rows.length!==1||!rows[0].proof_ok)throw Error('POSTAL_LETTER_SOURCE_INVALID');
 const row=rows[0],p=row.payload,d=p.document;
 if(d.id!==row.id||!p.meta.storageOrigin||snapshotHash(d.snapshot)!==d.snapshotSha256||JSON.stringify(d.snapshot.orderNumbers)!==JSON.stringify(p.meta.orders.map(order=>order.number)))throw Error('POSTAL_LETTER_DOCUMENT_INVALID');
 await qualifyStorageOrigin(tx,auth,p.meta.storageOrigin);
 if(p.meta.replacesForReply){
  const link=p.meta.replacesForReply,originals=await tx.execute<{payload:Payload}>(sql`SELECT payload FROM public.events WHERE tenant_id=${auth.tenantId} AND id=${link.documentId} AND event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND status='success' AND event_schema_version=1 AND payload->>'channel'='post'`);
  const before=originals[0]?.payload;if(originals.length!==1||!before?.meta.storageOrigin||before.meta.customerId!==p.meta.customerId||before.meta.handover!==p.meta.handover)throw Error('POSTAL_REPLACEMENT_ORIGIN_INVALID');
  await qualifyReplyRestriction(tx,auth,link.replyEventId,before.meta.storageOrigin.freezes,p.meta.storageOrigin.freezes);
  const remaining=before.meta.orders.filter(order=>p.meta.storageOrigin!.freezes.some(proof=>proof.orderId===order.id));
  const expected=restrictStorageLetterSnapshot(before.document.snapshot,remaining.map(order=>order.number));
  if(snapshotHash(expected)!==d.snapshotSha256||JSON.stringify(remaining)!==JSON.stringify(p.meta.orders)||p.meta.stageKey!==storageLetterKey(auth.tenantId,p.meta.customerId,p.meta.handover,before.meta.stageKey+':reply:'+link.replyEventId,remaining.map(order=>order.id))||p.meta.storageOrigin.callTaskId!==before.meta.storageOrigin.callTaskId||p.meta.storageOrigin.appointmentEventId!==before.meta.storageOrigin.appointmentEventId||p.meta.storageOrigin.replyEventId!==before.meta.storageOrigin.replyEventId)throw Error('POSTAL_REPLACEMENT_SCOPE_INVALID');
  const ended=await readReplyTaskEnd(tx,auth,before.taskId);if(!ended||ended.reply.eventId!==link.replyEventId||ended.payload.documentId!==before.document.id||ended.payload.documentSha256!==before.document.sha256)throw Error('POSTAL_REPLACEMENT_END_MISSING');
 }
 if(p.meta.replacesForAppointment){
  const link=p.meta.replacesForAppointment,originals=await tx.execute<{payload:Payload}>(sql`SELECT payload FROM public.events WHERE tenant_id=${auth.tenantId} AND id=${link.documentId} AND event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND status='success' AND event_schema_version=1 AND payload->>'channel'='post'`);
  const before=originals[0]?.payload;if(originals.length!==1||!before?.meta.storageOrigin||before.meta.customerId!==p.meta.customerId||before.meta.handover!==p.meta.handover)throw Error('POSTAL_REPLACEMENT_ORIGIN_INVALID');
  await qualifyAppointmentRestriction(tx,auth,link.appointmentEventId,before.meta.storageOrigin.freezes,p.meta.storageOrigin.freezes);
  const remaining=before.meta.orders.filter(order=>p.meta.storageOrigin!.freezes.some(proof=>proof.orderId===order.id));
  const expected=restrictStorageLetterSnapshot(before.document.snapshot,remaining.map(order=>order.number));
  if(snapshotHash(expected)!==d.snapshotSha256||JSON.stringify(remaining)!==JSON.stringify(p.meta.orders)||p.meta.stageKey!==storageLetterKey(auth.tenantId,p.meta.customerId,p.meta.handover,before.meta.stageKey+':appointment:'+link.appointmentEventId,remaining.map(order=>order.id))||p.meta.storageOrigin.callTaskId!==before.meta.storageOrigin.callTaskId||p.meta.storageOrigin.appointmentEventId!==before.meta.storageOrigin.appointmentEventId||p.meta.storageOrigin.replyEventId!==before.meta.storageOrigin.replyEventId)throw Error('POSTAL_REPLACEMENT_SCOPE_INVALID');
  const receipt=await readPickupAppointmentReceiptInTransaction(tx,auth,link.appointmentEventId);
  const ended=await tx.execute<{user_id:string;proof_ok:boolean;payload:{documentId:string;documentSha256:string}}>(sql`SELECT event.user_id::text,event.payload,(task.status='erledigt' AND task.erledigt_von=event.user_id AND task.version=(event.payload->>'version')::integer AND task.erledigt_notiz=event.payload->>'note') AS proof_ok FROM public.events event JOIN public.tasks task ON task.tenant_id=event.tenant_id AND task.id::text=event.payload->>'taskId' WHERE event.tenant_id=${auth.tenantId} AND event.event_type='ORDER_COLLECTION_TASK_ENDED_FOR_APPOINTMENT_V1' AND event.status='success' AND event.event_schema_version=1 AND event.payload->>'taskId'=${before.taskId} AND event.payload->>'appointmentEventId'=${link.appointmentEventId}`);
  if(ended.length!==1||!ended[0].proof_ok||ended[0].user_id!==receipt.actorId||ended[0].payload.documentId!==before.document.id||ended[0].payload.documentSha256!==before.document.sha256)throw Error('POSTAL_REPLACEMENT_APPOINTMENT_END_MISSING');
 }
 const bytes=Buffer.from(d.pdfBase64,'base64');if(bytes.toString('base64')!==d.pdfBase64||bytes.subarray(0,5).toString()!=='%PDF-'||createHash('sha256').update(bytes).digest('hex')!==d.sha256)throw Error('POSTAL_LETTER_PDF_INVALID');
 const tasks=await tx.execute<TaskState>(sql`SELECT id::text,client_key::text,art,bezug_typ,bezug_id,erstellt_von::text,titel,notiz,fuer_bereich,fuer_login::text,status,version,erledigt_von::text,erledigt_notiz FROM public.tasks WHERE tenant_id=${auth.tenantId} AND id=${p.taskId}::uuid`);
 const task=tasks[0];if(tasks.length!==1||task.client_key!==letterKey||task.art!=='aufgabe'||task.bezug_typ!=='auftrag'||task.bezug_id!==p.meta.orders[0]?.id||task.erstellt_von!==row.user_id||task.titel!==p.title||task.notiz!==p.note||task.fuer_bereich!=='auftraege'||task.fuer_login!==null)throw Error('POSTAL_LETTER_TASK_INVALID');
 const outcomes=await tx.execute<{id:string;event_type:string;payload:{meta:CollectionReminderMeta;documentId:string;documentSha256:string;taskId:string;taskVersion:number;note:string|null;postedOn?:string;reason?:string;goodsOutProofs?:Array<{orderId:string;eventId:string}>};user_id:string;proof_ok:boolean}>(sql`SELECT id::text,event_type,payload,user_id::text,(status='success' AND event_schema_version=1 AND correlation_id=${letterKey}::uuid) AS proof_ok FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type IN ('ORDER_COLLECTION_REMINDER_SENT_V1','ORDER_STORAGE_LETTER_VOIDED_V1') AND payload->>'channel'='post' AND payload->>'documentId'=${d.id}`);
 if(outcomes.length>1)throw Error('POSTAL_LETTER_OUTCOME_AMBIGUOUS');const outcome=outcomes[0];
 if(outcome&&(!outcome.proof_ok||outcome.payload.documentSha256!==d.sha256||outcome.payload.taskId!==task.id||outcome.payload.taskVersion!==task.version||outcome.user_id!==task.erledigt_von||task.status!=='erledigt'||outcome.payload.note!==task.erledigt_notiz||JSON.stringify(outcome.payload.meta)!==JSON.stringify(p.meta)))throw Error('POSTAL_LETTER_OUTCOME_INVALID');
 if(outcome?.event_type==='ORDER_COLLECTION_REMINDER_SENT_V1'&&!postedDayValid(outcome.payload.postedOn,d.snapshot.date))throw Error('POSTAL_LETTER_DATE_INVALID');
 if(outcome?.event_type==='ORDER_STORAGE_LETTER_VOIDED_V1'){
  if(typeof outcome.payload.reason!=='string'||!outcome.payload.reason.trim())throw Error('POSTAL_LETTER_VOID_INVALID');
  if(outcome.payload.reason==='goodsOut'){const actual=await handedOverProofs(tx,auth,p.meta.orders.map(order=>order.id)),stored=outcome.payload.goodsOutProofs;if(!actual||!Array.isArray(stored)||JSON.stringify(actual.map(row=>[row.orderId,row.eventId]))!==JSON.stringify(stored.map(row=>[row.orderId,row.eventId])))throw Error('POSTAL_LETTER_GOODS_PROOF_INVALID');}
 }
 const ends=await tx.execute<{id:string;user_id:string;payload:{appointmentEventId:string;taskId:string;version:number;note:string;documentId:string;documentSha256:string}}>(sql`SELECT id,user_id::text,payload FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_COLLECTION_TASK_ENDED_FOR_APPOINTMENT_V1' AND status='success' AND event_schema_version=1 AND payload->>'taskId'=${task.id}`);
 const appointmentEnd=ends[0];
 if(ends.length){
  if(ends.length!==1||outcome||task.status!=='erledigt'||task.erledigt_von!==appointmentEnd.user_id||task.version!==appointmentEnd.payload.version||task.erledigt_notiz!==appointmentEnd.payload.note||appointmentEnd.payload.documentId!==d.id||appointmentEnd.payload.documentSha256!==d.sha256)throw Error('POSTAL_APPOINTMENT_END_INVALID');
  const appointment=await readPickupAppointmentReceiptInTransaction(tx,auth,appointmentEnd.payload.appointmentEventId);
  if(appointment.actorId!==appointmentEnd.user_id||!p.meta.storageOrigin.freezes.some(proof=>proof.orderId===appointment.orderId&&proof.freezeId===appointment.freezeId))throw Error('POSTAL_APPOINTMENT_SOURCE_INVALID');
  if(p.meta.storageOrigin.freezes.some(proof=>proof.orderId!==appointment.orderId||proof.freezeId!==appointment.freezeId)&&!await postalAppointmentReplacementProved(tx,auth,task.id,appointment.eventId))throw Error('POSTAL_APPOINTMENT_REMAINDER_MISSING');
 }
 const replyEnd=await readReplyTaskEnd(tx,auth,task.id);
 if(replyEnd&&(outcome||appointmentEnd||replyEnd.payload.documentId!==d.id||replyEnd.payload.documentSha256!==d.sha256||replyEnd.reply.customerId!==p.meta.customerId||replyEnd.reply.handover!==p.meta.handover||!replyCoversFreezes(replyEnd.reply,p.meta.storageOrigin.freezes)&&!await postalReplyReplacementProved(tx,auth,task.id,replyEnd.reply)))throw Error('POSTAL_REPLY_END_INVALID');
 if(!outcome&&!appointmentEnd&&!replyEnd&&task.status!=='offen')throw Error('POSTAL_LETTER_COMPLETION_WITHOUT_RECEIPT');
 return {...row,task,outcome,appointmentEnd,replyEnd};
}
export async function readStoragePostalTask(auth:AuthorizationSnapshot,taskId:string){
 if(!hasAuthorizationArea(auth,'auftraege'))return null;
 return withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<{key:string}>(sql`SELECT client_event_id::text AS key FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND payload->>'channel'='post' AND payload->>'taskId'=${taskId}`);
  if(!rows.length)return null;if(rows.length!==1)throw Error('POSTAL_TASK_SOURCE_AMBIGUOUS');
  const read=await source(tx,auth,rows[0].key);if(!read)throw Error('POSTAL_TASK_SOURCE_MISSING');
  return {clientKey:rows[0].key,document:read.payload.document,state:read.replyEnd?'ENDED_BY_REPLY' as const:read.appointmentEnd?'ENDED_BY_APPOINTMENT' as const:read.outcome?.event_type==='ORDER_COLLECTION_REMINDER_SENT_V1'?'POSTED' as const:read.outcome?'VOIDED' as const:'WAIT_FOR_POST' as const};
 });
}
export async function finishPostalTasksForAppointment(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,appointment:{eventId:string;orderId:string;freezeId:string;date:string},complete:(taskId:string,note:string)=>Promise<void>,replacement:Parameters<typeof finishPostalTasksForReply>[4]){
 const rows=await tx.execute<{key:string}>(sql`SELECT event.client_event_id::text AS key FROM public.tasks task JOIN public.events event ON event.tenant_id=task.tenant_id AND event.payload->>'taskId'=task.id::text WHERE task.tenant_id=${auth.tenantId} AND task.status='offen' AND event.event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND event.payload->>'channel'='post' AND event.payload->'meta'->'storageOrigin'->'freezes' @> ${JSON.stringify([{orderId:appointment.orderId,freezeId:appointment.freezeId}])}::jsonb ORDER BY task.id FOR UPDATE OF task NOWAIT`);
 for(const row of rows){
  const original=await source(tx,auth,row.key);if(!original||original.outcome||original.appointmentEnd||original.replyEnd)throw Error('POSTAL_APPOINTMENT_NOT_OPEN');
  const freezes=original.payload.meta.storageOrigin!.freezes,remaining=freezes.filter(proof=>proof.orderId!==appointment.orderId||proof.freezeId!==appointment.freezeId);
  if(remaining.length){
   const orders=original.payload.meta.orders.filter(order=>remaining.some(proof=>proof.orderId===order.id));await qualifyAppointmentRestriction(tx,auth,appointment.eventId,freezes,remaining);
   await tx.execute(sql`SELECT id FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=ANY(ARRAY[${sql.join(orders.map(order=>sql`${order.id}`),sql`, `)}]::text[]) ORDER BY id FOR UPDATE NOWAIT`);
   const before=original.payload.document.snapshot;
   const numbers=orders.map(order=>order.number),snapshot=restrictStorageLetterSnapshot(before,numbers);
   const customerId=original.payload.meta.customerId,handover=original.payload.meta.handover,key=storageLetterKey(auth.tenantId,customerId,handover,row.key+':appointment:'+appointment.eventId,orders.map(order=>order.id));
   const meta:CollectionReminderMeta={...original.payload.meta,stageKey:key,intent:digest(JSON.stringify([key,snapshot.body])),orders,storageOrigin:{...original.payload.meta.storageOrigin!,freezes:remaining},replacesForReply:undefined,replacesForAppointment:{documentId:original.payload.document.id,appointmentEventId:appointment.eventId}};
   const [{renderToBuffer},{createStorageLetterPdfDocument}]=await Promise.all([import('@react-pdf/renderer'),import('@/lib/pdf/StorageLetterDocument')]);const pdf=Buffer.from(await renderToBuffer(createStorageLetterPdfDocument(snapshot,false)));
   const prepared=await prepareStoragePostalLetter(auth,{customerId,handover,clientKey:key},meta,snapshot,pdf,replacement.settingsUpdatedAt,{customerCurrent:writeTx=>replacement.customerCurrent(writeTx,snapshot),createTask:replacement.createTask},tx,{taskId:original.task.id,appointmentEventId:appointment.eventId});
   if(prepared.code!=='OK'||!await postalAppointmentReplacementProved(tx,auth,original.task.id,appointment.eventId))throw Error('POSTAL_APPOINTMENT_REPLACEMENT_NOT_SAVED');
  }
  const note=CUSTOMER_COLLECTION_COPY['notiz.abholung.termin'](await readPickupCustomerName(tx,auth,appointment.orderId),appointment.date);await complete(original.task.id,note);
  const closed=await tx.execute<{version:number}>(sql`SELECT version FROM public.tasks WHERE tenant_id=${auth.tenantId} AND id=${original.task.id}::uuid AND status='erledigt' AND erledigt_von=${auth.userId}::uuid AND erledigt_notiz=${note}`);if(closed.length!==1)throw Error('POSTAL_APPOINTMENT_TASK_NOT_ENDED');
  const id=randomUUID(),saved=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,event_type,description,status,user_id,event_schema_version,payload,created_at) VALUES(${id},${auth.tenantId},'ORDER_COLLECTION_TASK_ENDED_FOR_APPOINTMENT_V1',${note},'success',${auth.userId}::uuid,1,${JSON.stringify({appointmentEventId:appointment.eventId,taskId:original.task.id,version:closed[0].version,note,documentId:original.payload.document.id,documentSha256:original.payload.document.sha256})}::jsonb,statement_timestamp()) RETURNING id`);
  if(saved.length!==1||saved[0].id!==id)throw Error('POSTAL_APPOINTMENT_END_NOT_SAVED');
 }
}
export async function readStoragePostalReceipt(auth:AuthorizationSnapshot,input:{customerId:string;handover:string;clientKey:string}){
 if(!hasAuthorizationArea(auth,'auftraege')||!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN' as const,message:copy.forbidden};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const row=await source(tx,auth,input.clientKey);if(!row)return {code:'NOT_FOUND' as const};
  if(row.user_id!==auth.userId||row.payload.meta.customerId!==input.customerId||row.payload.meta.handover!==input.handover||(row.appointmentEnd||row.replyEnd||row.outcome?.event_type==='ORDER_STORAGE_LETTER_VOIDED_V1'))return {code:'CONFLICT' as const,message:copy.postalProtected};
  return {code:'OK' as const,taskId:row.payload.taskId,document:row.payload.document,replayed:true};
 });}catch(error){console.error('[POSTAL_LETTER_RECEIPT_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const,message:copy.proofUnavailable};}
}
export async function finishPostalTasksForReply(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,reply:DispatchReplyReceipt,complete:(taskId:string,note:string)=>Promise<void>,replacement:{settingsUpdatedAt:string;customerCurrent:(tx:PrivilegedTenantTransaction,snapshot:StorageLetterSnapshot)=>Promise<boolean>;createTask:(tx:PrivilegedTenantTransaction,input:{orderId:string;clientKey:string;title:string;note:string;kind:'aufgabe';dueDate:string})=>Promise<string>}){
 const rows=await tx.execute<{key:string}>(sql`SELECT event.client_event_id::text AS key FROM public.tasks task JOIN public.events event ON event.tenant_id=task.tenant_id AND event.payload->>'taskId'=task.id::text WHERE task.tenant_id=${auth.tenantId} AND task.status='offen' AND event.event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND event.payload->>'channel'='post' AND event.payload->'meta'->>'customerId'=${reply.customerId} AND event.payload->'meta'->>'handover'=${reply.handover} ORDER BY task.id FOR UPDATE OF task NOWAIT`);
 for(const row of rows){
  const original=await source(tx,auth,row.key);if(!original)throw Error('REPLY_POSTAL_SOURCE_MISSING');
  const freezes=original.payload.meta.storageOrigin!.freezes;
  if(!freezes.some(proof=>reply.proof.freezes.some(item=>item.orderId===proof.orderId&&item.freezeId===proof.freezeId)))continue;
  if(original.outcome||original.appointmentEnd||original.replyEnd)throw Error('REPLY_POSTAL_NOT_OPEN');
  if(!replyCoversFreezes(reply,freezes)){
   const remaining=freezes.filter(proof=>!reply.proof.freezes.some(item=>item.orderId===proof.orderId&&item.freezeId===proof.freezeId));
   const orders=original.payload.meta.orders.filter(order=>remaining.some(proof=>proof.orderId===order.id));
   await qualifyReplyRestriction(tx,auth,reply.eventId,freezes,remaining);
   await tx.execute(sql`SELECT id FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=ANY(ARRAY[${sql.join(orders.map(order=>sql`${order.id}`),sql`, `)}]::text[]) ORDER BY id FOR UPDATE NOWAIT`);
   const before=original.payload.document.snapshot;
   const numbers=orders.map(order=>order.number),snapshot=restrictStorageLetterSnapshot(before,numbers);
   const key=storageLetterKey(auth.tenantId,reply.customerId,reply.handover,row.key+':reply:'+reply.eventId,orders.map(order=>order.id));
   const meta:CollectionReminderMeta={...original.payload.meta,stageKey:key,intent:digest(JSON.stringify([key,snapshot.body])),orders,storageOrigin:{...original.payload.meta.storageOrigin!,freezes:remaining},replacesForAppointment:undefined,replacesForReply:{documentId:original.payload.document.id,replyEventId:reply.eventId}};
   const [{renderToBuffer},{createStorageLetterPdfDocument}]=await Promise.all([import('@react-pdf/renderer'),import('@/lib/pdf/StorageLetterDocument')]);
   const pdf=Buffer.from(await renderToBuffer(createStorageLetterPdfDocument(snapshot,false)));
   const prepared=await prepareStoragePostalLetter(auth,{customerId:reply.customerId,handover:reply.handover,clientKey:key},meta,snapshot,pdf,replacement.settingsUpdatedAt,{customerCurrent:writeTx=>replacement.customerCurrent(writeTx,snapshot),createTask:replacement.createTask},tx);
   if(prepared.code!=='OK'||!await postalReplyReplacementProved(tx,auth,original.task.id,reply))throw Error('POSTAL_REPLACEMENT_NOT_SAVED');
  }
  await complete(original.task.id,reply.note);await recordReplyTaskEnd(tx,auth,reply,{taskId:original.task.id,documentId:original.payload.document.id,documentSha256:original.payload.document.sha256});
 }
}
export async function prepareStoragePostalLetter(auth:AuthorizationSnapshot,input:{customerId:string;handover:string;clientKey:string},meta:CollectionReminderMeta,snapshot:StorageLetterSnapshot,pdf:Buffer,settingsUpdatedAt:string,ports:{customerCurrent:(tx:PrivilegedTenantTransaction)=>Promise<boolean>;createTask:(tx:PrivilegedTenantTransaction,input:{orderId:string;clientKey:string;title:string;note:string;kind:'aufgabe';dueDate:string})=>Promise<string>},transaction?:PrivilegedTenantTransaction,appointmentSource?:{taskId:string;appointmentEventId:string}){
 if(!hasAuthorizationArea(auth,'auftraege')||!hasAuthorizationArea(auth,'mails')&&(!transaction||!appointmentSource||!await storageTaskHasAppointmentSource(transaction,auth,appointmentSource.taskId,appointmentSource.appointmentEventId)))return {code:'FORBIDDEN' as const,message:copy.forbidden};
 if(meta.stage!=='E4'||meta.stageKey!==input.clientKey||meta.customerId!==input.customerId||meta.handover!==input.handover||!meta.orders.length||JSON.stringify(snapshot.orderNumbers)!==JSON.stringify(meta.orders.map(order=>order.number)))return {code:'VALIDATION_ERROR' as const,message:copy.invalid};
 const write=async(tx:PrivilegedTenantTransaction)=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${auth.tenantId+':collection:'+input.clientKey},0))`);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'task:'+auth.tenantId+':'+input.clientKey},0))`);
  const original=await source(tx,auth,input.clientKey);
  if(original){if(original.user_id!==auth.userId||original.payload.meta.customerId!==input.customerId||original.payload.meta.handover!==input.handover||(original.appointmentEnd||original.replyEnd||original.outcome?.event_type==='ORDER_STORAGE_LETTER_VOIDED_V1'))return {code:'CONFLICT' as const,message:copy.keyConflict};return {code:'OK' as const,taskId:original.payload.taskId,document:original.payload.document,replayed:true};}
  const occupied=await tx.execute(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND client_event_id=${input.clientKey}::uuid`);if(occupied.length)return {code:'CONFLICT' as const,message:copy.keyConflict};
  const taskOccupied=await tx.execute(sql`SELECT id FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=${input.clientKey}::uuid`);if(taskOccupied.length)return {code:'CONFLICT' as const,message:copy.keyConflict};
  for(const order of meta.orders)await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${auth.tenantId+':storage-final-order:'+order.id},0))`);
  const orders=await tx.execute<{id:string;version:number;freeze_id:string}>(sql`SELECT o.id,o.version,f.freeze_id::text FROM public.orders o JOIN private.v_order_freeze_state_v1 f ON f.tenant_id=o.tenant_id AND f.order_id=o.id AND f.active AND f.integrity_ok WHERE o.tenant_id=${auth.tenantId} AND o.customer_id=${input.customerId} AND o.handover_mode=${input.handover} AND o.id=ANY(ARRAY[${sql.join(meta.orders.map(order=>sql`${order.id}`),sql`, `)}]::text[]) AND o.station='fertig' AND o.status='fertig' AND o.current_station='fertig' AND o.current_station_id='fertig' ORDER BY o.id FOR UPDATE OF o`);
  if(orders.length!==meta.orders.length||orders.some(order=>meta.orders.find(member=>member.id===order.id)?.version!==order.version||!meta.storageOrigin?.freezes.some(f=>f.orderId===order.id&&f.freezeId===order.freeze_id)))throw Error('POSTAL_LETTER_COHORT_CHANGED');
  if(!meta.storageOrigin||!await storageOriginIsCurrent(tx,auth,meta.storageOrigin,meta.dueDate))return {code:'CONFLICT' as const,message:copy.postalProtected};
  const settings=await tx.execute(sql`SELECT id FROM public.company_settings WHERE tenant_id=${auth.tenantId} AND updated_at=${settingsUpdatedAt}::timestamptz FOR SHARE`);if(settings.length!==1||!await ports.customerCurrent(tx))throw Error('POSTAL_LETTER_PROFILE_CHANGED');
  const id=randomUUID(),title=copy.postalTaskTitle(snapshot.recipient.name),note=copy.postalTaskNote([snapshot.recipient.name,snapshot.recipient.street,snapshot.recipient.zip+' '+snapshot.recipient.city,snapshot.recipient.country],snapshot.orderNumbers);
  const taskId=await ports.createTask(tx,{orderId:meta.orders[0].id,clientKey:input.clientKey,title,note,kind:'aufgabe',dueDate:snapshot.date});
  const document:Document={id,snapshot,snapshotSha256:snapshotHash(snapshot),pdfBase64:pdf.toString('base64'),sha256:createHash('sha256').update(pdf).digest('hex')};
  const inserted=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,event_type,description,status,user_id,client_event_id,correlation_id,event_schema_version,payload,created_at) VALUES(${id},${auth.tenantId},'ORDER_COLLECTION_REMINDER_PREPARED_V1',${copy.letterTitle},'success',${auth.userId}::uuid,${input.clientKey}::uuid,${input.clientKey}::uuid,1,${JSON.stringify({channel:'post',meta,document,taskId,title,note})}::jsonb,statement_timestamp()) RETURNING id`);
  if(inserted.length!==1||inserted[0].id!==id)throw Error('POSTAL_LETTER_ORIGINAL_NOT_SAVED');
  return {code:'OK' as const,taskId,document,replayed:false};
 };try{return transaction?await write(transaction):await withPrivilegedTenantTransaction(auth,write);}catch(error){console.error('[POSTAL_LETTER_PREPARE_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const,message:copy.proofUnavailable};}
}
export async function protectStoragePostalTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{taskId:string;action:string}){
 if(input.action!=='geaendert')return;
 const rows=await tx.execute<{key:string}>(sql`SELECT client_event_id::text AS key FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND payload->>'channel'='post' AND payload->>'taskId'=${input.taskId}`);
 for(const row of rows)await source(tx,auth,row.key);
}
export async function recordStoragePostalResult(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,task:TaskRecord,input:TaskCompleteInput):Promise<void|TaskFailure>{
 const rows=await tx.execute<{key:string}>(sql`SELECT client_event_id::text AS key FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND payload->>'channel'='post' AND payload->>'taskId'=${task.id}`);
 if(!rows.length)return input.postalResult===undefined?undefined:fail('VALIDATION_ERROR',copy.postalNotTask);
 if(rows.length!==1)throw Error('POSTAL_TASK_SOURCE_AMBIGUOUS');
 const read=await source(tx,auth,rows[0].key);if(!read)throw Error('POSTAL_TASK_SOURCE_MISSING');
 if(read.appointmentEnd||read.replyEnd)return fail('CONFLICT',copy.postalProtected);
 const value=input.postalResult,original=read.payload;
 const gone=value===undefined?await handedOverProofs(tx,auth,original.meta.orders.map(order=>order.id)):null;
 if(!hasAuthorizationArea(auth,'auftraege')||!gone&&!hasAuthorizationArea(auth,'mails'))return fail('FORBIDDEN',copy.forbidden);
 if(!value&&!gone)return fail('VALIDATION_ERROR',copy.postalDateMissing);
 if(value?.documentSha256!==undefined&&value.documentSha256!==original.document.sha256)return fail('CONFLICT',copy.postalProtected);
 if(value?.kind==='posted'&&(Object.keys(value).sort().join(',')!=='documentSha256,kind,postedOn'||!postedDayValid(value.postedOn,original.document.snapshot.date)))return fail('VALIDATION_ERROR',copy.postalDateMissing);
 if(value?.kind==='discarded'&&(Object.keys(value).sort().join(',')!=='documentSha256,kind,reason'||typeof value.reason!=='string'||!value.reason.trim()||value.reason.length>500||value.reason==='goodsOut'))return fail('VALIDATION_ERROR',copy.postalProtected);
 if(read.outcome){const saved=read.outcome.payload;if(read.outcome.user_id!==auth.userId||saved.taskVersion!==input.version+1||saved.note!==(input.note?.trim()||null)||(value?.kind==='posted'?saved.postedOn!==value.postedOn:saved.reason!==(value?.kind==='discarded'?value.reason:'goodsOut')))return fail('CONFLICT',copy.keyConflict);return;}
 if(task.version!==input.version)return fail('CONFLICT',copy.postalProtected);
 if(value?.kind==='posted'){
  const current=await tx.execute(sql`SELECT id FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=ANY(ARRAY[${sql.join(original.meta.orders.map(order=>sql`${order.id}`),sql`, `)}]::text[]) AND station='fertig' AND status='fertig' AND current_station='fertig' AND current_station_id='fertig' ORDER BY id FOR UPDATE`);
  if(current.length!==original.meta.orders.length)return fail('CONFLICT',copy.postalProtected);
  if(!original.meta.storageOrigin||!await storageOriginIsCurrent(tx,auth,original.meta.storageOrigin,original.meta.dueDate))return fail('CONFLICT',copy.postalProtected);
 }
 const outcomeId=randomUUID();
 const inserted=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,event_type,description,status,user_id,client_event_id,correlation_id,event_schema_version,payload,created_at) VALUES(${outcomeId},${auth.tenantId},${value?.kind==='posted'?'ORDER_COLLECTION_REMINDER_SENT_V1':'ORDER_STORAGE_LETTER_VOIDED_V1'},${copy.letterTitle},'success',${auth.userId}::uuid,${randomUUID()}::uuid,${rows[0].key}::uuid,1,${JSON.stringify({channel:'post',meta:original.meta,documentId:original.document.id,documentSha256:original.document.sha256,taskId:task.id,taskVersion:task.version+1,note:input.note?.trim()||null,...(value?.kind==='posted'?{postedOn:value.postedOn}:{reason:value?.kind==='discarded'?value.reason:'goodsOut',...(gone?{goodsOutProofs:gone}:{})})})}::jsonb,statement_timestamp()) RETURNING id`);
 if(inserted.length!==1||inserted[0].id!==outcomeId)throw Error('POSTAL_LETTER_OUTCOME_NOT_SAVED');
}
export async function readPostalCollectionHistory(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,customerId:string,handover:string,orderIds:readonly string[]):Promise<CollectionReminderHistoryEntry[]>{
 const rows=await tx.execute<{key:string}>(sql`SELECT client_event_id::text AS key FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND payload->>'channel'='post' AND payload->'meta'->>'customerId'=${customerId} AND payload->'meta'->>'handover'=${handover} ORDER BY created_at,id`);
 const result:CollectionReminderHistoryEntry[]=[];
 for(const row of rows){const read=await source(tx,auth,row.key);if(!read)throw Error('POSTAL_HISTORY_SOURCE_MISSING');const p=read.payload;if(!p.meta.orders.some(order=>orderIds.includes(order.id)))continue;
  const voided=!!read.appointmentEnd||!!read.replyEnd||read.outcome?.event_type==='ORDER_STORAGE_LETTER_VOIDED_V1';
  result.push({stage:'E4',stageKey:p.meta.stageKey,dueDate:p.meta.dueDate,storageDeadline:p.document.snapshot.deadline,storageOrigin:p.meta.storageOrigin,sentAt:read.outcome&&!voided?read.outcome.payload.postedOn??null:null,threadId:null,orderIds:p.meta.orders.map(order=>order.id),deliveryFailedAt:null,postalDocumentId:p.document.id,postalTaskId:p.taskId,...(voided?{voidId:read.replyEnd?.id??read.appointmentEnd?.id??read.outcome!.id}:{})});
 }
 return result;
}
export async function verifyPostalDispatch(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{customerId:string;letterKey:string;documentId:string}){
 const read=await source(tx,auth,input.letterKey);if(!read||read.payload.meta.customerId!==input.customerId||read.payload.document.id!==input.documentId||read.outcome?.event_type!=='ORDER_COLLECTION_REMINDER_SENT_V1')throw Error('POSTAL_DISPATCH_NOT_PROVED');
}
export async function finishPostalTaskAfterGoodsOut(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{taskId:string;letterKey:string},complete:(input:{taskId:string;orderId:string;clientKey:string})=>Promise<void>){
 const read=await source(tx,auth,input.letterKey);if(!read||read.payload.taskId!==input.taskId)throw Error('POSTAL_GOODS_OUT_SOURCE_INVALID');
 if(read.outcome||read.appointmentEnd||read.replyEnd)return;
 if(await handedOverProofs(tx,auth,read.payload.meta.orders.map(order=>order.id)))await complete({taskId:input.taskId,orderId:read.payload.meta.orders[0].id,clientKey:input.letterKey});
}
