export interface PerformanceScoreInput {
  onTimeRate: number;            // 0..1 (e.g. 0.95 for 95%)
  avgCycleTimeIndex: number;     // e.g. 1.0 (target), 1.5 is 50% worse
  criticalOrders: number;        // number of red/orange risk orders
  complaintRate: number;         // 0..1 (e.g. 0.02 for 2%)
  scanRate: number;              // 0..1
  documentationRate: number;     // 0..1
  stationHealthIndex: number;    // 0..1
}

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

export function computeScore(i: PerformanceScoreInput): number {
  // Alle Eingaben werden auf 0..100 normalisiert (höher = besser)
  const onTime     = clamp(i.onTimeRate * 100, 0, 100);
  const cycle      = clamp(100 - (i.avgCycleTimeIndex - 1) * 50, 0, 100); // index 1 = soll, 1.5 = 50% schlechter -> 75 points
  const critical   = clamp(100 - i.criticalOrders * 15, 0, 100);          // jeder kritische Auftrag kostet 15 Punkte
  const complaints = clamp(100 - i.complaintRate * 100, 0, 100);
  const docs       = clamp(((i.scanRate + i.documentationRate) / 2) * 100, 0, 100);
  const stations   = clamp(i.stationHealthIndex * 100, 0, 100);

  return Math.round(
    onTime     * 0.25 +
    cycle      * 0.20 +
    critical   * 0.20 +
    complaints * 0.15 +
    docs       * 0.10 +
    stations   * 0.10
  );
}
