import 'server-only';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {canonicalJson} from '@/lib/domain/canonicalJson';
import {isDeliveryNoteInput,type DeliveryNoteInput,type DeliveryNoteReceipt,type DeliveryNoteResult,type DeliveryNoteSourceRead,type DeliveryNoteSourceReference} from '@/lib/domain/deliveryNoteContract';
import type {PaidDeliveryNoteSnapshot} from '@/lib/pdf/DeliveryNote';
import {DELIVERY_NOTE_COPY as copy,DELIVERY_NOTE_SOURCE_COPY as sourceCopy,LEGACY_ACTION_ACCESS_COPY,MANUAL_SHIPPING_FIELDS,SITUATION_COPY} from '@/ui/situationCatalog';
import {V45_RUNTIME} from '@/ui/v45.generated';
import {hasAuthorizationArea} from "@/lib/auth/authorizationContract";
import {type AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from './privilegedDb';
import {readOrderPaymentSummaries,mapPaymentSummaryEvidenceRow} from './paymentContract';
import {readCreateInvoiceReceipts,mapInvoiceIssueReceipt} from './commands/immutableInvoiceCommand';
import {readExistingDomainAttachment,readStableDomainAttachment,storeDomainAttachmentBytes,DomainAttachmentStorageError} from './domainAttachmentStorage';
import type {InvoiceVatReader} from '@/modules/accounting/public';
import type {CompanyLetterSettings} from '@/modules/fundament/public';
import {readLiveOrderCard} from './orderCardRead';
import type {CustomerStoredProfile} from '@/modules/customers/public';

type Ports={readVat:InvoiceVatReader;readCompany:()=>Promise<{code:string;company?:CompanyLetterSettings;missingFields?:readonly string[]}>;readCustomer:(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string)=>Promise<CustomerStoredProfile|null>;render:(snapshot:PaidDeliveryNoteSnapshot)=>Promise<Uint8Array>};
type SourcePorts=Omit<Ports,'render'>;
type Order={id:string;customer_id:string;order_number:string;version:number};
type Original={id:string;sourceHash:string;snapshot:PaidDeliveryNoteSnapshot;pdfBase64:string;pdfSha256:string;actorId:string};
type Source=Omit<PaidDeliveryNoteSnapshot,'createdAt'>;
type Stored={id:string;user_id:string;payload:{sourceHash:string;storagePath:string;fileBytes:number;pdfSha256:string;version:number;orderIds:string[];snapshot:PaidDeliveryNoteSnapshot}};
const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
function uuid(value:string){const h=sha(value).slice(0,32);return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20);}
const fail=(code:Exclude<DeliveryNoteResult,{code:'OK'}>['code'],message:string):DeliveryNoteResult=>({code,message});
class DeliveryNoteSourceRejected extends Error{
 constructor(readonly result:Exclude<DeliveryNoteResult,{code:'OK'}>){super('DELIVERY_NOTE_SOURCE_REJECTED');}
}
const serverMessage=V45_RUNTIME.texte['error.server'].text.replace('{gegenstand}',copy.title).replace('{ausweg}',SITUATION_COPY.retry);
function sourceOf(snapshot:PaidDeliveryNoteSnapshot):Source{const {createdAt,...source}=snapshot;void createdAt;return source;}
// Version is concurrency metadata, never a printed delivery-note fact. Legacy
// version-1 originals retain their original byte/hash contract unchanged.
function sourceHashOf(source:Source):string{return sha(canonicalJson(source.schemaVersion===1?source:{...source,orders:source.orders.map(({version,...facts})=>{void version;return facts;})}));}
function references(source:Source):Record<string,DeliveryNoteSourceReference>{
 return Object.fromEntries(source.orders.map(order=>[order.id,{paymentHash:order.paymentSourceHash!,contentHash:sha(canonicalJson({company:source.company,customer:source.customer,id:order.id,number:order.number,title:order.title,parts:order.parts,...(source.vorab?{vorab:source.vorab}:{})}))}]));
}
function parseOriginal(bytes:Uint8Array,expectedId:string,expectedHash:string):Original{
 const value=JSON.parse(Buffer.from(bytes).toString('utf8')) as Original;
 if(!value||value.id!==expectedId||value.sourceHash!==expectedHash||sourceHashOf(sourceOf(value.snapshot))!==expectedHash
  ||typeof value.actorId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.actorId)||!Number.isFinite(Date.parse(value.snapshot.createdAt)))throw Error('DELIVERY_NOTE_ORIGINAL_INVALID');
 const pdf=Buffer.from(value.pdfBase64,'base64');
 if(pdf.toString('base64')!==value.pdfBase64||pdf.subarray(0,5).toString()!=='%PDF-'||sha(pdf)!==value.pdfSha256)throw Error('DELIVERY_NOTE_PDF_INVALID');
 return value;
}

