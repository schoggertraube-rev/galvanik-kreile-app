// @vitest-environment node
// Actual issuance, PDF/Storage, Action/Auth/DB, qualified readback and retry.
// Only Microsoft Graph is doubled, in an isolated explicitly TEST tenant.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,nativeFetch} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readOrderInformed} from '@/lib/server/orderReleaseRead';

it('E0 preserves the actual invoice original and qualified mail receipt across a fresh retry',async()=>{
 const order=await readyInvoiceOrder('TEST E0 invoice send');
 const originals=await sql`SELECT id,payload FROM public.events WHERE tenant_id=${tenant} AND order_id=${order.orderId} AND event_type IN ('INVOICE_CREATED_V1','INVOICE_CREATED_V2','INVOICE_CREATED_V3') ORDER BY id`;
 expect(originals).toHaveLength(1);
 const payloads:Array<{message:{attachments:Array<{contentType:string;contentBytes:string}>}}>=[];
 const provider=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST E0 external token'.repeat(3)});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){payloads.push(JSON.parse(String(init?.body)));return new Response(null,{status:202});}
  return nativeFetch(input,init);
 });
 try{
  const input={targetType:'ORDER' as const,targetId:order.orderId,clientRequestId:randomUUID(),subject:'TEST E0 Rechnung',body:'TEST E0 Originalrechnung',expectedInvoiceIds:[order.invoice.invoiceId],attachment:{kind:'INVOICE' as const,documentId:order.invoice.invoiceId}};
  const sent=await withSession(full,()=>sendCustomerMailAction(input));expect(sent.code).toBe('OK');
  if(sent.code!=='OK')throw Error('TEST_E0_ACTUAL_SEND:'+sent.code);
  expect(payloads).toHaveLength(1);expect(payloads[0].message.attachments).toHaveLength(1);
  const attachment=payloads[0].message.attachments[0];expect(attachment.contentType).toBe('application/pdf');
  expect(Buffer.from(attachment.contentBytes,'base64').subarray(0,5).toString()).toBe('%PDF-');
  const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_E0_ACTUAL_AUTH');
  const read=await readOrderInformed(auth.data,order.orderId);
  expect(read).toMatchObject({code:'OK',informed:{actorId:full.actorId,channel:'mail',threadId:sent.data.threadId}});
  expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{threadId:sent.data.threadId,replayed:true}});
  expect(payloads).toHaveLength(1);expect(await readOrderInformed(auth.data,order.orderId)).toEqual(read);
  expect(await sql`SELECT id,payload FROM public.events WHERE tenant_id=${tenant} AND order_id=${order.orderId} AND event_type IN ('INVOICE_CREATED_V1','INVOICE_CREATED_V2','INVOICE_CREATED_V3') ORDER BY id`).toEqual(originals);
 }finally{provider.mockRestore();}
});
