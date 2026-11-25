// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({ KREILE_TENANT_SLUG: tenant }));

import { full, sql, withSession } from '../../../e2e/ablauf/replayHarness';
import { getOrderIntakeSuggestionsAction } from '@/app/warendurchlauf/actions';
import { workingDaysBetween } from '@/lib/domain/workingDays';

it('berücksichtigt den gespeicherten Versandpuffer im Terminvorschlag', async () => {
  await sql`
    INSERT INTO public.company_settings (id, tenant_id, company_name, versandpuffer_arbeitstage)
    VALUES (${randomUUID()}, ${tenant}, 'TEST Werkstatt Versandpuffer', 4)
  `;
  const leseTermin = async () => {
    const result = await withSession(full, () => getOrderIntakeSuggestionsAction({
      customerId: null,
      kind: 'ORDER',
      wishDate: null,
      handoverMode: 'shipping',
      positions: [{
        key: 'test-position',
        catalogServiceId: null,
        name: 'TEST Werkstattteil',
        quantity: 2,
        surfaceRequested: 'Verzinken',
        unit: 'Stück',
        unitPriceCents: 4500,
      }],
    }));
    expect(result).toMatchObject({ ok: true, data: { term: { achievableDate: expect.any(String) } } });
    if (!result.ok || !result.data.term?.achievableDate) throw Error('TEST_VERSANDPUFFER_TERMIN_FEHLT');
    return result.data.term.achievableDate;
  };

  const mitPuffer = await leseTermin();
  await sql`UPDATE public.company_settings SET versandpuffer_arbeitstage = 0 WHERE tenant_id = ${tenant}`;
  const ohnePuffer = await leseTermin();

  expect(workingDaysBetween(ohnePuffer, mitPuffer)).toBe(4);
});
