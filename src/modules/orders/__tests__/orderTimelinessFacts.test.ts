import { describe, expect, it } from "vitest";
import {
  ORDER_PICKUP_EVENT_TYPE_V1,
  ORDER_PICKUP_EVENT_TYPE_V2,
  ORDER_TIMELINESS_CONSISTENCY,
  ORDER_TIMELINESS_MISSING_REASON,
  ORDER_TIMELINESS_SOURCE,
  buildOrderTimelinessFacts,
  isOrderTimelinessRange,
  type OrderTimelinessFact,
  type OrderTimelinessOrderRow,
  type OrderTimelinessPickupEventRow,
} from "../domain/orderTimelinessFacts";

const TENANT = "tenant-under-test";
const RANGE = { from: "2026-09-01", to: "2026-09-30" };
const GENERATED_AT = "2026-09-27T08:00:00.000Z";
const ORDER_ID = "order-1";

function orderRow(overrides: Partial<OrderTimelinessOrderRow> = {}): OrderTimelinessOrderRow {
  return {
    id: ORDER_ID,
    tenantId: TENANT,
    orderNumber: "A-2026-0001",
    status: "fertig",
    version: 4,
    dueDate: new Date("2026-09-15T00:00:00.000Z"),
    completedDate: new Date("2026-09-14T09:30:00.000Z"),
    ...overrides,
  };
}

/**
 * Der Readvertrag projiziert aus `events.payload` nur die fuenf geprueften
 * Skalarfelder; das rohe jsonb verlaesst die Datenbank nicht. Die Fixture spiegelt
 * genau diese Vertragsform.
 */
function pickupEventV2(
  overrides: Partial<OrderTimelinessPickupEventRow> = {},
): OrderTimelinessPickupEventRow {
  return {
    eventId: "event-1",
    orderId: ORDER_ID,
    tenantId: TENANT,
    eventType: ORDER_PICKUP_EVENT_TYPE_V2,
    status: "success",
    station: "abgeholt",
    fromStation: "fertig",
    eventSchemaVersion: 2,
    aggregateVersion: 4,
    payloadOrderId: ORDER_ID,
    payloadMode: "abholung",
    payloadPaymentMode: "rechnung",
    payloadInvoiceState: "not_issued",
    payloadGateAllowed: true,
    createdAt: new Date("2026-09-16T11:15:00.000Z"),
    ...overrides,
  };
}

function buildSingleFact(
  order: OrderTimelinessOrderRow,
  pickupEvents: readonly OrderTimelinessPickupEventRow[] = [],
): OrderTimelinessFact {
  const result = buildOrderTimelinessFacts({
    tenantId: TENANT,
    range: RANGE,
    generatedAt: GENERATED_AT,
    orders: [order],
    pickupEvents,
  });
  const fact = result.facts[0];
  if (!fact) throw new Error("TEST_FACT_MISSING");
  return fact;
}

