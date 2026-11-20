import {parseInvoiceCollectionOriginal,type InvoiceCollectionOriginal} from '@/lib/domain/invoiceCollectionContract';
import 'server-only';
import type {CommunicationOriginal} from './communicationOriginalPort';
import {canonicalJson} from '@/lib/domain/canonicalJson';
import {createHash,randomUUID} from 'node:crypto';
import {sql,type SQL} from 'drizzle-orm';
import type {AuthorizationSnapshot} from './authorization';
import {hasAuthorizationArea} from '@/lib/auth/authorizationContract';
import {withPrivilegedTenantTransaction,withTenantSavepoint,type PrivilegedTenantTransaction} from './privilegedDb';
import {readCommunicationDeliveryFailures} from './communicationDeliveryPort';
import {appendOrderInformed,readReadyNotificationContext} from './orderReleaseRead';
import {DISPATCH_NOTICE_COPY,INVOICE_DELIVERY_COPY} from '@/ui/situationCatalog';

export type UnsentInvoiceOriginal={id:string;number:string;version:number;orderId:string|null;handover:string|null;customerId:string;customerName:string};
/** One unsent-original query shared by customer summary and Today. */
export async function readUnsentInvoiceOriginals(tx:PrivilegedTenantTransaction,tenantId:string,customerId?:string):Promise<UnsentInvoiceOriginal[]>{
 const rows=await tx.execute<UnsentInvoiceOriginal>(sql`SELECT invoice.id::text,invoice.invoice_number AS number,invoice.aggregate_version AS version,invoice.order_id AS "orderId",orders.handover_mode AS handover,invoice.customer_id AS "customerId",customer.name AS "customerName"
  FROM public.invoices invoice LEFT JOIN public.orders orders ON orders.tenant_id=invoice.tenant_id AND orders.id=invoice.order_id
  JOIN public.customers customer ON customer.tenant_id=invoice.tenant_id AND customer.id=invoice.customer_id
  WHERE invoice.tenant_id=${tenantId} ${customerId!==undefined?sql`AND invoice.customer_id=${customerId}`:sql``}
   AND invoice.status='issued' AND invoice.contract_version=1 AND NOT ${invoiceAlreadySent(tenantId,sql`invoice.id`)} ORDER BY invoice.issued_at,invoice.id`);
 if(rows.some(row=>typeof row.id!=='string'||typeof row.number!=='string'||typeof row.customerId!=='string'||typeof row.customerName!=='string'||!Number.isSafeInteger(row.version)))throw Error('INVOICE_UNSENT_ORIGINAL_SOURCE_INVALID');
 return rows;
}

export type InvoiceResendEvidence={bounceEventId:string;bounceItemId:string;bouncedThreadId:string;correctionEventId:string;recipient:string;originals:Array<{id:string;sha256:string}>};
type InvoiceMailDocumentBase={resend?:InvoiceResendEvidence;id:string;number:string;version:number;sha256:string};
export type InvoiceMailDocument=InvoiceMailDocumentBase&({orderId:string;orderNumber?:string;collection?:never}|{orderId:null;orderNumber?:never;collection:InvoiceCollectionOriginal});
export function invoiceMailMembers(document:InvoiceMailDocument):Array<{orderId:string;orderNumber?:string}>{
 if(document.orderId===null)return parseInvoiceCollectionOriginal(document.collection).members;
 if(typeof document.orderId!=='string'||!document.orderId.trim()||document.orderId.length>128||document.collection!==undefined)throw Error('INVOICE_MAIL_ORIGINAL_IDENTITY_INVALID');
 return [{orderId:document.orderId,...(document.orderNumber!==undefined?{orderNumber:document.orderNumber}:{})}];
}
export function invoiceMailSourceMatches(document:InvoiceMailDocument){
 const collection=document.orderId===null?parseInvoiceCollectionOriginal(document.collection):undefined;
 return sql`invoice.order_id IS NOT DISTINCT FROM ${document.orderId} AND ${collection?sql`invoice.snapshot->'collection'=${JSON.stringify(collection)}::jsonb AND private.invoice_original_source_valid(invoice.tenant_id,invoice.customer_id,invoice.order_id,invoice.order_version,invoice.freeze_id,invoice.service_date,invoice.snapshot,invoice.issued_at)`:sql`NOT(invoice.snapshot ? 'collection')`}`;
}
function invoiceMailOriginalMatches(document:InvoiceMailDocument){
 return sql`${invoiceMailSourceMatches(document)} AND invoice.status='issued' AND invoice.aggregate_version=${document.version} AND invoice.pdf_sha256=${document.sha256}`;
}
export function invoiceMailDocumentFromSource(row:{id:string;order_id:string|null;order_number:string|null;collection_source?:unknown;invoice_number:string;aggregate_version:number},sha256:string):InvoiceMailDocument{
 const common={id:row.id,number:row.invoice_number,version:row.aggregate_version,sha256};
 if(row.order_id===null){if(row.order_number!==null)throw Error('INVOICE_MAIL_NATIVE_ORDER_NUMBER_FORBIDDEN');return {...common,orderId:null,collection:parseInvoiceCollectionOriginal(row.collection_source)};}
 if(!row.order_number||row.collection_source!=null)throw Error('INVOICE_MAIL_ORDER_SOURCE_INVALID');
 return {...common,orderId:row.order_id,orderNumber:row.order_number};
}

/** Fiscal mail after handover uses the existing qualified physical source. */
function handedInvoiceOrder(tenantId:string){return sql`EXISTS(SELECT 1 FROM private.v_goods_out_ui_state_v1 physical
 WHERE physical.tenant_id=${tenantId} AND physical.order_id=orders.id AND physical.order_version=orders.version
  AND physical.integrity_ok AND physical.goods_out_event_count=1 AND physical.goods_out_event_id IS NOT NULL
  AND orders.station='abgeholt' AND orders.current_station='abgeholt' AND orders.current_station_id='abgeholt' AND orders.status='abgeholt')`;}
function invoiceOrderReadyForMail(tenantId:string){return sql`((orders.station='fertig' AND orders.current_station='fertig' AND orders.current_station_id='fertig' AND orders.status='fertig') OR ${handedInvoiceOrder(tenantId)})`;}

