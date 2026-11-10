import 'server-only';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction} from './privilegedDb';
import {readDispatchResponses} from './dispatchResponsePort';
import type {DispatchReplyReceipt} from './dispatchReplyPort';
import type {DispatchResponsePorts,DispatchResponseCheck} from './dispatchResponsePort';

/** Invoked only by the real mail import/assignment command, under its actor. */
export async function recordImportedDispatchReplies(auth:AuthorizationSnapshot,itemId:string,ports:{readLinked:DispatchResponsePorts['readLinked'];record:(input:{customerId:string;handover:'pickup'|'shipping';proof:DispatchResponseCheck['proofs'][number]})=>Promise<DispatchReplyReceipt>}){
 if(!hasAuthorizationArea(auth,'mails'))throw Error('DISPATCH_REPLY_FORBIDDEN');
 const [original]=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{customer_id:string|null;graph_message_id:string;reply_chain:{status?:string}|null}>(sql`SELECT customer_id,graph_message_id,reply_chain FROM private.v_intake_reply_evidence_v1 WHERE tenant_id=${auth.tenantId} AND item_id=${itemId}`));
 if(!original?.customer_id||!original.reply_chain||original.reply_chain.status==='missing')return;
 if(!hasAuthorizationArea(auth,'auftraege'))throw Error('DISPATCH_REPLY_FORBIDDEN');
 const customerId=original.customer_id;
 const notices=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{thread_id:string;handover:'pickup'|'shipping';created_at:string}>(sql`SELECT DISTINCT thread.id::text AS thread_id,
  CASE WHEN event.event_type='ORDER_CUSTOMER_INFORMED_V1' THEN orders.handover_mode ELSE event.payload->'meta'->>'handover' END AS handover,to_char(thread.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at
  FROM public.communication_threads thread JOIN public.events event ON event.tenant_id=thread.tenant_id
   AND (event.payload->'receipt'->>'threadId'=thread.id::text OR event.payload->>'threadId'=thread.id::text)
  LEFT JOIN public.orders orders ON orders.tenant_id=event.tenant_id AND orders.id=event.order_id
  WHERE thread.tenant_id=${auth.tenantId} AND thread.customer_id=${customerId} AND thread.status='sent'
   AND event.status='success' AND event.event_type IN ('ORDER_CUSTOMER_INFORMED_V1','ORDER_COLLECTION_REMINDER_SENT_V1')`));
 if(!notices.length)return;
 for(const handover of ['pickup','shipping'] as const){
  const group=notices.filter(row=>row.handover===handover);if(!group.length)continue;
  const response=await readDispatchResponses(auth,{customerId,noticeThreadIds:group.map(row=>row.thread_id),oldestNoticeAt:group.map(row=>new Date(row.created_at).toISOString()).sort()[0]},{readLinked:async(actor,target)=>{const linked=await ports.readLinked(actor,target);return linked.code==='OK'&&Array.isArray(linked.data)?{code:'OK',data:linked.data.filter(row=>row.id===original.graph_message_id)}:{code:'UNAVAILABLE'};}});
  if(response.state==='UNAVAILABLE'||response.state==='NOT_CHECKED')throw Error('DISPATCH_REPLY_QUALIFICATION_UNAVAILABLE');
  for(const proof of response.proofs)await ports.record({customerId,handover,proof});
 }
}
