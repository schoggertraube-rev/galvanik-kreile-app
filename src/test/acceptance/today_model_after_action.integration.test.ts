// @vitest-environment node
// Native Next after(), actual Action/Auth/DB/Storage; no replacement scheduler or source ports.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {rebuildTodayModel} from '@/lib/server/todayProjection';
import {changeOrderPromisedDueDateAction} from '@/app/actions/orders.actions';
import {observeAction} from '@/modules/logging/server-public';
import {readLoggingSettings} from '@/modules/fundament/server-public';

const phases=(calls:unknown[][])=>calls.filter(call=>call[0]==='[PAGE_READ_PHASE]').map(call=>JSON.parse(String(call[1]))).filter(row=>row.phase==='today.refresh');

it('keeps the real command response ahead of refresh and publishes the new card only after native response close',async()=>{
 const order=await readyInvoiceOrder('TEST after real promised date');
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 const input={orderId:order.orderId,expectedVersion:order.version,dueDate:'2027-07-19',reason:'TEST native after refresh',clientEventId:randomUUID()};
 const output=vi.spyOn(console,'info');
 try{
  const result=await withSession(full,async()=>{
   const saved=await changeOrderPromisedDueDateAction(input);
   expect(saved.code).toBe('OK');
   expect(await sql`SELECT source_seq>built_seq AS pending FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' AND source_id=${order.orderId}`).toEqual([{pending:true}]);
   expect(phases(output.mock.calls)).toHaveLength(0);
   return saved;
  },true);
  if(result.code!=='OK')throw Error('TEST_ACTUAL_PROMISED_DATE_REQUIRED');
  expect(await sql`SELECT source.source_seq=source.built_seq AND source.built_tenant_seq=tenant.tenant_seq AND source.source_version=orders.version AS fresh FROM private.today_source_v1 source JOIN private.today_tenant_v1 tenant USING(tenant_id) JOIN public.orders orders ON orders.tenant_id=source.tenant_id AND orders.id=source.source_id WHERE source.tenant_id=${tenant} AND source.kind='order' AND source.source_id=${order.orderId}`).toEqual([{fresh:true}]);
  expect(phases(output.mock.calls)).toHaveLength(1);
  const retry=await withSession(full,()=>changeOrderPromisedDueDateAction(JSON.parse(JSON.stringify(input))),true);
  expect(retry).toEqual({...result,replayed:true});
  expect(await sql`SELECT count(*)::integer AS count FROM public.events WHERE tenant_id=${tenant} AND client_event_id=${input.clientEventId} AND event_type='ORDER_PROMISED_DUE_DATE_CHANGED_V1'`).toEqual([{count:1}]);
 }finally{output.mockRestore();}
});

it('uses one after job for nested existing Action observations with several actual transactions',async()=>{
 const order=await readyInvoiceOrder('TEST after nested actual commands');
 const output=vi.spyOn(console,'info');
 try{
  await withSession(full,()=>observeAction('TESTTodayNestedEnvelope',{type:'order',id:order.orderId},async()=>{
   const input={orderId:order.orderId,expectedVersion:order.version,dueDate:'2027-07-20',reason:'TEST one native after job',clientEventId:randomUUID()};
   const first=await changeOrderPromisedDueDateAction(input);expect(first.code).toBe('OK');
   expect(await changeOrderPromisedDueDateAction(JSON.parse(JSON.stringify(input)))).toEqual({...first,replayed:true});
  },readLoggingSettings),true);
  expect(phases(output.mock.calls)).toHaveLength(1);
  expect(await sql`SELECT refresh_lease_until FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{refresh_lease_until:null}]);
 }finally{output.mockRestore();}
});
