import { beforeEach, describe, expect, it, vi } from "vitest";

const { execute, resolveAuthorization } = vi.hoisted(() => ({ execute: vi.fn(), resolveAuthorization: vi.fn() }));

vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization }));
vi.mock("@/lib/server/privilegedDb", () => ({
  withPrivilegedTenantTransaction: vi.fn(async (_context, work) => work({ execute })),
}));

import { changeOrderContent, setOrderItemFinished } from "../orderContentCommand";

const actor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const itemId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const serviceId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const clientEventId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("order content command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthorization.mockResolvedValue({ ok: true, data: { userId: actor, tenantId: "galvanik-kreile", role: "meister", permissions: ["perm_data_orders"], active: true, displayName: "Rolf" } });
  });

  it("writes a version-bound catalog-backed content change and an event receipt", async () => {
    execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "order-1", customer_id: "customer-1", version: 1, station: "angenommen", status: "in_progress" }])
      .mockResolvedValueOnce([{ id: itemId, catalog_service_id: serviceId }])
      .mockResolvedValueOnce([{ id: serviceId, name: "Vernickeln", surface: "Nickel", unit: "Stück", net_price_cents: 1250, vat_rate_basis_points: 1900, active: true }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ version: 2 }])
      .mockResolvedValueOnce([{ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", user_id: actor, aggregate_version: 2, created_at: "2026-10-27T04:00:00.000Z", payload: {}, event_type: "ORDER_CONTENT_CHANGED_V1", order_id: "order-1" }]);

    const result = await changeOrderContent({
      orderId: "order-1", expectedVersion: 1, clientEventId, note: "Sichtflächen schützen",
      items: [{ id: itemId, catalogServiceId: serviceId, name: "Clientwert", quantity: 2, material: "Stahl", surface: "Clientwert", unit: "x", unitPriceCents: 1, vatRateBasisPoints: 0 }],
    });

    expect(result).toMatchObject({ code: "OK", replayed: false, receipt: { aggregateVersion: 2, actorId: actor } });
    expect(execute).toHaveBeenCalledTimes(8);
  });

  it("fails closed without order write permission", async () => {
    resolveAuthorization.mockResolvedValue({ ok: true, data: { userId: actor, tenantId: "galvanik-kreile", role: "readonly", permissions: [], active: true, displayName: "Leser" } });
    await expect(setOrderItemFinished({ orderId: "order-1", itemId, expectedVersion: 1, clientEventId, finished: true })).resolves.toEqual({ code: "FORBIDDEN", message: "Diese Rolle darf den Teilstatus nicht ändern." });
    expect(execute).not.toHaveBeenCalled();
  });
});
