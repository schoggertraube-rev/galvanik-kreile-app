// @vitest-environment node
import {createHash,randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {full,sql,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyOrderForInvoice} from '../../../e2e/ablauf/orderFixture';
import {getInvoiceReceiptAction,issueInvoiceAction} from '@/app/actions/invoices.actions';
import {confirmPaymentAction,setPaymentModeAction} from '@/app/actions/payments.actions';

it('St-4 hält die Kassenwahl im Rechnungsoriginal und die Zahlung getrennt',async()=>{
 const order=await readyOrderForInvoice('St-4 Bar bei Abholung');
 expect(await withSession(full,()=>setPaymentModeAction({
  orderId:order.orderId,paymentMode:'abholung',expectedVersion:0,clientEventId:randomUUID(),
 }))).toMatchObject({code:'OK'});
 const input={
  orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID(),paymentMethodAtIssue:'bar' as const,
 };
 const issued=await withSession(full,()=>issueInvoiceAction(input));
 if(issued.code!=='OK')throw Error('TEST_ST4_ISSUE:'+issued.code+':'+issued.message);
 const [original]=await sql`SELECT payment_status,payment_method,snapshot,pdf_content FROM public.invoices
  WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(original).toMatchObject({payment_status:'offen',payment_method:null,snapshot:{paymentMethodAtIssue:'bar'}});
 expect(createHash('sha256').update(original.pdf_content).digest('hex')).toBe(issued.receipt.pdfSha256);

 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const loading=getDocument({data:new Uint8Array(original.pdf_content),verbosity:0});
 try{
  const pdf=await loading.promise;
  const attachments=await pdf.getAttachments();
  const attachment=attachments&&[...attachments].find(([,file])=>file.filename==='factur-x.xml');
  if(!attachment)throw Error('TEST_ST4_ORIGINAL_XML_REQUIRED');
  const xml=await pdf.getAttachmentContent(attachment[0]);
  if(!xml)throw Error('TEST_ST4_ORIGINAL_XML_REQUIRED');
  expect(new TextDecoder().decode(xml)).toContain('<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>10</ram:TypeCode>');
 }finally{await loading.destroy();}

 expect(await withSession(full,()=>issueInvoiceAction(structuredClone(input)))).toMatchObject({
  code:'OK',replayed:true,receipt:{invoiceId:issued.receipt.invoiceId,pdfSha256:issued.receipt.pdfSha256},
 });
 expect(await withSession(full,()=>issueInvoiceAction({...input,paymentMethodAtIssue:'karte'}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>confirmPaymentAction({
  invoiceId:issued.receipt.invoiceId,amount:issued.receipt.grossAmountCents,expectedOpenAmountCents:issued.receipt.grossAmountCents,
  expectedVersion:0,method:'karte',clientEventId:randomUUID(),
 }))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getInvoiceReceiptAction({orderId:order.orderId,clientEventId:input.clientEventId}))).toMatchObject({
  code:'OK',data:{pdfSha256:issued.receipt.pdfSha256},
 });
 const [paid]=await sql`SELECT payment_method,snapshot,pdf_content FROM public.invoices
  WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(paid.payment_method).toBe('karte');
 expect(paid.snapshot).toEqual(original.snapshot);
 expect(paid.pdf_content).toEqual(original.pdf_content);
});
