// @vitest-environment node
import {expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {sql as query} from 'drizzle-orm';
import {full,sql,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyOrderForInvoice,manualTrackingFixture} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readManualShippingBatch} from '@/modules/orders/server-public';
import {readCustomerProfile} from '@/modules/customers/server-public';
import {readShippingSettingsInTransaction} from '@/modules/fundament/server-public';
import {readInvoiceVat} from '@/modules/accounting/server-public';
import {readShippingMergeAllocation} from '@/lib/server/commands/immutableInvoiceCommand';
import {getManualShippingAction,saveManualTrackingAction} from '@/app/actions/orders.actions';

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
