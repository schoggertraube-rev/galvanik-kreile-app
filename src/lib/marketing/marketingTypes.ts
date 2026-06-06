/* ═══════════════════════════════════════════════════════════
   Marketing Studio — Core Types
   Spec: 20 (Hauptspec), 21 (Datenmodell), 26 (UI)
   ═══════════════════════════════════════════════════════════ */

/** Kanal-Identifikator */
export type KanalId = 'instagram' | 'email' | 'google' | 'web';

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
  score: number;
  caption: string;
  hashtags: string;
  begruendung: string;
  erwarteterOutput: string;     // z.B. "~4 Anfragen"
  aufwand: string;              // z.B. "2 Min"
  kosten: string;               // z.B. "0 €"
  varianten: PostVariante[];
  segment?: string;
  quelle?: string;              // z.B. "Auftrag #8043"
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

/** Funnel-Stufe (Reichweite-View) */
export interface FunnelStufe {
  label: string;
  wert: number;
  breite: number;                // % (0..100)
}

/** Funnel-Daten komplett */
export interface FunnelDaten {
  stufen: FunnelStufe[];
  umsatz: number;
  roi: number;
}

/** Kundensegment */
export interface Segment {
  id: string;
  name: string;
  emoji: string;
  kundenAnzahl: number;
  weckbar: number;
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
  wert: number;
  suffix: string;                // z.B. "€", "×", ""
  divisor?: number;              // z.B. 10 für "9,1×"
  sparkValues: number[];         // 7 Werte für Mini-Sparkline
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
