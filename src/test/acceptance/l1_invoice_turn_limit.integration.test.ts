// @vitest-environment node
// PL22.11.02:51: actual invoice originals, Actions/Auth/DB/Storage and task source.
// Only Microsoft HTTP is doubled; every row belongs to this isolated TEST tenant.
import {randomUUID,createHash} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,nativeFetch} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {saveCompanySettingsAction} from '@/app/actions/settings.actions';
import {getCustomerSummaryAction} from '@/app/actions/customers.actions';
import {getIntakeTaskAction,completeIntakeTaskAction} from '@/app/actions/eingang.actions';
import {sendCustomerMailAction,confirmInvoiceHandoverAction} from '@/app/actions/communications.actions';
import {INVOICE_DELIVERY_COPY} from '@/ui/situationCatalog';
type Input=Parameters<typeof sendCustomerMailAction>[0];
type Mail={subject:string;body:{content:string};toRecipients:Array<{emailAddress:{address:string}}>;attachments:Array<{contentBytes:string}>;internetMessageHeaders:Array<{name:string;value:string}>};
async function configure(limit:number){
 const result=await withSession(full,()=>saveCompanySettingsAction({companyName:'TEST L1 Versandtakte',street:'TEST Weg 1',zip:'70176',city:'Stuttgart',country:'Deutschland',taxId:'DE123456789',iban:'DE02120300000000202051',bic:'BYLADEM1001',bankName:'TEST Bank',logoUrl:'https://example.invalid/TEST.png',paymentTermDays:14,pageReads:{queryTimeoutMs:10000,invoiceMailBatchLimit:limit}}));
 expect(result,JSON.stringify(result)).toMatchObject({code:'OK'});
 expect(await sql`SELECT rechnung_mail_grenze FROM public.company_settings WHERE tenant_id=${tenant}`).toEqual([{rechnung_mail_grenze:limit}]);
}
function provider(){
 const state={mails:[] as Mail[],lost:false,reconcile:false};
 const spy=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST turn provider token'.repeat(4)});
  if(url.hostname==='graph.microsoft.com'){
   if(url.pathname.endsWith('/sendMail')){state.mails.push(JSON.parse(String(init?.body)).message);if(state.lost)throw Error('TEST original accepted, response lost');return new Response(null,{status:202});}
   if(url.pathname.includes('/mailFolders/sentitems/messages')){
    const original=state.mails[0];
    return Response.json({value:state.reconcile&&original?[{id:'TEST-saved-three',internetMessageId:'<TEST-three@example.invalid>',isDraft:false,sentDateTime:new Date().toISOString(),from:{emailAddress:{address:process.env.MS_GRAPH_MAILBOX}},toRecipients:original.toRecipients,internetMessageHeaders:original.internetMessageHeaders}]:[]});
   }
   throw Error('TEST unexpected Graph read: '+url.pathname);
  }
  return nativeFetch(input,init);
 });
 return {state,restore:()=>spy.mockRestore()};
}
async function command(customerId:string):Promise<Input>{
 const summary=await withSession(full,()=>getCustomerSummaryAction({customerId}));
 if(summary.code!=='OK')throw Error('TEST_TURN_CUSTOMER_SOURCE');
 const action=summary.data.nextActionRule?.hauptaktion;
 if(!action||!('befehl'in action))throw Error('TEST_TURN_COMMAND_MISSING');
 return {...JSON.parse(JSON.stringify(action.befehl.argumente)),clientRequestId:randomUUID(),subject:'TEST gespeicherte Rechnungen',body:'TEST unveränderte Originale'};
}
it('processes five actual single invoices in turns2+2+1, preserves retries and protects the real remainder task',async()=>{
 const customerId=await customerFixture('TEST L1 five turn originals');
 for(let i=0;i<5;i++)await readyInvoiceOrder('TEST L1 turn '+i,'pickup',false,customerId);
 await configure(2);
 const originals=await sql`SELECT id::text,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND customer_id=${customerId} ORDER BY issued_at,id`;
 expect(originals).toHaveLength(5);
 const {state,restore}=provider();
 try{
  const first=await command(customerId);
  expect(first.expectedInvoiceIds).toHaveLength(2);
  expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{invoiceUnsentCount:5,invoiceUnsentOriginals:originals.map(row=>({id:row.id}))}});
  const saved=await withSession(full,()=>sendCustomerMailAction(first));expect(saved).toMatchObject({code:'OK'});
  expect(state.mails.map(mail=>mail.attachments.length)).toEqual([2]);
  const [task]=await sql`SELECT task.id::text,task.version FROM public.tasks task JOIN public.events marker ON marker.tenant_id=task.tenant_id AND marker.id=task.client_key::text WHERE marker.tenant_id=${tenant} AND marker.event_type='INVOICE_MAIL_REMAINDER_PENDING_V1' AND marker.correlation_id=${first.clientRequestId}::uuid`;
  expect(task).toBeDefined();
  expect(await withSession(full,()=>getIntakeTaskAction({taskId:task.id}))).toMatchObject({code:'OK',task:{status:'offen',bezug_id:customerId}});
  expect(await withSession(full,()=>completeIntakeTaskAction({taskId:task.id,version:task.version,note:'TEST still three originals'}))).toMatchObject({code:'CONFLICT'});
  expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(first))))).toMatchObject({code:'OK',data:{replayed:true}});
  expect(state.mails).toHaveLength(1);
  expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{invoiceUnsentCount:3}});
  const second=await command(customerId);
  expect(await withSession(full,()=>sendCustomerMailAction(second))).toMatchObject({code:'OK'});
  expect(state.mails.map(mail=>mail.attachments.length)).toEqual([2,2]);
  expect(await sql`SELECT id::text FROM public.tasks WHERE tenant_id=${tenant} AND bezug_id=${customerId} AND status='offen'`).toEqual([{id:task.id}]);
  expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(second))))).toMatchObject({code:'OK',data:{replayed:true}});
  expect(state.mails).toHaveLength(2);
  const third=await command(customerId);
  expect(await withSession(full,()=>sendCustomerMailAction(third))).toMatchObject({code:'OK'});
  expect(state.mails.map(mail=>mail.attachments.length)).toEqual([2,2,1]);
  expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(first))))).toMatchObject({code:'OK',data:{replayed:true}});
  expect(await withSession(full,()=>getIntakeTaskAction({taskId:task.id}))).toMatchObject({code:'OK',task:{status:'erledigt'}});
  expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(second))))).toMatchObject({code:'OK',data:{replayed:true}});
  expect(await sql`SELECT id::text FROM public.tasks WHERE tenant_id=${tenant} AND bezug_id=${customerId}`).toEqual([{id:task.id}]);
  expect(state.mails).toHaveLength(3);
  expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{invoiceUnsentCount:0,invoiceUnsentOriginals:[]}});
  expect(state.mails.flatMap(mail=>mail.attachments.map(file=>createHash('sha256').update(Buffer.from(file.contentBytes,'base64')).digest('hex'))).sort()).toEqual(originals.map(row=>row.pdf_sha256).sort());
  expect(await sql`SELECT id::text,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND customer_id=${customerId} ORDER BY issued_at,id`).toEqual(originals);
 }finally{restore();}
});

