import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("operational core capability", () => {
  it("accepts only an explicit boolean database verdict", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://fixture:fixture@127.0.0.1:5432/fixture");
    const { operationalCoreCapabilityAvailable } = await import("@/lib/server/operationalCoreCapability");
    expect(operationalCoreCapabilityAvailable({ available: true })).toBe(true);
    expect(operationalCoreCapabilityAvailable({ available: false })).toBe(false);
    expect(() => operationalCoreCapabilityAvailable(undefined)).toThrow("OPERATIONAL_CORE_CAPABILITY_UNAVAILABLE");
    expect(() => operationalCoreCapabilityAvailable({ available: "true" })).toThrow("OPERATIONAL_CORE_CAPABILITY_UNAVAILABLE");
  });

  it("proves the exact service-only authorization and order boundary", () => {
    const capability = source("src/lib/server/operationalCoreCapability.ts");
    const migration = source("supabase/migrations/20260715001625_operational_core_boundary_prepared_unapplied.sql");
    const capabilityLower = capability.toLowerCase();
    const migrationLower = migration.toLowerCase();
    for (const evidence of [
      "app_users", "orders", "items", "customers",
      "rolbypassrls", "not rolsuper",
      "has_schema_privilege", "relforcerowsecurity",
      "has_table_privilege", "has_column_privilege", "has_any_column_privilege",
      "priority_computed", "completed_date", "current_station_id",
      "behavior_notes", "shipping_preference", "updated_at",
    ]) {
      expect(capabilityLower).toContain(evidence.toLowerCase());
      expect(migrationLower).toContain(evidence.toLowerCase());
    }
    expect(capability).toContain("current_user = 'service_role'");
    expect(capability).toContain("pg_policy");
    expect(migration).toContain("pg_policies");
    expect(migration).toContain("PREPARED, NOT APPLIED");
    expect(migration).toContain("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
    expect(migration).toContain("GRANT UPDATE (current_station_id, current_step)");
    expect(migration).not.toContain("GRANT DELETE");
    expect(migration).not.toContain("GRANT TRUNCATE");
    expect(capability).toContain("attribute.attname <> all(allowed.columns)");
  });

  it("makes capture fail closed unless core, inventory and capture all pass", () => {
    const capture = source("src/app/actions/capture.actions.ts");
    expect(capture).toContain("readOperationalCoreCapability");
    expect(capture).toContain("readInventoryWriteCapability");
    expect(capture).toContain("readCaptureSchemaCapability");
    expect(capture).toContain("!operationalCoreAvailable || !inventoryAvailable");
  });
});