describe("G04 getOrderTimelinessFacts — range contract", () => {
  it("accepts a UTC calendar-day window with both bounds inclusive", () => {
    expect(isOrderTimelinessRange({ from: "2026-09-01", to: "2026-09-30" })).toBe(true);
    expect(isOrderTimelinessRange({ from: "2026-09-01", to: "2026-09-01" })).toBe(true);
  });

  it("rejects anything but exactly two valid, ordered calendar days", () => {
    for (const candidate of [
      null,
      "2026-09-01",
      {},
      { from: "2026-09-01" },
      { from: "2026-09-30", to: "2026-09-01" },
      { from: "2026-09-31", to: "2026-10-01" },
      { from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" },
      { from: "2026-09-01", to: "2026-09-30", tenantId: TENANT },
    ]) {
      expect(isOrderTimelinessRange(candidate)).toBe(false);
    }
  });
});

describe("G04 getOrderTimelinessFacts — promisedDate", () => {
  it("reads the confirmed date from orders.due_date", () => {
    const fact = buildSingleFact(orderRow());
    expect(fact.promisedDate).toEqual({
      value: "2026-09-15",
      source: ORDER_TIMELINESS_SOURCE.PROMISED_DATE,
      provenance: { kind: "column", relation: "public.orders", column: "due_date" },
      missingReason: null,
    });
  });
});

describe("G04 getOrderTimelinessFacts — finishedAt", () => {
  it("reads the finish time from orders.completed_date", () => {
    const fact = buildSingleFact(orderRow());
    expect(fact.finishedAt).toEqual({
      value: "2026-09-14T09:30:00.000Z",
      source: ORDER_TIMELINESS_SOURCE.FINISHED_AT,
      provenance: { kind: "column", relation: "public.orders", column: "completed_date" },
      missingReason: null,
    });
  });

  it("returns the current completed_date after a freeze correction, not the first value", () => {
    const beforeCorrection = buildSingleFact(orderRow({
      completedDate: new Date("2026-09-14T09:30:00.000Z"),
    }));
    // Zweiter Freeze-Zyklus: das Korrektur-Gegenereignis hat completed_date neu gesetzt.
    const afterCorrection = buildSingleFact(orderRow({
      completedDate: new Date("2026-09-18T16:45:00.000Z"),
    }));
    expect(beforeCorrection.finishedAt.value).toBe("2026-09-14T09:30:00.000Z");
    expect(afterCorrection.finishedAt.value).toBe("2026-09-18T16:45:00.000Z");
    expect(afterCorrection.finishedAt.source).toBe(ORDER_TIMELINESS_SOURCE.FINISHED_AT);
  });

  it("is null with a missing reason while the order is not finished", () => {
    const fact = buildSingleFact(orderRow({ status: "galvanik", completedDate: null }));
    expect(fact.finishedAt).toEqual({
      value: null,
      source: null,
      provenance: null,
      missingReason: ORDER_TIMELINESS_MISSING_REASON.NOT_FINISHED_YET,
    });
  });

  it("is null with a missing reason when completed_date is unusable", () => {
    const fact = buildSingleFact(orderRow({ completedDate: "not-a-timestamp" }));
    expect(fact.finishedAt).toEqual({
      value: null,
      source: null,
      provenance: null,
      missingReason: ORDER_TIMELINESS_MISSING_REASON.INVALID_FINISHED_AT,
    });
  });
});

describe("G04 getOrderTimelinessFacts — pickedUpAt", () => {
  it("uses events.created_at of exactly one valid ORDER_PICKED_UP_V2", () => {
    const fact = buildSingleFact(orderRow({ status: "abgeholt" }), [pickupEventV2()]);
    expect(fact.pickedUpAt).toEqual({
      value: "2026-09-16T11:15:00.000Z",
      source: ORDER_TIMELINESS_SOURCE.PICKED_UP_AT,
      provenance: {
        kind: "event",
        relation: "public.events",
        eventId: "event-1",
        eventType: ORDER_PICKUP_EVENT_TYPE_V2,
        eventSchemaVersion: 2,
        aggregateVersion: 4,
      },
      missingReason: null,
    });
    expect(fact.consistency).toEqual([]);
  });

  it("is null with a missing reason when no pickup event exists", () => {
    const fact = buildSingleFact(orderRow(), []);
    expect(fact.pickedUpAt).toEqual({
      value: null,
      source: null,
      provenance: null,
      missingReason: ORDER_TIMELINESS_MISSING_REASON.NO_PICKUP_EVENT,
    });
  });

  it("is null with an anomaly reason when the same order carries two V2 events", () => {
    const duplicated = [
      pickupEventV2(),
      pickupEventV2({
        eventId: "event-2",
        aggregateVersion: 5,
        createdAt: new Date("2026-09-17T07:05:00.000Z"),
      }),
    ];
    const fact = buildSingleFact(orderRow({ status: "abgeholt" }), duplicated);
    expect(fact.pickedUpAt).toEqual({
      value: null,
      source: null,
      provenance: null,
      missingReason: ORDER_TIMELINESS_MISSING_REASON.AMBIGUOUS_PICKUP_EVENTS,
    });
    expect(fact.consistency).toContain(
      ORDER_TIMELINESS_CONSISTENCY.PICKED_UP_STATUS_WITHOUT_PICKUP_EVENT,
    );
  });

  it("is null with a missing reason when the single V2 event breaks the read contract", () => {
    for (const broken of [
      pickupEventV2({ status: "error" }),
      pickupEventV2({ station: "fertig" }),
      pickupEventV2({ fromStation: "galvanik" }),
      pickupEventV2({ eventSchemaVersion: 1 }),
      pickupEventV2({ aggregateVersion: 0 }),
      pickupEventV2({ createdAt: null }),
      pickupEventV2({ payloadGateAllowed: false }),
      pickupEventV2({ payloadInvoiceState: "issued" }),
      pickupEventV2({ payloadMode: "unbekannt" }),
      // Payload-Projektion vollstaendig unbelegt: entspricht dem frueheren
      // Fall eines unbrauchbaren jsonb-Payloads.
      pickupEventV2({
        payloadOrderId: null,
        payloadMode: null,
        payloadPaymentMode: null,
        payloadInvoiceState: null,
        payloadGateAllowed: null,
      }),
    ]) {
      const fact = buildSingleFact(orderRow(), [broken]);
      expect(fact.pickedUpAt).toEqual({
        value: null,
        source: null,
        provenance: null,
        missingReason: ORDER_TIMELINESS_MISSING_REASON.INVALID_PICKUP_EVENT,
      });
    }
  });

  it("names the V1 pickup contract instead of claiming there was no pickup", () => {
    const v1 = pickupEventV2({ eventType: ORDER_PICKUP_EVENT_TYPE_V1, eventSchemaVersion: 1 });
    const fact = buildSingleFact(orderRow({ status: "abgeholt" }), [v1]);
    expect(fact.pickedUpAt).toEqual({
      value: null,
      source: null,
      provenance: null,
      missingReason: ORDER_TIMELINESS_MISSING_REASON.PICKUP_CONTRACT_V1_ONLY,
    });
  });
});

describe("G04 getOrderTimelinessFacts — cancellationClass", () => {
  it("is always null with the Q-G04-002 missing reason", () => {
    const rows: OrderTimelinessOrderRow[] = [
      orderRow(),
      orderRow({ id: "order-2", orderNumber: "A-2026-0002", status: "angenommen", completedDate: null }),
      orderRow({ id: "order-3", orderNumber: "A-2026-0003", status: "abgeholt" }),
    ];
    const result = buildOrderTimelinessFacts({
      tenantId: TENANT,
      range: RANGE,
      generatedAt: GENERATED_AT,
      orders: rows,
      pickupEvents: [],
    });
    expect(result.facts).toHaveLength(3);
    for (const fact of result.facts) {
      expect(fact.cancellationClass).toEqual({
        value: null,
        source: null,
        provenance: null,
        missingReason: "Q-G04-002 In Klaerung",
      });
    }
  });
});

describe("G04 getOrderTimelinessFacts — consistency and tenant binding", () => {
  it("reports a pickup event without a finish time instead of inventing one", () => {
    const fact = buildSingleFact(
      orderRow({ status: "abgeholt", completedDate: null }),
      [pickupEventV2()],
    );
    expect(fact.finishedAt.missingReason).toBe(ORDER_TIMELINESS_MISSING_REASON.NOT_FINISHED_YET);
    expect(fact.pickedUpAt.value).toBe("2026-09-16T11:15:00.000Z");
    expect(fact.consistency).toEqual([
      ORDER_TIMELINESS_CONSISTENCY.FINISHED_STATUS_WITHOUT_COMPLETED_DATE,
      ORDER_TIMELINESS_CONSISTENCY.PICKUP_EVENT_WITHOUT_COMPLETED_DATE,
    ]);
  });

  it("reports a pickup recorded before the finish time", () => {
    const fact = buildSingleFact(
      orderRow({ status: "abgeholt", completedDate: new Date("2026-09-20T10:00:00.000Z") }),
      [pickupEventV2()],
    );
    expect(fact.consistency).toEqual([ORDER_TIMELINESS_CONSISTENCY.PICKUP_BEFORE_FINISH]);
  });

  it("fails closed when a row belongs to another tenant", () => {
    expect(() => buildOrderTimelinessFacts({
      tenantId: TENANT,
      range: RANGE,
      generatedAt: GENERATED_AT,
      orders: [orderRow({ tenantId: "other-tenant" })],
      pickupEvents: [],
    })).toThrow("ORDER_TIMELINESS_ORDER_TENANT_MISMATCH");

    expect(() => buildOrderTimelinessFacts({
      tenantId: TENANT,
      range: RANGE,
      generatedAt: GENERATED_AT,
      orders: [orderRow()],
      pickupEvents: [pickupEventV2({ tenantId: "other-tenant" })],
    })).toThrow("ORDER_TIMELINESS_EVENT_TENANT_MISMATCH");
  });

  it("returns the echoed window, a generation timestamp and a deterministic order", () => {
    const result = buildOrderTimelinessFacts({
      tenantId: TENANT,
      range: RANGE,
      generatedAt: GENERATED_AT,
      orders: [
        orderRow({ id: "order-late", orderNumber: "A-2026-0009", dueDate: new Date("2026-09-20T00:00:00.000Z") }),
        orderRow({ id: "order-early", orderNumber: "A-2026-0002", dueDate: new Date("2026-09-02T00:00:00.000Z") }),
      ],
      pickupEvents: [],
    });
    expect(result.range).toEqual(RANGE);
    expect(result.generatedAt).toBe(GENERATED_AT);
    expect(result.facts.map((fact) => fact.orderId)).toEqual(["order-early", "order-late"]);
  });
});
