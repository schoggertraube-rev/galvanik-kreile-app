import 'server-only';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction} from './privilegedDb';
import {readMicrosoftGraphSentMailReference} from './microsoftGraph';

export type DispatchResponseCheck={state:'NONE'|'REPLIED'|'NOT_CHECKED'|'UNAVAILABLE';proofs:Array<{itemId:string;threadId:string;graphMessageId:string;originalSha256:string;receivedAt:string}>};
type Original={itemId:string;message:{senderAddress:string;receivedAt:string;replyChain?:{source?:string;status?:string;originalSha256?:string;inReplyTo?:string[]};deliveryReport?:{status:string}}};
export type DispatchResponsePorts={readLinked:(auth:AuthorizationSnapshot,target:{targetType:'CUSTOMER';targetId:string})=>Promise<{code:string;data?:Array<{id:string;receivedAt:string}>}>;readOriginal:(auth:AuthorizationSnapshot,input:{graphMessageId:string})=>Promise<{code:string}&Partial<Original>>};

/** Incoming MIME and the exact Sent-Items request header bind the reaction to the real notice. */
export async function readDispatchResponses(auth:AuthorizationSnapshot,input:{customerId:string;noticeThreadIds:string[];oldestNoticeAt:string},ports:DispatchResponsePorts):Promise<DispatchResponseCheck>{
 if(!hasAuthorizationArea(auth,'mails'))return {state:'NOT_CHECKED',proofs:[]};
 try{
  const threads=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{id:string;source:string}>(sql`SELECT id::text,source FROM public.communication_threads WHERE tenant_id=${auth.tenantId} AND customer_id=${input.customerId} AND status='sent' AND id::text=ANY(ARRAY[${sql.join(input.noticeThreadIds.map(id=>sql`${id}`),sql`, `)}]::text[])`));
  if(threads.length!==new Set(input.noticeThreadIds).size||threads.some(thread=>!/^MS_GRAPH_OUT:[0-9a-f-]{36}$/i.test(thread.source)))throw Error('DISPATCH_NOTICE_THREAD_INVALID');
  const linked=await ports.readLinked(auth,{targetType:'CUSTOMER',targetId:input.customerId});if(linked.code!=='OK'||!linked.data)throw Error('DISPATCH_RESPONSE_SOURCE_UNAVAILABLE');
  const proofs:DispatchResponseCheck['proofs']=[];
  for(const mail of linked.data){
   if(Date.parse(mail.receivedAt)<Date.parse(input.oldestNoticeAt))continue;
   const original=await ports.readOriginal(auth,{graphMessageId:mail.id});if(original.code!=='OK'||!original.itemId||!original.message)throw Error('DISPATCH_RESPONSE_ORIGINAL_MISSING');
   if(original.message.deliveryReport){if(original.message.deliveryReport.status==='invalid')throw Error('DISPATCH_DELIVERY_REPORT_UNCLEAR');continue;}
   const chain=original.message.replyChain;
   if(chain?.status==='missing')continue;
   if(!chain||chain.source!=='original_mime'||chain.status!=='present'||!Array.isArray(chain.inReplyTo)||chain.inReplyTo.length!==1||!chain.originalSha256||!/^[a-f0-9]{64}$/.test(chain.originalSha256))throw Error('DISPATCH_RESPONSE_REFERENCE_UNCLEAR');
   const sent=await readMicrosoftGraphSentMailReference(chain.inReplyTo[0],original.message.senderAddress);
   if(sent.code!=='OK'||!sent.data.clientRequestId)throw Error('DISPATCH_RESPONSE_SENT_REFERENCE_UNCLEAR');
   const thread=threads.find(row=>row.source==='MS_GRAPH_OUT:'+sent.data.clientRequestId);
   if(thread)proofs.push({itemId:original.itemId,threadId:thread.id,graphMessageId:sent.data.graphMessageId,originalSha256:chain.originalSha256,receivedAt:original.message.receivedAt});
  }
  return {state:proofs.length?'REPLIED':'NONE',proofs};
 }catch(error){console.error('[DISPATCH_RESPONSE_READ_FAILED]',{reason:error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'DATABASE_OR_PROVIDER_FAILURE'});return {state:'UNAVAILABLE',proofs:[]};}
}