async function readSource(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,ids:string[],ports:SourcePorts,expected?:Record<string,DeliveryNoteSourceReference>):Promise<Source|null>{
 const orderIds=sql.join(ids.map(id=>sql`${id}`),sql`, `);
 const orders=await tx.execute<Order>(sql`SELECT id,customer_id,order_number,version FROM public.orders
  WHERE tenant_id=${auth.tenantId} AND id IN (${orderIds}) ORDER BY id FOR SHARE`);
 if(orders.length!==ids.length)throw new DeliveryNoteSourceRejected({code:'NOT_FOUND',message:copy.invalid});
 if(orders.some(row=>row.customer_id!==orders[0].customer_id))throw new DeliveryNoteSourceRejected({code:'VALIDATION_ERROR',message:sourceCopy.mixedCustomers});
 // Zahlungsbuchungen sperren denselben Auftrag vor dem Schreiben.
 const releaseStates=await tx.execute<{vorab:Source['vorab']|null}>(sql`
  SELECT CASE
   WHEN private.order_release_allowed_v1(orders.tenant_id,orders.id) OR EXISTS (
    SELECT 1 FROM private.v_goods_out_ui_state_v1 release
    WHERE release.tenant_id=orders.tenant_id AND release.order_id=orders.id
     AND release.order_version=orders.version AND release.integrity_ok AND release.goods_out_event_id IS NOT NULL
   ) THEN NULL
   WHEN orders.payment_mode='vorkasse' AND private.order_release_allowed_v1(orders.tenant_id,orders.id,false,true)
   THEN 'delivery_note.preview_payment_required'
   ELSE 'delivery_note.preview_release_required'
  END AS vorab
  FROM public.orders orders WHERE orders.tenant_id=${auth.tenantId} AND orders.id IN (${orderIds})
 `);
 if(releaseStates.length!==orders.length)throw Error('DELIVERY_NOTE_RELEASE_STATE_MISSING');
 const company=await ports.readCompany();
 if(company.code==='NOT_FOUND'||company.code==='VALIDATION_ERROR'){
  const field=company.missingFields?.[0]??'companyName';
  throw new DeliveryNoteSourceRejected({code:'VALIDATION_ERROR',message:sourceCopy.companyMissing,remedy:{href:'/settings#company-'+field,field,datei:'src/app/actions/settings.actions.ts',funktion:'readSettingsAction',argumente:{}}});
 }
 if(company.code!=='OK'||!company.company)throw Error('DELIVERY_NOTE_COMPANY_SOURCE_UNAVAILABLE');
 const customer=await ports.readCustomer(tx,auth.tenantId,orders[0].customer_id);
 if(!customer)throw Error('DELIVERY_NOTE_CUSTOMER_SOURCE_UNAVAILABLE');
 const missing=(['name','street','houseNumber','zipCode','city','country'] as const).find(key=>typeof customer[key]!=='string'||!customer[key]!.trim());
 if(missing)throw new DeliveryNoteSourceRejected({code:'VALIDATION_ERROR',message:sourceCopy.addressMissing(MANUAL_SHIPPING_FIELDS[missing]),remedy:{href:'/customers/'+encodeURIComponent(orders[0].customer_id),field:missing,datei:'src/app/actions/customers.actions.ts',funktion:'getCustomerSummaryAction',argumente:{customerId:orders[0].customer_id}}});
 const result:Source={schemaVersion:2,company:company.company,customer:{id:orders[0].customer_id,name:customer.companyName??customer.name,street:[customer.street,customer.houseNumber].join(' '),zip:customer.zipCode!,city:customer.city!,country:customer.country!},orders:[]};
 if(releaseStates.some(order=>order.vorab==='delivery_note.preview_release_required'))result.vorab='delivery_note.preview_release_required';
 else if(releaseStates.some(order=>order.vorab==='delivery_note.preview_payment_required'))result.vorab='delivery_note.preview_payment_required';
 for(const order of orders){
  const rows=await readOrderPaymentSummaries(tx,auth.tenantId,order.id);
  const paymentSourceHash=sha(canonicalJson(rows.map(row=>({invoiceId:row.invoice_id,invoiceNumber:row.invoice_number,total:row.total_amount_cents,mode:row.payment_mode,paymentStatus:row.payment_status,paymentVersion:row.payment_version,eventId:row.payment_event_id,receiptId:row.payment_receipt_id,paidAt:row.payment_paid_at instanceof Date?row.payment_paid_at.toISOString():row.payment_paid_at,paidAmount:row.payment_paid_amount_cents,openAmount:row.payment_open_amount_cents})).sort((a,b)=>a.invoiceId.localeCompare(b.invoiceId))));
  if(expected&&expected[order.id].paymentHash!==paymentSourceHash)throw new DeliveryNoteSourceRejected({code:'CONFLICT',message:copy.changed});
  if(rows.length&&rows.filter(row=>row.belegart==='auftrag').length!==1)throw Error('DELIVERY_NOTE_MAIN_INVOICE_MISSING');
  const payments=rows.map(row=>mapPaymentSummaryEvidenceRow(row,auth.tenantId))
   .filter(row=>row.status==='bezahlt'&&row.openAmountCents===0&&row.eventId&&row.receiptId&&row.paidAt);
  const originals=payments.length?await readCreateInvoiceReceipts(tx,{orderId:order.id}):[];
  const sources=payments.map(payment=>{
   const original=originals.filter(row=>row.invoice_id===payment.invoiceId);
   if(original.length!==1)throw Error('DELIVERY_NOTE_INVOICE_SOURCE_MISSING');
   const receipt=mapInvoiceIssueReceipt(original[0],auth.tenantId,original[0].actor_id,ports.readVat);
   return {row:original[0],receipt,payment};
  });
  const current=await readLiveOrderCard(auth,{orderId:order.id});
  if(current.code!=='OK'||current.data.version!==order.version)throw Error('DELIVERY_NOTE_CURRENT_CONTENT_UNAVAILABLE');
  const parts=current.data.items.map(item=>({itemId:item.id,name:item.name,quantity:item.quantity}));
  if(!parts.length||parts.some(part=>!part.itemId||!part.name.trim()||!Number.isFinite(part.quantity)||part.quantity<=0))throw Error('DELIVERY_NOTE_PARTS_MISSING');
  result.orders.push({id:order.id,number:order.order_number,version:order.version,title:current.data.title,paymentSourceHash,parts,payments:sources.map(({receipt,payment})=>({invoiceId:receipt.invoiceId,invoiceNumber:receipt.invoiceNumber,invoiceEventId:receipt.eventId,invoiceSha256:receipt.pdfSha256,paymentEventId:payment.eventId!,paymentReceiptId:payment.receiptId!,paymentVersion:payment.paymentVersion,amountCents:payment.paidAmountCents,paidAt:payment.paidAt!}))});
 }
 if(expected){const current=references(result);if(ids.some(id=>current[id].contentHash!==expected[id].contentHash))throw new DeliveryNoteSourceRejected({code:'CONFLICT',message:sourceCopy.orderChanged});}
 return result;
}

