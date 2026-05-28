import { useLicense } from "./LicenseContext";
import { resolveFeatures } from "./resolveFeatures";
import { FeatureKey, FeatureState, UserLicenseRole } from "./types";

export function useFeatureFlag(key: FeatureKey): FeatureState & { role: UserLicenseRole } {
  const { plan, role, readiness, overrides } = useLicense();
  
  const allFeatures = resolveFeatures(plan, readiness, overrides);
  const state = allFeatures[key];

  return {
    ...state,
    role,
  };
}
