import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryState = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  executeCalls: 0,
  tenantIds: [] as string[],
}));
vi.mock("@/lib/server/privilegedDb", () => ({
  withPrivilegedTenantTransaction: vi.fn(async (
    authorization: { tenantId: string },
    work: (tx: { execute: () => Promise<Record<string, unknown>[]> }) => Promise<unknown>,
  ) => {
    queryState.tenantIds.push(authorization.tenantId);
    return work({
      execute: async () => {
        queryState.executeCalls += 1;
        return queryState.rows;
      },
    });
  }),
}));

import {
  readTenantOperationalOrderCount,
  readTenantOperationalOrders,
} from "@/lib/server/orderStationRead";

const authorization = { tenantId: "tenant-a" };
const baseOrder = (overrides: Record<string, unknown> = {}) => ({
  id: "order-1",
  tenant_id: "tenant-a",
  version: 1,
  order_number: "A-100",
  customer_id: "customer-1",
  customer_name: "Kreile GmbH",
  title: "Welle",
  task: null,
  station: "wareneingang",
  current_station: "wareneingang",
  current_station_id: "wareneingang",
  status: "ready",
  risk: null,
  intake_date: null,
  due_date: null,
  created_at: new Date("2026-08-01T12:00:00.000Z"),
  tenant_integrity_ok: true,
  parts: [],
  ...overrides,
});

beforeEach(() => {
  queryState.executeCalls = 0;
  queryState.rows = [];
  queryState.tenantIds = [];
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-11T09:30:00.000Z"));
});

afterEach(() => vi.useRealTimers());

describe("W2C-B2M5U operational mapper contract", () => {
  it("maps unusable persisted dates to the exact unknown tuple without createdAt or system-time fallbacks", async () => {
    queryState.rows = [
      baseOrder({ id: "null", intake_date: null, due_date: null }),
      baseOrder({ id: "blank", intake_date: "", due_date: "   " }),
      baseOrder({
        id: "invalid",
        intake_date: "not-a-date",
        due_date: "invalid",
        parts: [{
          id: "item-1",
          tenantId: "tenant-a",
          orderId: "invalid",
          customerId: "customer-1",
          name: "Buchse",
          quantity: 1,
          currentStationId: "wareneingang",
          createdAt: "2026-08-01T12:00:00.000Z",
          surfaceRequested: "Zink",
        }],
      }),
    ];

    const result = await readTenantOperationalOrders(authorization);

    expect(queryState.executeCalls).toBe(1);
    expect(queryState.tenantIds).toEqual(["tenant-a"]);
    for (const order of result) {
      expect(order).toMatchObject({ intakeDate: "", dueDate: "", risk: "unknown", statusText: "TERMIN NICHT ERFASST", dueLabel: "Termin", dueValue: "Nicht erfasst" });
      expect(order.intakeDate).not.toContain("2026-08-01");
      expect(order.dueDate).not.toContain("2026-08-11");
    }
    expect(result.find((order) => order.id === "invalid")?.parts).toMatchObject([{ id: "item-1", name: "Buchse", surfaceRequested: "Zink" }]);
  });

  it("normalizes persisted ISO dates and retains their real priority", async () => {
    queryState.rows = [baseOrder({ intake_date: "2026-08-06", due_date: "2026-08-11T12:00:00+02:00" })];

    const [order] = await readTenantOperationalOrders(authorization);

    expect(order.intakeDate).toBe("2026-08-06T00:00:00.000Z");
    expect(order.dueDate).toBe("2026-08-11T10:00:00.000Z");
    expect(order.risk).toBe("orange");
    expect(order.statusText).toBe("GEFÄHRDET");
    expect(order.dueValue).not.toBe("Nicht erfasst");
  });

  it("keeps a valid intake date while a missing due date remains unknown", async () => {
    queryState.rows = [baseOrder({ intake_date: "2026-08-06", due_date: null })];

    const [order] = await readTenantOperationalOrders(authorization);

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
    queryState.rows = [baseOrder({ status: "blocked", due_date: "invalid", intake_date: "invalid" })];

    await expect(readTenantOperationalOrders(authorization)).resolves.toMatchObject([{ risk: "blocked" }]);
  });

  it("runs every full read uncached and fails closed on tenant or ownership corruption", async () => {
    queryState.rows = [baseOrder()];
    await readTenantOperationalOrders(authorization);
    await readTenantOperationalOrders(authorization);
    expect(queryState.executeCalls).toBe(2);

    queryState.rows = [baseOrder({ tenant_id: "tenant-b" })];
    await expect(readTenantOperationalOrders(authorization)).rejects.toThrow("ORDER_OWNERSHIP_INVALID");

    queryState.rows = [baseOrder({ tenant_integrity_ok: false })];
    await expect(readTenantOperationalOrders(authorization)).rejects.toThrow("ORDER_OWNERSHIP_INVALID");
  });

  it.each([
    { current_station: "" },
    { current_station: "   " },
    { current_station_id: "" },
    { current_station_id: "   " },
  ])("rejects a blank station alias instead of masking it with station: %o", async (override) => {
    queryState.rows = [baseOrder(override)];
    await expect(readTenantOperationalOrders(authorization)).rejects.toThrow(
      "ORDER_READMODEL_INVALID",
    );
  });

  it("counts only through the same v1 port and rejects corrupt or malformed counts", async () => {
    queryState.rows = [{ order_count: 3, invalid_count: 0 }];
    await expect(readTenantOperationalOrderCount(authorization)).resolves.toBe(3);

    queryState.rows = [{ order_count: 3, invalid_count: 1 }];
    await expect(readTenantOperationalOrderCount(authorization)).rejects.toThrow("ORDER_OWNERSHIP_INVALID");

    queryState.rows = [{ order_count: -1, invalid_count: 0 }];
    await expect(readTenantOperationalOrderCount(authorization)).rejects.toThrow("ORDER_COUNT_READMODEL_INVALID");
  });
});
