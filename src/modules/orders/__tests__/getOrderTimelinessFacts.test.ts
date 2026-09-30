import { beforeEach, describe, expect, it, vi } from "vitest";

const { execute, resolveAuthorization, withPrivilegedTenantTransaction } = vi.hoisted(() => ({
  execute: vi.fn(),
  resolveAuthorization: vi.fn(),
  withPrivilegedTenantTransaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization }));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction }));

import { getOrderTimelinessFacts } from "../server-public";

const TENANT_ID = "tenant-a";
const ORDER_ID = "order-a";
const RANGE = { from: "2026-10-01", to: "2026-10-31" };

function authorize(permissions: readonly string[] = ["perm_view_leitstand"]): void {
  resolveAuthorization.mockResolvedValue({
    ok: true,
    data: {
      userId: "11111111-1111-4111-8111-111111111111",
      tenantId: TENANT_ID,
      displayName: "Test",
      role: "admin",
      permissions,
      active: true,
    },
  });
}

function orderRow() {
  return {
    id: ORDER_ID,
    tenant_id: TENANT_ID,
    order_number: "A-2026-0042",
    status: "abgeholt",
    version: 4,
    confirmed_due_date: "2026-10-25",
    finished_at: "2026-10-25T00:00:00.000Z",
  };
}

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    event_id: "22222222-2222-4222-8222-222222222222",
    order_id: ORDER_ID,
    tenant_id: TENANT_ID,
    event_type: "ORDER_PICKED_UP_V2",
    status: "success",
    station: "abgeholt",
    from_station: "fertig",
    event_schema_version: 2,
    aggregate_version: 4,
    payload_order_id: ORDER_ID,
    payload_mode: "abholung",
    payload_payment_mode: "rechnung",
    payload_invoice_state: "not_issued",
    payload_gate_allowed: true,
    created_at: "2026-10-25T01:30:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authorize();
  withPrivilegedTenantTransaction.mockImplementation(async (_authorization, work) => work({ execute }));
});

describe("getOrderTimelinessFacts fail-closed boundary", () => {
  it.each([
    null,
    {},
    { from: "2026-02-29", to: "2026-03-01" },
    { from: "2026-10-31", to: "2026-10-01" },
    { from: "2026-10-01", to: "2026-10-31", tenantId: TENANT_ID },
  ])("rejects an invalid or widened range before authorization: %j", async (range) => {
    await expect(getOrderTimelinessFacts(range)).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(resolveAuthorization).not.toHaveBeenCalled();
    expect(withPrivilegedTenantTransaction).not.toHaveBeenCalled();
  });

  it("requires a resolved session and perm_view_leitstand", async () => {
    resolveAuthorization.mockResolvedValueOnce({
      ok: false,
      reason: "NO_SESSION",
      message: "missing",
    });
    await expect(getOrderTimelinessFacts(RANGE)).resolves.toMatchObject({
      code: "UNAUTHENTICATED",
    });

    authorize([]);
    await expect(getOrderTimelinessFacts(RANGE)).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(withPrivilegedTenantTransaction).not.toHaveBeenCalled();
  });

  it("turns a view-projected NULL from a wrong JSON scalar type into an invalid event fact", async () => {
    execute
      .mockResolvedValueOnce([orderRow()])
      .mockResolvedValueOnce([eventRow({ payload_gate_allowed: null })]);

    const result = await getOrderTimelinessFacts(RANGE);

    expect(result).toMatchObject({
      code: "OK",
      data: {
        schemaVersion: 1,
        range: RANGE,
        facts: [{
          orderId: ORDER_ID,
          promisedDate: { value: "2026-10-25", source: "orders.due_date" },
          finishedAt: { value: "2026-10-25T00:00:00.000Z" },
          pickedUpAt: { value: null, missingReason: "pickup_event_invalid" },
        }],
      },
    });
    expect(withPrivilegedTenantTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_ID }),
      expect.any(Function),
    );
  });
});
