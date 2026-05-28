export type LicensePlan = "basis" | "pro" | "premium" | "enterprise";
export type LicenseTier = LicensePlan; // Alias for backwards compatibility

export type FeatureKey =
  | "performance_score"
  | "engpass_heatmap"
  | "wochenziel_streaks"
  | "finanzcontrolling"
  | "vorperiode_vergleich"
  | "monatsbericht_pdf"
  | "datev_export"
  | "steuerberater_paket"
  | "materialverbrauch_report"
  | "reklamations_dossier"
  | "umsatz_forecast";

export type DataReadiness = "noch_keine_daten" | "in_aufbau" | "bereit";

export interface FeatureState {
  available: boolean;
  lockReason: "plan" | "datenreife" | null;
  demoValue: boolean;
}

export interface FeatureOverride {
  featureKey: FeatureKey;
  enabled: boolean;
}

// Backwards compatibility for existing UI components
export interface FeatureFlag {
  enabled: boolean;
  dataReadinessState: "reliable" | "thin" | "empty";
  unlockTier?: string;
  hintLong?: string;
  hintShort?: string;
}
