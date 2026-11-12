import 'server-only';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from './privilegedDb';
import {readMicrosoftGraphSentMailReference} from './microsoftGraph';

export type DispatchResponseCheck={state:'NONE'|'REPLIED'|'NOT_CHECKED'|'UNAVAILABLE';proofs:Array<{itemId:string;threadId:string;graphMessageId:string;originalSha256:string;receivedAt:string;inReplyTo:string;orderIds:string[];freezes:Array<{orderId:string;freezeId:string}>}>};
type Original={itemId:string;message:{senderAddress:string;receivedAt:string;replyChain?:{source?:string;status?:string;originalSha256?:string;inReplyTo?:string[]};deliveryReport?:{status:string}}};
export type DispatchResponsePorts={readLinked:(auth:AuthorizationSnapshot,target:{targetType:'CUSTOMER';targetId:string})=>Promise<{code:string;data?:Array<{id:string;receivedAt:string|null;senderAddress?:string}>}>};

/** Incoming MIME and the exact Sent-Items request header bind the reaction to the real notice. */
export async function readDispatchResponses(auth:AuthorizationSnapshot,input:{customerId:string;noticeThreadIds:string[];oldestNoticeAt:string},ports:DispatchResponsePorts):Promise<DispatchResponseCheck>{
 if(!hasAuthorizationArea(auth,'mails'))return {state:'NOT_CHECKED',proofs:[]};
 try{
  const threads=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{id:string;source:string}>(sql`SELECT id::text,source FROM public.communication_threads WHERE tenant_id=${auth.tenantId} AND customer_id=${input.customerId} AND status='sent' AND id::text=ANY(ARRAY[${sql.join(input.noticeThreadIds.map(id=>sql`${id}`),sql`, `)}]::text[])`));
  if(threads.length!==new Set(input.noticeThreadIds).size||threads.some(thread=>!/^MS_GRAPH_OUT:[0-9a-f-]{36}$/i.test(thread.source)))throw Error('DISPATCH_NOTICE_THREAD_INVALID');
  const linked=await ports.readLinked(auth,{targetType:'CUSTOMER',targetId:input.customerId});if(linked.code!=='OK'||!linked.data)throw Error('DISPATCH_RESPONSE_SOURCE_UNAVAILABLE');
  const proofs:DispatchResponseCheck['proofs']=[];
  for(const mail of linked.data){
   if(mail.receivedAt===null||!Number.isFinite(Date.parse(mail.receivedAt)))throw Error('DISPATCH_RESPONSE_TIME_UNAVAILABLE');
   if(Date.parse(mail.receivedAt)<Date.parse(input.oldestNoticeAt))continue;
   // Mails permission already exposes this linked correspondence. Read only secured
   // reply metadata here; the full Eingang capture reader has a different write-area boundary.
   const original=await withPrivilegedTenantTransaction(auth,async tx=>{
    const delivery=await tx.execute<{report:{status:string}|null}>(sql`SELECT report FROM private.v_intake_delivery_evidence_v1 WHERE tenant_id=${auth.tenantId} AND graph_message_id=${mail.id}`);
    if(delivery.some(row=>row.report?.status==='invalid'))throw Error('DISPATCH_DELIVERY_REPORT_UNCLEAR');
    if(delivery.some(row=>row.report))return null;
    const rows=await tx.execute<{item_id:string;customer_id:string;received_at:Date|string;reply_chain:NonNullable<Original['message']['replyChain']>;proof_ok:boolean}>(sql`SELECT item_id,customer_id,received_at,reply_chain,proof_ok FROM private.v_intake_reply_evidence_v1 WHERE tenant_id=${auth.tenantId} AND graph_message_id=${mail.id}`);
    if(rows.length!==1||rows[0].customer_id!==input.customerId)throw Error('DISPATCH_RESPONSE_ORIGINAL_MISSING');return rows[0];
   });
   if(!original)continue;
   const chain=original.reply_chain;
   if(!chain||chain.status==='missing')continue;
   if(!original.proof_ok)throw Error('DISPATCH_RESPONSE_ORIGINAL_MISSING');
   if(!original.proof_ok||!chain||chain.source!=='original_mime'||chain.status!=='present'||!Array.isArray(chain.inReplyTo)||chain.inReplyTo.length!==1||!chain.originalSha256||!/^[a-f0-9]{64}$/.test(chain.originalSha256)||!mail.senderAddress)throw Error('DISPATCH_RESPONSE_REFERENCE_UNCLEAR');
   const sent=await readMicrosoftGraphSentMailReference(chain.inReplyTo[0],mail.senderAddress);
   if(sent.code!=='OK')throw Error('DISPATCH_RESPONSE_SENT_REFERENCE_UNCLEAR');
   if(!sent.data.clientRequestId)continue;
   const thread=threads.find(row=>row.source==='MS_GRAPH_OUT:'+sent.data.clientRequestId);
   if(thread){
    const freezes=await withPrivilegedTenantTransaction(auth,tx=>readDispatchResponseScope(tx,auth,thread.id));
    const orderIds=[...new Set(freezes.map(proof=>proof.orderId))];
    if(!orderIds.length)throw Error('DISPATCH_RESPONSE_SCOPE_MISSING');
    proofs.push({itemId:original.item_id,threadId:thread.id,graphMessageId:sent.data.graphMessageId,originalSha256:chain.originalSha256,receivedAt:new Date(original.received_at).toISOString(),inReplyTo:chain.inReplyTo[0],orderIds,freezes});
   }
  }
  return {state:proofs.length?'REPLIED':'NONE',proofs};
 }catch(error){console.error('[DISPATCH_RESPONSE_READ_FAILED]',{reason:error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'DATABASE_OR_PROVIDER_FAILURE'});return {state:'UNAVAILABLE',proofs:[]};}
}

