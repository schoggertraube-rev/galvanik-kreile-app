import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { erstelleLagerInventurCsv, inventurCsvDezimal, inventurCsvTextzelle } from "../inventur-csv";

const zeilen = [{
  kurznummer: 81,
  artikelName: "TEST; \"Nickel\"",
  ist: "10.5",
  einheit: "kg",
  stockwerk: "Lager",
  bereich: "A-01",
  ek: "3.4",
  preisquelle: "TEST-EK",
  wertEur: "35.7",
}] as const;

describe("Inventurabschluss-CSV", () => {
  it("schreibt BOM, festen Kopf, Semikolonspalten und deutsche Dezimalwerte", () => {
    const bytes = erstelleLagerInventurCsv(zeilen);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe("kurznr;artikel;menge;einheit;ort;ek;ek_quelle;wert\r\n81;\"TEST; \"\"Nickel\"\"\";10,5;kg;Lager / A-01;3,4;TEST-EK;35,7\r\n");
  });

  it("schützt Textzellen vor Formeln und behält fehlende Werte leer", () => {
    expect(inventurCsvTextzelle("=1+1")).toBe("'=1+1");
    expect(inventurCsvTextzelle(" -kritisch")).toBe("' -kritisch");
    expect(inventurCsvTextzelle(null)).toBe("");
    expect(inventurCsvDezimal(null)).toBe("");
  });

  it("liefert aus denselben Zeilen stets dieselben Bytes und denselben SHA-256", () => {
    const erste = erstelleLagerInventurCsv(zeilen);
    const zweite = erstelleLagerInventurCsv(zeilen);
    expect(zweite).toEqual(erste);
    expect(createHash("sha256").update(erste).digest("hex"))
      .toBe(createHash("sha256").update(zweite).digest("hex"));
  });
});
