import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260715001700_operator_control_plane_prepared_unapplied.sql"),
  "utf8",
);

describe("operator control migration", () => {
  it("creates signed current state and append-only version history", () => {
    expect(migration).toContain("CREATE TABLE public.tenant_operator_controls");
    expect(migration).toContain("CREATE TABLE public.operator_control_events");
    expect(migration).toContain("operator_control_events_tenant_version_uidx UNIQUE (tenant_id, policy_version)");
    expect(migration).toContain("canonical_payload text NOT NULL");
    expect(migration).toContain("signature varchar(100) NOT NULL");
    expect(migration).toContain("tenant_operator_controls_monotonic_version_trg");
    expect(migration).toContain("NEW.policy_version <= OLD.policy_version");
  });

  it("has only explicit modes and no covert slowdown mode", () => {
    expect(migration).toContain("'active', 'grace', 'suspended', 'maintenance'");
    expect(migration).not.toMatch(/['\"]slow/i);
    expect(migration).toContain("mode = 'active' OR notice IS NOT NULL");
  });

  it("is forced-RLS, browser-inaccessible and non-deletable", () => {
    expect(migration).toContain("ALTER TABLE public.tenant_operator_controls FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.operator_control_events FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated, service_role");
    expect(migration).toContain("GRANT SELECT, INSERT ON TABLE public.operator_control_events TO service_role");
    expect(migration).not.toMatch(/GRANT\s+(?:[^;]*,\s*)?(?:DELETE|TRUNCATE|ALL)/i);
  });
});
