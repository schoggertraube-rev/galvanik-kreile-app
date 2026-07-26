/* ═══════════════════════════════════════════════════════════
   Marketing Studio — Core Types
   Spec: 20 (Hauptspec), 21 (Datenmodell), 26 (UI)
   ═══════════════════════════════════════════════════════════ */

/** Kanal-Identifikator */
export type KanalId = 'instagram' | 'email' | 'google' | 'web' | 'unknown';

/** Sortier-Modi für Vorschläge (Spec 20 §4) */
export type SortMode = 'output' | 'einfach' | 'relevanz' | 'kanal';

/** Variante eines Posts (Feed/Detail/Reel) */
export interface PostVariante {
  titel: string;
  caption: string;
  hashtags: string;
}

/** Einzelne Marketing-Aktions-Empfehlung */
export interface AktionVorschlag {
  id: string;
  titel: string;
  kanal: KanalId;
  kanalLabel: string;
  score: number | null;
  caption: string;
  hashtags: string;
  begruendung: string;
  erwarteterOutput: string;     // z.B. "~4 Anfragen"
  aufwand: string;              // z.B. "2 Min"
  kosten: string;               // z.B. "0 €"
  varianten: PostVariante[];
  segment?: string;
  quelle?: string;              // z.B. "Auftrag #8043"
  /** Persisted, explicitly approved marketing asset. Never inferred in the browser. */
  assetId?: string;
  status: 'vorschlag' | 'geplant' | 'freigegeben' | 'ausgefuehrt' | 'fehler';
  publishCapability: 'proposal_only' | 'not_supported' | 'ready';
  publishReason: string;
}

/** Kampagne (Bündel von Aktionen) */
export interface Kampagne {
  id: string;
  titel: string;
  kanal: string;
  status: 'aktiv' | 'geplant' | 'abgeschlossen';
  statusLabel: string;
  fortschritt: number;           // 0..100
  ergebnis: string;              // z.B. "+3.200 €" oder "Prognose +1.800 €"
  statusColor: string;           // CSS color
}

/** Kanonischer Wahrheitszustand einer gespeicherten Marketing-Messung. */
export type MarketingMetricState = 'ready' | 'confirmed_empty' | 'partial' | 'not_measured';

export interface MarketingMetricCoverage {
  sourceCount: number;
  measuredCount: number;
  missingCount: number;
}

/** Funnel-Stufe (Reichweite-View) */
export interface FunnelStufe {
  label: string;
  wert: number | null;
  breite: number;                // % (0..100)
  dataState: MarketingMetricState;
  coverage: MarketingMetricCoverage;
}

/** Funnel-Daten komplett */
export interface FunnelDaten {
  stufen: FunnelStufe[];
  umsatz: number | null;
  umsatzState: MarketingMetricState;
  umsatzCoverage: MarketingMetricCoverage;
  plannedBudget: number | null;
  roi: number | null;
}

/** Kundensegment */
export interface Segment {
  id: string;
  name: string;
  emoji: string;
  kundenAnzahl: number | null;
  weckbar: number | null;
  evidence: 'membership_not_connected';
}

/** Lern-Insight ("GELERNT"-Karte) */
export interface LernInsight {
  id: string;
  titel: string;
  text: string;                  // kann <b> HTML enthalten
  konfidenz?: number;
  datenbasis?: string;
}

/** Wirkung-Mini-Karte */
export interface WirkungMini {
  label: string;
  wert: number | null;
  suffix: string;                // z.B. "€", "×", ""
  divisor?: number;              // z.B. 10 für "9,1×"
  sparkValues: number[];         // 7 Werte für Mini-Sparkline
  dataState: MarketingMetricState;
  coverage: MarketingMetricCoverage;
}

/** Story-Idee für das Karussell */
export interface StoryIdee {
  id: string;
  label: string;
  caption: string;
  hashtags: string;
  titel: string;
  icon: string;                  // Lucide icon name
  isAdd?: boolean;               // "Eigene Idee" Platzhalter
}

/** Provider-Interface (Spec 21 §4) */
export interface MarketingDataProvider {
  getBesteAktion(): Promise<AktionVorschlag>;
  listVorschlaege(sort?: SortMode): Promise<AktionVorschlag[]>;
  getKampagnen(): Promise<Kampagne[]>;
  getFunnel(): Promise<FunnelDaten>;
  getSegmente(): Promise<Segment[]>;
  getLernInsights(): Promise<LernInsight[]>;
  getWirkungMini(): Promise<WirkungMini[]>;
  getStoryIdeen(): Promise<StoryIdee[]>;
}
