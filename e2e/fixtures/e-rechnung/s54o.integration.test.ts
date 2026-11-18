// @vitest-environment node
// Real invoice action, cookie/Auth, Loopback DB and immutable original. TEST only.
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {expect,it,vi} from 'vitest';
import {PDFDict,PDFDocument,PDFName,PDFRawStream} from 'pdf-lib';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../ablauf/replayHarness';
import {readSettingsAction,saveCompanySettingsAction} from '@/app/actions/settings.actions';
import {SALES_STAGE_FEATURES} from '@/modules/fundament/public';
import {readyOrderForInvoice,readyInvoiceOrder,customerFixture} from '../../ablauf/orderFixture';
import {issueInvoiceAction,cancelInvoiceAction,getInvoiceReceiptAction,getInvoiceCancellationReceiptAction} from '@/app/actions/invoices.actions';
import {GET as invoicePdf} from '@/app/api/invoices/[invoiceId]/pdf/route';
import {renderToBuffer} from '@react-pdf/renderer';
import {createImmutableInvoicePdfDocument,type ImmutableInvoiceSnapshot,type ImmutableInvoiceSnapshotV3} from '@/lib/pdf/ImmutableInvoiceDocument';
import {readInvoiceVat} from '@/modules/accounting/public';

it('S54o PL19:01: a unitless fractional part is refused by the existing capture guard without an order, invoice or number',async()=>{
 const customerId=await customerFixture('TEST S54o fractional unitless part');
 const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
 const before=await sql`SELECT invoice_year,last_number,updated_at::text FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`;
 const key=randomUUID();
 expect(await withSession(full,()=>createOrderIntakeAction({geprueft:true,clientEventId:key,customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'pickup',paymentMode:'rechnung',note:'TEST S54o fractional unitless refusal',items:[{catalogServiceId:null,name:'TEST S54o 2.5 parts',quantity:2.5,material:'Messing',surfaceRequested:'Verchromen',executionRequested:'offen',unit:null,unitPriceCents:10000,vatRateBasisPoints:1900}]}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT count(*)::int AS n FROM public.orders WHERE tenant_id=${tenant} AND customer_id=${customerId}`).toEqual([{n:0}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${tenant} AND customer_id=${customerId}`).toEqual([{n:0}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${tenant} AND client_event_id=${key}::uuid`).toEqual([{n:0}]);
 expect(await sql`SELECT invoice_year,last_number,updated_at::text FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`).toEqual(before);
});

it('S54o C15 A15:27: authorized existing reopen preserves the old freeze and permits regular correction, finish and one invoice',async()=>{
 const customerId=await customerFixture('S54o valid correction customer');
 const order=await readyOrderForInvoice('TEST bad part \u{1D11E}','pickup',customerId);
 const other=await readyOrderForInvoice('TEST unaffected order','pickup',customerId);
 const otherBefore=await sql`SELECT md5(to_jsonb(o)::text) AS sha FROM public.orders o WHERE tenant_id=${tenant} AND id=${other.orderId}`;
 const {reopenFrozenOrderAction,getLiveOrderCardAction,changeOrderContentAction,setOrderItemFinishedAction,freezeOrderAction}=await import('@/app/actions/orders.actions');
 const before=await sql`SELECT invoice_year,last_number FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`;
 const failedKey=randomUUID();
 expect(await withSession(full,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:failedKey}))).toMatchObject({code:'VALIDATION_ERROR',source:{kind:'order',objectId:order.orderId,orderVersion:order.version,codePoint:0x1D11E}});
 expect(await sql`SELECT invoice_year,last_number FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`).toEqual(before);
 expect(await withSession(full,()=>getInvoiceReceiptAction({orderId:order.orderId,clientEventId:failedKey}))).toMatchObject({code:'OK',data:null});
 const original=await sql`SELECT id::text,md5(to_jsonb(frozen_original)::text) AS sha FROM private.order_freezes frozen_original WHERE tenant_id=${tenant} AND order_id=${order.orderId}`;
 expect(original).toHaveLength(1);
 const input={orderId:order.orderId,expectedVersion:order.version,reason:'Rechnungsfeld korrigieren',clientEventId:randomUUID()};
 const restricted=await createFixture(['preise']);
 expect(await withSession(restricted,()=>reopenFrozenOrderAction(input))).toMatchObject({code:'FORBIDDEN'});
 const attempts=await Promise.all([withSession(full,()=>reopenFrozenOrderAction(input)),withSession(full,()=>reopenFrozenOrderAction(JSON.parse(JSON.stringify(input))))]);
 expect(attempts.map(result=>result.code)).toEqual(['OK','OK']);
 const opened=attempts[0];if(opened.code!=='OK')throw Error('TEST_REOPEN_REQUIRED');
 expect(attempts.filter(result=>result.code==='OK'&&result.replayed)).toHaveLength(1);
 expect(opened.receipt).toMatchObject({actorId:full.actorId,fromStation:'fertig',toStation:'galvanik',reason:input.reason,clientEventId:input.clientEventId});
 const read=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));if(read.code!=='OK')throw Error('TEST_REOPEN_READ_REQUIRED');
 expect(read.data.card.station).toBe('galvanik');expect(read.data.card.version).toBe(opened.receipt.aggregateVersion);
 const changed=await withSession(full,()=>changeOrderContentAction({orderId:order.orderId,expectedVersion:read.data.card.version,clientEventId:randomUUID(),note:read.data.card.note,items:read.data.card.items.map(item=>({id:item.id,catalogServiceId:item.catalogServiceId??null,name:'TEST corrected invoice part',quantity:item.quantity,material:item.material,surface:item.surfaceRequested,unit:item.unit??null,unitPriceCents:item.unitPriceCents??null,vatRateBasisPoints:item.vatRateBasisPoints??null}))}));
 expect(changed.code).toBe('OK');if(changed.code!=='OK')throw Error('TEST_REGULAR_CONTENT_CORRECTION_REQUIRED');
 const correctedCard=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
 if(correctedCard.code!=='OK')throw Error('TEST_CORRECTED_CARD_REQUIRED');
 expect(correctedCard.data.card.title).toBe('TEST S54o valid correction customer Firma GmbH · TEST corrected invoice part');
 expect(await sql`SELECT payload->'titleChange' AS title_change,user_id::text AS actor FROM public.events WHERE tenant_id=${tenant} AND id=${changed.receipt.eventId}`).toEqual([{title_change:{before:read.data.card.title,after:correctedCard.data.card.title},actor:full.actorId}]);
 const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId:order.orderId,itemId:order.items[0].id,expectedVersion:changed.receipt.aggregateVersion,clientEventId:randomUUID(),finished:true}));
 expect(finished.code).toBe('OK');if(finished.code!=='OK')throw Error('TEST_REGULAR_FINISH_REQUIRED');
 const frozen=await withSession(full,()=>freezeOrderAction({orderId:order.orderId,freezeId:randomUUID(),expectedVersion:finished.receipt.aggregateVersion,clientEventId:randomUUID()}));
 expect(frozen.code).toBe('OK');if(frozen.code!=='OK')throw Error('TEST_REGULAR_FREEZE_REQUIRED');
 expect(await sql`SELECT invoice_year,last_number FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`).toEqual(before);
 const issue={orderId:order.orderId,expectedVersion:frozen.receipt.aggregateVersion,clientEventId:randomUUID()};
 const issued=await withSession(full,()=>issueInvoiceAction(issue));if(issued.code!=='OK')throw Error('TEST_CORRECTED_INVOICE_REQUIRED:'+JSON.stringify(issued));expect(issued.code).toBe('OK');
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(issue))))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:issued.receipt.invoiceId,pdfSha256:issued.receipt.pdfSha256}});
 expect(await sql`SELECT id::text,md5(to_jsonb(frozen_original)::text) AS sha FROM private.order_freezes frozen_original WHERE tenant_id=${tenant} AND id=${original[0].id}::uuid`).toEqual(original);
 expect(await sql`SELECT count(*)::int AS count FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${order.orderId}`).toEqual([{count:1}]);
 expect(await sql`SELECT md5(to_jsonb(o)::text) AS sha FROM public.orders o WHERE tenant_id=${tenant} AND id=${other.orderId}`).toEqual(otherBefore);
 const [stored]=await sql`SELECT pdf_content FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 const bytes=new Uint8Array(stored.pdf_content);
 expect(createHash('sha256').update(bytes).digest('hex')).toBe(issued.receipt.pdfSha256);
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const loading=getDocument({data:bytes.slice(),disableFontFace:true,verbosity:0});
 try{
  const pdf=await loading.promise,attachments=await pdf.getAttachments();expect(attachments?.size).toBe(1);if(!attachments)throw Error('TEST_CORRECTED_XML_MISSING');
  const [key]=[...attachments][0],xml=await pdf.getAttachmentContent(key);if(!xml)throw Error('TEST_CORRECTED_XML_BYTES_MISSING');
  writeEvidence('kreile-s54o-a15-corrected.pdf',bytes);writeEvidence('kreile-s54o-a15-corrected.xml',xml);
 }finally{await loading.destroy();}
 writeEvidence('kreile-s54o-a15-corrected.json',JSON.stringify({invoiceId:issued.receipt.invoiceId,pdfSha256:issued.receipt.pdfSha256,source:'real corrected title through ordinary commands',oldFreezeUnchanged:true,otherOrderUnchanged:true},null,2)+'\n');
 writeEvidence('kreile-s54o-frozen-source-correction.json',JSON.stringify({at:new Date().toISOString(),orderId:order.orderId,oldFreezeUnchanged:true,oldFreezeId:original[0].id,actualReopen:opened.receipt,actualInvoice:issued.receipt,regularCommandsOnly:true,taskFallbackNotIncluded:true},null,2)+'\n');
});

function writeEvidence(name:string,data:string|Uint8Array){
 const output=process.env.S54O_EVIDENCE_DIR??'.git';mkdirSync(output,{recursive:true});
 writeFileSync(path.join(output,name),data);
}

it('S54o C15: agreement goods-out preserves the invoice correction source and writes no physical handover or number on refusal',async()=>{
 const customerId=await customerFixture('TEST S54o goods-out correction');
 const order=await readyOrderForInvoice('TEST S54o bad handover part \u{1D11E}','pickup',customerId);
 const {saveCustomerAgreementAction}=await import('@/app/actions/customers.actions');
 const agreement=await withSession(full,()=>saveCustomerAgreementAction({customerId,orderId:order.orderId,clientKey:randomUUID(),type:'zahlungsziel',targetDays:14,reason:'TEST S54o regular agreement'}));
 if(agreement.code!=='OK')throw Error('TEST_CORRECTION_AGREEMENT:'+JSON.stringify(agreement));
 const operator=await createFixture(['auftraege']);
 const {getLiveOrderCardAction,reopenFrozenOrderAction}=await import('@/app/actions/orders.actions');
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const read=await withSession(operator,()=>getLiveOrderCardAction({orderId:order.orderId}));if(read.code!=='OK')throw Error('TEST_CORRECTION_ORDER_REQUIRED');
 const before=await sql`SELECT tenant_id,invoice_year,last_number,updated_at::text FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`;
 const input={orderId:order.orderId,mode:'abholung' as const,expectedVersion:read.data.card.version,clientEventId:randomUUID(),agreement:{id:agreement.agreement.id,version:agreement.agreement.version,type:'zahlungsziel' as const}};
 const refused=await withSession(operator,()=>recordGoodsOutAction(input));
 expect(refused).toMatchObject({code:'VALIDATION_ERROR',source:{kind:'order',field:'order.title',objectId:order.orderId,orderVersion:read.data.card.version,codePoint:0x1D11E}});
 expect(await sql`SELECT tenant_id,invoice_year,last_number,updated_at::text FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`).toEqual(before);
 expect(await sql`SELECT count(*)::int AS count FROM public.events WHERE tenant_id=${tenant} AND order_id=${order.orderId} AND event_type LIKE 'ORDER_PICKED_UP%'`).toEqual([{count:0}]);
 expect(await sql`SELECT station,version FROM public.orders WHERE tenant_id=${tenant} AND id=${order.orderId}`).toEqual([{station:'fertig',version:read.data.card.version}]);
 expect(await withSession(operator,()=>reopenFrozenOrderAction({orderId:order.orderId,expectedVersion:read.data.card.version,clientEventId:randomUUID(),reason:'Rechnungsfeld korrigieren'}))).toMatchObject({code:'OK'});
 writeEvidence('kreile-s54o-goodsout-correction-source.json',JSON.stringify({at:new Date().toISOString(),orderId:order.orderId,actor:operator.actorId,pricesRight:false,refused,noPhysicalHandover:true,noNumberConsumed:true,existingReopenAccepted:true},null,2)+'\n');
});

it('S54o A7: the existing mail sender transports the real frozen hybrid bytes and a deserialized retry sends no second mail',async()=>{
 const order=await readyInvoiceOrder('TEST S54o hybrid mail original');
 const {requestMailStep}=await import('../../ablauf/requestMailStep');
 await requestMailStep('S54o-hybrid-original');
 const {sendCustomerMailAction}=await import('@/app/actions/communications.actions');
 const input={targetType:'CUSTOMER' as const,targetId:order.customerId,clientRequestId:randomUUID(),subject:'TEST S54o Originalrechnung',body:'TEST gespeichertes Rechnungsoriginal',attachment:{kind:'INVOICE' as const,documentId:order.invoice.invoiceId},expectedInvoiceIds:[order.invoice.invoiceId]};
 const sends=()=>vi.mocked(globalThis.fetch).mock.calls.filter(([url,init])=>String(url).includes('graph.microsoft.com')&&String(url).endsWith('/sendMail')&&init?.method==='POST');
 const sent=await withSession(full,()=>sendCustomerMailAction(input));
 if(sent.code!=='OK')throw Error('TEST_S54O_MAIL:'+JSON.stringify(sent));
 expect(sends()).toHaveLength(1);
 const payload=JSON.parse(String(sends()[0][1]?.body));
 expect(payload.message.attachments).toHaveLength(1);
 const bytes=Buffer.from(payload.message.attachments[0].contentBytes,'base64');
 expect(createHash('sha256').update(bytes).digest('hex')).toBe(order.invoice.pdfSha256);
 const [stored]=await sql`SELECT pdf_content,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${order.invoice.invoiceId}::uuid`;
 expect(bytes).toEqual(Buffer.from(stored.pdf_content));
 expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{threadId:sent.data.threadId,replayed:true}});
 expect(sends()).toHaveLength(1);
 writeEvidence('kreile-s54o-hybrid-mail-original.json',JSON.stringify({at:new Date().toISOString(),invoiceId:order.invoice.invoiceId,pdfSha256:stored.pdf_sha256,graphSha256:createHash('sha256').update(bytes).digest('hex'),graphBytes:bytes.length,sends:sends().length,threadId:sent.data.threadId,actualActionsAuthDbStorage:true,onlyExternalProviderDoubled:true},null,2)+'\n');
});

it('S54o C15 A15:27: customer field correction uses the existing customer writer and a fresh receipt without consuming a failed number',async()=>{
 const order=await readyOrderForInvoice('TEST S54o customer street correction');
 const {updateCustomerAction}=await import('@/app/actions/customers.actions');
 const bad=await withSession(full,()=>updateCustomerAction({customerId:order.customerId,street:'TEST Weg \u{1D11E}',clientEventId:randomUUID()}));
 expect(bad.code).toBe('OK');
 const sequence=await sql`SELECT invoice_year,last_number FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`;
 const input={orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()};
 const refused=await withSession(full,()=>issueInvoiceAction(input));
 expect(refused).toMatchObject({code:'VALIDATION_ERROR',source:{kind:'customer',field:'street',codePoint:0x1D11E}});
 expect(await sql`SELECT invoice_year,last_number FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`).toEqual(sequence);
 const correction={customerId:order.customerId,street:'TEST corrected Weg',clientEventId:randomUUID()};
 expect(await withSession(full,()=>updateCustomerAction(correction))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>updateCustomerAction(JSON.parse(JSON.stringify(correction))))).toMatchObject({code:'OK',replayed:true});
 const issued=await withSession(full,()=>issueInvoiceAction(input));
 if(issued.code!=='OK')throw Error('TEST_CUSTOMER_CORRECTION_INVOICE:'+JSON.stringify(issued));
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:issued.receipt.invoiceId,pdfSha256:issued.receipt.pdfSha256}});
 expect(await sql`SELECT count(*)::int AS count FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${order.orderId}`).toEqual([{count:1}]);
 writeEvidence('kreile-s54o-customer-source-correction.json',JSON.stringify({at:new Date().toISOString(),orderId:order.orderId,customerId:order.customerId,source:refused,receipt:issued.receipt,failedNumberNotConsumed:true,realCustomerWriter:true},null,2)+'\n');
});

