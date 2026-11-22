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
import {withRestoredTestSource} from '../fixtures/restoredTestSource';

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
   expect(output.mock.calls.filter(call=>call[0]==='[TODAY_MODEL_SHADOW]')).toHaveLength(0);
   expect(await sql`SELECT count(*)::integer AS count FROM private.today_source_v1 WHERE tenant_id=${tenant} AND status='OK'`).toEqual([{count:0}]);
   return value;
  },true);
  expect(await sql`SELECT count(*)::integer AS count FROM private.today_source_v1 WHERE tenant_id=${tenant} AND status='OK'`).toEqual([{count:9}]);
  const after=await withSession(full,live,true);
  expect(after).toEqual(before);
  expect(output.mock.calls.filter(call=>call[0]==='[TODAY_MODEL_SHADOW]')).toHaveLength(1);
  // TEST-only derived clock boundary, never an invented source/card result.
  const read=async()=>{const [row]=await sql`SELECT to_jsonb(tenant_row) AS row FROM private.today_tenant_v1 tenant_row WHERE tenant_id=${tenant}`;if(!row)throw Error('TEST_SHADOW_TENANT_REQUIRED');return row.row;};
  await withRestoredTestSource({label:'TEST full shadow clock source',read,restore:async original=>{
   const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_SHADOW_COLUMN_INVALID');
   const names=columns.map(column=>'"'+column+'"').join(',');
   await sql`UPDATE private.today_tenant_v1 SET (${sql.unsafe(names)})=(SELECT ${sql.unsafe(names)} FROM jsonb_populate_record(NULL::private.today_tenant_v1,${sql.json(original)}::jsonb)) WHERE tenant_id=${tenant}`;
  }},async()=>{
   await sql`UPDATE private.today_tenant_v1 SET shadow_checked_at=statement_timestamp()-interval '1 day' WHERE tenant_id=${tenant}`;
   const repeated=await Promise.all([withSession(full,live,true),withSession(full,live,true)]);
   expect(repeated).toEqual([before,before]);
  });
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
  expect(refreshes).toHaveLength(1); // only the missing-model rebuild, no read-only Action refresh
 }finally{output.mockRestore();}
});
