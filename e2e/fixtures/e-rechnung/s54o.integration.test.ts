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
import {issueInvoiceAction} from '@/app/actions/invoices.actions';
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
