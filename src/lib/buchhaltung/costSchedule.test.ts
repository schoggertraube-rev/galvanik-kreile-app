import { describe, expect, it } from "vitest";
import { parseCostKind, recurringCostInRange } from "@/lib/buchhaltung/costSchedule";

const base = {
  betrag: "1200.00",
  giltAb: null,
  giltBis: null,
};

describe("bookkeeping cost schedule truth", () => {
  it("recognizes only the two canonical cost kinds", () => {
    expect(parseCostKind("fix")).toBe("fix");
    expect(parseCostKind("Variabel")).toBe("variabel");
    expect(() => parseCostKind("sonstig")).toThrow("FINANCE_COST_KIND_INVALID");
  });

  it("does not multiply annual or quarterly costs as monthly costs", () => {
    expect(recurringCostInRange(
      { ...base, intervall: "jährlich" },
      "2026-01-01",
      "2026-03-31",
    )).toBe(300);
    expect(recurringCostInRange(
      { ...base, intervall: "vierteljährlich" },
      "2026-01-01",
      "2026-03-31",
    )).toBe(1200);
  });

  it("includes one-time costs only on their stored effective date", () => {
    expect(recurringCostInRange(
      { ...base, intervall: "einmalig", giltAb: "2026-02-15" },
      "2026-02-01",
      "2026-02-28",
    )).toBe(1200);
    expect(recurringCostInRange(
      { ...base, intervall: "einmalig", giltAb: "2026-02-15" },
      "2026-03-01",
      "2026-03-31",
    )).toBe(0);
  });

  it("fails closed for unsupported intervals and invalid amounts", () => {
    expect(() => recurringCostInRange(
      { ...base, intervall: "bei Bedarf" },
      "2026-01-01",
      "2026-01-31",
    )).toThrow("FINANCE_COST_INTERVAL_INVALID");
    expect(() => recurringCostInRange(
      { ...base, betrag: "kein Betrag", intervall: "monatlich" },
      "2026-01-01",
      "2026-01-31",
    )).toThrow("FINANCE_COST_AMOUNT_INVALID");
  });
});
