export type BathMeasurement = {
  temperature?: number | null;
  ph?: number | null;
  concentration?: number | null;
  visualState?: "clean" | "cloudy" | "contaminated" | string | null;
};

export type BathTargetValues = {
  temperatureMin?: number | null;
  temperatureMax?: number | null;
  phMin?: number | null;
  phMax?: number | null;
  concentrationMin?: number | null;
  concentrationMax?: number | null;
};

export type BathStatus = "critical" | "watch" | "stable";

/**
 * Berechnet den Status eines Bades gemäß der "worst-status-wins" Logik 
 * aus der verbindlichen Korrekturdatei (08_KORREKTUREN_VERBINDLICH_KREILE.md §4.5).
 */
export function computeBathStatus(m: BathMeasurement, t: BathTargetValues): BathStatus {
  const checks: BathStatus[] = [];

  if (t.temperatureMin != null && m.temperature != null && m.temperature < t.temperatureMin) checks.push("critical");
  if (t.temperatureMax != null && m.temperature != null && m.temperature > t.temperatureMax) checks.push("critical");
  if (t.phMin != null && m.ph != null && m.ph < t.phMin) checks.push("critical");
  if (t.phMax != null && m.ph != null && m.ph > t.phMax) checks.push("critical");

  if (t.concentrationMin != null && m.concentration != null && m.concentration < t.concentrationMin) checks.push("watch");
  if (t.concentrationMax != null && m.concentration != null && m.concentration > t.concentrationMax) checks.push("watch");

  if (m.visualState === "contaminated") checks.push("critical");
  if (m.visualState === "cloudy") checks.push("watch");

  if (checks.includes("critical")) return "critical";
  if (checks.includes("watch")) return "watch";
  return "stable";
}
