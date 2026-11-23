import { expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("EINSTELLUNGEN_LOCAL_TEST_DATABASE_REQUIRED");
}

test("settings data migrations preserve old rows and keep private records behind RLS", async () => {
  const [row] = await db.execute<{
    migrations: number;
    defaultHours: number;
    nullableLeadTime: boolean;
    vehiclesRls: boolean;
    anonVehicles: boolean;
    retentionRls: boolean;
    anonRetention: boolean;
  }>(sql`
    SELECT
      (SELECT count(*)::integer FROM supabase_migrations.schema_migrations
       WHERE version LIKE '202611230006%') AS migrations,
      (private.s16d_spur_d_standardwerte()->>'offline_max_stunden')::integer AS "defaultHours",
      (SELECT is_nullable = 'YES' FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'catalog_services'
         AND column_name = 'standard_lead_time_working_days') AS "nullableLeadTime",
      (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.vehicles'::regclass) AS "vehiclesRls",
      has_table_privilege('anon', 'public.vehicles', 'SELECT') AS "anonVehicles",
      (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.dokument_ablaufhemmung'::regclass) AS "retentionRls",
      has_table_privilege('anon', 'public.dokument_ablaufhemmung', 'SELECT') AS "anonRetention"
  `);
  expect(row.migrations).toBe(11);
  expect(row.defaultHours).toBe(24);
  expect(row.nullableLeadTime).toBe(true);
  expect(row.vehiclesRls).toBe(true);
  expect(row.anonVehicles).toBe(false);
  expect(row.retentionRls).toBe(true);
  expect(row.anonRetention).toBe(false);
});

test("KP12 creates the tenant retention defaults once and preserves a changed rule", async () => {
  const tenantId = `TEST-settings-retention-${crypto.randomUUID()}`;
  await expect(withPrivilegedTenantTransaction({ tenantId }, async tx => {
    await tx.execute(sql`INSERT INTO public.company_settings (id,tenant_id) VALUES ('default',${tenantId})`);
    const rows = await tx.execute<{ dokumentart: string; fristJahre: number }>(sql`
      SELECT dokumentart,frist_jahre AS "fristJahre" FROM public.dokument_aufbewahrung
      WHERE tenant_id=${tenantId} ORDER BY dokumentart`);
    expect(rows).toHaveLength(8);
    expect(Object.fromEntries(rows.map(row => [row.dokumentart,row.fristJahre]))).toMatchObject({
      rechnung: 8, buchungsbeleg: 8, abschluss: 10, geschaeftsbrief: 6,
      kv_mail: 6, auftragsmail: 6, telefonnotiz: 3, sonstige_mail: 3,
    });
    await tx.execute(sql`UPDATE public.dokument_aufbewahrung SET frist_jahre=9
      WHERE tenant_id=${tenantId} AND dokumentart='rechnung'`);
    await tx.execute(sql`SELECT private.kp12_startfristen(${tenantId})`);
    const [changed] = await tx.execute<{ jahre: number }>(sql`SELECT frist_jahre AS jahre
      FROM public.dokument_aufbewahrung WHERE tenant_id=${tenantId} AND dokumentart='rechnung'`);
    expect(changed?.jahre).toBe(9);
    throw Error('KP12_TEST_ROLLBACK');
  })).rejects.toThrow('KP12_TEST_ROLLBACK');
});
