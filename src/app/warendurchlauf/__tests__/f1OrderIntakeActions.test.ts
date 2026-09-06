import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  create: vi.fn(),
  search: vi.fn(),
  receipt: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: ports.resolveAuthorization }));
vi.mock("@/lib/server/orderStationRead", () => ({
  readTenantOrderStationReceipt: vi.fn(), readTenantStationOrders: vi.fn(),
}));
vi.mock("@/lib/server/commands/orderIntakeCommand", () => ({ createOrderIntake: ports.create }));
vi.mock("@/lib/server/orderIntakeRead", () => ({
  searchOrderIntakeCustomers: ports.search,
  readOrderIntakeReceipt: ports.receipt,
}));

const auth = (permissions: string[]) => ({
  ok: true as const,
  data: {
    userId: "11111111-1111-4111-8111-111111111111",
    tenantId: KREILE_TENANT_SLUG,
    displayName: "Büro",
    role: "buero" as const,
    permissions,
    active: true as const,
  },
});

describe("F1 order intake actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    ports.resolveAuthorization.mockResolvedValue(auth([
      "perm_data_customers", "perm_data_orders", "perm_view_customers", "perm_view_leitstand",
    ]));
    ports.search.mockResolvedValue([]);
    ports.receipt.mockResolvedValue(null);
    ports.create.mockResolvedValue({ code: "OK", receipt: { orderId: "order" }, replayed: false });
  });

  it("delegates the command without accepting client authorization or tenant fields", async () => {
    const { createOrderIntakeAction } = await import("../actions");
    const input = { clientEventId: "x", customer: {}, dueDate: "x", note: null, items: [] } as never;
    await expect(createOrderIntakeAction(input)).resolves.toMatchObject({ code: "OK" });
    expect(ports.create).toHaveBeenCalledWith(input);
  });

  it("authorizes customer search on every call and returns capability separately", async () => {
    const { searchOrderIntakeCustomersAction } = await import("../actions");
    await expect(searchOrderIntakeCustomersAction({ query: "" })).resolves.toEqual({
      ok: true,
      data: { customers: [], canCreateCustomer: true },
    });
    expect(ports.search).toHaveBeenCalledWith(expect.objectContaining({ tenantId: KREILE_TENANT_SLUG }), { query: "" });

    ports.resolveAuthorization.mockResolvedValueOnce(auth(["perm_data_orders", "perm_view_customers"]));
    await expect(searchOrderIntakeCustomersAction({ query: "" })).resolves.toMatchObject({
      ok: true, data: { canCreateCustomer: false },
    });
    ports.resolveAuthorization.mockResolvedValueOnce(auth(["perm_view_customers"]));
    await expect(searchOrderIntakeCustomersAction({ query: "" })).resolves.toMatchObject({ ok: false, error: "FORBIDDEN" });
  });

  it("keeps missing sessions and query failures fail-closed without read data", async () => {
    const { searchOrderIntakeCustomersAction, getOrderIntakeReceiptAction } = await import("../actions");
    ports.resolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "NO_SESSION", message: "no" });
    await expect(searchOrderIntakeCustomersAction({ query: "" })).resolves.toMatchObject({ ok: false, error: "AUTH_ERROR" });
    expect(ports.search).not.toHaveBeenCalled();

    ports.resolveAuthorization.mockResolvedValueOnce(auth(["perm_view_leitstand"]));
    ports.receipt.mockRejectedValueOnce(new Error("drift"));
    await expect(getOrderIntakeReceiptAction({ orderId: "order", clientEventId: "request" })).resolves.toMatchObject({
      ok: false, error: "QUERY_ERROR",
    });
  });

  it("requires leitstand view permission for receipt readback", async () => {
    const { getOrderIntakeReceiptAction } = await import("../actions");
    ports.resolveAuthorization.mockResolvedValueOnce(auth(["perm_data_orders"]));
    await expect(getOrderIntakeReceiptAction({ orderId: "order", clientEventId: "request" })).resolves.toMatchObject({
      ok: false, error: "FORBIDDEN",
    });
    expect(ports.receipt).not.toHaveBeenCalled();
  });
});
