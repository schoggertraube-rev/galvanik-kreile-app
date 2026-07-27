/**
 * BuchhaltungDataProvider — zentrale Abstraktion
 * UI-Komponenten arbeiten nur gegen dieses Interface.
 * Implementierungen: MockBuchhaltungProvider (Demo) → SupabaseBuchhaltungProvider (Live)
 */

import type {
  Beleg, BelegDetail, BelegFilter, BelegFile,
  Ausgangsrechnung, RechnungFilter,
  Zeitraum, KategorieSumme, KraftstoffReport, Bwa,
  CostItem, UstvaWerte, Steuerprofil, ErsparnisResult,
  ExportDatei,
} from "../types";

export interface BuchhaltungDataProvider {
  // ── Belege ─────────────────────────────────────────────────────────────
  listBelege(filter?: BelegFilter): Promise<Beleg[]>;
  getBeleg(id: string): Promise<BelegDetail>;
  createBelegFromUpload(file: BelegFile): Promise<Beleg>;
  freigebenBeleg(id: string, korrektur?: Partial<Beleg>): Promise<Beleg>;
  stornoBeleg(id: string, grund: string): Promise<Beleg>;

  // ── Auswertung ─────────────────────────────────────────────────────────
  getAusgabenNachKategorie(zeitraum: Zeitraum): Promise<KategorieSumme[]>;
  getKraftstoffAuswertung(zeitraum: Zeitraum): Promise<KraftstoffReport>;
  getBwa(zeitraum: Zeitraum): Promise<Bwa>;
  getFixkosten(): Promise<CostItem[]>;
  getVariableKosten(): Promise<CostItem[]>;

  // ── Einnahmen ──────────────────────────────────────────────────────────
  listOffenePosten(): Promise<Ausgangsrechnung[]>;
  listRechnungen(filter?: RechnungFilter): Promise<Ausgangsrechnung[]>;

  // ── Steuer / Export ────────────────────────────────────────────────────
  berechneUstva(zeitraum: Zeitraum): Promise<UstvaWerte>;
  getSteuerprofil(): Promise<Steuerprofil>;
  exportDatev(zeitraum: Zeitraum): Promise<ExportDatei>;
  exportLexware(zeitraum: Zeitraum): Promise<ExportDatei>;
  exportSteuerberaterPaket(zeitraum: Zeitraum): Promise<ExportDatei>;

  // ── Sparzähler ─────────────────────────────────────────────────────────
  getErsparnis(jahr: number): Promise<ErsparnisResult>;
}
