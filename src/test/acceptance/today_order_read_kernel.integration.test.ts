// @vitest-environment node
// Existing whole order readers: real TEST intake/assignment/invoice sources.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {authorizationReadContext} from '@/lib/server/authorizationReadContext';
import {paymentReadAuthorization} from '@/lib/server/paymentContract';
import {maskOrderPaymentCredit} from '@/lib/server/paymentSummaryRead';
import {maskTodayOrderCard,readLiveOrderCard,readLiveOrderCardSource} from '@/lib/server/orderCardRead';
import {readTodayOrderSources,type TodayOrderReadAuthorization,type TodayOrderReadPorts} from '@/lib/server/todayOrderRead';
import {readV45OrderRule} from '@/lib/server/v45OrderRead';
import {assignOrderTaskAction,getTodayOrderReadAction} from '@/app/actions/orders.actions';

import {readInvoiceVat,readCustomerCreditInTransaction} from '@/modules/accounting/server-public';
import {readShippingSettingsInTransaction} from '@/modules/fundament/server-public';
import {readCustomerProfile,readCustomerProfiles} from '@/modules/customers/server-public';
import {readManualShippingBatch} from '@/modules/orders/server-public';
import {readShippingMergeAllocation} from '@/lib/server/commands/immutableInvoiceCommand';
const ports:TodayOrderReadPorts={
 readVat:readInvoiceVat,readSettings:readShippingSettingsInTransaction,
 readCredit:(tx,tenantId,customerId)=>readCustomerCreditInTransaction(tx,tenantId,customerId,readCustomerProfile),
 readShipments:(auth,ids,readSettings)=>readManualShippingBatch(auth,ids,{readSettings,readCustomer:readCustomerProfile,readCustomers:readCustomerProfiles,readAllocation:(tx,tenantId,customerId,input)=>readShippingMergeAllocation(tx,tenantId,customerId,input,readInvoiceVat)}),
};

