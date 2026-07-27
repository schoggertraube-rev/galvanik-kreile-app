import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260713000800_operator_control_plane.sql"),
  "utf8",
);
const schema = readFileSync(
  resolve(process.cwd(), "src/db/schema_operator.ts"),
  "utf8",
);
const validation = readFileSync(
  resolve(process.cwd(), "scripts/validation/operator_control_assertions.sql"),
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
    expect(migration).toContain("DEFAULT pg_catalog.gen_random_uuid()");
    expect(migration).toContain("DEFAULT pg_catalog.now()");
    expect(migration).toContain("service_role must be NOLOGIN, NOSUPERUSER and BYPASSRLS");
    expect(migration).toContain("299b7dd18a794ce08ca2d9818032bfd2");
    expect(migration).toContain("8a072395b8c468a1dca4cfef4249df60");
    expect(migration).toContain("a1bdc34c3f63252273d0cd232293fe2c");
    expect(migration).toContain("migration created control state");
    expect(schema).toContain("table.receivedAt.desc()");
    expect(validation).toContain("BEGIN;");
    expect(validation).toContain("ROLLBACK;");
  });
});
