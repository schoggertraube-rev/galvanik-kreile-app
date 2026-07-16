import { describe, expect, it } from "vitest";
import {
  assertFinalizableReceipt,
  parseCostItemFormData,
  parseFinanceDate,
  parseReceiptBatchAssignment,
  parseReceiptCorrection,
} from "@/lib/buchhaltung/inputContract";

const id = "00000000-0000-4000-8000-000000000001";

describe("finance write input contract", () => {
  it("parses only exact, bounded receipt corrections", () => {
    expect(parseReceiptCorrection({
      lieferantText: "Lieferant GmbH",
      brutto: 119,
      netto: 100,
      ustBetrag: 19,
      belegdatum: "2026-07-15",
      skrKonto: "4930",
    })).toMatchObject({ brutto: "119.00", netto: "100.00", skrKonto: "4930" });
    expect(() => parseReceiptCorrection({ brutto: 1, injected: true })).toThrow("correction");
    expect(() => parseReceiptCorrection({ brutto: 1.001 })).toThrow("brutto");
    expect(() => parseReceiptCorrection({ skrKonto: "4930;DROP" })).toThrow("skrKonto");
  });

  it("rejects impossible dates and inconsistent final amounts", () => {
    expect(parseFinanceDate("2024-02-29", "date")).toBe("2024-02-29");
    expect(() => parseFinanceDate("2026-02-30", "date")).toThrow("date");
    expect(() => assertFinalizableReceipt({
      status: "erfasst",
      lieferantText: "Lieferant GmbH",
      belegdatum: "2026-07-15",
      brutto: "120.00",
      netto: "100.00",
      ustBetrag: "19.00",
      skrKonto: "4930",
    })).toThrow("AMOUNTS_INCONSISTENT");
  });

  it("requires reviewed state and a real ledger account before finalization", () => {
    expect(() => assertFinalizableReceipt({
      status: "pruefen",
      lieferantText: "Lieferant GmbH",
      belegdatum: "2026-07-15",
      brutto: "119.00",
      netto: "100.00",
      ustBetrag: "19.00",
      skrKonto: "4930",
    })).toThrow("REVIEW_REQUIRED");
    expect(() => assertFinalizableReceipt({
      status: "erfasst",
      lieferantText: "Lieferant GmbH",
      belegdatum: "2026-07-15",
      brutto: "119.00",
      netto: "100.00",
      ustBetrag: "19.00",
      skrKonto: null,
    })).toThrow("INCOMPLETE:account");
  });

  it("bounds batch assignments and rejects duplicate identities", () => {
    expect(parseReceiptBatchAssignment([id], { kontoId: id })).toEqual({
      ids: [id],
      updates: { kontoId: id },
    });
    expect(() => parseReceiptBatchAssignment([id, id], { kontoId: id })).toThrow("belegIds");
    expect(() => parseReceiptBatchAssignment([id], {})).toThrow("assignment");
  });

  it("parses cost items without accepting demo flags or numeric suffixes", () => {
    const valid = new FormData();
    valid.set("bezeichnung", "Hallenmiete");
    valid.set("art", "fix");
    valid.set("betrag", "1200,50");
    valid.set("intervall", "monatlich");
    expect(parseCostItemFormData(valid)).toMatchObject({ betrag: "1200.50", kategorie: null });

    const trailing = new FormData();
    trailing.set("bezeichnung", "Hallenmiete");
    trailing.set("art", "fix");
    trailing.set("betrag", "1200abc");
    trailing.set("intervall", "monatlich");
    expect(() => parseCostItemFormData(trailing)).toThrow("betrag");

    valid.set("isDemo", "true");
    expect(() => parseCostItemFormData(valid)).toThrow("cost_item");
  });
});
