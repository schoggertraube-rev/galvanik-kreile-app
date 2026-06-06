/* ═══════════════════════════════════════════════════════════
   Marketing Statistik — Types
   Spec: 27 §6 (Statistik-Erweiterung)
   ═══════════════════════════════════════════════════════════ */

/** Verfügbare Metriken */
export type StatistikMetrik =
  | 'zufriedenheit'
  | 'google_rating'
  | 'google_count'
  | 'web_visits'
  | 'google_impressions'
  | 'foto_ruecklauf'
  | 'bewertung_klickrate';

/** Einzelner Datenpunkt */
export interface StatistikKennzahl {
  id: string;
  metrik: StatistikMetrik;
  periode: string;             // YYYY-MM-DD oder YYYY-MM
  wert: number;
  quelle: 'feedback' | 'google_api' | 'web_analytics' | 'manuell';
  aktualisiertAm: string;
}

/** Aggregierte Übersicht für die UI */
export interface StatistikUebersicht {
  zufriedenheit: { durchschnitt: number; anzahl: number; trend: 'up' | 'down' | 'stable' };
  googleBewertungen: { durchschnitt: number; anzahl: number; trend: 'up' | 'down' | 'stable' };
  websiteAufrufe: { gesamt: number; trend: 'up' | 'down' | 'stable' };
  fotoRuecklauf: { quote: number; anzahl: number };
  bewertungsKlickrate: { quote: number };
}

/** Demo-Daten für die Statistik */
export const DEMO_STATISTIK: StatistikUebersicht = {
  zufriedenheit: { durchschnitt: 4.7, anzahl: 42, trend: 'up' },
  googleBewertungen: { durchschnitt: 4.8, anzahl: 28, trend: 'up' },
  websiteAufrufe: { gesamt: 1240, trend: 'up' },
  fotoRuecklauf: { quote: 0.34, anzahl: 14 },
  bewertungsKlickrate: { quote: 0.52 },
};
