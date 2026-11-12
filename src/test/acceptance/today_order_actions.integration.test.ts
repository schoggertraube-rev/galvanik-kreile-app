// @vitest-environment node
import {it,expect,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readTodayDashboard} from '@/lib/server/todayDashboard';
import {randomUUID} from 'node:crypto';
import {setOrderPickupAppointmentAction,changeOrderPromisedDueDateAction,transitionWareneingangToGalvanikAction,getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';

it('reads the exact same three real versioned U2 order actions into U3 and hides them without order rights',async()=>{
 const empty=await withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_S05_EMPTY_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 expect(empty).toMatchObject({hauptaktion:null,hauptaktionsQuelle:null,challenges:{groups:[]},orderSchedule:{code:'OK',today:0,upcoming:0},invoiceMoney:{code:'OK',openCount:0,openCents:0},assignmentMetric:{code:'OK',count:0}});
 const customerId=await customerFixture('TEST S05 U2 U3');
 const orders:Awaited<ReturnType<typeof intakeOrderFixture>>[]=[];for(let index=0;index<3;index++)orders.push(await intakeOrderFixture('TEST S05 Naht '+index,customerId));
 const [dates]=await sql`SELECT (statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date::text AS today,((statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date+1)::text AS tomorrow,((statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date+8)::text AS later`;
 for(const [index,dueDate] of [dates.today,dates.tomorrow,dates.later].entries())expect(await withSession(full,()=>changeOrderPromisedDueDateAction({orderId:orders[index].receipt.orderId,expectedVersion:1,dueDate,reason:'TEST S05 Kalendertag',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const read=(fixture:typeof full)=>withSession(fixture,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_S05_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 const day=await read(full);expect(day.orderSchedule).toMatchObject({code:'OK',today:1,upcoming:1});expect(day.orderActions).toMatchObject({code:'OK',missingOrderIds:[]});
 expect(day.orderActions?.rows).toHaveLength(3);
 const focus=day.orderActions!.rows.find(row=>row.orderId===day.hauptaktionsQuelle?.id);expect(focus).toBeDefined();expect(day.hauptaktion).toEqual(focus!.read.hauptaktion);expect(day.hauptaktionsQuelle).toMatchObject({id:orders[0].receipt.orderId,version:2});
 for(const order of orders){
  const card=await withSession(full,()=>getLiveOrderCardAction({orderId:order.receipt.orderId}));if(card.code!=='OK')throw Error('TEST_S05_CARD');
  expect(day.orderActions?.rows.find(row=>row.orderId===order.receipt.orderId)).toEqual({orderId:order.receipt.orderId,version:card.data.card.version,read:card.data.nextActionRule});
 }
 expect((await read(full)).orderActions).toEqual(day.orderActions);
 const firstOrder=orders[0].receipt.orderId;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId:firstOrder,expectedVersion:2,clientEventId:randomUUID()}));expect(moved).toMatchObject({code:'OK'});
 const changed=await read(full),card=await withSession(full,()=>getLiveOrderCardAction({orderId:firstOrder}));if(card.code!=='OK')throw Error('TEST_S05_CHANGED_CARD');
 expect(changed.orderActions?.rows.find(row=>row.orderId===firstOrder)).toEqual({orderId:firstOrder,version:3,read:card.data.nextActionRule});
 expect(day.orderActions?.rows.find(row=>row.orderId===firstOrder)?.version).toBe(2);
 expect(changed.hauptaktion).toEqual(card.data.nextActionRule!.hauptaktion);expect(changed.hauptaktionsQuelle).toMatchObject({id:firstOrder,version:3});
 const noOrders=await createFixture(['mails']);const hidden=await read(noOrders);expect(hidden).not.toHaveProperty('orderActions');expect(hidden).not.toHaveProperty('orderSchedule');
});

it('uses an actual frozen pickup appointment instead of the old production date',async()=>{
 const order=await readyInvoiceOrder('TEST S05 Abholkalender');
 const [dates]=await sql`SELECT (statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date::text AS today,((statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date+1)::text AS tomorrow`;
 const read=()=>withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_S05_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 const firstInput={orderId:order.orderId,expectedVersion:order.version,previousEventId:null,date:dates.today,channel:'telefon' as const,clientEventId:randomUUID()};
 const first=await withSession(full,()=>setOrderPickupAppointmentAction(firstInput));expect(first).toMatchObject({code:'OK'});if(first.code!=='OK')throw Error('TEST_S05_APPOINTMENT');
 const initial=await read(),row=initial.orderActions?.rows.find(row=>row.orderId===order.orderId);
 expect(row?.pickupSchedule).toMatchObject({code:'OK',date:dates.today,eventId:first.receipt.eventId,freezeId:first.receipt.freezeId});
 expect(initial.orderSchedule?.sources.find(row=>row.id===order.orderId)).toMatchObject({dueDate:dates.today,appointmentEventId:first.receipt.eventId});
 const changedInput={...firstInput,previousEventId:first.receipt.eventId,date:dates.tomorrow,clientEventId:randomUUID()};
 const changed=await withSession(full,()=>setOrderPickupAppointmentAction(changedInput));expect(changed).toMatchObject({code:'OK'});if(changed.code!=='OK')throw Error('TEST_S05_APPOINTMENT_CHANGE');
 expect(await withSession(full,()=>setOrderPickupAppointmentAction(JSON.parse(JSON.stringify(changedInput))))).toMatchObject({code:'OK',replayed:true});
 const fresh=await read();expect(fresh.orderSchedule?.sources.find(row=>row.id===order.orderId)).toMatchObject({dueDate:dates.tomorrow,appointmentEventId:changed.receipt.eventId});
 expect(fresh.orderSchedule?.sources.find(row=>row.id===order.orderId)?.dueDate).not.toBe('2027-05-15');
});