/** Read-only projection of the very same collector used under the document lock. */
export async function readDeliveryNoteSource(auth:AuthorizationSnapshot,orderIds:string[],ports:SourcePorts):Promise<DeliveryNoteSourceRead>{
 if(!auth.active||!hasAuthorizationArea(auth,'auftraege'))return {code:'FORBIDDEN',message:LEGACY_ACTION_ACCESS_COPY.forbidden};
 if(!orderIds.length||orderIds.some(id=>typeof id!=='string'||!id.trim()||id!==id.trim()||id.length>128)||new Set(orderIds).size!==orderIds.length)return {code:'VALIDATION_ERROR',message:copy.invalid};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{const source=await readSource(tx,auth,[...orderIds].sort(),ports);if(!source)return {code:'VALIDATION_ERROR' as const,message:copy.sourceMissing};return {code:'OK' as const,source:{orderIds:source.orders.map(order=>order.id),expectedVersions:Object.fromEntries(source.orders.map(order=>[order.id,order.version])),expectedSources:references(source)}};});}
 catch(error){if(error instanceof DeliveryNoteSourceRejected)return error.result;console.error('[DELIVERY_NOTE_SOURCE_READ_FAILED]',error instanceof Error?error.name:'UnknownError');return {code:'UNAVAILABLE',message:serverMessage};}
}

