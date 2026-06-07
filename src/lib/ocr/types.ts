export interface OcrProvider {
  extractBeleg(imageUrl: string): Promise<OcrErgebnis>;
}

export interface OcrErgebnis {
  lieferant: string | null;
  datum: string | null;         // ISO-Date
  brutto: number | null;
  netto: number | null;
  ustSatz: number | null;       // 19, 7, 0
  ustBetrag: number | null;
  positionen: OcrPosition[];    // einzelne Posten auf dem Beleg
  belegart: string | null;      // rechnung, quittung, tankbeleg, kassenbon
  zahlungsart: string | null;   // bar, karte, überweisung
  rechnungsnummer: string | null;
  confidence: number;           // 0..1
  rohtext: string;              // vollständiger OCR-Text für Suche
}

export interface OcrPosition {
  beschreibung: string;
  menge: number | null;
  einzelpreis: number | null;
  betrag: number;
}
