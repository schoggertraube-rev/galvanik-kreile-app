import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("productive invoice number uniqueness", () => {
  it("keeps historical demo fixtures outside the accounting identity", () => {
    const migration = source(
      "supabase/migrations/20260713000700_invoice_number_uniqueness.sql",
    );
    const capability = source("src/lib/server/invoiceCreateCapability.ts");
    const action = source("src/app/buchhaltung/actions.ts");
    const validation = source(
      "scripts/validation/invoice_number_uniqueness.local.sql",
    );

    expect(migration).toContain("WHERE is_demo IS DISTINCT FROM TRUE");
    expect(migration).toContain("Duplicate productive invoice numbers");
    expect(migration).toContain("index_row.indpred IS NOT NULL");
    expect(migration).toContain("index_row.indnkeyatts = 2");
    expect(migration).toContain("index_row.indnatts = 2");
    expect(migration).toContain("index_row.indexprs IS NULL");
    expect(migration).toContain("NOT index_row.indnullsnotdistinct");
    expect(migration).toContain("access_method.amname = 'btree'");
    expect(migration).not.toContain("index_row.indpred IS NULL");
    expect(migration).not.toContain("DELETE FROM public.ausgangsrechnung");
    expect(capability).toContain("pg_get_expr(pi.indpred, pi.indrelid)");
    expect(capability).toContain("pi.indpred is not null");
    expect(capability).toContain("pi.indnkeyatts = 2");
    expect(capability).toContain("pi.indnatts = 2");
    expect(capability).toContain("pi.indexprs is null");
    expect(capability).toContain("not pi.indnullsnotdistinct");
    expect(capability).toContain("access_method.amname = 'btree'");
    expect(capability).toContain("array['tenant_id', 'nummer']::text[]");
    expect(capability).not.toContain("pi.indpred is null");
    expect(capability).not.toContain("pg_get_indexdef(pi.indexrelid) like");
    expect(action).toContain("sql`${ausgangsrechnung.isDemo} is distinct from true`");
    expect(validation).toContain("Duplicate productive invoice number was accepted");
    expect(validation).toContain("'LOCAL-DEMO-DUPLICATE'");
    expect(validation).toContain("ROLLBACK;");
  });
});
