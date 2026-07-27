/**
 * MockBuchhaltungProvider — Demo-Daten für Entwicklung und Prototyping
 * Liefert dieselben Typen wie der spätere SupabaseBuchhaltungProvider.
 */

import type { BuchhaltungDataProvider } from "./BuchhaltungDataProvider";
import type {
  Beleg, BelegDetail, BelegFilter, BelegFile,
  Ausgangsrechnung, RechnungFilter,
  Zeitraum, KategorieSumme, KraftstoffReport, Bwa,
  CostItem, UstvaWerte, Steuerprofil, ErsparnisResult,
  ExportDatei,
} from "../types";

// ── Demo-Daten ───────────────────────────────────────────────────────────

const DEMO_BELEGE: Beleg[] = [
  {
    id: "bel-001", erfasstAm: "2026-05-02T09:00:00Z", belegdatum: "2026-05-01",
    lieferantText: "ARAL Tankstelle Düsseldorf", brutto: 87.50, netto: 73.53,
    ustSatz: 19, ustBetrag: 13.97, vorsteuerAbzug: true,
    kategorieId: "kat-kraftstoff", skrKonto: "4530",
    absetzbarProzent: 100, belegart: "tankbeleg",
    originalDatei: "belege/2026-05/tankbeleg-001.jpg", originalFormat: "jpg",
    ocrConfidence: 96.5, status: "festgeschrieben", erstelltVon: "user-owner",
  },
  {
    id: "bel-002", erfasstAm: "2026-05-03T14:30:00Z", belegdatum: "2026-05-03",
    lieferantText: "Chemie-Shop24 GmbH", brutto: 1250.00, netto: 1050.42,
    ustSatz: 19, ustBetrag: 199.58, vorsteuerAbzug: true,
    kategorieId: "kat-material", skrKonto: "4900",
    absetzbarProzent: 100, belegart: "rechnung",
    originalDatei: "belege/2026-05/rechnung-002.pdf", originalFormat: "pdf",
    ocrConfidence: 92.1, status: "festgeschrieben", erstelltVon: "user-owner",
  },
  {
    id: "bel-003", erfasstAm: "2026-05-15T11:00:00Z", belegdatum: "2026-05-14",
    lieferantText: "Restaurant Rheinblick", brutto: 145.80, netto: 122.52,
    ustSatz: 19, ustBetrag: 23.28, vorsteuerAbzug: true,
    kategorieId: "kat-bewirtung", skrKonto: "4650",
    absetzbarProzent: 70, absetzbarGrund: "§ 4 Abs. 5 Nr. 2 EStG",
    belegart: "bewirtung",
    originalDatei: "belege/2026-05/bewirtung-003.jpg", originalFormat: "jpg",
    ocrConfidence: 78.3, status: "pruefen", erstelltVon: "user-owner",
  },
];

const DEMO_RECHNUNGEN: Ausgangsrechnung[] = [
  {
    id: "ar-001", nummer: "R-2026-041", kundeId: "cust-1", kundeName: "Metallbau Müller",
    datum: "2026-05-01", faelligAm: "2026-05-15", brutto: 2450, netto: 2058.82,
    ustSatz: 19, ustBetrag: 391.18, bezahltBetrag: 0, offenerBetrag: 2450, status: "ueberfaellig", mahnstufe: 1,
  },
  {
    id: "ar-002", nummer: "R-2026-042", kundeId: "cust-2", kundeName: "AutoTech GmbH",
    datum: "2026-05-05", faelligAm: "2026-05-19", brutto: 1800, netto: 1512.61,
    ustSatz: 19, ustBetrag: 287.39, bezahltBetrag: 0, offenerBetrag: 1800, status: "offen", mahnstufe: 0,
  },
  {
    id: "ar-003", nummer: "R-2026-043", kundeId: "cust-3", kundeName: "Schlosserei Weber",
    datum: "2026-05-10", faelligAm: "2026-05-24", brutto: 3200, netto: 2689.08,
    ustSatz: 19, ustBetrag: 510.92, bezahltAm: "2026-05-22", bezahltBetrag: 3200, offenerBetrag: 0, status: "bezahlt", mahnstufe: 0,
  },
];

// ── Provider-Implementation ──────────────────────────────────────────────

export class MockBuchhaltungProvider implements BuchhaltungDataProvider {
  
  async listBelege(filter?: BelegFilter): Promise<Beleg[]> {
    let result = [...DEMO_BELEGE];
    if (filter?.status) result = result.filter(b => b.status === filter.status);
    if (filter?.belegart) result = result.filter(b => b.belegart === filter.belegart);
    if (filter?.suchbegriff) {
      const q = filter.suchbegriff.toLowerCase();
      result = result.filter(b => b.lieferantText?.toLowerCase().includes(q));
    }
    return result;
  }

