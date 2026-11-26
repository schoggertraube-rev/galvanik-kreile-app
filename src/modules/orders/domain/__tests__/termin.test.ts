import { expect, test } from "vitest";
import { berlinCalendarDay } from "@/lib/domain/workingDays";
import { fertigtermin, zeigeFertigtermin } from "../termin";

const kalender = { betriebsruhe: new Set<string>(), versandpufferArbeitstage: 2, knappAbArbeitstagen: 2 };
const versand = { dueDate: "2026-11-27", handoverMode: "shipping" } as const;
const abholung = { ...versand, handoverMode: "pickup" } as const;

test("Versandpuffer zieht zwei Arbeitstage vom Liefertermin ab", () => {
  expect(fertigtermin(versand, kalender, "2026-11-23")).toEqual({ fertigtermin: "2026-11-25", stufe: "knapp" });
  expect(fertigtermin(versand, { ...kalender, betriebsruhe: new Set(["2026-11-26"]) }, "2026-11-23"))
    .toEqual({ fertigtermin: "2026-11-24", stufe: "knapp" });
  expect(fertigtermin(versand, { ...kalender, versandpufferArbeitstage: 0 }, "2026-11-23"))
    .toEqual({ fertigtermin: "2026-11-27", stufe: "im_plan" });
});

test("Bei Abholung gilt der Liefertermin und die Schwelle kommt aus dem Kalender", () => {
  expect(fertigtermin(abholung, kalender, "2026-11-23")).toEqual({ fertigtermin: "2026-11-27", stufe: "im_plan" });
  expect(fertigtermin(abholung, { ...kalender, knappAbArbeitstagen: 4 }, "2026-11-23"))
    .toEqual({ fertigtermin: "2026-11-27", stufe: "knapp" });
  expect(fertigtermin(abholung, kalender, "2026-11-28"))
    .toEqual({ fertigtermin: "2026-11-27", stufe: "ueberfaellig" });
});

test("Ohne Liefertermin ist der Fertigtermin unbekannt", () => {
  expect(fertigtermin({ ...versand, dueDate: null }, kalender, "2026-11-23"))
    .toEqual({ fertigtermin: null, stufe: "unbekannt" });
  expect(fertigtermin(versand, { ...kalender, knappAbArbeitstagen: null }, "2026-11-23"))
    .toEqual({ fertigtermin: null, stufe: "unbekannt", fehlendeEinstellungen: ["terminschwelle"] });
  expect(zeigeFertigtermin(versand, { ...kalender, betriebsruhe: null }, "2026-11-23", false))
    .toMatchObject({
      risk: "unknown",
      dueValue: "Die Terminbewertung fehlt. Hinterlege die Betriebsruhe in den Firmeneinstellungen.",
    });
});
test('zeigt den Versand-Fertigtermin in Arbeitstagen und die Betriebsruhe', () => {
  const abholung = { dueDate:'2026-11-27', handoverMode:'pickup' } as const;
  const versand = {...abholung, handoverMode:'shipping' as const};
  expect(zeigeFertigtermin(versand, kalender, '2026-11-24', false))
    .toMatchObject({risk:'orange', statusText:'Gefährdet', dueValue:'Fällig in 1 Arbeitstag'});
  expect(zeigeFertigtermin(versand, {...kalender,betriebsruhe:new Set(['2026-11-26'])}, '2026-11-24', false))
    .toMatchObject({risk:'orange', dueValue:'Heute fällig'});
  expect(zeigeFertigtermin(abholung, kalender, '2026-11-24', false))
    .toMatchObject({risk:'green', statusText:'Im Plan', dueValue:'Fällig in 3 Arbeitstagen'});
  expect(zeigeFertigtermin(versand, kalender, '2026-11-26', false))
    .toMatchObject({risk:'red', statusText:'Kritisch / Überfällig', dueValue:'Überfällig seit 1 Arbeitstag'});
});

test('zeigt das Datum, wenn zwischen den Tagen kein Arbeitstag liegt', () => {
  expect(zeigeFertigtermin({dueDate:'2026-11-28',handoverMode:'pickup'}, kalender, '2026-11-27', false))
    .toMatchObject({risk:'orange', dueValue:'28.11.2026'});
});

test('lässt eine fehlende Zusage offen und zeigt einen belegten Freigabestopp an', () => {
  const auftrag = {dueDate:null,handoverMode:'pickup'} as const;
  expect(zeigeFertigtermin(auftrag,kalender,'2026-11-25',false))
    .toMatchObject({risk:'unknown', statusText:'Termin nicht erfasst', dueValue:'Nicht erfasst'});
  expect(zeigeFertigtermin(auftrag,kalender,'2026-11-25',true))
    .toMatchObject({risk:'blocked', statusText:'Wartet auf Freigabe', dueValue:'Freigabe'});
});

test.each([null, "", "  ", "ungültig"])("Zeigt für %s keinen Fertigtermin", dueDate => {
  expect(zeigeFertigtermin({ ...abholung, dueDate }, kalender, "2026-11-20", false)).toMatchObject({ risk: "unknown" });
});

test.each([
  ["2026-01-15T22:30:00Z", "2026-01-17", "knapp"],
  ["2026-01-15T23:30:00Z", "2026-01-15", "ueberfaellig"],
  ["2026-07-15T21:30:00Z", "2026-07-17", "knapp"],
  ["2026-07-15T22:30:00Z", "2026-07-15", "ueberfaellig"],
])("Berechnet die Stufe um %s nach dem Berliner Kalendertag", (jetzt, dueDate, stufe) => {
  expect(fertigtermin({ ...abholung, dueDate }, kalender, berlinCalendarDay(new Date(jetzt)))).toMatchObject({ stufe });
});
