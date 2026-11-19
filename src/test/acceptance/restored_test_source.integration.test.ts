// @vitest-environment node
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture} from '../../../e2e/ablauf/orderFixture';
import {searchTenantAction} from '@/app/actions/search.actions';
import {withRestoredTestSource} from '@/test/fixtures/restoredTestSource';

it('R24 restores actual TEST source columns after a thrown assertion and a second successful probe; the real reader sees the same customer',async()=>{
 const customerId=await customerFixture('R24');
 const read=async()=>{
  const [row]=await sql<{name:string;phone:string|null;email:string}[]>`SELECT name,phone,email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`;
  if(!row)throw Error('TEST_CUSTOMER_SOURCE_REQUIRED');return row;
 };
 const original=await read(),failure=Error('TEST deliberate body failure');
 const source={label:'TEST R24 actual customer source',read,restore:async(before:Awaited<ReturnType<typeof read>>)=>{
  await sql`UPDATE public.customers SET name=${before.name},phone=${before.phone},email=${before.email} WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`;
 }};
 await expect(withRestoredTestSource(source,async()=>{
  await sql`UPDATE public.customers SET name='',phone=NULL WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`;
  expect(await withSession(full,()=>searchTenantAction(original.email))).toMatchObject({code:'OK',failedSources:expect.arrayContaining(['Kundenstamm'])});
  throw failure;
 })).rejects.toBe(failure);
 expect(await read()).toEqual(original);
 expect(await withSession(full,()=>searchTenantAction(original.email))).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'CUSTOMER',id:customerId})])});
 expect(await withRestoredTestSource(source,async()=>{
  await sql`UPDATE public.customers SET name='TEST temporary name',phone=NULL WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`;
  return 'TEST completed';
 })).toBe('TEST completed');
 expect(await read()).toEqual(original);
 expect(await withSession(full,()=>searchTenantAction(original.email))).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'CUSTOMER',id:customerId})])});
});