it('keeps the proposed turn recheck and concrete handover date when an expected original changes',async()=>{
 const customerId=await customerFixture('TEST L1 stale full cohort');
 const orders=[];
 for(let i=0;i<3;i++)orders.push(await readyInvoiceOrder('TEST L1 stale '+i,'pickup',false,customerId));
 await configure(2);
 const {state,restore}=provider();
 try{
  const input=await command(customerId);
  expect(input.expectedInvoiceIds).toHaveLength(2);
  const handed=await withSession(full,()=>confirmInvoiceHandoverAction({invoiceId:input.attachment!.documentId,clientRequestId:randomUUID()}));
  expect(handed).toMatchObject({code:'OK'});if(handed.code!=='OK')throw Error('TEST_TURN_ACTUAL_HANDOVER');
  const on=new Date(handed.receipt.handedAt).toLocaleDateString('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric'});
  // InvoiceAlreadySent has always returned CONFLICT with the real paper date.
  expect(await withSession(full,()=>sendCustomerMailAction(input))).toMatchObject({code:'CONFLICT',message:INVOICE_DELIVERY_COPY.alreadyHandedOver(orders[0].invoice.invoiceNumber,on)});
  expect(state.mails).toHaveLength(0);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND correlation_id=${input.clientRequestId}::uuid AND event_type='COMMUNICATION_DOCUMENT_PREPARED_V1'`).toHaveLength(0);
  expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{invoiceUnsentCount:2}});
 }finally{restore();}
});

it('retains the accepted first turn when its real task write fails and repairs the same task without another mail',async()=>{
 const customerId=await customerFixture('TEST L1 task receipt failure');
 for(let i=0;i<3;i++)await readyInvoiceOrder('TEST L1 task fault '+i,'pickup',false,customerId);
 await configure(2);
 const {state,restore}=provider();
 const guard='test_l1_turn_task_'+randomUUID().replaceAll('-','');
 try{
  const input=await command(customerId);
  // TEST-only stricter write failure, removed in finally; no guard is disabled.
  await sql.unsafe(`CREATE FUNCTION private.${guard}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.bezug_id='${customerId}' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
  await sql.unsafe(`CREATE TRIGGER ${guard} BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION private.${guard}()`);
  try{
   expect(await withSession(full,()=>sendCustomerMailAction(input))).toMatchObject({code:'UNAVAILABLE'});
   expect(state.mails.map(mail=>mail.attachments.length)).toEqual([2]);
   expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${tenant} AND bezug_id=${customerId}`).toHaveLength(0);
   expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{invoiceUnsentCount:1}});
  }finally{await sql.unsafe(`DROP TRIGGER ${guard} ON public.tasks`);await sql.unsafe(`DROP FUNCTION private.${guard}()`);}
  expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{replayed:true}});
  expect(state.mails).toHaveLength(1);
  const tasks=await sql`SELECT id::text FROM public.tasks WHERE tenant_id=${tenant} AND bezug_id=${customerId}`;
  expect(tasks).toHaveLength(1);
  expect(await withSession(full,()=>getIntakeTaskAction({taskId:tasks[0].id}))).toMatchObject({code:'OK',task:{status:'offen',erstellt_von:full.actorId}});
 }finally{restore();}
});

it('retains an already prepared three-original group intact as its own turn after the limit becomes2',async()=>{
 const customerId=await customerFixture('TEST L1 saved three-original group');
 for(let i=0;i<3;i++)await readyInvoiceOrder('TEST L1 three '+i,'pickup',false,customerId);
 await configure(101);
 const {state,restore}=provider();
 try{
  const input=await command(customerId);state.lost=true;
  expect(await withSession(full,()=>sendCustomerMailAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(state.mails.map(mail=>mail.attachments.length)).toEqual([3]);
  const prepared=await sql`SELECT id,payload FROM public.events WHERE tenant_id=${tenant} AND correlation_id=${input.clientRequestId}::uuid AND event_type='COMMUNICATION_DOCUMENT_PREPARED_V1'`;
  expect(prepared).toHaveLength(1);
  await readyInvoiceOrder('TEST L1 later fourth must wait','pickup',false,customerId);
  await configure(2);state.lost=false;state.reconcile=true;
  expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK'});
  expect(state.mails.map(mail=>mail.attachments.length)).toEqual([3]);
  expect(await sql`SELECT id,payload FROM public.events WHERE tenant_id=${tenant} AND correlation_id=${input.clientRequestId}::uuid AND event_type='COMMUNICATION_DOCUMENT_PREPARED_V1'`).toEqual(prepared);
  expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{invoiceUnsentCount:1}});
 }finally{restore();}
});