export type UnsentInvoiceMailGroup={customerId:string;customerName:string;id:string;number:string;orderId:string|null;ids:string[];count:number};
/** Same original/physical eligibility as the sender, in one query for all customers. */
export async function readUnsentInvoiceMailGroups(tx:PrivilegedTenantTransaction,tenantId:string):Promise<{groups:UnsentInvoiceMailGroup[];missing:string[]}>{
 type Row=UnsentInvoiceOriginal&{eligible:boolean|null};
 const rows=await tx.execute<Row>(sql`WITH invoice_candidates AS MATERIALIZED (
  SELECT invoice.id,invoice.tenant_id,invoice.customer_id,invoice.order_id,invoice.invoice_number,invoice.aggregate_version,invoice.issued_at,invoice.order_version,invoice.freeze_id,invoice.service_date,invoice.snapshot
  FROM public.invoices invoice WHERE invoice.tenant_id=${tenantId} AND invoice.status='issued' AND invoice.contract_version=1 AND NOT ${invoiceAlreadySent(tenantId,sql`invoice.id`)}
 ) SELECT invoice.id::text,invoice.invoice_number AS number,invoice.aggregate_version AS version,invoice.order_id AS "orderId",orders.handover_mode AS handover,invoice.customer_id AS "customerId",customer.name AS "customerName",
  CASE WHEN invoice.order_id IS NULL THEN private.invoice_original_source_valid(invoice.tenant_id,invoice.customer_id,invoice.order_id,invoice.order_version,invoice.freeze_id,invoice.service_date,invoice.snapshot,invoice.issued_at)
   WHEN frozen.order_id IS NULL THEN false ELSE ${invoiceOrderReadyForMail(tenantId)} END AS eligible
  FROM invoice_candidates invoice JOIN public.customers customer ON customer.tenant_id=invoice.tenant_id AND customer.id=invoice.customer_id
  LEFT JOIN public.orders orders ON orders.tenant_id=invoice.tenant_id AND orders.id=invoice.order_id
  LEFT JOIN private.v_order_freeze_state_v1 frozen ON frozen.tenant_id=orders.tenant_id AND frozen.order_id=orders.id AND frozen.active AND frozen.integrity_ok
  ORDER BY invoice.issued_at,invoice.id`);
 const sources=new Map<string,Row[]>();
 for(const row of rows){
  if(typeof row.id!=='string'||typeof row.number!=='string'||typeof row.customerId!=='string'||typeof row.customerName!=='string'||!Number.isSafeInteger(row.version))throw Error('INVOICE_UNSENT_ORIGINAL_SOURCE_INVALID');
  const key=JSON.stringify([row.customerId,row.orderId===null,row.handover]);
  const group=sources.get(key);if(group)group.push(row);else sources.set(key,[row]);
 }
 const groups:UnsentInvoiceMailGroup[]=[],missing:string[]=[];
 for(const [key,source] of sources){
  const native=source[0].orderId===null;
  // A damaged native collection blocks its group; an ineligible ordinary order
  // is excluded just as by the sender's existing freeze/physical joins.
  if(source.some(row=>typeof row.eligible!=='boolean'||(!native&&row.handover!=='pickup'&&row.handover!=='shipping'))||(native&&source.some(row=>row.eligible!==true))){missing.push('TODAY_UNSENT_INVOICE_GROUP:'+key);continue;}
  const eligible=source.filter(row=>row.eligible===true);
  if(!eligible.length){missing.push('TODAY_UNSENT_INVOICE_GROUP:'+key);continue;}
  const selected=eligible.slice(0,101),first=selected[0];
  groups.push({customerId:first.customerId,customerName:first.customerName,id:first.id,number:first.number,orderId:first.orderId,ids:selected.map(row=>row.id),count:eligible.length});
 }
 return {groups,missing};
}
async function readInvoiceOrderMailPhase(tx:PrivilegedTenantTransaction,tenantId:string,orderId:string){
 if(await readReadyNotificationContext(tx,tenantId,orderId))return 'ready' as const;
 const physical=await tx.execute(sql`SELECT orders.id FROM public.orders orders WHERE orders.tenant_id=${tenantId} AND orders.id=${orderId} AND ${handedInvoiceOrder(tenantId)} FOR UPDATE OF orders`);
 return physical.length===1?'handed_over' as const:null;
}
async function lockInvoiceMailOrders(tx:PrivilegedTenantTransaction,tenantId:string,documents:readonly InvoiceMailDocument[]){
 const orderIds=[...new Set(documents.flatMap(document=>invoiceMailMembers(document).map(member=>member.orderId)))].sort();
 if(!orderIds.length)throw Error('INVOICE_MAIL_ORIGINALS_EMPTY');
 const locked=await tx.execute<{id:string}>(sql`SELECT id FROM public.orders WHERE tenant_id=${tenantId} AND id IN (${sql.join(orderIds.map(id=>sql`${id}`),sql`, `)}) ORDER BY id FOR UPDATE`);
 return locked.length===orderIds.length&&orderIds.every(id=>locked.some(order=>order.id===id));
}
/** Same pre-send recheck for initial preparation and frozen-original retry. */
export async function lockInvoiceMailDocuments(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,documents:readonly InvoiceMailDocument[]){
 if(!documents.length)throw Error('INVOICE_MAIL_ORIGINALS_EMPTY');
 const native=documents[0].orderId===null;
 if(documents.some(document=>(document.orderId===null)!==native))throw Error('INVOICE_MAIL_MIXED_GROUP_FORBIDDEN');
 if(!await lockInvoiceMailOrders(tx,auth.tenantId,documents))return false;
 for(const document of documents.slice().sort((a,b)=>(a.orderId===null?a.id:a.orderId).localeCompare(b.orderId===null?b.id:b.orderId))){
  if(document.orderId!==null&&!await readInvoiceOrderMailPhase(tx,auth.tenantId,document.orderId))return false;
  const locked=await tx.execute(sql`SELECT invoice.id FROM public.invoices invoice WHERE invoice.tenant_id=${auth.tenantId} AND invoice.id=${document.id}::uuid AND ${invoiceMailOriginalMatches(document)} FOR UPDATE`);
  if(locked.length!==1)return false;
 }
 return true;
}

export type CommunicationDocument={kind:'QUOTE';original?:CommunicationOriginal;id:string;number:string;version:number;edition:number;sha256:string;source?:{itemId:string;graphMessageId:string}}|InvoiceMailDocument&{kind:'INVOICE';bundle?:InvoiceMailDocument[];source?:never};
type Intent={targetType:'CUSTOMER'|'ORDER';targetId:string;clientRequestId:string;subject:string;body:string};
export type LegacyQuoteReplacement={requestId:string;checkedAt:string};
export async function readLegacyQuoteReplacement(auth:AuthorizationSnapshot,requestId:string){
 return withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<{request_id:string}>(sql`SELECT prepared.correlation_id::text AS request_id FROM public.events prepared
   JOIN public.communication_threads thread ON thread.tenant_id=prepared.tenant_id AND thread.id::text=prepared.payload->>'threadId' AND thread.created_by=prepared.user_id
   JOIN public.events document ON document.tenant_id=prepared.tenant_id AND document.event_type='COMMUNICATION_DOCUMENT_PREPARED_V1' AND document.correlation_id=prepared.correlation_id AND document.user_id=prepared.user_id
   WHERE prepared.tenant_id=${auth.tenantId} AND prepared.user_id=${auth.userId}::uuid AND prepared.event_type='COMMUNICATION_MAIL_PREPARED_V1'
    AND prepared.payload->'legacyReplaces'->>'requestId'=${requestId} AND document.payload->'document'->>'kind'='QUOTE' AND document.payload->'document' ? 'original'`);
  if(rows.length>1)throw Error('LEGACY_QUOTE_REPLACEMENT_AMBIGUOUS');return rows[0]?.request_id??null;
 });
}
/** Recheck and lock the still unresolved original after the explicit new-send click. */
export async function assertLegacyQuoteReplacement(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:Intent,document:CommunicationDocument,replacement:LegacyQuoteReplacement){
 if(document.kind!=='QUOTE'||!document.original||input.clientRequestId===replacement.requestId||!Number.isFinite(Date.parse(replacement.checkedAt)))throw Error('LEGACY_QUOTE_REPLACEMENT_INVALID');
 const rows=await tx.execute(sql`SELECT thread.id FROM public.communication_threads thread
  JOIN public.events prepared ON prepared.tenant_id=thread.tenant_id AND prepared.event_type='COMMUNICATION_DOCUMENT_PREPARED_V1' AND prepared.client_event_id=thread.id AND prepared.user_id=thread.created_by
  WHERE thread.tenant_id=${auth.tenantId} AND thread.created_by=${auth.userId}::uuid AND thread.source='MS_GRAPH_OUT:'||${replacement.requestId}
   AND thread.status IN('pending','failed') AND prepared.payload->'document'->>'kind'='QUOTE' AND prepared.payload->'document'->>'id'=${document.id}
   AND NOT(prepared.payload->'document' ? 'original') AND prepared.payload->>'targetType'=${input.targetType} AND prepared.payload->>'targetId'=${input.targetId}
  FOR UPDATE OF thread`);
 if(rows.length!==1)throw Error('LEGACY_QUOTE_REPLACEMENT_CHANGED');
}
export function communicationDocumentBody(body:string,document:CommunicationDocument,legacy=false){
 if(document.kind!=='INVOICE'||document.orderId!==null&&!document.bundle?.length)return body.trim();
 const originals=[document,...document.bundle??[]];
 if(originals.some(doc=>(doc.orderId===null)!==(document.orderId===null)))throw Error('INVOICE_MAIL_MIXED_GROUP_FORBIDDEN');
 const orders=originals.flatMap(doc=>invoiceMailMembers(doc).map(member=>member.orderNumber));if(orders.some(number=>!number))throw Error('INVOICE_BUNDLE_ORDER_NUMBER_MISSING');
 const prefix=(document.orderId===null?DISPATCH_NOTICE_COPY.nativeCollective(orders as string[]):legacy?DISPATCH_NOTICE_COPY.legacyCollective(orders as string[]):DISPATCH_NOTICE_COPY.collective(orders as string[]))+'\n\n';
 return body.trim().startsWith(prefix)?body.trim():prefix+body.trim();
}
export function communicationDocumentIntent(input:Intent,document:CommunicationDocument,legacy=false){return createHash('sha256').update(JSON.stringify({targetType:input.targetType,targetId:input.targetId,subject:input.subject.trim(),body:communicationDocumentBody(input.body,document,legacy),document:{kind:document.kind,id:document.id,number:document.number,version:document.version,...(document.kind==='QUOTE'?{edition:document.edition}:{orderId:document.orderId,...(document.orderId===null?{collection:parseInvoiceCollectionOriginal(document.collection)}:{}),...(document.resend?{resend:JSON.parse(canonicalJson(document.resend))}:{}),...(document.bundle?.length?{orderNumber:document.orderNumber,bundle:document.bundle.map(doc=>({id:doc.id,orderId:doc.orderId,...(doc.orderId===null?{collection:parseInvoiceCollectionOriginal(doc.collection)}:{}),orderNumber:doc.orderNumber,number:doc.number,version:doc.version,sha256:doc.sha256}))}:{})}),sha256:document.sha256,...(document.source?{source:{itemId:document.source.itemId,graphMessageId:document.source.graphMessageId}}:{})}})).digest('hex');}
export async function appendCommunicationDocument(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:Intent,document:CommunicationDocument,threadId:string,phase:'prepared'|'sent',sourceDocument?:CommunicationDocument,prepareActorId=auth.userId){
 if(document.kind==='INVOICE')document={...document,bundle:document.bundle??[]};
 const payload={threadId,document,prepareActorId,clickedBy:auth.userId,...(sourceDocument?{sourceDocumentIntent:communicationDocumentIntent(input,sourceDocument)}:{}),intent:communicationDocumentIntent(input,document),targetType:input.targetType,targetId:input.targetId,subject:input.subject.trim(),bodySha256:createHash('sha256').update(input.body.trim()).digest('hex')};
 await tx.execute(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,correlation_id,created_at)
 VALUES(${randomUUID()},${auth.tenantId},${input.targetType==='ORDER'?input.targetId:null},${phase==='sent'?'COMMUNICATION_DOCUMENT_SENT_V1':'COMMUNICATION_DOCUMENT_PREPARED_V1'},${document.number+(document.kind==='QUOTE'?' · Fassung '+document.edition:'')+(phase==='sent'?' gesendet':' zum Versand vorbereitet')},${JSON.stringify(payload)}::jsonb,'success',${prepareActorId}::uuid,${phase==='prepared'?threadId:randomUUID()}::uuid,1,${input.clientRequestId}::uuid,statement_timestamp())`);
 if(phase==='sent'&&document.kind==='INVOICE'){
  for(const invoiceDocument of [document,...document.bundle??[]].sort((a,b)=>(a.orderId===null?a.id:a.orderId).localeCompare(b.orderId===null?b.id:b.orderId))){
  // Same transaction as the confirmed local outgoing message, never on preparation/failure.
  const proof=await tx.execute(sql`SELECT invoice.id FROM public.invoices invoice JOIN public.communication_threads thread ON thread.tenant_id=invoice.tenant_id AND thread.id=${threadId}::uuid
   JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id AND message.direction='outgoing' AND message.channel='email'
   WHERE invoice.tenant_id=${auth.tenantId} AND invoice.id=${invoiceDocument.id}::uuid AND ${invoiceMailSourceMatches(invoiceDocument)}
    AND invoice.status='issued' AND invoice.aggregate_version=${invoiceDocument.version} AND invoice.pdf_sha256=${invoiceDocument.sha256}
    AND thread.status='sent' AND thread.customer_id=invoice.customer_id AND (thread.order_id=${input.targetType==='ORDER'?input.targetId:null} OR thread.order_id IS NULL)`);
  if(proof.length!==1)throw Error('INVOICE_NOTIFICATION_PROOF_INVALID');
  // Fiscal mail for handed-over goods never fabricates a ready notification.
  if(invoiceDocument.orderId!==null){
  const mailPhase=await readInvoiceOrderMailPhase(tx,auth.tenantId,invoiceDocument.orderId);
  if(!mailPhase)throw Error('INVOICE_NOTIFICATION_ORDER_SOURCE_INVALID');
  if(mailPhase==='ready'){
  const bytes=createHash('sha256').update('order-informed:'+auth.tenantId+':'+input.clientRequestId+':'+invoiceDocument.orderId).digest();bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
  const h=bytes.subarray(0,16).toString('hex'),key=`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  await appendOrderInformed(tx,auth,{orderId:invoiceDocument.orderId,clientEventId:key,channel:'mail',threadId,intent:payload.intent});
  }
  }
  }
 }
}

