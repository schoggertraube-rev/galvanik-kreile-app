import { describe, expect, it } from "vitest";

import {
  deriveOrderTimelinessFact,
  ORDER_PICKUP_EVENT_TYPE,
  ORDER_TIMELINESS_CONSISTENCY,
  ORDER_TIMELINESS_MISSING_REASON,
  type OrderTimelinessOrderInput,
  type OrderTimelinessPickupEventInput,
} from "../domain/orderTimelinessFacts";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "22222222-2222-4222-8222-222222222222";

function makeOrder(
  overrides: Partial<OrderTimelinessOrderInput> = {},
): OrderTimelinessOrderInput {
  return {
    orderId: ORDER_ID,
    tenantId: TENANT_ID,
    orderNumber: "A-2026-0042",
    orderVersion: 4,
    lifecycleStatus: "abgeholt",
    confirmedDueDate: "2026-10-26",
    finishedAt: "2026-10-25T00:00:00.000Z",
    ...overrides,
  };
}

function makeV1(
  overrides: Partial<OrderTimelinessPickupEventInput> = {},
): OrderTimelinessPickupEventInput {
  return {
    eventId: "33333333-3333-4333-8333-333333333333",
    tenantId: TENANT_ID,
    orderId: ORDER_ID,
    eventType: ORDER_PICKUP_EVENT_TYPE.V1,
    status: "success",
    fromStation: "fertig",
    station: "abgeholt",
    eventSchemaVersion: 1,
    aggregateVersion: 4,
    payloadOrderId: ORDER_ID,
    payloadMode: "abholung",
    payloadPaymentMode: "vorkasse",
    payloadInvoiceState: null,
    payloadGateAllowed: true,
    createdAt: "2026-10-25T02:30:00.000+02:00",
    ...overrides,
  };
}

function makeV2(
  overrides: Partial<OrderTimelinessPickupEventInput> = {},
): OrderTimelinessPickupEventInput {
  return {
    ...makeV1(),
    eventId: "44444444-4444-4444-8444-444444444444",
    eventType: ORDER_PICKUP_EVENT_TYPE.V2,
    eventSchemaVersion: 2,
    payloadPaymentMode: "rechnung",
    payloadInvoiceState: "not_issued",
    createdAt: "2026-10-25T02:30:00.000+01:00",
    ...overrides,
  };
}

function derive(
  order: OrderTimelinessOrderInput,
  pickupEvents: readonly OrderTimelinessPickupEventInput[],
) {
  return deriveOrderTimelinessFact({ tenantId: TENANT_ID, order, pickupEvents });
}

describe("KR-03A confirmed due and finish facts", () => {
  it("reads only a strict due_date calendar day", () => {
    const fact = derive(makeOrder({ confirmedDueDate: "2028-02-29" }), [makeV1()]);

    expect(fact.promisedDate).toEqual({
      value: "2028-02-29",
      source: "orders.due_date",
      provenance: { kind: "column", relation: "public.orders", column: "due_date" },
      missingReason: null,
    });
  });

  it.each([
    [null, ORDER_TIMELINESS_MISSING_REASON.CONFIRMED_DUE_DATE_MISSING],
    ["2026-02-29", ORDER_TIMELINESS_MISSING_REASON.CONFIRMED_DUE_DATE_INVALID],
    ["2026-10-26T00:00:00Z", ORDER_TIMELINESS_MISSING_REASON.CONFIRMED_DUE_DATE_INVALID],
  ])("fails closed for due_date %s", (confirmedDueDate, reason) => {
    const fact = derive(makeOrder({ confirmedDueDate }), []);

    expect(fact.promisedDate).toEqual({
      value: null,
      source: null,
      provenance: null,
      missingReason: reason,
    });
  });

  it("normalizes a spring DST instant with an explicit Europe/Berlin offset", () => {
    const fact = derive(
      makeOrder({ lifecycleStatus: "fertig", finishedAt: "2026-03-29T01:30:00.000+01:00" }),
      [],
    );

    expect(fact.finishedAt.value).toBe("2026-03-29T00:30:00.000Z");
    expect(fact.finishedAt.source).toBe("orders.completed_date");
  });

  it.each([null, "2026-03-29 01:30:00", "not-an-instant"])(
    "does not invent a finish instant for %s",
    (finishedAt) => {
      const fact = derive(makeOrder({ lifecycleStatus: "fertig", finishedAt }), []);

      expect(fact.finishedAt.missingReason).toBe(
        finishedAt === null
          ? ORDER_TIMELINESS_MISSING_REASON.FINISHED_AT_MISSING
          : ORDER_TIMELINESS_MISSING_REASON.FINISHED_AT_INVALID,
      );
    },
  );
});

