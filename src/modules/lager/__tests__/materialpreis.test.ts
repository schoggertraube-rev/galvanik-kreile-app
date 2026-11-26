import { expect, test } from "vitest";
import { invoiceElectronicUnit, invoiceElectronicUnitLabel } from "@/lib/domain/invoiceElectronicFields";
import { fasseMaterialpositionenZusammen, lagerRechnungseinheit, materialPositionsbetragCent, materialVerkaufspreis } from "../materialpreis";

test("Der eingefrorene Aufschlag bestimmt den Stückpreis und die Rechnungsposition", () => {
  const vk = materialVerkaufspreis("3.40", "20");
  expect(vk).toBe("4.0800");
  expect(materialPositionsbetragCent(vk, "2")).toBe(816);
});

test("Kleine Einheitspreise bleiben vierstellig und erst die gesamte Position wird auf Cent gerundet", () => {
  const vk = materialVerkaufspreis("0.003333", "20");
  expect(vk).toBe("0.0040");
  expect(materialPositionsbetragCent(vk, "250")).toBe(100);
  expect(materialVerkaufspreis("0.00495", "0")).toBe("0.0050");
  expect(materialPositionsbetragCent("0.0050", "1")).toBe(1);
  expect(materialPositionsbetragCent("0.0050", "2")).toBe(1);
  expect(() => materialPositionsbetragCent("0.0040", "1.0001")).toThrow("LAGER_MATERIAL_BETRAG_UNGUELTIG");
});

test("Material verwendet seine Basiseinheit und erweitert die Codes für andere Zeilentypen nicht", () => {
  for (const [einheit, code] of [
    ["stk", "C62"], ["paar", "PR"], ["ml", "MLT"], ["l", "LTR"], ["g", "GRM"], ["kg", "KGM"],
    ["mm", "MMT"], ["cm", "CMT"], ["m", "MTR"],
  ] as const) {
    expect(lagerRechnungseinheit(einheit)).toBe(code);
  }
  for (const einheit of ["paar", "ml", "l", "mm", "cm"]) {
    expect(invoiceElectronicUnit(einheit)).toBeNull();
  }
  expect(invoiceElectronicUnitLabel("PR")).toBe("Paar");
  expect(() => lagerRechnungseinheit("pauschal")).toThrow("MATERIAL_EINHEIT_OHNE_CODE");
  expect(invoiceElectronicUnit("pauschal")?.code).toBe("C62");
});

test("TEST-Buchungen werden je Auftrag, Artikel, Einheit und Verkaufspreis erst als Position gerundet", () => {
  const buchung = {
    eventId: "TEST-A", auftragId: "TEST-Auftrag", artikelId: "TEST-Artikel", artikel: "TEST Material",
    menge: "1.5", einheit: "ml" as const, kalkEk: "0.004", aufschlag: "0", rechnungsnummer: null,
  };
  expect(fasseMaterialpositionenZusammen([
    buchung,
    { ...buchung, eventId: "TEST-B", menge: "1" },
    { ...buchung, eventId: "TEST-C", menge: "2", kalkEk: "0.005" },
    { ...buchung, eventId: "TEST-D", auftragId: "TEST-Zweiter", kalkEk: null, aufschlag: null },
  ])).toMatchObject([
    { auftragId: "TEST-Auftrag", menge: "2.5", einheitCode: "MLT", verkaufspreis: "0.0040", betragCent: 1, wareneinsatzCent: 1, eventIds: ["TEST-A", "TEST-B"] },
    { auftragId: "TEST-Auftrag", menge: "2", verkaufspreis: "0.0050", betragCent: 1, eventIds: ["TEST-C"] },
    { auftragId: "TEST-Zweiter", preisFehlt: true, verkaufspreis: null, betragCent: null, eventIds: ["TEST-D"] },
  ]);
});
