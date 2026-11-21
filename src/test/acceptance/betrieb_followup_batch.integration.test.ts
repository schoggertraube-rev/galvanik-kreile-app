// @vitest-environment node
import {expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {sql as query} from 'drizzle-orm';
import {full,sql,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyOrderForInvoice,readyInvoiceOrder,manualTrackingFixture} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readManualShippingBatch} from '@/modules/orders/server-public';
import {readCustomerProfile} from '@/modules/customers/server-public';
import {readShippingSettingsInTransaction} from '@/modules/fundament/server-public';
import {readInvoiceVat,readCustomerCreditInTransaction} from '@/modules/accounting/server-public';
import {getPaymentStatesBatch} from '@/lib/server/paymentSummaryRead';
import {getOrderPaymentStateAction,confirmPaymentAction} from '@/app/actions/payments.actions';
import {readShippingMergeAllocation} from '@/lib/server/commands/immutableInvoiceCommand';
import {getManualShippingAction,saveManualTrackingAction,markOrderInformedByPhoneAction,getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {readOrderInformed,readOrdersInformed} from '@/lib/server/orderReleaseRead';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
const database=process.env.DATABASE_URL;
if(!database||database!==process.env.H18_EXPECTED_DATABASE_URL||new URL(database).hostname!=='127.0.0.1'||new URL(database).pathname!=='/postgres')throw Error('TEST_FOLLOWUP_OWN_LOOPBACK_REQUIRED');

type ManualShippingPorts=Parameters<typeof readManualShippingBatch>[2];
const ports:ManualShippingPorts={
 readCustomer:readCustomerProfile,
 readSettings:readShippingSettingsInTransaction,
 readAllocation:(tx,tenantId,customerId,input)=>readShippingMergeAllocation(tx,tenantId,customerId,input,readInvoiceVat),
};
async function authorization(actor=full){
 const result=await withSession(actor,()=>resolveAuthorization());
 if(!result.ok)throw Error('TEST_REAL_AUTHORIZATION_REQUIRED');
 return result.data;
}
it('250 manual shipping retains real zero/one/many sources, shared reads, rights, versions and fresh tracking retry',async()=>{
 const a=await readyOrderForInvoice('TEST 250 shipping A','shipping');
 const b=await readyOrderForInvoice('TEST 250 shipping B','shipping',a.customerId);
 const first=await manualTrackingFixture(a.orderId),second=await manualTrackingFixture(b.orderId);
 const actor=await authorization(),before=await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${tenant}`;
 const singles=await Promise.all([a,b].map(order=>withSession(full,()=>getManualShippingAction({orderId:order.orderId}))));
 expect(singles.every(row=>row.code==='OK')).toBe(true);
 let customers=0,settings=0;
 const counted:ManualShippingPorts={...ports,
  readCustomer:async(...args)=>{customers++;return readCustomerProfile(...args);},
  readSettings:async(...args)=>{settings++;return readShippingSettingsInTransaction(...args);},
 };
 expect(await readManualShippingBatch(actor,[],counted)).toEqual(new Map());
 expect([customers,settings]).toEqual([0,0]);
 const batch=await readManualShippingBatch(actor,[a.orderId,b.orderId,a.orderId],counted);
 expect(batch.size).toBe(2);expect([customers,settings]).toEqual([1,1]);
 expect(batch.get(a.orderId)).toEqual(singles[0]);expect(batch.get(b.orderId)).toEqual(singles[1]);
 expect(batch.get(a.orderId)).toMatchObject({code:'OK',data:{orderId:a.orderId,orderVersion:a.version,shipments:[{id:first.shipmentId,trackingNumber:first.trackingNumber}]}});
 expect(batch.get(b.orderId)).toMatchObject({code:'OK',data:{orderId:b.orderId,shipments:[{id:second.shipmentId,trackingNumber:second.trackingNumber}]}});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${tenant}`).toEqual(before);
 const input={orderId:a.orderId,shipmentId:first.shipmentId,expectedUpdatedAt:first.updatedAt,trackingNumber:'TEST-250-'+randomUUID(),allowFormatMismatch:false,reason:'TEST Sendungsnummer nach Kundenkorrektur ersetzt',clientEventId:randomUUID()};
 const saved=await withSession(full,()=>saveManualTrackingAction(input));
 expect(saved,JSON.stringify(saved)).toMatchObject({code:'OK'});
 const replayed=await withSession(full,()=>saveManualTrackingAction(JSON.parse(JSON.stringify(input))));
 expect(replayed).toMatchObject({code:'OK',replayed:true});
 if(saved.code!=='OK'||replayed.code!=='OK')throw Error('TEST_SAVED_TRACKING_REQUIRED');
 expect(replayed.receipt).toEqual(saved.receipt);
 expect(await withSession(full,()=>saveManualTrackingAction({...input,clientEventId:randomUUID(),trackingNumber:'TEST-stale-'+randomUUID()}))).toMatchObject({code:'CONFLICT',reason:'SHIPMENT_CHANGED'});
 const other=await createFixture(['auftraege']);
 expect(await withSession(other,()=>saveManualTrackingAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'CONFLICT',reason:'TRACKING_KEY_CONFLICT'});
 const original=await sql`SELECT user_id::text,payload FROM public.events WHERE tenant_id=${tenant} AND client_event_id=${input.clientEventId}::uuid AND event_type='SHIPMENT_MANUAL_TRACKING_SET_V1'`;
 expect(original).toHaveLength(1);expect(original[0].user_id).toBe(actor.userId);expect(original[0].payload.receipt).toEqual(saved.receipt);
 const fresh=await readManualShippingBatch(actor,[a.orderId,b.orderId],ports);
 expect(fresh.get(a.orderId)).toMatchObject({code:'OK',data:{shipments:[{id:first.shipmentId,trackingNumber:input.trackingNumber}]}});
 expect(fresh.get(b.orderId)).toEqual(batch.get(b.orderId));
 const denied=await authorization(await createFixture(['kunden']));
 customers=0;settings=0;
 expect([...(await readManualShippingBatch(denied,[a.orderId,b.orderId],counted)).values()].map(row=>row.code)).toEqual(['FORBIDDEN','FORBIDDEN']);
 expect([customers,settings]).toEqual([0,0]);
 expect(await readManualShippingBatch(actor,[a.orderId],ports)).toEqual(new Map([[a.orderId,fresh.get(a.orderId)]]));
});

