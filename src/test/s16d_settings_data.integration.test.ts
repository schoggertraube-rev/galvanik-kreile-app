import { expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { readLagerEinstellungen, readKanalAnhangGrenzen, readArbeitskalenderInTransaction,
  readInaktivitaetInTransaction,readUmsatzsteuerSaetzeInTransaction,
  qualifiziereUmsatzsteuerPosition,pruefeUmsatzsteuerOriginalposition } from "@/modules/fundament/server-public";
import { plusWorkingDays } from "@/lib/domain/workingDays";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).hostname !== "127.0.0.1") {
  throw new Error("S16D_LOCAL_TEST_DATABASE_REQUIRED");
}

test("S16d reads the same defaults without a company row and the changed row in its transaction", async () => {
  const tenantId = `TEST-s16d-${crypto.randomUUID()}`;
  const withoutRow = await readLagerEinstellungen(tenantId);
  expect(withoutRow).toMatchObject({
    offline_max_stunden: 24,
    geraetefreigabe_aktiv: true,
    automatische_inventur_aktiv: false,
    bilanzbewertung_methode: "unbewertet",
  });
  expect(await readKanalAnhangGrenzen(tenantId)).toEqual({ anhang_max_mb: 25, mime_original_max_mb: 35 });

  await expect(withPrivilegedTenantTransaction({ tenantId }, async tx => {
    await tx.execute(sql`INSERT INTO public.company_settings (id,tenant_id) VALUES ('default',${tenantId})`);
    expect(await readLagerEinstellungen(tenantId, tx)).toEqual(withoutRow);
    await tx.execute(sql`UPDATE public.company_settings SET offline_max_stunden=20,
      geraetefreigabe_aktiv=false, automatische_inventur_aktiv=true,
      anhang_max_mb=30, mime_original_max_mb=45 WHERE tenant_id=${tenantId}`);
    expect(await readLagerEinstellungen(tenantId, tx)).toMatchObject({
      offline_max_stunden: 20,
      geraetefreigabe_aktiv: false,
      automatische_inventur_aktiv: true,
    });
    throw new Error("S16D_TEST_ROLLBACK");
  })).rejects.toThrow("S16D_TEST_ROLLBACK");
  expect(await readLagerEinstellungen(tenantId)).toEqual(withoutRow);
});

test("U10 keeps the saved reduced rate and reason tied to the same original item", async () => {
  const tenantId = `TEST-s16d-vat-${crypto.randomUUID()}`;
  await expect(withPrivilegedTenantTransaction({ tenantId }, async tx => {
    expect(await readUmsatzsteuerSaetzeInTransaction(tx, tenantId)).toBeNull();
    await tx.execute(sql`INSERT INTO public.company_settings (id,tenant_id) VALUES ('default',${tenantId})`);
    const rates = await readUmsatzsteuerSaetzeInTransaction(tx, tenantId);
    expect(rates).toEqual({ regelsatzBasispunkte: 1900, ermaessigtBasispunkte: 700 });
    expect(qualifiziereUmsatzsteuerPosition(rates, "ermaessigt", null).code).toBe("STEUER_GRUND_FEHLT");
    expect(qualifiziereUmsatzsteuerPosition(rates, "ermaessigt", "TEST-Grund")).toEqual({
      code: "OK", satzBasispunkte: 700, grund: "TEST-Grund",
    });
    const saved = { itemId: "TEST-position-1", vatRateBasisPoints: 700, vatReductionReason: "TEST-Grund" };
    expect(pruefeUmsatzsteuerOriginalposition(saved, { ...saved })).toBe(true);
    expect(pruefeUmsatzsteuerOriginalposition(saved, { ...saved, itemId: "TEST-position-2" })).toBe(false);
    await tx.execute(sql`UPDATE public.company_settings SET invoice_reduced_vat_rate_basis_points=800
      WHERE tenant_id=${tenantId}`);
    expect(pruefeUmsatzsteuerOriginalposition(saved, { ...saved })).toBe(true);
    throw new Error("S16D_VAT_TEST_ROLLBACK");
  })).rejects.toThrow("S16D_VAT_TEST_ROLLBACK");
});

test("S16d inactivity selects the stored device value ahead of the role and default", async () => {
  const tenantId = `TEST-s16d-inactivity-${crypto.randomUUID()}`;
  await expect(withPrivilegedTenantTransaction({ tenantId }, async tx => {
    expect(await readInaktivitaetInTransaction(tx, tenantId, { geraetId: "TEST-device", rolle: "werkstatt" })).toBe(60);
    await tx.execute(sql`INSERT INTO public.company_settings
      (id,tenant_id,inaktivitaet_abmelden_geraete,inaktivitaet_abmelden_rollen)
      VALUES ('default',${tenantId},'{"TEST-device":0}'::jsonb,'{"werkstatt":12}'::jsonb)`);
    expect(await readInaktivitaetInTransaction(tx, tenantId, { geraetId: "TEST-device", rolle: "werkstatt" })).toBe(0);
    expect(await readInaktivitaetInTransaction(tx, tenantId, { geraetId: null, rolle: "werkstatt" })).toBe(12);
    throw new Error("S16D_INACTIVITY_TEST_ROLLBACK");
  })).rejects.toThrow("S16D_INACTIVITY_TEST_ROLLBACK");
});

test("S16d calendar reads the same company's closure and leaves missing coverage open", async () => {
  const tenantId = `TEST-s16d-calendar-${crypto.randomUUID()}`;
  const coverage = {
    gueltigAb: "2026-11-01",
    gueltigBis: "2026-11-30",
    wochentage: [1, 2, 3, 4, 5],
    feiertage: [] as string[],
  };
  await expect(withPrivilegedTenantTransaction({ tenantId }, async tx => {
    await tx.execute(sql`INSERT INTO public.company_settings (id,tenant_id,betriebsruhe)
      VALUES ('default',${tenantId},'[ {"von":"2026-11-23","bis":"2026-11-23"} ]'::jsonb)`);
    const calendar = await readArbeitskalenderInTransaction(tx, tenantId, coverage);
    expect(calendar?.istArbeitstag("2026-11-23")).toBe(false);
    expect(calendar?.istArbeitstag("2026-12-01")).toBeNull();
    expect(calendar?.versandpufferArbeitstage).toBe(2);
    expect(plusWorkingDays("2026-11-20", 1, [], calendar?.stand)).toBe("2026-11-24");
    expect(await readArbeitskalenderInTransaction(tx, tenantId, null)).toBeNull();
    throw new Error("S16D_CALENDAR_TEST_ROLLBACK");
  })).rejects.toThrow("S16D_CALENDAR_TEST_ROLLBACK");
});