describe("KR-03A exactly one valid pickup event", () => {
  it("uses created_at from one valid V1 without exposing finance payload fields", () => {
    const fact = derive(makeOrder(), [makeV1({ payloadPaymentMode: "rechnung" })]);

    expect(fact.pickedUpAt).toEqual({
      value: "2026-10-25T00:30:00.000Z",
      source: "events.created_at",
      provenance: {
        kind: "event",
        relation: "public.events",
        eventId: "33333333-3333-4333-8333-333333333333",
        eventType: ORDER_PICKUP_EVENT_TYPE.V1,
        eventSchemaVersion: 1,
        aggregateVersion: 4,
      },
      missingReason: null,
    });
  });

  it("uses created_at from one valid V2 with the same fact shape", () => {
    const fact = derive(makeOrder(), [makeV2()]);

    expect(fact.pickedUpAt).toEqual({
      value: "2026-10-25T01:30:00.000Z",
      source: "events.created_at",
      provenance: {
        kind: "event",
        relation: "public.events",
        eventId: "44444444-4444-4444-8444-444444444444",
        eventType: ORDER_PICKUP_EVENT_TYPE.V2,
        eventSchemaVersion: 2,
        aggregateVersion: 4,
      },
      missingReason: null,
    });
  });

  it("keeps the two repeated local fall-DST times as distinct instants", () => {
    const summerOffset = derive(makeOrder(), [makeV1()]);
    const winterOffset = derive(makeOrder(), [makeV2()]);

    expect(summerOffset.pickedUpAt.value).toBe("2026-10-25T00:30:00.000Z");
    expect(winterOffset.pickedUpAt.value).toBe("2026-10-25T01:30:00.000Z");
    expect(summerOffset.pickedUpAt.value).not.toBe(winterOffset.pickedUpAt.value);
  });

  it.each([
    makeV1({ eventSchemaVersion: 2 }),
    makeV1({ payloadGateAllowed: false }),
    makeV1({ payloadInvoiceState: "not_issued" }),
    makeV2({ payloadPaymentMode: "vorkasse" }),
    makeV2({ createdAt: "2026-10-25 02:30:00" }),
  ])("names an invalid event instead of using it", (event) => {
    const fact = derive(makeOrder(), [event]);

    expect(fact.pickedUpAt.missingReason).toBe(
      ORDER_TIMELINESS_MISSING_REASON.PICKUP_EVENT_INVALID,
    );
  });

  it("uses one valid event when an additional row is structurally invalid", () => {
    const fact = derive(makeOrder(), [
      makeV1(),
      makeV2({ eventId: "55555555-5555-4555-8555-555555555555", payloadGateAllowed: false }),
    ]);

    expect(fact.pickedUpAt.value).toBe("2026-10-25T00:30:00.000Z");
    expect(fact.pickedUpAt.provenance).toMatchObject({ eventType: ORDER_PICKUP_EVENT_TYPE.V1 });
  });

  it.each([
    [makeV1(), makeV2()],
    [makeV1(), makeV1({ eventId: "55555555-5555-4555-8555-555555555555" })],
    [makeV2(), makeV2({ eventId: "55555555-5555-4555-8555-555555555555" })],
  ])("fails closed for more than one valid pickup event", (...events) => {
    const fact = derive(makeOrder(), events);

    expect(fact.pickedUpAt.missingReason).toBe(
      ORDER_TIMELINESS_MISSING_REASON.PICKUP_EVENT_AMBIGUOUS,
    );
  });

  it("names a genuinely missing pickup event", () => {
    const fact = derive(makeOrder(), []);

    expect(fact.pickedUpAt.missingReason).toBe(
      ORDER_TIMELINESS_MISSING_REASON.PICKUP_EVENT_MISSING,
    );
  });

  it("rejects cross-tenant and cross-order rows before deriving a fact", () => {
    expect(() => derive(makeOrder(), [makeV1({ tenantId: "other-tenant" })]))
      .toThrow("ORDER_TIMELINESS_EVENT_TENANT_MISMATCH");
    expect(() => derive(makeOrder(), [makeV1({ orderId: "other-order" })]))
      .toThrow("ORDER_TIMELINESS_EVENT_ORDER_MISMATCH");
  });

  it("rejects an unexpected event type instead of silently ignoring it", () => {
    expect(() => derive(makeOrder(), [makeV1({ eventType: "ORDER_PICKED_UP_V3" })]))
      .toThrow("ORDER_TIMELINESS_EVENT_TYPE_UNEXPECTED");
  });
});

