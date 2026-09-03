import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveAuthorizationSpy = vi.hoisted(() => vi.fn());
const readTenantStationOrdersSpy = vi.hoisted(() => vi.fn());
const readTenantOrderStationReceiptSpy = vi.hoisted(() => vi.fn());
const readTenantOrderStationCorrectionReceiptSpy = vi.hoisted(() => vi.fn());
const searchOrderIntakeCustomersSpy = vi.hoisted(() => vi.fn());
const readOrderIntakeReceiptSpy = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: resolveAuthorizationSpy }));
vi.mock("@/lib/server/orderStationRead", () => ({
  readTenantStationOrders: readTenantStationOrdersSpy,
  readTenantOrderStationReceipt: readTenantOrderStationReceiptSpy,
  readTenantOrderStationCorrectionReceipt: readTenantOrderStationCorrectionReceiptSpy,
}));
vi.mock("@/lib/server/orderIntakeRead", () => ({
  searchOrderIntakeCustomers: searchOrderIntakeCustomersSpy,
  readOrderIntakeReceipt: readOrderIntakeReceiptSpy,
}));

const authorization = {
  ok: true as const,
  data: {
    userId: "user-1",
    tenantId: "tenant-a",
    displayName: "Readonly",
    role: "readonly" as const,
    permissions: ["perm_view_leitstand", "perm_data_orders", "perm_view_customers"] as const,
    active: true as const,
  },
};

