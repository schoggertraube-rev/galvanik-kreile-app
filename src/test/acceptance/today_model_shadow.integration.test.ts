// @vitest-environment node
// Real live dashboard and productive model; native Next request/after and TEST DB/Storage.
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readTodayDashboard} from '@/lib/server/todayDashboard';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readComplaintsForAuthorization} from '@/modules/complaints/server-public';
import {readQuoteFollowupTasksForToday} from '@/modules/tasks/server-public';

it('keeps the complete live result unchanged, logs counts only and upgrades one request job to the missing-day rebuild',async()=>{
 const order=await readyInvoiceOrder('TEST shadow live equality');
 const now=new Date();
 const live=async()=>{
  const resolved=await resolveAuthorization();if(!resolved.ok)throw Error('TEST_ACTUAL_SHADOW_AUTH_REQUIRED');
  return readTodayDashboard(resolved.data,()=>readComplaintsForAuthorization(resolved.data),async()=>({code:'OK',tasks:await withPrivilegedTenantTransaction(resolved.data,tx=>readQuoteFollowupTasksForToday(tx,resolved.data))}),now);
 };
 const output=vi.spyOn(console,'info');
 try{
  const before=await withSession(full,async()=>{
   const value=await live();
   expect(await sql`SELECT count(*)::integer AS count FROM private.today_source_v1 WHERE tenant_id=${tenant} AND status='OK'`).toEqual([{count:0}]);
   return value;
  },true);
  expect(await sql`SELECT count(*)::integer AS count FROM private.today_source_v1 WHERE tenant_id=${tenant} AND status='OK'`).toEqual([{count:9}]);
  const after=await withSession(full,live,true);
  expect(after).toEqual(before);
  const records=output.mock.calls.filter(call=>call[0]==='[TODAY_MODEL_SHADOW]').map(call=>JSON.parse(String(call[1])));
  expect(records).toHaveLength(2);
  expect(records[0].unknown).toBeGreaterThan(0);
  expect(records[1]).toMatchObject({different:0,unknown:0,stale:0});
  expect(records[1].compared).toBe(12);
  expect(records[1].model.orderCards).toBe(1);
  expect(records[1].model.orders).toBe(1);
  for(const record of records){
   for(const values of [record.live,record.model])expect(Object.values(values).every(value=>value===null||typeof value==='number')).toBe(true);
   expect(JSON.stringify(record)).not.toContain(order.orderId);expect(JSON.stringify(record)).not.toContain(full.actorId);expect(JSON.stringify(record)).not.toContain(order.customerId);
  }
  const refreshes=output.mock.calls.filter(call=>call[0]==='[PAGE_READ_PHASE]').map(call=>JSON.parse(String(call[1]))).filter(row=>row.phase==='today.refresh');
  expect(refreshes).toHaveLength(2); // one coalesced job for each actual request
 }finally{output.mockRestore();}
});
