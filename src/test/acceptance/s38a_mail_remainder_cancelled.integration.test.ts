// @vitest-environment node
// KORR S38a-2 B/C: 102 actual fiscal originals per isolated TEST customer.
// Only Graph is doubled; invoices, originals, cancellation, replacement, tasks,
// authorization, Today, immutable snapshot and browser-deserialized retries are real.
import {randomUUID} from 'node:crypto';
import {beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,nativeFetch,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {requestMailStep} from '../../../e2e/ablauf/requestMailStep';
import {getCustomerSummaryAction,updateCustomerAction} from '@/app/actions/customers.actions';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
import {getIntakeTaskAction} from '@/app/actions/eingang.actions';
import {cancelInvoiceAction} from '@/app/actions/invoices.actions';
import {changeOrderPickupNoticeAction} from '@/app/actions/orders.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readInvoiceMailUnacknowledged} from '@/lib/server/communicationDocumentPort';
import {readTodayDashboard} from '@/lib/server/todayDashboard';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';

beforeAll(()=>{const u=process.env.DATABASE_URL;if(!u||u!==process.env.H18_EXPECTED_DATABASE_URL||new URL(u).hostname!=='127.0.0.1')throw Error('TEST_CANCELLED_REMAINDER_LOOPBACK_REQUIRED');});
beforeEach(()=>{
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-cancelled-remainder-read-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'){
   if(init?.method==='POST')throw Error('TEST_UNEXPECTED_PROVIDER_WRITE_IN_READ_STEP');
   return Response.json({value:[]});
  }
  return nativeFetch(input,init);
 });
});
function mailPosts(){return vi.mocked(globalThis.fetch).mock.calls.filter(([url,init])=>String(url).endsWith('/sendMail')&&init?.method==='POST');}
describe.each(['cancel','reissue'] as const)('KORR S38a-2 %s actual frozen remainder',scenario=>{
 let customerId:string,taskId:string,last:Awaited<ReturnType<typeof readyInvoiceOrder>>|undefined;
 const ids:string[]=[];
 let input:Parameters<typeof sendCustomerMailAction>[0]|undefined;
 let frozen:unknown;let replacementId:string|undefined,replacementNumber:string|undefined;
 beforeAll(async()=>{customerId=await customerFixture('TEST KORR S38a-2 '+scenario);});
 it.each(Array.from({length:102},(_,i)=>i))('issues actual immutable original %i',async index=>{
  last=await readyInvoiceOrder('TEST frozen '+scenario+' '+index,scenario==='reissue'?'shipping':'pickup',false,customerId);
  expect(ids).toHaveLength(index);ids.push(last.invoice.invoiceId);
  expect(await sql`SELECT encode(sha256(pdf_content),'hex')=pdf_sha256 AS valid FROM public.invoices WHERE tenant_id=${tenant} AND id=${last.invoice.invoiceId}::uuid`).toEqual([{valid:true}]);
 });
 it('retains the real first101 ACK and an open task for original102',async()=>{
  const summary=await withSession(full,()=>getCustomerSummaryAction({customerId}));
  if(summary.code!=='OK'||!summary.data.nextActionRule?.hauptaktion||!('befehl'in summary.data.nextActionRule.hauptaktion))throw Error('TEST_ACTUAL_102_SEND_COMMAND_REQUIRED');
  expect(summary.data.invoiceUnsentCount).toBe(102);
  const args=JSON.parse(JSON.stringify(summary.data.nextActionRule.hauptaktion.befehl.argumente));
  expect(args.expectedInvoiceIds).toEqual(ids.slice(0,101));
  input={...args,subject:'TEST retained '+scenario+' originals',body:'TEST exact frozen invoice originals',clientRequestId:randomUUID()};
  const [profile]=await sql`SELECT email FROM public.customers WHERE tenant_id=${tenant} AND id=${customerId}`;
  await requestMailStep('S38a-2-'+scenario+'-first');
  const provider=vi.mocked(globalThis.fetch).getMockImplementation();if(!provider)throw Error('TEST_GRAPH_BOUNDARY_REQUIRED');
  let acknowledged=false;
  vi.mocked(globalThis.fetch).mockImplementation(async(url,init)=>{
   const response=await provider(url,init);
   if(!acknowledged&&String(url).endsWith('/sendMail')&&init?.method==='POST'){
    acknowledged=true;expect(await withSession(full,()=>updateCustomerAction({customerId,clientEventId:randomUUID(),email:null}))).toMatchObject({code:'OK'});
   }
   return response;
  });
  try{
   expect(await withSession(full,()=>sendCustomerMailAction(input!))).toMatchObject({code:'UNAVAILABLE'});
   expect(mailPosts()).toHaveLength(1);
   expect(JSON.parse(String(mailPosts()[0][1]?.body)).message.attachments).toHaveLength(101);
   const tasks=await sql`SELECT task.id::text FROM public.events marker JOIN public.tasks task ON task.tenant_id=marker.tenant_id AND task.client_key::text=marker.id WHERE marker.tenant_id=${tenant} AND marker.event_type='INVOICE_MAIL_REMAINDER_PENDING_V1' AND marker.correlation_id=${input!.clientRequestId}::uuid`;
   expect(tasks).toHaveLength(1);taskId=tasks[0].id;
   expect(await withSession(full,()=>getIntakeTaskAction({taskId}))).toMatchObject({code:'OK',task:{status:'offen'},canComplete:false});
   const snapshots=await sql`SELECT payload FROM public.events WHERE tenant_id=${tenant} AND event_type='INVOICE_MAIL_REQUEST_SNAPSHOT_V1' AND correlation_id=${input!.clientRequestId}::uuid`;
   expect(snapshots).toHaveLength(1);expect(snapshots[0].payload.invoiceIds).toEqual(ids);frozen=snapshots[0].payload;
  }finally{
   expect(await withSession(full,()=>updateCustomerAction({customerId,clientEventId:randomUUID(),email:profile.email}))).toMatchObject({code:'OK'});
  }
 });
 it('settles only the actual cancelled original, completes the same task and never fabricates another mail',async()=>{
  if(!input||!last||!taskId)throw Error('TEST_REMAINDER_SOURCE_REQUIRED');
  const clientEventId=randomUUID();
  let reissueWithoutShipping:{handoverEventId:string;replacementClientEventId:string}|undefined;
  if(scenario==='reissue'){
   const manual=await withSession(full,()=>changeOrderPickupNoticeAction({command:'handover_manual',orderId:last!.orderId,expectedVersion:last!.version,handoverMode:'pickup',clientEventId:randomUUID()}));
   expect(manual).toMatchObject({code:'OK',receipt:{handoverMode:'pickup'}});
   if(manual.code!=='OK'||!manual.receipt||typeof manual.receipt!=='object'||!('eventId'in manual.receipt)||typeof manual.receipt.eventId!=='string')throw Error('TEST_ACTUAL_HANDOVER_EVENT_REQUIRED');
   reissueWithoutShipping={handoverEventId:manual.receipt.eventId,replacementClientEventId:randomUUID()};
  }
  const cancelled=await withSession(full,()=>cancelInvoiceAction({invoiceId:last!.invoice.invoiceId,expectedVersion:1,reason:'TEST real cancelled frozen remainder',clientEventId,...(reissueWithoutShipping?{reissueWithoutShipping}:{})}));
  expect(cancelled).toMatchObject({code:'OK',receipt:{invoiceId:last.invoice.invoiceId,status:'cancelled'}});
  if(cancelled.code!=='OK')throw Error('TEST_ACTUAL_CANCELLATION_REQUIRED');
  if(scenario==='reissue'){
   expect(cancelled.replacementReceipt).toBeDefined();replacementId=cancelled.replacementReceipt!.invoiceId;replacementNumber=cancelled.replacementReceipt!.invoiceNumber;
   expect(ids).not.toContain(replacementId);
  }
  expect(await withSession(full,()=>getIntakeTaskAction({taskId}))).toMatchObject({code:'OK',task:{status:'offen'},canComplete:true});
  await requestMailStep('S38a-2-'+scenario+'-retry');
  expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{replayed:true}});
  expect(mailPosts()).toHaveLength(0);
  expect(await withSession(full,()=>getIntakeTaskAction({taskId}))).toMatchObject({code:'OK',task:{status:'erledigt',erledigt_notiz:'Rechnungsauftrag erledigt – kein offenes Original übrig'}});
  expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{replayed:true}});
  expect(mailPosts()).toHaveLength(0);
  const snapshots=await sql`SELECT payload FROM public.events WHERE tenant_id=${tenant} AND event_type='INVOICE_MAIL_REQUEST_SNAPSHOT_V1' AND correlation_id=${input.clientRequestId}::uuid`;
  expect(snapshots).toEqual([{payload:frozen}]);
  const qualified=await withSession(full,()=>resolveAuthorization());if(!qualified.ok)throw Error('TEST_FROZEN_AUTH_REQUIRED');
  expect(await withPrivilegedTenantTransaction(qualified.data,tx=>readInvoiceMailUnacknowledged(tx,tenant,customerId,ids))).toEqual([last.invoice.invoiceId]);
  if(replacementId){
   const summary=await withSession(full,()=>getCustomerSummaryAction({customerId}));
   expect(summary).toMatchObject({code:'OK',data:{invoiceUnsentOriginals:[{id:replacementId}]}});
   expect(mailPosts()).toHaveLength(0);
  }
 });

 if(scenario==='reissue')it('Today keeps the actual replacement reachable with its canonical prices right, without orders or mailbox rights',async()=>{
  if(!replacementId||!replacementNumber)throw Error('TEST_REAL_REPLACEMENT_REQUIRED');
  const prices=await createFixture(['preise']);
  const auth=await withSession(prices,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_TODAY_AUTH_REQUIRED');
  expect(auth.data.areas).not.toContain('auftraege');expect(auth.data.areas).not.toContain('mails');
  const today=await withSession(prices,()=>readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction));
  const item=today.items.find(row=>row.invoiceId===replacementId&&row.invoiceMail);
  expect(item).toMatchObject({primaryActionLabel:'Rechnung '+replacementNumber+' senden',invoiceMail:{documentId:replacementId,expectedInvoiceIds:[replacementId],customerId}});
  const denied=await createFixture(['mails']);
  const deniedAuth=await withSession(denied,()=>resolveAuthorization());if(!deniedAuth.ok)throw Error('TEST_TODAY_DENIED_AUTH_REQUIRED');
  const hidden=await withSession(denied,()=>readTodayDashboard(deniedAuth.data,getComplaints,getQuoteFollowupsForTodayAction));
  expect(hidden.items.some(row=>row.invoiceMail)).toBe(false);
  expect(mailPosts()).toHaveLength(0);
 });

});
