import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260713000200_ai_usage_ledger.sql"),
  "utf8",
);

describe("prepared AI usage ledger migration", () => {
  it("uses atomic tenant/user locks and fail-closed limits", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("p_user_window_limit");
    expect(migration).toContain("p_tenant_window_limit");
    expect(migration).toContain("p_user_daily_unit_limit");
    expect(migration).toContain("p_tenant_daily_unit_limit");
    expect(migration).toContain("prior_attempt_terminal");
    expect(migration).toContain("reclaimed_reserved");
    expect(migration).toContain("stale_in_flight");
    expect(migration).toContain("v_existing.updated_at <= v_now - interval '5 minutes'");
    expect(migration).not.toMatch(/CREATE\s+POLICY/i);
  });

  it("binds claim and settlement to tenant, user, feature and reservation", () => {
    expect(migration).toMatch(/WHERE r\.id = p_reservation_id[\s\S]*r\.tenant_id = p_tenant_id[\s\S]*r\.user_id = p_user_id[\s\S]*r\.feature = p_feature/);
    expect(migration).toContain("r.status = 'reserved'");
    expect(migration).toContain("r.updated_at > clock_timestamp() - interval '5 minutes'");
    expect(migration).toContain("v_reservation.status <> 'in_flight'");
    expect(migration).toContain("REVOKE ALL ON TABLE public.ai_usage_reservations FROM PUBLIC, anon, authenticated, service_role");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.reserve_ai_usage");
    expect(migration).not.toMatch(/CREATE TABLE IF NOT EXISTS public\.ai_usage_reservations/i);
    expect(migration).not.toMatch(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS/i);
    expect(migration).not.toMatch(/CREATE OR REPLACE FUNCTION public\.(?:reserve|claim|settle)_ai_usage/i);
    expect(migration).toContain("ALTER TABLE public.ai_usage_reservations FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("DEFAULT pg_catalog.gen_random_uuid()");
    expect(migration).not.toMatch(/CREATE EXTENSION IF NOT EXISTS pgcrypto/i);
    expect(migration).toContain("role_record.rolname = 'supabase_etl_admin'");
    expect(migration).toContain("role_record.rolname = 'supabase_read_only_user'");
    expect(migration).toContain("pg_has_role(role_record.oid, 'pg_read_all_data', 'USAGE')");
    expect(migration).toContain("NOT pg_has_role(role_record.oid, 'pg_write_all_data', 'USAGE')");
    expect(migration).toContain("'pg_read_all_data', 'pg_write_all_data', 'pg_maintain'");
    expect(migration).toContain("has_table_privilege(role_record.oid, v_table, 'MAINTAIN')");
    expect(migration).toContain("OR rolcanlogin");
    expect(migration).toContain("OR rolreplication");
  });
});
