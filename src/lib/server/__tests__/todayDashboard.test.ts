import { describe, expect, it } from "vitest";
import { classifyMoneyForToday, classifyOrderForToday, deriveOrderGuidance } from "@/lib/server/todayDashboardPolicy";

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
