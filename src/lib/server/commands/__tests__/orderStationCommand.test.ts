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
  id: "order-1", tenant_id: "tenant-a", station: "wareneingang",
  current_station: "wareneingang", current_station_id: "wareneingang",
  status: "in_progress", version: 1,
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

  it("returns FORBIDDEN without a database port when perm_op_status is absent", async () => {
    resolveAuthorizationSpy.mockResolvedValue({ ...authorization, data: { ...authorization.data, permissions: [] } });
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    await expect(transitionWareneingangToGalvanik({ orderId: "order-1", expectedVersion: 1 })).resolves.toMatchObject({ code: "FORBIDDEN" });
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
    executeSpy.mockResolvedValueOnce([validOrder]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await expect(transitionWareneingangToGalvanik({ orderId: "order-1", expectedVersion: 1 })).resolves.toMatchObject({ code: "CONFLICT" });
  });

  it("returns VALIDATION_ERROR before writes for invalid station, status, or tenant-owned item state", async () => {
    executeSpy
      .mockResolvedValueOnce([{ ...validOrder, station: null, current_station: null, current_station_id: null }])
      .mockResolvedValueOnce([{ ...validOrder, status: "fertig" }])
      .mockResolvedValueOnce([validOrder])
      .mockResolvedValueOnce([{ id: "item-1", tenant_id: "tenant-a", current_station_id: null }]);
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    for (const orderId of ["station", "status", "item"]) {
      await expect(transitionWareneingangToGalvanik({ orderId, expectedVersion: 1 })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    }
    expect(executeSpy).toHaveBeenCalledTimes(4);
  });

  it("updates the triple station fields, version, and items atomically after locks", async () => {
    executeSpy
      .mockResolvedValueOnce([validOrder])
      .mockResolvedValueOnce([{ id: "item-1", tenant_id: "tenant-a", current_station_id: "wareneingang" }])
      .mockResolvedValueOnce([{ id: "order-1", version: 2 }])
      .mockResolvedValueOnce([{ id: "item-1" }]);
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    await expect(transitionWareneingangToGalvanik({ orderId: "order-1", expectedVersion: 1 })).resolves.toEqual({ code: "OK", orderId: "order-1", version: 2 });
    expect(executeSpy.mock.calls[0][0].text).toContain("FOR UPDATE");
    for (const predicate of [
      "station = ?",
      "current_station = ?",
      "current_station_id = ?",
      "tenant_id = ?",
      "version = ?",
    ]) {
      expect(executeSpy.mock.calls[2][0].text).toContain(predicate);
    }
    expect(executeSpy.mock.calls[3][0].text).toContain("UPDATE public.items");
  });

  it("maps a post-order-update item write failure to UNAVAILABLE without returning OK", async () => {
    executeSpy
      .mockResolvedValueOnce([validOrder])
      .mockResolvedValueOnce([{ id: "item-1", tenant_id: "tenant-a", current_station_id: "wareneingang" }])
      .mockResolvedValueOnce([{ id: "order-1", version: 2 }])
      .mockRejectedValueOnce(new Error("item write failed"));
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    await expect(transitionWareneingangToGalvanik({ orderId: "order-1", expectedVersion: 1 })).resolves.toEqual({
      code: "UNAVAILABLE",
      message: "Stationswechsel ist derzeit nicht verfügbar.",
    });
    expect(executeSpy).toHaveBeenCalledTimes(4);
  });

  it("contains no event, RPC, or Supabase Data API path", async () => {
    const commandPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../orderStationCommand.ts");
    const source = await readFile(commandPath, "utf8");
    expect(source).toContain('import "server-only";');
    expect(source).not.toMatch(/\bevents\b|\.insert\(|rpc\(|createClient|supabase/i);
    expect(source).toContain("perm_op_status");
  });
});
