import { LicensePlan, FeatureKey, DataReadiness, FeatureOverride, UserLicenseRole } from "@/lib/license/types";

export const DEFAULT_PLAN: LicensePlan = "pro";
export const DEFAULT_ROLE: UserLicenseRole = "inhaber";

export const DEFAULT_READINESS: Record<FeatureKey, DataReadiness> = {
  performance_score: "bereit",
  engpass_heatmap: "bereit",
  wochenziel_streaks: "bereit",
  finanzcontrolling: "bereit",
  vorperiode_vergleich: "bereit",
  monatsbericht_pdf: "bereit",
  datev_export: "bereit",
  steuerberater_paket: "bereit",
  materialverbrauch_report: "bereit",
  reklamations_dossier: "bereit",
  umsatz_forecast: "bereit"
};

export const DEFAULT_OVERRIDES: FeatureOverride[] = [];

export const QUOTA_CONFIG = {
  limit: 1000,
  currentUsage: 900
};