it('S54o C15 A16:11: prices-only refusal names actual authorized roles and creates no correction task or order effect',async()=>{
 const customerId=await customerFixture('TEST S54o no correction right');
 const order=await readyOrderForInvoice('TEST S54o restricted part \u{1D11E}','pickup',customerId);
 const actor=await createFixture(['preise'],'buero');
 await createFixture(['auftraege'],'werkstatt');
 const {resolveAuthorization,readActiveAreaHolders}=await import('@/lib/server/authorization');
 const {withPrivilegedTenantTransaction}=await import('@/lib/server/privilegedDb');
 const {getRoleLabel}=await import('@/lib/auth/authorizationContract');
 const roles=await withSession(actor,async()=>{
   const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_AUTH_REQUIRED');
   return withPrivilegedTenantTransaction(auth.data,async tx=>[...new Set((await readActiveAreaHolders(tx,auth.data.tenantId,'auftraege')).map(holder=>getRoleLabel(holder.role)))]);
 });
 expect(roles).toContain('Meister');expect(roles).toContain('Werkstatt');expect(roles).not.toContain('Büro');
 const before=await sql`SELECT md5(to_jsonb(o)::text) AS sha FROM public.orders o WHERE id=${order.orderId} AND tenant_id=${tenant}`;
 const tasks=await sql`SELECT id::text FROM public.tasks WHERE tenant_id=${tenant} ORDER BY id`;
 const numbers=await sql`SELECT invoice_year,last_number FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`;
 const refused=await withSession(actor,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()}));
 expect(refused).toMatchObject({code:'VALIDATION_ERROR',message:`Rechnung nicht ausgestellt: order.title enthält ein Zeichen, das die E-Rechnung nicht darstellen kann. Korrigieren kann das: ${roles.join(', ')}.`});
 expect(refused).not.toHaveProperty('source');
 expect(await sql`SELECT md5(to_jsonb(o)::text) AS sha FROM public.orders o WHERE id=${order.orderId} AND tenant_id=${tenant}`).toEqual(before);
 expect(await sql`SELECT id::text FROM public.tasks WHERE tenant_id=${tenant} ORDER BY id`).toEqual(tasks);
 expect(await sql`SELECT invoice_year,last_number FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`).toEqual(numbers);
 expect(await sql`SELECT count(*)::int AS count FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${order.orderId}`).toEqual([{count:0}]);
 writeEvidence('kreile-s54o-no-correction-right.json',JSON.stringify({at:new Date().toISOString(),orderId:order.orderId,actorId:actor.actorId,roles,refused,noTask:true,noOrderEffect:true,noInvoiceNumber:true},null,2)+'\n');
});

