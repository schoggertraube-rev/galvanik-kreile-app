import 'server-only';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {canonicalJson} from '@/lib/domain/canonicalJson';
import {isDeliveryNoteInput,type DeliveryNoteInput,type DeliveryNoteReceipt,type DeliveryNoteResult} from '@/lib/domain/deliveryNoteContract';
import type {PaidDeliveryNoteSnapshot} from '@/lib/pdf/DeliveryNote';
import {DELIVERY_NOTE_COPY as copy,LEGACY_ACTION_ACCESS_COPY} from '@/ui/situationCatalog';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from './privilegedDb';
import {readOrderPaymentSummaries,mapPaymentSummaryRow} from './paymentContract';
import {readCreateInvoiceReceipts,mapInvoiceIssueReceipt} from './commands/immutableInvoiceCommand';
import {readExistingDomainAttachment,readStableDomainAttachment,storeDomainAttachmentBytes,DomainAttachmentStorageError} from './domainAttachmentStorage';
import type {InvoiceVatReader} from '@/modules/accounting/public';
import type {CompanyLetterSettings} from '@/modules/fundament/public';
import type {CustomerStoredProfile} from '@/modules/customers/public';

type Ports={readVat:InvoiceVatReader;readCompany:()=>Promise<{code:string;company?:CompanyLetterSettings}>;readCustomer:(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string)=>Promise<CustomerStoredProfile|null>;render:(snapshot:PaidDeliveryNoteSnapshot)=>Promise<Uint8Array>};
type Order={id:string;customer_id:string;order_number:string;version:number;title:string};
type Original={id:string;sourceHash:string;snapshot:PaidDeliveryNoteSnapshot;pdfBase64:string;pdfSha256:string;actorId:string};
type Source=Omit<PaidDeliveryNoteSnapshot,'createdAt'>;
type Stored={id:string;user_id:string;payload:{sourceHash:string;storagePath:string;fileBytes:number;pdfSha256:string;version:number;orderIds:string[];snapshot:PaidDeliveryNoteSnapshot}};
const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
function uuid(value:string){const h=sha(value).slice(0,32);return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20);}
const fail=(code:Exclude<DeliveryNoteResult,{code:'OK'}>['code'],message:string):DeliveryNoteResult=>({code,message});
function sourceOf(snapshot:PaidDeliveryNoteSnapshot):Source{const {createdAt,...source}=snapshot;void createdAt;return source;}
function parseOriginal(bytes:Uint8Array,expectedId:string,expectedHash:string):Original{
 const value=JSON.parse(Buffer.from(bytes).toString('utf8')) as Original;
 if(!value||value.id!==expectedId||value.sourceHash!==expectedHash||sha(canonicalJson(sourceOf(value.snapshot)))!==expectedHash
  ||typeof value.actorId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.actorId)||!Number.isFinite(Date.parse(value.snapshot.createdAt)))throw Error('DELIVERY_NOTE_ORIGINAL_INVALID');
 const pdf=Buffer.from(value.pdfBase64,'base64');
 if(pdf.toString('base64')!==value.pdfBase64||pdf.subarray(0,5).toString()!=='%PDF-'||sha(pdf)!==value.pdfSha256)throw Error('DELIVERY_NOTE_PDF_INVALID');
 return value;
}

