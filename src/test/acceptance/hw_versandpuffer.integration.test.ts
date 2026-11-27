// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({ KREILE_TENANT_SLUG: tenant }));

import { full, sql, withSession } from '../../../e2e/ablauf/replayHarness';
import { getOrderIntakeSuggestionsAction } from '@/app/actions/eingang.actions';
import { workingDaysBetween } from '@/lib/domain/workingDays';

it('berücksichtigt den gespeicherten Versandpuffer nur bei Versand', async () => {
  const alteSpalte = await sql`
    SELECT attnum
    FROM pg_attribute WHERE attrelid = 'public.company_settings'::regclass
      AND attname = 'uebergabepuffer_tage' AND NOT attisdropped
  `;
  expect(alteSpalte).toHaveLength(0);
  // Isolierte TEST-Leistung mit belegter Durchlaufzeit für den echten Vorschlag.
  const leistung = randomUUID();
  await sql`
    INSERT INTO public.catalog_services (id, tenant_id, name, surface, unit, net_price_cents,
      vat_rate_basis_points, standard_lead_time_working_days)
    VALUES (${leistung}, ${tenant}, 'TEST Werkstattteil', 'verzinken', 'stueck', 4500, 1900, 3)
  `;
  await sql`
    INSERT INTO public.company_settings (id, tenant_id, company_name, versandpuffer_arbeitstage,
      tagesleistung_eur, auslastung_passt_pct, auslastung_knapp_pct, auslastung_vorrang_pct,
      material_aufschlag_prozent, lager_regelversion)
    VALUES (${randomUUID()}, ${tenant}, 'TEST Werkstatt Versandpuffer', 1, 1200, 80, 100, 130, 20, 'TEST-HW')
  `;
  const leseTermin = async (handoverMode: 'shipping' | 'pickup') => {
    const result = await withSession(full, () => getOrderIntakeSuggestionsAction({
      customerId: null,
      kind: 'ORDER',
      wishDate: null,
      handoverMode,
      positions: [{
        key: 'test-position',
        catalogServiceId: leistung,
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

  const mitEinemArbeitstag = await leseTermin('shipping');
  await sql`UPDATE public.company_settings SET versandpuffer_arbeitstage = 4 WHERE tenant_id = ${tenant}`;
  const mitVierArbeitstagen = await leseTermin('shipping');
  const abholungMitPuffer = await leseTermin('pickup');
  await sql`UPDATE public.company_settings SET versandpuffer_arbeitstage = 0 WHERE tenant_id = ${tenant}`;
  const ohnePuffer = await leseTermin('shipping');
  const abholungOhnePuffer = await leseTermin('pickup');

  expect(workingDaysBetween(ohnePuffer, mitEinemArbeitstag)).toBe(1);
  expect(workingDaysBetween(ohnePuffer, mitVierArbeitstagen)).toBe(4);
  expect(abholungMitPuffer).toBe(abholungOhnePuffer);
  expect(abholungOhnePuffer).toBe(ohnePuffer);
});