  async getBeleg(id: string): Promise<BelegDetail> {
    const beleg = DEMO_BELEGE.find(b => b.id === id) ?? DEMO_BELEGE[0];
    return {
      ...beleg,
      positionen: [],
      ocrPositionen: [],
      ocrPositionenState: "not_run",
      verknuepfteKostenposten: [],
      kiPruefstatus: "not_run",
      kraftstoffDetail: beleg.belegart === "tankbeleg" ? {
        id: "kd-001", belegId: beleg.id,
        sorte: "diesel", liter: 51.2, preisProLiter: 1.709,
        tankstelle: "ARAL", ort: "Düsseldorf",
      } : undefined,
      kiHinweise: beleg.belegart === "bewirtung" ? [{
        regel: "Bewirtung 70 %",
        paragraf: "§ 4 Abs. 5 Nr. 2 EStG",
        text: "70 % absetzbar. Anlass und Teilnehmer müssen dokumentiert sein.",
        betrag: beleg.netto ? beleg.netto * 0.7 : undefined,
        typ: "absetzbarkeit",
      }] : [],
    };
  }

  async createBelegFromUpload(_file: BelegFile): Promise<Beleg> {
    return {
      id: `bel-new-${Date.now()}`,
      erfasstAm: new Date().toISOString(),
      vorsteuerAbzug: true,
      absetzbarProzent: 100,
      originalDatei: "belege/upload-demo.jpg",
      status: "pruefen",
      erstelltVon: "user-owner",
      ocrConfidence: 88.5,
    };
  }

  async freigebenBeleg(id: string, korrektur?: Partial<Beleg>): Promise<Beleg> {
    const beleg = DEMO_BELEGE.find(b => b.id === id) ?? DEMO_BELEGE[0];
    return { ...beleg, ...korrektur, status: "erfasst" };
  }

  async stornoBeleg(id: string, _grund: string): Promise<Beleg> {
    const beleg = DEMO_BELEGE.find(b => b.id === id) ?? DEMO_BELEGE[0];
    return { ...beleg, status: "storniert" };
  }

  async getAusgabenNachKategorie(_zeitraum: Zeitraum): Promise<KategorieSumme[]> {
    return [
      { kategorieId: "kat-kraftstoff", kategorieName: "Kraftstoff & Kfz", icon: "⛽", summe: 1240, anzahl: 18, anteilAmUmsatz: 1.5 },
      { kategorieId: "kat-material", kategorieName: "Material & Chemie", icon: "🧪", summe: 4850, anzahl: 12, anteilAmUmsatz: 5.7 },
      { kategorieId: "kat-bewirtung", kategorieName: "Bewirtung", icon: "🍽️", summe: 580, anzahl: 4, anteilAmUmsatz: 0.7 },
      { kategorieId: "kat-versicherung", kategorieName: "Versicherungen", icon: "🛡️", summe: 1200, anzahl: 3, anteilAmUmsatz: 1.4 },
      { kategorieId: "kat-miete", kategorieName: "Miete & Nebenkosten", icon: "🏠", summe: 2800, anzahl: 1, anteilAmUmsatz: 3.3 },
      { kategorieId: "kat-sonstiges", kategorieName: "Sonstiges", icon: "📦", summe: 750, anzahl: 8, anteilAmUmsatz: 0.9 },
    ];
  }

  async getKraftstoffAuswertung(_zeitraum: Zeitraum): Promise<KraftstoffReport> {
    return {
      gesamtkosten: 1240,
      gesamtLiter: 725.8,
      durchschnittPreisProLiter: 1.71,
      anzahlTankungen: 18,
      includedReceiptCount: 18,
      missingDetailCount: 0,
      missingLiterCount: 0,
      missingAmountCount: 0,
      missingInputCount: 0,
      dataState: "ready",
      nachSorte: [
        { sorte: "diesel", liter: 680.2, kosten: 1162 },
        { sorte: "adblue", liter: 45.6, kosten: 78 },
      ],
      nachOrt: [
        { ort: "Düsseldorf", anzahl: 12, kosten: 830 },
        { ort: "Köln", anzahl: 4, kosten: 280 },
        { ort: "Essen", anzahl: 2, kosten: 130 },
      ],
      nachMonat: [
        { monat: "2026-03", liter: 230, kosten: 395 },
        { monat: "2026-04", liter: 260, kosten: 442 },
        { monat: "2026-05", liter: 235.8, kosten: 403 },
      ],
    };
  }

