import { captureRecognition, concernForCaptureKind, recognizeCaptureDocument } from "../captureRecognition";
import { expect, it } from "vitest";
import { INTAKE_CONCERN_AREAS } from "../intakeLifecycleContract";

it("uses the agreed set of intake concerns and document types", () => {
  expect(Object.keys(INTAKE_CONCERN_AREAS).sort()).toEqual([
    "reklamation", "kv_annahme", "kv_ablehnung", "termin", "zahlung", "abholung", "nachfrage", "kv_anfrage", "rechnung",
    "rueckruf", "frist", "aufgabe", "aenderung", "hinweis", "ware", "abholung_durch", "preis_einwand", "kundendaten",
    "quittung", "kontakt", "ware_ohne_bezug", "kein_vorgang", "badanalyse", "nachweis", "sicherheitsdatenblatt", "zaehlerstand",
    "werbung", "sonstiges", "lieferschein", "zahlungsavis", "kontobeleg",
  ].sort());
  expect(INTAKE_CONCERN_AREAS).toMatchObject({
    quittung: ["zahlungen"], kontakt: ["kunden"], ware_ohne_bezug: ["eingang"], kein_vorgang: [],
    badanalyse: [], nachweis: [], sicherheitsdatenblatt: [], zaehlerstand: [], werbung: [], sonstiges: [],
    lieferschein: ["eingang"], zahlungsavis: ["zahlungen"], kontobeleg: ["zahlungen"],
  });
});


it.each([
  ["Lieferschein 431\nAbsender: TEST-Betrieb", "lieferschein", "lieferschein"],
  ["Quittung 717\nTEST-Kauf", "quittung", "quittung"],
  ["Kassenbon\nTEST-Kauf", "quittung", "quittung"],
  ["DHL\nSendungsnummer 21452", "ware", "ware"],
  ["Anfrage für TEST-Teile", "anfrage", "kv_anfrage"],
  ["Der Lieferschein wird nachgereicht.", "dokument", null],
  ["Lieferschein\nQuittung", "dokument", null],
  ["", "unklar", null],
] as const)("bindet erkannte Belegart an das vorhandene Anliegen: %s", (text, kind, concern) => {
  const result = recognizeCaptureDocument({ text });
  expect(result.kind).toBe(kind);
  expect(concernForCaptureKind(result.kind)).toBe(concern);
});

it("behält die vorhandene Ansicht für den erkannten Lieferschein", () => {
  expect(captureRecognition({ text: "Lieferschein 431" })).toMatchObject({ kind: "dokument" });
});
