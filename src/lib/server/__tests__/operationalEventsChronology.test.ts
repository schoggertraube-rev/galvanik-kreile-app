import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const guardedLegacyMigrations = [
  "supabase/migrations/0004_fix_hotel_tenant.sql",
  "supabase/migrations/0012_harden_rls.sql",
  "supabase/migrations/202605290001_realtime_activation.sql",
  "supabase/migrations/202606051200_phase3_resilience.sql",
  "supabase/migrations/20260619200037_rls_phase1_five_tables.sql",
  "supabase/migrations/20260619200209_drop_legacy_open_policies.sql",
  "supabase/migrations/20260621000000_phase2_migrations.sql",
  "supabase/migrations/20260622000001_view_werkstatt_puls.sql",
] as const;

describe("operational events migration chronology", () => {
  it.each(guardedLegacyMigrations)(
    "guards the historical events assumption in %s",
    (path) => {
      expect(source(path)).toContain("to_regclass('public.events')");
    },
  );

  it("recreates deferred realtime and station-view contracts after the source", () => {
    const boundary = source(
      "supabase/migrations/20260715001200_operational_events_prepared_unapplied.sql",
    );
    expect(boundary).toContain(
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.events",
    );
    expect(boundary).toContain(
      "CREATE OR REPLACE VIEW public.v_analyse_station_durchlauf",
    );
    expect(boundary).toContain("security_invoker = true");
    expect(boundary).toContain("event_record.tenant_id = 'galvanik-kreile'");
  });

  it("fails the retired destructive side bootstrap before it can connect", () => {
    const retired = source("src/db/create-missing-tables.mjs");
    const guard = retired.indexOf("RETIRED_DESTRUCTIVE_SCHEMA_BOOTSTRAP");
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(retired.indexOf("config({ path:"));
    expect(guard).toBeLessThan(retired.indexOf("postgres(connectionString"));
  });
});