async function readSource(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,ids:string[],ports:Ports):Promise<Source|null>{
 const orders=await tx.execute<Order>(sql`SELECT id,customer_id,order_number,version,title FROM public.orders WHERE tenant_id=${auth.tenantId} AND id IN (${sql.join(ids.map(id=>sql`${id}`),sql`,`)}) ORDER BY id FOR SHARE`);
 if(orders.length!==ids.length||orders.some(row=>row.customer_id!==orders[0].customer_id))return null;
 const company=await ports.readCompany();if(company.code!=='OK'||!company.company)return null;
 const customer=await ports.readCustomer(tx,auth.tenantId,orders[0].customer_id);
 if(!customer||[customer.name,customer.street,customer.houseNumber,customer.zipCode,customer.city,customer.country].some(value=>typeof value!=='string'||!value.trim()))return null;
 const result:Source={schemaVersion:1,company:company.company,customer:{id:orders[0].customer_id,name:customer.companyName??customer.name,street:[customer.street,customer.houseNumber].join(' '),zip:customer.zipCode!,city:customer.city!,country:customer.country!},orders:[]};
 for(const order of orders){
  const rows=await readOrderPaymentSummaries(tx,auth.tenantId,order.id);
  if(!rows.length||rows.filter(row=>row.belegart==='auftrag').length!==1)return null;
  const payments=rows.map(row=>mapPaymentSummaryRow(row,auth));
  if(payments.some(row=>row.status!=='bezahlt'||row.openAmountCents!==0||!row.eventId||!row.receiptId||!row.paidAt))return null;
  const originals=await readCreateInvoiceReceipts(tx,{orderId:order.id});
  const sources=payments.map(payment=>{
   const original=originals.filter(row=>row.invoice_id===payment.invoiceId);
   if(original.length!==1)throw Error('DELIVERY_NOTE_INVOICE_SOURCE_MISSING');
   const receipt=mapInvoiceIssueReceipt(original[0],auth.tenantId,original[0].actor_id,ports.readVat);
   return {row:original[0],receipt,payment};
  });
  const main=sources.find(row=>rows.find(payment=>payment.invoice_id===row.receipt.invoiceId)?.belegart==='auftrag');
  if(!main)throw Error('DELIVERY_NOTE_MAIN_INVOICE_MISSING');
  const snapshot=main.row.snapshot as {lines?:Array<Record<string,unknown>>};
  if(!Array.isArray(snapshot.lines))throw Error('DELIVERY_NOTE_PARTS_MISSING');
  const parts=snapshot.lines.filter(line=>line.type==='BASE').map(line=>{
   if(typeof line.itemId!=='string'||typeof line.name!=='string'||!line.name.trim()||typeof line.quantity!=='number'||!Number.isFinite(line.quantity)||line.quantity<=0)throw Error('DELIVERY_NOTE_PART_INVALID');
   return {itemId:line.itemId,name:line.name,quantity:line.quantity};
  });
  if(!parts.length)throw Error('DELIVERY_NOTE_PARTS_MISSING');
  result.orders.push({id:order.id,number:order.order_number,version:order.version,title:order.title,parts,payments:sources.map(({receipt,payment})=>({invoiceId:receipt.invoiceId,invoiceNumber:receipt.invoiceNumber,invoiceEventId:receipt.eventId,invoiceSha256:receipt.pdfSha256,paymentEventId:payment.eventId!,paymentReceiptId:payment.receiptId!,paymentVersion:payment.paymentVersion,amountCents:payment.paidAmountCents,paidAt:payment.paidAt!}))});
 }
 return result;
}

/** One existing PDF action composes canonical sources and the private original
 * store. The JSON envelope is one object containing the actual PDF bytes, so a
 * failed DB commit cannot force a retry to regenerate or replace an original. */
