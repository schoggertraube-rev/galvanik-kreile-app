import 'server-only';
import {canonicalJson} from '@/lib/domain/canonicalJson';
import {createHash,randomUUID} from 'node:crypto';
import {sql,type SQL} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from './privilegedDb';
import {readCommunicationDeliveryFailures} from './communicationDeliveryPort';
import {appendOrderInformed} from './orderReleaseRead';
import {DISPATCH_NOTICE_COPY} from '@/ui/situationCatalog';

export type InvoiceResendEvidence={bounceEventId:string;bounceItemId:string;bouncedThreadId:string;correctionEventId:string;recipient:string;originals:Array<{id:string;sha256:string}>};
export type InvoiceMailDocument={resend?:InvoiceResendEvidence;id:string;number:string;version:number;sha256:string;orderId:string;orderNumber?:string};
export type CommunicationDocument={kind:'QUOTE';id:string;number:string;version:number;edition:number;sha256:string;source?:{itemId:string;graphMessageId:string}}|InvoiceMailDocument&{kind:'INVOICE';bundle?:InvoiceMailDocument[];source?:never};
type Intent={targetType:'CUSTOMER'|'ORDER';targetId:string;clientRequestId:string;subject:string;body:string};
export function communicationDocumentBody(body:string,document:CommunicationDocument,legacy=false){
 if(document.kind!=='INVOICE'||!document.bundle?.length)return body.trim();
 const orders=[document,...document.bundle].map(doc=>doc.orderNumber);if(orders.some(number=>!number))throw Error('INVOICE_BUNDLE_ORDER_NUMBER_MISSING');
 const prefix=(legacy?DISPATCH_NOTICE_COPY.legacyCollective(orders as string[]):DISPATCH_NOTICE_COPY.collective(orders as string[]))+'\n\n';
 return body.trim().startsWith(prefix)?body.trim():prefix+body.trim();
}
export function communicationDocumentIntent(input:Intent,document:CommunicationDocument,legacy=false){return createHash('sha256').update(JSON.stringify({targetType:input.targetType,targetId:input.targetId,subject:input.subject.trim(),body:communicationDocumentBody(input.body,document,legacy),document:{kind:document.kind,id:document.id,number:document.number,version:document.version,...(document.kind==='QUOTE'?{edition:document.edition}:{orderId:document.orderId,...(document.resend?{resend:JSON.parse(canonicalJson(document.resend))}:{}),...(document.bundle?.length?{orderNumber:document.orderNumber,bundle:document.bundle.map(doc=>({id:doc.id,orderId:doc.orderId,orderNumber:doc.orderNumber,number:doc.number,version:doc.version,sha256:doc.sha256}))}:{})}),sha256:document.sha256,...(document.source?{source:{itemId:document.source.itemId,graphMessageId:document.source.graphMessageId}}:{})}})).digest('hex');}
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
  const rows=await tx.execute<{id:string;status:string;customer_id:string;order_id:string|null;created_at:string;created_by:string;prepared_by:string;subject:string;request_id:string;payload:{document:CommunicationDocument;intent:string};message_id:string|null;body:string|null;sent_intent:string|null}>(sql`
   SELECT thread.id::text,thread.status,thread.customer_id,thread.order_id,thread.created_at::text,thread.created_by::text,prepared.user_id::text AS prepared_by,thread.subject,prepared.correlation_id::text AS request_id,prepared.payload,
    message.id::text AS message_id,message.body,sent.payload->>'intent' AS sent_intent
   FROM public.communication_threads thread
   LEFT JOIN public.events prepared ON prepared.tenant_id=thread.tenant_id AND prepared.event_type='COMMUNICATION_DOCUMENT_PREPARED_V1' AND prepared.client_event_id=thread.id
   LEFT JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id AND message.direction='outgoing'
   LEFT JOIN public.events sent ON sent.tenant_id=thread.tenant_id AND sent.event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND sent.payload->>'threadId'=thread.id::text
   WHERE thread.tenant_id=${auth.tenantId} AND (thread.source=${'MS_GRAPH_OUT:'+input.clientRequestId}
    OR thread.source LIKE 'MS_GRAPH_OUT:%' AND thread.status IN('pending','failed') AND thread.created_by=${auth.userId}::uuid
     AND prepared.payload->'document'->>'id'=${documentId} AND (thread.order_id=${input.targetType==='ORDER'?input.targetId:null} OR ${input.targetType==='CUSTOMER'} AND thread.order_id IS NULL AND thread.customer_id=${input.targetId})) LIMIT 2`);
  if(!rows.length)return {code:'NOT_FOUND' as const,message:'Noch kein Versandbeleg.'};
  const row=rows[0],document=row.payload?.document;
  const legacy=!!document&&document.kind==='INVOICE'&&!!document.bundle?.length&&row.payload.intent===communicationDocumentIntent(input,document,true);
  if(rows.length!==1||row.created_by!==auth.userId||row.prepared_by!==auth.userId||!document||document.id!==documentId||row.order_id!==(input.targetType==='ORDER'?input.targetId:null)||input.targetType==='CUSTOMER'&&row.customer_id!==input.targetId||row.payload.intent!==communicationDocumentIntent(input,document,legacy))return {code:'CONFLICT' as const,message:'Die Versandkennung ist bereits anders belegt. Kein zweiter Versand.'};
  if(row.status!=='sent'&&!/^[0-9a-f-]{36}$/i.test(row.request_id))return {code:'CONFLICT' as const,message:'Die Versandkennung ist bereits anders belegt. Kein zweiter Versand.'};
  if(row.status!=='sent')return {code:'PENDING' as const,document,originalRequestId:row.request_id};
  if(!row.message_id||row.sent_intent!==row.payload.intent||row.body!==communicationDocumentBody(input.body,document,legacy)||row.subject!==input.subject.trim())throw Error('COMMUNICATION_DOCUMENT_PROOF_INVALID');
  return {code:'OK' as const,document,data:{threadId:row.id,messageId:row.message_id,customerId:row.customer_id,orderId:row.order_id,recordedAt:row.created_at,replayed:true}};
 });}catch(error){console.error('[COMMUNICATION_DOCUMENT_RECEIPT_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'Versandbeleg konnte nicht sicher gelesen werden. Nicht erneut senden.'};}
}

/** PL00:40: transport reconciliation uses the original PREPARE authority.
 * Bytes stay server-side; this does not grant access to the invoice PDF viewer. */
export async function readPreparedInvoiceTransportOriginal(auth:AuthorizationSnapshot,input:Intent,document:Extract<CommunicationDocument,{kind:'INVOICE'}>,invoice:InvoiceMailDocument){
 if(!hasAuthorizationArea(auth,'mails'))return null;
 return withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<{pdf_content:Buffer|Uint8Array;integrity_ok:boolean}>(sql`SELECT invoice.pdf_content,encode(sha256(invoice.pdf_content),'hex')=invoice.pdf_sha256 AS integrity_ok
   FROM public.invoices invoice WHERE invoice.tenant_id=${auth.tenantId} AND invoice.id=${invoice.id}::uuid AND invoice.order_id=${invoice.orderId} AND invoice.pdf_sha256=${invoice.sha256}
    AND EXISTS(SELECT 1 FROM public.events prepared JOIN public.communication_threads thread ON thread.tenant_id=prepared.tenant_id AND thread.id::text=prepared.payload->>'threadId'
     WHERE prepared.tenant_id=invoice.tenant_id AND prepared.event_type='COMMUNICATION_DOCUMENT_PREPARED_V1' AND prepared.user_id=${auth.userId}::uuid AND thread.created_by=${auth.userId}::uuid
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
function invoiceMailUnresolved(tenantId:string,invoiceId:SQL){
 return sql`EXISTS(SELECT 1 FROM public.events sent
  LEFT JOIN public.communication_threads thread ON thread.tenant_id=sent.tenant_id AND thread.id::text=sent.payload->>'threadId'
  WHERE sent.tenant_id=${tenantId} AND sent.event_type='COMMUNICATION_DOCUMENT_PREPARED_V1' AND sent.status='success'
   AND ${invoiceSentMembership(invoiceId)}
   AND (thread.status IS DISTINCT FROM 'sent' OR NOT EXISTS(SELECT 1 FROM public.events completed
    WHERE completed.tenant_id=sent.tenant_id AND completed.event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND completed.status='success'
     AND completed.user_id=sent.user_id AND completed.payload->>'threadId'=sent.payload->>'threadId'
     AND completed.payload->'document'=sent.payload->'document' AND completed.payload->>'intent'=sent.payload->>'intent')))`;
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

export async function readInvoiceMailCohort(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string,handover:string|null,resendIds:readonly string[]=[]){
 return tx.execute<{id:string;order_id:string;order_number:string;invoice_number:string;aggregate_version:number}>(sql`SELECT invoice.id::text,invoice.order_id,orders.order_number,invoice.invoice_number,invoice.aggregate_version FROM public.invoices invoice
  JOIN public.orders orders ON orders.tenant_id=invoice.tenant_id AND orders.id=invoice.order_id
  JOIN private.v_order_freeze_state_v1 frozen ON frozen.tenant_id=orders.tenant_id AND frozen.order_id=orders.id AND frozen.active AND frozen.integrity_ok
  WHERE invoice.tenant_id=${tenantId} AND invoice.customer_id=${customerId} AND invoice.status='issued' AND invoice.contract_version=1
   AND NOT ${invoiceMailUnresolved(tenantId,sql`invoice.id`)}
   AND (NOT ${invoiceAlreadySent(tenantId,sql`invoice.id`)} OR invoice.id::text=ANY(ARRAY[${sql.join(resendIds.map(id=>sql`${id}`),sql`, `)}]::text[])) AND orders.station='fertig' AND orders.current_station='fertig' AND orders.current_station_id='fertig' AND orders.status='fertig' AND orders.handover_mode=${handover}
  ORDER BY orders.order_number,invoice.id LIMIT 102`);
}
export class InvoiceMailListChanged extends Error{
 constructor(readonly number:string,readonly added:boolean){super('INVOICE_MAIL_LIST_CHANGED');}
}
export async function assertInvoiceMailCohort(tx:PrivilegedTenantTransaction,tenantId:string,group:{customerId:string;handover:string|null},expected:readonly string[],prepared:readonly string[],resendIds:readonly string[]=[]){
 const current=await readInvoiceMailCohort(tx,tenantId,group.customerId,group.handover,resendIds);
 const added=current.find(row=>!expected.includes(row.id)),removed=expected.find(id=>!current.some(row=>row.id===id));
 const unprepared=current.find(row=>expected.includes(row.id)&&!prepared.includes(row.id));
 if(added||unprepared)throw new InvoiceMailListChanged((added??unprepared)!.invoice_number,true);
 if(removed){const [invoice]=await tx.execute<{invoice_number:string}>(sql`SELECT invoice_number FROM public.invoices WHERE tenant_id=${tenantId} AND customer_id=${group.customerId} AND id=${removed}::uuid`);if(!invoice)throw Error('INVOICE_EXPECTED_LIST_INVALID');throw new InvoiceMailListChanged(invoice.invoice_number,false);}
 if(expected.length!==prepared.length)throw Error('INVOICE_EXPECTED_LIST_INVALID');
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
