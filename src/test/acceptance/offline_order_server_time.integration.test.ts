// @vitest-environment node
// Real order commands/Auth/DB/readback. Fixture customer is explicitly TEST data.
import {it,expect,vi} from 'vitest';
import {randomUUID,randomInt} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {getOrdersDb,getOrderRegisterDb,transitionWareneingangToGalvanikAction} from '@/app/actions/orders.actions';

it('reads the persisted server event time through the canonical order list, including fresh retries',async()=>{
 const customerId=await customerFixture('S06 server change time');
 const created=await intakeOrderFixture('S06 server change time',customerId);
 const orderId=created.receipt.orderId;
 const read=async()=>{
  const rows=await withSession(full,()=>getOrdersDb());
  expect(rows.ok).toBe(true);if(!rows.ok)throw Error('TEST_ORDER_LIST_REQUIRED');
  const order=rows.data.find(row=>row.id===orderId);if(!order)throw Error('TEST_ORDER_REQUIRED');
  const [source]=await sql`SELECT max(created_at) AS changed FROM public.events WHERE tenant_id=${tenant} AND order_id=${orderId}`;
  expect(source.changed).not.toBeNull();
  expect(order.serverChangedAt).toBe(new Date(source.changed).toISOString());
  const register=await withSession(full,()=>getOrderRegisterDb({filter:'ORDER'}));
  if(!register.ok)throw Error('TEST_ORDER_REGISTER_REQUIRED');
  expect(register.data.find(row=>row.id===orderId)).toMatchObject({changedAt:order.serverChangedAt});
  return order;
 };
 const before=await read();
 const input={orderId,expectedVersion:before.version,clientEventId:randomUUID()};
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction(input));
 expect(moved.code).toBe('OK');
 const after=await read();
 expect(Date.parse(after.serverChangedAt!)).toBeGreaterThanOrEqual(Date.parse(before.serverChangedAt!));
 expect(await withSession(full,()=>transitionWareneingangToGalvanikAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect((await read()).serverChangedAt).toBe(after.serverChangedAt);
 const denied=await createFixture(['mails'],'werkstatt');
 expect(await withSession(denied,()=>getOrdersDb())).toMatchObject({ok:false});
 // Explicit synthetic INITIAL legacy row without business-event history.
 // Its TEST tenant/title carry isolation; canonical numbers cannot contain TEST.
 const legacyId=randomUUID(),legacyNumber=`A-${new Date().getUTCFullYear()}-${randomInt(1_000_000_000,2_000_000_000)}`;
 await sql`INSERT INTO public.orders SELECT (jsonb_populate_record(NULL::public.orders,to_jsonb(initial_order)||jsonb_build_object('id',${legacyId}::text,'order_number',${legacyNumber}::text,'print_symbol_slot',NULL,'print_symbol_generation',NULL,'print_symbol_active',false))).* FROM public.orders initial_order WHERE initial_order.tenant_id=${tenant} AND initial_order.id=${orderId}`;
 const legacy=await withSession(full,()=>getOrdersDb());
 if(!legacy.ok)throw Error('TEST_LEGACY_LIST_REQUIRED');
 expect(legacy.data.find(row=>row.id===legacyId)).toMatchObject({serverChangedAt:null});
 const register=await withSession(full,()=>getOrderRegisterDb({filter:'ORDER'}));
 if(!register.ok)throw Error('TEST_LEGACY_REGISTER_REQUIRED');
 expect(register.data.find(row=>row.id===legacyId)).toMatchObject({changedAt:null});

});
