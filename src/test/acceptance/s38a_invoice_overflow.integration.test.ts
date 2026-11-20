// @vitest-environment node
// One isolated TEST scenario. Every fiscal original is issued by the real Actions;
// setup steps stay below the unchanged per-test limit, no cloned invoice/PDF rows.
import {createHash,randomUUID} from 'node:crypto';
import {beforeAll,beforeEach,it,expect,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,nativeFetch} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {requestMailStep} from '../../../e2e/ablauf/requestMailStep';
import {getCustomerSummaryAction,updateCustomerAction} from '@/app/actions/customers.actions';
import {getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {getIntakeTaskAction,completeIntakeTaskAction} from '@/app/actions/eingang.actions';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';

let customerId:string;
let lastOrderId:string;
const originals:string[]=[];
type MailCommandArgs=Pick<Parameters<typeof sendCustomerMailAction>[0],'targetType'|'targetId'|'attachment'|'expectedInvoiceIds'>;
let firstInput:Parameters<typeof sendCustomerMailAction>[0]|undefined;
const sentHashes:string[]=[];
const sentSizes:number[]=[];
let recoveryTaskId:string|undefined;
let lateInvoiceId:string|undefined;
beforeEach(()=>{
  // Read-only steps must not depend on a previous test's cached Graph token.
  // Sending steps install their existing requestMailStep provider boundary.
  vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-overflow-read-provider-token'.repeat(4),expires_in:3600});
    if(url.hostname==='graph.microsoft.com'){
      if(init?.method==='POST')throw Error('TEST_UNEXPECTED_PROVIDER_WRITE_IN_READ_STEP');
      return Response.json({value:[]});
    }
    return nativeFetch(input,init);
  });
});
function retainActualBoundaryBytes(expectedCounts:readonly number[]){
  const mails=vi.mocked(globalThis.fetch).mock.calls.filter(([url,init])=>String(url).includes('graph.microsoft.com')&&String(url).endsWith('/sendMail')&&init?.method==='POST')
    .map(([,init])=>JSON.parse(String(init?.body)).message.attachments as Array<{contentBytes:string}>);
  expect(mails.map(attachments=>attachments.length)).toEqual(expectedCounts);
  sentSizes.push(...mails.map(attachments=>attachments.length));
  sentHashes.push(...mails.flatMap(attachments=>attachments.map(file=>createHash('sha256').update(Buffer.from(file.contentBytes,'base64')).digest('hex'))));
}
beforeAll(async()=>{
  const url=process.env.DATABASE_URL;
  if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1'||new URL(url).pathname!=='/postgres')throw Error('TEST_OVERFLOW_LOOPBACK_REQUIRED');
  customerId=await customerFixture('TEST S38 overflow 102 actual originals');
});

it.each(Array.from({length:102},(_,index)=>index))('prepares real immutable fiscal source %i for the one overflow scenario',async index=>{
  const source=await readyInvoiceOrder('TEST overflow '+index,'pickup',false,customerId);
  expect(originals).toHaveLength(index);
  expect(originals).not.toContain(source.invoice.invoiceId);
  originals.push(source.invoice.invoiceId);
  lastOrderId=source.orderId;
  const stored=await sql`SELECT id::text,encode(sha256(pdf_content),'hex')=pdf_sha256 AS original_ok
    FROM public.invoices WHERE tenant_id=${tenant} AND id=${source.invoice.invoiceId}::uuid`;
  expect(stored).toEqual([{id:source.invoice.invoiceId,original_ok:true}]);
});

it('binds exactly the oldest101 while retaining all102 original sources',async()=>{
  expect(originals).toHaveLength(102);
  const before=await withSession(full,()=>getCustomerSummaryAction({customerId}));
  if(before.code!=='OK')throw Error('TEST_OVERFLOW_OVERVIEW_REQUIRED');
  expect(before.data.invoiceUnsentCount).toBe(102);
  expect(before.data.invoiceUnsentOriginals?.map(row=>row.id)).toEqual(originals);
  const command=before.data.nextActionRule?.hauptaktion;
  if(!command||!('befehl'in command))throw Error('TEST_OVERFLOW_FIRST_COMMAND_REQUIRED');
  const args=JSON.parse(JSON.stringify(command.befehl.argumente)) as MailCommandArgs;
  expect(args.expectedInvoiceIds).toEqual(originals.slice(0,101));
  expect(args.attachment).toEqual({kind:'INVOICE',documentId:originals[0]});
  firstInput={...args,clientRequestId:randomUUID(),subject:'TEST oldest 101 originals',body:'TEST gespeicherte Originalgruppe'};
});

