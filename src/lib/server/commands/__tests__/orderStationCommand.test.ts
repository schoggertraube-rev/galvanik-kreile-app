import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveAuthorizationSpy, withTransactionSpy, executeSpy } = vi.hoisted(() => ({
  resolveAuthorizationSpy: vi.fn(),
  withTransactionSpy: vi.fn(),
  executeSpy: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: resolveAuthorizationSpy }));
vi.mock("@/lib/server/privilegedDb", () => ({
  withPrivilegedTenantTransaction: withTransactionSpy,
}));
vi.mock("drizzle-orm", () => ({
  sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }),
}));

const authorization = {
  ok: true as const,
  data: {
    userId: "user-1", tenantId: "tenant-a", displayName: "Werkstatt", role: "werkstatt" as const,
    permissions: ["perm_op_status"] as const, active: true as const,
  },
};
const validOrder = {
  id: "order-1", tenant_id: "tenant-a", customer_id: "customer-a", station: "wareneingang",
  current_station: "wareneingang", current_station_id: "wareneingang",
  status: "in_progress", version: 1,
};
const validCustomer = { id: "customer-a", tenant_id: "tenant-a" };
const validItem = {
  id: "item-1", tenant_id: "tenant-a", customer_id: "customer-a",
  current_station_id: "wareneingang",
};

