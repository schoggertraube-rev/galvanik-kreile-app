/**
 * Buchhaltung & Finanzen — Zentrale TypeScript-Typen
 * Grundlage: 15_BUCHHALTUNG_DATENMODELL.md
 */

// ── Zeitraum / Filter ────────────────────────────────────────────────────

export interface Zeitraum {
  von: string; // ISO date string (YYYY-MM-DD)
  bis: string;
}

export interface BelegFilter {
  zeitraum?: Zeitraum;
  kategorieId?: string;
  lieferantId?: string;
  status?: BelegStatus;
  belegart?: Belegart;
  suchbegriff?: string;
}

export interface RechnungFilter {
  zeitraum?: Zeitraum;
  status?: AusgangsrechnungStatus;
  kundeId?: string;
  ueberfaellig?: boolean;
}

// ── Enums / Unions ───────────────────────────────────────────────────────

export type BelegStatus = "pruefen" | "erfasst" | "festgeschrieben" | "storniert";
export type Belegart = "rechnung" | "kassenbon" | "tankbeleg" | "bewirtung" | "abo";
export type AusgangsrechnungStatus = "offen" | "bezahlt" | "ueberfaellig" | "teilbezahlt" | "storniert";
export type ZahlungTyp = "eingang" | "ausgang";
export type Zahlungsart = "ueberweisung" | "bar" | "karte" | "paypal";
export type KategorieTyp = "ausgabe" | "einnahme";
export type KraftstoffSorte = "diesel" | "super" | "superplus" | "adblue";
export type UstvaPeriodeStatus = "entwurf" | "berechnet" | "freigegeben" | "uebermittelt";
export type ExportTyp = "datev" | "lexware" | "steuerberater_zip" | "elster";
export type AuditAktion = "create" | "storno" | "export" | "freigabe" | "korrektur";

// ── Entitäten ────────────────────────────────────────────────────────────

export interface Kategorie {
  id: string;
  name: string;
  typ: KategorieTyp;
  skrKonto?: string;
  defaultAbsetzbarProzent: number;
  icon?: string;
  sortierung: number;
}

export interface Lieferant {
  id: string;
  name: string;
  nameNormalisiert?: string;
  standardKategorieId?: string;
  standardSkrKonto?: string;
  ustId?: string;
  adresse?: string;
}

export interface Beleg {
  id: string;
  erfasstAm: string;
  belegdatum?: string;
  lieferantId?: string;
  lieferantText?: string;
  brutto?: number;
  netto?: number;
  ustSatz?: number;
  ustBetrag?: number;
  vorsteuerAbzug: boolean;
  kategorieId?: string;
  skrKonto?: string;
  absetzbarProzent: number;
  absetzbarGrund?: string;
  belegart?: Belegart;
  originalDatei: string;
  originalFormat?: string;
  ocrConfidence?: number;
  status: BelegStatus;
  storniertVon?: string;
  bankZahlungId?: string;
  erstelltVon: string;
}

export interface BelegDetail extends Beleg {
  positionen: BelegPosition[];
  kraftstoffDetail?: KraftstoffDetail;
  kategorie?: Kategorie;
  lieferant?: Lieferant;
  kiHinweise: KiHinweis[];
}

export interface BelegPosition {
  id: string;
  belegId: string;
  beschreibung?: string;
  netto?: number;
  ustSatz?: number;
  ustBetrag?: number;
  skrKonto?: string;
  sortierung: number;
}

export interface KraftstoffDetail {
  id: string;
  belegId: string;
  sorte?: KraftstoffSorte;
  liter?: number;
  preisProLiter?: number;
  tankstelle?: string;
  ort?: string;
}

export interface AusgangsrechnungPosition {
  id?: string; // Optional for creation
  beschreibung: string;
  menge: number;
  einzelpreisNetto: number;
}

export interface Ausgangsrechnung {
  id: string;
  nummer: string;
  kundeId?: string;
  kundeName?: string; // denormalisiert für Anzeige
  datum: string;
  faelligAm?: string;
  brutto: number;
  netto?: number;
  ustSatz?: number;
  ustBetrag?: number;
  bezahltAm?: string;
  status: AusgangsrechnungStatus;
  mahnstufe: number;
  erechnungXml?: string;
  leadId?: string;
  bemerkung?: string;
  positionen?: AusgangsrechnungPosition[]; // Client-seitig beigefügt
}

export interface Zahlung {
  id: string;
  typ: ZahlungTyp;
  betrag: number;
  datum: string;
  referenz?: string;
  belegId?: string;
  ausgangsrechnungId?: string;
  zahlungsart?: Zahlungsart;
  bankReferenz?: string;
}

export interface Steuerprofil {
  id: string;
  bezeichnung: string;
  standardUstSatz: number;
  reduziertUstSatz: number;
  kleinunternehmer: boolean;
  voranmeldungRhythmus: "monatlich" | "vierteljaehrlich";
  sachkontenrahmen: "SKR03" | "SKR04";
  beraterNr?: string;
  mandantenNr?: string;
  wjBeginn?: string;
}

