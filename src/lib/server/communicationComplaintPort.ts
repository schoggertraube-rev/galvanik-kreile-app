import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction} from './privilegedDb';
import type {CommunicationReceipt} from './communicationPort';
import type {ComplaintWriteResult} from '@/modules/complaints/public';

type ComplaintMailSource={complaintId:string;version:number;orderId:string;subject:string;body:string};

/** Reading another authorized operator's completed follow-up never repeats its writer. */
export async function readComplaintMailClosure(auth:AuthorizationSnapshot,input:{complaintId:string;version:number;requestId:string;threadId:string}):Promise<Extract<ComplaintWriteResult,{code:'OK'}>|null>{
 if(!hasAuthorizationArea(auth,'kunden'))return null;
 return withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<{receipt:Extract<ComplaintWriteResult,{code:'OK'}>['receipt']}>(sql`SELECT event.payload->'receipt' AS receipt FROM public.events event
   JOIN public.v_complaint_rework_context_v1 complaint ON complaint.tenant_id=event.tenant_id AND complaint.complaint_id=event.payload->>'complaintId'
   JOIN public.communication_threads thread ON thread.tenant_id=event.tenant_id AND thread.source='MS_GRAPH_OUT:'||event.client_event_id::text AND thread.id=${input.threadId}::uuid AND thread.status='sent' AND thread.order_id=complaint.source_order_id AND thread.customer_id=complaint.customer_id
   WHERE event.tenant_id=${auth.tenantId} AND event.event_type='COMPLAINT_CHANGED_V1' AND event.status='success' AND event.client_event_id=${input.requestId}::uuid
    AND event.payload->>'complaintId'=${input.complaintId} AND event.payload->>'action'='abschliessen'
    AND event.payload->'before'->>'version'=${String(input.version)} AND event.payload->'after'->>'abschluss_art'='mail'
    AND event.payload->'receipt'->>'state'='abgeschlossen' AND event.payload->'receipt'->>'complaintId'=complaint.complaint_id
    AND event.payload->'receipt'->>'eventId'=event.id::text AND event.payload->'receipt'->>'version'=complaint.version::text AND complaint.stand='abgeschlossen'`);
  if(rows.length>1)throw Error('COMPLAINT_MAIL_CLOSURE_AMBIGUOUS');
  return rows.length===1?{code:'OK',receipt:rows[0].receipt,replayed:true}:null;
 });
}

/** A completed physical result mail remains the source of its unfinished closure. */
export async function readCompletedComplaintMail(auth:AuthorizationSnapshot,input:ComplaintMailSource):Promise<CommunicationReceipt|null>{
 if(!hasAuthorizationArea(auth,'kunden')&&!hasAuthorizationArea(auth,'mails'))throw Error('COMMUNICATION_REPLAY_INTENT_MISMATCH');
 return withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<{thread_id:string;message_id:string;customer_id:string;order_id:string;recorded_at:string;request_id:string;subject:string;body:string;content_hash:string;sent_hash:string;actor:string}>(sql`
   SELECT prepared.user_id::text AS actor,thread.id::text AS thread_id,message.id::text AS message_id,thread.customer_id,thread.order_id,thread.created_at::text AS recorded_at,
    prepared.correlation_id::text AS request_id,thread.subject,message.body,prepared.payload->>'contentSha256' AS content_hash,sent.payload->>'contentSha256' AS sent_hash
   FROM public.v_complaint_rework_context_v1 complaint
   JOIN public.events prepared ON prepared.tenant_id=complaint.tenant_id AND prepared.event_type='COMMUNICATION_MAIL_PREPARED_V1' AND prepared.status='success' AND prepared.event_schema_version=1
   JOIN public.communication_threads thread ON thread.tenant_id=prepared.tenant_id AND thread.id::text=prepared.payload->>'threadId' AND thread.source='MS_GRAPH_OUT:'||prepared.correlation_id::text AND thread.created_by=prepared.user_id AND thread.status='sent'
   JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id AND message.direction='outgoing' AND message.channel='email' AND message.created_by=prepared.user_id
   JOIN public.events sent ON sent.tenant_id=thread.tenant_id AND sent.event_type='COMMUNICATION_MAIL_SENT_V1' AND sent.status='success' AND sent.event_schema_version=1 AND sent.user_id=prepared.user_id AND sent.correlation_id=prepared.correlation_id AND sent.payload->>'threadId'=thread.id::text AND sent.payload->>'messageId'=message.id::text
   WHERE complaint.tenant_id=${auth.tenantId} AND complaint.complaint_id=${input.complaintId} AND complaint.source_order_id=${input.orderId}
    AND thread.order_id=complaint.source_order_id AND thread.customer_id=complaint.customer_id
    AND prepared.payload->'complaintResult'->>'complaintId'=${input.complaintId} AND prepared.payload->'complaintResult'->>'version'=${String(input.version)}
    AND coalesce(prepared.payload->'complaintResult'->>'kind','result')='result' AND message.summary=${'Reklamation '+input.complaintId+' · Ergebnis'} LIMIT 2`);
  if(!rows.length)return null;if(rows.length!==1)throw Error('COMMUNICATION_REPLAY_INTENT_MISMATCH');
  const row=rows[0],hash=createHash('sha256').update(JSON.stringify([input.subject.trim(),input.body.trim()])).digest('hex');
  if(row.actor!==auth.userId&&!hasAuthorizationArea(auth,'mails')||row.subject!==input.subject.trim()||row.body!==input.body.trim()||row.content_hash!==hash||row.sent_hash!==hash)throw Error('COMMUNICATION_REPLAY_INTENT_MISMATCH');
  return {threadId:row.thread_id,messageId:row.message_id,customerId:row.customer_id,orderId:row.order_id,recordedAt:row.recorded_at,replayed:true,sourceRequestId:row.request_id};
 });
}

export async function recordComplaintMailRetry(auth:AuthorizationSnapshot,input:ComplaintMailSource){
 const source=await readCompletedComplaintMail(auth,input);if(!source?.sourceRequestId)throw Error('COMPLAINT_MAIL_RETRY_SOURCE_MISSING');
 return withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('complaint-mail-followup:'||${auth.tenantId}||':'||${source.sourceRequestId},0))`);
  const prior=await tx.execute(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='COMMUNICATION_COMPLAINT_EFFECT_RETRY_REQUIRED_V1' AND correlation_id=${source.sourceRequestId}::uuid`);if(prior.length)return;
  const saved=await tx.execute(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,correlation_id,event_schema_version)
   VALUES(${randomUUID()},${auth.tenantId},${input.orderId},'COMMUNICATION_COMPLAINT_EFFECT_RETRY_REQUIRED_V1','COMMUNICATION_COMPLAINT_EFFECT_RETRY_REQUIRED_V1',${JSON.stringify({complaintId:input.complaintId,version:input.version,threadId:source.threadId})}::jsonb,'success',${auth.userId}::uuid,${randomUUID()}::uuid,${source.sourceRequestId}::uuid,1) RETURNING id`);
  if(saved.length!==1)throw Error('COMPLAINT_MAIL_RETRY_RECEIPT_MISSING');
 });
}
