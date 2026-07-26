'use server';

import type { WorkEntry, MaterialEntry, ExtraCostEntry } from '@/lib/orders/costCalculation';

const LEGACY_ORDER_COST_FLOW_RETIRED =
  'Diese frühere Demo-Erfassung ist nicht an den produktiven, atomaren Buchungspfad angeschlossen und bleibt deshalb gesperrt. Nutze den bestätigten Stationsabschluss.';

type LegacyStationCost = {
  zeitMin: number;
  zeitEur: number;
  matEur: number;
  extraEur: number;
};

type LegacyTimeTemplate = {
  taetigkeit: string;
  n_referenzauftraege: number;
  dauer_median_minuten: number;
};

type LegacyMaterialTemplate = {
  id: string;
  artikel_name: string;
  menge_median: number;
  einzelpreis_eur: number;
  inventory_item_id?: string;
  einheit: string;
};

// ─────────────────────────────────────────────
// Book station costs (Erfassung buchen)
// ─────────────────────────────────────────────
export async function bookStationCosts(params: {
  orderId: string;
  station: string;
  workEntries: WorkEntry[];
  consumableEntries: MaterialEntry[];
  extraCostEvents: ExtraCostEntry[];
  kostenstelleKuerzel: string;
}) {
  void params;
  return { success: false as const, errors: [LEGACY_ORDER_COST_FLOW_RETIRED] };
}

// ─────────────────────────────────────────────
// Get station cost summary (bisherige Buchungen)
// ─────────────────────────────────────────────
export async function getStationCostSummary(orderId: string) {
  void orderId;
  const stations: Record<string, LegacyStationCost> = {};
  return {
    available: false,
    message: LEGACY_ORDER_COST_FLOW_RETIRED,
    stations,
    totals: {
      zeitMin: 0,
      zeitEur: 0,
      matEur: 0,
      extraEur: 0,
      gesamtEur: 0,
    },
  };
}

// ─────────────────────────────────────────────
// Get benchmark data for a station
// ─────────────────────────────────────────────
export async function getBenchmarkData(station: string) {
  void station;
  const zeitVorlagen: LegacyTimeTemplate[] = [];
  const verbrauchVorlagen: LegacyMaterialTemplate[] = [];
  return {
    available: false,
    message: LEGACY_ORDER_COST_FLOW_RETIRED,
    zeitVorlagen,
    verbrauchVorlagen,
    kostensatzEurProStunde: null,
  };
}
