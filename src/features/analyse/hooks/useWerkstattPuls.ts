export interface WerkstattPulsData {
  termintreue: { puenktlich: number; nenner: number; termintreue_pct: number | null; ohne_zusagetermin: number };
  durchlauf: { avg_tage: number; n: number };
  stationen: Array<{ station: string; avg_tage: number; n: number; teile_aktuell: number }>;
  wochenziel: { fertig_diese_woche: number };
  engpass: Array<{ station: string; teile_wartend: number }>;
  snapshotTrend?: { vorjahr: number };
  snapshots: Array<{ kw: string; wert: number | null; vorjahr?: number | null }>;
}

/** @deprecated /analyse redirects to the authorized performance cockpit. */
export function useWerkstattPuls() {
  return {
    data: undefined as WerkstattPulsData | undefined,
    isLoading: false,
    error: new Error("Legacy-Analyse deaktiviert: serverseitigen Performance-Datenadapter verwenden."),
  };
}
