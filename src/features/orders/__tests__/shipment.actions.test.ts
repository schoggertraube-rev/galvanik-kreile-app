import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const eqCalls: Array<[unknown, unknown]> = [];
  const execute = vi.fn(async () => undefined);
  const updateWhere = vi.fn(async () => undefined);
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));
  const insertValues = vi.fn(async () => undefined);
  const insert = vi.fn(() => ({ values: insertValues }));
  const transaction = vi.fn(async (callback: (tx: unknown) => Promise<void>) =>
    callback({ execute, update, insert }),
  );
  const orderRows: unknown[] = [];
  const limit = vi.fn(async () => orderRows);
  const query = {
    leftJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    limit,
  };
  const select = vi.fn(() => ({ from: vi.fn(() => query) }));

  return {
    eqCalls,
    execute,
    insertValues,
    orderRows,
    resolveAuthorization: vi.fn(),
    select,
    transaction,
    updateSet,
  };
});

vi.mock("@/db", () => ({
  db: {
    select: mocks.select,
    transaction: mocks.transaction,
  },
}));

vi.mock("@/db/schema", () => {
  const table = (name: string) =>
    new Proxy(
      { __table: name },
      {
        get(target, property) {
          if (property === "__table") return target.__table;
          return `${name}.${String(property)}`;
        },
      },
    );

  return {
    customers: table("customers"),
    events: table("events"),
    orders: table("orders"),
  };
});

vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: mocks.resolveAuthorization,
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: unknown[]) => conditions),
  eq: vi.fn((left: unknown, right: unknown) => {
    mocks.eqCalls.push([left, right]);
    return [left, right];
  }),
  sql: vi.fn(),
}));

const WORKSHOP_AUTH = {
  ok: true as const,
  data: {
    userId: "00000000-0000-0000-0000-000000000001",
    tenantId: "galvanik-kreile",
    displayName: "Philipp",
    role: "werkstatt" as const,
    permissions: ["perm_op_status" as const],
    active: true as const,
  },
};

describe("shipment actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eqCalls.length = 0;
    mocks.orderRows.length = 0;
    mocks.resolveAuthorization.mockResolvedValue(WORKSHOP_AUTH);
  });

  it("denies readonly before querying an order", async () => {
    mocks.resolveAuthorization.mockResolvedValue({
      ok: true,
      data: {
        ...WORKSHOP_AUTH.data,
        role: "readonly",
        permissions: ["perm_view_leitstand"],
      },
    });

    const { saveShipmentInfo } = await import("../shipment.actions");
    const result = await saveShipmentInfo({
      orderId: "order-1",
      carrier: "dhl",
      trackingNumber: "tracking-1",
    });

    expect(result).toMatchObject({ success: false });
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not treat office order creation rights as status rights", async () => {
    mocks.resolveAuthorization.mockResolvedValue({
      ok: true,
      data: {
        ...WORKSHOP_AUTH.data,
        role: "buero",
        permissions: ["perm_data_orders", "perm_view_prices"],
      },
    });

    const { sendShippingConfirmation } = await import("../shipment.actions");
    const result = await sendShippingConfirmation({
      orderId: "order-1",
      carrier: "selbstabholung",
      trackingNumber: null,
    });

    expect(result).toMatchObject({ success: false });
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("requires a tenant-bound order and customer before saving shipment data", async () => {
    mocks.orderRows.push({
      id: "order-1",
      street: "Werkstraße 1",
      zipCode: "60311",
      city: "Frankfurt",
      country: "Deutschland",
    });

    const { saveShipmentInfo } = await import("../shipment.actions");
    const result = await saveShipmentInfo({
      orderId: "order-1",
      carrier: "dhl",
      trackingNumber: "tracking-1",
    });

    expect(result).toEqual({ success: true });
    expect(mocks.eqCalls).toEqual(
      expect.arrayContaining([
        ["orders.tenantId", "galvanik-kreile"],
        ["customers.tenantId", "galvanik-kreile"],
      ]),
    );
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.execute).toHaveBeenCalledTimes(3);
  });

  it("records the authenticated actor when shipping a tenant-bound order", async () => {
    mocks.orderRows.push({ id: "order-1" });

    const { sendShippingConfirmation } = await import("../shipment.actions");
    const result = await sendShippingConfirmation({
      orderId: "order-1",
      carrier: "selbstabholung",
      trackingNumber: null,
    });

    expect(result).toEqual({ success: true });
    expect(mocks.updateSet).toHaveBeenCalledWith({ status: "shipped" });
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "galvanik-kreile",
        orderId: "order-1",
        eventType: "SHIPPED",
        userId: "00000000-0000-0000-0000-000000000001",
      }),
    );
  });
});
