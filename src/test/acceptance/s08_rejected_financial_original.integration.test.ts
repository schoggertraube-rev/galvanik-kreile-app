// @vitest-environment node
// PL14Nov10:20: actual money writer/Auth/DB and the same original/TaskWriter.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder,customerFixture} from '../../../e2e/ablauf/orderFixture';
import {cancelInvoiceAction} from '@/app/actions/invoices.actions';
import {replayOfflineWorkshopAction} from '@/app/actions/offlineWorkshop.actions';
import {offlinePartition} from '@/lib/server/offlinePartition';
import {isPendingWorkshopAcknowledgement,type PendingWorkshopOriginal} from '@/lib/offline/pendingStore';
import {isWorkshopRejectionReceipt} from '@/lib/offline/workshopRejectionContract';
beforeAll(()=>{const u=process.env.DATABASE_URL;if(!u||u!==process.env.H18_EXPECTED_DATABASE_URL||new URL(u).hostname!=='127.0.0.1')throw Error('TEST_S08_LOOPBACK_REQUIRED');});

it('a stale money original has a distinct immutable non-effect receipt and normal task; a new confirmation works, the old N5 can never create a later effect',async()=>{
 await createFixture(['entscheiden'],'buero');
 const order=await readyInvoiceOrder('TEST S08 rejected invoice cancellation','pickup'),key=randomUUID(),scope=offlinePartition({tenantId:tenant,userId:full.actorId});
 const input={invoiceId:order.invoice.invoiceId,expectedVersion:2,reason:'TEST stale explicit cancellation',clientEventId:key};
 const original:PendingWorkshopOriginal={kind:'workshop',command:'invoice.cancel',id:key,itemId:input.invoiceId,deviceCapturedAt:new Date().toISOString(),input};
 const rejected=await withSession(full,()=>replayOfflineWorkshopAction(scope,original));
 expect(rejected).toMatchObject({code:'PRESERVED',rejectionReceipt:{clientEventId:key,rejection:'CONFLICT',actorId:full.actorId,taskId:expect.any(String)}});
 expect(isPendingWorkshopAcknowledgement(scope,original,rejected)).toBe(false);
 if(rejected.code!=='PRESERVED'||!('rejectionReceipt'in rejected))throw Error('TEST_DISTINCT_REJECTION_REQUIRED');
 expect(isWorkshopRejectionReceipt(scope,original,rejected.rejectionReceipt)).toBe(true);
 expect(rejected.rejectionReceipt.subject).toMatchObject({kind:'invoice',id:input.invoiceId,label:order.invoice.invoiceNumber,amountCents:order.invoice.grossAmountCents});
 expect(await withSession(full,()=>replayOfflineWorkshopAction(scope,JSON.parse(JSON.stringify(original))))).toEqual({...rejected,replayed:true});
 expect(await sql`SELECT erstellt_von::text,fuer_bereich,bezug_typ,bezug_id FROM public.tasks WHERE tenant_id=${tenant} AND id=${rejected.taskId}::uuid`).toEqual([{erstellt_von:full.actorId,fuer_bereich:'entscheiden',bezug_typ:'auftrag',bezug_id:order.orderId}]);
 expect(await sql`SELECT order_id FROM public.events WHERE tenant_id=${tenant} AND id=${rejected.eventId}`).toEqual([{order_id:order.orderId}]);
 expect(await withSession(full,()=>cancelInvoiceAction({...input,expectedVersion:1}))).toMatchObject({code:'UNAVAILABLE'});
 expect(await sql`SELECT status FROM public.invoices WHERE tenant_id=${tenant} AND id=${input.invoiceId}::uuid`).toEqual([{status:'issued'}]);
 const freshKey=randomUUID(),fresh={...original,id:freshKey,input:{...input,expectedVersion:1,clientEventId:freshKey}};
 expect(await withSession(full,()=>replayOfflineWorkshopAction(scope,fresh))).toMatchObject({code:'OK',financialCommand:'invoice.cancel'});
 await expect(sql`UPDATE public.events SET description='TEST forbidden mutation' WHERE tenant_id=${tenant} AND id=${rejected.eventId}`).rejects.toBeTruthy();
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${tenant} AND event_type='OFFLINE_WORKSHOP_REJECTED_V1' AND payload#>>'{original,input,clientEventId}'=${key}`).toEqual([{n:1}]);
});

