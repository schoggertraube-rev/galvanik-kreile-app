import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from './privilegedDb';

export type CommunicationDocument={kind:'QUOTE';id:string;number:string;version:number;edition:number;sha256:string;source?:{itemId:string;graphMessageId:string}};
type Intent={targetType:'CUSTOMER'|'ORDER';targetId:string;clientRequestId:string;subject:string;body:string};
export function communicationDocumentIntent(input:Intent,document:CommunicationDocument){return createHash('sha256').update(JSON.stringify({targetType:input.targetType,targetId:input.targetId,subject:input.subject.trim(),body:input.body.trim(),document:{kind:document.kind,id:document.id,number:document.number,version:document.version,edition:document.edition,sha256:document.sha256,...(document.source?{source:{itemId:document.source.itemId,graphMessageId:document.source.graphMessageId}}:{})}})).digest('hex');}
export async function appendCommunicationDocument(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:Intent,document:CommunicationDocument,threadId:string,phase:'prepared'|'sent'){
 const payload={threadId,document,intent:communicationDocumentIntent(input,document),targetType:input.targetType,targetId:input.targetId,subject:input.subject.trim(),bodySha256:createHash('sha256').update(input.body.trim()).digest('hex')};
 await tx.execute(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,correlation_id,created_at)
 VALUES(${randomUUID()},${auth.tenantId},${input.targetType==='ORDER'?input.targetId:null},${phase==='sent'?'COMMUNICATION_DOCUMENT_SENT_V1':'COMMUNICATION_DOCUMENT_PREPARED_V1'},${document.number+' · Fassung '+document.edition+(phase==='sent'?' gesendet':' zum Versand vorbereitet')},${JSON.stringify(payload)}::jsonb,'success',${auth.userId}::uuid,${phase==='prepared'?threadId:randomUUID()}::uuid,1,${input.clientRequestId}::uuid,statement_timestamp())`);
}

/** A replay reads the immutable outgoing proof, never a newly rendered document. */
export async function readCommunicationDocumentReceipt(auth:AuthorizationSnapshot,input:Intent,documentId:string){
 if(!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN' as const,message:'E-Mails sind nicht freigegeben.'};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<{id:string;status:string;customer_id:string;order_id:string|null;created_at:string;created_by:string;subject:string;payload:{document:CommunicationDocument;intent:string};message_id:string|null;body:string|null;sent_intent:string|null}>(sql`
   SELECT thread.id::text,thread.status,thread.customer_id,thread.order_id,thread.created_at::text,thread.created_by::text,thread.subject,prepared.payload,
    message.id::text AS message_id,message.body,sent.payload->>'intent' AS sent_intent
   FROM public.communication_threads thread
   LEFT JOIN public.events prepared ON prepared.tenant_id=thread.tenant_id AND prepared.event_type='COMMUNICATION_DOCUMENT_PREPARED_V1' AND prepared.client_event_id=thread.id
   LEFT JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id AND message.direction='outgoing'
   LEFT JOIN public.events sent ON sent.tenant_id=thread.tenant_id AND sent.event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND sent.payload->>'threadId'=thread.id::text
   WHERE thread.tenant_id=${auth.tenantId} AND thread.source=${'MS_GRAPH_OUT:'+input.clientRequestId}`);
  if(!rows.length)return {code:'NOT_FOUND' as const,message:'Noch kein Versandbeleg.'};
  const row=rows[0],document=row.payload?.document;
  if(rows.length!==1||row.created_by!==auth.userId||!document||document.id!==documentId||row.order_id!==(input.targetType==='ORDER'?input.targetId:null)||input.targetType==='CUSTOMER'&&row.customer_id!==input.targetId||row.payload.intent!==communicationDocumentIntent(input,document))return {code:'CONFLICT' as const,message:'Die Versandkennung ist bereits anders belegt. Kein zweiter Versand.'};
  if(row.status!=='sent')return {code:'PENDING' as const,document};
  if(!row.message_id||row.sent_intent!==row.payload.intent||row.body!==input.body.trim()||row.subject!==input.subject.trim())throw Error('COMMUNICATION_DOCUMENT_PROOF_INVALID');
  return {code:'OK' as const,document,data:{threadId:row.id,messageId:row.message_id,customerId:row.customer_id,orderId:row.order_id,recordedAt:row.created_at,replayed:true}};
 });}catch(error){console.error('[COMMUNICATION_DOCUMENT_RECEIPT_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'Versandbeleg konnte nicht sicher gelesen werden. Nicht erneut senden.'};}
}
