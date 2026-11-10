import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {canonicalJson} from '@/lib/domain/canonicalJson';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from './privilegedDb';
import {readReadyNotificationContext} from './orderReleaseRead';
import {PICKUP_APPOINTMENT_COPY as copy} from '@/ui/situationCatalog';
import {berlinCalendarDay,plusWorkingDays} from '@/lib/domain/workingDays';
import type {DispatchPolicy} from '@/modules/fundament/public';
import {readDispatchReplyReceipt,readLatestReplyForFreeze,replyCoversFreezes,replyDefersToAppointment} from './dispatchReplyPort';

const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
export type StorageOrigin={callTaskId?:string;appointmentEventId?:string;replyEventId?:string;freezes:Array<{orderId:string;freezeId:string}>};
export function pickupStorageDue(date:string,policy:DispatchPolicy|null|undefined){
 if(!policy||policy.storageAfterDays==null)return null;
 const pause=plusWorkingDays(date,1,policy.holidays),storage=plusWorkingDays(date,policy.storageAfterDays,policy.holidays);
 if(!pause||!storage)throw Error('PICKUP_STORAGE_CALENDAR_INVALID');
 return pause>storage?pause:storage;
}
export async function qualifyStorageOrigin(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,origin:StorageOrigin){
 const identities=[origin.callTaskId,origin.appointmentEventId,origin.replyEventId].filter(Boolean);
 if(identities.length!==1)throw Error('STORAGE_ORIGIN_NOT_UNIQUE');
 if(identities.some(id=>!uuid.test(id!)))throw Error('STORAGE_ORIGIN_ID_INVALID');
 if(origin.replyEventId){
  const reply=await readDispatchReplyReceipt(tx,auth,origin.replyEventId);
  if(!replyCoversFreezes(reply,origin.freezes))throw Error('STORAGE_REPLY_FREEZE_INVALID');
 }
 if(origin.appointmentEventId){
  const appointment=await readPickupAppointmentReceiptInTransaction(tx,auth,origin.appointmentEventId);
  if(origin.freezes.length!==1||origin.freezes[0].orderId!==appointment.orderId||origin.freezes[0].freezeId!==appointment.freezeId)throw Error('STORAGE_APPOINTMENT_FREEZE_INVALID');
 }
}
export async function storageOriginIsCurrent(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,origin:StorageOrigin,eligibleOn:string){
 await qualifyStorageOrigin(tx,auth,origin);
 for(const proof of origin.freezes){const appointment=await readOrderPickupAppointmentInTransaction(tx,auth,proof.orderId);
  const reply=await readLatestReplyForFreeze(tx,auth,proof.orderId,proof.freezeId);
  if(origin.replyEventId){
   if(!reply||reply.eventId!==origin.replyEventId||appointment&&replyDefersToAppointment(reply,appointment))return false;
   if(!validDay(eligibleOn)||eligibleOn<berlinCalendarDay(new Date(reply.proof.receivedAt))||eligibleOn>berlinCalendarDay())return false;
   continue;
  }
  if(reply&&(!appointment||!replyDefersToAppointment(reply,appointment)))return false;
  if(origin.appointmentEventId){
   if(appointment?.eventId!==origin.appointmentEventId)return false;
   // eligibleOn comes from the canonical operational proposal, not the UI.
   // Its composition also locks/checks the captured settings version.
   if(!validDay(eligibleOn)||eligibleOn<appointment.date||eligibleOn>berlinCalendarDay())return false;
  }else if(appointment)return false;
 }
 return true;
}
const channels=['telefon','persoenlich','mail'] as const;
type Channel=typeof channels[number];
type Input={orderId:string;expectedVersion:number;previousEventId:string|null;date:string;channel:Channel;clientEventId:string};
type Receipt={eventId:string;orderId:string;orderVersion:number;freezeId:string;previousEventId:string|null;date:string;channel:Channel;actorId:string;clientEventId:string;recordedAt:string};
type Row={id:string;order_id:string;user_id:string;client_event_id:string;correlation_id:string;event_schema_version:number;aggregate_version:number;created_at:string;status:string;payload:{intent:string;receipt:Receipt;receiptSha256:string}};
const digest=(value:unknown)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
function validDay(value:unknown):value is string{return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
function validInput(value:unknown):value is Input{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Input;
 return Object.keys(v).sort().join(',')==='channel,clientEventId,date,expectedVersion,orderId,previousEventId'&&uuid.test(v.orderId)&&uuid.test(v.clientEventId)&&Number.isSafeInteger(v.expectedVersion)&&v.expectedVersion>0&&(v.previousEventId===null||typeof v.previousEventId==='string'&&uuid.test(v.previousEventId))&&validDay(v.date)&&channels.includes(v.channel);
}
const selection=sql`id::text,order_id,user_id::text,client_event_id::text,correlation_id::text,event_schema_version,aggregate_version,(created_at AT TIME ZONE 'UTC')::text AS created_at,status,payload`;
function qualify(row:Row){
 const p=row.payload,r=p?.receipt;
 if(!r||row.status!=='success'||row.event_schema_version!==1||r.eventId!==row.id||r.orderId!==row.order_id||r.actorId!==row.user_id||r.clientEventId!==row.client_event_id||row.correlation_id!==row.client_event_id||!uuid.test(r.freezeId)||!Number.isSafeInteger(r.orderVersion)||r.orderVersion<1||row.aggregate_version!==r.orderVersion||!validDay(r.date)||!channels.includes(r.channel)||!Number.isFinite(Date.parse(r.recordedAt))||new Date(row.created_at).toISOString()!==r.recordedAt||!(r.previousEventId===null||uuid.test(r.previousEventId))||digest(r)!==p.receiptSha256||digest({orderId:r.orderId,expectedVersion:r.orderVersion,previousEventId:r.previousEventId,date:r.date,channel:r.channel,clientEventId:r.clientEventId})!==p.intent)throw Error('PICKUP_APPOINTMENT_RECEIPT_INVALID');
 return r;
}
async function latest(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,orderId:string){
 const rows=await tx.execute<Row>(sql`SELECT ${selection} FROM public.events WHERE tenant_id=${auth.tenantId} AND order_id=${orderId} AND event_type='ORDER_PICKUP_APPOINTMENT_SET_V1' ORDER BY created_at DESC,id DESC LIMIT 1`);
 return rows.length?qualify(rows[0]):null;
}
/** The agreement is an event on the existing order, never its production due date. */
export async function setOrderPickupAppointment(auth:AuthorizationSnapshot,input:unknown,afterRecord:(tx:PrivilegedTenantTransaction,receipt:Receipt)=>Promise<void>){
 if(!hasAuthorizationArea(auth,'auftraege'))return {code:'FORBIDDEN' as const,message:copy.forbidden};
 if(!validInput(input))return {code:'VALIDATION_ERROR' as const,message:copy.invalid};
 const intent=digest(input);
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${auth.tenantId+':pickup-appointment:'+input.clientEventId},0))`);
  const prior=await tx.execute<Row&{event_type:string}>(sql`SELECT ${selection},event_type FROM public.events WHERE tenant_id=${auth.tenantId} AND client_event_id=${input.clientEventId}::uuid`);
  if(prior.length){
   if(prior.length!==1||prior[0].event_type!=='ORDER_PICKUP_APPOINTMENT_SET_V1'||prior[0].payload.intent!==intent||prior[0].user_id!==auth.userId)return {code:'CONFLICT' as const,message:copy.changed};
   return {code:'OK' as const,receipt:qualify(prior[0]),replayed:true};
  }
  const context=await readReadyNotificationContext(tx,auth.tenantId,input.orderId);
  if(!context||context.version!==input.expectedVersion)return {code:'CONFLICT' as const,message:copy.changed};
  const current=await latest(tx,auth,input.orderId),active=current?.freezeId===context.freeze_id?current:null;
  if((active?.eventId??null)!==input.previousEventId)return {code:'CONFLICT' as const,message:copy.changed};
  const modes=await tx.execute<{handover_mode:string}>(sql`SELECT handover_mode FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=${input.orderId}`);
  if(modes[0]?.handover_mode!=='pickup')return {code:'CONFLICT' as const,message:copy.changed};
  const receipt:Receipt={eventId:randomUUID(),orderId:input.orderId,orderVersion:context.version,freezeId:context.freeze_id,previousEventId:input.previousEventId,date:input.date,channel:input.channel,actorId:auth.userId,clientEventId:input.clientEventId,recordedAt:new Date().toISOString()};
  const saved=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,client_event_id,correlation_id,event_schema_version,status,aggregate_version,payload,created_at)
   VALUES(${receipt.eventId},${auth.tenantId},${input.orderId},'ORDER_PICKUP_APPOINTMENT_SET_V1',${copy.recorded(input.date)},${auth.userId}::uuid,${input.clientEventId}::uuid,${input.clientEventId}::uuid,1,'success',${context.version},${JSON.stringify({intent,receipt,receiptSha256:digest(receipt)})}::jsonb,${receipt.recordedAt}::timestamptz) RETURNING id`);
  if(saved.length!==1||saved[0].id!==receipt.eventId)throw Error('PICKUP_APPOINTMENT_NOT_SAVED');
  await afterRecord(tx,receipt);
  return {code:'OK' as const,receipt,replayed:false};
 });}catch(error){console.error('[PICKUP_APPOINTMENT_WRITE_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const,message:copy.unavailable};}
}
/** Historical appointment proof remains valid after a later agreed date. */
export async function readPickupAppointmentReceiptInTransaction(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,eventId:string){
 const rows=await tx.execute<Row>(sql`SELECT ${selection} FROM public.events WHERE tenant_id=${auth.tenantId} AND id=${eventId} AND event_type='ORDER_PICKUP_APPOINTMENT_SET_V1'`);
 if(rows.length!==1)throw Error('PICKUP_APPOINTMENT_PROOF_MISSING');
 return qualify(rows[0]);
}
/** Root evidence port: task modules never query another module's event table. */
export async function storageTaskHasAppointmentSource(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,taskId:string,eventId:string){
 if(!hasAuthorizationArea(auth,'auftraege'))return false;
 const appointment=await readPickupAppointmentReceiptInTransaction(tx,auth,eventId);if(appointment.actorId!==auth.userId)return false;
 const source=await tx.execute(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND status='success' AND event_schema_version=1 AND payload->>'taskId'=${taskId} AND (
  event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND payload->>'channel'='post' AND payload->'meta'->'storageOrigin'->'freezes' @> ${JSON.stringify([{orderId:appointment.orderId,freezeId:appointment.freezeId}])}::jsonb
  OR event_type='ORDER_STORAGE_FINAL_TASK_CREATED_V1' AND payload->'meta'->'freezes' @> ${JSON.stringify([{orderId:appointment.orderId,freezeId:appointment.freezeId}])}::jsonb)`);
 return source.length===1;
}
export async function readOrderPickupAppointment(auth:AuthorizationSnapshot,orderId:string){
 if(!hasAuthorizationArea(auth,'auftraege'))return {code:'FORBIDDEN' as const};
 if(typeof orderId!=='string'||!uuid.test(orderId))return {code:'VALIDATION_ERROR' as const};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>({code:'OK' as const,appointment:await readOrderPickupAppointmentInTransaction(tx,auth,orderId)}));
 }catch(error){console.error('[PICKUP_APPOINTMENT_READ_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const};}
}
export async function readOrderPickupAppointmentInTransaction(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,orderId:string){
  if(!hasAuthorizationArea(auth,'auftraege'))throw Error('PICKUP_APPOINTMENT_FORBIDDEN');
  const receipt=await latest(tx,auth,orderId);
  if(!receipt)return null;
  const current=await tx.execute<{freeze_id:string}>(sql`SELECT f.freeze_id::text FROM public.orders o JOIN private.v_order_freeze_state_v1 f ON f.tenant_id=o.tenant_id AND f.order_id=o.id AND f.active AND f.integrity_ok WHERE o.tenant_id=${auth.tenantId} AND o.id=${orderId} AND o.handover_mode='pickup' AND o.station='fertig' AND o.status='fertig' AND o.current_station='fertig' AND o.current_station_id='fertig'`);
  return current[0]?.freeze_id===receipt.freezeId?receipt:null;
}
