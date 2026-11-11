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
import {getOrdersDb} from '@/app/actions/orders.actions';
import {updateCustomerAction} from '@/app/actions/customers.actions';
import {createDispatchCallTaskAction,getIntakeTaskAction} from '@/app/actions/eingang.actions';
import {readShippingSettingsAction,saveShippingSettingsAction} from '@/app/actions/settings.actions';
import {emptyDispatchPolicy} from '@/modules/fundament/public';
import {resolveAuthorization} from '@/lib/server/authorization';
import {createDispatchCall} from '@/lib/server/dispatchCallPort';
import {createOrderHandoverTask} from '@/modules/tasks/server-public';
import {recordIntakeTaskEffect} from '@/modules/eingang/server-public';
import {readCustomerProfile} from '@/modules/customers/server-public';
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
it('a stale call proposal cannot recreate a callback after an actual pickup agreement has paused its group',async()=>{
 const order=await readyInvoiceOrder('Abholtermin-Anrufrennen');
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('CALL_RACE_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:{...emptyDispatchPolicy(),holidays:[]}}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),email:''}))).toMatchObject({code:'OK'});
 const queue=await withSession(full,()=>getOrdersDb());if(!queue.ok)throw Error('CALL_RACE_QUEUE');
 const plan=queue.data.find(row=>row.id===order.orderId)?.finishedDispatch?.reminder;
 expect(plan).toMatchObject({stage:'E3',state:'DUE'});if(!plan?.clientKey||!plan.due)throw Error('CALL_RACE_PROPOSAL');
 expect(await withSession(full,()=>setOrderPickupAppointmentAction({orderId:order.orderId,expectedVersion:order.version,previousEventId:null,date:'2027-06-10',channel:'telefon',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const request={customerId:order.customerId,handover:'pickup' as const,dueDate:plan.due,clientKey:plan.clientKey};
 // The real UI composition can have read its proposal before the agreement
 // commits. Resume that exact server command with its captured real readback.
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('CALL_RACE_AUTH');
 expect(await createDispatchCall(auth.data,request,plan,queue.data.filter(row=>row.id===order.orderId),(tx,input)=>createOrderHandoverTask(tx,auth.data,input,{effect:(writeTx,actor,effect)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>createDispatchCallTaskAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_CALL_CREATED_V1' AND payload->'meta'->'orderIds' @> ${sql.json([order.orderId])}`).toHaveLength(0);
 const refreshed=await withSession(full,()=>getOrdersDb());if(!refreshed.ok)throw Error('CALL_RACE_REFRESH');
 expect(refreshed.data.find(row=>row.id===order.orderId)?.finishedDispatch?.reminder).toMatchObject({state:'PAUSED',clientKey:null});
});
it('PL12:06 atomically ends only the actual matching callback with its appointment proof and preserves a recoverable retry',async()=>{
 const seeded=await readyInvoiceOrder('Termin-beendet-Anruf');
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('CLOSE_CALL_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:{...emptyDispatchPolicy(),holidays:[]}}))).toMatchObject({code:'OK'});
 async function openCall(label:string,existing?:typeof seeded){
  const order=existing??await readyInvoiceOrder(label);expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),email:''}))).toMatchObject({code:'OK'});
  const queue=await withSession(full,()=>getOrdersDb());if(!queue.ok)throw Error('CLOSE_CALL_QUEUE');const p=queue.data.find(row=>row.id===order.orderId)?.finishedDispatch?.reminder;if(!p?.due||!p.clientKey)throw Error('CLOSE_CALL_PLAN');
  const call=await withSession(full,()=>createDispatchCallTaskAction({customerId:order.customerId,handover:'pickup',dueDate:p.due!,clientKey:p.clientKey!}));if(call.code!=='OK')throw Error('CLOSE_CALL_CREATE');return {order,taskId:call.taskId};
 }
 const target=await openCall('Termin-beendet-Anruf',seeded),other=await openCall('Fremder-Anruf-bleibt');
 const actor=await createFixture(['auftraege'],'werkstatt'),input={orderId:target.order.orderId,expectedVersion:target.order.version,previousEventId:null,date:'2027-06-10',channel:'telefon' as const,clientEventId:randomUUID()};
 const name='test_appointment_close_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='ORDER_COLLECTION_TASK_ENDED_FOR_APPOINTMENT_V1' AND NEW.payload->>'taskId'='${target.taskId}' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${name}()`);
 try{
  expect(await withSession(actor,()=>setOrderPickupAppointmentAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT status,version FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${target.taskId}::uuid`).toEqual([{status:'offen',version:1}]);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toHaveLength(0);
 }finally{await sql.unsafe(`DROP TRIGGER ${name} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${name}()`);}
 const saved=await withSession(actor,()=>setOrderPickupAppointmentAction(JSON.parse(JSON.stringify(input))));expect(saved.code).toBe('OK');if(saved.code!=='OK')throw Error('CLOSE_CALL_APPOINTMENT');
 expect(await withSession(full,()=>getIntakeTaskAction({taskId:target.taskId}))).toMatchObject({code:'OK',task:{status:'erledigt',erledigt_von:actor.actorId}});
 expect(await withSession(full,()=>getIntakeTaskAction({taskId:other.taskId}))).toMatchObject({code:'OK',task:{status:'offen'}});
 expect(await sql`SELECT payload->>'appointmentEventId' AS appointment,user_id::text AS actor FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_TASK_ENDED_FOR_APPOINTMENT_V1' AND payload->>'taskId'=${target.taskId}`).toEqual([{appointment:saved.receipt.eventId,actor:actor.actorId}]);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_CALL_RESULT_V1' AND payload->>'taskId'=${target.taskId}`).toHaveLength(0);
 const queue=await withSession(full,()=>getOrdersDb());if(!queue.ok)throw Error('CLOSE_CALL_READBACK');expect(queue.data.find(row=>row.id===target.order.orderId)?.finishedDispatch?.reminder).toMatchObject({state:'PAUSED',clientKey:null});
 expect(await withSession(actor,()=>setOrderPickupAppointmentAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:saved.receipt.eventId}});
});
