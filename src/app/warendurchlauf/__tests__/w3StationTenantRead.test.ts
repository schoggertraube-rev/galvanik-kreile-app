import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveAuthorizationSpy = vi.hoisted(() => vi.fn());
const readTenantStationOrdersSpy = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: resolveAuthorizationSpy }));
vi.mock("@/lib/server/orderStationRead", () => ({ readTenantStationOrders: readTenantStationOrdersSpy }));

const authorization = {
  ok: true as const,
  data: {
    userId: "user-1",
    tenantId: "tenant-a",
    displayName: "Werkstatt",
    role: "readonly" as const,
    permissions: ["perm_view_leitstand"] as const,
    active: true as const,
  },
};

describe("W3 tenant station reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthorizationSpy.mockResolvedValue(authorization);
    readTenantStationOrdersSpy.mockResolvedValue([]);
  });

  it("reads the two fixed stations only after session authorization and capability", async () => {
    const { getGalvanikOrdersAction, getWareneingangOrdersAction } = await import("../actions");

    await expect(getWareneingangOrdersAction()).resolves.toEqual({ ok: true, data: [] });
    await expect(getGalvanikOrdersAction()).resolves.toEqual({ ok: true, data: [] });

    expect(readTenantStationOrdersSpy).toHaveBeenNthCalledWith(1, authorization.data, "wareneingang");
    expect(readTenantStationOrdersSpy).toHaveBeenNthCalledWith(2, authorization.data, "galvanik");
  });

  it("allows a buero snapshot to use only the tenant-bound read capability", async () => {
    const bueroAuthorization = {
      ...authorization,
      data: { ...authorization.data, role: "buero" as const },
    };
    resolveAuthorizationSpy.mockResolvedValueOnce(bueroAuthorization);
    const { getGalvanikOrdersAction } = await import("../actions");

    await expect(getGalvanikOrdersAction()).resolves.toEqual({ ok: true, data: [] });
    expect(readTenantStationOrdersSpy).toHaveBeenCalledWith(bueroAuthorization.data, "galvanik");
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
    expect(reader).toContain("Pick<AuthorizationSnapshot, \"tenantId\">");
    expect(reader).toContain("eq(orders.tenantId, tenantId)");
    expect(reader).toContain("eq(customers.tenantId, tenantId)");
    expect(reader).toContain("eq(items.tenantId, tenantId)");
    expect(reader).not.toContain('"galvanik-kreile"');
    expect(reader).not.toMatch(/cache|unstable_cache|_ordersCache/i);
  });
});
