// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {full,withSession,createFixture,nativeFetch} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readCustomerSummary} from '@/lib/server/customerSummaryRead';
import {cancelInvoiceAction} from '@/app/actions/invoices.actions';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
import {getCustomerSummaryAction} from '@/app/actions/customers.actions';

it('reads current unsent invoice originals from the customer port and never discloses the financial count without geld',async()=>{
 const customerId=await customerFixture('V45 offene Originale'),auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_AUTH');
 expect(await readCustomerSummary(auth.data,{customerId})).toMatchObject({code:'OK',data:{invoiceUnsentCount:0}});
 const order=await readyInvoiceOrder('V45 Rechnung', 'pickup',false,customerId);
 const read=await readCustomerSummary(auth.data,{customerId});expect(read).toMatchObject({code:'OK',data:{invoiceUnsentCount:1}});
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{invoiceUnsentCount:1}});
 // The metrics port legitimately advances asOf on every read. The persisted
 // invoice evidence/count, not that read timestamp, must stay the same.
 expect(await readCustomerSummary(auth.data,{customerId})).toMatchObject({code:'OK',data:{id:customerId,invoiceUnsentCount:1}});
 const otherId=await customerFixture('V45 anderer Kunde');expect(await readCustomerSummary(auth.data,{customerId:otherId})).toMatchObject({code:'OK',data:{invoiceUnsentCount:0}});
 const restricted=await createFixture(['kunden'],'werkstatt'),noMoney=await withSession(restricted,()=>resolveAuthorization());if(!noMoney.ok)throw Error('TEST_NO_MONEY_AUTH');
 const hidden=await readCustomerSummary(noMoney.data,{customerId});expect(hidden.code).toBe('OK');if(hidden.code!=='OK')throw Error('TEST_CUSTOMER_READ');expect(hidden.data).not.toHaveProperty('invoiceUnsentCount');
 const publicHidden=await withSession(restricted,()=>getCustomerSummaryAction({customerId}));expect(publicHidden.code).toBe('OK');if(publicHidden.code!=='OK')throw Error('TEST_CUSTOMER_ACTION_READ');expect(publicHidden.data).not.toHaveProperty('invoiceUnsentCount');
 const cancel={invoiceId:order.invoice.invoiceId,expectedVersion:1,clientEventId:randomUUID(),reason:'TEST nicht mehr zu versenden'};
 expect(await withSession(full,()=>cancelInvoiceAction(cancel))).toMatchObject({code:'OK'});
 expect(await readCustomerSummary(auth.data,{customerId})).toMatchObject({code:'OK',data:{invoiceUnsentCount:0}});
 expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(cancel))))).toMatchObject({code:'OK',replayed:true});
 expect(await readCustomerSummary(auth.data,{customerId})).toMatchObject({code:'OK',data:{invoiceUnsentCount:0}});
},60000);

it('uses the actual document dispatch proof after sending, including a fresh retry',async()=>{
 const order=await readyInvoiceOrder('V45 Versandbeleg'),auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_AUTH');
 expect(await readCustomerSummary(auth.data,{customerId:order.customerId})).toMatchObject({code:'OK',data:{invoiceUnsentCount:1}});
 let sends=0;
 const provider=vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-V45-dispatch-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;return new Response(null,{status:202});}
  return nativeFetch(request,init);
 });
 try{
  const input={targetType:'ORDER' as const,targetId:order.orderId,subject:'TEST V45 Rechnung',body:'TEST Rechnung im Original',clientRequestId:randomUUID(),attachment:{kind:'INVOICE' as const,documentId:order.invoice.invoiceId},expectedInvoiceIds:[order.invoice.invoiceId]};
  expect(await withSession(full,()=>sendCustomerMailAction(input))).toMatchObject({code:'OK'});
  expect(await readCustomerSummary(auth.data,{customerId:order.customerId})).toMatchObject({code:'OK',data:{invoiceUnsentCount:0}});
  expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{replayed:true}});
  expect(await readCustomerSummary(auth.data,{customerId:order.customerId})).toMatchObject({code:'OK',data:{invoiceUnsentCount:0}});expect(sends).toBe(1);
 }finally{provider.mockRestore();}
},60000);
