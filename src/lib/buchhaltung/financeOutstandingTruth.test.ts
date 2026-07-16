import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateOutstandingAmount } from "@/lib/buchhaltung/types";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("finance outstanding amount truth", () => {
  it("calculates unpaid, partial, and overpaid invoices without negative balances", () => {
    expect(calculateOutstandingAmount({ brutto: 1_000, bezahltBetrag: 0, status: "offen" })).toBe(1_000);
    expect(calculateOutstandingAmount({ brutto: 1_000, bezahltBetrag: 250, status: "teilbezahlt" })).toBe(750);
    expect(calculateOutstandingAmount({ brutto: 1_000, bezahltBetrag: 1_200, status: "teilbezahlt" })).toBe(0);
  });

  it("never reports paid or cancelled invoices as outstanding", () => {
    expect(calculateOutstandingAmount({ brutto: 1_000, bezahltBetrag: 0, status: "bezahlt" })).toBe(0);
    expect(calculateOutstandingAmount({ brutto: 1_000, bezahltBetrag: 0, status: "storniert" })).toBe(0);
  });

  it("rejects invalid negative or non-finite finance evidence", () => {
    expect(() => calculateOutstandingAmount({ brutto: -1, status: "offen" })).toThrow("FINANCE_DATA_INVALID");
    expect(() => calculateOutstandingAmount({ brutto: 10, bezahltBetrag: Number.NaN, status: "offen" })).toThrow("FINANCE_DATA_INVALID");
  });

  it("maps paid amounts and includes partial invoices in the open-items query", () => {
    const actions = source("src/app/buchhaltung/actions.ts");
    expect(actions).toContain("bezahlt_betrag_eur");
    expect(actions).toContain("bezahltBetrag");
    expect(actions).toContain("offenerBetrag");
    expect(actions).toContain("['offen', 'teilbezahlt', 'ueberfaellig', 'gemahnt']");
  });

  it("uses remaining amounts in both invoice-page and analysis aggregates", () => {
    const page = source("src/app/buchhaltung/rechnungen/page.tsx");
    const analysis = source("src/app/buchhaltung/analysis.actions.ts");
    expect(page).toContain("i.offenerBetrag");
    expect(analysis).toContain("r.offenerBetrag");
    expect(analysis).toContain("invoice.offenerBetrag");
    expect(analysis).not.toContain("offene.reduce((s, r) => s + (Number(r.brutto)");
  });
});
