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
