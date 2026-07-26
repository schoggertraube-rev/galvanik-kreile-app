import { describe, expect, it } from "vitest";
import { normalizeSupplierName, parseOcrResult, parseStoredOcrPositions } from "@/lib/ocr/resultContract";

const valid = {
  lieferant: " Lieferant GmbH ",
  datum: "2026-07-15",
  brutto: 119,
  netto: 100,
  ustSatz: 19,
  ustBetrag: 19,
  positionen: [{ beschreibung: "Teil", menge: 1, einzelpreis: 100, betrag: 100 }],
  belegart: "rechnung",
  zahlungsart: "Überweisung",
  rechnungsnummer: "R-42",
  confidence: 0.91,
  rohtext: "Lieferant GmbH Rechnung",
  actualUnits: 123,
  providerStatus: "provider-v1",
};

describe("OCR result truth contract", () => {
  it("normalizes legacy fractional confidence into canonical percent", () => {
    expect(parseOcrResult(valid)).toMatchObject({
      lieferant: "Lieferant GmbH",
      zahlungsart: "ueberweisung",
      confidence: 91,
    });
  });

  it.each([
    { ...valid, hidden: true },
    { ...valid, datum: "2026-02-31" },
    { ...valid, confidence: 101 },
    { ...valid, brutto: -1 },
    { ...valid, positionen: [{ beschreibung: "", betrag: 10 }] },
    { ...valid, actualUnits: 1.5 },
  ])("rejects malformed, implausible or over-posted output %#", (value) => {
    expect(() => parseOcrResult(value)).toThrow("OCR_RESULT_INVALID");
  });

  it("builds an exact supplier lookup key without wildcard matching", () => {
    expect(normalizeSupplierName("  Müller & Söhne GmbH  ")).toBe("muller sohne gmbh");
  });

  it("validates stored OCR positions without promoting them to ledger positions", () => {
    expect(parseStoredOcrPositions(valid.positionen)).toEqual([{
      beschreibung: "Teil",
      menge: 1,
      einzelpreis: 100,
      betrag: 100,
    }]);
    expect(() => parseStoredOcrPositions([{ beschreibung: "Teil", betrag: "100" }]))
      .toThrow("OCR_RESULT_INVALID");
  });
});
