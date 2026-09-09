import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveAuthorization = vi.hoisted(() => vi.fn());
const withPrivilegedTenantTransaction = vi.hoisted(() => vi.fn());
const noStore = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization }));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction }));
vi.mock("next/cache", () => ({ unstable_noStore: noStore }));

const authorization = {
  userId: "user-kpi",
  tenantId: "tenant-kpi",
  displayName: "KPI User",
  role: "werkstatt",
  permissions: ["perm_view_leitstand"],
  active: true,
};

function allowKpis() {
  resolveAuthorization.mockResolvedValue({ ok: true, data: authorization });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("W2C-B2M5J station and KPI fail-closed boundaries", () => {
  it("keeps the unavailable station-start command closed", async () => {
    const { startProcessingStation } = await import("../actions");
    await expect(startProcessingStation("order-foreign-001", "beschichtung")).resolves.toMatchObject({
      ok: false,
      error: "CONFLICT",
    });
    expect(resolveAuthorization).not.toHaveBeenCalled();
    expect(withPrivilegedTenantTransaction).not.toHaveBeenCalled();
  });

  it("stops missing sessions and missing permission before the database port", async () => {
    const { getWarendurchlaufKPIs } = await import("../actions");
    resolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "NO_SESSION" });
    await expect(getWarendurchlaufKPIs()).resolves.toMatchObject({ ok: false, error: "AUTH_ERROR" });

    resolveAuthorization.mockResolvedValueOnce({
      ok: true,
      data: { ...authorization, permissions: [] },
    });
    await expect(getWarendurchlaufKPIs()).resolves.toMatchObject({ ok: false, error: "FORBIDDEN" });
    expect(withPrivilegedTenantTransaction).not.toHaveBeenCalled();
  });

  it("passes exactly one valid tenant-bound SQL snapshot through", async () => {
    allowKpis();
    withPrivilegedTenantTransaction.mockImplementationOnce(async (snapshot, work) => {
      expect(snapshot).toBe(authorization);
      return work({
        execute: vi.fn().mockResolvedValue([
          {
            tenant_id: authorization.tenantId,
            contract_version: 1,
            wip_count: 3,
            due_this_week_count: "2",
          },
        ]),
      });
    });
    const { getWarendurchlaufKPIs } = await import("../actions");
    await expect(getWarendurchlaufKPIs()).resolves.toEqual({
      ok: true,
      data: { wipCount: 3, dueThisWeekCount: 2 },
    });
    expect(noStore).toHaveBeenCalledOnce();
  });

  it("logs only structured database diagnostics and keeps the client result generic", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const databaseError = {
      message: "KPI view query failed",
      details: "The KPI projection is temporarily unavailable",
      hint: "Retry after the database service has recovered",
      token: "server-token-must-not-leak",
      sql: "SELECT * FROM private.internal_table",
      tenantId: authorization.tenantId,
      userId: authorization.userId,
    };
    allowKpis();
    withPrivilegedTenantTransaction.mockRejectedValueOnce(databaseError);

    const { getWarendurchlaufKPIs } = await import("../actions");
    const result = await getWarendurchlaufKPIs();

    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith("Werkstatt KPI query failed", {
      message: databaseError.message,
      details: databaseError.details,
      hint: databaseError.hint,
    });

    const serializedLog = JSON.stringify(consoleError.mock.calls);
    expect(serializedLog).not.toContain(databaseError.token);
    expect(serializedLog).not.toContain(databaseError.sql);
    expect(serializedLog).not.toContain(databaseError.tenantId);
    expect(serializedLog).not.toContain(databaseError.userId);

    expect(result).toEqual({
      ok: false,
      error: "QUERY_ERROR",
      message: "Werkstatt-KPIs konnten nicht sicher geladen werden.",
    });
    const serializedResult = JSON.stringify(result);
    expect(serializedResult).not.toContain(databaseError.message);
    expect(serializedResult).not.toContain(databaseError.details);
    expect(serializedResult).not.toContain(databaseError.hint);
    expect(serializedResult).not.toContain(databaseError.token);
    expect(serializedResult).not.toContain(databaseError.sql);
    expect(serializedResult).not.toContain(databaseError.tenantId);
    expect(serializedResult).not.toContain(databaseError.userId);
  });

  it.each([
    { rows: [] },
    { rows: [{ tenant_id: "foreign", contract_version: 1, wip_count: 1, due_this_week_count: 1 }] },
    { rows: [{ tenant_id: authorization.tenantId, contract_version: 1, wip_count: -1, due_this_week_count: 1 }] },
    { rows: [{ tenant_id: authorization.tenantId, contract_version: 2, wip_count: 1, due_this_week_count: 1 }] },
  ])("maps missing or invalid KPI projection %# to QUERY_ERROR", async ({ rows }) => {
    allowKpis();
    withPrivilegedTenantTransaction.mockImplementationOnce(async (_snapshot, work) =>
      work({ execute: vi.fn().mockResolvedValue(rows) }),
    );
    const { getWarendurchlaufKPIs } = await import("../actions");
    await expect(getWarendurchlaufKPIs()).resolves.toMatchObject({ ok: false, error: "QUERY_ERROR" });
  });
});
