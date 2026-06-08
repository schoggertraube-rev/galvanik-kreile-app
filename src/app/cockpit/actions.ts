"use server";

import { createClient } from '@/lib/supabase/server';

export async function getCockpitKpis() {
  const supabase = await createClient();
  
  // v_monatsergebnis for current month
  const currentMonthStr = new Date().toISOString().substring(0, 7) + '-01'; // 'YYYY-MM-01'
  const { data: monatsergebnis } = await supabase
    .from('v_monatsergebnis')
    .select('erloes_netto, ergebnis, monat')
    .limit(1)
    .maybeSingle();

  // v_aging for offene Forderungen
  const { data: agingData } = await supabase
    .from('v_aging')
    .select('netto, tage_ueberfaellig')
    .neq('aging_bucket', 'bezahlt');

  let offeneForderungen = 0;
  let ueberfaelligCount = 0;
  
  if (agingData) {
    offeneForderungen = agingData.reduce((acc, row) => acc + (row.netto || 0), 0);
    ueberfaelligCount = agingData.filter(row => (row.tage_ueberfaellig || 0) > 0).length;
  }

  const umsatz = monatsergebnis?.erloes_netto || 0;
  const db = monatsergebnis?.ergebnis || 0;
  const dbMarge = umsatz > 0 ? (db / umsatz) : 0;
  
  // Liquidität (mock logic or simple heuristic)
  let liquiditaet = 'Stabil';
  if (offeneForderungen > (umsatz * 0.5)) {
    liquiditaet = 'Kritisch';
  } else if (offeneForderungen > (umsatz * 0.2)) {
    liquiditaet = 'Warnung';
  }

  return { 
    umsatz, 
    db, 
    dbMarge, 
    offeneForderungen, 
    ueberfaelligCount,
    liquiditaet 
  };
}

export async function getTopKunden(limit = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_kunde_clv')
    .select('*')
    .order('db_gesamt', { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error getTopKunden:", error.message, error.details, error.hint);
    return [];
  }
  return data || [];
}

export async function getInaktiveKunden() {
  const supabase = await createClient();
  
  const nineMonthsAgo = new Date();
  nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);
  
  const { data, error } = await supabase
    .from('v_kunde_clv')
    .select('*')
    .lt('letzter_auftrag', nineMonthsAgo.toISOString())
    .gte('auftraege_gesamt', 3);

  if (error) {
    console.error("Error getInaktiveKunden:", error.message, error.details, error.hint);
    return [];
  }
  return data || [];
}

export async function getEngpassDaten() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_engpass')
    .select('*')
    .order('engpass_score', { ascending: false });

  if (error) {
    console.error("Error getEngpassDaten:", error.message, error.details, error.hint);
    return [];
  }
  return data || [];
}

export async function getAgingDaten() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('v_aging')
    .select('aging_bucket, netto')
    .neq('aging_bucket', 'bezahlt');

  if (error) {
    console.error("Error getAgingDaten:", error.message, error.details, error.hint);
    return [];
  }

  const buckets: Record<string, { anzahl: number, summe: number }> = {
    'nicht_faellig': { anzahl: 0, summe: 0 },
    'ohne_faelligkeit': { anzahl: 0, summe: 0 },
    '1-14': { anzahl: 0, summe: 0 },
    '15-30': { anzahl: 0, summe: 0 },
    '31-60': { anzahl: 0, summe: 0 },
    '61-90': { anzahl: 0, summe: 0 },
    '>90': { anzahl: 0, summe: 0 }
  };

  (data || []).forEach(row => {
    const b = row.aging_bucket as string;
    if (buckets[b]) {
      buckets[b].anzahl += 1;
      buckets[b].summe += (row.netto || 0);
    }
  });

  return Object.entries(buckets).map(([bucket, vals]) => ({
    aging_bucket: bucket,
    anzahl: vals.anzahl,
    summe: vals.summe
  }));
}

