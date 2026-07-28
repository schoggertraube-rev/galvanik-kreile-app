/**
 * MockERechnungParser — Demo für E-Rechnung (XRechnung/ZUGFeRD) Empfang
 */

import type { ERechnungParser } from "./ERechnungParser";
import type { RechnungDaten } from "../types";

export class MockERechnungParser implements ERechnungParser {
  async parse(_xml: string): Promise<RechnungDaten> {
void _xml;
    return {
      rechnungsnummer: "ER-2026-001",
      datum: "2026-05-20",
      lieferantName: "Lieferant aus E-Rechnung",
      lieferantUstId: "DE123456789",
      positionen: [
        { beschreibung: "Galvanik-Chemie Standardlieferung", netto: 1500, ustSatz: 19 },
        { beschreibung: "Spezialzusatz", netto: 350, ustSatz: 19 },
      ],
      brutto: 2201.50,
      netto: 1850.00,
      ustBetrag: 351.50,
      format: "xrechnung",
      validierung: { gueltig: true, fehler: [] },
    };
  }
}
