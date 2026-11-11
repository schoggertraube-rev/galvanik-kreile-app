// @vitest-environment node
import { vi, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
const tenant = vi.hoisted(() => 'TEST-ablauf-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({ KREILE_TENANT_SLUG: tenant }));
import { KREILE_TENANT_SLUG } from '@/lib/tenant';
import { sql, full, withSession, createFixture } from '../../../e2e/ablauf/replayHarness';
import { customerFixture, intakeOrderFixture } from '../../../e2e/ablauf/orderFixture';
import { transitionWareneingangToGalvanikAction, setOrderItemFinishedAction, getLiveOrderCardAction } from '@/app/actions/orders.actions';
if (!process.env.DATABASE_URL || process.env.DATABASE_URL !== process.env.H18_EXPECTED_DATABASE_URL || new URL(process.env.DATABASE_URL).hostname !== '127.0.0.1') throw Error('ITEM_COMPLETION_LOOPBACK_REQUIRED');

it('a finished edge happens once; fresh retry preserves its receipt and reopening permits exactly one later completion', async () => {
  const customerId = await customerFixture('Fertigkante');
  const created = await intakeOrderFixture('Fertigkante', customerId);
  const orderId = created.receipt.orderId, itemId = created.receipt.items[0].id;
  const moved = await withSession(full, () => transitionWareneingangToGalvanikAction({ orderId, expectedVersion: 1, clientEventId: randomUUID() }));
  expect(moved.code).toBe('OK'); if (moved.code !== 'OK') throw Error('MOVE_FAILED');
  const input = { orderId, itemId, expectedVersion: moved.receipt.aggregateVersion, clientEventId: randomUUID(), finished: true };
  const first = await withSession(full, () => setOrderItemFinishedAction(input));
  expect(first.code).toBe('OK'); if (first.code !== 'OK') throw Error('FINISH_FAILED');
  expect(await withSession(full, () => getLiveOrderCardAction({ orderId }))).toMatchObject({ code: 'OK', data: { card: { version: first.receipt.aggregateVersion, items: [expect.objectContaining({ id: itemId, finished: true })] } } });
  expect(await withSession(full, () => setOrderItemFinishedAction(JSON.parse(JSON.stringify(input))))).toMatchObject({ code: 'OK', replayed: true, receipt: { eventId: first.receipt.eventId } });
  const otherActor = await createFixture(['auftraege'], 'werkstatt');
  expect(await withSession(otherActor, () => setOrderItemFinishedAction(structuredClone(input)))).toMatchObject({ code: 'CONFLICT' });
  const duplicate = await withSession(full, () => setOrderItemFinishedAction({ ...input, expectedVersion: first.receipt.aggregateVersion, clientEventId: randomUUID() }));
  expect(duplicate.code).toBe('CONFLICT');
  expect(await sql`SELECT version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`).toEqual([{ version: first.receipt.aggregateVersion }]);
  const reopened = await withSession(full, () => setOrderItemFinishedAction({ ...input, finished: false, expectedVersion: first.receipt.aggregateVersion, clientEventId: randomUUID() }));
  expect(reopened.code).toBe('OK'); if (reopened.code !== 'OK') throw Error('REOPEN_FAILED');
  const second = await Promise.all([1, 2].map(() => withSession(full, () => setOrderItemFinishedAction({ ...input, expectedVersion: reopened.receipt.aggregateVersion, clientEventId: randomUUID() }))));
  expect(second.map(result => result.code).sort()).toEqual(['CONFLICT', 'OK']);
  expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND event_type='ORDER_ITEM_FINISHED_CHANGED_V1'`).toEqual([{ n: 3 }]);
  expect(await withSession(full, () => getLiveOrderCardAction({ orderId }))).toMatchObject({ code: 'OK', data: { card: { items: [expect.objectContaining({ id: itemId, finished: true })] } } });
});