it('PL13:55 binds rejected apply to the actual invoice order and payout to the actual customer; original labels and amounts survive retry',async()=>{
 const order=await readyInvoiceOrder('TEST S08 rejected apply source','pickup'),scope=offlinePartition({tenantId:tenant,userId:full.actorId});
 const applyId=randomUUID(),apply:PendingWorkshopOriginal={kind:'workshop',command:'credit.apply',id:applyId,itemId:order.invoice.invoiceId,deviceCapturedAt:new Date().toISOString(),input:{invoiceId:order.invoice.invoiceId,clientEventId:applyId,amount:4000,expectedVersion:0,expectedOpenAmountCents:order.invoice.grossAmountCents,expectedCreditVersion:0}};
 const customerId=await customerFixture('rejected payout'),payoutId=randomUUID(),payout:PendingWorkshopOriginal={kind:'workshop',command:'credit.payout',id:payoutId,itemId:customerId,deviceCapturedAt:new Date().toISOString(),input:{customerId,clientEventId:payoutId,amount:4000,expectedCreditVersion:0,method:'bar',reference:null,note:null}};
 for(const original of [apply,payout]){
  const result=await withSession(full,()=>replayOfflineWorkshopAction(scope,original));
  expect(result).toMatchObject({code:'PRESERVED',message:'Der Betrag ist höher als das Guthaben von 0,00\u00a0€.',rejectionReceipt:{subject:{amountCents:4000,id:original.itemId}}});
  if(result.code!=='PRESERVED'||!('rejectionReceipt'in result))throw Error('TEST_REJECTION_REQUIRED');
  expect(isWorkshopRejectionReceipt(scope,original,result.rejectionReceipt)).toBe(true);
  expect(await sql`SELECT bezug_typ,bezug_id FROM public.tasks WHERE tenant_id=${tenant} AND id=${result.taskId}::uuid`).toEqual([{bezug_typ:original.command==='credit.payout'?'kunde':'auftrag',bezug_id:original.command==='credit.payout'?customerId:order.orderId}]);
  expect(await withSession(full,()=>replayOfflineWorkshopAction(scope,JSON.parse(JSON.stringify(original))))).toEqual({...result,replayed:true});
 }
 expect(await sql`SELECT id FROM public.customer_credit_entries WHERE tenant_id=${tenant} AND customer_id=${customerId}`).toEqual([]);
});

it('rights revoked after a real committed effect never produce a false no-effect receipt or conflict task',async()=>{
 const order=await readyInvoiceOrder('TEST S08 effect before rights loss','pickup'),actor=await createFixture(['geld'],'buero'),key=randomUUID();
 const input={invoiceId:order.invoice.invoiceId,expectedVersion:1,reason:'TEST real cancellation before response loss',clientEventId:key};
 const original:PendingWorkshopOriginal={kind:'workshop',command:'invoice.cancel',id:key,itemId:input.invoiceId,deviceCapturedAt:new Date().toISOString(),input};
 expect(await withSession(actor,()=>cancelInvoiceAction(input))).toMatchObject({code:'OK'});
 await sql`DELETE FROM public.app_user_rights WHERE tenant_id=${tenant} AND user_id=${actor.actorId}::uuid AND bereich='geld'`;
 const result=await withSession(actor,()=>replayOfflineWorkshopAction(offlinePartition({tenantId:tenant,userId:actor.actorId}),original));
 expect(result).toMatchObject({code:'UNAVAILABLE'});expect(result).not.toHaveProperty('rejectionReceipt');
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND event_type='OFFLINE_WORKSHOP_REJECTED_V1' AND payload#>>'{original,input,clientEventId}'=${key}`).toEqual([]);
 expect(await sql`SELECT status FROM public.invoices WHERE tenant_id=${tenant} AND id=${input.invoiceId}::uuid`).toEqual([{status:'cancelled'}]);
});
