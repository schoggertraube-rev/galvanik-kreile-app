// @vitest-environment node
// A38a A2: only initial TEST customer facts are synthetic; invoice/action/Auth/DB/PDF are real.
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyOrderForInvoice} from '../../../e2e/ablauf/orderFixture';
import {issueInvoiceAction,getInvoiceReceiptAction} from '@/app/actions/invoices.actions';
import {saveCustomerAgreementAction,revokeCustomerAgreementAction} from '@/app/actions/customers.actions';

it('A38a A1 freezes firm terms without a customer discount when credit terms are disabled',async()=>{
 const order=await readyOrderForInvoice('TEST S38a firm source');
 await sql`UPDATE public.customers SET ziel_freigeschaltet=false,ziel_tage=NULL,skonto_prozent=NULL,skonto_tage=NULL
  WHERE tenant_id=${tenant} AND id=${order.customerId}`;
 const issued=await withSession(full,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()}));
 expect(issued).toMatchObject({code:'OK'});
 if(issued.code!=='OK')throw Error('TEST_S38A_FIRM_ISSUE_REQUIRED');
 const [stored]=await sql`SELECT snapshot,payment_term_days FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(stored).toMatchObject({payment_term_days:14,snapshot:{terms:{quelle:'firma',ziel_tage:14,skonto_prozent:null,skonto_tage:null}}});
});

it('A38a A2 captures customer target and discount in one real original; later changes never replace them',async()=>{
 const customerId=await customerFixture('TEST S38a customer terms');
 await sql`UPDATE public.customers SET ziel_tage=30,skonto_prozent=2,skonto_tage=8
  WHERE tenant_id=${tenant} AND id=${customerId}`;
 const order=await readyOrderForInvoice('TEST S38a original terms','pickup',customerId);
 const input={orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()};
 const issued=await withSession(full,()=>issueInvoiceAction(input));
 expect(issued).toMatchObject({code:'OK'});
 if(issued.code!=='OK')throw Error('TEST_S38A_ISSUE_REQUIRED:'+issued.code);
 const [original]=await sql`SELECT snapshot,pdf_sha256,payment_term_days,(due_date-(issued_at AT TIME ZONE 'Europe/Berlin')::date)::int AS days
  FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(original).toMatchObject({payment_term_days:30,days:30,snapshot:{paymentTermDays:30,terms:{quelle:'kunde',ziel_tage:30,skonto_prozent:2,skonto_tage:8}}});
 // A2b: inspect the actual immutable container, not an independently rendered XML sample.
 const [stored]=await sql`SELECT pdf_content,to_char((issued_at AT TIME ZONE 'Europe/Berlin')::date+8,'DD.MM.YYYY') AS skonto_date FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 const bytes=new Uint8Array(stored.pdf_content);
 expect(createHash('sha256').update(bytes).digest('hex')).toBe(issued.receipt.pdfSha256);
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:bytes.slice(),verbosity:0});
 try{
  const document=await task.promise,attachments=await document.getAttachments();
  expect(attachments?.size).toBe(1);
  if(!attachments)throw Error('TEST_S38A_XML_ORIGINAL_REQUIRED');
  const [id,attachment]=[...attachments][0];expect(attachment.filename).toBe('factur-x.xml');
  const xml=await document.getAttachmentContent(id);if(!xml)throw Error('TEST_S38A_XML_BYTES_REQUIRED');
  expect(new TextDecoder().decode(xml)).toContain('#SKONTO#TAGE=8#PROZENT=2.00#\n');
  let visible='';for(let page=1;page<=document.numPages;page++){
   const content=await(await document.getPage(page)).getTextContent();
   visible+=content.items.filter((row):row is Extract<typeof row,{str:string}>=>'str'in row).map(row=>row.str).join(' ');
  }
  expect(visible).toContain('Bei Zahlung bis '+stored.skonto_date+' (8 Tage) erhalten Sie 2 % Skonto.');
  const output=path.resolve('.git/kreile-s38a-skonto-evidence');mkdirSync(output,{recursive:true});
  writeFileSync(path.join(output,'kreile-s54o-a2.pdf'),bytes);
  writeFileSync(path.join(output,'kreile-s54o-a2.xml'),xml);
  writeFileSync(path.join(output,'kreile-s54o-a2.json'),JSON.stringify({invoiceId:issued.receipt.invoiceId,pdfSha256:issued.receipt.pdfSha256,tenant,source:'actual S38a A2 action/Auth/DB original'},null,2));
 }finally{await task.destroy();}
 await sql`UPDATE public.customers SET ziel_tage=45,skonto_prozent=3,skonto_tage=10 WHERE tenant_id=${tenant} AND id=${customerId}`;
 expect(await withSession(full,()=>getInvoiceReceiptAction({orderId:order.orderId,clientEventId:input.clientEventId}))).toMatchObject({code:'OK',data:{invoiceId:issued.receipt.invoiceId}});
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:issued.receipt.invoiceId}});
 const [after]=await sql`SELECT snapshot,pdf_sha256,payment_term_days,(due_date-(issued_at AT TIME ZONE 'Europe/Berlin')::date)::int AS days
  FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(after).toEqual(original);
});

it('A38a A3/A4 uses the active agreement ahead of customer terms and retains the original after revocation',async()=>{
 const customerId=await customerFixture('TEST S38a agreement source');
 await sql`UPDATE public.customers SET ziel_tage=30,skonto_prozent=2,skonto_tage=8 WHERE tenant_id=${tenant} AND id=${customerId}`;
 const order=await readyOrderForInvoice('TEST S38a agreement original','pickup',customerId);
 const agreement=await withSession(full,()=>saveCustomerAgreementAction({customerId,orderId:order.orderId,clientKey:randomUUID(),type:'zahlungsziel',targetDays:45,reason:'TEST S38a A3 actual agreement'}));
 expect(agreement).toMatchObject({code:'OK'});
 if(agreement.code!=='OK')throw Error('TEST_S38A_AGREEMENT_REQUIRED');
 const [current]=await sql`SELECT version FROM public.orders WHERE tenant_id=${tenant} AND id=${order.orderId}`;
 const input={orderId:order.orderId,expectedVersion:current.version,clientEventId:randomUUID()};
 const issued=await withSession(full,()=>issueInvoiceAction(input));
 expect(issued).toMatchObject({code:'OK'});
 if(issued.code!=='OK')throw Error('TEST_S38A_AGREEMENT_INVOICE_REQUIRED');
 const [original]=await sql`SELECT snapshot,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(original.snapshot.terms).toEqual({quelle:'absprache',ziel_tage:45,skonto_prozent:2,skonto_tage:8});
 expect(await withSession(full,()=>revokeCustomerAgreementAction({agreementId:agreement.agreement.id,version:agreement.agreement.version,clientKey:randomUUID(),reason:'TEST S38a A4 revoked after issue'}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:issued.receipt.invoiceId}});
 expect(await sql`SELECT snapshot,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`).toEqual([original]);
});