/** Immutable notice/collection receipts determine the original generation. */
export async function readDispatchResponseScope(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,threadId:string){
     const notices=await tx.execute<{order_id:string;freeze_id:string}>(sql`SELECT notice.order_id,frozen_header.id::text AS freeze_id FROM public.events notice JOIN public.events sent ON sent.tenant_id=notice.tenant_id AND sent.event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND sent.payload->>'threadId'=${threadId} AND sent.status='success' AND sent.user_id=notice.user_id AND sent.payload->>'intent'=notice.payload->>'intent'
      JOIN private.order_freezes frozen_header ON frozen_header.tenant_id=notice.tenant_id AND frozen_header.order_id=notice.order_id AND frozen_header.id::text=notice.payload->'receipt'->>'freezeId'
      WHERE notice.tenant_id=${auth.tenantId} AND notice.event_type='ORDER_CUSTOMER_INFORMED_V1' AND notice.status='success' AND notice.payload->'receipt'->>'threadId'=${threadId} AND notice.payload->'receipt'->>'orderId'=notice.order_id AND notice.payload->'receipt'->>'actorId'=notice.user_id::text`);
     const reminders=await tx.execute<{orders:Array<{id:string;version:number}>}>(sql`SELECT sent.payload->'meta'->'orders' AS orders FROM public.events sent JOIN public.events prepared ON prepared.tenant_id=sent.tenant_id AND prepared.event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND prepared.payload->>'threadId'=${threadId} AND prepared.status='success' AND prepared.user_id=sent.user_id AND prepared.correlation_id=sent.correlation_id AND prepared.payload->'meta'=sent.payload->'meta'
      WHERE sent.tenant_id=${auth.tenantId} AND sent.event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND sent.status='success' AND sent.payload->>'threadId'=${threadId}`);
     if(reminders.length>1)throw Error('DISPATCH_RESPONSE_SCOPE_AMBIGUOUS');
     const result=notices.map(row=>({orderId:row.order_id,freezeId:row.freeze_id}));
     for(const member of reminders.flatMap(row=>row.orders)){
      if(!member||!Number.isSafeInteger(member.version))throw Error('DISPATCH_RESPONSE_MEMBER_VERSION_INVALID');
      const original=await tx.execute<{id:string}>(sql`SELECT id::text FROM private.order_freezes WHERE tenant_id=${auth.tenantId} AND order_id=${member.id} AND order_version<=${member.version} ORDER BY order_version DESC LIMIT 1`);
      if(original.length!==1)throw Error('DISPATCH_RESPONSE_FREEZE_MISSING');
      result.push({orderId:member.id,freezeId:original[0].id});
     }
     return [...new Map(result.map(proof=>[proof.orderId+':'+proof.freezeId,proof])).values()];

}