/** A replay reads the immutable outgoing proof, never a newly rendered document. */
export async function readCommunicationDocumentReceipt(auth:AuthorizationSnapshot,input:Intent,documentId:string){
 if(!hasAuthorizationArea(auth,'mails')&&!hasAuthorizationArea(auth,'preise'))return {code:'FORBIDDEN' as const,message:'E-Mails sind nicht freigegeben.'};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<{id:string;status:string;customer_id:string;order_id:string|null;created_at:string;created_by:string;prepared_by:string;subject:string;request_id:string;payload:{document:CommunicationDocument;intent:string};message_id:string|null;body:string|null;sent_intent:string|null;mail_only:boolean}>(sql`
   SELECT thread.id::text,thread.status,thread.customer_id,thread.order_id,thread.created_at::text,thread.created_by::text,prepared.user_id::text AS prepared_by,thread.subject,prepared.correlation_id::text AS request_id,prepared.payload,
    message.id::text AS message_id,message.body,sent.payload->>'intent' AS sent_intent,
    (mail.payload->'documentReconciliation'->'originalDocument'=prepared.payload->'document' AND mail.user_id=prepared.user_id AND mail.payload->>'messageId'=message.id::text AND (mail.payload->'sentItemsEvidence'->>'clientRequestId'=prepared.correlation_id::text OR mail.payload->>'graphAcceptedRequestId'=prepared.correlation_id::text)) AS mail_only
   FROM public.communication_threads thread
   LEFT JOIN public.events prepared ON prepared.tenant_id=thread.tenant_id AND prepared.event_type='COMMUNICATION_DOCUMENT_PREPARED_V1' AND prepared.client_event_id=thread.id
   LEFT JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id AND message.direction='outgoing'
   LEFT JOIN public.events sent ON sent.tenant_id=thread.tenant_id AND sent.event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND sent.payload->>'threadId'=thread.id::text AND sent.payload->>'intent'=prepared.payload->>'intent'
   LEFT JOIN public.events mail ON mail.tenant_id=thread.tenant_id AND mail.event_type='COMMUNICATION_MAIL_SENT_V1' AND mail.payload->>'threadId'=thread.id::text
   WHERE thread.tenant_id=${auth.tenantId} AND (thread.source=${'MS_GRAPH_OUT:'+input.clientRequestId}
    OR NOT EXISTS(SELECT 1 FROM public.communication_threads exact WHERE exact.tenant_id=${auth.tenantId} AND exact.source=${'MS_GRAPH_OUT:'+input.clientRequestId})
     AND thread.source LIKE 'MS_GRAPH_OUT:%' AND thread.status IN('pending','failed')
     AND prepared.payload->'document'->>'id'=${documentId} AND (thread.order_id=${input.targetType==='ORDER'?input.targetId:null} OR ${input.targetType==='CUSTOMER'} AND thread.order_id IS NULL AND thread.customer_id=${input.targetId})) LIMIT 2`);
  if(!rows.length)return {code:'NOT_FOUND' as const,message:'Noch kein Versandbeleg.'};
  const row=rows[0],document=row.payload?.document;
  const legacy=!!document&&document.kind==='INVOICE'&&!!document.bundle?.length&&row.payload.intent===communicationDocumentIntent(input,document,true);
  if(rows.length!==1||row.created_by!==row.prepared_by||!document||document.id!==documentId||row.order_id!==(input.targetType==='ORDER'?input.targetId:null)||input.targetType==='CUSTOMER'&&row.customer_id!==input.targetId||row.payload.intent!==communicationDocumentIntent(input,document,legacy))return {code:'CONFLICT' as const,message:'Die Versandkennung ist bereits anders belegt. Kein zweiter Versand.'};
  if(!hasAuthorizationArea(auth,document.kind==='INVOICE'?'preise':'mails'))return {code:'FORBIDDEN' as const,message:'Versand ist nicht freigegeben.'};
  if(row.status!=='sent'&&!/^[0-9a-f-]{36}$/i.test(row.request_id))return {code:'CONFLICT' as const,message:'Die Versandkennung ist bereits anders belegt. Kein zweiter Versand.'};
  if(row.status!=='sent')return {code:'PENDING' as const,document,originalRequestId:row.request_id};
  if(!row.message_id||row.body!==communicationDocumentBody(input.body,document,legacy)||row.subject!==input.subject.trim())throw Error('COMMUNICATION_DOCUMENT_PROOF_INVALID');
  if(row.mail_only===true)return {code:'OK' as const,document,mailOnly:true,data:{threadId:row.id,messageId:row.message_id,customerId:row.customer_id,orderId:row.order_id,recordedAt:row.created_at,replayed:true}};
  if(row.sent_intent!==row.payload.intent)throw Error('COMMUNICATION_DOCUMENT_PROOF_INVALID');
  return {code:'OK' as const,document,data:{threadId:row.id,messageId:row.message_id,customerId:row.customer_id,orderId:row.order_id,recordedAt:row.created_at,replayed:true}};
 });}catch(error){console.error('[COMMUNICATION_DOCUMENT_RECEIPT_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'Versandbeleg konnte nicht sicher gelesen werden. Nicht erneut senden.'};}
}

/** PL00:40: transport reconciliation uses the original PREPARE authority.
 * Bytes stay server-side; this does not grant access to the invoice PDF viewer. */
export async function readPreparedInvoiceTransportOriginal(auth:AuthorizationSnapshot,input:Intent,document:Extract<CommunicationDocument,{kind:'INVOICE'}>,invoice:InvoiceMailDocument){
 if(!hasAuthorizationArea(auth,'preise'))return null;
 return withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<{pdf_content:Buffer|Uint8Array;integrity_ok:boolean}>(sql`SELECT invoice.pdf_content,encode(sha256(invoice.pdf_content),'hex')=invoice.pdf_sha256 AS integrity_ok
   FROM public.invoices invoice WHERE invoice.tenant_id=${auth.tenantId} AND invoice.id=${invoice.id}::uuid AND ${invoiceMailSourceMatches(invoice)} AND invoice.pdf_sha256=${invoice.sha256}
    AND EXISTS(SELECT 1 FROM public.events prepared JOIN public.communication_threads thread ON thread.tenant_id=prepared.tenant_id AND thread.id::text=prepared.payload->>'threadId'
     WHERE prepared.tenant_id=invoice.tenant_id AND prepared.event_type='COMMUNICATION_DOCUMENT_PREPARED_V1' AND prepared.user_id=thread.created_by
      AND thread.source=${'MS_GRAPH_OUT:'+input.clientRequestId} AND prepared.payload->'document'=${JSON.stringify(document)}::jsonb AND prepared.payload->>'intent'=${communicationDocumentIntent(input,document)})`);
  if(rows.length!==1||rows[0].integrity_ok!==true||!rows[0].pdf_content)return null;
  const bytes=Buffer.from(rows[0].pdf_content);
  return createHash('sha256').update(bytes).digest('hex')===invoice.sha256?bytes:null;
 });
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
/** The existing prepared original protects every member of an in-flight bundle. */
function unresolvedInvoiceMailReceipt(){
 return sql`(thread.status IS DISTINCT FROM 'sent' OR NOT EXISTS(SELECT 1 FROM public.events completed
    WHERE completed.tenant_id=sent.tenant_id AND completed.event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND completed.status='success'
     AND completed.user_id=sent.user_id AND completed.payload->>'threadId'=sent.payload->>'threadId'
     AND completed.payload->'document'=sent.payload->'document' AND completed.payload->>'intent'=sent.payload->>'intent'))`;
}
function invoiceMailUnresolved(tenantId:string,invoiceId:SQL){
 return sql`EXISTS(SELECT 1 FROM public.events sent
  LEFT JOIN public.communication_threads thread ON thread.tenant_id=sent.tenant_id AND thread.id::text=sent.payload->>'threadId'
  WHERE sent.tenant_id=${tenantId} AND sent.event_type='COMMUNICATION_DOCUMENT_PREPARED_V1' AND sent.status='success'
   AND ${invoiceSentMembership(invoiceId)}
   AND ${unresolvedInvoiceMailReceipt()})`;
}
export class InvoiceAlreadySent extends Error{
 constructor(readonly number:string,readonly sentOn:string){super('INVOICE_ALREADY_SENT');}
}
export async function assertInvoiceNotSent(tx:PrivilegedTenantTransaction,tenantId:string,invoice:{id:string;number:string}){
 const rows=await tx.execute<{sent_on:string}>(sql`SELECT to_char(sent.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin','DD.MM.YYYY') AS sent_on FROM public.events sent
  WHERE sent.tenant_id=${tenantId} AND sent.event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND sent.status='success'
  AND ${invoiceSentMembership(sql`${invoice.id}`)} ORDER BY sent.created_at,sent.id LIMIT 1`);
 if(rows.length)throw new InvoiceAlreadySent(invoice.number,rows[0].sent_on);
 const pending=await tx.execute<{blocked:boolean}>(sql`SELECT ${invoiceMailUnresolved(tenantId,sql`${invoice.id}`)} AS blocked`);
 if(pending.length!==1||pending[0].blocked)throw Error('COMMUNICATION_OUTCOME_UNCLEAR');
}

