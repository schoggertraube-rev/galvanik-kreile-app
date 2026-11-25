// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({ KREILE_TENANT_SLUG: tenant }));

import { createFixture, full, sql } from '../../../e2e/ablauf/replayHarness';
import { withPrivilegedTenantTransaction } from '@/lib/server/privilegedDb';
import {
  readAusschussBerechnenInTransaction,
  readBetriebsruheInTransaction,
  readWerkstattKostensatzInTransaction,
  readWerkstattMehrarbeitInTransaction,
} from '@/modules/fundament/server-public';

it('liest gespeicherte Werkstatt-Einstellungen aus dem Firmenstand', async () => {
  // Isolierte TEST-Werte für die Datenbank-Lesekante.
  await sql`
    INSERT INTO public.company_settings (
      id, tenant_id, company_name, versandpuffer_arbeitstage, ausschuss_berechnen,
      mehrarbeit_spielraum_basispunkte, mehrarbeit_stopp_basispunkte,
      mehrarbeit_schritt_minuten, mehrarbeit_max_minuten_je_taetigkeit,
      tagesleistung_eur, auslastung_passt_pct, auslastung_knapp_pct, auslastung_vorrang_pct,
      material_aufschlag_prozent, lager_regelversion
    )
    VALUES (${randomUUID()}, ${tenant}, 'TEST Werkstatt', 4, false, 925, 2175, 7, 84, 1200, 80, 100, 130, 20, 'TEST-HW')
  `;

  await withPrivilegedTenantTransaction({ tenantId: tenant }, async tx => {
    expect(await readWerkstattMehrarbeitInTransaction(tx, tenant)).toEqual({
      spielraumBasispunkte: 925,
      stoppBasispunkte: 2175,
      schrittMinuten: 7,
      maxMinutenJeTaetigkeit: 84,
    });
    expect(await readBetriebsruheInTransaction(tx, tenant)).toMatchObject({
      versandpufferArbeitstage: 4,
      knappAbArbeitstagen: 2,
      terminKapazitaet: { tagesleistungEur: 1200, passtProzent: 80, knappProzent: 100, vorrangProzent: 130 },
    });
    expect(await readAusschussBerechnenInTransaction(tx, tenant)).toBe(false);
  });

  await sql`UPDATE public.company_settings SET termin_knapp_arbeitstage = 3 WHERE tenant_id = ${tenant}`;
  await withPrivilegedTenantTransaction({ tenantId: tenant }, async tx => {
    expect(await readBetriebsruheInTransaction(tx, tenant)).toMatchObject({ knappAbArbeitstagen: 3 });
  });

  const leererMandant = tenant + '-leer';
  await withPrivilegedTenantTransaction({ tenantId: leererMandant }, async tx => {
    expect(await readWerkstattMehrarbeitInTransaction(tx, leererMandant)).toBeNull();
  });
});

it('liest den exakten Kostensatz der Person im Mandanten der Buchung', async () => {
  const ohneKostensatz = await createFixture(['auftraege']);
  await sql`
    UPDATE public.app_users
    SET kostensatz_eur_pro_stunde = 42.75
    WHERE tenant_id = ${tenant} AND id = ${full.actorId}::uuid
  `;

  await withPrivilegedTenantTransaction({ tenantId: tenant }, async tx => {
    expect(await readWerkstattKostensatzInTransaction(tx, tenant, full.actorId)).toBe('42.75');
    expect(await readWerkstattKostensatzInTransaction(tx, tenant, ohneKostensatz.actorId)).toBeNull();
  });

  await withPrivilegedTenantTransaction({ tenantId: tenant + '-fremd' }, async tx => {
    expect(await readWerkstattKostensatzInTransaction(tx, tenant, full.actorId)).toBeNull();
  });
});