describe("W3 tenant station reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthorizationSpy.mockResolvedValue(authorization);
    readTenantStationOrdersSpy.mockResolvedValue([]);
    readTenantOrderStationReceiptSpy.mockResolvedValue(null);
    readTenantOrderStationCorrectionReceiptSpy.mockResolvedValue(null);
    searchOrderIntakeCustomersSpy.mockResolvedValue([]);
    readOrderIntakeReceiptSpy.mockResolvedValue(null);
  });

  it("allows readonly to read both fixed stations with the tenant-bound capability", async () => {
    const { getGalvanikOrdersAction, getWareneingangOrdersAction } = await import("../actions");

    await expect(getWareneingangOrdersAction()).resolves.toEqual({ ok: true, data: [] });
    await expect(getGalvanikOrdersAction()).resolves.toEqual({ ok: true, data: [] });

    expect(readTenantStationOrdersSpy).toHaveBeenNthCalledWith(1, authorization.data, "wareneingang");
    expect(readTenantStationOrdersSpy).toHaveBeenNthCalledWith(2, authorization.data, "galvanik");
  });

  it("allows buero to read both fixed stations with the tenant-bound capability", async () => {
    const bueroAuthorization = {
      ...authorization,
      data: { ...authorization.data, role: "buero" as const },
    };
    resolveAuthorizationSpy.mockResolvedValue(bueroAuthorization);
    const { getGalvanikOrdersAction, getWareneingangOrdersAction } = await import("../actions");

    await expect(getWareneingangOrdersAction()).resolves.toEqual({ ok: true, data: [] });
    await expect(getGalvanikOrdersAction()).resolves.toEqual({ ok: true, data: [] });
    expect(readTenantStationOrdersSpy).toHaveBeenNthCalledWith(1, bueroAuthorization.data, "wareneingang");
    expect(readTenantStationOrdersSpy).toHaveBeenNthCalledWith(2, bueroAuthorization.data, "galvanik");
  });

  it("authorizes intake customer and receipt reads by capability instead of role", async () => {
    const { getOrderIntakeReceiptAction, searchOrderIntakeCustomersAction } = await import("../actions");
    const receiptInput = {
      orderId: "order-capability-read",
      clientEventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    };

    await expect(searchOrderIntakeCustomersAction({ query: "Sentinel" })).resolves.toEqual({
      ok: true,
      data: { customers: [], canCreateCustomer: false },
    });
    await expect(getOrderIntakeReceiptAction(receiptInput)).resolves.toEqual({ ok: true, data: null });

    expect(searchOrderIntakeCustomersSpy).toHaveBeenCalledWith(authorization.data, { query: "Sentinel" });
    expect(readOrderIntakeReceiptSpy).toHaveBeenCalledWith(authorization.data, receiptInput);
  });

  it("blocks missing intake capabilities before either intake read port", async () => {
    resolveAuthorizationSpy.mockResolvedValue({
      ...authorization,
      data: { ...authorization.data, permissions: [] },
    });
    const { getOrderIntakeReceiptAction, searchOrderIntakeCustomersAction } = await import("../actions");
    const receiptInput = {
      orderId: "order-capability-denial",
      clientEventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    };

    await expect(searchOrderIntakeCustomersAction({ query: "Sentinel" })).resolves.toMatchObject({
      ok: false,
      error: "FORBIDDEN",
    });
    await expect(getOrderIntakeReceiptAction(receiptInput)).resolves.toMatchObject({
      ok: false,
      error: "FORBIDDEN",
    });
    expect(searchOrderIntakeCustomersSpy).not.toHaveBeenCalled();
    expect(readOrderIntakeReceiptSpy).not.toHaveBeenCalled();
  });

  it("keeps missing session, unavailable authorization, and missing capability out of the database reader", async () => {
    const { getWareneingangOrdersAction } = await import("../actions");
    resolveAuthorizationSpy.mockResolvedValueOnce({ ok: false, reason: "NO_SESSION", message: "ignored" });
    await expect(getWareneingangOrdersAction()).resolves.toMatchObject({ ok: false, error: "AUTH_ERROR" });
    resolveAuthorizationSpy.mockResolvedValueOnce({ ok: false, reason: "AUTHORIZATION_UNAVAILABLE", message: "ignored" });
    await expect(getWareneingangOrdersAction()).resolves.toMatchObject({ ok: false, error: "UNAVAILABLE" });
    resolveAuthorizationSpy.mockResolvedValueOnce({
      ...authorization,
      data: { ...authorization.data, permissions: [] },
    });
    await expect(getWareneingangOrdersAction()).resolves.toMatchObject({ ok: false, error: "FORBIDDEN" });
    expect(readTenantStationOrdersSpy).not.toHaveBeenCalled();
  });

  it("keeps successful empty data distinct from a failed read", async () => {
    const { getGalvanikOrdersAction } = await import("../actions");
    await expect(getGalvanikOrdersAction()).resolves.toEqual({ ok: true, data: [] });
    readTenantStationOrdersSpy.mockRejectedValueOnce(new Error("db unavailable"));
    await expect(getGalvanikOrdersAction()).resolves.toMatchObject({ ok: false, error: "QUERY_ERROR" });
  });

  it("forwards only the resolved tenant snapshot to the read port", async () => {
    const tenantB = {
      ...authorization,
      data: { ...authorization.data, tenantId: "tenant-b" },
    };
    resolveAuthorizationSpy.mockResolvedValueOnce(tenantB);
    const { getWareneingangOrdersAction } = await import("../actions");

    await expect(getWareneingangOrdersAction()).resolves.toEqual({ ok: true, data: [] });
    expect(readTenantStationOrdersSpy).toHaveBeenCalledWith(tenantB.data, "wareneingang");
  });

  it("ignores an adversarial tenant argument and reads only the authorized tenant", async () => {
    const { getWareneingangOrdersAction } = await import("../actions");
    const adversarialCall = getWareneingangOrdersAction as unknown as (input: { tenantId: string }) => ReturnType<typeof getWareneingangOrdersAction>;

    await expect(adversarialCall({ tenantId: "tenant-b" })).resolves.toEqual({ ok: true, data: [] });

    expect(readTenantStationOrdersSpy).toHaveBeenCalledTimes(1);
    expect(readTenantStationOrdersSpy).toHaveBeenCalledWith(authorization.data, "wareneingang");
    expect(readTenantStationOrdersSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-b" }),
      "wareneingang",
    );
  });

  it("reads a persisted receipt with the same read capability and resolved tenant only", async () => {
    const input = {
      orderId: "order-1",
      clientEventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    };
    const receipt = {
      eventId: "event-1",
      clientEventId: input.clientEventId,
      correlationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      eventSchemaVersion: 1,
      orderId: input.orderId,
      aggregateVersion: 2,
      fromStation: "wareneingang",
      toStation: "galvanik",
      actorId: "11111111-1111-4111-8111-111111111111",
      occurredAt: "2026-08-11T15:47:32.000Z",
    };
    readTenantOrderStationReceiptSpy.mockResolvedValueOnce(receipt);
    const { getOrderStationReceiptAction } = await import("../actions");

    await expect(getOrderStationReceiptAction(input)).resolves.toEqual({ ok: true, data: receipt });
    expect(readTenantOrderStationReceiptSpy).toHaveBeenCalledWith(authorization.data, input);

    resolveAuthorizationSpy.mockResolvedValueOnce({
      ...authorization,
      data: { ...authorization.data, permissions: [] },
    });
    await expect(getOrderStationReceiptAction(input)).resolves.toMatchObject({ ok: false, error: "FORBIDDEN" });
    expect(readTenantOrderStationReceiptSpy).toHaveBeenCalledTimes(1);
  });

  it("source-locks authorization before read, all tenant predicates, no literal tenant, cache, or legacy reader", async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const [actions, reader] = await Promise.all([
      readFile(path.join(root, "app/warendurchlauf/actions.ts"), "utf8"),
      readFile(path.join(root, "lib/server/orderStationRead.ts"), "utf8"),
    ]);

    expect(actions.indexOf("resolveAuthorization")).toBeLessThan(actions.indexOf("readTenantStationOrders"));
    expect(actions).toContain('permissions.includes("perm_view_leitstand")');
    expect(actions).toContain("readTenantStationOrders(authorization.data, station)");
    expect(actions).not.toContain("getOperationalOrdersByStation");
    expect(actions).not.toContain("getOperationalOrdersReadyForStation");
    expect(reader).toContain('import "server-only";');
    expect(reader).toContain("private.v_operational_station_queue_v1");
    expect(reader).toContain("private.v_order_station_receipts_v1");
    expect(reader).toContain("row.tenant_id !== tenantId");
    expect(reader).toContain("row.tenant_integrity_ok !== true");
    expect(reader).toContain("item.tenantId !== row.tenant_id");
    expect(reader).toContain("item.orderId !== row.id");
    expect(reader).toContain("item.customerId !== row.customer_id");
    expect(reader).not.toContain("FROM public.orders");
    expect(reader).not.toContain("FROM public.items");
    expect(reader).not.toContain('"galvanik-kreile"');
    expect(reader).not.toMatch(/cache|unstable_cache|_ordersCache/i);
  });
});
