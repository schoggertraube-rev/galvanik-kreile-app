// @vitest-environment node
// PL19:52 B1: actual agreement/tracking/group/invoice writers, no invoice substitute.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyOrderForInvoice,manualTrackingFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {saveCustomerAgreementAction} from '@/app/actions/customers.actions';
import {getManualShippingAction,getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
import type {ShipmentGroupInput} from '@/lib/domain/shipmentGroupContract';
async function prepared(type:'ausgabe_ohne_zahlung'|'zahlungsziel'){
 const order=await readyOrderForInvoice('TEST B1 '+type,'shipping');
 const agreement=await withSession(full,()=>saveCustomerAgreementAction({customerId:order.customerId,orderId:order.orderId,clientKey:randomUUID(),type,targetDays:type==='zahlungsziel'?14:null,reason:'TEST B1 agreed output'}));if(agreement.code!=='OK')throw Error('TEST_B1_AGREEMENT:'+agreement.code);
 const a=await manualTrackingFixture(order.orderId),b=await manualTrackingFixture(order.orderId);
 return {order,a,b,agreement:{id:agreement.agreement.id,version:agreement.agreement.version,type}};
}
async function confirmation(value:Awaited<ReturnType<typeof prepared>>,shipmentId:string,reason?:string):Promise<ShipmentGroupInput>{
 const read=await withSession(full,()=>getManualShippingAction({orderId:value.order.orderId}));if(read.code!=='OK')throw Error('TEST_B1_READ');
 const group=read.data.shipmentGroups.find(group=>group.members.some(member=>member.shipmentId===shipmentId));if(!group)throw Error('TEST_B1_GROUP');
 return {orderId:value.order.orderId,groupId:group.id,expectedGroupVersion:group.version,clientEventId:randomUUID(),members:[{orderId:value.order.orderId,expectedVersion:group.members[0].orderVersion,agreement:value.agreement,...(reason?{overdueReleaseReason:reason}:{})}]};
}
for(const type of ['ausgabe_ohne_zahlung','zahlungsziel'] as const)it(`B1 ${type}: first partial group has no invoice, final parcel produces exactly one invoice and one full output`,async()=>{
 const value=await prepared(type),first=await confirmation(value,value.a.shipmentId);
 const attempts=await Promise.all([withSession(full,()=>recordGoodsOutAction(first)),withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(first)) as ShipmentGroupInput))]);
 expect(attempts.every(result=>result.code==='OK')).toBe(true);
 expect(attempts.map(result=>result.code==='OK'?result.replayed:null).sort()).toEqual([false,true]);
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${value.order.orderId}`).toEqual([{n:0}]);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:value.order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'fertig',version:first.members[0].expectedVersion}}});
 expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(first)) as ShipmentGroupInput))).toMatchObject({code:'OK',replayed:true});
 const second=await confirmation(value,value.b.shipmentId);
 const complete=await Promise.all([withSession(full,()=>recordGoodsOutAction(second)),withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(second)) as ShipmentGroupInput))]);
 expect(complete.every(result=>result.code==='OK'),JSON.stringify(complete)).toBe(true);
 expect(complete.map(result=>result.code==='OK'?result.replayed:null).sort()).toEqual([false,true]);
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${value.order.orderId} AND status='issued'`).toEqual([{n:1}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${value.order.orderId} AND event_type LIKE 'ORDER_PICKED_UP_V%'`).toEqual([{n:1}]);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:value.order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt',handoverMode:'shipping'}}});
 expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(first)) as ShipmentGroupInput))).toMatchObject({code:'OK',replayed:true});
});
it('B1 partial override preserves actual actor, mandatory reason and the shared group source without pretending full output',async()=>{
 const value=await prepared('zahlungsziel');
 const old=await intakeOrderFixture('TEST B1 historical debt',value.order.customerId),invoiceId=randomUUID();
 // Same isolated historical initial debt as H4. Every later action is real.
 await sql`INSERT INTO public.invoices(id,tenant_id,order_id,customer_id,invoice_number,amount_total,status,due_date,gross_amount_cents,payment_contract_version,payment_mode,payment_status,payment_open_amount_cents,payment_paid_amount_cents,payment_currency,payment_version)
 VALUES(${invoiceId}::uuid,${KREILE_TENANT_SLUG},${old.receipt.orderId},${value.order.customerId},'R-2025-0001',60,'issued',(statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1,6000,1,'rechnung','offen',6000,0,'EUR',0)`;
 const reason='TEST explicit partial release after consultation',input=await confirmation(value,value.a.shipmentId,reason);
 expect(await withSession(full,()=>recordGoodsOutAction(input))).toMatchObject({code:'FORBIDDEN'});
 const approver=await createFixture(['auftraege','entscheiden'],'meister');
 const suffix=randomUUID().replaceAll('-',''),fn='test_b1_override_'+suffix;
 if(!/^TEST-ablauf-[a-f0-9-]+$/.test(KREILE_TENANT_SLUG))throw Error('TEST_B1_FAULT_TENANT');
 // Only this isolated TEST order's new INSERT is suppressed; existing immutable
 // originals/guards are untouched. No parcel may survive a missing audit.
 await sql.unsafe(`CREATE FUNCTION private.${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.order_id='${value.order.orderId}' AND NEW.event_type='ORDER_GOODS_OUT_DEBT_OVERRIDE_V1' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fn} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${fn}()`);
 try{
  expect(await withSession(approver,()=>recordGoodsOutAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT count(*)::int AS n FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${value.order.orderId} AND shipped_at IS NOT NULL`).toEqual([{n:0}]);
  expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${value.order.orderId} AND event_type IN ('SHIPMENT_GROUP_HANDED_OVER_V1','SHIPMENT_HANDED_OVER_V1','ORDER_GOODS_OUT_DEBT_OVERRIDE_V1')`).toEqual([{n:0}]);
 }finally{await sql.unsafe(`DROP TRIGGER IF EXISTS ${fn} ON public.events`);await sql.unsafe(`DROP FUNCTION IF EXISTS private.${fn}()`);}
 const result=await withSession(approver,()=>recordGoodsOutAction(input));expect(result).toMatchObject({code:'OK'});if(result.code!=='OK')throw Error('TEST_B1_OVERRIDE');
 const rows=await sql`SELECT id,user_id::text,event_schema_version,payload FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${value.order.orderId} AND event_type='ORDER_GOODS_OUT_DEBT_OVERRIDE_V1'`;
 expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({user_id:approver.actorId,event_schema_version:2,payload:{groupEventId:result.receipt.eventId,invoiceId,reason,shipmentIds:[value.a.shipmentId]}});
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${value.order.orderId}`).toEqual([{n:0}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${value.order.orderId} AND event_type LIKE 'ORDER_PICKED_UP_V%'`).toEqual([{n:0}]);
 expect(await withSession(approver,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input)) as ShipmentGroupInput))).toMatchObject({code:'OK',replayed:true});
 for(const mutate of [()=>sql`UPDATE public.events SET payload='{}'::jsonb WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${rows[0].id}`,()=>sql`DELETE FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${rows[0].id}`])await expect(mutate()).rejects.toMatchObject({code:'23514',message:'GOODS_OUT_DEBT_OVERRIDE_IMMUTABLE'});
 expect(await sql`SELECT payment_open_amount_cents FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${invoiceId}::uuid`).toEqual([{payment_open_amount_cents:6000}]);
});
