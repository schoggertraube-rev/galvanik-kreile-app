import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryState = vi.hoisted(() => ({ orders: [] as Record<string, unknown>[], items: [] as Record<string, unknown>[], selectCalls: 0 }));
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => {
      const call = queryState.selectCalls++;
      return call === 0
        ? { from: () => ({ leftJoin: () => ({ where: () => ({ orderBy: async () => queryState.orders }) }) }) }
        : { from: () => ({ where: async () => queryState.items }) };
    }),
  },
}));

import { getOperationalOrders, invalidateOperationalOrdersCache } from "@/lib/server/operationalOrders";

const baseOrder = (overrides: Record<string, unknown> = {}) => ({
  id: "order-1", orderNumber: "A-100", customerId: "customer-1", customerName: "Kreile GmbH",
  title: "Welle", task: null, status: "ready", risk: null, currentStationId: "wareneingang",
  intakeDate: null, dueDate: null, createdAt: new Date("2026-08-01T12:00:00.000Z"), ...overrides,
});

beforeEach(() => {
  queryState.selectCalls = 0;
  queryState.orders = [];
  queryState.items = [];
  invalidateOperationalOrdersCache();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-11T09:30:00.000Z"));
});

afterEach(() => vi.useRealTimers());

describe("W2C-B2M5U operational mapper contract", () => {
  it("maps unusable persisted dates to the exact unknown tuple without createdAt or system-time fallbacks", async () => {
    queryState.orders = [
      baseOrder({ id: "null", intakeDate: null, dueDate: null }),
      baseOrder({ id: "blank", intakeDate: "", dueDate: "   " }),
      baseOrder({ id: "invalid", intakeDate: "not-a-date", dueDate: "invalid" }),
    ];
    queryState.items = [{ id: "item-1", orderId: "invalid", name: "Buchse", surfaceRequested: "Zink" }];

    const result = await getOperationalOrders();

    expect(queryState.selectCalls).toBe(2);
    for (const order of result) {
      expect(order).toMatchObject({ intakeDate: "", dueDate: "", risk: "unknown", statusText: "TERMIN NICHT ERFASST", dueLabel: "Termin", dueValue: "Nicht erfasst" });
      expect(order.intakeDate).not.toContain("2026-08-01");
      expect(order.dueDate).not.toContain("2026-08-11");
    }
    expect(result.find((order) => order.id === "invalid")?.parts).toMatchObject([{ id: "item-1", name: "Buchse", surfaceRequested: "Zink" }]);
  });

  it("normalizes persisted ISO dates and retains their real priority", async () => {
    queryState.orders = [baseOrder({ intakeDate: "2026-08-06", dueDate: "2026-08-11T12:00:00+02:00" })];

    const [order] = await getOperationalOrders();

    expect(order.intakeDate).toBe("2026-08-06T00:00:00.000Z");
    expect(order.dueDate).toBe("2026-08-11T10:00:00.000Z");
    expect(order.risk).toBe("orange");
    expect(order.statusText).toBe("GEFÄHRDET");
    expect(order.dueValue).not.toBe("Nicht erfasst");
  });

  it("keeps a valid intake date while a missing due date remains unknown", async () => {
    queryState.orders = [baseOrder({ intakeDate: "2026-08-06", dueDate: null })];

    const [order] = await getOperationalOrders();

    expect(order).toMatchObject({
      intakeDate: "2026-08-06T00:00:00.000Z",
      dueDate: "",
      risk: "unknown",
      statusText: "TERMIN NICHT ERFASST",
      dueLabel: "Termin",
      dueValue: "Nicht erfasst",
    });
    expect(order.dueDate).not.toBe("2026-08-16T00:00:00.000Z");
  });

  it("keeps blocked authoritative even when the persisted due date is unusable", async () => {
    queryState.orders = [baseOrder({ status: "blocked", dueDate: "invalid", intakeDate: "invalid" })];

    await expect(getOperationalOrders()).resolves.toMatchObject([{ risk: "blocked" }]);
  });
});