it('retains the complete live card and actual assignment, with the personal flag derived only for the real login',async()=>{
 const created=await intakeOrderFixture('TEST readonly live assignment',await customerFixture('TEST live card source'));
 const orderId=created.receipt.orderId,auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_LIVE_CARD_AUTH');
 const initial=await readLiveOrderCard(auth.data,{orderId});expect(initial).toMatchObject({code:'OK',data:{id:orderId,assignment:null}});if(initial.code!=='OK')throw Error('TEST_LIVE_CARD_SOURCE');
 const assignee=await createFixture(['auftraege'],'werkstatt');
 const input={orderId,assigneeUserId:assignee.actorId,expectedVersion:initial.data.version,clientEventId:randomUUID()};
 const assigned=await withSession(full,()=>assignOrderTaskAction(input));expect(assigned).toMatchObject({code:'OK',replayed:false});
 expect(await withSession(full,()=>assignOrderTaskAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 const events=await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`;
 for(const fixture of [full,assignee,await createFixture(['auftraege']),await createFixture(['mails']),await createFixture(['preise'])]){
  const result=await withSession(fixture,()=>resolveAuthorization());if(!result.ok)throw Error('TEST_LIVE_CARD_PROFILE');
  const source=await readLiveOrderCardSource(authorizationReadContext(result.data),{orderId});
  const personal=await readLiveOrderCard(result.data,{orderId});
  if(source.code!=='OK'){expect(personal).toEqual(source);continue;}
  if(personal.code!=='OK')throw Error('TEST_LIVE_CARD_PERSONAL');
  expect(source.data.assignment).not.toHaveProperty('isAssignedToCurrentUser');
  const assignment=source.data.assignment;
  expect({...source.data,assignment:assignment?{...assignment,isAssignedToCurrentUser:assignment.active&&assignment.assignedTo===fixture.actorId}:null}).toEqual(personal.data);
  expect(personal.data.assignment).toMatchObject({assignedTo:assignee.actorId,isAssignedToCurrentUser:fixture.actorId===assignee.actorId});
  expect(await readLiveOrderCardSource({tenantId:result.data.tenantId,permissions:result.data.permissions},{orderId:randomUUID()})).toMatchObject({code:'NOT_FOUND'});
 }
 expect(await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`).toEqual(events);
});

it('uses one complete Today source composition before the unchanged actor-bound rule, for 0/1/multiple and missing orders',async()=>{
 const pickup=await readyInvoiceOrder('TEST Today common pickup'),shipping=await readyInvoiceOrder('TEST Today common shipping','shipping');
 const missing=randomUUID();
 for(const rights of [null,['auftraege'],['auftraege','preise'],['auftraege','zahlungen'],['mails']] as const){
  const fixture=rights===null?full:await createFixture([...rights]),result=await withSession(fixture,()=>resolveAuthorization());if(!result.ok)throw Error('TEST_TODAY_SOURCE_AUTH');
  const read=authorizationReadContext(result.data),areas=new Set(result.data.areas);
  const callback:TodayOrderReadAuthorization={...read,payment:paymentReadAuthorization(result.data)};
  const projection:TodayOrderReadAuthorization={...callback,canReadArea:area=>areas.has(area)};
  for(const orderIds of [[],[pickup.orderId],[pickup.orderId,shipping.orderId,missing]]){
   const facts=await readTodayOrderSources(result.data,orderIds,ports);
   expect(await readTodayOrderSources(callback,orderIds,ports)).toEqual(facts);
   expect(await readTodayOrderSources(projection,JSON.parse(JSON.stringify(orderIds)),ports)).toEqual(facts);
   const actual=await withSession(fixture,()=>getTodayOrderReadAction({orderIds}));if(actual.code!=='OK')throw Error('TEST_TODAY_SOURCE_ACTION:'+actual.code);
   expect(actual.data.rows).toEqual(facts.map(({orderId,result:source})=>{
    if(source.code!=='OK')return {orderId,result:source};
    expect(source.data).not.toHaveProperty('nextActionRule');
    const {card,records,shipping:consequences,informed,payment,shipment,appointment}=source.data;
    return {orderId,result:{code:'OK',data:{card,handoverConsequences:consequences,pickupAppointment:appointment,nextActionRule:readV45OrderRule(result.data,card,informed?{orderId:card.id,value:informed}:undefined,{orderId:card.id,records},{shipping:consequences,payment,shipment})}}};
   }));
  }
 }
});

it('applies the same price mask to captured real card facts and the current restricted reader without mutating the original',async()=>{
 const order=await readyInvoiceOrder('TEST shared price mask');
 const fullAuth=await withSession(full,()=>resolveAuthorization());if(!fullAuth.ok)throw Error('TEST_PRICE_MASK_FULL_AUTH');
 const [source]=await readTodayOrderSources(fullAuth.data,[order.orderId],ports);
 if(source.result.code!=='OK')throw Error('TEST_PRICE_MASK_SOURCE');
 const card=source.result.data.card,original=JSON.stringify(card);
 expect(card.items.some(item=>item.unitPriceCents!==null)).toBe(true);
 const reader=await createFixture(['auftraege'],'werkstatt');
 const actual=await withSession(reader,()=>resolveAuthorization());if(!actual.ok)throw Error('TEST_PRICE_MASK_READER_AUTH');
 const masked=maskTodayOrderCard(actual.data,card);
 expect(masked.items.every(item=>item.unitPriceCents===null&&item.vatRateBasisPoints===null&&item.extraWork.every(line=>line.hourlyRateCents===null&&line.amountCents===null))).toBe(true);
 if(masked.freeze)expect(masked.freeze).toMatchObject({hourlyRateCents:null,totalAmountCents:null});
 const [live]=await readTodayOrderSources(actual.data,[order.orderId],ports);
 if(live.result.code!=='OK')throw Error('TEST_PRICE_MASK_LIVE');
 expect(masked).toEqual(live.result.data.card);
 expect(maskTodayOrderCard(fullAuth.data,card)).toEqual(card);
 expect(JSON.stringify(card)).toBe(original);
});

it('keeps real payment and release evidence while masking credit for a price-only actor through the same reader gate',async()=>{
 const order=await readyInvoiceOrder('TEST shared payment credit mask');
 const fullAuth=await withSession(full,()=>resolveAuthorization());if(!fullAuth.ok)throw Error('TEST_CREDIT_MASK_FULL_AUTH');
 const [source]=await readTodayOrderSources(fullAuth.data,[order.orderId],ports);
 if(source.result.code!=='OK'||source.result.data.payment?.code!=='OK')throw Error('TEST_CREDIT_MASK_SOURCE');
 const payment=source.result.data.payment,original=JSON.stringify(payment);
 expect(payment.data.creditApplication).toBeDefined();
 const reader=await createFixture(['auftraege','preise']);
 const actual=await withSession(reader,()=>resolveAuthorization());if(!actual.ok)throw Error('TEST_CREDIT_MASK_READER_AUTH');
 const masked=maskOrderPaymentCredit(actual.data,payment);
 if(masked.code!=='OK')throw Error('TEST_CREDIT_MASK_RESULT');
 expect(masked.data).not.toHaveProperty('creditApplication');
 expect(masked.data.payment).toEqual(payment.data.payment);
 expect(masked.data.complaintHold).toEqual(payment.data.complaintHold);
 expect(masked.data.customerDeliveryBlock).toEqual(payment.data.customerDeliveryBlock);
 const [live]=await readTodayOrderSources(actual.data,[order.orderId],ports);
 if(live.result.code!=='OK')throw Error('TEST_CREDIT_MASK_LIVE');
 expect(masked).toEqual(live.result.data.payment);
 expect(maskOrderPaymentCredit(fullAuth.data,payment)).toEqual(payment);
 expect(JSON.stringify(payment)).toBe(original);
});
