// @vitest-environment node
// Real invoice action, cookie/Auth, Loopback DB and immutable original. TEST only.
import {createHash,randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {PDFDict,PDFDocument,PDFName,PDFRawStream} from 'pdf-lib';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../ablauf/replayHarness';
import {readSettingsAction,saveCompanySettingsAction} from '@/app/actions/settings.actions';
import {SALES_STAGE_FEATURES} from '@/modules/fundament/public';
import {readyOrderForInvoice} from '../../ablauf/orderFixture';
import {issueInvoiceAction,cancelInvoiceAction,getInvoiceReceiptAction,getInvoiceCancellationReceiptAction} from '@/app/actions/invoices.actions';
import {GET as invoicePdf} from '@/app/api/invoices/[invoiceId]/pdf/route';
import {renderToBuffer} from '@react-pdf/renderer';
import {createImmutableInvoicePdfDocument,type ImmutableInvoiceSnapshot,type ImmutableInvoiceSnapshotV3} from '@/lib/pdf/ImmutableInvoiceDocument';
import {readInvoiceVat} from '@/modules/accounting/public';

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
 writeFileSync('.git/kreile-s54o-legacy-'+schemaVersion+'-refusal.json',JSON.stringify({at:new Date().toISOString(),schemaVersion,syntheticLegacyFixture:true,allDbGuardsActive:true,actualRefusalAndAudit:true,originalAndCounterUnchanged:true,invoiceId:legacyId},null,2)+'\n');
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
 writeFileSync('.git/kreile-s54o-tax-settings-real.json',JSON.stringify({at:new Date().toISOString(),tenant,actor:full.actorId,separateSources:true,legacyPreserved:true,authorityUnchanged:true},null,2)+'\n');
});

it('S54o v3: absent seller identity refuses before allocation; actual settings correction and same-key retry freeze tax number and original unit',async()=>{
 const order=await readyOrderForInvoice('TEST S54o v3 required seller');
 const input={orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()};
 const company={companyName:'TEST S54o v3 issuer',street:'TEST Weg 1',zip:'70176',city:'Stuttgart',country:'Deutschland',taxId:'',taxNumber:'',iban:'DE02120300000000202051',bic:'BYLADEM1001',bankName:'TEST Bank',paymentTermDays:14,logoUrl:'/TEST-logo.png'};
 expect(await withSession(full,()=>saveCompanySettingsAction(company))).toEqual({code:'OK'});
 const before=await sql`SELECT * FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`;
 const refused=await withSession(full,()=>issueInvoiceAction(input));
 expect(refused).toMatchObject({code:'VALIDATION_ERROR',message:'Fehlt für die E-Rechnung: USt-IdNr. oder Steuernummer · in Einstellungen eintragen',source:{kind:'settings',field:'taxId'}});
 expect(await sql`SELECT * FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`).toEqual(before);
 expect(await withSession(full,()=>getInvoiceReceiptAction({orderId:order.orderId,clientEventId:input.clientEventId}))).toMatchObject({code:'OK',data:null});
 const corrected={...company,taxNumber:'123/456/78901'};
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
  expect(attachments?.size).toBe(1);if(!attachments)throw Error('TEST_XML_ORIGINAL_MISSING');
  const [key,attachment]=[...attachments][0];expect(attachment.filename).toBe('factur-x.xml');
  const embedded=await document.getAttachmentContent(key);expect(embedded).not.toBeNull();if(!embedded)throw Error('TEST_XML_BYTES_MISSING');
  const xmlText=new TextDecoder().decode(embedded);
  expect(xmlText).toContain('<ram:SellerTradeParty><ram:ID>123/456/78901</ram:ID>');
  expect(xmlText).toContain('<ram:ID schemeID="FC">123/456/78901</ram:ID>');
  expect(xmlText).not.toContain('schemeID="VA"');
  writeFileSync('.git/kreile-s54o-a1.pdf',bytes);writeFileSync('.git/kreile-s54o-a1.xml',embedded);
 }finally{await task.destroy();}
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:result.receipt.invoiceId,pdfSha256:result.receipt.pdfSha256}});
 writeFileSync('.git/kreile-s54o-v3-actual.json',JSON.stringify({at:new Date().toISOString(),tenant,invoiceId:result.receipt.invoiceId,pdfSha256:result.receipt.pdfSha256,originalUnit:source[0].unit,snapshot:stored[0].snapshot,counterUnchangedOnRefusal:true,existingWriterAndFreshRetry:true,pairedPdf:'.git/kreile-s54o-a1.pdf',pairedXml:'.git/kreile-s54o-a1.xml'},null,2)+'\n');
});

it('S54o font preparation: real issue/read/retry embeds regular and bold invoice fonts and preserves original bytes',async()=>{
 const order=await readyOrderForInvoice('TEST S54o ÄÖÜ äöü ß · €');
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
  writeFileSync('.git/kreile-s54o-a1-vat.pdf',bytes);writeFileSync('.git/kreile-s54o-a1-vat.xml',xml);
 }finally{await loading.destroy();}
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:issued.receipt.invoiceId,pdfSha256:issued.receipt.pdfSha256}});
 expect(await read()).toEqual(bytes);
 const rows=await sql`SELECT pdf_sha256,octet_length(pdf_content) AS bytes FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({pdf_sha256:issued.receipt.pdfSha256,bytes:bytes.length});
 writeFileSync('.git/kreile-s54o-font-original.pdf',bytes);
 writeFileSync('.git/kreile-s54o-font-roundtrip.json',JSON.stringify({at:new Date().toISOString(),invoiceId:issued.receipt.invoiceId,pdfSha256:issued.receipt.pdfSha256,embeddedFonts:descriptors.length,bytes:bytes.length,realAuthDbOriginalRetry:true,hybridComplete:false},null,2)+'\n');
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
 writeFileSync('.git/kreile-s54o-glyph-rejection.json',JSON.stringify({at:new Date().toISOString(),orderId:order.orderId,result,before,after,originalAbsent:true,freshRetry:true,fieldCopyPendingPL:true},null,2)+'\n');
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
  writeFileSync('.git/kreile-s54o-a5.pdf',bytes);writeFileSync('.git/kreile-s54o-a5.xml',xml);
 }finally{await loading.destroy();}
 writeFileSync('.git/kreile-s54o-cancel-glyph-rejection.json',JSON.stringify({at:new Date().toISOString(),invoiceId:input.invoiceId,rejected,originalPreserved:true,correctedCancellation:cancelled.receipt,freshRetry:true,fieldCopyPendingPL:true},null,2)+'\n');
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
 writeFileSync('.git/kreile-s54o-original-guard.json',JSON.stringify({at:new Date().toISOString(),invoiceId:issued.receipt.invoiceId,pdfSha256:issued.receipt.pdfSha256,refusals,originalPreserved:true,allWriteAttemptsRolledBack:true,truncateExecuted:false,truncateTrigger:triggers[0]},null,2)+'\n');
});
