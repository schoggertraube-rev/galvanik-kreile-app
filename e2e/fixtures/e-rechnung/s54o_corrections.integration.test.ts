import {withRestoredTestSource} from '@/test/fixtures/restoredTestSource';
// @vitest-environment node
// Genuine Actions/Auth/DB/originals; legacy invalid values are explicit TEST setup.
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';import path from 'node:path';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../ablauf/replayHarness';
import {readyOrderForInvoice} from '../../ablauf/orderFixture';
import {issueInvoiceAction,cancelInvoiceAction,getInvoiceCancellationReceiptAction} from '@/app/actions/invoices.actions';
import {saveCompanySettingsAction} from '@/app/actions/settings.actions';
import {E_INVOICE_COPY} from '@/ui/situationCatalog';

it('KORR-S54o K1 rejects both legacy malformed VAT identities before number and settings save, valid DE and ATU originals pass',async()=>{
 const order=await readyOrderForInvoice('TEST correction VAT identity'),input={orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()};
 const counter=()=>sql`SELECT invoice_year,last_number,updated_at::text FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`;
 const before=await counter();
 await withRestoredTestSource({label:'TEST seller legacy VAT',read:()=>sql`SELECT tax_id,tax_number FROM public.company_settings WHERE tenant_id=${tenant}`,restore:async rows=>{if(rows.length!==1)throw Error('TEST_SELLER_REQUIRED');await sql`UPDATE public.company_settings SET tax_id=${rows[0].tax_id},tax_number=${rows[0].tax_number} WHERE tenant_id=${tenant}`;}
 },async()=>{
 await sql`UPDATE public.company_settings SET tax_id='123/456/789',tax_number='123/456/789' WHERE tenant_id=${tenant}`;
 expect(await withSession(full,()=>issueInvoiceAction(input))).toMatchObject({code:'VALIDATION_ERROR',source:{kind:'settings',field:'vatId'},message:E_INVOICE_COPY.missingSource('vatId')});expect(await counter()).toEqual(before);
 });
 const company={companyName:'TEST KORR issuer',street:'TEST Weg 1',zip:'70176',city:'Stuttgart',country:'Deutschland',taxId:'123/456/789',taxNumber:'123/456/789',iban:'DE02120300000000202051',bic:'BYLADEM1001',bankName:'TEST Bank',paymentTermDays:14,logoUrl:'/TEST-logo.png'};
 expect(await withSession(full,()=>saveCompanySettingsAction(company))).toMatchObject({code:'VALIDATION_ERROR',field:'taxId'});
 expect(await withSession(full,()=>saveCompanySettingsAction({...company,taxId:'DE123456789'}))).toMatchObject({code:'OK'});
 await withRestoredTestSource({label:'TEST customer legacy VAT',read:()=>sql`SELECT vat_id FROM public.customers WHERE tenant_id=${tenant} AND id=${order.customerId}`,restore:async rows=>{if(rows.length!==1)throw Error('TEST_CUSTOMER_REQUIRED');await sql`UPDATE public.customers SET vat_id=${rows[0].vat_id} WHERE tenant_id=${tenant} AND id=${order.customerId}`;}
 },async()=>{
 await sql`UPDATE public.customers SET vat_id='123456789' WHERE tenant_id=${tenant} AND id=${order.customerId}`;
 expect(await withSession(full,()=>issueInvoiceAction(input))).toMatchObject({code:'VALIDATION_ERROR',source:{kind:'customer',field:'vatId'}});expect(await counter()).toEqual(before);
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${order.orderId}`).toEqual([{n:0}]);
 });
 await sql`UPDATE public.customers SET vat_id='ATU12345678' WHERE tenant_id=${tenant} AND id=${order.customerId}`;
 const issued=await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))));expect(issued.code).toBe('OK');if(issued.code!=='OK')throw Error('CORRECTION_VALID_VAT_REQUIRED');
 const [stored]=await sql`SELECT pdf_content,pdf_sha256,snapshot FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(stored.snapshot.seller.vatId).toBe('DE123456789');expect(stored.snapshot.customer.vatId).toBe('ATU12345678');
 await evidence('k1-de-atu',stored.pdf_content,stored.pdf_sha256,issued.receipt.invoiceId);
});

it('KORR-S54o K2 abort does not consume a number, parallel cancellations allocate exactly the next shared number and replay the same original',async()=>{
 const order=await readyOrderForInvoice('TEST correction cancellation number');
 const issued=await withSession(full,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()}));if(issued.code!=='OK')throw Error('TEST_ORIGINAL_REQUIRED');
 const before=await sql`SELECT snapshot,pdf_content,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 const counter=()=>sql`SELECT invoice_year,last_number,updated_at::text FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`;
 const originalCounter=await counter(),input={invoiceId:issued.receipt.invoiceId,expectedVersion:1,clientEventId:randomUUID(),reason:'TEST cancellation unsupported \u{1D11E}'};
 expect(await withSession(full,()=>cancelInvoiceAction(input))).toMatchObject({code:'VALIDATION_ERROR'});expect(await counter()).toEqual(originalCounter);
 const valid={...input,reason:'TEST cancellation with own number'};
 const attempts=await Promise.all([valid,{...valid,clientEventId:randomUUID()}].map(value=>withSession(full,()=>cancelInvoiceAction(value))));
 const completed=attempts.filter(value=>value.code==='OK');expect(completed).toHaveLength(1);const cancelled=completed[0];if(cancelled.code!=='OK')throw Error('CANCELLATION_REQUIRED');
 const number=cancelled.receipt.cancellationNumber;expect(number).toBe('R-'+originalCounter[0].invoice_year+'-'+String(originalCounter[0].last_number+1).padStart(4,'0'));
 const winner={...valid,clientEventId:cancelled.receipt.clientEventId};
 expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(winner))))).toMatchObject({code:'OK',replayed:true,receipt:{cancellationNumber:number}});
 expect(await withSession(full,()=>getInvoiceCancellationReceiptAction({invoiceId:valid.invoiceId,clientEventId:winner.clientEventId}))).toMatchObject({code:'OK',data:{cancellationNumber:number}});
 expect((await counter())[0].last_number).toBe(originalCounter[0].last_number+1);
 const [after]=await sql`SELECT snapshot,pdf_content,pdf_sha256,cancellation_pdf_content,cancellation_pdf_sha256,cancellation_invoice_number FROM public.invoices WHERE tenant_id=${tenant} AND id=${valid.invoiceId}::uuid`;
 expect(after.snapshot).toEqual(before[0].snapshot);expect(Buffer.from(after.pdf_content)).toEqual(Buffer.from(before[0].pdf_content));expect(after.pdf_sha256).toBe(before[0].pdf_sha256);expect(after.cancellation_invoice_number).toBe(number);
 await expect(sql`UPDATE public.invoices SET cancellation_invoice_number='R-2026-999999' WHERE tenant_id=${tenant} AND id=${valid.invoiceId}::uuid`).rejects.toMatchObject({code:'23514'});
 const xml=await evidence('k2-cancel',after.cancellation_pdf_content,after.cancellation_pdf_sha256,valid.invoiceId,{number:number!,original:issued.receipt.invoiceNumber});
 expect(xml).toContain('<rsm:ExchangedDocument><ram:ID>'+number+'</ram:ID><ram:TypeCode>384</ram:TypeCode>');expect(xml).toContain('<ram:IssuerAssignedID>'+issued.receipt.invoiceNumber+'</ram:IssuerAssignedID>');
 const replacement=await withSession(full,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()}));expect(replacement.code).toBe('OK');if(replacement.code!=='OK')throw Error('REPLACEMENT_REQUIRED');
 expect(replacement.receipt.invoiceNumber).toBe('R-'+originalCounter[0].invoice_year+'-'+String(originalCounter[0].last_number+2).padStart(4,'0'));
 const nextCancel=await withSession(full,()=>cancelInvoiceAction({invoiceId:replacement.receipt.invoiceId,expectedVersion:1,clientEventId:randomUUID(),reason:'TEST next separate cancellation number'}));expect(nextCancel.code).toBe('OK');if(nextCancel.code!=='OK')throw Error('NEXT_CANCELLATION_REQUIRED');
 expect(nextCancel.receipt.cancellationNumber).toBe('R-'+originalCounter[0].invoice_year+'-'+String(originalCounter[0].last_number+3).padStart(4,'0'));expect((await counter())[0].last_number).toBe(originalCounter[0].last_number+3);
});

async function evidence(name:string,content:Uint8Array,sha:string,invoiceId:string,cancellation?:{number:string;original:string}){
 const bytes=Uint8Array.from(content);expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha);
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),task=getDocument({data:bytes.slice(),verbosity:0});
 try{const pdf=await task.promise,attachments=await pdf.getAttachments();expect(attachments?.size).toBe(1);if(!attachments)throw Error('ACTUAL_XML_REQUIRED');const [key]=[...attachments][0],xml=await pdf.getAttachmentContent(key);if(!xml)throw Error('ACTUAL_XML_BYTES_REQUIRED');
 if(cancellation){expect(pdf.numPages).toBe(1);const content=await(await pdf.getPage(1)).getTextContent(),items=content.items.flatMap(item=>'str'in item?[item.str]:[]);expect(items.join(' ').replace(/\s+/g,' ')).toContain(E_INVOICE_COPY.cancellationTitle(cancellation.number,cancellation.original));for(const number of [cancellation.number,cancellation.original])expect(items.some(item=>item.includes(number))).toBe(true);}
 if(process.env.S54O_EVIDENCE_DIR){mkdirSync(process.env.S54O_EVIDENCE_DIR,{recursive:true});const stem=path.join(process.env.S54O_EVIDENCE_DIR,'kreile-s54o-'+name);writeFileSync(stem+'.pdf',bytes);writeFileSync(stem+'.xml',xml);writeFileSync(stem+'.json',JSON.stringify({invoiceId,pdfSha256:sha,source:'genuine KORR-S54o action and immutable stored original'},null,2)+'\n');}return new TextDecoder().decode(xml);
 }finally{await task.destroy();}
}
