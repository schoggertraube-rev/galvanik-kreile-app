/**
 * MockOcrProvider — Demo-OCR für Entwicklung
 * Liefert realistische Fake-OCR-Ergebnisse für Tests und Prototyping.
 * Wählt anhand des Dateinamens oder zufällig einen passenden Mock-Beleg.
 */

import type { OcrProvider } from "./OcrProvider";
import type { BelegFile, OcrResult } from "../types";

const MOCK_RESULTS: Record<string, OcrResult> = {
  shell: {
    lieferant: "Shell - Frankfurt-Ost",
    datum: "2026-06-02",
    brutto: 78.40,
    netto: 65.88,
    ustSatz: 19,
    ustBetrag: 12.52,
    belegart: "tankbeleg",
    confidence: 96.1,
    felder: [
      { name: "Lieferant", wert: "Shell - Frankfurt-Ost", confidence: 97 },
      { name: "Datum", wert: "02.06.2026", confidence: 96 },
      { name: "Brutto", wert: "78,40", confidence: 98 },
      { name: "Netto", wert: "65,88", confidence: 95 },
      { name: "Sorte", wert: "Diesel", confidence: 94 },
      { name: "Liter", wert: "45,8", confidence: 93 },
    ],
    kraftstoff: {
      sorte: "diesel",
      liter: 45.8,
      preisProLiter: 1.71,
      tankstelle: "Shell",
      ort: "Frankfurt-Ost",
    },
  },
  adler: {
    lieferant: "Gasthaus Adler",
    datum: "2026-05-31",
    brutto: 64.00,
    netto: 53.78,
    ustSatz: 19,
    ustBetrag: 10.22,
    belegart: "bewirtung",
    confidence: 72.5,
    felder: [
      { name: "Lieferant", wert: "Gasthaus Adler", confidence: 88 },
      { name: "Datum", wert: "31.05.2026", confidence: 91 },
      { name: "Brutto", wert: "64,00", confidence: 94 },
      { name: "Anlass", wert: "", confidence: 0 },
      { name: "Teilnehmer", wert: "", confidence: 0 },
    ],
  },
  riedel: {
    lieferant: "Riedel Chemie GmbH",
    datum: "2026-05-30",
    brutto: 1190.00,
    netto: 1000.00,
    ustSatz: 19,
    ustBetrag: 190.00,
    belegart: "rechnung",
    confidence: 98.3,
    felder: [
      { name: "Lieferant", wert: "Riedel Chemie GmbH", confidence: 99 },
      { name: "Datum", wert: "30.05.2026", confidence: 98 },
      { name: "Brutto", wert: "1.190,00", confidence: 99 },
      { name: "Netto", wert: "1.000,00", confidence: 98 },
      { name: "USt", wert: "190,00", confidence: 97 },
      { name: "Format", wert: "ZUGFeRD", confidence: 99 },
    ],
  },
  microsoft: {
    lieferant: "Microsoft 365",
    datum: "2026-05-28",
    brutto: 12.60,
    netto: 10.59,
    ustSatz: 19,
    ustBetrag: 2.01,
    belegart: "abo",
    confidence: 97.0,
    felder: [
      { name: "Lieferant", wert: "Microsoft 365", confidence: 99 },
      { name: "Datum", wert: "28.05.2026", confidence: 98 },
      { name: "Brutto", wert: "12,60", confidence: 99 },
      { name: "Typ", wert: "Abo - monatlich", confidence: 96 },
    ],
  },
  aral: {
    lieferant: "Aral - Hanau",
    datum: "2026-05-24",
    brutto: 70.90,
    netto: 59.58,
    ustSatz: 19,
    ustBetrag: 11.32,
    belegart: "tankbeleg",
    confidence: 94.8,
    felder: [
      { name: "Lieferant", wert: "Aral - Hanau", confidence: 96 },
      { name: "Datum", wert: "24.05.2026", confidence: 95 },
      { name: "Brutto", wert: "70,90", confidence: 97 },
      { name: "Sorte", wert: "Diesel", confidence: 94 },
      { name: "Liter", wert: "41,2", confidence: 93 },
    ],
    kraftstoff: {
      sorte: "diesel",
      liter: 41.2,
      preisProLiter: 1.72,
      tankstelle: "Aral",
      ort: "Hanau",
    },
  },
};

const MOCK_KEYS = Object.keys(MOCK_RESULTS);

export class MockOcrProvider implements OcrProvider {
  async extract(file: BelegFile): Promise<OcrResult> {
    // Simuliere OCR-Verarbeitungszeit (1.2-2.5s)
    await new Promise(resolve => setTimeout(resolve, 1200 + Math.random() * 1300));

    const name = file.filename.toLowerCase();

    // Versuche Dateinamen zu matchen
    for (const key of MOCK_KEYS) {
      if (name.includes(key)) {
        return { ...MOCK_RESULTS[key] };
      }
    }

    // Zufälliger Beleg wenn kein Match
    const randomKey = MOCK_KEYS[Math.floor(Math.random() * MOCK_KEYS.length)];
    return { ...MOCK_RESULTS[randomKey] };
  }
}
