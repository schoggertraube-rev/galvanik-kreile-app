import { describe, expect, it } from "vitest";
import { buildWorkshopEvidence, type WorkshopEvidenceSnapshot } from "./workshopEvidence";

const PERIOD = {
  start: new Date("2026-07-01T00:00:00.000Z"),
  end: new Date("2026-08-01T00:00:00.000Z"),
  grain: "month" as const,
};

function snapshot(overrides: Partial<WorkshopEvidenceSnapshot> = {}): WorkshopEvidenceSnapshot {
  return {
    tenantId: "galvanik-kreile",
    period: PERIOD,
    calculatedAt: new Date("2026-07-22T12:00:00.000Z"),
    now: new Date("2026-07-22T12:00:00.000Z"),
    returnTo: "/performance?tile=werkstatt_puls",
    rows: [{
      id: "order-1",
      orderNumber: "A-2026-1",
      title: "Welle vernickeln",
      createdAt: new Date("2026-07-02T08:00:00.000Z"),
      intakeDate: new Date("2026-07-02T08:00:00.000Z"),
      completedDate: new Date("2026-07-04T08:00:00.000Z"),
      promisedDueDate: new Date("2026-07-05T08:00:00.000Z"),
      station: "Bad 2 / Nickel",
      active: false,
      completedInPeriod: true,
    }],
    totals: {
      completed: 1,
      completedWithDueDate: 1,
      deliveredOnTime: 1,
      completedWithCycleTime: 1,
      averageCycleDays: 2,
      deliveryReliabilityPct: 100,
      open: 0,
      overdue: 0,
      openWithoutDueDate: 0,
    },
    stations: [],
    ...overrides,
  };
}

describe("workshop evidence adapter", () => {
  it("connects calculated claims to exact order fields and a real raw-record route", () => {
    const evidence = buildWorkshopEvidence(snapshot());
    const reliability = evidence.find((item) => item.claim.id === "workshop.delivery_reliability");

    expect(reliability?.claim).toMatchObject({ state: "ready", value: 100, formulaVersion: 1 });
    expect(reliability?.sourceRecords[0]).toMatchObject({
      ref: "order:order-1",
      relation: "public.orders",
      fieldRefs: ["id", "order_number", "completed_date", "promised_due_date"],
      contribution: 1,
    });
    expect(reliability?.sourceRecords[0].detail.href).toBe(
      "/orders/order-1?returnTo=%2Fperformance%3Ftile%3Dwerkstatt_puls",
    );
  });

  it("keeps an unmeasurable KPI null and exposes the real correction path", () => {
    const missing = snapshot({
      rows: [{
        ...snapshot().rows[0],
        intakeDate: null,
        completedDate: null,
        promisedDueDate: null,
        active: true,
        completedInPeriod: false,
      }],
      totals: {
        completed: 0,
        completedWithDueDate: 0,
        deliveredOnTime: 0,
        completedWithCycleTime: 0,
        averageCycleDays: null,
        deliveryReliabilityPct: null,
        open: 1,
        overdue: 0,
        openWithoutDueDate: 1,
      },
    });

    const evidence = buildWorkshopEvidence(missing);
    const reliability = evidence.find((item) => item.claim.id === "workshop.delivery_reliability");

    expect(reliability?.claim).toMatchObject({ state: "missing_input", value: null });
    expect(reliability?.missing[0].captureOptions[0].action).toMatchObject({
      enabled: true,
      href: "/orders",
    });
  });

  it("marks an aggregate partial when not every counted record has a detail receipt", () => {
    const partial = snapshot({
      totals: {
        ...snapshot().totals,
        completed: 3,
        completedWithDueDate: 3,
        deliveredOnTime: 3,
        completedWithCycleTime: 3,
      },
    });

    const completed = buildWorkshopEvidence(partial)
      .find((item) => item.claim.id === "workshop.completed_orders");

    expect(completed?.claim.state).toBe("partial");
    expect(completed?.coverage).toMatchObject({ included: 3, unresolved: 2 });
    expect(completed?.missing[0].reasonCode).toBe("detail_receipt_limit");
  });

  it("normalizes free-form station names only for stable evidence identifiers", () => {
    const activeRow = {
      ...snapshot().rows[0],
      completedDate: null,
      promisedDueDate: null,
      active: true,
      completedInPeriod: false,
    };
    const withStation = snapshot({
      rows: [activeRow],
      totals: {
        completed: 0,
        completedWithDueDate: 0,
        deliveredOnTime: 0,
        completedWithCycleTime: 0,
        averageCycleDays: null,
        deliveryReliabilityPct: null,
        open: 1,
        overdue: 0,
        openWithoutDueDate: 1,
      },
      stations: [{ station: "Bad 2 / Nickel", count: 1 }],
    });

    const station = buildWorkshopEvidence(withStation)
      .find((item) => item.claim.id.startsWith("workshop.station."));
    expect(station?.claim.id).toBe("workshop.station.0-bad-2-nickel.open_orders");
    expect(station?.claim.label).toContain("Bad 2 / Nickel");
  });
});
