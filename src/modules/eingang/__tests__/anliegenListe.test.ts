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