export async function generatePaidDeliveryNote(auth:AuthorizationSnapshot,input:DeliveryNoteInput|string|string[],ports:Ports):Promise<DeliveryNoteResult>{
 if(!auth.active||!hasAuthorizationArea(auth,'auftraege')||!hasAuthorizationArea(auth,'geld'))return fail('FORBIDDEN',LEGACY_ACTION_ACCESS_COPY.forbidden);
 const legacy=typeof input==='string'||Array.isArray(input);
 if(!legacy&&!isDeliveryNoteInput(input))return fail('VALIDATION_ERROR',copy.invalid);
 const ids=legacy?(typeof input==='string'?[input]:input):input.orderIds;
 if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string'||!id.trim()||id!==id.trim()||id.length>128)||new Set(ids).size!==ids.length||!legacy&&!isDeliveryNoteInput(input))return fail('VALIDATION_ERROR',copy.invalid);
 const selected=[...ids].sort();
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${auth.tenantId+':delivery-note:'+canonicalJson(selected)},0))`);
  async function fromRequest(key:string):Promise<DeliveryNoteResult|null>{
   const found=await tx.execute<{id:string;user_id:string;event_type:string;status:string;event_schema_version:number;payload:{orderIds:string[];receipt:DeliveryNoteReceipt}}>(sql`SELECT id,user_id::text,event_type,status,event_schema_version,payload FROM public.events WHERE tenant_id=${auth.tenantId} AND client_event_id=${key}::uuid`);
   if(!found.length)return null;
   const row=found[0];if(found.length!==1||row.user_id!==auth.userId||row.event_type!=='DELIVERY_NOTE_REQUESTED_V1'||row.status!=='success'||row.event_schema_version!==1||canonicalJson(row.payload.orderIds)!==canonicalJson(selected)||canonicalJson(row.payload.receipt.orderIds)!==canonicalJson(selected)||row.payload.receipt.actorId!==auth.userId||row.payload.receipt.clientEventId!==key||row.payload.receipt.eventId!==row.id
    ||!legacy&&canonicalJson((row.payload as {expectedVersions?:unknown}).expectedVersions)!==canonicalJson(input.expectedVersions))return fail('CONFLICT',copy.changed);
   return load(row.payload.receipt,true);
  }
  async function load(receipt:DeliveryNoteReceipt,replayed:boolean):Promise<DeliveryNoteResult>{
   const rows=await tx.execute<Stored>(sql`SELECT id,user_id::text,payload FROM public.events WHERE tenant_id=${auth.tenantId} AND id=${receipt.originalEventId} AND event_type='DELIVERY_NOTE_ORIGINAL_V1' AND status='success' AND event_schema_version=1`);
   if(rows.length!==1)throw Error('DELIVERY_NOTE_ORIGINAL_NOT_RECORDED');
   const row=rows[0],p=row.payload;
   if(p.storagePath!==receipt.storagePath||p.pdfSha256!==receipt.pdfSha256||p.version!==receipt.version||canonicalJson(p.orderIds)!==canonicalJson(selected))throw Error('DELIVERY_NOTE_RECEIPT_MISMATCH');
   const stored=await readStableDomainAttachment(p.storagePath,{fileBytes:p.fileBytes,mimeType:'application/json'});
   const document=parseOriginal(stored.bytes,row.id,p.sourceHash);
   if(document.pdfSha256!==receipt.pdfSha256||document.actorId!==row.user_id||canonicalJson(document.snapshot)!==canonicalJson(p.snapshot)||canonicalJson(document.snapshot.orders.map(order=>order.id))!==canonicalJson(selected))throw Error('DELIVERY_NOTE_STORED_PROOF_MISMATCH');
   return {code:'OK',receipt,pdfBase64:document.pdfBase64,replayed};
  }
  if(!legacy){const prior=await fromRequest(input.clientEventId);if(prior)return prior;}
  const source=await readSource(tx,auth,selected,ports);if(!source)return fail('VALIDATION_ERROR',copy.sourceMissing);
  if(!legacy&&source.orders.some(row=>row.version!==input.expectedVersions[row.id]))return fail('CONFLICT',copy.changed);
  const sourceHash=sha(canonicalJson(source)),key=legacy?uuid('delivery-request:'+auth.tenantId+':'+auth.userId+':'+sourceHash):input.clientEventId;
  if(legacy){const prior=await fromRequest(key);if(prior)return prior;}
  const originalId=uuid('delivery-original:'+auth.tenantId+':'+sourceHash),storagePath='domain-attachments/v1/'+originalId+'.json';
  const existing=await tx.execute<Stored>(sql`SELECT id,user_id::text,payload FROM public.events WHERE tenant_id=${auth.tenantId} AND id=${originalId} AND event_type='DELIVERY_NOTE_ORIGINAL_V1' AND status='success'`);
  let document:Original,fileBytes:number,version:number;
  if(existing.length){
   if(existing.length!==1||existing[0].payload.sourceHash!==sourceHash||existing[0].payload.storagePath!==storagePath)throw Error('DELIVERY_NOTE_ORIGINAL_COLLISION');
   const row=existing[0];const stored=await readStableDomainAttachment(storagePath,{fileBytes:row.payload.fileBytes,mimeType:'application/json'});
   document=parseOriginal(stored.bytes,originalId,sourceHash);fileBytes=stored.bytes.byteLength;version=row.payload.version;
   if(document.actorId!==row.user_id||document.pdfSha256!==row.payload.pdfSha256)throw Error('DELIVERY_NOTE_ORIGINAL_CHANGED');
  }else{
   try{const stored=await readExistingDomainAttachment(storagePath);if(stored.info.contentType!=='application/json')throw Error('DELIVERY_NOTE_ORIGINAL_TYPE');document=parseOriginal(stored.bytes,originalId,sourceHash);fileBytes=stored.bytes.byteLength;}
   catch(error){
    if(!(error instanceof DomainAttachmentStorageError)||error.kind!=='NOT_READY')throw error;
    const clock=await tx.execute<{at:string}>(sql`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at`);
    if(clock.length!==1||!Number.isFinite(Date.parse(clock[0].at)))throw Error('DELIVERY_NOTE_CLOCK_MISSING');
    const snapshot:PaidDeliveryNoteSnapshot={...source,createdAt:clock[0].at},pdf=await ports.render(snapshot);
    if(Buffer.from(pdf).subarray(0,5).toString()!=='%PDF-')throw Error('DELIVERY_NOTE_RENDER_INVALID');
    document={id:originalId,sourceHash,snapshot,pdfBase64:Buffer.from(pdf).toString('base64'),pdfSha256:sha(pdf),actorId:auth.userId};
    const bytes=Buffer.from(canonicalJson(document));await storeDomainAttachmentBytes(storagePath,bytes,'application/json');fileBytes=bytes.byteLength;
   }
   const revisions=await tx.execute<{n:number}>(sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='DELIVERY_NOTE_ORIGINAL_V1' AND payload->'orderIds'=${JSON.stringify(selected)}::jsonb`);
   if(revisions.length!==1)throw Error('DELIVERY_NOTE_VERSION_MISSING');version=revisions[0].n+1;
   // This is historical source qualification, not a grant: a retained original
   // may have been created by a colleague before a failed SQL commit.
   const actors=await tx.execute<{id:string}>(sql`SELECT id::text FROM public.app_users WHERE tenant_id=${auth.tenantId} AND id=${document.actorId}::uuid`);
   if(actors.length!==1||actors[0].id!==document.actorId)throw Error('DELIVERY_NOTE_ORIGINAL_ACTOR_INVALID');
   const written=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,payload,status,client_event_id,event_schema_version,aggregate_version)
    VALUES(${originalId},${auth.tenantId},${selected[0]},'DELIVERY_NOTE_ORIGINAL_V1',${copy.title},${document.actorId}::uuid,${JSON.stringify({sourceHash,storagePath,fileBytes,pdfSha256:document.pdfSha256,version,orderIds:selected,snapshot:document.snapshot})}::jsonb,'success',${originalId}::uuid,1,${version}) RETURNING id`);
   if(written.length!==1||written[0].id!==originalId)throw Error('DELIVERY_NOTE_ORIGINAL_NOT_SAVED');
  }
  const eventId=uuid('delivery-request-event:'+auth.tenantId+':'+key),receipt:DeliveryNoteReceipt={eventId,originalEventId:originalId,clientEventId:key,actorId:auth.userId,version,orderIds:selected,pdfSha256:document.pdfSha256,storagePath};
  const requested=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,payload,status,client_event_id,event_schema_version,aggregate_version)
   VALUES(${eventId},${auth.tenantId},${selected[0]},'DELIVERY_NOTE_REQUESTED_V1',${copy.title},${auth.userId}::uuid,${JSON.stringify({orderIds:selected,expectedVersions:legacy?null:input.expectedVersions,receipt})}::jsonb,'success',${key}::uuid,1,${version}) RETURNING id`);
  if(requested.length!==1||requested[0].id!==eventId)throw Error('DELIVERY_NOTE_REQUEST_NOT_SAVED');
  const proof=await fromRequest(key);if(!proof||proof.code!=='OK')throw Error('DELIVERY_NOTE_READBACK_FAILED');
  return {...proof,replayed:existing.length===1};
 });}catch(error){console.error('[DELIVERY_NOTE_GENERATION_FAILED]',{name:error instanceof Error?error.name:'UnknownError',code:error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:'UNAVAILABLE'});return fail('UNAVAILABLE',copy.unavailable);}
}