export async function getAuftragDbRanking(limit = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_auftrag_db')
    .select('order_id, order_number, kunde_name, erloes_netto, deckungsbeitrag')
    .or('erloes_netto.gt.0,deckungsbeitrag.neq.0')
    .order('deckungsbeitrag', { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error getAuftragDbRanking:", error.message, error.details, error.hint);
    return [];
  }
  return data || [];
}

export async function getWhatIfKontext() {
  const supabase = await createClient();
  
  const kontext: any = {
    db_marge_je_ks: {},
    kostensatz_je_ks: {},
    auslastung_je_ks: {},
    verfuegbare_stunden_je_ks: {},
    umsatz_12m_je_kundengruppe: {},
    db_marge_gesamt: 0,
    top_kunden_je_gruppe: {}
  };

  const { data: kostenstellen } = await supabase.from('kostenstelle').select('kuerzel, verfuegbare_stunden_monatlich');
  if (kostenstellen) {
    kostenstellen.forEach(ks => {
      if (ks.kuerzel) {
        kontext.verfuegbare_stunden_je_ks[ks.kuerzel] = ks.verfuegbare_stunden_monatlich || 160;
      }
    });
  }

  const { data: engpass } = await supabase.from('v_engpass').select('*');
  if (engpass) {
    engpass.forEach(e => {
      if (e.kuerzel) {
        kontext.auslastung_je_ks[e.kuerzel] = e.auslastung_quote || 0;
        kontext.kostensatz_je_ks[e.kuerzel] = 45; // Default if not found
      }
    });
  }

  const { data: dbData } = await supabase.from('v_auftrag_db').select('current_station, erloes_netto, deckungsbeitrag, status').in('status', ['completed', 'abgeschlossen']);
  if (dbData) {
    const ksStats: Record<string, { u: number, db: number, c: number }> = {};
    let sumU = 0; let sumDb = 0;
    
    dbData.forEach(d => {
      sumU += (d.erloes_netto || 0);
      sumDb += (d.deckungsbeitrag || 0);
      
      const ks = d.current_station;
      if (ks) {
        if (!ksStats[ks]) ksStats[ks] = { u: 0, db: 0, c: 0 };
        ksStats[ks].u += (d.erloes_netto || 0);
        ksStats[ks].db += (d.deckungsbeitrag || 0);
        ksStats[ks].c += 1;
      }
    });
    
    kontext.db_marge_gesamt = sumU > 0 ? sumDb / sumU : 0;
    
    Object.keys(ksStats).forEach(ks => {
      if (ksStats[ks].c >= 3 && ksStats[ks].u > 0) {
        kontext.db_marge_je_ks[ks] = ksStats[ks].db / ksStats[ks].u;
      } else {
        kontext.db_marge_je_ks[ks] = null; // null triggers "Datengrundlage fehlt"
      }
    });
  }

  const { data: clv } = await supabase.from('v_kunde_clv').select('*');
  if (clv) {
    clv.forEach(c => {
      const g = c.kundentyp || 'alle'; // mapped
      if (!kontext.umsatz_12m_je_kundengruppe[g]) kontext.umsatz_12m_je_kundengruppe[g] = 0;
      kontext.umsatz_12m_je_kundengruppe[g] += (c.umsatz_gesamt || 0);
      
      if (!kontext.top_kunden_je_gruppe[g]) kontext.top_kunden_je_gruppe[g] = [];
      kontext.top_kunden_je_gruppe[g].push({ name: c.name, umsatz: c.umsatz_gesamt });
      
      if (g !== 'alle') {
        if (!kontext.umsatz_12m_je_kundengruppe['alle']) kontext.umsatz_12m_je_kundengruppe['alle'] = 0;
        kontext.umsatz_12m_je_kundengruppe['alle'] += (c.umsatz_gesamt || 0);
        if (!kontext.top_kunden_je_gruppe['alle']) kontext.top_kunden_je_gruppe['alle'] = [];
        kontext.top_kunden_je_gruppe['alle'].push({ name: c.name, umsatz: c.umsatz_gesamt });
      }
    });
    
    Object.keys(kontext.top_kunden_je_gruppe).forEach(g => {
      kontext.top_kunden_je_gruppe[g].sort((a: any, b: any) => b.umsatz - a.umsatz);
    });
  }
  return kontext;
}

export async function getEngpassDetails(station: string) {
  const supabase = await createClient();
  
  const { data: waitingOrders } = await supabase.from('orders')
    .select('id, order_number, intake_date, current_station')
    .eq('current_station', station)
    .not('status', 'in', '("completed","abgeschlossen","cancelled","storniert")')
    .order('intake_date', { ascending: true })
    .limit(10);
    
  return {
    waitingOrders: waitingOrders || []
  };
}

export async function getAuftragDbDetails(orderId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('v_auftrag_db').select('*').eq('order_id', orderId).single();
  return data;
}

export async function getForecastDaten() {
  const supabase = await createClient();
  const { data: results, error } = await supabase.from('v_monatsergebnis')
    .select('monat, umsatz, db, db_marge_prozent')
    .order('monat', { ascending: true })
    .limit(12);
    
  const { data: pipeline } = await supabase.from('v_pipeline_forecast')
    .select('*')
    .order('erwarteter_monat', { ascending: true });

  if (error) {
    console.error("Error getForecastDaten:", error);
    return { monate: [], pipeline: [] };
  }
  return { monate: results || [], pipeline: pipeline || [] };
}

export async function getKundenDetails(customerId: string) {
  const supabase = await createClient();
  
  const { data: clv } = await supabase.from('v_kunde_clv').select('*').eq('customer_id', customerId).single();
  
  const { data: orders } = await supabase.from('orders')
    .select('id, order_number, intake_date, due_date, status')
    .eq('customer_id', customerId)
    .order('intake_date', { ascending: false })
    .limit(5);

  const { data: auftraegeDb } = await supabase.from('v_auftrag_db')
    .select('order_id, order_number, deckungsbeitrag, erloes_netto, intake_date')
    .eq('customer_id', customerId);

  let details = orders ? await Promise.all(orders.map(async o => {
    const dbInfo = auftraegeDb?.find(x => x.order_id === o.id);
    return {
      ...o,
      umsatz: dbInfo?.erloes_netto || 0,
      db: dbInfo?.deckungsbeitrag || 0
    };
  })) : [];

  return { clv, letzeAuftraege: details };
}


export async function getAgingRechnungen(bucket: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_aging')
    .select('order_id, invoice_id, rechnung_nummer, kunde_name, netto, faellig_seit_tagen, faellig_am')
    .eq('aging_bucket', bucket)
    .order('faellig_seit_tagen', { ascending: false });

  if (error) {
    console.error("Error getAgingRechnungen:", error);
    return [];
  }
  return data || [];
}

export async function getAktiveWarnungen() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('warning_event')
    .select('*')
    .eq('tenant_id', 'galvanik-kreile')
    .is('dismissed_am', null)
    .order('erzeugt_am', { ascending: false });

  if (error) {
    console.error("Error getAktiveWarnungen:", error.message, error.details, error.hint);
    return [];
  }
  
  // Custom sort to put 'kritisch' first, then 'warnung', then 'info'
  const severityOrder: Record<string, number> = { 'kritisch': 1, 'warnung': 2, 'info': 3 };
  const sorted = (data || []).sort((a, b) => {
    const sA = severityOrder[a.schwere] || 99;
    const sB = severityOrder[b.schwere] || 99;
    if (sA !== sB) return sA - sB;
    return new Date(b.erzeugt_am).getTime() - new Date(a.erzeugt_am).getTime();
  });
  
  return sorted;
}

export async function dismissWarnung(id: string, begruendung: string) {
  if (!begruendung || begruendung.length < 10) {
    throw new Error("Begründung muss mindestens 10 Zeichen lang sein.");
  }
  
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  
  // Set suppress_bis to 7 days in future
  const suppressDate = new Date();
  suppressDate.setDate(suppressDate.getDate() + 7);

  const { error } = await supabase
    .from('warning_event')
    .update({
      dismissed_am: new Date().toISOString(),
      dismissed_von: userId,
      begruendung: begruendung,
      suppress_bis: suppressDate.toISOString()
    })
    .eq('id', id);

  if (error) {
    console.error("Error dismissWarnung:", error.message, error.details, error.hint);
    throw new Error(error.message);
  }
  return true;
}

export async function refreshWarnungen() {
  const supabase = await createClient();
  const { error } = await supabase.rpc('fn_compute_warnings', { p_tenant: 'galvanik-kreile' });
  if (error) {
    console.error("Error refreshWarnungen:", error.message, error.details, error.hint);
    return false;
  }
  return true;
}
