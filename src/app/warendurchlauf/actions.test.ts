import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PermissionKey } from "@/lib/auth/authorizationContract";

vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: vi.fn(),
}));

vi.mock("@/lib/server/operationalOrders", () => ({
  getOperationalOrders: vi.fn(),
  getOperationalOrdersByStation: vi.fn(),
  getOperationalOrdersReadyForStation: vi.fn(),
}));

vi.mock("@/app/actions/orders.actions", () => ({
  transitionOrderProcess: vi.fn(),
}));

import { resolveAuthorization } from "@/lib/server/authorization";
import { getOperationalOrdersByStation } from "@/lib/server/operationalOrders";
import { transitionOrderProcess } from "@/app/actions/orders.actions";
import { getStationOrders, startProcessingStation } from "@/app/warendurchlauf/actions";

function authorize(permissions: readonly PermissionKey[], role: "buero" | "werkstatt" | "readonly") {
  vi.mocked(resolveAuthorization).mockResolvedValue({
    ok: true,
    data: {
      userId: "11111111-1111-4111-8111-111111111111",
      tenantId: "galvanik-kreile",
      displayName: "Test",
      role,
      permissions,
      active: true,
    },
  });
}

describe("Warendurchlauf authorization boundaries", () => {
  const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows a read-only Leitstand permission to read tenant-scoped station orders", async () => {
    authorize(["perm_view_leitstand"], "readonly");
    vi.mocked(getOperationalOrdersByStation).mockResolvedValue([]);

    const result = await getStationOrders("galvanik");

    expect(result.ok).toBe(true);
    expect(getOperationalOrdersByStation).toHaveBeenCalledWith("galvanik", "galvanik-kreile");
  });

  it("does not let an office data permission mutate operational status", async () => {
    authorize(["perm_data_orders", "perm_view_leitstand"], "buero");

    const result = await startProcessingStation("order-1", "galvanik", requestId);

    expect(result).toMatchObject({ ok: false, error: "FORBIDDEN" });
    expect(transitionOrderProcess).not.toHaveBeenCalled();
  });

  it("allows the workshop status permission to start a tenant-bound transition", async () => {
    authorize(["perm_view_leitstand", "perm_op_status"], "werkstatt");
    vi.mocked(transitionOrderProcess).mockResolvedValue({
      ok: true,
      data: { success: true, newStation: "galvanik", newStatus: "in_progress", replayed: false },
    });

    const result = await startProcessingStation("order-1", "galvanik", requestId);

    expect(result.ok).toBe(true);
    expect(transitionOrderProcess).toHaveBeenCalledWith({
      orderId: "order-1",
      action: "start",
      expectedStation: "galvanik",
      clientRequestId: requestId,
    });
  });
});
