import {intakeHandoverDirective} from "../intakeLifecycleContract";
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
  it("uses the persisted routing decision without presenting it as OCR text", () => {
    expect(captureRecognition({ ...base, suggestions: [{ field: "art", value: "anfrage", status: "uebernommen" }] }))
      .toEqual({ kind: "anfrage", text: "", source: "hand" });
  });
  it("keeps partial original text and ignores a discarded routing decision", () => {
    expect(captureRecognition({ ...base, suggestions: [
      { field: "art", value: "rechnung", status: "verworfen" },
      { field: "art", value: "ware", status: "uebernommen" },
      { field: "DOCUMENT_TEXT", value: "SYNTHETISCH unvollständige Anschrift", status: "offen" },
    ] })).toEqual({ kind: "ware", text: "SYNTHETISCH unvollständige Anschrift", source: "hand" });
  });
  it("keeps a structured invoice in the invoice flow without relying on OCR words", () => {
    expect(captureRecognition({ ...base, suggestions: [{ field: "rechnung.nummer", value: "SYNTHETISCH-XML-1", status: "offen" }] }))
      .toEqual({ kind: "rechnung", text: "SYNTHETISCH-XML-1" });
  });
  it("does not hide a saved invoice concern behind an earlier manual routing choice", () => {
    expect(captureRecognition({ ...base, concerns: ["rechnung"], suggestions: [{ field: "art", value: "anfrage", status: "uebernommen" }] }))
      .toEqual({ kind: "rechnung", text: "" });
  });
});

describe('AF19 conservative handover directive',()=>{
 it.each(['Hole ich ab.','Ich hole die Ware ab.','Bitte abholen.'])('recognizes clear pickup %s',text=>expect(intakeHandoverDirective(text)).toEqual({mode:'pickup',forFuture:false}));
 it('changes the future default only when explicit',()=>{expect(intakeHandoverDirective('Ab jetzt immer abholen.')).toEqual({mode:'pickup',forFuture:true});expect(intakeHandoverDirective('Bitte versenden.')).toEqual({mode:'shipping',forFuture:false});});
 it.each(['Nicht abholen.','Vielleicht abholen.','Falls Versand, hole ich ab.','Abholen oder versenden?','> Hole ich ab.','Von: alter Kunde\nBitte versenden.'])('does not guess from negation, ambiguity or quoted mail %s',text=>expect(intakeHandoverDirective(text)).toBeNull());
});
