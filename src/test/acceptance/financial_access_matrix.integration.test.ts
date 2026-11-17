// @vitest-environment node
// Isolated TEST fixtures; all commands, authorization, Postgres, PDF and Storage are real.
// Only Microsoft's external HTTP boundary is doubled for the outgoing mail case.
import {randomUUID,createHash} from 'node:crypto';
import {createElement} from 'react';
import {Document,Page,Text,renderToBuffer} from '@react-pdf/renderer';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture,nativeFetch} from '../../../e2e/ablauf/replayHarness';
import {readyOrderForInvoice,readyInvoiceOrder,deliveryNoteInputFixture} from '../../../e2e/ablauf/orderFixture';
import {cancelInvoiceAction,getInvoiceCancellationReceiptAction} from '@/app/actions/invoices.actions';
import {issueInvoiceAction} from '@/app/actions/invoices.actions';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
import {confirmPaymentAction,setPaymentModeAction,getOrderPaymentStateAction} from '@/app/actions/payments.actions';
import {getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {generateDeliveryNote} from '@/app/actions/pdf.actions';
import {prepareIntakeFileAction,finishIntakeFileAction,assignIntakeCustomerAction,getIntakeAssignmentAction,getIntakeCaptureAction,getIncomingInvoiceAction,saveIntakeTaskAction,getIntakeTaskAction} from '@/app/actions/eingang.actions';
import {readInvoicePdf} from '@/lib/server/invoiceRead';
import {resolveAuthorization} from '@/lib/server/authorization';
import {getAnalyseOverview} from '@/features/analyse/analyse.actions';
import {createCustomerAction} from '@/app/actions/customers.actions';

it('KORR-RECHTE financial task contents follow their one assigned area, including a fresh real task read and write retry',async()=>{
 const denied=await createFixture(['auftraege']);
 for(const area of ['preise','zahlungen','buchhaltung'] as const){
  const actor=await createFixture([area]),input={clientKey:randomUUID(),version:0,kind:'aufgabe' as const,title:'TEST finanzielle Aufgabe '+area,dueDate:'2027-05-15',time:null,forLogin:null,forArea:area,reference:{type:'allgemein' as const,id:null},note:'TEST Original bleibt unveraendert'};
  const created=await withSession(full,()=>saveIntakeTaskAction(input));expect(created).toMatchObject({code:'OK'});if(created.code!=='OK')throw Error('TEST_FINANCIAL_TASK_WRITER');
  expect(await withSession(full,()=>saveIntakeTaskAction(structuredClone(input)))).toMatchObject({code:'OK',replayed:true,task:{id:created.task.id}});
  expect(await withSession(actor,()=>getIntakeTaskAction({taskId:created.task.id}))).toMatchObject({code:'OK',task:{fuer_bereich:area,notiz:input.note}});
  expect(await withSession(denied,()=>getIntakeTaskAction({taskId:created.task.id}))).toMatchObject({code:'FORBIDDEN'});
 }
});

it('KORR-RECHTE prices issue and send one original; payments book without exposing item prices; orders-only generate and reread a delivery note',async()=>{
 const prepared=await readyOrderForInvoice('TEST getrennte Rechte'),prices=await createFixture(['preise']),payments=await createFixture(['zahlungen','auftraege']),operator=await createFixture(['auftraege']);
 const issue={orderId:prepared.orderId,expectedVersion:prepared.version,clientEventId:randomUUID()};
 expect(await withSession(payments,()=>issueInvoiceAction(issue))).toMatchObject({code:'FORBIDDEN'});
 const issued=await withSession(prices,()=>issueInvoiceAction(issue));expect(issued).toMatchObject({code:'OK'});if(issued.code!=='OK')throw Error('TEST_REAL_PRICE_ISSUE');
 expect(await withSession(prices,()=>issueInvoiceAction(structuredClone(issue)))).toMatchObject({code:'OK',replayed:true});
 const payment={invoiceId:issued.receipt.invoiceId,amount:issued.receipt.grossAmountCents,method:'bar' as const,expectedVersion:0,expectedOpenAmountCents:issued.receipt.grossAmountCents,clientEventId:randomUUID()};
 expect(await withSession(prices,()=>confirmPaymentAction(payment))).toMatchObject({code:'FORBIDDEN'});
 let sends=0;const payloads:string[]=[];
 const provider=vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-independent-finance-token'.repeat(3),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;payloads.push(String(init?.body));return new Response(null,{status:202});}
  return nativeFetch(request,init);
 });
 try{
  const mail={targetType:'ORDER' as const,targetId:prepared.orderId,subject:'TEST unveraenderte Rechnung',body:'TEST Original',clientRequestId:randomUUID(),attachment:{kind:'INVOICE' as const,documentId:issued.receipt.invoiceId},expectedInvoiceIds:[issued.receipt.invoiceId]};
  expect(await withSession(payments,()=>sendCustomerMailAction(mail))).toMatchObject({code:'FORBIDDEN'});
  expect(await withSession(prices,()=>sendCustomerMailAction(mail))).toMatchObject({code:'OK'});
  expect(await withSession(prices,()=>sendCustomerMailAction(structuredClone(mail)))).toMatchObject({code:'OK',data:{replayed:true}});
  expect(sends).toBe(1);expect(payloads[0]).toContain('contentBytes');
 }finally{provider.mockRestore();}
 expect(await withSession(payments,()=>confirmPaymentAction(payment))).toMatchObject({code:'OK'});
 expect(await withSession(payments,()=>confirmPaymentAction(structuredClone(payment)))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(payments,()=>getOrderPaymentStateAction({orderId:prepared.orderId}))).toMatchObject({code:'OK',data:{payment:{invoiceId:issued.receipt.invoiceId,openAmountCents:0}}});
 const card=await withSession(payments,()=>getLiveOrderCardAction({orderId:prepared.orderId}));expect(card).toMatchObject({code:'OK'});
 if(card.code!=='OK')throw Error('TEST_PAYMENT_CARD_REREAD');
 for(const item of card.data.card.items){expect(item.unitPriceCents).toBeNull();expect(item.vatRateBasisPoints).toBeNull();}
 const noteInput=await deliveryNoteInputFixture([prepared.orderId]);
 const delivery=await withSession(operator,()=>generateDeliveryNote(noteInput));expect(delivery).toMatchObject({code:'OK'});if(delivery.code!=='OK')throw Error('TEST_ORDERS_DELIVERY');
 expect(await withSession(operator,()=>generateDeliveryNote(structuredClone(noteInput)))).toMatchObject({code:'OK',pdfBase64:delivery.pdfBase64,receipt:{originalEventId:delivery.receipt.originalEventId}});
 expect(await withSession(operator,()=>generateDeliveryNote(prepared.orderId))).toBe(delivery.pdfBase64);
 expect(createHash('sha256').update(Buffer.from(delivery.pdfBase64,'base64')).digest('hex')).toBe(delivery.receipt.pdfSha256);
});

