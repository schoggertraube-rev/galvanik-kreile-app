import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720000200_phase2_public_rls_remediation_prepared_unapplied.sql",
  ),
  "utf8",
);

describe("Phase 2 public RLS remediation migration", () => {
  it("removes every existing policy and forces RLS on all affected tables", () => {
    expect(migration).toContain(
      "ARRAY['payments', 'price_lines', 'email_templates']",
    );
    expect(migration).toContain(
      "ALTER TABLE public.%I FORCE ROW LEVEL SECURITY",
    );
    expect(migration).toContain("DROP POLICY %I ON public.%I");
  });

  it("removes browser grants and leaves only required service operations", () => {
    expect(migration).toContain(
      "FROM PUBLIC, anon, authenticated, service_role",
    );
    expect(migration).toContain(
      "GRANT SELECT ON TABLE public.payments TO service_role",
    );
    expect(migration).toContain(
      "GRANT SELECT ON TABLE public.price_lines TO service_role",
    );
    expect(migration).toContain(
      "GRANT SELECT ON TABLE public.email_templates TO service_role",
    );
    expect(migration).not.toMatch(
      /GRANT\s+(?:ALL|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)\b/i,
    );
  });

  it("fails closed when required tables or verification receipts are missing", () => {
    expect(migration).toContain("PHASE2_RLS_RECONCILIATION_REQUIRED");
    expect(migration).toContain("PHASE2_RLS_BROWSER_GRANTS_REMAIN");
    expect(migration).toContain("PHASE2_RLS_FORCE_INCOMPLETE");
    expect(migration).toContain("PHASE2_RLS_SERVICE_ROLE_GRANTS_INVALID");
  });
});
