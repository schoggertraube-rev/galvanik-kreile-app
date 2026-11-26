// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({ KREILE_TENANT_SLUG: tenant }));

import { full, sql, withSession } from '../../../e2e/ablauf/replayHarness';
import { getOrderIntakeSuggestionsAction } from '@/app/actions/eingang.actions';
import { saveCatalogServiceAction } from '@/app/actions/settings.actions';
import { workingDaysBetween } from '@/lib/domain/workingDays';

it('berücksichtigt den gespeicherten Versandpuffer im Terminvorschlag', async () => {
  const alteSpalte = await sql`
    SELECT attnum
    FROM pg_attribute WHERE attrelid = 'public.company_settings'::regclass
      AND attname = 'uebergabepuffer_tage' AND NOT attisdropped
  `;
  expect(alteSpalte).toHaveLength(0);
  await sql`
    INSERT INTO public.company_settings (id, tenant_id, company_name, versandpuffer_arbeitstage,
      material_aufschlag_prozent, lager_regelversion)
    VALUES (${randomUUID()}, ${tenant}, 'TEST Werkstatt Versandpuffer', 1, 20, 'TEST-HW')
  `;
  const leistung = await withSession(full, () => saveCatalogServiceAction({
    id: null, name: 'TEST Verzinken', surface: 'verzinken', unit: 'stueck',
    netPriceCents: 4500, vatRateBasisPoints: 1900, standardLeadTimeWorkingDays: 3, active: true,
  }));
  if (leistung.code !== 'OK') throw Error('TEST_WERKSTATT_KATALOGLEISTUNG_FEHLT');
  const position = {
    key: 'test-position', catalogServiceId: leistung.service.id, name: 'TEST Werkstattteil',
    quantity: 2, surfaceRequested: 'Verzinken', unit: 'Stück', unitPriceCents: 4500,
  };
  const vorschlagOhneDurchlaufzeit = await withSession(full, () => getOrderIntakeSuggestionsAction({
    customerId: null, kind: 'ORDER', wishDate: null, handoverMode: 'shipping',
    positions: [position, { ...position, key: 'ohne-durchlaufzeit', name: 'TEST Freitextteil', catalogServiceId: null }],
  }));
  expect(vorschlagOhneDurchlaufzeit).toMatchObject({
    ok: true, data: {
      term: null,
      prices: [{ positionKey: position.key, unitPriceCents: 4500 }],
      missingLeadTimes: [{
        positionKey: 'ohne-durchlaufzeit', catalogServiceId: null, message: 'Durchlaufzeit für TEST Freitextteil fehlt',
      }],
    },
  });

  const leseTermin = async () => {
    const result = await withSession(full, () => getOrderIntakeSuggestionsAction({
      customerId: null,
      kind: 'ORDER',
      wishDate: null,
      handoverMode: 'shipping',
      positions: [position],
    }));
    expect(result).toMatchObject({ ok: true, data: { term: { achievableDate: expect.any(String) } } });
    if (!result.ok || !result.data.term?.achievableDate) throw Error('TEST_VERSANDPUFFER_TERMIN_FEHLT');
    return result.data.term.achievableDate;
  };

  const mitEinemArbeitstag = await leseTermin();
  await sql`UPDATE public.company_settings SET versandpuffer_arbeitstage = 4 WHERE tenant_id = ${tenant}`;
  const mitVierArbeitstagen = await leseTermin();
  await sql`UPDATE public.company_settings SET versandpuffer_arbeitstage = 0 WHERE tenant_id = ${tenant}`;
  const ohnePuffer = await leseTermin();

  expect(workingDaysBetween(ohnePuffer, mitEinemArbeitstag)).toBe(1);
  expect(workingDaysBetween(ohnePuffer, mitVierArbeitstagen)).toBe(4);
});
