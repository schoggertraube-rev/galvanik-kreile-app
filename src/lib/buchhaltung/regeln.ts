/**
 * KI-Regelwerk: Absetzbarkeit, Plausibilität, Vollständigkeit
 * 
 * GRUNDSATZ: Nur rechtlich feststehende Regeln + Vollständigkeitslücken.
 * Nie raten, Ausgaben zu erhöhen oder Prüfungen zu umgehen.
 * Jeder Hinweis trägt Regel/Quelle + konkreten Betrag.
 * 
 * Implementierung als reine Funktionen — kein LLM für die Rechtsfolge.
 */

import type { Beleg, KiHinweis, KategorieSumme } from "./types";

/**
 * Prüft einen einzelnen Beleg und gibt passende KI-Hinweise zurück.
 */
export function pruefeBelegHinweise(beleg: Beleg): KiHinweis[] {
  const hinweise: KiHinweis[] = [];

  // Niedrige OCR-Confidence
  if (beleg.ocrConfidence !== undefined && beleg.ocrConfidence < 85) {
    hinweise.push({
      regel: "OCR-Confidence unter Schwelle",
      paragraf: "",
      text: `OCR-Erkennung bei ${beleg.ocrConfidence.toFixed(0)} % — bitte Daten manuell prüfen.`,
      betrag: undefined,
      typ: "vollstaendigkeit",
    });
  }

  return hinweise;
}

/**
 * Prüft Geschenke-Grenze (50 €/Person/Jahr).
 */
export function pruefeGeschenkeGrenze(
  _empfaenger: string,
  _summeJahr: number,
): KiHinweis | null {
  void _empfaenger;
  void _summeJahr;
  // No legal conclusion without a versioned rule source and tax context.
  return null;
}

/**
 * Prüft Plausibilität: Kategorie-Ausgaben als % vom Umsatz
 */
export function pruefePlausibilitaet(
  _kategorien: KategorieSumme[],
  _gesamtUmsatz: number,
): KiHinweis[] {
  void _kategorien;
  void _gesamtUmsatz;
  // No industry benchmark or tenant-approved threshold is connected.
  return [];
}

/**
 * Prüft Fristen und gibt Erinnerungen zurück.
 */
export function pruefeFristen(_heute: Date = new Date()): KiHinweis[] {
  void _heute;
  // Intentionally fail closed: deadlines can depend on filing cadence,
  // extensions, notices, weekends, holidays, and the taxpayer's situation.
  // A verified tenant-bound deadline source must replace this legacy hook.
  return [];
}
