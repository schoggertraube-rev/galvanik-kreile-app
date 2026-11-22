import { expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";

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