type InvoiceMailLegacyRow={id:string;order_id:string;order_number:string;invoice_number:string;aggregate_version:number;mail_pending:boolean};
type InvoiceMailNativeRow={id:string;order_id:null;order_number:null;collection_source:unknown;invoice_number:string;aggregate_version:number;source_integrity_ok:boolean;mail_pending:boolean};
/** Read the existing immutable PREPARE, not a new group assembled around it. */
async function bindInvoiceMailGroup<Row extends InvoiceMailLegacyRow|InvoiceMailNativeRow>(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string,rows:Row[]){
 const pending=rows.find(row=>row.mail_pending);
 if(!pending)return rows.slice(0,101);
 const receipts=await tx.execute<{created_by:string;prepared_by:string;mail_prepared_by:string;order_id:string|null;customer_id:string;subject:string;source:string;request_id:string;
  payload:{document:CommunicationDocument;intent:string;targetType:string;targetId:string;subject:string;bodySha256:string};
  mail_payload:{threadId:string;clientRequestId:string;targetType:string;targetId:string;customerId:string;orderId:string|null;intentHash:string;contentSha256:string;documents:Array<{id:string;sha256:string}>}}>(sql`SELECT thread.created_by::text,sent.user_id::text AS prepared_by,mail.user_id::text AS mail_prepared_by,thread.order_id,thread.customer_id,thread.subject,thread.source,sent.correlation_id::text AS request_id,sent.payload,mail.payload AS mail_payload
  FROM public.events sent JOIN public.communication_threads thread ON thread.tenant_id=sent.tenant_id AND thread.id::text=sent.payload->>'threadId'
  JOIN public.events mail ON mail.tenant_id=sent.tenant_id AND mail.event_type='COMMUNICATION_MAIL_PREPARED_V1' AND mail.status='success'
   AND mail.correlation_id=sent.correlation_id AND mail.payload->>'threadId'=sent.payload->>'threadId'
  WHERE sent.tenant_id=${tenantId} AND thread.customer_id=${customerId} AND sent.event_type='COMMUNICATION_DOCUMENT_PREPARED_V1' AND sent.status='success'
   AND ${invoiceSentMembership(sql`${pending.id}`)} AND ${unresolvedInvoiceMailReceipt()} LIMIT 2`);
 if(receipts.length!==1)throw Error('INVOICE_MAIL_PENDING_GROUP_SOURCE_INCOMPLETE');
 const row=receipts[0],original=row.payload?.document,mail=row.mail_payload;
 const targetType=row.order_id===null?'CUSTOMER':'ORDER',targetId=row.order_id===null?row.customer_id:row.order_id;
 // A pending Graph attempt has no outgoing message yet. Its two immutable
 // PREPAREs, actor, exact target and PDF hashes qualify only this read projection.
 // The existing replay writer still validates the complete original body/intent.
 if(!original||original.kind!=='INVOICE'||!mail||row.created_by!==row.prepared_by||row.prepared_by!==row.mail_prepared_by
  ||!/^[0-9a-f-]{36}$/i.test(row.request_id)||!row.source.startsWith('MS_GRAPH_OUT:')||row.source.slice('MS_GRAPH_OUT:'.length).toLowerCase()!==row.request_id
  ||row.payload.targetType!==targetType||row.payload.targetId!==targetId||row.subject!==row.payload.subject
  ||mail.targetType!==targetType||mail.targetId!==targetId||mail.customerId!==customerId||mail.orderId!==row.order_id
  ||mail.clientRequestId!==row.request_id||![row.payload.intent,row.payload.bodySha256,mail.intentHash,mail.contentSha256].every(hash=>typeof hash==='string'&&/^[0-9a-f]{64}$/.test(hash)))throw Error('INVOICE_MAIL_PENDING_GROUP_SOURCE_INCOMPLETE');
 const documents=[original,...original.bundle??[]];
 if(documents.length>101||new Set(documents.map(doc=>doc.id)).size!==documents.length)throw Error('INVOICE_MAIL_PENDING_GROUP_SOURCE_INCOMPLETE');
 if(!Array.isArray(mail.documents)||mail.documents.length!==documents.length||!documents.every(doc=>mail.documents.some(saved=>saved.id===doc.id&&saved.sha256===doc.sha256)))throw Error('INVOICE_MAIL_PENDING_GROUP_SOURCE_INCOMPLETE');
 const sources=await tx.execute<{id:string}>(sql`SELECT invoice.id::text FROM public.invoices invoice WHERE invoice.tenant_id=${tenantId} AND invoice.customer_id=${customerId}
  AND (${sql.join(documents.map(doc=>sql`(invoice.id=${doc.id}::uuid AND ${invoiceMailOriginalMatches(doc)})`),sql` OR `)})`);
 if(sources.length!==documents.length)throw Error('INVOICE_MAIL_PENDING_GROUP_SOURCE_INCOMPLETE');
 const group=documents.map(document=>rows.find(row=>row.id===document.id));
 if(group.some(row=>row===undefined))throw Error('INVOICE_MAIL_PENDING_GROUP_SOURCE_INCOMPLETE');
 return group as Row[];
}
// Every consumer sees the same frozen group. The existing assertNotSent/lock
// boundary still forbids any new physical attempt while its outcome is unclear.
export type InvoiceMailReadScope={snapshotIds?:readonly string[];all?:true};
export function readInvoiceMailCohort(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string,handover:string|null,resendIds?:readonly string[],native?:false,unreservedOnly?:boolean,scope?:InvoiceMailReadScope):Promise<InvoiceMailLegacyRow[]>;
export function readInvoiceMailCohort(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string,handover:string|null,resendIds:readonly string[]|undefined,native:true,unreservedOnly?:boolean,scope?:InvoiceMailReadScope):Promise<InvoiceMailNativeRow[]>;
export function readInvoiceMailCohort(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string,handover:string|null,resendIds:readonly string[]|undefined,native:boolean|undefined,unreservedOnly?:boolean,scope?:InvoiceMailReadScope):Promise<Array<InvoiceMailLegacyRow|InvoiceMailNativeRow>>;
export async function readInvoiceMailCohort(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string,handover:string|null,resendIds:readonly string[]=[],native:boolean=false,unreservedOnly=false,scope?:InvoiceMailReadScope):Promise<Array<InvoiceMailLegacyRow|InvoiceMailNativeRow>>{
 // Fresh sends exclude reserved originals before the transport limit. Read-only
 // projections/reconciliation retain their exact qualified immutable PREPARE group.
 // The existing lock + assertNotSent still rejects a selected pending original.
 // Materialize only invoice candidates before joining the canonical physical
 // eligibility views. Otherwise PostgreSQL evaluates the costly handover proof
 // for already acknowledged originals as well (real retained-request EXPLAIN).
 const candidates=sql`SELECT invoice.id,invoice.tenant_id,invoice.customer_id,invoice.order_id,invoice.invoice_number,invoice.aggregate_version,invoice.issued_at,invoice.order_version,invoice.freeze_id,invoice.service_date,invoice.snapshot FROM public.invoices invoice
  WHERE invoice.tenant_id=${tenantId} AND invoice.customer_id=${customerId} AND invoice.status='issued' AND invoice.contract_version=1
   AND (${native?sql`invoice.order_id IS NULL`:sql`true`})
   AND (${resendIds.length>0?sql`invoice.id::text=ANY(ARRAY[${sql.join(resendIds.map(id=>sql`${id}`),sql`, `)}]::text[])`:sql`NOT ${invoiceAlreadySent(tenantId,sql`invoice.id`)}`})
   AND (${unreservedOnly?sql`NOT ${invoiceMailUnresolved(tenantId,sql`invoice.id`)}`:sql`true`})
   AND (${scope?.snapshotIds?sql`invoice.id::text=ANY(ARRAY[${sql.join(scope.snapshotIds.map(id=>sql`${id}`),sql`, `)}]::text[])`:sql`true`})`;
 if(native){const rows=await tx.execute<InvoiceMailNativeRow>(sql`WITH invoice_candidates AS MATERIALIZED (${candidates})
  SELECT invoice.id::text,invoice.order_id,NULL::text AS order_number,invoice.snapshot->'collection' AS collection_source,invoice.invoice_number,invoice.aggregate_version,${invoiceMailUnresolved(tenantId,sql`invoice.id`)} AS mail_pending,private.invoice_original_source_valid(invoice.tenant_id,invoice.customer_id,invoice.order_id,invoice.order_version,invoice.freeze_id,invoice.service_date,invoice.snapshot,invoice.issued_at) AS source_integrity_ok FROM invoice_candidates invoice
  ORDER BY invoice.issued_at,invoice.id ${scope?.all?sql``:sql`LIMIT 102`}`);
  // PL20.11.00:32: the unchanged 101-original transport limit binds one
  // deterministic oldest group. The sentinel/rest remain in the overview.
  const group=scope?.all?rows:await bindInvoiceMailGroup(tx,tenantId,customerId,rows);
  if(group.some(row=>row.source_integrity_ok!==true))throw Error('INVOICE_MAIL_COLLECTION_SOURCE_INCOMPLETE');
  return group;
 }

 const rows=await tx.execute<InvoiceMailLegacyRow>(sql`WITH invoice_candidates AS MATERIALIZED (${candidates})
  SELECT invoice.id::text,invoice.order_id,orders.order_number,invoice.invoice_number,invoice.aggregate_version,${invoiceMailUnresolved(tenantId,sql`invoice.id`)} AS mail_pending FROM invoice_candidates invoice
  JOIN public.orders orders ON orders.tenant_id=invoice.tenant_id AND orders.id=invoice.order_id
  JOIN private.v_order_freeze_state_v1 frozen ON frozen.tenant_id=orders.tenant_id AND frozen.order_id=orders.id AND frozen.active AND frozen.integrity_ok
  WHERE ${invoiceOrderReadyForMail(tenantId)} AND orders.handover_mode=${handover}
  ORDER BY invoice.issued_at,invoice.id ${scope?.all?sql``:sql`LIMIT 102`}`);
 return scope?.all?rows:bindInvoiceMailGroup(tx,tenantId,customerId,rows);
}
export class InvoiceMailListChanged extends Error{
 constructor(readonly number:string,readonly added:boolean){super('INVOICE_MAIL_LIST_CHANGED');}
}
export async function assertInvoiceMailCohort(tx:PrivilegedTenantTransaction,tenantId:string,group:{customerId:string;handover:string|null;native?:boolean;unreservedOnly?:boolean;snapshotIds?:readonly string[]},expected:readonly string[],prepared:readonly string[],resendIds:readonly string[]=[]){
 const current=await readInvoiceMailCohort(tx,tenantId,group.customerId,group.handover,resendIds,group.native,group.unreservedOnly,{snapshotIds:group.snapshotIds});
 const added=current.find(row=>!expected.includes(row.id)),removed=expected.find(id=>!current.some(row=>row.id===id));
 const unprepared=current.find(row=>expected.includes(row.id)&&!prepared.includes(row.id));
 if(added||unprepared)throw new InvoiceMailListChanged((added??unprepared)!.invoice_number,true);
 if(removed){const [invoice]=await tx.execute<{invoice_number:string}>(sql`SELECT invoice_number FROM public.invoices WHERE tenant_id=${tenantId} AND customer_id=${group.customerId} AND id=${removed}::uuid`);if(!invoice)throw Error('INVOICE_EXPECTED_LIST_INVALID');throw new InvoiceMailListChanged(invoice.invoice_number,false);}
 if(expected.length!==prepared.length)throw Error('INVOICE_EXPECTED_LIST_INVALID');
}

