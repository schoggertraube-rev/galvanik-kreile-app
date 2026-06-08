"use server"

import { createClient } from '@/utils/supabase/server';
import { getKostensatz, getEinkaufspreis } from '@/lib/erfassung/snapshot';

export async function startZeit(input: {
  auftrag_id: string;
  employee_id: string;
  station_kuerzel: string;
}) {
  const supabase = await createClient();

  // 1. Check existing timer
  const { data: existing } = await supabase
    .from('arbeitszeit_buchung')
    .select('id')
    .eq('employee_id', input.employee_id)
    .is('end_zeit', null)
    .maybeSingle();

  if (existing) {
    return { error: 'Laufender Timer existiert bereits' };
  }

  // 2. Get kostensatz
  const { kostensatz } = await getKostensatz(supabase, input.employee_id, input.station_kuerzel, 'galvanik-kreile');

  if (kostensatz === null) {
    return {
      error: 'Kostensatz fehlt',
      hinweis: 'Bitte Inhaber: Kostensatz für Mitarbeiter oder Station hinterlegen'
    };
  }

  // 3. Insert
  const { data: buchung, error } = await supabase
    .from('arbeitszeit_buchung')
    .insert({
      tenant_id: 'galvanik-kreile',
      auftrag_id: input.auftrag_id,
      employee_id: input.employee_id,
      kostenstelle_kuerzel: input.station_kuerzel,
      station_kuerzel: input.station_kuerzel,
      start_zeit: new Date().toISOString(),
      dauer_minuten: 0,
      kostensatz_eur_pro_stunde: kostensatz,
      erfasst_modus: 'live_timer'
    })
    .select('id, start_zeit')
    .single();

  if (error) {
    return { error: 'Fehler beim Starten des Timers: ' + error.message };
  }

  // 4. Audit Log
  await supabase.from('audit_log').insert({
    action: 'timer_start',
    table_name: 'arbeitszeit_buchung',
    record_id: buchung.id,
    actor_id: input.employee_id,
    payload: { auftrag_id: input.auftrag_id, station_kuerzel: input.station_kuerzel }
  });

  return { success: true, buchung_id: buchung.id, start_zeit: buchung.start_zeit };
}

export async function stopZeit(input: {
  buchung_id: string;
  korrektur_minuten?: number;
}) {
  const supabase = await createClient();

  // 1. Get running timer
  const { data: timer, error: timerError } = await supabase
    .from('arbeitszeit_buchung')
    .select('id, start_zeit, kostensatz_eur_pro_stunde, employee_id')
    .eq('id', input.buchung_id)
    .is('end_zeit', null)
    .single();

  if (timerError || !timer) {
    return { error: 'Kein laufender Timer gefunden' };
  }

  // 2. Calculate duration
  const now = new Date();
  const start = new Date(timer.start_zeit);
  const diffMinutes = Math.round((now.getTime() - start.getTime()) / 60000);
  const dauer = input.korrektur_minuten ?? diffMinutes;

  // 3. Update
  const { error: updateError } = await supabase
    .from('arbeitszeit_buchung')
    .update({
      end_zeit: now.toISOString(),
      dauer_minuten: dauer
    })
    .eq('id', input.buchung_id);

  if (updateError) {
    return { error: 'Fehler beim Stoppen des Timers: ' + updateError.message };
  }

  // 4. Audit Log
  await supabase.from('audit_log').insert({
    action: 'timer_stop',
    table_name: 'arbeitszeit_buchung',
    record_id: input.buchung_id,
    actor_id: timer.employee_id,
    payload: { dauer_minuten: dauer }
  });

  const kosten = (dauer / 60) * timer.kostensatz_eur_pro_stunde;
  return { success: true, dauer_minuten: dauer, kosten_eur: kosten };
}

export async function erfasseZeitDirekt(input: {
  auftrag_id: string;
  employee_id: string;
  station_kuerzel: string;
  dauer_minuten: number;
  datum?: string;
  war_aus_vorlage?: boolean;
  vorlage_id?: string;
}) {
  const supabase = await createClient();

  // 1. Get kostensatz
  const { kostensatz } = await getKostensatz(supabase, input.employee_id, input.station_kuerzel, 'galvanik-kreile');

  if (kostensatz === null) {
    return {
      error: 'Kostensatz fehlt',
      hinweis: 'Bitte Inhaber: Kostensatz für Mitarbeiter oder Station hinterlegen'
    };
  }

  const startDatum = input.datum ? new Date(input.datum + 'T08:00:00') : new Date(new Date().toISOString().split('T')[0] + 'T08:00:00');
  const endDatum = new Date(startDatum.getTime() + input.dauer_minuten * 60000);

  // 2. Insert
  const { data: buchung, error } = await supabase
    .from('arbeitszeit_buchung')
    .insert({
      tenant_id: 'galvanik-kreile',
      auftrag_id: input.auftrag_id,
      employee_id: input.employee_id,
      kostenstelle_kuerzel: input.station_kuerzel,
      station_kuerzel: input.station_kuerzel,
      start_zeit: startDatum.toISOString(),
      end_zeit: endDatum.toISOString(),
      dauer_minuten: input.dauer_minuten,
      kostensatz_eur_pro_stunde: kostensatz,
      erfasst_modus: input.war_aus_vorlage ? 'aus_vorlage' : 'rueckwirkend',
      war_aus_vorlage: input.war_aus_vorlage ?? false,
      vorlage_id: input.vorlage_id || null
    })
    .select('id')
    .single();

  if (error) {
    return { error: 'Fehler beim Speichern der Zeit: ' + error.message };
  }

  // 3. Audit Log
  await supabase.from('audit_log').insert({
    action: 'zeit_erfasst',
    table_name: 'arbeitszeit_buchung',
    record_id: buchung.id,
    actor_id: input.employee_id,
    payload: { dauer_minuten: input.dauer_minuten, modus: input.war_aus_vorlage ? 'aus_vorlage' : 'rueckwirkend' }
  });

  const kosten = (input.dauer_minuten / 60) * kostensatz;
  return { success: true, buchung_id: buchung.id, kosten_eur: kosten };
}