export interface UstvaWerte {
  zeitraumVon: string;
  zeitraumBis: string;
  umsatz19: number;
  ust19: number;
  umsatz7: number;
  ust7: number;
  umsatz0: number;
  vorsteuer: number;
  zahllast: number;
  status: UstvaPeriodeStatus;
  freigegebenAm?: string;
}

// ── Auswertungen ─────────────────────────────────────────────────────────

export interface KategorieSumme {
  kategorieId: string;
  kategorieName: string;
  icon?: string;
  summe: number;
  anzahl: number;
  anteilAmUmsatz?: number; // Prozent
}

export interface KraftstoffReport {
  gesamtkosten: number;
  gesamtLiter: number;
  durchschnittPreisProLiter: number;
  anzahlTankungen: number;
  nachSorte: { sorte: KraftstoffSorte; liter: number; kosten: number }[];
  nachOrt: { ort: string; anzahl: number; kosten: number }[];
  nachMonat: { monat: string; liter: number; kosten: number }[];
}

export interface Bwa {
  zeitraum: Zeitraum;
  umsatzerloese: number;
  materialaufwand: number;
  fremdleistungen: number;
  deckungsbeitrag: number;
  fixkosten: number;
  betriebsergebnis: number;
  positionen: BwaPosition[];
}

export interface BwaPosition {
  bezeichnung: string;
  betrag: number;
  typ: "einnahme" | "ausgabe_variabel" | "ausgabe_fix";
}

export interface CostItem {
  id?: string;
  name: string;
  amount: number;
  interval: string; // monatlich, jährlich, einmalig
  category: "fix" | "variabel";
  status: string;
}

export interface Ersparnis {
  jahr: number;
  betrag: number;
  anzahlAutoBelege: number;
  minutenProBeleg: number;
  beraterStundensatz: number;
  prozentAutomatisch: number;
}

// ── KI-Hinweise ──────────────────────────────────────────────────────────

export interface KiHinweis {
  regel: string;        // z.B. "Bewirtung 70 %"
  paragraf: string;     // z.B. "§ 4 Abs. 5 Nr. 2 EStG"
  text: string;         // Menschenlesbarer Hinweistext
  betrag?: number;      // Konkreter Betrag, falls relevant
  typ: "absetzbarkeit" | "plausibilitaet" | "vollstaendigkeit" | "frist";
}

// ── Export ────────────────────────────────────────────────────────────────

export interface ExportDatei {
  typ: ExportTyp;
  dateiname: string;
  inhalt: Blob | Buffer;
  mimeType: string;
  anzahlBuchungen: number;
  zeitraum: Zeitraum;
}

// ── OCR ──────────────────────────────────────────────────────────────────

export interface BelegFile {
  data: ArrayBuffer | string; // base64 oder binary
  filename: string;
  mimeType: string;
}

export interface OcrResult {
  lieferant?: string;
  datum?: string;
  brutto?: number;
  netto?: number;
  ustSatz?: number;
  ustBetrag?: number;
  belegart?: Belegart;
  confidence: number;
  felder: OcrFeld[];
  // Tankbeleg-Extras
  kraftstoff?: {
    sorte?: KraftstoffSorte;
    liter?: number;
    preisProLiter?: number;
    tankstelle?: string;
    ort?: string;
  };
}

export interface OcrFeld {
  name: string;
  wert: string;
  confidence: number;
}

// ── E-Rechnung ───────────────────────────────────────────────────────────

export interface RechnungDaten {
  rechnungsnummer: string;
  datum: string;
  lieferantName: string;
  lieferantUstId?: string;
  positionen: { beschreibung: string; netto: number; ustSatz: number }[];
  brutto: number;
  netto: number;
  ustBetrag: number;
  format: "xrechnung" | "zugferd";
  validierung: { gueltig: boolean; fehler: string[] };
}

// ── Stufe 2 ──────────────────────────────────────────────────────────────

export interface Umsatz {
  id: string;
  datum: string;
  betrag: number;
  verwendungszweck: string;
  gegenkonto: string;
  belegId?: string; // Zuordnung
}

export interface Quittung {
  transferTicket: string;
  zeitpunkt: string;
  status: "akzeptiert" | "abgelehnt";
  fehler?: string;
}


export interface Kostenposten {
  id: string;
  bezeichnung: string;
  art: "fix" | "variabel";
  kategorie?: string;
  betrag: number;
  intervall: "einmalig" | "monatlich" | "jaehrlich";
  belegId?: string;
  kampagneId?: string;
  giltAb?: string;
  giltBis?: string;
  isDemo?: boolean;
}

export interface KostenpostenFilter {
  art?: "fix" | "variabel";
  kategorie?: string;
}
