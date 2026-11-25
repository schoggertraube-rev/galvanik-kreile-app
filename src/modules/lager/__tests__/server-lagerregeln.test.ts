import { describe, expect, it } from "vitest";
import { bestimmeLagerRegeln, leseBilanzbewertungMethode } from "../server-lagerregeln";

const vollstaendig = {
  material_aufschlag_prozent: 20,
  lager_regelversion: "2026-11",
  entnahme_regel_je_rubrik: { edelmetall: "verbrauch" as const },
  automatische_inventur_aktiv: true,
  bilanzbewertung_methode: "letzter_ek" as const,
};

describe("bestimmeLagerRegeln", () => {
  it("liefert nur vollständig belegte Regeln", () => {
    expect(bestimmeLagerRegeln(vollstaendig, "edelmetall")).toEqual({
      ok: true,
      aufschlag: 20,
      version: "2026-11",
      bilanzbewertung: "letzter_ek",
      entnahme: "verbrauch",
    });
  });

  it.each([
    ["material_aufschlag_prozent", { ...vollstaendig, material_aufschlag_prozent: null }],
    ["lager_regelversion", { ...vollstaendig, lager_regelversion: null }],
    ["bilanzbewertung_methode", { ...vollstaendig, bilanzbewertung_methode: null }],
  ] as const)("liefert ohne Ersatzwert den fehlenden Schlüssel %s", (schluessel, einstellungen) => {
    expect(bestimmeLagerRegeln(einstellungen)).toEqual({ ok: false, schluessel });
  });

  it("weist fehlende Rubrik oder Entnahmeregel getrennt aus", () => {
    expect(bestimmeLagerRegeln(vollstaendig, null)).toEqual({ ok: false, schluessel: "artikel_rubrik" });
    expect(bestimmeLagerRegeln(vollstaendig, "chemie")).toEqual({
      ok: false,
      schluessel: "entnahme_regel_je_rubrik",
    });
  });

  it("liest eine Bilanzbewertung nur bei einem zulässigen Wert", () => {
    expect(leseBilanzbewertungMethode(vollstaendig)).toBe("letzter_ek");
    expect(leseBilanzbewertungMethode({ ...vollstaendig, bilanzbewertung_methode: null })).toBeNull();
  });
});
