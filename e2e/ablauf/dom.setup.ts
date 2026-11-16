// Explicit synthetic TEST actors and starting data; domain records use the
// existing actions. The browser still traverses the real Next/Auth/DB app.
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {expect, it, vi} from 'vitest';
const tenant = vi.hoisted(() => {
  const value = process.env.KREILE_SMOKE_TENANT;
  if (process.env.KREILE_S14A_DOM !== '1' || !value?.startsWith('TEST-ablauf-')) throw Error('S14A_TEST_FIXTURE_REQUIRED');
  return value;
});
vi.mock('@/lib/tenant', () => ({KREILE_TENANT_SLUG: tenant}));
import {createFixture, full, withSession} from './replayHarness';
import {customerFixture, intakeOrderFixture} from './orderFixture';
import {ROLE_ACCESS_AREA_TEMPLATES} from '@/lib/auth/authorizationContract';

it('prepares the canonical S14a actors and actual domain targets without a second fixture writer', async () => {
  const actors = {} as Record<string, {actorId: string; actorIssuedAt: number; role: string}>;
  for (const role of ['meister', 'werkstatt', 'admin'] as const) {
    actors[role] = await createFixture([...ROLE_ACCESS_AREA_TEMPLATES[role]], role);
  }
  const customerId = await customerFixture('S14a DOM');
  const order = await intakeOrderFixture('S14a DOM', customerId);
  const {createQuoteAction} = await import('@/app/actions/quotes.actions');
  const quote = await withSession(full, () => createQuoteAction({
    clientEventId: randomUUID(), customerId, dueDate: '2027-05-15', note: 'TEST S14a DOM',
    positions: [{name: 'TEST S14a Teil', quantity: 1, material: 'Messing', surfaceRequested: 'verchromen', unitPriceCents: 1000, lineTotalCents: 1000}],
  }));
  expect(quote.code).toBe('OK');
  if (quote.code !== 'OK') throw Error('S14A_QUOTE_FIXTURE:' + quote.code);
  // IDs and provenance only: no cookie, PIN, token or connection credential.
  writeFileSync('.git/kreile-s14a-dom-fixture.json', JSON.stringify({
    tenant, actors, customerId, orderId: order.receipt.orderId, quoteId: quote.quote.quoteId,
  }, null, 2));
});
