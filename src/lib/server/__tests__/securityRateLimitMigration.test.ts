import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("prepared security rate-limit migration", () => {
  const sql = readFileSync(join(
    process.cwd(),
    "supabase/migrations/20260715000100_security_rate_limit_index_prepared_unapplied.sql",
  ), "utf8");

  it("keeps counters durable, atomic and unavailable to public API roles", () => {
    expect(sql).toContain("PRIMARY KEY (namespace, subject_hash)");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toMatch(/REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/);
    expect(sql).toContain("ON CONFLICT (namespace, subject_hash) DO UPDATE");
    expect(sql).not.toMatch(/\bDELETE\b/i);
  });
});
