import { describe, expect, it } from "vitest";
import { buildOrdersHomeProjection, type OrdersHomeSource } from "../public";

const base = (overrides: Partial<OrdersHomeSource> = {}): OrdersHomeSource => ({
  id: "order-1", orderNumber: "A-2026-0001", customerName: "Muster GmbH", title: "Auftrag",
  detail: "Bauteil", station: "galvanik", status: "angenommen", statusText: "In Arbeit", risk: "green",
  dueDate: "2026-09-20", dueLabel: "Fällig", dueValue: "20.09.2026", createdAt: "2026-09-15T12:00:00.000Z", ...overrides,
});

describe("orders home public projection", () => {
  it("selects the dominant action only from persisted risk and due facts", () => {
    const projection = buildOrdersHomeProjection([
      base(),
      base({ id: "order-2", orderNumber: "A-2026-0002", risk: "red", dueDate: "2026-09-25" }),
      base({ id: "order-3", orderNumber: "A-2026-0003", risk: "orange", dueDate: "2026-09-18" }),
    ], "2026-09-16T08:15:00.000Z");
    expect(projection.source).toBe("Auftragsbestand");
    expect(projection.priority.map((order) => order.id)).toEqual(["order-2", "order-3", "order-1"]);
    expect(projection.dominant).toEqual({ orderId: "order-2", reason: "Dieser Auftrag ist kritisch." });
    expect(projection.recent.map((order) => order.id)).toEqual(["order-1", "order-2", "order-3"]);
    expect(projection.recentSince).toBe("2026-09-15T08:15:00.000Z");
    expect(projection.recentCoverage).toBe("complete");
  });

  it("keeps an empty real projection empty and fails closed on malformed facts", () => {
    expect(buildOrdersHomeProjection([], "2026-09-16T08:15:00.000Z")).toMatchObject({ orders: [], priority: [], recent: [], recentCoverage: "complete", dominant: null });
    expect(() => buildOrdersHomeProjection([base({ id: "" })], "2026-09-16T08:15:00.000Z")).toThrow("ORDERS_HOME_SOURCE_INVALID");
    expect(() => buildOrdersHomeProjection([base({ createdAt: "invalid" })], "2026-09-16T08:15:00.000Z")).toThrow("ORDERS_HOME_SOURCE_INVALID");
    expect(() => buildOrdersHomeProjection([], "invalid")).toThrow("ORDERS_HOME_PROJECTION_INVALID");
  });

  it("keeps recent coverage honest when a legacy row has no usable creation time", () => {
    const projection = buildOrdersHomeProjection([
      base({ id: "recent", createdAt: "2026-09-16T07:00:00.000Z" }),
      base({ id: "legacy", orderNumber: "A-2026-0002", createdAt: null }),
      base({ id: "future", orderNumber: "A-2026-0003", createdAt: "2026-09-17T07:00:00.000Z" }),
    ], "2026-09-16T08:15:00.000Z");

    expect(projection.recent.map((order) => order.id)).toEqual(["recent"]);
    expect(projection.recentCoverage).toBe("partial");
  });
});
