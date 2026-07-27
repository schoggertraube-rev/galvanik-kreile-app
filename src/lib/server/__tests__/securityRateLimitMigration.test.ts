import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("prepared security rate-limit migration", () => {
  const sql = readFileSync(join(
    process.cwd(),
    "supabase/migrations/20260713000100_security_rate_limit_index.sql",
  ), "utf8");

  it("keeps counters durable, atomic and unavailable to public API roles", () => {
    expect(sql).toContain("PRIMARY KEY (namespace, subject_hash)");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toMatch(/REVOKE ALL PRIVILEGES ON TABLE[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/);
    expect(sql).toContain("ON CONFLICT (namespace, subject_hash) DO UPDATE");
    expect(sql).toContain("p_namespace IS NULL");
    expect(sql).toContain("p_subject_hash IS NULL");
    expect(sql).toContain("p_limit IS NULL");
    expect(sql).toContain("p_window_seconds IS NULL");
    expect(sql).toContain("p_subject_hash !~ '^[0-9a-f]{64}$'");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("SECURITY_RATE_LIMIT_VERIFICATION_FAILED");
    expect(sql).toContain("unexpected effective role access detected");
    expect(sql).toContain("pg_has_role(role_record.oid, 'pg_read_all_data', 'USAGE')");
    expect(sql).toContain("has_table_privilege(role_record.oid, relation_oid, 'MAINTAIN')");
    expect(sql).toContain("role_record.rolname = 'supabase_read_only_user'");
    expect(sql).toContain("unexpected sensitive role membership detected");
    expect(sql).toContain("pg_has_role(candidate.oid, target.target_oid, 'MEMBER')");
    expect(sql).toContain("membership.set_option");
    expect(sql).toContain("'authenticator', 'kreile_app_runtime'");
    expect(sql).toContain("candidate.rolname = 'cli_login_postgres'");
    expect(sql).toContain("membership.member = migration_owner");
    expect(sql).not.toMatch(/^\s*BEGIN\s*;/m);
    expect(sql).not.toMatch(/^\s*COMMIT\s*;/m);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\s+TABLE\b/i);
  });
});
