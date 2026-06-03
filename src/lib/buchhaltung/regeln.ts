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

  // Bewirtung: 70 % absetzbar
  if (beleg.belegart === "bewirtung") {
    const absetzbar = beleg.netto ? beleg.netto * 0.7 : undefined;
    hinweise.push({
      regel: "Bewirtung 70 %",
      paragraf: "§ 4 Abs. 5 Nr. 2 EStG",
      text: `70 % absetzbar (${absetzbar ? absetzbar.toFixed(2) + " €" : "Betrag prüfen"}). Vorsteuer voll abzugsfähig. Anlass und Teilnehmer müssen dokumentiert sein.`,
      betrag: absetzbar,
      typ: "absetzbarkeit",
    });
  }

  // Kfz/Privatanteil
  if (beleg.belegart === "tankbeleg" || beleg.skrKonto?.startsWith("453")) {
    hinweise.push({
      regel: "Kfz-Kosten / Privatanteil",
      paragraf: "§ 6 Abs. 1 Nr. 4 EStG",
      text: "Bei privat genutztem Kfz: 1-%-Regelung oder Fahrtenbuch beachten. Vorsteuerabzug ggf. anteilig.",
      typ: "absetzbarkeit",
    });
  }

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
  empfaenger: string,
  summeJahr: number,
): KiHinweis | null {
  if (summeJahr > 50) {
    return {
      regel: "Geschenke 50 €/Person/Jahr",
      paragraf: "§ 4 Abs. 5 Nr. 1 EStG",
      text: `Summe Geschenke an "${empfaenger}": ${summeJahr.toFixed(2)} € — über 50 €/Person/Jahr → nicht anerkannt.`,
      betrag: summeJahr,
      typ: "absetzbarkeit",
    };
  }
  return null;
}

/**
 * Prüft Plausibilität: Kategorie-Ausgaben als % vom Umsatz
 */
export function pruefePlausibilitaet(
  kategorien: KategorieSumme[],
  gesamtUmsatz: number,
): KiHinweis[] {
  const hinweise: KiHinweis[] = [];
  
  if (gesamtUmsatz <= 0) return hinweise;

  for (const kat of kategorien) {
    const anteil = (kat.summe / gesamtUmsatz) * 100;
    // Warnung bei > 20 % Anteil (branchenunüblich hoch)
    if (anteil > 20) {
      hinweise.push({
        regel: "Plausibilitätsprüfung",
        paragraf: "",
        text: `"${kat.kategorieName}": ${anteil.toFixed(1)} % vom Umsatz — ungewöhnlich hoch. Prüfung empfohlen.`,
        betrag: kat.summe,
        typ: "plausibilitaet",
      });
    }
  }

  return hinweise;
}

/**
 * Berechnet den Sparzähler.
 * Formel: ersparnis = anzahl_auto_belege × minuten_pro_beleg × (berater_stundensatz/60)
 */
export function berechneErsparnis(
  anzahlAutoBelege: number,
  minutenProBeleg: number = 4,
  beraterStundensatz: number = 120,
): number {
  return anzahlAutoBelege * minutenProBeleg * (beraterStundensatz / 60);
}

/**
 * Prüft Fristen und gibt Erinnerungen zurück.
 */
export function pruefeFristen(heute: Date = new Date()): KiHinweis[] {
  const hinweise: KiHinweis[] = [];
  const tag = heute.getDate();
  const monat = heute.getMonth(); // 0-indexed
  
  // UStVA-Frist: 10. des Folgemonats
  if (tag >= 1 && tag <= 10) {
    const tageVerbleibend = 10 - tag;
    hinweise.push({
      regel: "UStVA-Frist",
      paragraf: "§ 18 Abs. 1 UStG",
      text: `Umsatzsteuer-Voranmeldung fällig am 10. — noch ${tageVerbleibend} Tag(e).`,
      typ: "frist",
    });
  }

  // Gewerbesteuer-Vorauszahlung: 15.02, 15.05, 15.08, 15.11
  const gewstMonate = [1, 4, 7, 10]; // 0-indexed
  if (gewstMonate.includes(monat) && tag <= 15) {
    hinweise.push({
      regel: "Gewerbesteuer-Vorauszahlung",
      paragraf: "§ 19 GewStG",
      text: `Gewerbesteuer-Vorauszahlung fällig am 15. dieses Monats.`,
      typ: "frist",
    });
  }

  return hinweise;
}
