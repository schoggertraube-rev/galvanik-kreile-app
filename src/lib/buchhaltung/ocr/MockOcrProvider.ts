/**
 * MockOcrProvider — Demo-OCR für Entwicklung
 * Liefert realistische Fake-OCR-Ergebnisse für Tests und Prototyping.
 */

import type { OcrProvider } from "./OcrProvider";
import type { BelegFile, OcrResult } from "../types";

export class MockOcrProvider implements OcrProvider {
  async extract(file: BelegFile): Promise<OcrResult> {
    // Simuliere OCR-Verarbeitungszeit
    await new Promise(resolve => setTimeout(resolve, 800));

    const isTankbeleg = file.filename.toLowerCase().includes("tank") ||
                        file.filename.toLowerCase().includes("aral") ||
                        file.filename.toLowerCase().includes("shell");

    if (isTankbeleg) {
      return {
        lieferant: "ARAL Tankstelle",
        datum: new Date().toISOString().split("T")[0],
        brutto: 87.50,
        netto: 73.53,
        ustSatz: 19,
        ustBetrag: 13.97,
        belegart: "tankbeleg",
        confidence: 94.2,
        felder: [
          { name: "Lieferant", wert: "ARAL Tankstelle", confidence: 97 },
          { name: "Datum", wert: new Date().toISOString().split("T")[0], confidence: 95 },
          { name: "Brutto", wert: "87,50", confidence: 96 },
          { name: "Sorte", wert: "Diesel", confidence: 92 },
          { name: "Liter", wert: "51,17", confidence: 91 },
        ],
        kraftstoff: {
          sorte: "diesel",
          liter: 51.17,
          preisProLiter: 1.71,
          tankstelle: "ARAL",
          ort: "Düsseldorf",
        },
      };
    }

    return {
      lieferant: "Demo Lieferant GmbH",
      datum: new Date().toISOString().split("T")[0],
      brutto: 238.00,
      netto: 200.00,
      ustSatz: 19,
      ustBetrag: 38.00,
      belegart: "rechnung",
      confidence: 89.5,
      felder: [
        { name: "Lieferant", wert: "Demo Lieferant GmbH", confidence: 91 },
        { name: "Datum", wert: new Date().toISOString().split("T")[0], confidence: 93 },
        { name: "Brutto", wert: "238,00", confidence: 95 },
        { name: "Netto", wert: "200,00", confidence: 94 },
        { name: "USt", wert: "38,00", confidence: 92 },
      ],
    };
  }
}