describe("transitionWareneingangToGalvanik", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthorizationSpy.mockResolvedValue(authorization);
    withTransactionSpy.mockImplementation(async (_authorization, work) => work({ execute: executeSpy }));
  });

  it("returns VALIDATION_ERROR without authorization or a database port for invalid runtime input", async () => {
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    await expect(transitionWareneingangToGalvanik(undefined as never)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(transitionWareneingangToGalvanik({ orderId: " ", expectedVersion: 0 })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(resolveAuthorizationSpy).not.toHaveBeenCalled();
    expect(withTransactionSpy).not.toHaveBeenCalled();
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it("returns UNAUTHENTICATED and UNAVAILABLE without a command database port", async () => {
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    resolveAuthorizationSpy.mockResolvedValueOnce({ ok: false, reason: "NO_SESSION", message: "not signed in" });
    await expect(transitionWareneingangToGalvanik({ orderId: "order-1", expectedVersion: 1 })).resolves.toMatchObject({ code: "UNAUTHENTICATED" });
    resolveAuthorizationSpy.mockResolvedValueOnce({ ok: false, reason: "AUTHORIZATION_UNAVAILABLE", message: "down" });
    await expect(transitionWareneingangToGalvanik({ orderId: "order-1", expectedVersion: 1 })).resolves.toMatchObject({ code: "UNAVAILABLE" });
    resolveAuthorizationSpy.mockRejectedValueOnce(new Error("down"));
    await expect(transitionWareneingangToGalvanik({ orderId: "order-1", expectedVersion: 1 })).resolves.toMatchObject({ code: "UNAVAILABLE" });
    expect(withTransactionSpy).not.toHaveBeenCalled();
  });

  it("keeps readonly and buero snapshots with only perm_view_leitstand out of the command transaction", async () => {
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    for (const role of ["readonly", "buero"] as const) {
      resolveAuthorizationSpy.mockResolvedValueOnce({
        ...authorization,
        data: { ...authorization.data, role, permissions: ["perm_view_leitstand"] },
      });
      await expect(transitionWareneingangToGalvanik({ orderId: "order-1", expectedVersion: 1 })).resolves.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(withTransactionSpy).not.toHaveBeenCalled();
  });

  it("makes missing and foreign orders indistinguishable", async () => {
    executeSpy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    const missing = await transitionWareneingangToGalvanik({ orderId: "missing", expectedVersion: 1 });
    const foreign = await transitionWareneingangToGalvanik({ orderId: "foreign", expectedVersion: 1 });
    expect(missing).toEqual({ code: "NOT_FOUND", message: "Auftrag nicht verfügbar." });
    expect(foreign).toEqual(missing);
  });

  it("returns CONFLICT only for stale versions and guarded update misses", async () => {
    executeSpy.mockResolvedValueOnce([{ ...validOrder, version: 2 }]);
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    await expect(transitionWareneingangToGalvanik({ orderId: "order-1", expectedVersion: 1 })).resolves.toMatchObject({ code: "CONFLICT" });
    executeSpy
      .mockResolvedValueOnce([validOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await expect(transitionWareneingangToGalvanik({ orderId: "order-1", expectedVersion: 1 })).resolves.toMatchObject({ code: "CONFLICT" });
  });

  it("returns VALIDATION_ERROR before writes for invalid station, status, or any linked item state", async () => {
    executeSpy
      .mockResolvedValueOnce([{ ...validOrder, station: null, current_station: null, current_station_id: null }])
      .mockResolvedValueOnce([{ ...validOrder, status: "fertig" }])
      .mockResolvedValueOnce([validOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([{ ...validItem, current_station_id: null }])
      .mockResolvedValueOnce([validOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([{ ...validItem, id: "item-foreign", tenant_id: "tenant-b" }])
      .mockResolvedValueOnce([validOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([{ ...validItem, id: "item-null", tenant_id: null }]);
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    for (const orderId of ["station", "status", "item", "foreign-item", "null-item"]) {
      await expect(transitionWareneingangToGalvanik({ orderId, expectedVersion: 1 })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    }
    expect(executeSpy).toHaveBeenCalledTimes(11);
  });

  it("rejects null and foreign order customers before the item lock or any update", async () => {
    executeSpy
      .mockResolvedValueOnce([{ ...validOrder, customer_id: null }])
      .mockResolvedValueOnce([{ ...validOrder, customer_id: "customer-b" }])
      .mockResolvedValueOnce([]);
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");

    for (const orderId of ["null-customer", "foreign-customer"]) {
      await expect(
        transitionWareneingangToGalvanik({ orderId, expectedVersion: 1 }),
      ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    }

    expect(executeSpy).toHaveBeenCalledTimes(3);
    expect(executeSpy.mock.calls.map(([query]) => query.text).join("\n")).not.toContain("UPDATE public");
  });

  it("rejects null, foreign, and same-tenant mismatched item customers before any update", async () => {
    for (const customerId of [null, "customer-b", "customer-a-other"]) {
      executeSpy
        .mockResolvedValueOnce([validOrder])
        .mockResolvedValueOnce([validCustomer])
        .mockResolvedValueOnce([{ ...validItem, customer_id: customerId }]);
    }
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");

    for (const orderId of ["null-item-customer", "foreign-item-customer", "mismatched-item-customer"]) {
      await expect(
        transitionWareneingangToGalvanik({ orderId, expectedVersion: 1 }),
      ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    }

    expect(executeSpy).toHaveBeenCalledTimes(9);
    expect(executeSpy.mock.calls.map(([query]) => query.text).join("\n")).not.toContain("UPDATE public");
  });

  it("updates the triple station fields, version, and items atomically after locks", async () => {
    executeSpy
      .mockResolvedValueOnce([validOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([validItem])
      .mockResolvedValueOnce([{ id: "order-1", version: 2 }])
      .mockResolvedValueOnce([{ id: "item-1" }]);
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    await expect(transitionWareneingangToGalvanik({ orderId: "order-1", expectedVersion: 1 })).resolves.toEqual({ code: "OK", orderId: "order-1", version: 2 });
    expect(executeSpy.mock.calls[0][0].text).toContain("FOR UPDATE");
    expect(executeSpy.mock.calls[1][0].text).toContain("FROM public.customers");
    expect(executeSpy.mock.calls[1][0].text).toContain("FOR SHARE");
    expect(executeSpy.mock.calls[2][0].text).toContain("WHERE order_id = ?");
    expect(executeSpy.mock.calls[2][0].text).toContain("FOR UPDATE");
    expect(executeSpy.mock.calls[2][0].text).not.toContain("AND tenant_id");
    for (const predicate of [
      "station = ?",
      "current_station = ?",
      "current_station_id = ?",
      "tenant_id = ?",
      "version = ?",
    ]) {
      expect(executeSpy.mock.calls[3][0].text).toContain(predicate);
    }
    expect(executeSpy.mock.calls[4][0].text).toContain("UPDATE public.items");
  });

  it("maps a post-order-update item write failure to UNAVAILABLE without returning OK", async () => {
    executeSpy
      .mockResolvedValueOnce([validOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([validItem])
      .mockResolvedValueOnce([{ id: "order-1", version: 2 }])
      .mockRejectedValueOnce(new Error("item write failed"));
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    await expect(transitionWareneingangToGalvanik({ orderId: "order-1", expectedVersion: 1 })).resolves.toEqual({
      code: "UNAVAILABLE",
      message: "Stationswechsel ist derzeit nicht verfügbar.",
    });
    expect(executeSpy).toHaveBeenCalledTimes(5);
  });

  it("contains no event, RPC, or Supabase Data API path", async () => {
    const commandPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../orderStationCommand.ts");
    const source = await readFile(commandPath, "utf8");
    expect(source).toContain('import "server-only";');
    expect(source).not.toMatch(/\bevents\b|\.insert\(|rpc\(|createClient|supabase/i);
    expect(source).toContain("perm_op_status");
    const customerLock = source.match(/SELECT id, tenant_id\s+FROM public\.customers[\s\S]+?FOR SHARE/)?.[0] ?? "";
    expect(customerLock).toContain("WHERE id = ${order.customer_id}");
    expect(customerLock).toContain("AND tenant_id = ${authorization.data.tenantId}");
    const itemLock = source.match(/SELECT id, tenant_id, customer_id, current_station_id[\s\S]+?FOR UPDATE/)?.[0] ?? "";
    expect(itemLock).toContain("WHERE order_id = ${order.id}");
    expect(itemLock).not.toContain("AND tenant_id");
    expect(source).toContain("item.tenant_id !== authorization.data.tenantId");
    expect(source).toContain("item.customer_id !== order.customer_id");
  });
});
