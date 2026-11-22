// @vitest-environment node
// Actual Action/Auth/DB sources and N5 command, with native SQL observation.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {full,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {collectTodaySources,composeTodayDashboard,readTodayDashboard} from '@/lib/server/todayDashboard';
import {DEFAULT_PAGE_READ_SETTINGS,pageReadQueryObservation,withPageReadBudget} from '@/db/readBudget';
import {changeOrderPromisedDueDateAction} from '@/app/actions/orders.actions';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';

it('composes one captured real source snapshot without SQL, preserves it after a real command and retains known rows on a missing version source',async()=>{
 const order=await readyInvoiceOrder('TEST shared Today composition');
 const now=new Date();
 const {auth,sources}=await withSession(full,async()=>{
  const resolved=await resolveAuthorization();if(!resolved.ok)throw Error('TEST_ACTUAL_COMPOSITION_AUTH');
  return {auth:resolved.data,sources:await collectTodaySources(resolved.data,getComplaints,getQuoteFollowupsForTodayAction,now)};
 });
 const responsibilities=sources.responsibilitySource.code==='OK'?[...sources.responsibilitySource.data]:null;
 const compose=()=>withPageReadBudget(async()=>{
  const queries=pageReadQueryObservation(),before=queries.total;
  const result=composeTodayDashboard(auth,sources,sources.calendar);
  expect(queries.total).toBe(before);
  return result;
 },DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs);
 const before=await compose();
 const oldVersion=before.orderActions?.rows.find(row=>row.orderId===order.orderId)?.version;
 expect(oldVersion).toBe(order.version);
 const current=await withSession(full,()=>readTodayDashboard(auth,getComplaints,getQuoteFollowupsForTodayAction,now));
 expect(current).toEqual(before);
 const command={orderId:order.orderId,expectedVersion:order.version,dueDate:'2027-07-21',reason:'TEST captured source remains unchanged',clientEventId:randomUUID()};
 const changed=await withSession(full,()=>changeOrderPromisedDueDateAction(command));
 expect(changed.code).toBe('OK');
 expect(await withSession(full,()=>changeOrderPromisedDueDateAction(JSON.parse(JSON.stringify(command))))).toEqual({...changed,replayed:true});
 expect(await compose()).toEqual(before);
 const after=await withSession(full,()=>readTodayDashboard(auth,getComplaints,getQuoteFollowupsForTodayAction,now));
 expect(after.orderActions?.rows.find(row=>row.orderId===order.orderId)?.version).toBeGreaterThan(order.version);
 if(sources.responsibilitySource.code==='OK')expect([...sources.responsibilitySource.data]).toEqual(responsibilities);
 // Explicit missing-DTO boundary, not a claimed SQL/provider failure.
 const missing=composeTodayDashboard(auth,{...sources,versions:null},sources.calendar);
 expect(missing.orderActions?.missingOrderIds).toContain(order.orderId);
 expect(missing.datenluecken).toContain('ORDER_ACTION_SOURCE');
 expect(missing.items.some(row=>row.orderId===order.orderId)).toBe(true);
});