/** R2: the existing outgoing original is the authority for remainder recovery. */
export async function readInvoiceMailUnacknowledged(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string,invoiceIds:readonly string[]){
 if(!invoiceIds.length||new Set(invoiceIds).size!==invoiceIds.length)throw Error('INVOICE_MAIL_REQUEST_IDS_INVALID');
 const rows=await tx.execute<{id:string;acknowledged:boolean}>(sql`SELECT invoice.id::text,${invoiceAlreadySent(tenantId,sql`invoice.id`)} AS acknowledged FROM public.invoices invoice WHERE invoice.tenant_id=${tenantId} AND invoice.customer_id=${customerId} AND invoice.id::text=ANY(ARRAY[${sql.join(invoiceIds.map(id=>sql`${id}`),sql`, `)}]::text[])`);
 if(rows.length!==invoiceIds.length||rows.some(row=>typeof row.acknowledged!=='boolean'))throw Error('INVOICE_MAIL_REQUEST_ORIGINAL_SOURCE_INCOMPLETE');
 return invoiceIds.filter(id=>!rows.some(row=>row.id===id&&row.acknowledged));
}


/** KORR-S38a-2: cancellation settles an original's send obligation, never a
 * delivery ACK. Keep the independent unacknowledged reader unchanged. */
export async function readInvoiceMailOpenRemainder(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string,invoiceIds:readonly string[]){
 if(!invoiceIds.length||new Set(invoiceIds).size!==invoiceIds.length)throw Error('INVOICE_MAIL_REQUEST_IDS_INVALID');
 const rows=await tx.execute<{id:string;status:string;acknowledged:boolean;cancel_key:string|null}>(sql`SELECT invoice.id::text,invoice.status,${invoiceAlreadySent(tenantId,sql`invoice.id`)} AS acknowledged,
  (SELECT event.client_event_id::text FROM public.events event WHERE event.tenant_id=invoice.tenant_id AND event.event_type='INVOICE_CANCELLED_V1' AND event.status='success' AND event.payload->>'invoiceId'=invoice.id::text) AS cancel_key
  FROM public.invoices invoice WHERE invoice.tenant_id=${tenantId} AND invoice.customer_id=${customerId}
   AND invoice.id::text=ANY(ARRAY[${sql.join(invoiceIds.map(id=>sql`${id}`),sql`, `)}]::text[])`);
 if(rows.length!==invoiceIds.length||rows.some(row=>typeof row.acknowledged!=='boolean'||!['issued','cancelled'].includes(row.status)))throw Error('INVOICE_MAIL_REQUEST_ORIGINAL_SOURCE_INCOMPLETE');
 for(const row of rows){
  if(row.acknowledged||row.status==='issued')continue;
  if(!row.cancel_key)throw Error('INVOICE_MAIL_CANCELLATION_SOURCE_INCOMPLETE');
  // Read-only importers must not load the invoice PDF renderer before their auth gate.
  const {readCancellationInvoiceReceipts,mapInvoiceCancellationReceipt}=await import('./commands/immutableInvoiceCommand');
  const sources=await readCancellationInvoiceReceipts(tx,row.cancel_key,row.id);
  if(sources.length!==1)throw Error('INVOICE_MAIL_CANCELLATION_SOURCE_INCOMPLETE');
  const receipt=mapInvoiceCancellationReceipt(sources[0],tenantId,sources[0].actor_id);
  if(receipt.invoiceId!==row.id)throw Error('INVOICE_MAIL_CANCELLATION_SOURCE_CHANGED');
 }
 return invoiceIds.filter(id=>rows.some(row=>row.id===id&&row.status==='issued'&&!row.acknowledged));
}

