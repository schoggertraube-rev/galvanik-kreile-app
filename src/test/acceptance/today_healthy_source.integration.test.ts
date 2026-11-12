// @vitest-environment node
import {it,expect,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readTodayDashboard} from '@/lib/server/todayDashboard';
import {randomUUID} from 'node:crypto';
import {transitionWareneingangToGalvanikAction,getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';


it('W-TAG has no main action or source for healthy future work with a green or information U2 state',async()=>{
 const customerId=await customerFixture('TEST S05 ruhige Zukunft'),order=await intakeOrderFixture('TEST S05 ruhiger Auftrag',customerId);
 expect(await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId:order.receipt.orderId,expectedVersion:1,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const {storeItemPhoto}=await import('../../../e2e/ablauf/photoFixture');await storeItemPhoto(order.receipt.orderId,order.receipt.items[0].id);
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId:order.receipt.orderId}));if(card.code!=='OK')throw Error('TEST_S05_HEALTHY_CARD');
 expect(['succ','info']).toContain(card.data.nextActionRule?.farbe);
 const read=()=>withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_S05_HEALTHY_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 const day=await read();expect(day.orderActions?.rows.find(row=>row.orderId===order.receipt.orderId)?.read).toEqual(card.data.nextActionRule);
 expect(day).toMatchObject({hauptaktion:null,hauptaktionsQuelle:null,challenges:{groups:[]}});
 expect(await read()).toMatchObject({hauptaktion:null,hauptaktionsQuelle:null});
});


it('W-TAG retains actual order data through a native SQL failure in optional preferences and rereads after repair',async()=>{
 const customerId=await customerFixture('TEST S05 Quellenfehler'),order=await intakeOrderFixture('TEST S05 bleibende Ware',customerId);
 const read=()=>withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_S05_OPTIONAL_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 const [before]=await sql`SELECT 'private.today_preferences'::regclass::oid::text AS id`;
 const parked='test_s05_preferences_'+randomUUID().replaceAll('-','');
 // Dedicated loopback TEST database only. A temporarily missing real relation
 // causes a native SQL error; no mocked transaction or relaxed guard is used.
 await sql.unsafe('ALTER TABLE private.today_preferences RENAME TO '+parked);
 try{
  const partial=await read();
  expect(partial.datenluecken).toContain('TODAY_PREFERENCES_SOURCE');
  expect(partial.orderActions?.rows.some(row=>row.orderId===order.receipt.orderId)).toBe(true);
  expect(partial.invoiceMoney).toMatchObject({code:'OK',openCount:0,openCents:0});
  expect((await read()).datenluecken).toContain('TODAY_PREFERENCES_SOURCE');
 }finally{
  await sql.unsafe('ALTER TABLE private.'+parked+' RENAME TO today_preferences');
 }
 const [after]=await sql`SELECT 'private.today_preferences'::regclass::oid::text AS id`;expect(after).toEqual(before);
 const repaired=await read();expect(repaired.datenluecken).not.toContain('TODAY_PREFERENCES_SOURCE');
 expect(repaired.orderActions?.rows.some(row=>row.orderId===order.receipt.orderId)).toBe(true);
});
