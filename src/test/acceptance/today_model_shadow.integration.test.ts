// @vitest-environment node
// Real live dashboard and productive scheduled model on the own TEST DB.
import { readBetriebsruheInTransaction } from "@/modules/fundament/server-public";
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readTodayDashboard} from '@/lib/server/todayDashboard';
import {rebuildTodayModel} from '@/lib/server/todayProjection';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readComplaintsForAuthorization} from '@/modules/complaints/server-public';
import {readQuoteFollowupTasksForToday} from '@/modules/tasks/server-public';

it('keeps live results while page reads leave the projector idle until a bounded scheduled rebuild',async()=>{
 const order=await readyInvoiceOrder('TEST scheduled model live equality');
 const now=new Date();
 const live=async()=>{
  const resolved=await resolveAuthorization();if(!resolved.ok)throw Error('TEST_ACTUAL_SHADOW_AUTH_REQUIRED');
  return readTodayDashboard(resolved.data,()=>readComplaintsForAuthorization(resolved.data),async()=>({code:'OK',tasks:await withPrivilegedTenantTransaction(resolved.data,tx=>readQuoteFollowupTasksForToday(tx,resolved.data))}), readBetriebsruheInTransaction,now);
 };
 const output=vi.spyOn(console,'info');
 try{
  const before=await withSession(full,live,true);
  expect(await sql`SELECT count(*)::integer AS count FROM private.today_source_v1 WHERE tenant_id=${tenant} AND status='OK'`).toEqual([{count:0}]);
  expect(output.mock.calls.filter(call=>call[0]==='[TODAY_MODEL_SHADOW]')).toHaveLength(0);
  expect((await rebuildTodayModel(tenant,undefined,{bounded:true})).code).toBe('OK');
  const sources=await sql`SELECT kind,source_id FROM private.today_source_v1 WHERE tenant_id=${tenant} AND status='OK' ORDER BY kind,source_id`;
  expect(sources).toEqual([
   {kind:'quelle:accounting.geld',source_id:'*'},
   {kind:'quelle:complaints.liste',source_id:'*'},
   {kind:'quelle:eingang.nachrichten',source_id:'*'},
   {kind:'quelle:fundament.firma',source_id:'*'},
   {kind:'quelle:orders.auftrag',source_id:order.orderId},
   {kind:'quelle:orders.liste',source_id:'*'},
   {kind:'quelle:quotes.liste',source_id:'*'},
   {kind:'quelle:quotes.nachfassen',source_id:'*'},
   {kind:'quelle:takt.ausfall',source_id:'*'},
   {kind:'quelle:tasks.aufgabe',source_id:'*'},
  ]);
  expect(await withSession(full,live,true)).toEqual(before);
  expect(output.mock.calls.filter(call=>call[0]==='[TODAY_MODEL_SHADOW]')).toHaveLength(0);
 }finally{output.mockRestore();}
});
