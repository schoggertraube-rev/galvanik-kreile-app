"use server"

import { createClient } from '@/utils/supabase/server';
import { bildeSchluessel, klassifiziereTeil } from '@/lib/erfassung/klassifikator';

export async function getVorlageFuerAuftrag(auftrag_id: string) {
  const supabase = await createClient();

  // 1. Get items for the order to get the name and surface_requested
  const { data: itemsData, error: itemsError } = await supabase
    .from('items')
    .select('name, surface_requested')
    .eq('order_id', auftrag_id);

  if (itemsError || !itemsData || itemsData.length === 0) {
    return { hat_vorlage: false, error: 'Keine Positionen im Auftrag gefunden' };
  }

  // Use the first item's name and surface for classification
  const item = itemsData[0];
  const surface = item.surface_requested || '';

  // 2. Fetch the class keywords
  const { data: klassifikatorData } = await supabase
    .from('teile_klassifikator')
    .select('klasse, keywords')
    .eq('tenant_id', 'galvanik-kreile');

  const klassifikatorListe = klassifikatorData || [];
  
  // 3. Classify and build key
  const klasse = klassifiziereTeil(item.name, klassifikatorListe);
  const schluessel = bildeSchluessel(klasse, surface);

  // 4 & 5. Fetch templates
  let { data: zeitData } = await supabase
    .from('vorlage_zeit')
    .select('station_kuerzel, median_minuten, p25_minuten, p75_minuten, n_referenzauftraege')
    .eq('tenant_id', 'galvanik-kreile')
    .eq('schluessel', schluessel);

  let { data: verbrauchData } = await supabase
    .from('vorlage_verbrauch')
    .select('station_kuerzel, inventory_item_id, median_menge, einheit_normiert, haeufigkeit_prozent, n_referenzauftraege')
    .eq('tenant_id', 'galvanik-kreile')
    .eq('schluessel', schluessel);

  let finalSchluessel = schluessel;

  // 6. Fallback if empty
  if ((!zeitData || zeitData.length === 0) && (!verbrauchData || verbrauchData.length === 0)) {
    const fallbackSchluessel = bildeSchluessel('*', surface);
    
    // Check fallback zeit
    const { data: fallbackZeit } = await supabase
      .from('vorlage_zeit')
      .select('station_kuerzel, median_minuten, p25_minuten, p75_minuten, n_referenzauftraege')
      .eq('tenant_id', 'galvanik-kreile')
      .eq('schluessel', fallbackSchluessel)
      .gte('n_referenzauftraege', 5);

    // Check fallback verbrauch
    const { data: fallbackVerbrauch } = await supabase
      .from('vorlage_verbrauch')
      .select('station_kuerzel, inventory_item_id, median_menge, einheit_normiert, haeufigkeit_prozent, n_referenzauftraege')
      .eq('tenant_id', 'galvanik-kreile')
      .eq('schluessel', fallbackSchluessel)
      .gte('n_referenzauftraege', 5);

    if ((fallbackZeit && fallbackZeit.length > 0) || (fallbackVerbrauch && fallbackVerbrauch.length > 0)) {
      zeitData = fallbackZeit;
      verbrauchData = fallbackVerbrauch;
      finalSchluessel = fallbackSchluessel;
    }
  }

  const hasTemplates = (zeitData && zeitData.length > 0) || (verbrauchData && verbrauchData.length > 0);

  if (!hasTemplates) {
    return { hat_vorlage: false };
  }

  // Get max referenzauftraege to determine confidence
  let maxRef = 0;
  if (zeitData && zeitData.length > 0) {
    maxRef = Math.max(...zeitData.map(z => z.n_referenzauftraege));
  }
  if (verbrauchData && verbrauchData.length > 0) {
    maxRef = Math.max(maxRef, ...verbrauchData.map(v => v.n_referenzauftraege));
  }

  let konfidenz = 'stabil';
  if (maxRef < 3) konfidenz = 'aufbauen';
  else if (maxRef < 10) konfidenz = 'aktiv';

  // Join inventory item names for verbrauch
  let verbrauchEnhanced: any[] = [];
  if (verbrauchData && verbrauchData.length > 0) {
    const itemIds = verbrauchData.map(v => v.inventory_item_id);
    const { data: invItems } = await supabase
      .from('inventory_items')
      .select('id, name')
      .in('id', itemIds);

    verbrauchEnhanced = verbrauchData.map(v => {
      const invItem = invItems?.find(i => i.id === v.inventory_item_id);
      return {
        station: v.station_kuerzel,
        artikel_id: v.inventory_item_id,
        artikel_name: invItem?.name || 'Unbekannter Artikel',
        median_menge: v.median_menge,
        einheit: v.einheit_normiert,
        haeufigkeit_prozent: v.haeufigkeit_prozent
      };
    });
  }

  const zeitFormatted = (zeitData || []).map(z => ({
    station: z.station_kuerzel,
    median_min: z.median_minuten,
    p25: z.p25_minuten,
    p75: z.p75_minuten
  }));

  return {
    schluessel: finalSchluessel,
    klasse,
    oberflaeche: surface,
    konfidenz,
    n_referenzauftraege: maxRef,
    zeit: zeitFormatted,
    verbrauch: verbrauchEnhanced,
    hat_vorlage: true
  };
}