function invoiceMailSnapshotKey(markerId:string){
 const bytes=createHash('sha256').update('invoice-mail-request-snapshot:'+markerId).digest();bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
 const h=bytes.subarray(0,16).toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export async function freezeInvoiceMailRequest(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{markerId:string;requestId:string;invoiceId:string;expectedIds:readonly string[];unreservedOnly:boolean}){
 await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('invoice-mail-remainder:'||${auth.tenantId}||':'||${input.requestId},0))`);
 const snapshotKey=invoiceMailSnapshotKey(input.markerId),eventId=snapshotKey+':snapshot';
 const read=()=>tx.execute<{actor:string;request_id:string;payload:{customerId:string;handover:string|null;native:boolean;invoiceIds:string[];anchorId:string}}>(sql`SELECT user_id::text AS actor,correlation_id::text AS request_id,payload FROM public.events WHERE tenant_id=${auth.tenantId} AND id=${eventId} AND event_type='INVOICE_MAIL_REQUEST_SNAPSHOT_V1' AND status='success' AND event_schema_version=1`);
 let rows=await read();
 if(!rows.length){
  const source=await tx.execute<{customer_id:string;order_id:string|null;handover_mode:string|null}>(sql`SELECT invoice.customer_id,invoice.order_id,orders.handover_mode FROM public.invoices invoice LEFT JOIN public.orders orders ON orders.tenant_id=invoice.tenant_id AND orders.id=invoice.order_id WHERE invoice.tenant_id=${auth.tenantId} AND invoice.id=${input.invoiceId}::uuid AND invoice.status='issued'`);
  if(source.length!==1)throw Error('INVOICE_MAIL_REQUEST_ANCHOR_INVALID');
  const anchor=source[0],native=anchor.order_id===null;
  // A separately qualified corrected-address resend retains its old PDF group;
  // it is never an open-invoice remainder request (K1/PL21:12).
  const resend=await qualifyInvoiceResend(tx,auth,input.invoiceId,anchor.customer_id);
  if(resend)return {customerId:anchor.customer_id,handover:anchor.handover_mode,native,invoiceIds:resend.originals.map(row=>row.id),anchorId:input.invoiceId,resend:true as const};
  const originals=await readInvoiceMailCohort(tx,auth.tenantId,anchor.customer_id,anchor.handover_mode,undefined,native,input.unreservedOnly,{all:true});
  const invoiceIds=originals.map(row=>row.id);
  if(!invoiceIds.length||input.expectedIds.some(id=>!invoiceIds.includes(id)))throw Error('INVOICE_MAIL_REQUEST_LIST_CHANGED');
  await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,payload,status,user_id,client_event_id,correlation_id,event_schema_version,created_at) VALUES(${eventId},${auth.tenantId},'INVOICE_MAIL_REQUEST_SNAPSHOT_V1',${DISPATCH_NOTICE_COPY.invoiceRequestSnapshot},${JSON.stringify({customerId:anchor.customer_id,handover:anchor.handover_mode,native,invoiceIds,anchorId:input.invoiceId})}::jsonb,'success',${auth.userId}::uuid,${snapshotKey}::uuid,${input.requestId}::uuid,1,statement_timestamp())`);
  rows=await read();
 }
 if(rows.length!==1||rows[0].actor!==auth.userId||rows[0].request_id!==input.requestId||rows[0].payload.anchorId!==input.invoiceId||!Array.isArray(rows[0].payload.invoiceIds)||!rows[0].payload.invoiceIds.length||rows[0].payload.invoiceIds.some(id=>typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))||new Set(rows[0].payload.invoiceIds).size!==rows[0].payload.invoiceIds.length)throw Error('INVOICE_MAIL_REQUEST_SNAPSHOT_INVALID');
 return rows[0].payload;
}