it.each([1,2] as const)('S54o A16: synthetic historical schema%s original is refused by the real cancellation Action with an audit and no original/counter change',async(schemaVersion)=>{
 const order=await readyOrderForInvoice('TEST S54o legacy refusal '+schemaVersion);
 // Legacy rows are explicitly synthetic initial data, not a positive writer
 // proof or a product legacy projection. Every existing DB guard stays active.
 const company={companyName:'TEST Legacy fixture seller',street:'TEST Weg 1',zip:'70176',city:'Stuttgart',country:'Deutschland',taxId:'DE123456789',taxNumber:'',iban:'DE02120300000000202051',bic:'BYLADEM1001',bankName:'TEST Bank',paymentTermDays:14,logoUrl:'/TEST-logo.png'};
 expect(await withSession(full,()=>saveCompanySettingsAction(company))).toEqual({code:'OK'});
 const issued=await withSession(full,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()}));
 expect(issued.code).toBe('OK');if(issued.code!=='OK')throw Error('TEST_CURRENT_SOURCE_REQUIRED');
 const actual=await sql<{record:Record<string,unknown>}[]>`SELECT to_jsonb(invoice) AS record FROM public.invoices invoice WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(actual).toHaveLength(1);const record=actual[0].record,snapshot=record.snapshot as ImmutableInvoiceSnapshotV3;
 expect(snapshot.schemaVersion).toBe(3);const {vatId,taxNumber,...seller}=snapshot.seller;expect(vatId).toBe(company.taxId);expect(taxNumber).toBeNull();
 const {vatId:buyerVat,...oldCustomer}=snapshot.customer;expect(buyerVat).toBeNull();
 const lines=snapshot.lines.map(line=>{if(line.type!=='BASE')throw Error('TEST_BASE_FIXTURE_REQUIRED');const {unit,taxCategory,vat_rate_basis_points,...oldLine}=line;expect(unit).toBe('C62');expect(taxCategory).toBe('S');expect(vat_rate_basis_points).toBe(1900);return schemaVersion===1?oldLine:{...oldLine,vat_rate_basis_points};});
 const legacy:ImmutableInvoiceSnapshot={...snapshot,schemaVersion,seller:{...seller,taxId:vatId!},customer:schemaVersion===1?oldCustomer:snapshot.customer,lines,totals:schemaVersion===1?{netAmountCents:snapshot.totals.netAmountCents,vatRateBasisPoints:1900,vatAmountCents:snapshot.totals.vatAmountCents,grossAmountCents:snapshot.totals.grossAmountCents}:snapshot.totals};
 expect(await withSession(full,()=>cancelInvoiceAction({invoiceId:issued.receipt.invoiceId,expectedVersion:1,clientEventId:randomUUID(),reason:'TEST fixture current control'}))).toMatchObject({code:'OK'});
 const legacyId=randomUUID(),eventId=randomUUID(),clientId=randomUUID(),correlation=randomUUID();
 await sql.begin(async tx=>{
  await tx`SELECT set_config('app.tenant_id',${tenant},true)`;
  const allocated=await tx`SELECT private.allocate_invoice_number(${tenant},extract(year FROM ${String(record.issued_at)}::timestamptz AT TIME ZONE 'Europe/Berlin')::integer) AS number`;
  expect(allocated).toHaveLength(1);const number=String(allocated[0].number);
  const pdf=await renderToBuffer(createImmutableInvoicePdfDocument({snapshot:legacy,invoiceNumber:number,dueDate:String(record.due_date),vat:readInvoiceVat(legacy)}));
  const sha=createHash('sha256').update(pdf).digest('hex');
  const payload={invoiceId:legacyId,freezeId:legacy.order.freezeId,invoiceNumber:number,orderVersion:legacy.order.orderVersion,netAmountCents:legacy.totals.netAmountCents,vatRateBasisPoints:legacy.totals.vatRateBasisPoints,vatAmountCents:legacy.totals.vatAmountCents,grossAmountCents:legacy.totals.grossAmountCents,pdfSha256:sha,invoiceVersion:1};
  await tx`INSERT INTO public.events(id,tenant_id,order_id,item_id,event_type,description,user_id,payload,status,station,client_event_id,event_schema_version,correlation_id,aggregate_version,from_station,created_at) VALUES(${eventId},${tenant},${order.orderId},NULL,'INVOICE_CREATED_V1','TEST synthetic historical invoice',${full.actorId}::uuid,${tx.json(payload)},'success','fertig',${clientId}::uuid,1,${correlation}::uuid,1,'fertig',${String(record.issued_at)}::timestamptz AT TIME ZONE 'UTC')`;
  const row={...record,id:legacyId,invoice_number:number,snapshot:legacy,vat_rate_basis_points:legacy.totals.vatRateBasisPoints,client_event_id:clientId,correlation_id:correlation,issue_event_id:eventId,pdf_ref:'invoice://'+legacyId+'/original',pdf_sha256:sha,pdf_content:'\\x'+pdf.toString('hex')};
  const columns=(await tx`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='invoices' AND is_generated='NEVER' AND is_identity='NO' ORDER BY ordinal_position`).map(column=>String(column.column_name));
  await tx`INSERT INTO public.invoices (${tx(columns)}) SELECT ${tx(columns)} FROM jsonb_populate_record(NULL::public.invoices,${tx.json(row)})`;
 });
 const before=await sql`SELECT md5(to_jsonb(invoice)::text) AS digest,pdf_sha256 FROM public.invoices invoice WHERE tenant_id=${tenant} AND id=${legacyId}::uuid`;
 const counters=await sql`SELECT * FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`;
 const input={invoiceId:legacyId,expectedVersion:1 as const,clientEventId:randomUUID(),reason:'TEST reject pre-live cancellation'};
 const expected={code:'VALIDATION_ERROR',message:'Diese Rechnung stammt aus der Testphase und kann nicht als E-Rechnung storniert werden.'};
 expect(await withSession(full,()=>cancelInvoiceAction(input))).toEqual(expected);
 expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toEqual(expected);
 expect(await sql`SELECT md5(to_jsonb(invoice)::text) AS digest,pdf_sha256 FROM public.invoices invoice WHERE tenant_id=${tenant} AND id=${legacyId}::uuid`).toEqual(before);
 expect(await sql`SELECT * FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`).toEqual(counters);
 const audit=await sql`SELECT user_id,reason FROM public.technical_protocol WHERE tenant_id=${tenant} AND subject_type='invoice' AND subject_id=${legacyId} AND command='cancelInvoiceAction' AND event_type='rejected'`;
 expect(audit).toHaveLength(2);for(const row of audit)expect(row).toMatchObject({user_id:full.actorId,reason:'VALIDATION'});
 writeEvidence('kreile-s54o-legacy-'+schemaVersion+'-refusal.json',JSON.stringify({at:new Date().toISOString(),schemaVersion,syntheticLegacyFixture:true,allDbGuardsActive:true,actualRefusalAndAudit:true,originalAndCounterUnchanged:true,invoiceId:legacyId},null,2)+'\n');
});

it('S54o seller tax settings: actual separate fields, settings authority, reread and fresh legacy retry preserve the domestic number',async()=>{
 for(const feature of SALES_STAGE_FEATURES)await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES(${tenant},${feature.id},${feature.defaultEnabled}) ON CONFLICT DO NOTHING`;
 const input={companyName:'TEST Separate tax identifiers',street:'TEST Weg 1',zip:'70176',city:'Stuttgart',country:'Deutschland',taxId:'DE123456789',taxNumber:'123/456/78901',iban:'DE02120300000000202051',bic:'BYLADEM1001',bankName:'TEST Bank',paymentTermDays:14,logoUrl:'/TEST-logo.png'};
 expect(await withSession(full,()=>saveCompanySettingsAction(input))).toEqual({code:'OK'});
 const read=async()=>{const result=await withSession(full,()=>readSettingsAction());expect(result.code).toBe('OK');if(result.code!=='OK')throw Error('TEST_SETTINGS_SOURCE_MISSING');return result.snapshot.company;};
 expect(await read()).toMatchObject({taxId:input.taxId,taxNumber:input.taxNumber});
 const operator=await createFixture(['preise']);
 expect(await withSession(operator,()=>saveCompanySettingsAction({...input,taxNumber:'TEST not allowed'}))).toMatchObject({code:'FORBIDDEN'});
 expect(await read()).toMatchObject({taxId:input.taxId,taxNumber:input.taxNumber});
 expect(await withSession(full,()=>saveCompanySettingsAction(JSON.parse(JSON.stringify({...input,taxId:''}))))).toEqual({code:'OK'});
 expect(await read()).toMatchObject({taxId:null,taxNumber:input.taxNumber});
 const {taxNumber:omitted,...legacy}=input;expect(omitted).toBe(input.taxNumber);
 expect(await withSession(full,()=>saveCompanySettingsAction(JSON.parse(JSON.stringify(legacy))))).toEqual({code:'OK'});
 expect(await read()).toMatchObject({taxId:input.taxId,taxNumber:input.taxNumber});
 expect(await withSession(full,()=>saveCompanySettingsAction({...input,taxNumber:42 as unknown as string}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await read()).toMatchObject({taxId:input.taxId,taxNumber:input.taxNumber});
 const proof=await sql`SELECT payload FROM public.ui_events WHERE tenant_id=${tenant} AND event_type='company_settings_updated' ORDER BY created_at DESC LIMIT 1`;
 expect(proof).toHaveLength(1);expect(proof[0].payload).toMatchObject({actorId:full.actorId});
 const fault='test_s54o_tax_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.event_type='company_settings_updated' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.ui_events FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 const corrected={...input,taxNumber:'123/456/99999'};
 try{
  expect(await withSession(full,()=>saveCompanySettingsAction(corrected))).toMatchObject({code:'UNAVAILABLE'});
  expect(await read()).toMatchObject({taxId:input.taxId,taxNumber:input.taxNumber});
 }finally{
  await sql.unsafe(`DROP TRIGGER ${fault} ON public.ui_events`);
  await sql.unsafe(`DROP FUNCTION private.${fault}()`);
 }
 expect(await withSession(full,()=>saveCompanySettingsAction(JSON.parse(JSON.stringify(corrected))))).toEqual({code:'OK'});
 expect(await read()).toMatchObject({taxId:input.taxId,taxNumber:corrected.taxNumber});
 writeEvidence('kreile-s54o-tax-settings-real.json',JSON.stringify({at:new Date().toISOString(),tenant,actor:full.actorId,separateSources:true,legacyPreserved:true,authorityUnchanged:true},null,2)+'\n');
});