export async function getWahrscheinlicheArtikel(auftrag_id: string) {
  const supabase = await createClient();

  // Get surface and name
  const { data: itemsData } = await supabase
    .from('items')
    .select('name, surface_requested')
    .eq('order_id', auftrag_id);

  let schluessel = '*|*';
  if (itemsData && itemsData.length > 0) {
    const item = itemsData[0];
    const surface = item.surface_requested || '';
    
    const { data: klassifikatorData } = await supabase
      .from('teile_klassifikator')
      .select('klasse, keywords')
      .eq('tenant_id', 'galvanik-kreile');

    const klasse = klassifiziereTeil(item.name, klassifikatorData || []);
    schluessel = bildeSchluessel(klasse, surface);
  }

  // 1. Templates by schluessel
  const { data: vorlageData } = await supabase
    .from('vorlage_verbrauch')
    .select('inventory_item_id, haeufigkeit_prozent, median_menge')
    .eq('tenant_id', 'galvanik-kreile')
    .eq('schluessel', schluessel)
    .order('haeufigkeit_prozent', { ascending: false })
    .limit(10);

  // 2. Recent items by same user
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  
  let recentItems: any[] = [];
  if (userId) {
    // using distinct not fully supported in supabase js easily, so just select and filter
    const { data: recent } = await supabase
      .from('stock_movements')
      .select('inventory_item_id, quantity')
      .eq('erfasst_von', userId)
      .eq('movement_type', 'verbrauch')
      .order('created_at', { ascending: false })
      .limit(20);

    if (recent) {
      const seen = new Set();
      for (const r of recent) {
        if (!seen.has(r.inventory_item_id) && recentItems.length < 5) {
          seen.add(r.inventory_item_id);
          recentItems.push({
            inventory_item_id: r.inventory_item_id,
            last_menge: Math.abs(r.quantity)
          });
        }
      }
    }
  }

  // Combine and deduplicate
  const combinedMap = new Map();

  for (const v of (vorlageData || [])) {
    combinedMap.set(v.inventory_item_id, {
      id: v.inventory_item_id,
      haeufigkeit: v.haeufigkeit_prozent,
      letzte_menge: v.median_menge, // fall back to median
      source: 'vorlage'
    });
  }

  for (const r of recentItems) {
    if (!combinedMap.has(r.inventory_item_id)) {
      combinedMap.set(r.inventory_item_id, {
        id: r.inventory_item_id,
        haeufigkeit: null,
        letzte_menge: r.last_menge,
        source: 'recent'
      });
    } else {
      // update with actual last user quantity if we have it
      combinedMap.get(r.inventory_item_id).letzte_menge = r.last_menge;
    }
  }

  // Fetch names
  const itemIds = Array.from(combinedMap.keys());
  if (itemIds.length > 0) {
    const { data: items } = await supabase
      .from('inventory_items')
      .select('id, name, unit')
      .in('id', itemIds);

    const result = Array.from(combinedMap.values()).map(c => {
      const it = items?.find(i => i.id === c.id);
      return {
        id: c.id,
        name: it?.name || 'Unbekannt',
        einheit: it?.unit || 'Stk',
        letzte_menge: c.letzte_menge,
        haeufigkeit: c.haeufigkeit
      };
    });

    return result;
  }

  return [];
}
