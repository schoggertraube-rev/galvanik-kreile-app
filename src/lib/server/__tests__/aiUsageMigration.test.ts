import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260715000300_ai_usage_ledger_prepared_unapplied.sql"),
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
    expect(migration).not.toMatch(/CREATE\s+POLICY/i);
  });

  it("binds claim and settlement to tenant, user, feature and reservation", () => {
    expect(migration).toMatch(/WHERE r\.id = p_reservation_id[\s\S]*r\.tenant_id = p_tenant_id[\s\S]*r\.user_id = p_user_id[\s\S]*r\.feature = p_feature/);
    expect(migration).toContain("v_status <> 'reserved'");
    expect(migration).toContain("v_reservation.status <> 'in_flight'");
    expect(migration).toContain("REVOKE ALL ON TABLE public.ai_usage_reservations FROM PUBLIC, anon, authenticated, service_role");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.reserve_ai_usage");
  });
});
