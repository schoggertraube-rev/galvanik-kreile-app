'use server';

import { createAuthorizedDataClient } from '@/lib/supabase/server';
import type { WorkEntry, MaterialEntry, ExtraCostEntry } from '@/lib/orders/costCalculation';

// ─────────────────────────────────────────────
// Book station costs (Erfassung buchen)
// ─────────────────────────────────────────────
export async function bookStationCosts(params: {
  orderId: string;
  station: string;
  workEntries: WorkEntry[];
  consumableEntries: MaterialEntry[];
  extraCostEvents: ExtraCostEntry[];
  employeeId: string;
  kostenstelleKuerzel: string;
}) {
  void params;
  return { success: false, errors: ['NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt.'] };
}

// ─────────────────────────────────────────────
// Get station cost summary (bisherige Buchungen)
// ─────────────────────────────────────────────
export async function getStationCostSummary(orderId: string) {
  void orderId;
  return { success: false, error: 'NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt.' };
}

// ─────────────────────────────────────────────
// Get benchmark data for a station
// ─────────────────────────────────────────────
export async function getBenchmarkData(station: string) {
  const supabase = await createAuthorizedDataClient('read');

  const { data: zeitVorlagen } = await supabase
    .from('vorlage_zeit')
    .select('*')
    .eq('station_kuerzel', station)
    .eq('tenant_id', 'galvanik-kreile');

  const { data: verbrauchVorlagen } = await supabase
    .from('vorlage_verbrauch')
    .select('*')
    .eq('station_kuerzel', station)
    .eq('tenant_id', 'galvanik-kreile')
    .gte('haeufigkeit_prozent', 50);

  // Get Kostensatz
  const { data: kostensatzRow } = await supabase
    .from('kostenstelle')
    .select('kuerzel, kostensatz_plan_eur_pro_stunde')
    .eq('tenant_id', 'galvanik-kreile')
    .eq('kuerzel', station)
    .single();

  return {
    zeitVorlagen: zeitVorlagen || [],
    verbrauchVorlagen: verbrauchVorlagen || [],
    kostensatzEurProStunde: kostensatzRow?.kostensatz_plan_eur_pro_stunde || null,
  };
}
