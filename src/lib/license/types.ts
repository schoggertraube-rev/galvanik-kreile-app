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
  | "umsatz_forecast"
  // Buchhaltung Stufe 1
  | "buchhaltung_belege"
  | "buchhaltung_export"
  | "buchhaltung_ustva"
  | "buchhaltung_erechnung"
  // Buchhaltung Stufe 2 (Feature-Flag gesteuert)
  | "bank_anbindung"
  | "elster_direkt"
  | "zahlungsdienstleister";

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

export type UserLicenseRole = "inhaber" | "mitarbeiter" | "demo";

// Backwards compatibility for existing UI components
export interface FeatureFlag {
  enabled: boolean;
  dataReadinessState: "reliable" | "thin" | "empty";
  unlockTier?: string;
  hintLong?: string;
  hintShort?: string;
}
