import { LicensePlan, FeatureKey } from "./types";

const ALL_FEATURES: FeatureKey[] = [
  "performance_score",
  "engpass_heatmap",
  "wochenziel_streaks",
  "finanzcontrolling",
  "vorperiode_vergleich",
  "monatsbericht_pdf",
  "datev_export",
  "steuerberater_paket",
  "materialverbrauch_report",
  "reklamations_dossier",
  "umsatz_forecast",
  // Buchhaltung Stufe 1
  "buchhaltung_belege",
  "buchhaltung_export",
  "buchhaltung_ustva",
  "buchhaltung_erechnung",
];

export const PLAN_MATRIX: Record<LicensePlan, FeatureKey[]> = {
  basis: [],
  pro: ALL_FEATURES,
  premium: ALL_FEATURES,
  enterprise: ALL_FEATURES,
};
