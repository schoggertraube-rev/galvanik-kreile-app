// @vitest-environment node
// Actual TEST Actions/Auth/DB/Storage; derived-cache faults are restored whole.
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readTodayModelInTransaction} from '@/lib/server/todayModelRead';
import {readTodayCalendar} from '@/lib/today/todayDashboardPolicy';
import {rebuildTodayModel,refreshTodayModel} from '@/lib/server/todayProjection';
import {changeOrderPromisedDueDateAction} from '@/app/actions/orders.actions';
import {withRestoredTestSource} from '../fixtures/restoredTestSource';

it('qualifies the actual source snapshot and never returns an old payload after a command, version mismatch or code change',async()=>{
 const order=await readyInvoiceOrder('TEST qualified model source');
 const resolved=await withSession(full,()=>resolveAuthorization());if(!resolved.ok)throw Error('TEST_REAL_MODEL_AUTH_REQUIRED');
 const auth=resolved.data,today=readTodayCalendar(new Date()).today;
 const read=()=>withPrivilegedTenantTransaction(auth,tx=>readTodayModelInTransaction(tx,auth,today));
 const initial=await read();expect(initial.code).toBe('EMPTY');
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 const warm=await read();expect(warm.code).toBe('OK');expect(warm.rows).toHaveLength(9);
 expect(warm.rows.every(row=>row.fresh===true&&row.payload!==null)).toBe(true);
 const input={orderId:order.orderId,expectedVersion:order.version,dueDate:'2027-08-04',reason:'TEST qualified model after actual command',clientEventId:globalThis.crypto.randomUUID()};
 const changed=await withSession(full,()=>changeOrderPromisedDueDateAction(input));expect(changed.code).toBe('OK');
 expect(await withSession(full,()=>changeOrderPromisedDueDateAction(JSON.parse(JSON.stringify(input))))).toEqual({...changed,replayed:true});
 const stale=(await read()).rows.find(row=>row.kind==='order'&&row.sourceId===order.orderId);
 expect(stale).toMatchObject({fresh:false,payload:null,sourceVersion:order.version,currentVersion:order.version+1});
 const saved=async()=>{const [source]=await sql`SELECT to_jsonb(source) AS row FROM private.today_source_v1 source WHERE tenant_id=${tenant} AND kind='order' AND source_id=${order.orderId}`;if(!source)throw Error('TEST_CACHE_SOURCE_REQUIRED');return source.row;};
 const restore=async(original:Awaited<ReturnType<typeof saved>>)=>{
  const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_MODEL_COLUMN_INVALID');
  const names=columns.map(column=>'"'+column+'"').join(',');
  await sql`UPDATE private.today_source_v1 SET (${sql.unsafe(names)})=(SELECT ${sql.unsafe(names)} FROM jsonb_populate_record(NULL::private.today_source_v1,${sql.json(original)}::jsonb)) WHERE tenant_id=${tenant} AND kind='order' AND source_id=${order.orderId}`;
 };
 await withRestoredTestSource({label:'TEST complete derived version source',read:saved,restore},async()=>{
  // Isolate the physical-order version join from the sequence guard. This is
  // explicitly a cache corruption probe, never a fabricated command receipt.
  await sql`UPDATE private.today_source_v1 SET built_seq=source_seq WHERE tenant_id=${tenant} AND kind='order' AND source_id=${order.orderId}`;
  expect((await read()).rows.find(row=>row.kind==='order'&&row.sourceId===order.orderId)).toMatchObject({fresh:false,payload:null});
 });
 expect((await refreshTodayModel(tenant)).code).toBe('OK');
 expect((await read()).rows.find(row=>row.kind==='order'&&row.sourceId===order.orderId)).toMatchObject({fresh:true,sourceVersion:order.version+1,currentVersion:order.version+1});
 await withRestoredTestSource({label:'TEST complete derived projector source',read:saved,restore},async()=>{
  await sql`UPDATE private.today_source_v1 SET projector_version=projector_version+1 WHERE tenant_id=${tenant} AND kind='order' AND source_id=${order.orderId}`;
  const wrongCode=await read();expect(wrongCode.needsRebuild).toBe(true);
  expect(wrongCode.rows.find(row=>row.kind==='order'&&row.sourceId===order.orderId)).toMatchObject({fresh:false,payload:null});
 });
 const tomorrow=new Date(today+'T12:00:00Z');tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
 const wrongDay=await withPrivilegedTenantTransaction(auth,tx=>readTodayModelInTransaction(tx,auth,tomorrow.toISOString().slice(0,10)));
 expect(wrongDay.needsRebuild).toBe(true);expect(wrongDay.rows.every(row=>row.fresh!==true&&row.payload===null)).toBe(true);
 // Explicit low-level tenant-isolation boundary, not a replacement identity.
 const other=await withPrivilegedTenantTransaction(auth,tx=>readTodayModelInTransaction(tx,{tenantId:tenant+'-TEST-other'},today));
 expect(other).toEqual({code:'EMPTY',rows:[],needsRebuild:true});
});