it('S54o v3: absent seller identity refuses before allocation; actual settings correction and same-key retry freeze tax number and original unit',async()=>{
 // A real earlier original makes this check exercise an existing counter,
 // rather than accidentally comparing two empty query results in isolation.
 await readyInvoiceOrder('TEST S54o prior counter original');
 const order=await readyOrderForInvoice('TEST S54o v3 required seller');
 const input={orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()};
 const company={companyName:'TEST S54o v3 issuer',street:'TEST Weg 1',zip:'70176',city:'Stuttgart',country:'Deutschland',taxId:'',taxNumber:'',iban:'DE02120300000000202051',bic:'BYLADEM1001',bankName:'TEST Bank',paymentTermDays:14,logoUrl:'/TEST-logo.png'};
 expect(await withSession(full,()=>saveCompanySettingsAction(company))).toEqual({code:'OK'});
 const before=await sql`SELECT tenant_id,invoice_year,last_number,updated_at::text FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`;
 expect(before.length).toBeGreaterThan(0);
 const refused=await withSession(full,()=>issueInvoiceAction(input));
 expect(refused).toMatchObject({code:'VALIDATION_ERROR',message:'Fehlt für die E-Rechnung: USt-IdNr. oder Steuernummer · in Einstellungen eintragen',source:{kind:'settings',field:'taxId'}});
 expect(await sql`SELECT tenant_id,invoice_year,last_number,updated_at::text FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`).toEqual(before);
 expect(await withSession(full,()=>getInvoiceReceiptAction({orderId:order.orderId,clientEventId:input.clientEventId}))).toMatchObject({code:'OK',data:null});
 const corrected={...company,taxNumber:'123/456/78901'};
 expect(await withSession(full,()=>saveCompanySettingsAction({...corrected,companyName:'TEST invalid seller \u{1D11E}'}))).toEqual({code:'OK'});
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'VALIDATION_ERROR',source:{kind:'settings',field:'companyName'},message:expect.stringContaining('U+1D11E')});
 expect(await sql`SELECT tenant_id,invoice_year,last_number,updated_at::text FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`).toEqual(before);
 expect(await withSession(full,()=>saveCompanySettingsAction(corrected))).toEqual({code:'OK'});
 const result=await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))));
 expect(result.code).toBe('OK');if(result.code!=='OK')throw Error('TEST_V3_CORRECTED_ISSUE:'+result.code+':'+result.message);
 const stored=await sql`SELECT snapshot,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${result.receipt.invoiceId}::uuid`;
 const source=await sql`SELECT unit FROM public.items WHERE tenant_id=${tenant} AND order_id=${order.orderId}`;
 // Existing intake stores the canonical identity, not its displayed label.
 expect(source).toHaveLength(1);expect(source[0].unit).toBe('stueck');
 expect(stored).toHaveLength(1);expect(stored[0].snapshot).toMatchObject({schemaVersion:3,seller:{vatId:null,taxNumber:corrected.taxNumber},lines:[{type:'BASE',unit:'C62',taxCategory:'S',vat_rate_basis_points:1900}]});
 expect(stored[0].snapshot.seller).not.toHaveProperty('taxId');
 const response=await withSession(full,()=>invoicePdf(new Request('http://127.0.0.1/api/invoices/'+result.receipt.invoiceId+'/pdf'),{params:Promise.resolve({invoiceId:result.receipt.invoiceId})}));
 expect(response.status).toBe(200);const bytes=new Uint8Array(await response.arrayBuffer());
 expect(createHash('sha256').update(bytes).digest('hex')).toBe(result.receipt.pdfSha256);
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:bytes.slice(),verbosity:0});
 try{
  const document=await task.promise,attachments=await document.getAttachments();
  let visible='';for(let page=1;page<=document.numPages;page++){const content=await(await document.getPage(page)).getTextContent();visible+=content.items.filter((row):row is Extract<typeof row,{str:string}>=>'str'in row).map(row=>row.str).join(' ');}
  expect(visible.split(corrected.taxNumber).length-1).toBe(1);
  expect(attachments?.size).toBe(1);if(!attachments)throw Error('TEST_XML_ORIGINAL_MISSING');
  const [key,attachment]=[...attachments][0];expect(attachment.filename).toBe('factur-x.xml');
  const embedded=await document.getAttachmentContent(key);expect(embedded).not.toBeNull();if(!embedded)throw Error('TEST_XML_BYTES_MISSING');
  const xmlText=new TextDecoder().decode(embedded);
  expect(xmlText).toContain('<ram:SellerTradeParty><ram:ID>123/456/78901</ram:ID>');
  expect(xmlText).toContain('<ram:ID schemeID="FC">123/456/78901</ram:ID>');
  expect(xmlText).not.toContain('schemeID="VA"');
  writeEvidence('kreile-s54o-a1.pdf',bytes);writeEvidence('kreile-s54o-a1.xml',embedded);
 }finally{await task.destroy();}
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:result.receipt.invoiceId,pdfSha256:result.receipt.pdfSha256}});
 writeEvidence('kreile-s54o-v3-actual.json',JSON.stringify({at:new Date().toISOString(),tenant,invoiceId:result.receipt.invoiceId,pdfSha256:result.receipt.pdfSha256,originalUnit:source[0].unit,snapshot:stored[0].snapshot,counterUnchangedOnRefusal:true,existingWriterAndFreshRetry:true,pairedPdf:'.git/kreile-s54o-a1.pdf',pairedXml:'.git/kreile-s54o-a1.xml'},null,2)+'\n');
});

