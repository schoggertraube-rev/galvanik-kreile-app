// @vitest-environment node
// Real invoice action, cookie/Auth, Loopback DB and immutable original. TEST only.
import {createHash,randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {PDFDict,PDFDocument,PDFName,PDFRawStream} from 'pdf-lib';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../ablauf/replayHarness';
import {readyOrderForInvoice} from '../../ablauf/orderFixture';
import {issueInvoiceAction,cancelInvoiceAction,getInvoiceReceiptAction,getInvoiceCancellationReceiptAction} from '@/app/actions/invoices.actions';
import {GET as invoicePdf} from '@/app/api/invoices/[invoiceId]/pdf/route';

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
 const after=await sql`SELECT status,aggregate_version,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${input.invoiceId}::uuid`;expect(after[0]).toMatchObject({status:'cancelled',aggregate_version:2,pdf_sha256:issued.receipt.pdfSha256});
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
