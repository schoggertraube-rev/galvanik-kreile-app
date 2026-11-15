// @vitest-environment node
// TEST only: real tracking, invoice, goods-out writers and the existing group reader.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyOrderForInvoice,readyInvoiceOrder,manualTrackingFixture} from '../../../e2e/ablauf/orderFixture';
import {getManualShippingAction,saveManualTrackingAction,getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {issueInvoiceAction} from '@/app/actions/invoices.actions';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
import type {ShipmentGroupInput} from '@/lib/domain/shipmentGroupContract';
async function confirmation(orderId:string,index=0):Promise<ShipmentGroupInput>{
 const read=await withSession(full,()=>getManualShippingAction({orderId}));if(read.code!=='OK')throw Error('TEST_S10_GROUP_READ');
 const group=read.data.shipmentGroups[index];if(!group)throw Error('TEST_S10_GROUP_MISSING');
 return {orderId,groupId:group.id,expectedGroupVersion:group.version,clientEventId:randomUUID(),members:[...new Map(group.members.map(row=>[row.orderId,{orderId:row.orderId,expectedVersion:row.orderVersion}])).values()]};
}
it('S10 one explicit current group hands over A+B atomically and retries one original',async()=>{
 const a=await readyOrderForInvoice('TEST S10 atomar A','shipping'),b=await readyOrderForInvoice('TEST S10 atomar B','shipping',a.customerId);
 const parcel=await manualTrackingFixture(a.orderId);
 expect(await withSession(full,()=>saveManualTrackingAction({orderId:a.orderId,shipmentId:parcel.shipmentId,expectedUpdatedAt:parcel.updatedAt,trackingNumber:parcel.trackingNumber,allowFormatMismatch:false,reason:null,clientEventId:randomUUID(),withOrder:{orderId:b.orderId,shipmentId:null,expectedUpdatedAt:null}}))).toMatchObject({code:'OK'});
 for(const order of [a,b])expect(await withSession(full,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const input=await confirmation(a.orderId),login=await createFixture(['auftraege'],'werkstatt');
 const denied=await createFixture(['kunden']);expect(await withSession(denied,()=>recordGoodsOutAction(input))).toMatchObject({code:'FORBIDDEN'});
 const attempts=await Promise.all([withSession(login,()=>recordGoodsOutAction(input)),withSession(login,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input)) as ShipmentGroupInput))]);
 expect(attempts.every(row=>row.code==='OK')).toBe(true);
 expect(attempts.map(row=>row.code==='OK'?row.replayed:null).sort()).toEqual([false,true]);
 const result=attempts.find(row=>row.code==='OK'&&!row.replayed)!;
 expect(result,JSON.stringify(result)).toMatchObject({code:'OK',replayed:false,receipt:{groupId:input.groupId,actorId:login.actorId,trackingNumber:parcel.trackingNumber}});
 expect(await sql`SELECT id,station FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id IN (${a.orderId},${b.orderId}) ORDER BY id`).toEqual([a.orderId,b.orderId].sort().map(id=>({id,station:'abgeholt'})));
 expect(await sql`SELECT status,tracking_number,shipped_at IS NOT NULL AS handed FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND sendung_id=${input.groupId}::uuid ORDER BY id`).toEqual([{status:'shipped',tracking_number:parcel.trackingNumber,handed:true},{status:'shipped',tracking_number:parcel.trackingNumber,handed:true}]);
 expect(await withSession(login,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input)) as ShipmentGroupInput))).toMatchObject({code:'OK',replayed:true,receipt:result.code==='OK'?{eventId:result.receipt.eventId}:{}});
 expect(await withSession(full,()=>recordGoodsOutAction(input))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='SHIPMENT_GROUP_HANDED_OVER_V1' AND client_event_id=${input.clientEventId}::uuid`).toEqual([{n:1}]);
 const events=await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id IN (${a.orderId},${b.orderId}) AND event_type='SHIPMENT_HANDED_OVER_V1'`;
 expect(events).toHaveLength(2);
 const [original]=await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`;
 await expect(sql`UPDATE public.events SET event_type='TEST_RETYPE' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${original.id}`).rejects.toMatchObject({code:'P0001'});
 await expect(sql`DELETE FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${original.id}`).rejects.toMatchObject({code:'P0001'});
 for(const event of events)await expect(sql`UPDATE public.events SET payload='{}'::jsonb WHERE id=${event.id} AND tenant_id=${KREILE_TENANT_SLUG}`).rejects.toMatchObject({code:'P0001'});
});
it('S10 handing over one of two actual parcels leaves the order open until the second group is confirmed',async()=>{
 const order=await readyInvoiceOrder('TEST S10 zwei Pakete','shipping');
 await manualTrackingFixture(order.orderId);
 // Explicit synthetic initial unprocessed parcel; its later number and handover
 // must go through the real existing commands, never a fabricated receipt.
 const missingId=randomUUID();await sql`INSERT INTO public.shipments(id,tenant_id,order_id,status) VALUES(${missingId}::uuid,${KREILE_TENANT_SLUG},${order.orderId},'pending')`;
 expect(await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,expectedVersion:order.version,mode:'versand',clientEventId:randomUUID()}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT count(*)::int AS n FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND shipped_at IS NOT NULL`).toEqual([{n:0}]);
 const first=await confirmation(order.orderId);
 expect(await withSession(full,()=>recordGoodsOutAction(first))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'fertig',version:order.version}}});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND event_type LIKE 'ORDER_PICKED_UP_V%'`).toEqual([{n:0}]);
 const read=await withSession(full,()=>getManualShippingAction({orderId:order.orderId}));if(read.code!=='OK')throw Error('TEST_S10_SECOND_READ');
 const remaining=read.data.shipments.find(row=>row.id===missingId);if(!remaining)throw Error('TEST_S10_SECOND_MISSING');
 expect(await withSession(full,()=>saveManualTrackingAction({orderId:order.orderId,shipmentId:missingId,expectedUpdatedAt:remaining.updatedAt,trackingNumber:'TEST second '+randomUUID(),allowFormatMismatch:false,reason:null,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const second=await confirmation(order.orderId,1);
 expect(await withSession(full,()=>recordGoodsOutAction(second))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt',version:order.version+1}}});
 expect(await withSession(full,()=>recordGoodsOutAction(first))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND event_type LIKE 'ORDER_PICKED_UP_V%'`).toEqual([{n:1}]);
});

