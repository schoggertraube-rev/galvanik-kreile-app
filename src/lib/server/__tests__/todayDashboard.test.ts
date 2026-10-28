import { describe, expect, it } from "vitest";
import { classifyMoneyForToday, classifyOrderForToday, defaultTodayLayout, deriveOrderGuidance, deriveTodayReminder, filterTodayLayout, isBundleStationForToday, parseTodayLayout } from "@/lib/server/todayDashboardPolicy";

const TODAY = "2026-10-28";

function order(overrides: Partial<Parameters<typeof classifyOrderForToday>[0]> = {}) {
  return {
    dueDate: `${TODAY}T00:00:00.000Z`,
    risk: "green",
    station: "fertig",
    status: "fertig",
    ...overrides,
  };
}

describe("classifyOrderForToday", () => {
  it("shows only a finished order due today in Heute fällig", () => {
    expect(classifyOrderForToday(order(), TODAY)).toBe("today");
    expect(classifyOrderForToday(order({ station: "galvanik", status: "galvanik" }), TODAY)).toBe("action");
  });

  it("moves overdue and risky orders to Handlungsbedarf", () => {
    expect(classifyOrderForToday(order({ dueDate: "2026-10-27T00:00:00.000Z" }), TODAY)).toBe("action");
    expect(classifyOrderForToday(order({ risk: "blocked" }), TODAY)).toBe("action");
  });

  it("gives each current action case a reason and one concrete primary action", () => {
    expect(deriveOrderGuidance(order({ station: "galvanik", status: "galvanik" }), TODAY)).toMatchObject({ reason: "due_today", primaryActionLabel: "Fertig melden" });
    expect(deriveOrderGuidance(order({ dueDate: "2026-10-27T00:00:00.000Z" }), TODAY)).toMatchObject({ reason: "finished_overdue", primaryActionLabel: "Ware raus" });
    expect(deriveOrderGuidance(order({ dueDate: "2026-10-30T00:00:00.000Z", station: "wareneingang", status: "angenommen", risk: "yellow" }), TODAY)).toMatchObject({ reason: "tight_schedule", primaryActionLabel: "Kunde vorwarnen" });
    expect(deriveOrderGuidance(order({ dueDate: "2026-10-30T00:00:00.000Z", station: "galvanik", status: "galvanik", risk: "blocked" }), TODAY)).toMatchObject({ reason: "reported_risk", primaryActionLabel: "Problem lösen" });
  });

  it("excludes collected, shipped, completed, and future healthy orders", () => {
    for (const terminal of ["abgeholt", "versendet", "raus", "completed", "erledigt"]) {
      expect(classifyOrderForToday(order({ station: terminal, status: terminal }), TODAY)).toBeNull();
    }
    expect(classifyOrderForToday(order({ dueDate: "2026-10-29T00:00:00.000Z" }), TODAY)).toBeNull();
  });
});

describe("classifyMoneyForToday", () => {
  const invoice = { customerCountry: "Deutschland", dueDate: "2026-10-27", goodsOutRecorded: false, paymentMode: "rechnung", paymentStatus: "offen", station: "fertig" };

  it("shows only overdue open invoices", () => {
    expect(classifyMoneyForToday(invoice, TODAY)).toBe("overdue_invoice");
    expect(classifyMoneyForToday({ ...invoice, dueDate: TODAY }, TODAY)).toBeNull();
    expect(classifyMoneyForToday({ ...invoice, dueDate: "2026-10-29" }, TODAY)).toBeNull();
    expect(classifyMoneyForToday({ ...invoice, paymentStatus: "bezahlt" }, TODAY)).toBeNull();
  });

  it("shows open prepayment only for finished domestic orders before goods out", () => {
    expect(classifyMoneyForToday({ ...invoice, dueDate: null, paymentMode: "vorkasse", paymentStatus: null }, TODAY)).toBe("open_prepayment");
    expect(classifyMoneyForToday({ ...invoice, paymentMode: "vorkasse", paymentStatus: "bezahlt" }, TODAY)).toBeNull();
    expect(classifyMoneyForToday({ ...invoice, paymentMode: "vorkasse", station: "galvanik" }, TODAY)).toBeNull();
    expect(classifyMoneyForToday({ ...invoice, paymentMode: "vorkasse", customerCountry: "AT" }, TODAY)).toBeNull();
    expect(classifyMoneyForToday({ ...invoice, paymentMode: "vorkasse", goodsOutRecorded: true }, TODAY)).toBeNull();
  });
});

describe("isBundleStationForToday", () => {
  it("allows only Wareneingang and Galvanik stations", () => {
    for (const station of ["angenommen", "wareneingang", "eingang", "galvanik"]) expect(isBundleStationForToday(station)).toBe(true);
    for (const station of ["kv", "fertig", "abgeholt", "versendet"]) expect(isBundleStationForToday(station)).toBe(false);
  });
});

describe("Der-Tag layout policy", () => {
  const allowed = new Set(["action", "today", "assign", "money"] as const);

  it("uses the role template and removes fields without an access area", () => {
    expect(defaultTodayLayout("meister", allowed)).toEqual([
      { field: "action", column: "left", order: 0 },
      { field: "assign", column: "left", order: 1 },
      { field: "today", column: "right", order: 2 },
      { field: "money", column: "right", order: 3 },
    ]);
    expect(filterTodayLayout([...defaultTodayLayout("werkstatt", new Set(["action", "today", "bundle"])), { field: "money", column: "right", order: 3 }], allowed)).not.toContainEqual(expect.objectContaining({ field: "bundle" }));
  });

  it("accepts only a complete unique layout beginning with Handlungsbedarf", () => {
    const valid = [{ field: "action", column: "left", order: 0 }, { field: "today", column: "right", order: 1 }];
    expect(parseTodayLayout(valid)).toEqual(valid);
    expect(parseTodayLayout([{ field: "today", column: "right", order: 0 }])).toBeNull();
    expect(parseTodayLayout([...valid, { field: "today", column: "left", order: 2 }])).toBeNull();
    expect(parseTodayLayout([{ field: "action", column: "left", order: 1 }])).toBeNull();
  });
});

describe("Später in Europe/Berlin", () => {
  it("uses 14:00 Berlin in summer and hides the option after the deadline", () => {
    expect(deriveTodayReminder("afternoon", "2026-07-03", new Date("2026-07-01T08:00:00.000Z"))).toMatchObject({
      until: new Date("2026-07-01T12:00:00.000Z"),
      message: "Aufgeschoben bis heute 14:00 · zählt weiter mit",
    });
    expect(deriveTodayReminder("afternoon", "2026-07-03", new Date("2026-07-01T12:01:00.000Z"))).toBeNull();
  });

  it("uses the next workday at 07:00 across the daylight-saving boundary", () => {
    expect(deriveTodayReminder("tomorrow", "2026-04-03", new Date("2026-03-27T09:00:00.000Z"))).toMatchObject({
      until: new Date("2026-03-30T05:00:00.000Z"),
      message: "Aufgeschoben bis Mo 07:00 · zählt weiter mit",
    });
  });

  it("does not move an item beyond a reached due date", () => {
    const now = new Date("2026-10-28T08:00:00.000Z");
    expect(deriveTodayReminder("tomorrow", "2026-10-28", now)).toBeNull();
    expect(deriveTodayReminder("after_due", "2026-10-27", now)).toBeNull();
    expect(deriveTodayReminder("after_due", "2026-10-30", now)).toMatchObject({
      until: new Date("2026-11-02T06:00:00.000Z"),
      message: "Aufgeschoben bis 02.11.2026 07:00 · zählt weiter mit",
    });
  });
});
