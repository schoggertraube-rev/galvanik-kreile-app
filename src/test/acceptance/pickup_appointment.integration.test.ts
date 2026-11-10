// @vitest-environment node
import {vi,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {setOrderPickupAppointmentAction,getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('PICKUP_APPOINTMENT_LOOPBACK_REQUIRED');

it('a separate actual appointment preserves the production date, records actor/channel and supports fresh retry and competing updates',async()=>{
 const order=await readyInvoiceOrder('Abholtermin'),before=await sql`SELECT due_date,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
 const input={orderId:order.orderId,expectedVersion:order.version,previousEventId:null,date:'2027-06-10',channel:'telefon' as const,clientEventId:randomUUID()};
 const denied=await createFixture(['kunden'],'werkstatt');expect(await withSession(denied,()=>setOrderPickupAppointmentAction(input))).toMatchObject({code:'FORBIDDEN'});
 const created=await withSession(full,()=>setOrderPickupAppointmentAction(input));expect(created).toMatchObject({code:'OK',replayed:false});if(created.code!=='OK')throw Error('APPOINTMENT_CREATED');
 expect(await sql`SELECT due_date,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual(before);
 expect(await sql`SELECT event_type,user_id::text,payload->'receipt'->>'date' AS date,payload->'receipt'->>'channel' AS channel FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${created.receipt.eventId}`).toEqual([{event_type:'ORDER_PICKUP_APPOINTMENT_SET_V1',user_id:full.actorId,date:input.date,channel:'telefon'}]);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{pickupAppointment:{code:'OK',appointment:{eventId:created.receipt.eventId,date:input.date,actorId:full.actorId,channel:'telefon'}}}});
 expect(await withSession(full,()=>setOrderPickupAppointmentAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:created.receipt.eventId}});
 const updates=['2027-06-11','2027-06-12'].map(date=>({...input,date,previousEventId:created.receipt.eventId,clientEventId:randomUUID()}));
 const results=await Promise.all(updates.map(request=>withSession(full,()=>setOrderPickupAppointmentAction(request))));expect(results.map(result=>result.code).sort()).toEqual(['CONFLICT','OK']);
 const winner=results.find(result=>result.code==='OK');if(winner?.code!=='OK')throw Error('APPOINTMENT_WINNER');
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{pickupAppointment:{code:'OK',appointment:{eventId:winner.receipt.eventId,date:winner.receipt.date}}}});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND event_type='ORDER_PICKUP_APPOINTMENT_SET_V1'`).toEqual([{n:2}]);
 const operator=await createFixture(['auftraege'],'werkstatt'),changedInput={...input,clientEventId:randomUUID(),date:'2027-06-13',previousEventId:winner.receipt.eventId};
 const changed=await withSession(operator,()=>setOrderPickupAppointmentAction(changedInput));expect(changed).toMatchObject({code:'OK',receipt:{actorId:operator.actorId}});if(changed.code!=='OK')throw Error('APPOINTMENT_OPERATOR');
 expect(await withSession(full,()=>setOrderPickupAppointmentAction(structuredClone(changedInput)))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>setOrderPickupAppointmentAction({...updates[0],clientEventId:randomUUID(),previousEventId:winner.receipt.eventId,date:'2027-02-30'}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:order.version,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>setOrderPickupAppointmentAction({...updates[0],clientEventId:randomUUID(),previousEventId:winner.receipt.eventId}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{pickupAppointment:{code:'OK',appointment:null}}});
 const shipping=await readyInvoiceOrder('Abholtermin-Versand','shipping');
 expect(await withSession(full,()=>setOrderPickupAppointmentAction({...input,orderId:shipping.orderId,expectedVersion:shipping.version,clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${shipping.orderId} AND event_type='ORDER_PICKUP_APPOINTMENT_SET_V1'`).toHaveLength(0);
});