it('KORR-RECHTE pickup cashier confirms the real cash payment with orders and cashier rights, without any of the three financial areas',async()=>{
 const order=await readyInvoiceOrder('TEST Kasse ohne Geldrechte'),cashier=await createFixture(['auftraege','kassieren']);
 const state=await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}));if(state.code!=='OK')throw Error('TEST_CASH_MODE_SOURCE');
 expect(await withSession(cashier,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'FORBIDDEN'});
 const mode={orderId:order.orderId,paymentMode:'abholung' as const,expectedVersion:state.data.paymentModeVersion,clientEventId:randomUUID()};
 expect(await withSession(full,()=>setPaymentModeAction(mode))).toMatchObject({code:'OK'});
 expect(await withSession(cashier,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{payment:{invoiceId:order.invoice.invoiceId,openAmountCents:order.invoice.grossAmountCents}}});
 const input={invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,method:'bar' as const,expectedVersion:0,expectedOpenAmountCents:order.invoice.grossAmountCents,clientEventId:randomUUID()};
 expect(await withSession(cashier,()=>confirmPaymentAction(input))).toMatchObject({code:'OK'});
 expect(await withSession(cashier,()=>confirmPaymentAction(structuredClone(input)))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(cashier,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{payment:{openAmountCents:0}}});
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${tenant} AND event_type='PAYMENT_CONFIRMED_V1' AND client_event_id=${input.clientEventId}::uuid`).toEqual([{user_id:cashier.actorId}]);
});

it('KORR-RECHTE intake and customers secure a real supplier delivery PDF and assign/reread/retry it without a financial area',async()=>{
 const actor=await createFixture(['eingang','kunden']);
 const customerInput={clientEventId:randomUUID(),customerType:'lieferant' as const,companyName:'TEST Lieferant ohne Geldrechte GmbH',phone:'+49 711 5550808',email:'TEST-'+randomUUID()+'@example.invalid',street:'Hafenweg',houseNumber:'12',zipCode:'70178',city:'Stuttgart',country:'DE'};
 const created=await withSession(actor,()=>createCustomerAction(customerInput));expect(created).toMatchObject({code:'OK'});if(created.code!=='OK')throw Error('TEST_SUPPLIER_CREATE');
 const customerId=created.receipt.customerId;
 expect(await withSession(actor,()=>createCustomerAction(structuredClone(customerInput)))).toMatchObject({code:'OK',replayed:true,receipt:{customerId}});
 const bytes=Buffer.from(await renderToBuffer(createElement(Document,null,createElement(Page,null,createElement(Text,null,'TEST Lieferanten-Lieferschein ohne Betrag')))));
 const itemId=randomUUID(),fileId=randomUUID(),sha256=createHash('sha256').update(bytes).digest('hex');
 const input={itemId,fileId,name:'TEST-Lieferanten-Lieferschein.pdf',mime:'application/pdf',bytes:bytes.length,sha256,captureOrigin:'dokument' as const};
 const grant=await withSession(actor,()=>prepareIntakeFileAction(input));expect(grant).toMatchObject({code:'OK'});if(grant.code!=='OK')throw Error('TEST_SUPPLIER_DOCUMENT_GRANT');
 if(grant.upload){const url=new URL('/storage/v1/object/upload/sign/'+grant.upload.bucket+'/'+grant.upload.path,process.env.NEXT_PUBLIC_SUPABASE_URL);if(url.hostname!=='127.0.0.1')throw Error('TEST_LOOPBACK_ONLY');url.searchParams.set('token',grant.upload.token);expect((await nativeFetch(url,{method:'PUT',headers:{'content-type':'application/pdf','x-upsert':'false'},body:new Uint8Array(bytes)})).ok).toBe(true);}
 // An unavailable external OCR service must not undo the genuine stored PDF.
 // This test proves the delivery original/assignment, not OCR extraction.
 const ocrHost=process.env.AZURE_DOCINTEL_ENDPOINT?new URL(process.env.AZURE_DOCINTEL_ENDPOINT).hostname:null;
 const provider=vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(ocrHost&&url.hostname===ocrHost)return new Response('TEST OCR provider unavailable',{status:503});
  return nativeFetch(request,init);
 });
 const finished=await withSession(actor,()=>finishIntakeFileAction(fileId)).finally(()=>provider.mockRestore());expect(finished).toMatchObject({code:'OK'});if(finished.code!=='OK')throw Error('TEST_SUPPLIER_ORIGINAL_ACK');
 expect(finished.capture.files).toEqual(expect.arrayContaining([expect.objectContaining({id:fileId,secured:true,mime:'application/pdf'})]));
 const read=await withSession(actor,()=>getIntakeAssignmentAction({itemId,mode:'normal'}));expect(read).toMatchObject({code:'OK'});if(read.code!=='OK')throw Error('TEST_SUPPLIER_ASSIGN_READ');
 const assign={itemId,version:read.view.version,clientEventId:randomUUID(),customerId,mode:'manual' as const};
 expect(await withSession(actor,()=>assignIntakeCustomerAction(assign))).toMatchObject({code:'OK',replayed:false});
 expect(await withSession(actor,()=>assignIntakeCustomerAction(structuredClone(assign)))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(actor,()=>getIntakeAssignmentAction({itemId,mode:'normal'}))).toMatchObject({code:'OK',view:{customer:{id:customerId,type:'lieferant'}}});
 const capture=await withSession(actor,()=>getIntakeCaptureAction(itemId));expect(capture).toMatchObject({code:'OK',capture:{files:expect.arrayContaining([expect.objectContaining({id:fileId,secured:true})])}});
 const bookkeeping=await createFixture(['buchhaltung']);
 for(const rights of [['preise'],['zahlungen']]){
  const other=await createFixture(rights);
  expect(await withSession(other,()=>getIncomingInvoiceAction({id:itemId}))).toMatchObject({code:'FORBIDDEN'});
  expect(await withSession(other,()=>getAnalyseOverview('monat'))).toMatchObject({data:[],error:expect.stringContaining('Keine Berechtigung')});
 }
 const invoice=await withSession(bookkeeping,()=>getIncomingInvoiceAction({id:itemId}));
 expect(invoice).toMatchObject({code:'OK',view:{originals:expect.arrayContaining([expect.objectContaining({id:fileId,sha256})]),supplier:{id:customerId}}});
 // The existing analysis tiles may report missing sources; that is not fabricated financial data.
 const analysis=await withSession(bookkeeping,()=>getAnalyseOverview('monat'));
 expect(analysis.error).toBeUndefined();expect(analysis.data.length).toBeGreaterThan(0);
});


it('KORR-RECHTE payments cancel and reread the immutable cancellation proof without gaining price/document access',async()=>{
 const prepared=await readyOrderForInvoice('TEST Storno getrennte Rechte'),prices=await createFixture(['preise']),payments=await createFixture(['zahlungen']);
 const issued=await withSession(prices,()=>issueInvoiceAction({orderId:prepared.orderId,expectedVersion:prepared.version,clientEventId:randomUUID()}));if(issued.code!=='OK')throw Error('TEST_REAL_CANCELLATION_INVOICE');
 const {InvoicesAppAdapter}=await import('@/app/buchhaltung/rechnungen/InvoicesAppAdapter');
 expect(await withSession(prices,()=>InvoicesAppAdapter())).toMatchObject({props:{initialState:{state:'DATA',canCancel:false}}});
 const combined=await createFixture(['preise','zahlungen']);
 expect(await withSession(combined,()=>InvoicesAppAdapter())).toMatchObject({props:{initialState:{state:'DATA',canCancel:true}}});
 const input={invoiceId:issued.receipt.invoiceId,expectedVersion:1 as const,reason:'TEST Storno mit Zahlungsrecht',clientEventId:randomUUID()};
 expect(await withSession(prices,()=>cancelInvoiceAction(input))).toMatchObject({code:'FORBIDDEN'});
 const cancelled=await withSession(payments,()=>cancelInvoiceAction(input));expect(cancelled).toMatchObject({code:'OK'});if(cancelled.code!=='OK')throw Error('TEST_REAL_PAYMENT_CANCELLATION');
 expect(await withSession(payments,()=>cancelInvoiceAction(structuredClone(input)))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:cancelled.receipt.eventId}});
 const read=await withSession(payments,()=>getInvoiceCancellationReceiptAction({invoiceId:input.invoiceId,clientEventId:input.clientEventId}));
 expect(read).toMatchObject({code:'OK',data:{eventId:cancelled.receipt.eventId,invoiceId:input.invoiceId,status:'cancelled',cancelledBy:payments.actorId}});
 expect(await withSession(payments,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_REAL_CANCEL_DOCUMENT_AUTH');return readInvoicePdf(auth.data,input.invoiceId,'cancellation');})).toMatchObject({code:'FORBIDDEN'});
 if(read.code!=='OK'||!read.data)throw Error('TEST_CANCELLATION_PROOF_READ');expect(read.data).not.toHaveProperty('snapshot');expect(read.data).not.toHaveProperty('positions');
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${tenant} AND client_event_id=${input.clientEventId}::uuid AND event_type='INVOICE_CANCELLED_V1'`).toEqual([{n:1}]);
});
