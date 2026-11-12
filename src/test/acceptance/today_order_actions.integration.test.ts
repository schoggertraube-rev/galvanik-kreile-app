// @vitest-environment node
import {it,expect,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readTodayDashboard} from '@/lib/server/todayDashboard';
import {randomUUID} from 'node:crypto';
import {transitionWareneingangToGalvanikAction,getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';

it('reads the exact same three real versioned U2 order actions into U3 and hides them without order rights',async()=>{
 const customerId=await customerFixture('TEST S05 U2 U3');
 const orders=[];for(let index=0;index<3;index++)orders.push(await intakeOrderFixture('TEST S05 Naht '+index,customerId));
 const read=(fixture:typeof full)=>withSession(fixture,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_S05_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 const day=await read(full);expect(day.orderActions).toMatchObject({code:'OK',missingOrderIds:[]});
 expect(day.orderActions?.rows).toHaveLength(3);
 for(const order of orders){
  const card=await withSession(full,()=>getLiveOrderCardAction({orderId:order.receipt.orderId}));if(card.code!=='OK')throw Error('TEST_S05_CARD');
  expect(day.orderActions?.rows.find(row=>row.orderId===order.receipt.orderId)).toEqual({orderId:order.receipt.orderId,version:card.data.card.version,read:card.data.nextActionRule});
 }
 expect((await read(full)).orderActions).toEqual(day.orderActions);
 const firstOrder=orders[0].receipt.orderId;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId:firstOrder,expectedVersion:1,clientEventId:randomUUID()}));expect(moved).toMatchObject({code:'OK'});
 const changed=await read(full),card=await withSession(full,()=>getLiveOrderCardAction({orderId:firstOrder}));if(card.code!=='OK')throw Error('TEST_S05_CHANGED_CARD');
 expect(changed.orderActions?.rows.find(row=>row.orderId===firstOrder)).toEqual({orderId:firstOrder,version:2,read:card.data.nextActionRule});
 expect(day.orderActions?.rows.find(row=>row.orderId===firstOrder)?.version).toBe(1);
 const noOrders=await createFixture(['mails']);expect(await read(noOrders)).not.toHaveProperty('orderActions');
});