  async getBwa(_zeitraum: Zeitraum): Promise<Bwa> {
    return {
      zeitraum: { von: "2026-05-01", bis: "2026-05-31" },
      umsatzerloese: 85400,
      materialaufwand: 12200,
      fremdleistungen: 4500,
      nichtZugeordnet: 0,
      deckungsbeitrag: 68700,
      fixkosten: 45000,
      betriebsergebnis: 23700,
      truthStatus: "complete",
      missingInputCount: 0,
      positionen: [
        { bezeichnung: "Umsatzerlöse Galvanik", betrag: 85400, typ: "einnahme" },
        { bezeichnung: "Materialaufwand (Chemie, Metalle)", betrag: 12200, typ: "ausgabe_variabel" },
        { bezeichnung: "Fremdleistungen", betrag: 4500, typ: "ausgabe_variabel" },
        { bezeichnung: "Miete Werkstatt", betrag: 2800, typ: "ausgabe_fix" },
        { bezeichnung: "Personalkosten", betrag: 35000, typ: "ausgabe_fix" },
        { bezeichnung: "Versicherungen", betrag: 1200, typ: "ausgabe_fix" },
        { bezeichnung: "Energie & Strom", betrag: 4500, typ: "ausgabe_fix" },
        { bezeichnung: "Sonstiges (Büro, Telefon, IT)", betrag: 1500, typ: "ausgabe_fix" },
      ],
    };
  }

  async getFixkosten(): Promise<CostItem[]> {
    return [
      { name: "Miete Werkstatt", amount: 2800, interval: "monatlich", category: "fix", status: "aktiv" },
      { name: "Personalkosten", amount: 35000, interval: "monatlich", category: "fix", status: "aktiv" },
      { name: "Versicherungen", amount: 1200, interval: "monatlich", category: "fix", status: "aktiv" },
      { name: "Energie & Strom (Grundgebühr)", amount: 4500, interval: "monatlich", category: "fix", status: "aktiv" },
      { name: "Büro / Telefon / IT", amount: 1500, interval: "monatlich", category: "fix", status: "aktiv" },
    ];
  }

  async getVariableKosten(): Promise<CostItem[]> {
    return [
      { name: "Galvanik-Chemie", amount: 8500, interval: "monatlich", category: "variabel", status: "aktiv" },
      { name: "Kraftstoff (Transporter)", amount: 1240, interval: "monatlich", category: "variabel", status: "aktiv" },
      { name: "Fremdleistung / Lohnbehandlung", amount: 4500, interval: "monatlich", category: "variabel", status: "aktiv" },
      { name: "Verpackungsmaterial", amount: 350, interval: "monatlich", category: "variabel", status: "aktiv" },
    ];
  }

  async listOffenePosten(): Promise<Ausgangsrechnung[]> {
    return DEMO_RECHNUNGEN.filter(r => r.status !== "bezahlt");
  }

  async listRechnungen(filter?: RechnungFilter): Promise<Ausgangsrechnung[]> {
    let result = [...DEMO_RECHNUNGEN];
    if (filter?.status) result = result.filter(r => r.status === filter.status);
    return result;
  }

  async berechneUstva(_zeitraum: Zeitraum): Promise<UstvaWerte> {
    return {
      zeitraumVon: "2026-05-01", zeitraumBis: "2026-05-31",
      umsatz19: 85400, ust19: 16226,
      umsatz7: 0, ust7: 0,
      umsatz0: 0,
      vorsteuer: 13046,
      zahllast: 3180,
      status: "berechnet",
    };
  }

  async getSteuerprofil(): Promise<Steuerprofil> {
    return {
      id: "sp-default", bezeichnung: "Galvanik Kreile",
      standardUstSatz: 19, reduziertUstSatz: 7,
      kleinunternehmer: false,
      voranmeldungRhythmus: "monatlich",
      sachkontenrahmen: "SKR03",
    };
  }

  async exportDatev(_zeitraum: Zeitraum): Promise<ExportDatei> {
    return {
      typ: "datev", dateiname: "EXTF_Buchungsstapel_2026-05.csv",
      inhalt: new Blob(["DEMO DATEV EXPORT"], { type: "text/csv" }),
      mimeType: "text/csv", anzahlBuchungen: DEMO_BELEGE.length,
      zeitraum: { von: "2026-05-01", bis: "2026-05-31" },
    };
  }

  async exportLexware(_zeitraum: Zeitraum): Promise<ExportDatei> {
    return {
      typ: "lexware", dateiname: "Rechnungsjournal_2026-05.csv",
      inhalt: new Blob(["DEMO LEXWARE EXPORT"], { type: "text/csv" }),
      mimeType: "text/csv", anzahlBuchungen: DEMO_BELEGE.length,
      zeitraum: { von: "2026-05-01", bis: "2026-05-31" },
    };
  }

  async exportSteuerberaterPaket(_zeitraum: Zeitraum): Promise<ExportDatei> {
    return {
      typ: "steuerberater_zip", dateiname: "Steuerberater_2026-05.zip",
      inhalt: new Blob(["DEMO ZIP"], { type: "application/zip" }),
      mimeType: "application/zip", anzahlBuchungen: DEMO_BELEGE.length,
      zeitraum: { von: "2026-05-01", bis: "2026-05-31" },
    };
  }

  async getErsparnis(_jahr: number): Promise<ErsparnisResult> {
    void _jahr;
    return {
      state: "not_evidenced",
      data: null,
      reason: "FINANCE_SAVINGS_NOT_EVIDENCED",
    };
  }
}
