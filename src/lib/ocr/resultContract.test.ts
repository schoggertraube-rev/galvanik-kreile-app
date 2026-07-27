import { describe, expect, it } from "vitest";
import {
  normalizeSupplierName,
  ocrResultForLedger,
  parseFractionalProviderOcrResult,
  parseOcrReplayResult,
  parseOcrResult,
  parseStoredOcrPositions,
} from "@/lib/ocr/resultContract";

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
  confidence: 0.5,
  rohtext: "Lieferant GmbH Rechnung",
  actualUnits: 123,
  providerStatus: "provider-v1",
};

describe("OCR result truth contract", () => {
  it("keeps canonical sub-one percentages unchanged", () => {
    expect(parseOcrResult(valid)).toMatchObject({
      lieferant: "Lieferant GmbH",
      zahlungsart: "ueberweisung",
      confidence: 0.5,
    });
  });

  it.each([
    [0.005, 0.5],
    [0.01, 1],
    [0.91, 91],
  ])("normalizes an explicitly fractional provider value %s exactly once", (fraction, percent) => {
    expect(parseFractionalProviderOcrResult({ ...valid, confidence: fraction }).confidence).toBe(percent);
  });

  it("versions canonical replay data and rejects ambiguous legacy replay values", () => {
    const parsed = parseOcrResult(valid);
    expect(parseOcrReplayResult(ocrResultForLedger(parsed)).confidence).toBe(0.5);
    expect(() => parseOcrReplayResult(valid)).toThrow("OCR_REPLAY_RESULT_INVALID");
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