it('PL01:02 exposes the actual102nd order as waiting without a false missing invoice or a send click',async()=>{
  const card=await withSession(full,()=>getLiveOrderCardAction({orderId:lastOrderId}));
  expect(card).toMatchObject({code:'OK',data:{customerInformed:{code:'OK',invoiceMailQueued:true}}});
  if(card.code!=='OK')throw Error('TEST_OVERFLOW_ORDER_REQUIRED');
  expect(card.data.nextActionRule?.datenluecken).not.toContain('ORDER_ACTION_BINDING:order.notify');
  expect(card.data.nextActionRule).toMatchObject({zustand:'invoice_mail_queued',hauptaktion:null,versandhinweis:`Geht mit der nächsten Rechnungsmail an ${card.data.card.customerName} raus`});
});

it('K3/K6 freezes all102 before Graph, blocks early task completion and repairs only the frozen remainder',async()=>{
 const input=firstInput;if(!input)throw Error('TEST_OVERFLOW_FIRST_COMMAND_REQUIRED');
 const [profile]=await sql`SELECT email FROM public.customers WHERE tenant_id=${tenant} AND id=${customerId}`;
 await requestMailStep('S38-overflow-first-group');
 const provider=vi.mocked(globalThis.fetch).getMockImplementation();if(!provider)throw Error('TEST_PROVIDER_REQUIRED');
 let firstAcknowledged=false;
 vi.mocked(globalThis.fetch).mockImplementation(async(url,init)=>{
  const response=await provider(url,init);
  if(!firstAcknowledged&&String(url).endsWith('/sendMail')&&init?.method==='POST'){
   firstAcknowledged=true;
   expect(await withSession(full,()=>updateCustomerAction({customerId,clientEventId:randomUUID(),email:null}))).toMatchObject({code:'OK'});
  }
  return response;
 });
 let taskId:string|undefined;
 try{
  expect(await withSession(full,()=>sendCustomerMailAction(input))).toMatchObject({code:'UNAVAILABLE'});
  retainActualBoundaryBytes([101]);
  const markers=await sql`SELECT task.id::text AS task_id,task.version FROM public.events marker JOIN public.tasks task ON task.tenant_id=marker.tenant_id AND task.client_key::text=marker.id WHERE marker.tenant_id=${tenant} AND marker.event_type='INVOICE_MAIL_REMAINDER_PENDING_V1' AND marker.correlation_id=${input.clientRequestId}::uuid`;
  expect(markers).toHaveLength(1);taskId=markers[0].task_id;
  expect(await withSession(full,()=>getIntakeTaskAction({taskId:taskId!}))).toMatchObject({code:'OK',task:{status:'offen',bezug_typ:'kunde',bezug_id:customerId,erstellt_von:full.actorId}});
  recoveryTaskId=taskId;
 }finally{
  expect(await withSession(full,()=>updateCustomerAction({customerId,clientEventId:randomUUID(),email:profile.email}))).toMatchObject({code:'OK'});
 }
 if(!taskId)throw Error('TEST_OVERFLOW_REMAINDER_TASK_REQUIRED');
});
it('K6 refuses completion of the real task while one frozen original remains unsent',async()=>{
 if(!recoveryTaskId)throw Error('TEST_OVERFLOW_REMAINDER_TASK_REQUIRED');
 const task=await withSession(full,()=>getIntakeTaskAction({taskId:recoveryTaskId!}));
 if(task.code!=='OK'||!task.task)throw Error('TEST_OVERFLOW_TASK_READ_REQUIRED');
 const version=task.task.version;
 expect(await withSession(full,()=>completeIntakeTaskAction({taskId:recoveryTaskId,version,note:'TEST cannot hide unsent originals'}))).toMatchObject({code:'CONFLICT'});
});
it('K3 repairs the retained remainder with the same request and one physical mail',async()=>{
 const input=firstInput;if(!input||!recoveryTaskId)throw Error('TEST_OVERFLOW_REMAINDER_SOURCE_REQUIRED');
 await requestMailStep('S38-overflow-repair-followup');
 expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{replayed:true}});
 expect(await withSession(full,()=>getIntakeTaskAction({taskId:recoveryTaskId!}))).toMatchObject({code:'OK',task:{status:'erledigt'}});
 retainActualBoundaryBytes([1]);
});it('reads the automatically sent remainder without a second user request',async()=>{
  const after=await withSession(full,()=>getCustomerSummaryAction({customerId}));
  if(after.code!=='OK')throw Error('TEST_OVERFLOW_REMAINING_REQUIRED');
  expect(after.data.invoiceUnsentCount).toBe(0);
  expect(after.data.invoiceUnsentOriginals).toEqual([]);
});

