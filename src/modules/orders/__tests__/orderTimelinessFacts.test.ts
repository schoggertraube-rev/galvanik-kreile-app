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
    // Voreinstellung ohne Legacy-Termin: das ist der Normalfall in
    // public.orders und erzeugt keinen Konsistenzhinweis.
    promisedDateLegacyClass: "nur_due_date",
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

/**
 * Ein vertragsgueltiges ORDER_PICKED_UP_V1-Ereignis. V1 ist kein Altschema,
 * sondern der heute aktive Zweig von recordGoodsOutCommand fuer "Rechnung bereits
 * gestellt"; die Felder folgen events_order_picked_up_v1_contract_chk
 * (supabase/migrations/20260905100000_f1_5_payment_goods_out_contract.sql):
 * event_schema_version = 1, und der Payload ist auf genau sieben Schluessel
 * festgeschrieben — `invoiceState` ist keiner davon, die View liefert dort NULL.
 */
function pickupEventV1(
  overrides: Partial<OrderTimelinessPickupEventRow> = {},
): OrderTimelinessPickupEventRow {
  return {
    eventId: "event-v1",
    orderId: ORDER_ID,
    tenantId: TENANT,
    eventType: ORDER_PICKUP_EVENT_TYPE_V1,
    status: "success",
    station: "abgeholt",
    fromStation: "fertig",
    eventSchemaVersion: 1,
    aggregateVersion: 4,
    payloadOrderId: ORDER_ID,
    payloadMode: "abholung",
    payloadPaymentMode: "rechnung",
    payloadInvoiceState: null,
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
    // Unveraendertes Verhalten fuer den Fall "genau ein GUELTIGES V1, kein V2":
    // benannter Altvertrag, weiterhin kein Wert
    // (_MODULDOSSIERS/G04_AUFTRAEGE/04_SCHNITTSTELLEN_DATEN.md §Soll-Ist Punkt 3,
    // T-G04-021 — ein valides V1 belegt pickedUpAt NICHT).
    const fact = buildSingleFact(orderRow({ status: "abgeholt" }), [pickupEventV1()]);
    expect(fact.pickedUpAt).toEqual({
      value: null,
      source: null,
      provenance: null,
      missingReason: ORDER_TIMELINESS_MISSING_REASON.PICKUP_CONTRACT_V1_ONLY,
    });
  });

  it("calls a structurally broken V1 invalid instead of a valid legacy contract", () => {
    // Ohne eine eigene V1-Gueltigkeitspruefung war JEDES V1-Ereignis
    // PICKUP_CONTRACT_V1_ONLY — also als gueltiger Altvertrag ausgewiesen, auch
    // wenn es seinen eigenen DB-Check verletzt. Jede Zeile hier bricht genau eine
    // Bedingung aus events_order_picked_up_v1_contract_chk.
    for (const broken of [
      pickupEventV1({ status: "error" }),
      pickupEventV1({ station: "fertig" }),
      pickupEventV1({ fromStation: "galvanik" }),
      pickupEventV1({ eventSchemaVersion: 2 }),
      pickupEventV1({ eventSchemaVersion: null }),
      pickupEventV1({ aggregateVersion: 0 }),
      pickupEventV1({ aggregateVersion: null }),
      pickupEventV1({ eventId: "" }),
      pickupEventV1({ payloadOrderId: "order-other" }),
      pickupEventV1({ payloadOrderId: null }),
      pickupEventV1({ payloadGateAllowed: false }),
      pickupEventV1({ payloadGateAllowed: null }),
      pickupEventV1({ payloadPaymentMode: "barzahlung" }),
      pickupEventV1({ payloadPaymentMode: null }),
      pickupEventV1({ payloadMode: "unbekannt" }),
      pickupEventV1({ payloadMode: null }),
      pickupEventV1({ createdAt: null }),
      // Ein V1 MIT invoiceState ist ein falsch getyptes V2: der V1-Check
      // schreibt den Payload auf genau sieben Schluessel fest, invoiceState ist
      // keiner davon.
      pickupEventV1({ payloadInvoiceState: "not_issued" }),
    ]) {
      const fact = buildSingleFact(orderRow({ status: "abgeholt" }), [broken]);
      expect({
        broken: JSON.stringify(broken),
        pickedUpAt: fact.pickedUpAt,
      }).toEqual({
        broken: JSON.stringify(broken),
        pickedUpAt: {
          value: null,
          source: null,
          provenance: null,
          missingReason: ORDER_TIMELINESS_MISSING_REASON.INVALID_PICKUP_EVENT,
        },
      });
    }
  });

  it("does not gate V1 validity on the finance fields the read contract omits", () => {
    // Gegenprobe zum Test darueber: paymentStatus und openAmountCents sind aus
    // der View entfernt (Finanzgatterung) und duerfen die Gueltigkeit eines
    // ZEITPUNKTS nicht bestimmen. Alle drei laut DB-Check erlaubten Zahlarten
    // bleiben deshalb gueltige V1-Ereignisse.
    for (const paymentMode of ["vorkasse", "abholung", "rechnung"]) {
      const fact = buildSingleFact(
        orderRow({ status: "abgeholt" }),
        [pickupEventV1({ payloadPaymentMode: paymentMode })],
      );
      expect({ paymentMode, missingReason: fact.pickedUpAt.missingReason }).toEqual({
        paymentMode,
        missingReason: ORDER_TIMELINESS_MISSING_REASON.PICKUP_CONTRACT_V1_ONLY,
      });
    }
  });

  it("reports a mixed valid V1 and V2 as ambiguous instead of silently dropping the V1", () => {
    // V1 und V2 sind gleichrangige, heute beide aktive Ausgaenge desselben
    // Commands. Vorher gewann das V2 stillschweigend, obwohl zwei V2 korrekt als
    // Anomalie gelten — derselbe Widerspruch, nur unsichtbar.
    const fact = buildSingleFact(
      orderRow({ status: "abgeholt" }),
      [pickupEventV1(), pickupEventV2()],
    );
    expect(fact.pickedUpAt).toEqual({
      value: null,
      source: null,
      provenance: null,
      missingReason: ORDER_TIMELINESS_MISSING_REASON.AMBIGUOUS_PICKUP_EVENTS,
    });
  });

  it("reports two valid V1 events as ambiguous although no unique index blocks them", () => {
    // events_goods_out_order_version_v2_uidx deckt nur V2 ab; fuer V1 existiert
    // kein Unique-Index. Ein zweites V1 war deshalb unsichtbar.
    const fact = buildSingleFact(orderRow({ status: "abgeholt" }), [
      pickupEventV1(),
      pickupEventV1({
        eventId: "event-v1-zwei",
        aggregateVersion: 5,
        createdAt: new Date("2026-09-17T07:05:00.000Z"),
      }),
    ]);
    expect(fact.pickedUpAt).toEqual({
      value: null,
      source: null,
      provenance: null,
      missingReason: ORDER_TIMELINESS_MISSING_REASON.AMBIGUOUS_PICKUP_EVENTS,
    });
  });

  it("keeps the V2 value when the accompanying V1 is broken and cannot be counted", () => {
    // Abgrenzung: nur GUELTIGE Ereignisse zaehlen fuer die Mehrdeutigkeit. Ein
    // kaputtes V1 neben einem heilen V2 darf den belegten Zeitpunkt nicht
    // entwerten.
    const fact = buildSingleFact(
      orderRow({ status: "abgeholt" }),
      [pickupEventV1({ status: "error" }), pickupEventV2()],
    );
    expect(fact.pickedUpAt.value).toBe("2026-09-16T11:15:00.000Z");
    expect(fact.pickedUpAt.missingReason).toBeNull();
  });
});