/** One existing PDF action composes canonical sources and the private original
 * store. The JSON envelope is one object containing the actual PDF bytes, so a
 * failed DB commit cannot force a retry to regenerate or replace an original. */
export async function generatePaidDeliveryNote(auth:AuthorizationSnapshot,input:DeliveryNoteInput|string|string[],ports:Ports):Promise<DeliveryNoteResult>{
 if(!auth.active||!hasAuthorizationArea(auth,'auftraege'))return fail('FORBIDDEN',LEGACY_ACTION_ACCESS_COPY.forbidden);
 // The old string adapter captures the current canonical source server-side,
 // then delegates to exactly the same source-checked object command.
 if(typeof input==='string'||Array.isArray(input)){
  const read=await readDeliveryNoteSource(auth,typeof input==='string'?[input]:input,ports);
  if(read.code!=='OK')return read;
  return generatePaidDeliveryNote(auth,{...read.source,clientEventId:uuid('delivery-request-v2:'+auth.tenantId+':'+auth.userId+':'+canonicalJson(read.source))},ports);
 }
 if(!isDeliveryNoteInput(input))return fail('VALIDATION_ERROR',copy.invalid);
 const command=input;
 const ids=command.orderIds;
 const selected=[...ids].sort();
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${auth.tenantId+':delivery-note:'+canonicalJson(selected)},0))`);
  async function fromRequest(key:string):Promise<DeliveryNoteResult|null>{
   const found=await tx.execute<{id:string;user_id:string;event_type:string;status:string;event_schema_version:number;payload:{orderIds:string[];receipt:DeliveryNoteReceipt}}>(sql`SELECT id,user_id::text,event_type,status,event_schema_version,payload FROM public.events WHERE tenant_id=${auth.tenantId} AND client_event_id=${key}::uuid`);
   if(!found.length)return null;
   const row=found[0];if(found.length!==1||row.user_id!==auth.userId||row.event_type!=='DELIVERY_NOTE_REQUESTED_V1'||row.status!=='success'||row.event_schema_version!==1||canonicalJson(row.payload.orderIds)!==canonicalJson(selected)||canonicalJson(row.payload.receipt.orderIds)!==canonicalJson(selected)||row.payload.receipt.actorId!==auth.userId||row.payload.receipt.clientEventId!==key||row.payload.receipt.eventId!==row.id
    ||canonicalJson((row.payload as {expectedVersions?:unknown}).expectedVersions)!==canonicalJson(command.expectedVersions)
    ||canonicalJson((row.payload as {expectedSources?:unknown}).expectedSources??null)!==canonicalJson(command.expectedSources??null))return fail('CONFLICT',copy.changed);
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
  const prior=await fromRequest(command.clientEventId);if(prior)return prior;
  const source=await readSource(tx,auth,selected,ports,command.expectedSources);if(!source)return fail('VALIDATION_ERROR',copy.sourceMissing);
  const sourceHash=sourceHashOf(source),key=command.clientEventId;
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
   VALUES(${eventId},${auth.tenantId},${selected[0]},'DELIVERY_NOTE_REQUESTED_V1',${copy.title},${auth.userId}::uuid,${JSON.stringify({orderIds:selected,expectedVersions:command.expectedVersions,expectedSources:command.expectedSources,receipt})}::jsonb,'success',${key}::uuid,1,${version}) RETURNING id`);
  if(requested.length!==1||requested[0].id!==eventId)throw Error('DELIVERY_NOTE_REQUEST_NOT_SAVED');
  const proof=await fromRequest(key);if(!proof||proof.code!=='OK')throw Error('DELIVERY_NOTE_READBACK_FAILED');
  return {...proof,replayed:existing.length===1};
 });}catch(error){if(error instanceof DeliveryNoteSourceRejected)return error.result;console.error('[DELIVERY_NOTE_GENERATION_FAILED]',{name:error instanceof Error?error.name:'UnknownError',code:error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:'UNAVAILABLE'});return fail('UNAVAILABLE',serverMessage);}
}