describe("KR-03A cancellation and consistency", () => {
  it("keeps cancellation missing until a real cancellation contract exists", () => {
    const fact = derive(makeOrder(), [makeV1()]);

    expect(fact.cancellationClass).toEqual({
      value: null,
      source: null,
      provenance: null,
      missingReason: ORDER_TIMELINESS_MISSING_REASON.CANCELLATION_CONTRACT_MISSING,
    });
  });

  it("does not accept a made-up cancelled lifecycle status", () => {
    expect(() => derive(makeOrder({ lifecycleStatus: "storniert" }), []))
      .toThrow("ORDER_TIMELINESS_LIFECYCLE_INVALID");
  });

  it("reports a pickup before finish and a pickup without finish", () => {
    const beforeFinish = derive(
      makeOrder({ finishedAt: "2026-10-25T02:00:00.000Z" }),
      [makeV1()],
    );
    const withoutFinish = derive(makeOrder({ finishedAt: null }), [makeV1()]);

    expect(beforeFinish.consistency).toContain(
      ORDER_TIMELINESS_CONSISTENCY.PICKUP_EVENT_BEFORE_FINISHED_AT,
    );
    expect(withoutFinish.consistency).toEqual(expect.arrayContaining([
      ORDER_TIMELINESS_CONSISTENCY.FINISHED_STATUS_WITHOUT_FINISHED_AT,
      ORDER_TIMELINESS_CONSISTENCY.PICKUP_EVENT_WITHOUT_FINISHED_AT,
    ]));
  });

  it("reports a picked-up status without a valid pickup event", () => {
    const fact = derive(makeOrder(), [makeV1({ payloadGateAllowed: false })]);

    expect(fact.consistency).toContain(
      ORDER_TIMELINESS_CONSISTENCY.PICKED_UP_STATUS_WITHOUT_PICKUP_EVENT,
    );
  });

  it("rejects invalid order identity, version, tenant, and lifecycle", () => {
    expect(() => derive(makeOrder({ orderId: "" }), [])).toThrow("ORDER_TIMELINESS_ORDER_INVALID");
    expect(() => derive(makeOrder({ orderVersion: 0 }), [])).toThrow("ORDER_TIMELINESS_ORDER_INVALID");
    expect(() => derive(makeOrder({ tenantId: "other-tenant" }), []))
      .toThrow("ORDER_TIMELINESS_ORDER_TENANT_MISMATCH");
    expect(() => derive(makeOrder({ lifecycleStatus: "unknown" }), []))
      .toThrow("ORDER_TIMELINESS_LIFECYCLE_INVALID");
  });
});
