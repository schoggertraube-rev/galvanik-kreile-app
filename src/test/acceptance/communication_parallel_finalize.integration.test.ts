// @vitest-environment node
// CI-STABIL: isolated TEST data; real finalization/Auth/DB/Storage.
// Only the external Graph provider boundary is doubled.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,nativeFetch} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
import {getOrdersDb} from '@/app/actions/orders.actions';
it('CI-STABIL finalizes two actual invoice mails concurrently with original receipts and fresh retries',async()=>{
 if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('TEST_PARALLEL_FINALIZE_LOOPBACK_REQUIRED');
 const orders=[await readyInvoiceOrder('TEST parallel finalize A'),await readyInvoiceOrder('TEST parallel finalize B')];
 let sends=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-parallel-finalize-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;return new Response(null,{status:202});}
  return nativeFetch(input,init);
 });
 const requests=orders.map(order=>({targetType:'ORDER' as const,targetId:order.orderId,clientRequestId:randomUUID(),subject:'TEST parallel invoice finalization',body:'TEST real stored invoice original',expectedInvoiceIds:[order.invoice.invoiceId],attachment:{kind:'INVOICE' as const,documentId:order.invoice.invoiceId}}));
 const first=await Promise.all(requests.map(input=>withSession(full,()=>sendCustomerMailAction(input))));
 for(const result of first)expect(result).toMatchObject({code:'OK'});
 expect(sends).toBe(2);
 const reread=await withSession(full,()=>getOrdersDb());expect(reread.ok).toBe(true);if(!reread.ok)throw Error('TEST_ACTUAL_FINALIZE_READ_REQUIRED');
 for(const order of orders)expect(reread.data.find(row=>row.id===order.orderId)?.finishedDispatch).toMatchObject({channel:'mail',informedAt:expect.any(String)});
 const replay=await Promise.all(requests.map(input=>withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))));
 for(let index=0;index<replay.length;index++){
  const original=first[index],retried=replay[index];expect(retried).toMatchObject({code:'OK',data:{replayed:true}});
  if(original.code!=='OK'||retried.code!=='OK')throw Error('TEST_ACTUAL_FINALIZE_RECEIPTS_REQUIRED');
  expect(retried.data.threadId).toBe(original.data.threadId);
 }
 expect(sends).toBe(2);
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${tenant} AND event_type='ORDER_CUSTOMER_INFORMED_V1'`).toEqual([{n:2}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.communication_threads WHERE tenant_id=${tenant} AND status='sent'`).toEqual([{n:2}]);
});
