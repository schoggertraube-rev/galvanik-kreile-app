// @vitest-environment node
// Real document rendering and original storage; only Graph/OAuth is doubled.
import {it,expect,vi} from 'vitest';
import {randomUUID,createHash} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,nativeFetch} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder,deliveryNoteInputFixture} from '../../../e2e/ablauf/orderFixture';
import {storeOrderPhoto,TEST_PHOTO_BYTES} from '../../../e2e/ablauf/photoFixture';
import {setEvidenceVisibilityAction,getDomainAttachmentsAction} from '@/app/actions/domainAttachments.actions';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
import {createQuoteAction,readQuotePdfAction} from '@/app/actions/quotes.actions';
import {confirmPaymentAction} from '@/app/actions/payments.actions';
import {generateDeliveryNote} from '@/app/actions/pdf.actions';
import {readQuoteMailOriginal} from '@/lib/server/communicationOriginalPort';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';

it.each([0,1,3])('F11-13 existing customer mail/PDF ways never export internal photos with %i explicitly released photos, and original-byte retries stay unchanged',async visible=>{
 const order=await readyInvoiceOrder('TEST S11 Kundenwege '+visible);
 // The mandatory part photo already existed, internal, before invoice rendering.
 const keys:string[]=[];
 for(let index=0;index<3;index++){
  const id=await storeOrderPhoto(order.orderId),key='legacy-scan-upload:'+id;keys.push(key);
  if(index<visible)expect(await withSession(full,()=>setEvidenceVisibilityAction({evidenceKey:key,customerVisible:true,expectedVersion:0,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 }
 const read=await withSession(full,()=>getDomainAttachmentsAction({targetType:'ORDER',targetId:order.orderId}));
 expect(read).toMatchObject({code:'OK'});if(read.code!=='OK')throw Error('TEST_S11_CUSTOMER_PHOTOS');
 expect(read.data.filter(row=>row.visibility?.customerVisible)).toHaveLength(visible);
 expect(await sql`SELECT count(*)::integer AS n FROM private.evidence_visibility_events WHERE tenant_id=${tenant} AND evidence_key=ANY(${keys}) AND record_kind='change'`).toEqual([{n:visible}]);
 const quote=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId:order.customerId,dueDate:'2027-05-15',note:'TEST S11 Kundenwege',positions:[{name:'TEST S11 echtes KV-PDF',quantity:1,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:1000,lineTotalCents:1000}]}));
 if(quote.code!=='OK')throw Error('TEST_S11_CUSTOMER_QUOTE:'+JSON.stringify(quote));
 const original=await withSession(full,()=>readQuotePdfAction({quoteId:quote.quote.quoteId}));
 if(original.code!=='OK')throw Error('TEST_S11_CUSTOMER_QUOTE_PDF:'+original.code);
 expect(Buffer.from(original.pdf).toString('latin1')).not.toContain('/Subtype /Image');
 const payloads:Array<{message:{attachments?:Array<{contentType:string;contentBytes:string}>}}>=[];
 const provider=vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-S11-customer-boundary-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){payloads.push(JSON.parse(String(init?.body)));return new Response(null,{status:202});}
  return nativeFetch(request,init);
 });
 try{
  const base={targetType:'ORDER' as const,targetId:order.orderId,subject:'TEST S11 Nachricht ohne Foto',body:'TEST S11 unveränderte Belege'};
  const plain={...base,clientRequestId:randomUUID()};
  const invoice={...base,clientRequestId:randomUUID(),attachment:{kind:'INVOICE' as const,documentId:order.invoice.invoiceId},expectedInvoiceIds:[order.invoice.invoiceId]};
  const quoted={...base,targetType:'CUSTOMER' as const,targetId:order.customerId,clientRequestId:randomUUID(),attachment:{kind:'QUOTE' as const,documentId:quote.quote.quoteId}};
  for(const input of [plain,invoice,quoted]){
   expect(await withSession(full,()=>sendCustomerMailAction(input))).toMatchObject({code:'OK'});
   expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{replayed:true}});
  }
  expect(payloads).toHaveLength(3);expect(payloads.map(row=>row.message.attachments?.length??0)).toEqual([0,1,1]);
  const originals=payloads.flatMap(row=>row.message.attachments??[]);
  for(const attachment of originals){
   expect(attachment.contentType).toBe('application/pdf');const bytes=Buffer.from(attachment.contentBytes,'base64');
   expect(bytes.subarray(0,5).toString()).toBe('%PDF-');expect(bytes.includes(TEST_PHOTO_BYTES)).toBe(false);
   expect(bytes.toString('latin1')).not.toContain('/Subtype /Image');
  }
  const proof=await sql`SELECT payload->'document' AS document FROM public.events WHERE tenant_id=${tenant} AND event_type='COMMUNICATION_DOCUMENT_PREPARED_V1' AND correlation_id=${quoted.clientRequestId}::uuid`;
  expect(proof).toHaveLength(1);
  expect(proof[0].document).toMatchObject({id:quote.quote.quoteId,kind:'QUOTE',original:{path:expect.any(String),fileBytes:expect.any(Number)}});
  expect(Buffer.from(await readQuoteMailOriginal(proof[0].document.original,proof[0].document.sha256))).toEqual(Buffer.from(originals[1].contentBytes,'base64'));
  const digest=createHash('sha256').update(Buffer.from(originals[0].contentBytes,'base64')).digest('hex');
  expect(await sql`SELECT pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${order.invoice.invoiceId}::uuid`).toEqual([{pdf_sha256:digest}]);
 }finally{provider.mockRestore();}
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,expectedVersion:0,method:'bar',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const input=await deliveryNoteInputFixture([order.orderId]),delivery=await withSession(full,()=>generateDeliveryNote(input));
 if(delivery.code!=='OK')throw Error('TEST_S11_CUSTOMER_DELIVERY:'+delivery.code);
 // A configured company logo is legitimate. Inspect actual PDF image operators:
 // the secured TEST photo is 1x1; it must not be embedded as a customer image.
 const task=getDocument({data:new Uint8Array(Buffer.from(delivery.pdfBase64,'base64')),useSystemFonts:true});
 try{
  const pdf=await task.promise;
  for(let page=1;page<=pdf.numPages;page++){
   const operators=await (await pdf.getPage(page)).getOperatorList();
   for(let index=0;index<operators.fnArray.length;index++){
    if(operators.fnArray[index]===OPS.paintImageXObject)expect(operators.argsArray[index].slice(1,3)).not.toEqual([1,1]);
    if(operators.fnArray[index]===OPS.paintInlineImageXObject)expect(operators.argsArray[index][0]).not.toMatchObject({width:1,height:1});
   }
  }
 }finally{await task.destroy();}
 expect(await withSession(full,()=>generateDeliveryNote(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,pdfBase64:delivery.pdfBase64});
});
