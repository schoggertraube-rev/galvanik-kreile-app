// @vitest-environment node
// Actual sender/PREPARE/Auth/DB/Storage. Only Microsoft Graph is a TEST boundary double.
import {expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,nativeFetch} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1'||!tenant.startsWith('TEST-ablauf-'))throw Error('S20_DEDICATED_TEST_REPLAY_REQUIRED');

it('L5 the existing sender logs actual Graph acceptance/uncertainty using the secured PREPARE reference/hash; fresh retries do not create another provider effect',async()=>{
 const orders=[await readyInvoiceOrder('S20 mail accepted'),await readyInvoiceOrder('S20 mail timeout')];
 let timeout=false,sends=0;
 const transport=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-s20-provider-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;if(timeout)throw new DOMException('TEST PRIVATE_PROVIDER_TIMEOUT','TimeoutError');return new Response(null,{status:202});}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/mailFolders/sentitems/messages'))return Response.json({value:[]});
  return nativeFetch(input,init);
 });
 try{
  for(let index=0;index<orders.length;index++){
   timeout=index===1;const order=orders[index];
   const input={targetType:'ORDER' as const,targetId:order.orderId,clientRequestId:randomUUID(),subject:'TEST PRIVATE_MAIL_SUBJECT',body:'TEST PRIVATE_MAIL_BODY',expectedInvoiceIds:[order.invoice.invoiceId],attachment:{kind:'INVOICE' as const,documentId:order.invoice.invoiceId}};
   const result=await withSession(full,()=>sendCustomerMailAction(input));
   expect(result.code).toBe(timeout?'UNAVAILABLE':'OK');
   const [prepared]=await sql`SELECT payload->>'threadId' AS id,payload->>'contentSha256' AS sha FROM public.events WHERE tenant_id=${tenant} AND event_type='COMMUNICATION_MAIL_PREPARED_V1' AND correlation_id=${input.clientRequestId}::uuid`;
   expect(prepared).toBeDefined();
   const rows=await sql`SELECT * FROM public.technical_protocol WHERE tenant_id=${tenant} AND event_type='external' AND original_ref=${prepared.id}`;
   expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({user_id:full.actorId,subject_id:order.orderId,dienst:'microsoft365',ergebnis:timeout?'unklar':'ok',original_sha256:prepared.sha});
   for(const secret of ['PRIVATE_MAIL_SUBJECT','PRIVATE_MAIL_BODY','PRIVATE_PROVIDER_TIMEOUT','TEST-s20-provider-token'])expect(JSON.stringify(rows)).not.toContain(secret);
   const before=sends;const retry=await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))));
   expect(retry.code).toBe(timeout?'CONFLICT':'OK');expect(sends).toBe(before);
   expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${tenant} AND event_type='external' AND original_ref=${prepared.id}`).toHaveLength(1);
  }
  expect(sends).toBe(2);
 }finally{transport.mockRestore();}
});