it('250 a real SQL failure rolls back before isolating the bad shipping group and keeps the other current original readable',async()=>{
 const a=await readyOrderForInvoice('TEST 250 isolated shipping A','shipping');
 const b=await readyOrderForInvoice('TEST 250 isolated shipping B','shipping');
 const first=await manualTrackingFixture(a.orderId);await manualTrackingFixture(b.orderId);
 const actor=await authorization(),expected=await withSession(full,()=>getManualShippingAction({orderId:a.orderId}));
 const fault:ManualShippingPorts={...ports,readCustomer:async(tx,tenantId,customerId)=>{
  const customer=await readCustomerProfile(tx,tenantId,customerId);
  // Explicit synthetic failure, executed by the real PostgreSQL transaction;
  // no authorization, source reader or successful result is doubled.
  if(customerId===b.customerId)await tx.execute(query`SELECT 1 / 0 AS test_followup_failure`);
  return customer;
 }};
 const isolated=await readManualShippingBatch(actor,[a.orderId,b.orderId],fault);
 expect(isolated.get(a.orderId)).toEqual(expected);
 expect(isolated.get(a.orderId)).toMatchObject({code:'OK',data:{shipments:[{id:first.shipmentId,trackingNumber:first.trackingNumber}]}});
 expect(isolated.get(b.orderId)).toMatchObject({code:'UNAVAILABLE',reason:'MANUAL_SHIPPING_READ_FAILED'});
 const repaired=await readManualShippingBatch(actor,JSON.parse(JSON.stringify([a.orderId,b.orderId])),ports);
 expect(repaired.get(a.orderId)).toEqual(expected);expect(repaired.get(b.orderId)).toMatchObject({code:'OK'});
 expect((await readManualShippingBatch(actor,['TEST-missing-order'],ports)).get('TEST-missing-order')).toMatchObject({code:'NOT_FOUND'});
});