it('S10 a blocked B rolls back the whole group, names B, and a real payment/reload permits the same unused request key',async()=>{
 const a=await readyOrderForInvoice('TEST S10 frei A','shipping'),b=await readyOrderForInvoice('TEST S10 gesperrt B','shipping',a.customerId);
 const parcel=await manualTrackingFixture(a.orderId);
 expect(await withSession(full,()=>saveManualTrackingAction({orderId:a.orderId,shipmentId:parcel.shipmentId,expectedUpdatedAt:parcel.updatedAt,trackingNumber:parcel.trackingNumber,allowFormatMismatch:false,reason:null,clientEventId:randomUUID(),withOrder:{orderId:b.orderId,shipmentId:null,expectedUpdatedAt:null}}))).toMatchObject({code:'OK'});
 const invoices=[];
 for(const order of [a,b]){const issued=await withSession(full,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()}));if(issued.code!=='OK')throw Error('TEST_S10_GROUP_ISSUED');invoices.push(issued.receipt);}
 const {setPaymentModeAction,confirmPaymentAction}=await import('@/app/actions/payments.actions');
 expect(await withSession(full,()=>setPaymentModeAction({orderId:b.orderId,paymentMode:'vorkasse',expectedVersion:0,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const input=await confirmation(a.orderId);
 const before=await sql`SELECT id,station,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id IN (${a.orderId},${b.orderId}) ORDER BY id`;
 const blocked=await withSession(full,()=>recordGoodsOutAction(input));
 expect(blocked,JSON.stringify(blocked)).toMatchObject({code:'CONFLICT',blockedOrderId:b.orderId});
 expect(await sql`SELECT id,station,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id IN (${a.orderId},${b.orderId}) ORDER BY id`).toEqual(before);
 expect(await sql`SELECT count(*)::int AS n FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND sendung_id=${input.groupId}::uuid AND shipped_at IS NOT NULL`).toEqual([{n:0}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id IN (${a.orderId},${b.orderId}) AND (event_type='SHIPMENT_GROUP_HANDED_OVER_V1' OR event_type LIKE 'ORDER_PICKED_UP_V%')`).toEqual([{n:0}]);
 const invoice=invoices[1];expect(await withSession(full,()=>confirmPaymentAction({invoiceId:invoice.invoiceId,amount:invoice.grossAmountCents,method:'bar',expectedVersion:0,expectedOpenAmountCents:invoice.grossAmountCents,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const fresh={...await confirmation(a.orderId),clientEventId:input.clientEventId};
 expect(await withSession(full,()=>recordGoodsOutAction(fresh))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(fresh)) as ShipmentGroupInput))).toMatchObject({code:'OK',replayed:true});
});

it('S10 a suppressed shared original rolls back all actual handovers and the unchanged request can be retried',async()=>{
 const a=await readyOrderForInvoice('TEST S10 atomic rollback A','shipping'),b=await readyOrderForInvoice('TEST S10 atomic rollback B','shipping',a.customerId);
 const parcel=await manualTrackingFixture(a.orderId);
 expect(await withSession(full,()=>saveManualTrackingAction({orderId:a.orderId,shipmentId:parcel.shipmentId,expectedUpdatedAt:parcel.updatedAt,trackingNumber:parcel.trackingNumber,allowFormatMismatch:false,reason:null,clientEventId:randomUUID(),withOrder:{orderId:b.orderId,shipmentId:null,expectedUpdatedAt:null}}))).toMatchObject({code:'OK'});
 for(const order of [a,b])expect(await withSession(full,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const input=await confirmation(a.orderId),suffix=randomUUID().replaceAll('-',''),fn='test_s10_group_'+suffix,trigger='test_s10_group_'+suffix;
 if(!/^TEST-ablauf-[a-f0-9-]+$/.test(KREILE_TENANT_SLUG))throw Error('TEST_S10_FAULT_TENANT');
 // Own isolated INSERT fault only. No existing original or guard is changed.
 await sql.unsafe(`CREATE FUNCTION private.${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='SHIPMENT_GROUP_HANDED_OVER_V1' AND NEW.client_event_id='${input.clientEventId}'::uuid THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${fn}()`);
 const before=await sql`SELECT id,station,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id IN (${a.orderId},${b.orderId}) ORDER BY id`;
 try{
  expect(await withSession(full,()=>recordGoodsOutAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT id,station,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id IN (${a.orderId},${b.orderId}) ORDER BY id`).toEqual(before);
  expect(await sql`SELECT count(*)::int AS n FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND sendung_id=${input.groupId}::uuid AND shipped_at IS NOT NULL`).toEqual([{n:0}]);
  expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id IN (${a.orderId},${b.orderId}) AND (event_type LIKE 'ORDER_PICKED_UP_V%' OR event_type IN ('SHIPMENT_GROUP_HANDED_OVER_V1','SHIPMENT_HANDED_OVER_V1'))`).toEqual([{n:0}]);
 }finally{await sql.unsafe(`DROP TRIGGER IF EXISTS ${trigger} ON public.events`);await sql.unsafe(`DROP FUNCTION IF EXISTS private.${fn}()`);}
 expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input)) as ShipmentGroupInput))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input)) as ShipmentGroupInput))).toMatchObject({code:'OK',replayed:true});
});
