import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260715000400_item_photo_jobs_prepared_unapplied.sql"),
  "utf8",
);

describe("prepared item photo job migration", () => {
  it("reserves storage and analysis budgets atomically", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("p_item_limit");
    expect(migration).toContain("p_tenant_daily_bytes_limit");
    expect(migration).toContain("p_user_concurrent_limit");
    expect(migration).toContain("uq_item_photo_content");
  });

  it("allows exactly one claim and monotone terminal settlement", () => {
    expect(migration).toContain("v_job.status <> 'uploaded'");
    expect(migration).toContain("SET status = 'in_flight'");
    expect(migration).toContain("v_job.status <> 'in_flight'");
    expect(migration).toContain("status IN ('succeeded', 'failed', 'uncertain')");
    expect(migration).toContain("REVOKE ALL ON TABLE public.item_photo_jobs FROM PUBLIC, anon, authenticated, service_role");
  });
});
