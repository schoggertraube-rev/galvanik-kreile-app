import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {sql,type SQL} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from './privilegedDb';
import {appendOrderInformed} from './orderReleaseRead';
import {DISPATCH_NOTICE_COPY} from '@/ui/situationCatalog';

export type InvoiceMailDocument={id:string;number:string;version:number;sha256:string;orderId:string;orderNumber?:string};
export type CommunicationDocument={kind:'QUOTE';id:string;number:string;version:number;edition:number;sha256:string;source?:{itemId:string;graphMessageId:string}}|InvoiceMailDocument&{kind:'INVOICE';bundle?:InvoiceMailDocument[];source?:never};
type Intent={targetType:'CUSTOMER'|'ORDER';targetId:string;clientRequestId:string;subject:string;body:string};
export function communicationDocumentBody(body:string,document:CommunicationDocument,legacy=false){
 if(document.kind!=='INVOICE'||!document.bundle?.length)return body.trim();
 const orders=[document,...document.bundle].map(doc=>doc.orderNumber);if(orders.some(number=>!number))throw Error('INVOICE_BUNDLE_ORDER_NUMBER_MISSING');
 const prefix=(legacy?DISPATCH_NOTICE_COPY.legacyCollective(orders as string[]):DISPATCH_NOTICE_COPY.collective(orders as string[]))+'\n\n';
 return body.trim().startsWith(prefix)?body.trim():prefix+body.trim();
}
export function communicationDocumentIntent(input:Intent,document:CommunicationDocument,legacy=false){return createHash('sha256').update(JSON.stringify({targetType:input.targetType,targetId:input.targetId,subject:input.subject.trim(),body:communicationDocumentBody(input.body,document,legacy),document:{kind:document.kind,id:document.id,number:document.number,version:document.version,...(document.kind==='QUOTE'?{edition:document.edition}:{orderId:document.orderId,...(document.bundle?.length?{orderNumber:document.orderNumber,bundle:document.bundle.map(doc=>({id:doc.id,orderId:doc.orderId,orderNumber:doc.orderNumber,number:doc.number,version:doc.version,sha256:doc.sha256}))}:{})}),sha256:document.sha256,...(document.source?{source:{itemId:document.source.itemId,graphMessageId:document.source.graphMessageId}}:{})}})).digest('hex');}
export async function appendCommunicationDocument(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:Intent,document:CommunicationDocument,threadId:string,phase:'prepared'|'sent'){
 const payload={threadId,document,intent:communicationDocumentIntent(input,document),targetType:input.targetType,targetId:input.targetId,subject:input.subject.trim(),bodySha256:createHash('sha256').update(input.body.trim()).digest('hex')};
 await tx.execute(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,correlation_id,created_at)
 VALUES(${randomUUID()},${auth.tenantId},${input.targetType==='ORDER'?input.targetId:null},${phase==='sent'?'COMMUNICATION_DOCUMENT_SENT_V1':'COMMUNICATION_DOCUMENT_PREPARED_V1'},${document.number+(document.kind==='QUOTE'?' · Fassung '+document.edition:'')+(phase==='sent'?' gesendet':' zum Versand vorbereitet')},${JSON.stringify(payload)}::jsonb,'success',${auth.userId}::uuid,${phase==='prepared'?threadId:randomUUID()}::uuid,1,${input.clientRequestId}::uuid,statement_timestamp())`);
 if(phase==='sent'&&document.kind==='INVOICE'){
  for(const invoiceDocument of [document,...document.bundle??[]].sort((a,b)=>a.orderId.localeCompare(b.orderId))){
  // Same transaction as the confirmed local outgoing message, never on preparation/failure.
  const proof=await tx.execute(sql`SELECT invoice.id FROM public.invoices invoice JOIN public.communication_threads thread ON thread.tenant_id=invoice.tenant_id AND thread.id=${threadId}::uuid
   JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id AND message.direction='outgoing' AND message.channel='email'
   WHERE invoice.tenant_id=${auth.tenantId} AND invoice.id=${invoiceDocument.id}::uuid AND invoice.order_id=${invoiceDocument.orderId}
    AND invoice.status='issued' AND invoice.aggregate_version=${invoiceDocument.version} AND invoice.pdf_sha256=${invoiceDocument.sha256}
    AND thread.status='sent' AND thread.customer_id=invoice.customer_id AND (thread.order_id=${document.orderId} OR thread.order_id IS NULL)`);
  if(proof.length!==1)throw Error('INVOICE_NOTIFICATION_PROOF_INVALID');
  const bytes=createHash('sha256').update('order-informed:'+auth.tenantId+':'+input.clientRequestId+':'+invoiceDocument.orderId).digest();bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
  const h=bytes.subarray(0,16).toString('hex'),key=`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  await appendOrderInformed(tx,auth,{orderId:invoiceDocument.orderId,clientEventId:key,channel:'mail',threadId,intent:payload.intent});
  }
 }
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
  const legacy=!!document&&document.kind==='INVOICE'&&!!document.bundle?.length&&row.payload.intent===communicationDocumentIntent(input,document,true);
  if(rows.length!==1||row.created_by!==auth.userId||!document||document.id!==documentId||row.order_id!==(input.targetType==='ORDER'?input.targetId:null)||input.targetType==='CUSTOMER'&&row.customer_id!==input.targetId||row.payload.intent!==communicationDocumentIntent(input,document,legacy))return {code:'CONFLICT' as const,message:'Die Versandkennung ist bereits anders belegt. Kein zweiter Versand.'};
  if(row.status!=='sent')return {code:'CONFLICT' as const,message:'Ausgang dieses Versands ist ungeklärt. Nicht erneut senden; Outlook-Ausgang prüfen.'};
  if(!row.message_id||row.sent_intent!==row.payload.intent||row.body!==communicationDocumentBody(input.body,document,legacy)||row.subject!==input.subject.trim())throw Error('COMMUNICATION_DOCUMENT_PROOF_INVALID');
  return {code:'OK' as const,document,data:{threadId:row.id,messageId:row.message_id,customerId:row.customer_id,orderId:row.order_id,recordedAt:row.created_at,replayed:true}};
 });}catch(error){console.error('[COMMUNICATION_DOCUMENT_RECEIPT_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'Versandbeleg konnte nicht sicher gelesen werden. Nicht erneut senden.'};}
}

/** Same membership predicate for preparation and the check under invoice lock. */
function invoiceSentMembership(invoiceId:SQL){
 return sql`sent.payload->'document'->>'kind'='INVOICE'
  AND (sent.payload->'document'->>'id'=${invoiceId}::text
   OR coalesce(sent.payload->'document'->'bundle','[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id',${invoiceId}::text)))`;
}
export function invoiceAlreadySent(tenantId:string,invoiceId:SQL){
 return sql`EXISTS(SELECT 1 FROM public.events sent WHERE sent.tenant_id=${tenantId}
  AND sent.event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND sent.status='success'
  AND ${invoiceSentMembership(invoiceId)})`;
}
export class InvoiceAlreadySent extends Error{
 constructor(readonly number:string,readonly sentOn:string){super('INVOICE_ALREADY_SENT');}
}
export async function assertInvoiceNotSent(tx:PrivilegedTenantTransaction,tenantId:string,invoice:{id:string;number:string}){
 const rows=await tx.execute<{sent_on:string}>(sql`SELECT to_char(sent.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin','DD.MM.YYYY') AS sent_on FROM public.events sent
  WHERE sent.tenant_id=${tenantId} AND sent.event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND sent.status='success'
  AND ${invoiceSentMembership(sql`${invoice.id}`)} ORDER BY sent.created_at,sent.id LIMIT 1`);
 if(rows.length)throw new InvoiceAlreadySent(invoice.number,rows[0].sent_on);
}

export async function readInvoiceMailCohort(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string,handover:string|null){
 return tx.execute<{id:string;order_id:string;order_number:string;invoice_number:string;aggregate_version:number}>(sql`SELECT invoice.id::text,invoice.order_id,orders.order_number,invoice.invoice_number,invoice.aggregate_version FROM public.invoices invoice
  JOIN public.orders orders ON orders.tenant_id=invoice.tenant_id AND orders.id=invoice.order_id
  JOIN private.v_order_freeze_state_v1 frozen ON frozen.tenant_id=orders.tenant_id AND frozen.order_id=orders.id AND frozen.active AND frozen.integrity_ok
  WHERE invoice.tenant_id=${tenantId} AND invoice.customer_id=${customerId} AND invoice.status='issued' AND invoice.contract_version=1
   AND NOT ${invoiceAlreadySent(tenantId,sql`invoice.id`)} AND orders.station='fertig' AND orders.current_station='fertig' AND orders.current_station_id='fertig' AND orders.status='fertig' AND orders.handover_mode=${handover}
  ORDER BY orders.order_number,invoice.id LIMIT 102`);
}
export class InvoiceMailListChanged extends Error{
 constructor(readonly number:string,readonly added:boolean){super('INVOICE_MAIL_LIST_CHANGED');}
}
export async function assertInvoiceMailCohort(tx:PrivilegedTenantTransaction,tenantId:string,group:{customerId:string;handover:string|null},expected:readonly string[],prepared:readonly string[]){
 const current=await readInvoiceMailCohort(tx,tenantId,group.customerId,group.handover);
 const added=current.find(row=>!expected.includes(row.id)),removed=expected.find(id=>!current.some(row=>row.id===id));
 const unprepared=current.find(row=>expected.includes(row.id)&&!prepared.includes(row.id));
 if(added||unprepared)throw new InvoiceMailListChanged((added??unprepared)!.invoice_number,true);
 if(removed){const [invoice]=await tx.execute<{invoice_number:string}>(sql`SELECT invoice_number FROM public.invoices WHERE tenant_id=${tenantId} AND customer_id=${group.customerId} AND id=${removed}::uuid`);if(!invoice)throw Error('INVOICE_EXPECTED_LIST_INVALID');throw new InvoiceMailListChanged(invoice.invoice_number,false);}
 if(expected.length!==prepared.length)throw Error('INVOICE_EXPECTED_LIST_INVALID');
}
