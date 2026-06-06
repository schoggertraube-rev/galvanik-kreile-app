/**
 * Cross-KPI formulas with thresholds.
 * Each formula computes a ratio between two KPI values
 * and classifies the result as gut/beobachten/kritisch.
 */

import type { MeaningLevel } from "./plainLanguage";

export type CrossKpiKey =
  | "energy_per_revenue"
  | "energy_per_order"
  | "energy_per_kwh"
  | "energy_per_db"
  | "material_per_revenue"
  | "cost_per_order";

export interface CrossKpiResult {
  key: CrossKpiKey;
  label: string;
  value: number | null;       // null = cannot compute (missing input)
  displayValue: string;       // formatted for display, e.g. "23 ct"
  unit: string;
  delta: string | null;       // e.g. "▲ +4 ct"
  level: MeaningLevel;
  missingInput?: string;      // e.g. "Stromverbrauch in kWh"
}

export interface CrossKpiDef {
  key: CrossKpiKey;
  label: string;
  unit: string;
  numeratorLabel: string;
  denominatorLabel: string;
  thresholdWarn: number;
  thresholdCrit: number;
  higherIsWorse: boolean;
  format: (value: number) => string;
}

export const CROSS_KPI_DEFS: Record<string, CrossKpiDef[]> = {
  energy_costs: [
    {
      key: "energy_per_revenue",
      label: "Energie je Umsatz-Euro",
      unit: "ct",
      numeratorLabel: "Energiekosten",
      denominatorLabel: "Umsatz netto",
      thresholdWarn: 0.15,
      thresholdCrit: 0.20,
      higherIsWorse: true,
      format: (v) => `${Math.round(v * 100)} ct`,
    },
    {
      key: "energy_per_order",
      label: "Energie je Auftrag",
      unit: "€",
      numeratorLabel: "Energiekosten",
      denominatorLabel: "Anzahl Aufträge",
      thresholdWarn: 200,
      thresholdCrit: 300,
      higherIsWorse: true,
      format: (v) => `${Math.round(v)} €`,
    },
    {
      key: "energy_per_kwh",
      label: "Preis je kWh",
      unit: "ct/kWh",
      numeratorLabel: "Energiekosten",
      denominatorLabel: "Energie in kWh",
      thresholdWarn: 0.35,
      thresholdCrit: 0.45,
      higherIsWorse: true,
      format: (v) => `${(v * 100).toFixed(1)} ct`,
    },
    {
      key: "energy_per_db",
      label: "Anteil am Deckungsbeitrag",
      unit: "%",
      numeratorLabel: "Energiekosten",
      denominatorLabel: "Deckungsbeitrag",
      thresholdWarn: 0.70,
      thresholdCrit: 0.85,
      higherIsWorse: true,
      format: (v) => `${Math.round(v * 100)} %`,
    },
  ],
  on_time_rate: [
    {
      key: "cost_per_order",
      label: "Kosten je Auftrag",
      unit: "€",
      numeratorLabel: "Gesamtkosten",
      denominatorLabel: "Aufträge",
      thresholdWarn: 250,
      thresholdCrit: 350,
      higherIsWorse: true,
      format: (v) => `${Math.round(v)} €`,
    },
  ],
};

/**
 * Classify a cross-KPI value against thresholds.
 */
export function classifyLevel(
  value: number,
  def: CrossKpiDef,
): MeaningLevel {
  if (def.higherIsWorse) {
    if (value >= def.thresholdCrit) return "kritisch";
    if (value >= def.thresholdWarn) return "beobachten";
    return "gut";
  }
  // lower is worse (e.g. margin)
  if (value <= def.thresholdCrit) return "kritisch";
  if (value <= def.thresholdWarn) return "beobachten";
  return "gut";
}
