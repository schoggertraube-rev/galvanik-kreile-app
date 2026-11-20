// @vitest-environment node
// Historical initial records are explicitly synthetic. Every invoice, cancellation,
// agreement change and current physical handover uses real Actions/Auth/DB ports.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {historicalCollection,historicalPendingCollection} from '../../../e2e/ablauf/invoiceCollectionFixture';
import {readyOrderForInvoice} from '../../../e2e/ablauf/orderFixture';
import {issueCollectionInvoiceAction,issueInvoiceAction,cancelInvoiceAction} from '@/app/actions/invoices.actions';
import {saveCustomerAgreementAction,revokeCustomerAgreementAction} from '@/app/actions/customers.actions';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
import {setExtraWorkHourlyRateAction} from '@/app/actions/orders.actions';
import {getIntakeTaskAction,completeIntakeTaskAction} from '@/app/actions/eingang.actions';

beforeAll(async()=>{
 // The following current handovers need the audited current rate, not the
 // deliberately synthetic legacy rate otherwise supplied by the history fixture.
 expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
});

it.each([false,true])('K4 routes cancelled members into the same-month open collection (existing=%s)',async existing=>{
 const source=await historicalCollection([1900,1900,1900]);
 const issued=await withSession(full,()=>issueCollectionInvoiceAction({collectionId:source.collectionId,expectedVersion:1,clientEventId:randomUUID()}));
 expect(issued.code).toBe('OK');if(issued.code!=='OK')throw Error('TEST_K4_ISSUE');
 const next=existing?await historicalCollection([1900,1900,1900],{customerId:source.customerId,agreementId:source.agreementId}):null;
 const input={invoiceId:issued.receipt.invoiceId,expectedVersion:1,reason:'TEST K4 original cancellation',clientEventId:randomUUID()};
 expect(await withSession(full,()=>cancelInvoiceAction(input))).toMatchObject({code:'OK'});
 const open=await sql`SELECT id::text FROM public.invoice_collections WHERE tenant_id=${tenant} AND customer_id=${source.customerId} AND monat=${source.month}::date AND status='offen'`;
 expect(open).toHaveLength(1);expect(open[0].id).not.toBe(source.collectionId);if(next)expect(open[0].id).toBe(next.collectionId);
 const members=await sql`SELECT order_id FROM public.invoice_collection_orders WHERE tenant_id=${tenant} AND collection_id=${open[0].id}::uuid ORDER BY order_id`;
 expect(members.map(row=>row.order_id)).toEqual([...source.members,...(next?.members??[])].map(row=>row.orderId).sort());
 expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT order_id FROM public.invoice_collection_orders WHERE tenant_id=${tenant} AND collection_id=${source.collectionId}::uuid`).toHaveLength(0);
 const single=await withSession(full,()=>issueInvoiceAction({orderId:source.members[0].orderId,expectedVersion:3,clientEventId:randomUUID()}));
 expect(single.code).toBe('ORDER_IN_COLLECTION');
 // The existing real issuer can consume the new collection's same physical originals.
 const replacement=await withSession(full,()=>issueCollectionInvoiceAction({collectionId:open[0].id,expectedVersion:1,clientEventId:randomUUID()}));
 expect(replacement.code).toBe('OK');
});

it('K4 leaves individual originals available when the collection agreement no longer applies',async()=>{
 const source=await historicalCollection([1900,1900,1900]);
 const issued=await withSession(full,()=>issueCollectionInvoiceAction({collectionId:source.collectionId,expectedVersion:1,clientEventId:randomUUID()}));
 if(issued.code!=='OK')throw Error('TEST_K4_INACTIVE_ISSUE');
 expect(await withSession(full,()=>revokeCustomerAgreementAction({agreementId:source.agreementId,version:1,clientKey:randomUUID(),reason:'TEST K4 no collection agreement'}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>cancelInvoiceAction({invoiceId:issued.receipt.invoiceId,expectedVersion:1,reason:'TEST K4 individual path',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await sql`SELECT id FROM public.invoice_collections WHERE tenant_id=${tenant} AND customer_id=${source.customerId} AND status='offen'`).toHaveLength(0);
 for(const member of source.members)expect(await withSession(full,()=>issueInvoiceAction({orderId:member.orderId,expectedVersion:3,clientEventId:randomUUID()}))).toMatchObject({code:'OK',receipt:{orderId:member.orderId}});
});

it('K4/R2 preserves cancellation after a real routing SQL error and repairs its one task by the existing completion command',async()=>{
 const source=await historicalCollection([1900,1900,1900]);
 const issued=await withSession(full,()=>issueCollectionInvoiceAction({collectionId:source.collectionId,expectedVersion:1,clientEventId:randomUUID()}));
 if(issued.code!=='OK')throw Error('TEST_K4_R2_ISSUE');
 const resolver=await createFixture(['entscheiden'],'buero');
 const input={invoiceId:issued.receipt.invoiceId,expectedVersion:1,reason:'TEST K4 actual routing SQL failure',clientEventId:randomUUID()};
 const fault='test_s38_recollection_'+randomUUID().replaceAll('-','');
 if(!/^TEST-ablauf-[a-f0-9-]+$/.test(tenant))throw Error('TEST_K4_ISOLATION_REQUIRED');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.customer_id='${source.customerId}' THEN PERFORM 1/0; END IF; RETURN NEW; END $$; CREATE TRIGGER ${fault} BEFORE INSERT ON public.invoice_collections FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 let task:{id:string;version:number}|undefined;
 try{
  expect(await withSession(full,()=>cancelInvoiceAction(input))).toMatchObject({code:'UNAVAILABLE'});
  const [original]=await sql`SELECT status,cancel_event_id FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
  expect(original.status).toBe('cancelled');
  const tasks=await sql`SELECT id::text,version FROM public.tasks WHERE tenant_id=${tenant} AND client_key::text=${original.cancel_event_id}`;
  expect(tasks).toHaveLength(1);task={id:tasks[0].id,version:tasks[0].version};
  expect(await withSession(resolver,()=>getIntakeTaskAction({taskId:task!.id}))).toMatchObject({code:'OK',task:{status:'offen',erstellt_von:full.actorId},canComplete:true});
  expect(await sql`SELECT order_id FROM public.invoice_collection_orders WHERE tenant_id=${tenant} AND collection_id=${source.collectionId}::uuid`).toHaveLength(0);
 }finally{
  await sql.unsafe(`DROP TRIGGER ${fault} ON public.invoice_collections; DROP FUNCTION private.${fault}()`);
 }
 if(!task)throw Error('TEST_K4_R2_TASK');
 const command={taskId:task.id,version:task.version,note:null};
 expect(await withSession(resolver,()=>completeIntakeTaskAction(command))).toMatchObject({code:'OK',task:{status:'erledigt',erledigt_von:resolver.actorId}});
 expect(await withSession(resolver,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(command))))).toMatchObject({code:'OK',task:{status:'erledigt'}});
 expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT member.order_id FROM public.invoice_collection_orders member JOIN public.invoice_collections collection ON collection.tenant_id=member.tenant_id AND collection.id=member.collection_id WHERE member.tenant_id=${tenant} AND collection.customer_id=${source.customerId} AND collection.status='offen'`).toHaveLength(3);
});

it('K5/A13 keeps one current physical collection through a changed target and further goods after issuance',async()=>{
 const source=await historicalCollection([1900,1900,1900]);
 const first=await readyOrderForInvoice('TEST K5 first actual handover','pickup',source.customerId);
 expect(await withSession(full,()=>recordGoodsOutAction({orderId:first.orderId,expectedVersion:first.version,mode:'abholung',clientEventId:randomUUID(),agreement:{id:source.agreementId,version:1,type:'sammelrechnung'}}))).toMatchObject({code:'OK'});
 const [before]=await sql`SELECT collection.id::text FROM public.invoice_collection_orders member JOIN public.invoice_collections collection ON collection.tenant_id=member.tenant_id AND collection.id=member.collection_id WHERE member.tenant_id=${tenant} AND member.order_id=${first.orderId}`;
 const updated=await withSession(full,()=>saveCustomerAgreementAction({customerId:source.customerId,version:1,clientKey:randomUUID(),type:'sammelrechnung',targetDays:45,reason:'TEST K5 new target within month'}));
 expect(updated.code).toBe('OK');if(updated.code!=='OK')throw Error('TEST_K5_AGREEMENT');
 const second=await readyOrderForInvoice('TEST K5 changed target handover','pickup',source.customerId);
 const handover=(order:typeof first)=>withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,expectedVersion:order.version,mode:'abholung',clientEventId:randomUUID(),agreement:{id:updated.agreement.id,version:updated.agreement.version,type:'sammelrechnung'}}));
 expect(await handover(second)).toMatchObject({code:'OK'});
 const issued=await withSession(full,()=>issueCollectionInvoiceAction({collectionId:source.collectionId,expectedVersion:1,clientEventId:randomUUID()}));
 expect(issued.code).toBe('OK');if(issued.code!=='OK')throw Error('TEST_K5_CHANGED_TARGET_ISSUE');
 const [original]=await sql`SELECT snapshot FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(original.snapshot.terms).toMatchObject({quelle:'absprache',ziel_tage:45});
 const third=await readyOrderForInvoice('TEST A13 next goods after real invoice','pickup',source.customerId);
 expect(await handover(third)).toMatchObject({code:'OK'});
 const members=await sql`SELECT collection_id::text,order_id FROM public.invoice_collection_orders WHERE tenant_id=${tenant} AND order_id=ANY(${[first.orderId,second.orderId,third.orderId]}::text[]) ORDER BY order_id`;
 expect(members.map(row=>row.order_id)).toEqual([first.orderId,second.orderId,third.orderId].sort());expect(members.every(row=>row.collection_id===before.id)).toBe(true);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND event_type='ORDER_COLLECTION_ATTACH_PENDING_V1' AND order_id=ANY(${[first.orderId,second.orderId,third.orderId]}::text[])`).toHaveLength(0);
});

it('A13 repairs a retained historical month-M pending original into a new month-M collection without changing the issued original',async()=>{
 const source=await historicalCollection([1900,1900,1900]);
 const issued=await withSession(full,()=>issueCollectionInvoiceAction({collectionId:source.collectionId,expectedVersion:1,clientEventId:randomUUID()}));
 if(issued.code!=='OK')throw Error('TEST_A13_FIRST_ORIGINAL');
 const [before]=await sql`SELECT snapshot,pdf_content,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 // Explicit synthetic historical initial pending/task state, not a claim that
 // today's physical writer ran last month. Completion/repair below is real.
 const retained=await historicalPendingCollection([1900,1900,1900],{customerId:source.customerId,agreementId:source.agreementId});
 expect(retained.month).toBe(source.month);expect(retained.pending).toHaveLength(3);
 const resolver=await createFixture(['entscheiden'],'buero');
 expect(await sql`SELECT id FROM public.invoice_collections WHERE tenant_id=${tenant} AND customer_id=${source.customerId} AND monat=${source.month}::date AND status='offen'`).toHaveLength(0);
 for(const pending of retained.pending){
  const command={taskId:pending.taskId,version:1,note:null};
  expect(await withSession(resolver,()=>getIntakeTaskAction({taskId:pending.taskId}))).toMatchObject({code:'OK',canComplete:true});
  expect(await withSession(resolver,()=>completeIntakeTaskAction(command))).toMatchObject({code:'OK',task:{status:'erledigt',erledigt_von:resolver.actorId}});
  expect(await withSession(resolver,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(command))))).toMatchObject({code:'OK',task:{status:'erledigt'}});
 }
 const next=await sql`SELECT collection.id::text,member.order_id FROM public.invoice_collections collection JOIN public.invoice_collection_orders member ON member.tenant_id=collection.tenant_id AND member.collection_id=collection.id WHERE collection.tenant_id=${tenant} AND collection.customer_id=${source.customerId} AND collection.monat=${source.month}::date AND collection.status='offen' ORDER BY member.order_id`;
 expect(next.map(row=>row.order_id)).toEqual(retained.pending.map(row=>row.orderId).sort());expect(new Set(next.map(row=>row.id)).size).toBe(1);expect(next[0].id).not.toBe(source.collectionId);
 const [after]=await sql`SELECT snapshot,pdf_content,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(after).toEqual(before);
});