export async function erfasseVerbrauch(input: {
  auftrag_id: string;
  inventory_item_id: string;
  menge: number;
  station_kuerzel: string;
  employee_id: string;
  war_aus_vorlage?: boolean;
  vorlage_id?: string;
}) {
  const supabase = await createClient();

  // 1. Get einkaufspreis
  const einkaufspreis = await getEinkaufspreis(supabase, input.inventory_item_id);

  if (einkaufspreis === null) {
    return {
      error: 'Einkaufspreis fehlt',
      hinweis: 'Bitte Einkaufspreis für Artikel hinterlegen'
    };
  }

  // 2. Insert stock_movements
  const { data: movement, error } = await supabase
    .from('stock_movements')
    .insert({
      tenant_id: 'galvanik-kreile',
      order_id: input.auftrag_id,
      inventory_item_id: input.inventory_item_id,
      quantity: -input.menge, // negative for consumption
      movement_type: 'verbrauch',
      reason: 'Auftrag ' + input.auftrag_id,
      kostenstelle_kuerzel: input.station_kuerzel,
      station_kuerzel: input.station_kuerzel,
      erfasst_von: input.employee_id,
      war_aus_vorlage: input.war_aus_vorlage ?? false,
      vorlage_id: input.vorlage_id || null,
      snapshot_einkaufspreis_eur: einkaufspreis
    })
    .select('id')
    .single();

  if (error) {
    return { error: 'Fehler beim Buchen des Verbrauchs: ' + error.message };
  }

  // 3. Update inventory_items
  const { error: stockError } = await supabase.rpc('decrement_inventory_stock', {
    item_id: input.inventory_item_id,
    amount: input.menge
  });
  
  // If no RPC exists, we do a raw select and update (assuming optimistic UI or simple environment)
  if (stockError) {
    const { data: itemData } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', input.inventory_item_id)
      .single();
      
    if (itemData) {
      await supabase
        .from('inventory_items')
        .update({ current_stock: itemData.current_stock - input.menge })
        .eq('id', input.inventory_item_id);
    }
  }

  // 4. Audit log
  await supabase.from('audit_log').insert({
    action: 'erfasst',
    table_name: 'stock_movements',
    record_id: movement.id,
    actor_id: input.employee_id,
    payload: { menge: input.menge, inventory_item_id: input.inventory_item_id }
  });

  const kosten = input.menge * einkaufspreis;
  return { success: true, movement_id: movement.id, kosten_eur: kosten };
}

export async function uebernehmeVorlage(input: {
  auftrag_id: string;
  employee_id: string;
  schluessel: string;
}) {
  const supabase = await createClient();

  // 1 & 2. Load templates
  const [zeitRes, verbrauchRes] = await Promise.all([
    supabase.from('vorlage_zeit').select('id, station_kuerzel, median_minuten').eq('schluessel', input.schluessel).eq('tenant_id', 'galvanik-kreile'),
    supabase.from('vorlage_verbrauch').select('id, station_kuerzel, inventory_item_id, median_menge').eq('schluessel', input.schluessel).eq('tenant_id', 'galvanik-kreile')
  ]);

  if ((!zeitRes.data || zeitRes.data.length === 0) && (!verbrauchRes.data || verbrauchRes.data.length === 0)) {
    return { error: 'Keine Vorlage vorhanden' };
  }

  const fehler = [];
  let zCount = 0;
  let vCount = 0;
  let kostenGesamt = 0;

  // 4. Process zeit
  if (zeitRes.data) {
    for (const z of zeitRes.data) {
      const res = await erfasseZeitDirekt({
        auftrag_id: input.auftrag_id,
        employee_id: input.employee_id,
        station_kuerzel: z.station_kuerzel,
        dauer_minuten: Math.round(Number(z.median_minuten)),
        war_aus_vorlage: true,
        vorlage_id: z.id
      });
      if (res.error) {
        fehler.push(`Zeit (${z.station_kuerzel}): ${res.error}`);
      } else {
        zCount++;
        if (res.kosten_eur) kostenGesamt += res.kosten_eur;
      }
    }
  }

  // 5. Process verbrauch
  if (verbrauchRes.data) {
    for (const v of verbrauchRes.data) {
      const res = await erfasseVerbrauch({
        auftrag_id: input.auftrag_id,
        inventory_item_id: v.inventory_item_id,
        menge: Number(Number(v.median_menge).toFixed(1)),
        station_kuerzel: v.station_kuerzel,
        employee_id: input.employee_id,
        war_aus_vorlage: true,
        vorlage_id: v.id
      });
      if (res.error) {
        fehler.push(`Verbrauch (${v.inventory_item_id}): ${res.error}`);
      } else {
        vCount++;
        if (res.kosten_eur) kostenGesamt += res.kosten_eur;
      }
    }
  }

  // 7. Audit log
  await supabase.from('audit_log').insert({
    action: 'vorlage_uebernommen',
    table_name: 'vorlagen',
    actor_id: input.employee_id,
    payload: { schluessel: input.schluessel, zCount, vCount, fehler }
  });

  if (fehler.length > 0) {
    return { partial: true, erfolgreich: zCount + vCount, fehler, gesamt_kosten_eur: kostenGesamt };
  }

  return { success: true, zeit_buchungen: zCount, verbrauch_buchungen: vCount, gesamt_kosten_eur: kostenGesamt };
}
