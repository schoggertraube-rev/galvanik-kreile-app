// @vitest-environment node
// Real order commands/Auth/DB/readback. Fixture customer is explicitly TEST data.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {getOrdersDb,transitionWareneingangToGalvanikAction} from '@/app/actions/orders.actions';

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
});