export async function readInvoiceMailRemainderFailure(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,markerId:string){
 const rows=await tx.execute<{customerId:string;actorId:string;requestId:string;threadId:string;reason:string}>(sql`SELECT thread.customer_id AS "customerId",marker.user_id::text AS "actorId",marker.correlation_id::text AS "requestId",thread.id::text AS "threadId",marker.payload->>'reason' AS reason
  FROM public.events marker JOIN public.communication_threads thread ON thread.tenant_id=marker.tenant_id AND thread.id::text=marker.payload->>'threadId' AND thread.source='MS_GRAPH_OUT:'||marker.correlation_id::text AND thread.status='sent'
  JOIN public.events prepared ON prepared.tenant_id=thread.tenant_id AND prepared.event_type='COMMUNICATION_DOCUMENT_PREPARED_V1' AND prepared.client_event_id=thread.id AND prepared.user_id=thread.created_by AND prepared.status='success' AND prepared.event_schema_version=1
  JOIN public.events sent ON sent.tenant_id=prepared.tenant_id AND sent.event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND sent.payload->>'threadId'=thread.id::text AND sent.payload->>'intent'=prepared.payload->>'intent' AND sent.payload->'document'=prepared.payload->'document' AND sent.status='success' AND sent.event_schema_version=1
  JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id AND message.direction='outgoing' AND message.channel='email' AND message.created_by=prepared.user_id
  WHERE marker.tenant_id=${auth.tenantId} AND marker.id=${markerId} AND marker.event_type='INVOICE_MAIL_REMAINDER_PENDING_V1' AND marker.status='success'
   AND marker.payload->>'customerId'=thread.customer_id AND prepared.payload->'document'->>'kind'='INVOICE'`);
 if(!rows.length){const marker=await tx.execute(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND id=${markerId} AND event_type='INVOICE_MAIL_REMAINDER_PENDING_V1'`);if(!marker.length)return null;}
 if(rows.length!==1||!rows[0].reason)throw Error('INVOICE_MAIL_REMAINDER_SOURCE_INVALID');
 const snapshots=await tx.execute<{payload:{invoiceIds:string[];customerId:string};actor:string;request_id:string}>(sql`SELECT payload,user_id::text AS actor,correlation_id::text AS request_id FROM public.events WHERE tenant_id=${auth.tenantId} AND id=${invoiceMailSnapshotKey(markerId)+':snapshot'} AND event_type='INVOICE_MAIL_REQUEST_SNAPSHOT_V1' AND status='success' AND event_schema_version=1`);
 if(snapshots.length!==1||snapshots[0].actor!==rows[0].actorId||snapshots[0].request_id!==rows[0].requestId||snapshots[0].payload.customerId!==rows[0].customerId||!Array.isArray(snapshots[0].payload.invoiceIds)||!snapshots[0].payload.invoiceIds.length)throw Error('INVOICE_MAIL_REMAINDER_SNAPSHOT_INVALID');
 const invoiceIds=snapshots[0].payload.invoiceIds;
 const remainder=await readInvoiceMailOpenRemainder(tx,auth.tenantId,rows[0].customerId,invoiceIds);
 return {...rows[0],pending:remainder.length>0};
}

export async function recordInvoiceMailRemainderFailure(auth:AuthorizationSnapshot,input:{markerId:string;requestId:string;threadId:string;customerId:string;reason:string},createTask:(tx:PrivilegedTenantTransaction,markerId:string)=>Promise<void>){
 return withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('invoice-mail-remainder:'||${auth.tenantId}||':'||${input.requestId},0))`);
  await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,payload,status,user_id,client_event_id,correlation_id,event_schema_version,created_at)
   VALUES(${input.markerId},${auth.tenantId},'INVOICE_MAIL_REMAINDER_PENDING_V1',${INVOICE_DELIVERY_COPY.remainderPending},${JSON.stringify({threadId:input.threadId,customerId:input.customerId,reason:input.reason})}::jsonb,'success',${auth.userId}::uuid,${input.markerId}::uuid,${input.requestId}::uuid,1,statement_timestamp()) ON CONFLICT(id) DO NOTHING`);
  const source=await readInvoiceMailRemainderFailure(tx,auth,input.markerId);
  if(!source||source.actorId!==auth.userId||source.customerId!==input.customerId||source.threadId!==input.threadId||source.requestId!==input.requestId)throw Error('INVOICE_MAIL_REMAINDER_SOURCE_CHANGED');
  try{await withTenantSavepoint(tx,savepoint=>createTask(savepoint,input.markerId));return true;}
  catch(error){console.error('[INVOICE_MAIL_REMAINDER_TASK_FAILED]',{name:error instanceof Error?error.name:'UnknownError'});return false;}
 });
}

/** PL21:12: one corrected-address resend of the same PDFs, qualified by the existing secured DSN reader. */
export async function qualifyInvoiceResend(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,invoiceId:string,customerId:string,actualRecipient?:string):Promise<InvoiceResendEvidence|null>{
 const sent=await tx.execute<{id:string;event_schema_version:number;payload:{threadId:string;document:CommunicationDocument;intent:string;bodySha256:string}}>(sql`SELECT sent.id::text,sent.event_schema_version,sent.payload FROM public.events sent WHERE sent.tenant_id=${auth.tenantId} AND sent.event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND sent.status='success' AND ${invoiceSentMembership(sql`${invoiceId}`)} ORDER BY sent.created_at DESC,sent.id DESC LIMIT 1`);
 if(!sent.length)return null;const latest=sent[0];if(latest.event_schema_version!==1)throw Error('INVOICE_RESEND_SCHEMA_INVALID');
 const sources=await tx.execute<{body:string;proof_ok:boolean}>(sql`SELECT message.body,(thread.status='sent' AND thread.customer_id=${customerId} AND prepared.status='success' AND prepared.event_schema_version=1 AND prepared.payload->'document'=${JSON.stringify(latest.payload.document)}::jsonb AND prepared.payload->>'intent'=${latest.payload.intent} AND prepared.payload->>'bodySha256'=${latest.payload.bodySha256} AND thread.created_by=prepared.user_id AND message.created_by=prepared.user_id) AS proof_ok FROM public.communication_threads thread LEFT JOIN public.events prepared ON prepared.tenant_id=thread.tenant_id AND prepared.event_type='COMMUNICATION_DOCUMENT_PREPARED_V1' AND prepared.payload->>'threadId'=thread.id::text LEFT JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id AND message.direction='outgoing' AND message.channel='email' WHERE thread.tenant_id=${auth.tenantId} AND thread.id::text=${latest.payload.threadId}`);
 if(sources.length!==1||!sources[0].proof_ok||createHash('sha256').update(sources[0].body).digest('hex')!==latest.payload.bodySha256)throw Error('INVOICE_RESEND_SENT_PROOF_INVALID');
 const failures=await readCommunicationDeliveryFailures(tx,auth,[latest.payload.threadId]);if(!failures.length)return null;
 const failure=failures.at(-1)!;
 const bounce=await tx.execute<{id:string}>(sql`SELECT id::text FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='COMMUNICATION_DELIVERY_FAILED_V1' AND status='success' AND event_schema_version=1 AND payload->>'itemId'=${failure.itemId} AND payload->>'threadId'=${failure.threadId}`);if(bounce.length!==1)throw Error('INVOICE_RESEND_BOUNCE_AMBIGUOUS');
 const [customer]=await tx.execute<{email:string|null}>(sql`SELECT email FROM public.customers WHERE tenant_id=${auth.tenantId} AND id=${customerId} FOR SHARE`);
 const recipient=customer?.email?.trim().toLowerCase();if(!recipient||recipient===failure.recipient.trim().toLowerCase()||actualRecipient!==undefined&&recipient!==actualRecipient)return null;
 const changes=await tx.execute<{id:string;email:string|null;after_bounce:boolean}>(sql`SELECT change.id::text,change.payload->'fields'->>'email' AS email,(change.created_at>(SELECT created_at FROM public.events WHERE tenant_id=${auth.tenantId} AND id=${bounce[0].id})) AS after_bounce FROM public.events change JOIN public.app_users actor ON actor.tenant_id=change.tenant_id AND actor.id::text=change.user_id::text WHERE change.tenant_id=${auth.tenantId} AND change.event_type IN ('CUSTOMER_CREATED_V1','CUSTOMER_UPDATED_V1') AND change.status='success' AND change.event_schema_version=1 AND change.payload->>'customerId'=${customerId} AND change.payload->'fields' ? 'email' AND change.created_at>=(SELECT created_at FROM public.events WHERE tenant_id=${auth.tenantId} AND id=${latest.id}) ORDER BY change.created_at,change.id LIMIT 1001`);
 if(changes.length>1000)throw Error('INVOICE_RESEND_CORRECTION_LIMIT');let previous=failure.recipient.trim().toLowerCase(),correction:string|null=null;
 for(const change of changes){const email=change.email?.trim().toLowerCase()??'';if(email!==previous){correction=change.after_bounce&&email===recipient?change.id:null;previous=email;}}
 if(!correction||previous!==recipient)return null;
 const reserved=await tx.execute(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type IN ('COMMUNICATION_DOCUMENT_PREPARED_V1','COMMUNICATION_DOCUMENT_SENT_V1') AND status='success' AND payload->'document'->'resend'->>'bounceEventId'=${bounce[0].id} LIMIT 1`);if(reserved.length)return null;
 const document=latest.payload.document;if(document.kind!=='INVOICE')throw Error('INVOICE_RESEND_SOURCE_KIND');const originals=[document,...document.bundle??[]].map(row=>({id:row.id,sha256:row.sha256}));
 if(!originals.some(row=>row.id===invoiceId)||new Set(originals.map(row=>row.id)).size!==originals.length||originals.some(row=>!/^([a-f0-9]{64})$/.test(row.sha256)))throw Error('INVOICE_RESEND_ORIGINALS_INVALID');
 const newest=await tx.execute<{id:string;sent_id:string}>(sql`SELECT DISTINCT ON (original.id) original.id,sent.id::text AS sent_id FROM jsonb_to_recordset(${JSON.stringify(originals)}::jsonb) AS original(id text,sha256 text) JOIN public.events sent ON sent.tenant_id=${auth.tenantId} AND sent.event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND sent.status='success' AND ${invoiceSentMembership(sql`original.id`)} ORDER BY original.id,sent.created_at DESC,sent.id DESC`);
 if(newest.length!==originals.length||newest.some(row=>row.sent_id!==latest.id))return null;
 return {bounceEventId:bounce[0].id,bounceItemId:failure.itemId,bouncedThreadId:failure.threadId,correctionEventId:correction,recipient,originals};
}

/** Read actual current document state; never rewrite the historical mail original. */
export async function obsoleteInvoiceMailMembers(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,document:Extract<CommunicationDocument,{kind:'INVOICE'}>){
 const obsolete:string[]=[];
 for(const invoice of [document,...document.bundle??[]]){
  const rows=await tx.execute<{status:string;version:number;sha256:string}>(sql`SELECT status,aggregate_version AS version,pdf_sha256 AS sha256 FROM public.invoices invoice WHERE tenant_id=${auth.tenantId} AND id=${invoice.id}::uuid AND ${invoiceMailSourceMatches(invoice)}`);
  if(rows.length!==1||rows[0].status!=='issued'||rows[0].version!==invoice.version||rows[0].sha256!==invoice.sha256)obsolete.push(invoice.id);
 }
 return obsolete;
}

/** The existing task writer accepts only this real, actor-bound mail source. */
export async function readCanceledInvoiceMailTaskSource(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{threadId:string;invoiceId:string}){
 if(!hasAuthorizationArea(auth,'preise'))return null;
 const rows=await tx.execute<{mail_event_id:string;invoice_id:string;invoice_number:string;cancellation_invoice_number:string|null;order_id:string|null;customer_id:string;customer_name:string;sent_at:string|null}>(sql`SELECT mail.payload->'sentItemsEvidence'->>'sentAt' AS sent_at,mail.id AS mail_event_id,invoice.id::text AS invoice_id,invoice.invoice_number,invoice.cancellation_invoice_number,invoice.order_id,invoice.customer_id,customer.name AS customer_name
  FROM public.events mail JOIN public.communication_threads thread ON thread.tenant_id=mail.tenant_id AND thread.id::text=mail.payload->>'threadId' AND thread.status='sent'
  JOIN public.communication_messages message ON message.tenant_id=mail.tenant_id AND message.thread_id=thread.id AND message.id::text=mail.payload->>'messageId' AND message.direction='outgoing'
  JOIN public.invoices invoice ON invoice.tenant_id=mail.tenant_id AND invoice.id=${input.invoiceId}::uuid AND invoice.customer_id=thread.customer_id AND invoice.status='cancelled'
  JOIN public.customers customer ON customer.tenant_id=invoice.tenant_id AND customer.id=invoice.customer_id
  WHERE mail.tenant_id=${auth.tenantId} AND mail.event_type='COMMUNICATION_MAIL_SENT_V1' AND mail.user_id=thread.created_by AND thread.id=${input.threadId}::uuid
   AND (mail.payload->'sentItemsEvidence'->>'clientRequestId'=mail.correlation_id::text OR mail.payload->>'graphAcceptedRequestId'=mail.correlation_id::text)
   AND (mail.payload->'documentReconciliation'->'originalDocument'->>'id'=invoice.id::text AND mail.payload->'documentReconciliation'->'originalDocument'->>'sha256'=invoice.pdf_sha256
    OR coalesce(mail.payload->'documentReconciliation'->'originalDocument'->'bundle','[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id',invoice.id::text,'sha256',invoice.pdf_sha256)))
   AND NOT EXISTS(SELECT 1 FROM public.events outcome WHERE outcome.tenant_id=mail.tenant_id AND outcome.event_type='COMMUNICATION_DOCUMENT_EFFECTS_APPLIED_V1' AND outcome.payload->>'threadId'=thread.id::text
    AND NOT(outcome.payload->'obsoleteInvoiceIds' @> jsonb_build_array(invoice.id::text)))
   AND EXISTS(SELECT 1 FROM public.events prepared WHERE prepared.tenant_id=mail.tenant_id AND prepared.event_type='COMMUNICATION_DOCUMENT_PREPARED_V1'
    AND prepared.correlation_id=mail.correlation_id AND prepared.user_id=mail.user_id AND prepared.payload->'document'=mail.payload->'documentReconciliation'->'originalDocument')`);
 if(rows.length!==1)return null;
 const row=rows[0];return {...row,reference:row.order_id===null?{type:'kunde' as const,id:row.customer_id}:{type:'auftrag' as const,id:row.order_id}};
}

