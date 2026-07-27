import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260713000300_item_photo_jobs.sql"),
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
    expect(migration).toContain("CREATE TABLE public.item_photo_jobs");
    expect(migration).not.toContain("CREATE TABLE IF NOT EXISTS public.item_photo_jobs");
    expect(migration).not.toMatch(/CREATE OR REPLACE FUNCTION public\.(?:reserve|bind|claim|settle|mark)_item_photo/i);
    expect(migration).not.toMatch(/CREATE EXTENSION IF NOT EXISTS pgcrypto/i);
    expect(migration).toContain("ALTER TABLE public.item_photo_jobs FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("ITEM_PHOTO_VERIFICATION_FAILED: column contract drift");
    expect(migration).toContain("ITEM_PHOTO_VERIFICATION_FAILED: constraint contract drift");
    expect(migration).toContain("ITEM_PHOTO_VERIFICATION_FAILED: index contract drift");
    expect(migration).toContain("ITEM_PHOTO_VERIFICATION_FAILED: function contract drift");
    expect(migration).toContain("ITEM_PHOTO_VERIFICATION_FAILED: function ACL drift");
    expect(migration).toContain("ITEM_PHOTO_VERIFICATION_FAILED: unexpected effective role access detected");
    expect(migration).toContain("pg_has_role(role_record.oid, 'pg_read_all_data', 'USAGE')");
    expect(migration).toContain("has_table_privilege(role_record.oid, table_oid, 'MAINTAIN')");
    expect(migration).toContain("role_record.rolname = 'supabase_read_only_user'");
    expect(migration).toContain("ITEM_PHOTO_VERIFICATION_FAILED: service role contract drift");
    expect(migration).toContain("has_table_privilege(service_role_oid, table_oid, 'MAINTAIN')");
    expect(migration).toContain("has_any_column_privilege(service_role_oid, table_oid, 'SELECT')");
  });
});
