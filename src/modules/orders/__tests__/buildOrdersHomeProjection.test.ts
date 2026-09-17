import { describe, expect, it } from "vitest";
import { buildOrdersHomeProjection, type OrdersHomeSource } from "../public";

const base = (overrides: Partial<OrdersHomeSource> = {}): OrdersHomeSource => ({
  id: "order-1", orderNumber: "A-2026-0001", customerName: "Muster GmbH", title: "Auftrag",
  detail: "Bauteil", station: "galvanik", status: "angenommen", statusText: "In Arbeit", risk: "green",
  dueDate: "2026-09-20", dueLabel: "Fällig", dueValue: "20.09.2026", ...overrides,
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
    expect(projection.dominant).toEqual({ orderId: "order-2", reason: "Persistierter Risikostatus: kritisch" });
  });

  it("keeps an empty real projection empty and fails closed on malformed facts", () => {
    expect(buildOrdersHomeProjection([], "2026-09-16T08:15:00.000Z")).toMatchObject({ orders: [], priority: [], dominant: null });
    expect(() => buildOrdersHomeProjection([base({ id: "" })], "2026-09-16T08:15:00.000Z")).toThrow("ORDERS_HOME_SOURCE_INVALID");
    expect(() => buildOrdersHomeProjection([], "invalid")).toThrow("ORDERS_HOME_PROJECTION_INVALID");
  });
});