it('reads no unsent remainder and verifies every actual transmitted PDF against its immutable original',async()=>{
  expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{invoiceUnsentCount:0,invoiceUnsentOriginals:[]}});
  expect(sentSizes).toEqual([101,1]);
  const hashes=await sql`SELECT pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND customer_id=${customerId} ORDER BY issued_at,id`;
  expect(sentHashes.slice().sort()).toEqual(hashes.map(row=>row.pdf_sha256).sort());
});

it('K3 never adds a later invoice to the saved request and sends nothing twice',async()=>{
 const input=firstInput;if(!input)throw Error('TEST_OVERFLOW_FIRST_COMMAND_REQUIRED');
 const later=await readyInvoiceOrder('TEST later regular request only','pickup',false,customerId);lateInvoiceId=later.invoice.invoiceId;
 await requestMailStep('S38-overflow-late-excluded');
 expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{replayed:true}});
 expect(vi.mocked(globalThis.fetch).mock.calls.filter(([url,init])=>String(url).endsWith('/sendMail')&&init?.method==='POST')).toHaveLength(0);
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{invoiceUnsentCount:1,invoiceUnsentOriginals:[{id:later.invoice.invoiceId}]}});
 const snapshots=await sql`SELECT payload FROM public.events WHERE tenant_id=${tenant} AND event_type='INVOICE_MAIL_REQUEST_SNAPSHOT_V1' AND correlation_id=${input.clientRequestId}::uuid`;
 expect(snapshots).toHaveLength(1);expect(snapshots[0].payload.invoiceIds).toEqual(originals);expect(snapshots[0].payload.invoiceIds).not.toContain(later.invoice.invoiceId);
});
it('K3 another deserialized retry performs no Graph write and retains the later original',async()=>{
 const input=firstInput;if(!input||!lateInvoiceId)throw Error('TEST_OVERFLOW_LATE_ORIGINAL_REQUIRED');
 await requestMailStep('S38-overflow-second-late-excluded');
 expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{replayed:true}});
 expect(vi.mocked(globalThis.fetch).mock.calls.filter(([url,init])=>String(url).endsWith('/sendMail')&&init?.method==='POST')).toHaveLength(0);
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{invoiceUnsentCount:1,invoiceUnsentOriginals:[{id:lateInvoiceId}]}});
});
it('keeps the actual remainder recovery original append-only after repair',async()=>{
 const input=firstInput;if(!input)throw Error('TEST_OVERFLOW_FIRST_COMMAND_REQUIRED');
 const before=await sql`SELECT id,to_jsonb(event) AS original FROM public.events event WHERE tenant_id=${tenant} AND event_type='INVOICE_MAIL_REMAINDER_PENDING_V1' AND correlation_id=${input.clientRequestId}::uuid`;
 expect(before).toHaveLength(1);
 for(const action of ['update','delete'] as const){
  await expect(sql.begin(async tx=>{
   await tx`SELECT set_config('app.tenant_id',${tenant},true)`;
   if(action==='update')await tx`UPDATE public.events SET description='TEST forbidden recovery edit' WHERE tenant_id=${tenant} AND id=${before[0].id}`;
   else await tx`DELETE FROM public.events WHERE tenant_id=${tenant} AND id=${before[0].id}`;
   throw Error('TEST_GUARD_FAILED_FORCED_ROLLBACK');
  })).rejects.toThrow('append-only');
 }
 expect(await sql`SELECT id,to_jsonb(event) AS original FROM public.events event WHERE tenant_id=${tenant} AND id=${before[0].id}`).toEqual(before);
});
