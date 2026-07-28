'use server';

import { createClient } from '@/lib/supabase/server';
import type { WorkEntry, MaterialEntry, ExtraCostEntry } from '@/lib/orders/costCalculation';
import { db } from "@/db";
import { arbeitszeitBuchung, events } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/permissions";
import { foundationUnavailableAction, isFoundationAreaEnabled } from '@/lib/server/foundationGate';

function assertOrderCostContract(): void {
  if (!isFoundationAreaEnabled('Auftragskosten und Verbrauchsbuchung')) {
    foundationUnavailableAction('Auftragskosten und Verbrauchsbuchung');
  }
}

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
  assertOrderCostContract();
  const supabase = await createClient();
  const { orderId, station, workEntries, consumableEntries, extraCostEvents, employeeId, kostenstelleKuerzel } = params;
  const errors: string[] = [];

  // Resolve active employee ID on the server
  let realEmployeeId = employeeId;
  if (employeeId === '00000000-0000-0000-0000-000000000000' || !employeeId) {
    try {
      const user = await getCurrentAppUser();
      if (!user) {
        return { success: false, errors: ['Für den angemeldeten Benutzer ist kein Mitarbeiterkonto hinterlegt.'] };
      }
      realEmployeeId = user.id;
    } catch (authError) {
      return { success: false, errors: ['Für den angemeldeten Benutzer ist kein Mitarbeiterkonto hinterlegt.'] };
    }
  }

  // Atomically book work entries and create the event log via Drizzle transaction
  try {
    await db.transaction(async (tx) => {
      // 1) Arbeitszeit → arbeitszeit_buchung
      for (const entry of workEntries) {
        if (entry.minutes <= 0) continue;
        await tx.insert(arbeitszeitBuchung).values({
          tenantId: 'galvanik-kreile',
          auftragId: orderId,
          employeeId: realEmployeeId,
          kostenstelleKuerzel: kostenstelleKuerzel,
          stationKuerzel: station,
          startZeit: new Date(),
          dauerMinuten: entry.minutes,
          kostensatzEurProStunde: String(entry.costPerHour),
          erfasstModus: 'rueckwirkend',
          bemerkung: entry.step,
        });
      }

      // 4) Event-Log -> events (using correct column userId instead of non-existent created_by)
      await tx.insert(events).values({
        tenantId: 'galvanik-kreile',
        orderId: orderId,
        eventType: 'STATION_COST_BOOKED',
        description: `Erfassung ${station} gebucht`,
        userId: realEmployeeId,
      });
    });
  } catch (txError: unknown) {
    console.error("Drizzle transaction failed in bookStationCosts:", txError);
    const message = txError instanceof Error ? txError.message : String(txError);
    return { success: false, errors: [`Datenbankfehler bei der Buchung: ${message}`] };
  }

  // 2) Material → consumable_uses (inserted via Supabase client, since table is not in Drizzle schema)
  for (const mat of consumableEntries) {
    if (mat.quantity <= 0) continue;
    const { error } = await supabase.from('consumable_uses').insert({
      tenant_id: 'galvanik-kreile',
      order_id: orderId,
      station_kuerzel: station,
      inventory_item_id: mat.inventoryItemId || null,
      item_name: mat.itemName,
      quantity: mat.quantity,
      unit: 'stk',
      unit_cost_eur: mat.unitCostEur,
      vorlage_id: mat.vorlageId || null,
      erfasst_von: realEmployeeId,
    });
    if (error) errors.push(`Material "${mat.itemName}": ${error.message} ${error.details || ''} ${error.hint || ''}`);
  }

  // 3) Extras → order_cost_events (inserted via Supabase client, since table is not in Drizzle schema)
  for (const extra of extraCostEvents) {
    if (!extra.active || extra.costEur <= 0) continue;
    const { error } = await supabase.from('order_cost_events').insert({
      tenant_id: 'galvanik-kreile',
      order_id: orderId,
      event_type: extra.eventType,
      amount_eur: extra.costEur,
      reason: extra.name,
      caused_by: extra.causedBy,
      source: 'erfassung',
    });
    if (error) errors.push(`Extra "${extra.name}": ${error.message} ${error.details || ''} ${error.hint || ''}`);
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }
  return { success: true, errors: [] };
}

// ─────────────────────────────────────────────
// Get station cost summary (bisherige Buchungen)
// ─────────────────────────────────────────────
export async function getStationCostSummary(orderId: string) {
  assertOrderCostContract();
  const supabase = await createClient();

  // Arbeitszeit pro Station
  const { data: zeitData, error: zeitErr } = await supabase
    .from('arbeitszeit_buchung')
    .select('station_kuerzel, dauer_minuten, kostensatz_eur_pro_stunde')
    .eq('auftrag_id', orderId);

  if (zeitErr) console.error('getStationCostSummary zeit:', zeitErr.message, zeitErr.details, zeitErr.hint);

  // Material pro Station
  const { data: matData, error: matErr } = await supabase
    .from('consumable_uses')
    .select('station_kuerzel, quantity, unit_cost_eur')
    .eq('order_id', orderId);

  if (matErr) console.error('getStationCostSummary material:', matErr.message, matErr.details, matErr.hint);

  // Extra Kosten
  const { data: extraData, error: extraErr } = await supabase
    .from('order_cost_events')
    .select('amount_eur, reason, caused_by')
    .eq('order_id', orderId);

  if (extraErr) console.error('getStationCostSummary extras:', extraErr.message, extraErr.details, extraErr.hint);

  // Aggregate by station
  const stationMap: Record<string, { zeitMin: number; zeitEur: number; matEur: number; extraEur: number }> = {};
  const ensureStation = (s: string) => {
    if (!stationMap[s]) stationMap[s] = { zeitMin: 0, zeitEur: 0, matEur: 0, extraEur: 0 };
  };

  for (const z of zeitData || []) {
    ensureStation(z.station_kuerzel);
    stationMap[z.station_kuerzel].zeitMin += z.dauer_minuten;
    stationMap[z.station_kuerzel].zeitEur += (z.dauer_minuten / 60) * z.kostensatz_eur_pro_stunde;
  }
  for (const m of matData || []) {
    ensureStation(m.station_kuerzel);
    stationMap[m.station_kuerzel].matEur += m.quantity * m.unit_cost_eur;
  }

  const totalExtraEur = (extraData || []).reduce((s, e) => s + Number(e.amount_eur), 0);

  const totalZeitEur = Object.values(stationMap).reduce((s, v) => s + v.zeitEur, 0);
  const totalMatEur = Object.values(stationMap).reduce((s, v) => s + v.matEur, 0);
  const totalZeitMin = Object.values(stationMap).reduce((s, v) => s + v.zeitMin, 0);

  return {
    stations: stationMap,
    totals: {
      zeitMin: totalZeitMin,
      zeitEur: totalZeitEur,
      matEur: totalMatEur,
      extraEur: totalExtraEur,
      gesamtEur: totalZeitEur + totalMatEur + totalExtraEur,
    },
  };
}

// ─────────────────────────────────────────────
// Get benchmark data for a station
// ─────────────────────────────────────────────
export async function getBenchmarkData(station: string) {
  assertOrderCostContract();
  const supabase = await createClient();

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
