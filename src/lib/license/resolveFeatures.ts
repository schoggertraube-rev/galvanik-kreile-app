import { LicensePlan, FeatureKey, DataReadiness, FeatureState, FeatureOverride } from "./types";
import { PLAN_MATRIX } from "./planMatrix";

export function resolveFeatures(
  plan: LicensePlan,
  readiness: Record<FeatureKey, DataReadiness>,
  overrides?: FeatureOverride[]
): Record<FeatureKey, FeatureState> {
  const result = {} as Record<FeatureKey, FeatureState>;
  const allowedByPlan = new Set(PLAN_MATRIX[plan]);
  
  const overrideMap = new Map<FeatureKey, boolean>();
  if (overrides) {
    overrides.forEach(o => overrideMap.set(o.featureKey, o.enabled));
  }

  // Iterate through all feature keys found in readiness object
  // (We use readiness keys to ensure we cover all features)
  const allFeatures = Object.keys(readiness) as FeatureKey[];

  for (const feature of allFeatures) {
    // a) Feature durch Plan freigeschaltet? (Matrix + Override)
    let isPlanAllowed = allowedByPlan.has(feature);
    
    // Override hat Vorrang vor Plan-Matrix
    if (overrideMap.has(feature)) {
      isPlanAllowed = overrideMap.get(feature)!;
    }

    // b) Datenreife "bereit"? 
    const isDataReady = readiness[feature] === "bereit";

    // d) lockReason: "plan" wenn Plan fehlt; sonst "datenreife" wenn nicht bereit; sonst null
    let lockReason: "plan" | "datenreife" | null = null;
    
    // c) available = true nur wenn beide erfüllt.
    // However, the rule e) specifies Override kann Datenreife NICHT überschreiben.
    if (!isPlanAllowed) {
      lockReason = "plan";
    } else if (!isDataReady) {
      lockReason = "datenreife";
    }

    const available = isPlanAllowed && isDataReady;

    result[feature] = {
      available,
      lockReason,
      // Default demoValue to false, we can expand on this if requested later
      demoValue: false
    };
  }

  return result;
}