it('S54o font preparation: real issue/read/retry embeds regular and bold invoice fonts and preserves original bytes',async()=>{
 const order=await readyOrderForInvoice('TEST S54o ÄÖÜ äöü ß · €');
 // Explicit VAT case: the preceding independent tax-only scenario is not
 // this scenario's issuer source. Use the same real settings writer.
 expect(await withSession(full,()=>saveCompanySettingsAction({companyName:'TEST S54o font issuer',street:'TEST Weg 1',zip:'70176',city:'Stuttgart',country:'Deutschland',taxId:'DE123456789',taxNumber:'',iban:'DE02120300000000202051',bic:'BYLADEM1001',bankName:'TEST Bank',paymentTermDays:14,logoUrl:'/TEST-logo.png'}))).toEqual({code:'OK'});
 const input={orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()};
 const issued=await withSession(full,()=>issueInvoiceAction(input));expect(issued.code).toBe('OK');if(issued.code!=='OK')throw Error('TEST_S54O_ISSUE:'+issued.code);
 const read=async()=>{
  const response=await withSession(full,()=>invoicePdf(new Request('http://127.0.0.1/api/invoices/'+issued.receipt.invoiceId+'/pdf'),{params:Promise.resolve({invoiceId:issued.receipt.invoiceId})}));
  expect(response.status).toBe(200);return new Uint8Array(await response.arrayBuffer());
 };
 const bytes=await read();expect(createHash('sha256').update(bytes).digest('hex')).toBe(issued.receipt.pdfSha256);
 const pdf=await PDFDocument.load(bytes),descriptors=pdf.context.enumerateIndirectObjects().map(([,object])=>object).filter((object):object is PDFDict=>object instanceof PDFDict&&object.get(PDFName.of('Type'))?.toString()==='/FontDescriptor');
 expect(descriptors.length).toBeGreaterThanOrEqual(2);
 for(const descriptor of descriptors){
  expect(descriptor.get(PDFName.of('FontName'))?.toString()).toContain('LiberationSans');
  const program=descriptor.lookup(PDFName.of('FontFile2'));expect(program).toBeInstanceOf(PDFRawStream);if(!(program instanceof PDFRawStream))throw Error('TEST_FONT_PROGRAM_MISSING');expect(program.contents.length).toBeGreaterThan(100);
 }
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const loading=getDocument({data:bytes.slice(),disableFontFace:true,verbosity:0});const parsed=await loading.promise;
 try{
  let text='';for(let page=1;page<=parsed.numPages;page++){const content=await (await parsed.getPage(page)).getTextContent();text+=content.items.filter((row):row is Extract<typeof row,{str:string}>=>'str'in row).map(row=>row.str).join(' ');}
  for(const glyph of ['Ä','Ö','Ü','ä','ö','ü','ß','·','€'])expect(text).toContain(glyph);
  const attachments=await parsed.getAttachments();expect(attachments?.size).toBe(1);if(!attachments)throw Error('TEST_XML_ORIGINAL_MISSING');
  const [key,attachment]=[...attachments][0];expect(attachment.filename).toBe('factur-x.xml');
  const xml=await parsed.getAttachmentContent(key);expect(xml).not.toBeNull();if(!xml)throw Error('TEST_XML_ORIGINAL_BYTES_MISSING');
  const sellerXml=new TextDecoder().decode(xml).split('<ram:SellerTradeParty>')[1]?.split('</ram:SellerTradeParty>')[0];
  expect(sellerXml).toBeDefined();expect(sellerXml).toContain('schemeID="VA"');
  expect(sellerXml).not.toMatch(/<ram:ID>/);
  writeEvidence('kreile-s54o-a1-vat.pdf',bytes);writeEvidence('kreile-s54o-a1-vat.xml',xml);
 }finally{await loading.destroy();}
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:issued.receipt.invoiceId,pdfSha256:issued.receipt.pdfSha256}});
 expect(await read()).toEqual(bytes);
 const rows=await sql`SELECT pdf_sha256,octet_length(pdf_content) AS bytes FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({pdf_sha256:issued.receipt.pdfSha256,bytes:bytes.length});
 writeEvidence('kreile-s54o-font-original.pdf',bytes);
 writeEvidence('kreile-s54o-font-roundtrip.json',JSON.stringify({at:new Date().toISOString(),invoiceId:issued.receipt.invoiceId,pdfSha256:issued.receipt.pdfSha256,embeddedFonts:descriptors.length,bytes:bytes.length,realAuthDbOriginalRetry:true,hybridComplete:false},null,2)+'\n');
});

it('S54o C15 technical gate: missing glyph refuses before number allocation and a fresh retry cannot create an original',async()=>{
 const order=await readyOrderForInvoice('TEST S54o \u{1D11E}');
 const input={orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()};
 const before=await sql`SELECT invoice_year,last_number,updated_at::text FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`;
 const result=await withSession(full,()=>issueInvoiceAction(input));expect(result).toMatchObject({code:'VALIDATION_ERROR',message:expect.stringContaining('U+1D11E')});
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toEqual(result);
 const after=await sql`SELECT invoice_year,last_number,updated_at::text FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`;expect(after).toEqual(before);
 expect(await withSession(full,()=>getInvoiceReceiptAction({orderId:order.orderId,clientEventId:input.clientEventId}))).toMatchObject({code:'OK',data:null});
 expect(await sql`SELECT id FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${order.orderId}`).toHaveLength(0);
 writeEvidence('kreile-s54o-glyph-rejection.json',JSON.stringify({at:new Date().toISOString(),orderId:order.orderId,result,before,after,originalAbsent:true,freshRetry:true,fieldCopyPendingPL:true},null,2)+'\n');
});

it('S54o C15 cancellation: unsupported reason preserves original, corrected input uses the existing cancellation path',async()=>{
 const order=await readyOrderForInvoice('TEST S54o Storno Glyph');
 const issued=await withSession(full,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()}));expect(issued.code).toBe('OK');if(issued.code!=='OK')throw Error('TEST_ISSUE_FAILED');
 const input={invoiceId:issued.receipt.invoiceId,expectedVersion:1,clientEventId:randomUUID(),reason:'TEST Storno \u{1D11E}'};
 const rejected=await withSession(full,()=>cancelInvoiceAction(input));expect(rejected).toMatchObject({code:'VALIDATION_ERROR',message:expect.stringContaining('U+1D11E')});
 expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toEqual(rejected);
 expect(await withSession(full,()=>getInvoiceCancellationReceiptAction({invoiceId:input.invoiceId,clientEventId:input.clientEventId}))).toMatchObject({code:'OK',data:null});
 const before=await sql`SELECT status,aggregate_version,pdf_sha256,cancellation_pdf_content FROM public.invoices WHERE tenant_id=${tenant} AND id=${input.invoiceId}::uuid`;
 expect(before).toHaveLength(1);expect(before[0]).toMatchObject({status:'issued',aggregate_version:1,pdf_sha256:issued.receipt.pdfSha256,cancellation_pdf_content:null});
 const corrected={...input,clientEventId:randomUUID(),reason:'TEST Storno korrigierter Text'};
 const cancelled=await withSession(full,()=>cancelInvoiceAction(corrected));expect(cancelled.code).toBe('OK');if(cancelled.code!=='OK')throw Error('TEST_CANCEL_FAILED');
 expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(corrected))))).toMatchObject({code:'OK',replayed:true,receipt:{cancellationPdfSha256:cancelled.receipt.cancellationPdfSha256}});
 const after=await sql`SELECT status,aggregate_version,pdf_sha256,cancellation_pdf_content FROM public.invoices WHERE tenant_id=${tenant} AND id=${input.invoiceId}::uuid`;expect(after[0]).toMatchObject({status:'cancelled',aggregate_version:2,pdf_sha256:issued.receipt.pdfSha256});
 const bytes=new Uint8Array(after[0].cancellation_pdf_content);expect(createHash('sha256').update(bytes).digest('hex')).toBe(cancelled.receipt.cancellationPdfSha256);
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const loading=getDocument({data:bytes.slice(),verbosity:0});
 try{
  const pdf=await loading.promise,attachments=await pdf.getAttachments();expect(attachments?.size).toBe(1);if(!attachments)throw Error('TEST_CANCEL_XML_MISSING');
  const [key,attachment]=[...attachments][0];expect(attachment.filename).toBe('factur-x.xml');
  const xml=await pdf.getAttachmentContent(key);if(!xml)throw Error('TEST_CANCEL_XML_BYTES_MISSING');
  const text=new TextDecoder().decode(xml);
  expect(text).toContain('<ram:TypeCode>384</ram:TypeCode>');expect(text).toContain('<ram:IssuerAssignedID>'+issued.receipt.invoiceNumber+'</ram:IssuerAssignedID>');
  expect(text).toContain('<ram:BilledQuantity unitCode="C62">-1</ram:BilledQuantity>');expect(text).toContain('<ram:ChargeAmount>100.00</ram:ChargeAmount>');expect(text).toContain('<ram:GrandTotalAmount>-119.00</ram:GrandTotalAmount>');
  writeEvidence('kreile-s54o-a5.pdf',bytes);writeEvidence('kreile-s54o-a5.xml',xml);
 }finally{await loading.destroy();}
 writeEvidence('kreile-s54o-cancel-glyph-rejection.json',JSON.stringify({at:new Date().toISOString(),invoiceId:input.invoiceId,rejected,originalPreserved:true,correctedCancellation:cancelled.receipt,freshRetry:true,fieldCopyPendingPL:true},null,2)+'\n');
});

it('S54o C9 boundary: existing DB guards refuse service-role overwrite/delete of a real TEST invoice original',async()=>{
 const order=await readyOrderForInvoice('TEST S54o Originalschutz');
 const issued=await withSession(full,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()}));
 expect(issued.code).toBe('OK');if(issued.code!=='OK')throw Error('TEST_S54O_ISSUE:'+issued.code);
 const rollback=new Error('TEST_S54O_ALWAYS_ROLLBACK');const refusals:Array<{operation:string;code:string;message:string}>=[];
 try{
  await sql.begin(async tx=>{
   await tx`SET LOCAL ROLE service_role`;
   for(const operation of ['overwrite','delete']){
    try{
     await tx.savepoint(async scoped=>{
      if(operation==='overwrite')await scoped`UPDATE public.invoices SET pdf_content=pdf_content||decode('00','hex') WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid RETURNING id`;
      else await scoped`DELETE FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid RETURNING id`;
     });
     throw Error('TEST_ORIGINAL_MUTATION_WAS_NOT_BLOCKED');
    }catch(error){
     const failure=error as {code?:string;message?:string};expect(failure.code).toBe('23514');expect(failure.message).toContain('INVOICE_IMMUTABLE');
     refusals.push({operation,code:failure.code!,message:failure.message!});
    }
   }
   throw rollback;
  });
 }catch(error){if(error!==rollback)throw error;}
 const rows=await sql`SELECT contract_version,pdf_sha256,pdf_content FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(rows).toHaveLength(1);expect(rows[0].contract_version).toBe(1);expect(rows[0].pdf_sha256).toBe(issued.receipt.pdfSha256);expect(createHash('sha256').update(rows[0].pdf_content).digest('hex')).toBe(issued.receipt.pdfSha256);
 // Inspect the statement-level guard; never execute table-wide TRUNCATE.
 const triggers=await sql`SELECT tgname,tgenabled,pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgrelid='public.invoices'::regclass AND tgname='invoices_f14_truncate_guard'`;
 expect(triggers).toHaveLength(1);expect(triggers[0]).toMatchObject({tgenabled:'O',definition:expect.stringContaining('BEFORE TRUNCATE')});
 writeEvidence('kreile-s54o-original-guard.json',JSON.stringify({at:new Date().toISOString(),invoiceId:issued.receipt.invoiceId,pdfSha256:issued.receipt.pdfSha256,refusals,originalPreserved:true,allWriteAttemptsRolledBack:true,truncateExecuted:false,truncateTrigger:triggers[0]},null,2)+'\n');
});