const readCredit:NonNullable<Parameters<typeof getPaymentStatesBatch>[2]>=(tx,tenantId,customerId)=>readCustomerCreditInTransaction(tx,tenantId,customerId,readCustomerProfile);
it('250 payment batch preserves real zero/one/many originals and money rights, then rereads the actual one-cent payment and original retry',async()=>{
 const a=await readyInvoiceOrder('TEST 250 payment A');
 const b=await readyInvoiceOrder('TEST 250 payment B','pickup',false,a.customerId);
 const actor=await authorization(),ids=[a.orderId,b.orderId];
 const originals=()=>sql`SELECT id,order_id,event_type,payload FROM public.events WHERE tenant_id=${tenant} AND order_id IN (${a.orderId},${b.orderId}) AND event_type IN ('INVOICE_CREATED_V1','INVOICE_CREATED_V2','INVOICE_CREATED_V3') ORDER BY id`;
 const original=await originals();expect(original).toHaveLength(2);
 const singles=await Promise.all(ids.map(orderId=>withSession(full,()=>getOrderPaymentStateAction({orderId}))));
 expect(singles.every(row=>row.code==='OK')).toBe(true);
 expect(await getPaymentStatesBatch(actor,[],readCredit)).toEqual(new Map());
 const batch=await getPaymentStatesBatch(actor,[...ids,a.orderId],readCredit);
 expect(batch.size).toBe(2);expect(batch.get(a.orderId)).toEqual(singles[0]);expect(batch.get(b.orderId)).toEqual(singles[1]);
 const first=batch.get(a.orderId);if(first?.code!=='OK'||!first.data.payment)throw Error('TEST_REAL_INVOICE_PAYMENT_REQUIRED');
 expect(first.data.payment).toMatchObject({invoiceId:a.invoice.invoiceId,totalAmountCents:a.invoice.grossAmountCents,openAmountCents:a.invoice.grossAmountCents,currency:'EUR'});
 const input={invoiceId:a.invoice.invoiceId,amount:1,method:'bar' as const,expectedVersion:first.data.payment.paymentVersion,expectedOpenAmountCents:first.data.payment.openAmountCents,clientEventId:randomUUID()};
 const paid=await withSession(full,()=>confirmPaymentAction(input));expect(paid,JSON.stringify(paid)).toMatchObject({code:'OK'});
 const replayed=await withSession(full,()=>confirmPaymentAction(JSON.parse(JSON.stringify(input))));expect(replayed).toMatchObject({code:'OK',replayed:true});
 if(paid.code!=='OK'||replayed.code!=='OK')throw Error('TEST_REAL_PAYMENT_RECEIPT_REQUIRED');expect(replayed.receipt).toEqual(paid.receipt);
 const fresh=await getPaymentStatesBatch(actor,JSON.parse(JSON.stringify(ids)),readCredit);
 expect(fresh.get(a.orderId)).toMatchObject({code:'OK',data:{payment:{invoiceId:a.invoice.invoiceId,paidAmountCents:1,openAmountCents:a.invoice.grossAmountCents-1,paymentVersion:first.data.payment.paymentVersion+1}}});
 expect(fresh.get(b.orderId)).toEqual(batch.get(b.orderId));expect(await originals()).toEqual(original);
 const receipts=await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${tenant} AND client_event_id=${input.clientEventId}::uuid AND event_type='PAYMENT_CONFIRMED_V1'`;
 expect(receipts).toHaveLength(1);expect(receipts[0].user_id).toBe(actor.userId);
 const denied=await authorization(await createFixture(['kunden']));let creditReads=0;
 const hidden=await getPaymentStatesBatch(denied,ids,async(...args)=>{creditReads++;return readCredit(...args);});
 expect([...hidden.values()].map(row=>row.code)).toEqual(['FORBIDDEN','FORBIDDEN']);expect(creditReads).toBe(0);
 expect(await getPaymentStatesBatch(actor,[b.orderId],readCredit)).toEqual(new Map([[b.orderId,fresh.get(b.orderId)]]));
});

it('250 payment credit SQL failure uses the original savepoint and keeps actual invoice money and the following customer source',async()=>{
 const a=await readyInvoiceOrder('TEST 250 payment good credit');
 const b=await readyInvoiceOrder('TEST 250 payment unavailable credit');
 const actor=await authorization();
 const good=await withSession(full,()=>getOrderPaymentStateAction({orderId:a.orderId}));
 const badBaseline=await withSession(full,()=>getOrderPaymentStateAction({orderId:b.orderId}));
 if(badBaseline.code!=='OK')throw Error('TEST_REAL_PAYMENT_SOURCE_REQUIRED');
 const fault:typeof readCredit=async(tx,tenantId,customerId)=>{
  const original=await readCredit(tx,tenantId,customerId);
  if(customerId===b.customerId)await tx.execute(query`SELECT 1 / 0 AS test_credit_source_failure`);
  return original;
 };
 const partial=await getPaymentStatesBatch(actor,[b.orderId,a.orderId],fault);
 expect(partial.get(a.orderId)).toEqual(good);
 expect(partial.get(b.orderId)).toMatchObject({code:'OK',data:{payment:badBaseline.data.payment,creditApplication:{code:'SOURCE_INCOMPLETE'}}});
 const recovered=await getPaymentStatesBatch(actor,JSON.parse(JSON.stringify([b.orderId,a.orderId])),readCredit);
 expect(recovered.get(a.orderId)).toEqual(good);expect(recovered.get(b.orderId)).toEqual(badBaseline);
 expect((await getPaymentStatesBatch(actor,['TEST-no-payment'],readCredit)).get('TEST-no-payment')).toMatchObject({code:'NOT_FOUND'});
});

it('250 informed zero/one/many reads preserve actual phone originals, freeze version, actor retry, permissions and fresh card state',async()=>{
 const a=await readyInvoiceOrder('TEST 250 informed A');
 const b=await readyInvoiceOrder('TEST 250 informed B','pickup',false,a.customerId);
 const actor=await authorization(),ids=[a.orderId,b.orderId];
 const before=await Promise.all(ids.map(id=>readOrderInformed(actor,id)));
 expect(before).toEqual([expect.objectContaining({code:'OK',informed:null,ampel:'rot'}),expect.objectContaining({code:'OK',informed:null,ampel:'rot'})]);
 expect(await readOrdersInformed(actor,[])).toEqual(new Map());
 const batch=await readOrdersInformed(actor,[...ids,a.orderId]);
 expect(batch.size).toBe(2);expect(batch.get(a.orderId)).toEqual(before[0]);expect(batch.get(b.orderId)).toEqual(before[1]);
 const operator=await createFixture(['auftraege'],'werkstatt');
 const input={orderId:a.orderId,expectedVersion:a.version,clientEventId:randomUUID()};
 const saved=await withSession(operator,()=>markOrderInformedByPhoneAction(input));expect(saved,JSON.stringify(saved)).toMatchObject({code:'OK'});
 if(saved.code!=='OK')throw Error('TEST_PHONE_ORIGINAL_REQUIRED');
 const replayed=await withSession(operator,()=>markOrderInformedByPhoneAction(JSON.parse(JSON.stringify(input))));
 expect(replayed).toMatchObject({code:'OK',receipt:saved.receipt,replayed:true});
 expect(await withSession(full,()=>markOrderInformedByPhoneAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(operator,()=>markOrderInformedByPhoneAction({...input,expectedVersion:a.version+1,clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT'});
 const original=await sql`SELECT id,user_id::text,payload FROM public.events WHERE tenant_id=${tenant} AND client_event_id=${input.clientEventId}::uuid`;
 expect(original).toHaveLength(1);expect(original[0].user_id).toBe(operator.actorId);expect(original[0].payload.receipt).toEqual(saved.receipt);
 const fresh=await readOrdersInformed(actor,JSON.parse(JSON.stringify(ids)));
 expect(fresh.get(a.orderId)).toMatchObject({code:'OK',orderVersion:a.version,informed:saved.receipt,firstInformed:saved.receipt,ampel:'gruen'});
 expect(fresh.get(b.orderId)).toEqual(before[1]);
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId:a.orderId}));
 expect(card).toMatchObject({code:'OK',data:{card:{version:a.version},customerInformed:fresh.get(a.orderId)}});
 expect(await sql`SELECT id,user_id::text,payload FROM public.events WHERE tenant_id=${tenant} AND client_event_id=${input.clientEventId}::uuid`).toEqual(original);
 expect(await sql`SELECT count(*)::integer AS n FROM public.communication_threads WHERE tenant_id=${tenant} AND order_id=${a.orderId}`).toEqual([{n:0}]);
 const denied=await authorization(await createFixture(['kunden']));
 expect([...(await readOrdersInformed(denied,ids)).values()]).toEqual([{code:'FORBIDDEN'},{code:'FORBIDDEN'}]);
 expect((await readOrdersInformed(actor,['TEST-no-informed-order'])).get('TEST-no-informed-order')).toEqual({code:'NOT_FOUND'});
});

it('250 a damaged original notification isolates its group after rollback while another qualified original stays readable',async()=>{
 const good=await readyInvoiceOrder('TEST 250 informed intact');
 const bad=await readyInvoiceOrder('TEST 250 informed damaged');
 const actor=await authorization();
 const saved=await withSession(full,()=>markOrderInformedByPhoneAction({orderId:bad.orderId,expectedVersion:bad.version,clientEventId:randomUUID()}));
 expect(saved).toMatchObject({code:'OK'});if(saved.code!=='OK')throw Error('TEST_REAL_DAMAGED_SOURCE_REQUIRED');
 const expected=await readOrderInformed(actor,good.orderId);
 const [original]=await sql`SELECT payload->>'intent' AS intent FROM public.events WHERE tenant_id=${tenant} AND id=${saved.receipt.eventId}`;
 const eventId=randomUUID(),key=randomUUID();
 // Explicitly synthetic corrupt history in this file's isolated fixed TEST tenant;
 // the actual writer original is retained byte-for-byte, no guard is bypassed.
 const payload={intent:original.intent,receipt:{...saved.receipt,eventId,actorId:randomUUID()}};
 await sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,correlation_id,event_schema_version,created_at)
 VALUES(${eventId},${tenant},${bad.orderId},'ORDER_CUSTOMER_INFORMED_V1','TEST damaged batch original',${sql.json(payload)}::jsonb,'success',${full.actorId}::uuid,${key}::uuid,${key}::uuid,1,statement_timestamp())`;
 const batch=await readOrdersInformed(actor,[bad.orderId,good.orderId]);
 expect(batch.get(bad.orderId)).toEqual({code:'UNAVAILABLE'});expect(batch.get(good.orderId)).toEqual(expected);
 const reread=await readOrdersInformed(actor,JSON.parse(JSON.stringify([good.orderId,bad.orderId])));
 expect(reread.get(good.orderId)).toEqual(expected);expect(reread.get(bad.orderId)).toEqual({code:'UNAVAILABLE'});
 expect(await sql`SELECT payload->'receipt' AS receipt FROM public.events WHERE tenant_id=${tenant} AND id=${saved.receipt.eventId}`).toEqual([{receipt:saved.receipt}]);
});
