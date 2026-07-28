import { useMemo } from "react";

export interface WerkstattPulsData {
  termintreue: { puenktlich: number; nenner: number; termintreue_pct: number | null; ohne_zusagetermin: number };
  durchlauf: { avg_tage: number; n: number };
  stationen: Array<{ station: string; avg_tage: number; n: number; teile_aktuell: number }>;
  wochenziel: { fertig_diese_woche: number };
  engpass: Array<{ station: string; teile_wartend: number }>;
  snapshotTrend?: { vorjahr: number };
  snapshots: Array<{ kw: string; wert: number | null; vorjahr?: number | null }>;
}

/**
 * No browser-side reads of unverified performance views.  In particular, an
 * unavailable source is not converted to zeros, a trend, or a stable status.
 */
export function useWerkstattPuls() {
  return useMemo(() => ({
    data: undefined as WerkstattPulsData | undefined,
    isLoading: false,
    error: new Error("NOT_CONFIGURED: Werkstatt-Puls benötigt einen geprüften Evidenzvertrag."),
  }), []);
}
