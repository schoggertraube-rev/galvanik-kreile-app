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

export type BathStatus = "critical" | "watch" | "stable" | "not_evaluated";

/**
 * Berechnet den Status eines Bades gemäß der "worst-status-wins" Logik 
 * aus der verbindlichen Korrekturdatei (08_KORREKTUREN_VERBINDLICH_KREILE.md §4.5).
 */
export function computeBathStatus(m: BathMeasurement, t: BathTargetValues): BathStatus {
  const checks: BathStatus[] = [];
  let evaluatedValues = 0;
  let missingConfiguredValue = false;

  if (t.temperatureMin != null || t.temperatureMax != null) {
    if (m.temperature == null) {
      missingConfiguredValue = true;
    } else {
      evaluatedValues += 1;
      if (t.temperatureMin != null && m.temperature < t.temperatureMin) checks.push("critical");
      if (t.temperatureMax != null && m.temperature > t.temperatureMax) checks.push("critical");
    }
  }

  if (t.phMin != null || t.phMax != null) {
    if (m.ph == null) {
      missingConfiguredValue = true;
    } else {
      evaluatedValues += 1;
      if (t.phMin != null && m.ph < t.phMin) checks.push("critical");
      if (t.phMax != null && m.ph > t.phMax) checks.push("critical");
    }
  }

  if (t.concentrationMin != null || t.concentrationMax != null) {
    if (m.concentration == null) {
      missingConfiguredValue = true;
    } else {
      evaluatedValues += 1;
      if (t.concentrationMin != null && m.concentration < t.concentrationMin) checks.push("watch");
      if (t.concentrationMax != null && m.concentration > t.concentrationMax) checks.push("watch");
    }
  }

  if (m.visualState != null) {
    evaluatedValues += 1;
    if (m.visualState === "contaminated") checks.push("critical");
    if (m.visualState === "cloudy") checks.push("watch");
  }

  if (checks.includes("critical")) return "critical";
  if (missingConfiguredValue || evaluatedValues === 0) return "not_evaluated";
  if (checks.includes("watch")) return "watch";
  return "stable";
}

/**
 * Holt die letzte Messung aus dem Repository und berechnet damit den Status.
 * Wenn keine Messung vorliegt, wird standardmäßig "stable" zurückgegeben.
 */
export async function computeCurrentBathStatus(bathId: string, t: BathTargetValues): Promise<BathStatus> {
  const { bathMeasurementsRepository } = await import("../repositories/bathMeasurementsRepository");
  const latestMeasurement = await bathMeasurementsRepository.getLatest(bathId);
  if (!latestMeasurement) {
    return "not_evaluated";
  }
  return computeBathStatus(latestMeasurement, t);
}