describe("G04 getOrderTimelinessFacts — Legacy-Terminfeld promised_due_date", () => {
  it("flags a conflicting legacy date without changing the promised date", () => {
    // F-G04-007 / A-G04-008: der Widerspruch wird AUSGEWIESEN. K-G04-008: keine
    // automatische Wahl — promisedDate bleibt unveraendert aus orders.due_date.
    const fact = buildSingleFact(orderRow({ promisedDateLegacyClass: "widerspruechlich" }));
    expect(fact.consistency).toContain(
      ORDER_TIMELINESS_CONSISTENCY.PROMISED_DATE_LEGACY_CONFLICT,
    );
    expect(fact.promisedDate).toEqual({
      value: "2026-09-15",
      source: ORDER_TIMELINESS_SOURCE.PROMISED_DATE,
      provenance: { kind: "column", relation: "public.orders", column: "due_date" },
      missingReason: null,
    });
  });

  it("flags a legacy-only date and still refuses to read it as the promised date", () => {
    const fact = buildSingleFact(orderRow({
      promisedDateLegacyClass: "nur_promised",
      dueDate: null,
    }));
    expect(fact.consistency).toContain(
      ORDER_TIMELINESS_CONSISTENCY.PROMISED_DATE_ONLY_LEGACY,
    );
    // Kein Ersatzwert aus dem Legacy-Feld: der bestaetigte Termin bleibt leer.
    expect(fact.promisedDate).toEqual({
      value: null,
      source: null,
      provenance: null,
      missingReason: ORDER_TIMELINESS_MISSING_REASON.INVALID_PROMISED_DATE,
    });
  });

  it("stays silent when both dates agree or no legacy date exists", () => {
    for (const legacyClass of ["gleich", "nur_due_date"]) {
      const fact = buildSingleFact(orderRow({ promisedDateLegacyClass: legacyClass }));
      expect({ legacyClass, consistency: fact.consistency })
        .toEqual({ legacyClass, consistency: [] });
    }
  });

  it("fails closed on a legacy class the read contract never declared", () => {
    for (const legacyClass of ["unbekannt", "", "GLEICH", null]) {
      expect(() => buildSingleFact(orderRow({ promisedDateLegacyClass: legacyClass })))
        .toThrow("ORDER_TIMELINESS_LEGACY_CLASS_INVALID");
    }
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
