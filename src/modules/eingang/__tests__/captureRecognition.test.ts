import { describe, expect, it } from "vitest";
import { captureRecognition } from "../captureRecognition";
import type { IntakeCapture } from "../captureContract";

describe("P63: result derived from the one saved capture", () => {
  const base: IntakeCapture = { id: "synthetic-p63-only", version: 1, text: null, customerId: null, orderId: null, assignment: "offen", usage: "offen", concerns: [], files: [] };
  it("does not call actual OCR text unclear just because the original is a file", () => {
    const capture: IntakeCapture = { ...base, suggestions: [{ id: "synthetic-suggestion", fileId: "synthetic-file", orderId: null, field: "DOCUMENT_TEXT", value: "SYNTHETISCH Rechnung · Rechnungsnummer TEST-P63", confidence: "vorschlag", rule: "datei", reason: "Dokumenterkennung", source: { page: 1 }, status: "offen" }] };
    expect(captureRecognition(capture)).toEqual({ kind: "rechnung", text: "SYNTHETISCH Rechnung · Rechnungsnummer TEST-P63" });
  });
  it("keeps a genuinely empty recognition unclear", () => {
    expect(captureRecognition(base)).toEqual({ kind: "unklar", text: "" });
  });
});