/** Follow-up failure may not undo the already qualified outgoing mail. */
export async function applyRecoveredInvoiceMailEffects(auth:AuthorizationSnapshot,threadId:string,createTask:(tx:PrivilegedTenantTransaction,input:{threadId:string;invoiceId:string})=>Promise<string>,existingTx?:PrivilegedTenantTransaction){
 if(!hasAuthorizationArea(auth,'preise'))throw Error('COMMUNICATION_RECONCILIATION_FORBIDDEN');
 const work=async(tx:PrivilegedTenantTransaction)=>{
  const rows=await tx.execute<{id:string;prepare_actor_id:string;request_id:string;subject:string;body:string;original:Extract<CommunicationDocument,{kind:'INVOICE'}>;obsolete:string[];target_type:'CUSTOMER'|'ORDER';target_id:string}>(sql`SELECT mail.id,mail.user_id::text AS prepare_actor_id,mail.correlation_id::text AS request_id,thread.subject,message.body,
   mail.payload->'documentReconciliation'->'originalDocument' AS original,ARRAY[]::text[] AS obsolete,
   CASE WHEN thread.order_id IS NULL THEN 'CUSTOMER' ELSE 'ORDER' END AS target_type,coalesce(thread.order_id,thread.customer_id) AS target_id
   FROM public.events mail JOIN public.communication_threads thread ON thread.tenant_id=mail.tenant_id AND thread.id::text=mail.payload->>'threadId' AND thread.status='sent'
   JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id AND message.id::text=mail.payload->>'messageId'
   WHERE mail.tenant_id=${auth.tenantId} AND mail.event_type='COMMUNICATION_MAIL_SENT_V1' AND mail.status='success' AND mail.event_schema_version=1
    AND thread.created_by=mail.user_id AND message.created_by=mail.user_id
    AND thread.id=${threadId}::uuid AND mail.payload ? 'documentReconciliation'
    AND mail.payload->'documentReconciliation'->'originalDocument'->>'kind'='INVOICE'
    AND (mail.payload->'sentItemsEvidence'->>'clientRequestId'=mail.correlation_id::text OR mail.payload->>'graphAcceptedRequestId'=mail.correlation_id::text)
    AND EXISTS(SELECT 1 FROM public.events prepared WHERE prepared.tenant_id=mail.tenant_id AND prepared.event_type='COMMUNICATION_DOCUMENT_PREPARED_V1'
      AND prepared.correlation_id=mail.correlation_id AND prepared.user_id=mail.user_id AND prepared.payload->>'threadId'=thread.id::text
      AND prepared.payload->'document'=mail.payload->'documentReconciliation'->'originalDocument')`);
  if(!rows.length)return;if(rows.length!==1)throw Error('COMMUNICATION_RECONCILIATION_AMBIGUOUS');
  const row=rows[0];
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('mail-effects:'||${auth.tenantId}||':'||${threadId},0))`);
  const prior=await tx.execute(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='COMMUNICATION_DOCUMENT_EFFECTS_APPLIED_V1' AND payload->>'threadId'=${threadId}`);
  if(prior.length)return;
  try{await withTenantSavepoint(tx,async tx=>{
   if(!await lockInvoiceMailOrders(tx,auth.tenantId,[row.original,...row.original.bundle??[]]))throw Error('COMMUNICATION_RECONCILIATION_ORDER_SOURCE_MISSING');
   for(const id of [row.original.id,...row.original.bundle?.map(invoice=>invoice.id)??[]].sort())await tx.execute(sql`SELECT id FROM public.invoices WHERE tenant_id=${auth.tenantId} AND id=${id}::uuid FOR UPDATE`);
   const obsolete=await obsoleteInvoiceMailMembers(tx,auth,row.original),tasks:string[]=[];
   const all=[row.original,...row.original.bundle??[]],active=all.filter(invoice=>!obsolete.includes(invoice.id));
   if(active.length){
    const document:Extract<CommunicationDocument,{kind:'INVOICE'}>={...active[0],kind:'INVOICE',bundle:active.slice(1)};
    await appendCommunicationDocument(tx,auth,{targetType:row.target_type,targetId:row.target_id,clientRequestId:row.request_id,subject:row.subject,body:row.body},document,threadId,'sent',row.original,row.prepare_actor_id);
   }
   for(const invoice of all.filter(invoice=>obsolete.includes(invoice.id)))tasks.push(await createTask(tx,{threadId,invoiceId:invoice.id}));
   const outcome=await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,payload,status,user_id,client_event_id,correlation_id,event_schema_version)
    VALUES(${randomUUID()},${auth.tenantId},'COMMUNICATION_DOCUMENT_EFFECTS_APPLIED_V1','COMMUNICATION_DOCUMENT_EFFECTS_APPLIED_V1',${JSON.stringify({threadId,obsoleteInvoiceIds:obsolete,taskIds:tasks})}::jsonb,'success',${auth.userId}::uuid,${randomUUID()}::uuid,${row.request_id}::uuid,1) RETURNING id`);
   if(outcome.length!==1)throw Error('COMMUNICATION_DOCUMENT_EFFECTS_RECEIPT_MISSING');
  });}catch(error){
   console.error('[COMMUNICATION_DOCUMENT_FOLLOWUP_RETRY_REQUIRED]',{name:error instanceof Error?error.name:'UnknownError'});
   try{await withTenantSavepoint(tx,async tx=>{await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,payload,status,user_id,client_event_id,correlation_id,event_schema_version) VALUES(${randomUUID()},${auth.tenantId},'COMMUNICATION_DOCUMENT_EFFECT_RETRY_REQUIRED_V1','COMMUNICATION_DOCUMENT_EFFECT_RETRY_REQUIRED_V1',${JSON.stringify({threadId})}::jsonb,'success',${auth.userId}::uuid,${randomUUID()}::uuid,${row.request_id}::uuid,1)`);});}
   catch(markerError){console.error('[COMMUNICATION_RETRY_MARKER_FAILED]',{name:markerError instanceof Error?markerError.name:'UnknownError'});}
  }
 };
 return existingTx?work(existingTx):withPrivilegedTenantTransaction(auth,work);
}

export async function isCanceledInvoiceMailTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string){
 const rows=await tx.execute(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='COMMUNICATION_INVOICE_TASK_CREATED_V1' AND payload->>'taskId'=${id} LIMIT 1`);return rows.length>0;
}
export async function readCanceledInvoiceTaskCompletion(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string){
 if(!hasAuthorizationArea(auth,'preise'))return null;
 const rows=await tx.execute<{customer_name:string}>(sql`SELECT customer.name AS customer_name FROM public.events source
  JOIN public.invoices invoice ON invoice.tenant_id=source.tenant_id AND invoice.id::text=source.payload->>'invoiceId' AND invoice.status='cancelled'
  JOIN public.customers customer ON customer.tenant_id=invoice.tenant_id AND customer.id=invoice.customer_id
  WHERE source.tenant_id=${auth.tenantId} AND source.event_type='COMMUNICATION_INVOICE_TASK_CREATED_V1' AND source.status='success' AND source.payload->>'taskId'=${id}`);
 return rows.length===1?rows[0].customer_name:null;
}
export async function bindCanceledInvoiceMailTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{threadId:string;invoiceId:string;taskId:string;clientEventId:string}){
 const source=await readCanceledInvoiceMailTaskSource(tx,auth,input);if(!source)throw Error('COMMUNICATION_INVOICE_TASK_SOURCE_INVALID');
 const bound=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,correlation_id,event_schema_version)
  VALUES(${randomUUID()},${auth.tenantId},${source.order_id},'COMMUNICATION_INVOICE_TASK_CREATED_V1','COMMUNICATION_INVOICE_TASK_CREATED_V1',${JSON.stringify({taskId:input.taskId,invoiceId:source.invoice_id,mailEventId:source.mail_event_id})}::jsonb,'success',${auth.userId}::uuid,${input.clientEventId}::uuid,${source.mail_event_id}::uuid,1) RETURNING id`);
 if(bound.length!==1)throw Error('COMMUNICATION_INVOICE_TASK_SOURCE_NOT_SAVED');
}
