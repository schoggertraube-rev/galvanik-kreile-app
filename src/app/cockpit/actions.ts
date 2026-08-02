"use server";

import { and, asc, desc, eq, notInArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { resolveFinanceDataScope } from '@/lib/server/financeDataAccess';

function rows<T>(result: unknown): T[] {
  return Array.from(result as Iterable<T>);
}

function numberValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getCockpitKpis() {
  const scope = await resolveFinanceDataScope(['perm_view_prices']);
  if (!scope.ok) {
    return {
      umsatz: 0,
      db: 0,
      dbMarge: 0,
      offeneForderungen: 0,
      ueberfaelligCount: 0,
      liquiditaet: 'Nicht verfügbar',
      umsatzNachStation: {},
    };
  }

  type MonthlyResult = {
    erloes_netto: string | number | null;
    ergebnis: string | number | null;
  };
  type AgingResult = {
    netto: string | number | null;
    tage_ueberfaellig: number | null;
  };
  const [monthlyQuery, agingQuery] = await Promise.all([
    db.execute(sql`
      SELECT erloes_netto, ergebnis
      FROM public.v_monatsergebnis
      ORDER BY monat DESC
      LIMIT 1
    `),
    db.execute(sql`
      SELECT netto, tage_ueberfaellig
      FROM public.v_aging
      WHERE aging_bucket <> 'bezahlt'
    `),
  ]);
  const [monatsergebnis] = rows<MonthlyResult>(monthlyQuery);
  const agingData = rows<AgingResult>(agingQuery);

  let offeneForderungen = 0;
  let ueberfaelligCount = 0;
  
  if (agingData.length > 0) {
    offeneForderungen = agingData.reduce((acc, row) => acc + numberValue(row.netto), 0);
    ueberfaelligCount = agingData.filter(row => (row.tage_ueberfaellig || 0) > 0).length;
  }

  const umsatz = numberValue(monatsergebnis?.erloes_netto);
  const contributionMargin = numberValue(monatsergebnis?.ergebnis);
  const dbMarge = umsatz > 0 ? (contributionMargin / umsatz) : 0;
  
  // Liquidität
  let liquiditaet = 'Stabil';
  if (offeneForderungen > (umsatz * 0.5)) {
    liquiditaet = 'Kritisch';
  } else if (offeneForderungen > (umsatz * 0.2)) {
    liquiditaet = 'Warnung';
  }

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  type WorkTimeRow = {
    kostenstelle_kuerzel: string | null;
    dauer_minuten: number | null;
    kostensatz_eur_pro_stunde: string | number | null;
  };
  const zeiten = rows<WorkTimeRow>(
    await db.execute(sql`
      SELECT kostenstelle_kuerzel, dauer_minuten, kostensatz_eur_pro_stunde
      FROM public.arbeitszeit_buchung
      WHERE tenant_id = ${scope.data.tenantId}
        AND start_zeit >= ${firstDay}
    `),
  );

  const umsatzNachStation: Record<string, number> = {};
  if (zeiten.length > 0) {
    for (const z of zeiten) {
      if (z.kostenstelle_kuerzel) {
        if (!umsatzNachStation[z.kostenstelle_kuerzel]) umsatzNachStation[z.kostenstelle_kuerzel] = 0;
        umsatzNachStation[z.kostenstelle_kuerzel] +=
          ((z.dauer_minuten || 0) / 60.0) * numberValue(z.kostensatz_eur_pro_stunde);
      }
    }
  }

  return { 
    umsatz, 
    db: contributionMargin,
    dbMarge, 
    offeneForderungen, 
    ueberfaelligCount,
    liquiditaet,
    umsatzNachStation
  };
}

export async function getTopKunden(limit = 10) {
  const scope = await resolveFinanceDataScope(['perm_view_prices']);
  if (!scope.ok) return [];
  const safeLimit = Math.min(50, Math.max(1, Math.trunc(limit)));
  return rows<Record<string, unknown>>(
    await db.execute(sql`
      SELECT *
      FROM public.v_kunde_clv
      ORDER BY db_gesamt DESC NULLS LAST
      LIMIT ${safeLimit}
    `),
  );
}

export async function getInaktiveKunden() {
  const scope = await resolveFinanceDataScope(['perm_view_prices']);
  if (!scope.ok) return [];
  const nineMonthsAgo = new Date();
  nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);

  return rows<Record<string, unknown>>(
    await db.execute(sql`
      SELECT *
      FROM public.v_kunde_clv
      WHERE letzter_auftrag < ${nineMonthsAgo}
        AND auftraege_gesamt >= 3
    `),
  );
}

export async function getEngpassDaten() {
  const scope = await resolveFinanceDataScope(['perm_view_leitstand']);
  if (!scope.ok) return [];
  return rows<Record<string, unknown>>(
    await db.execute(sql`
      SELECT *
      FROM public.v_engpass
      ORDER BY engpass_score DESC NULLS LAST
    `),
  );
}

export async function getAgingDaten() {
  const scope = await resolveFinanceDataScope(['perm_view_prices']);
  if (!scope.ok) return [];
  type AgingBucketRow = {
    aging_bucket: string;
    netto: string | number | null;
  };
  const data = rows<AgingBucketRow>(
    await db.execute(sql`
      SELECT aging_bucket, netto
      FROM public.v_aging
      WHERE aging_bucket <> 'bezahlt'
    `),
  );

  const buckets: Record<string, { anzahl: number, summe: number }> = {
    'nicht_faellig': { anzahl: 0, summe: 0 },
    'ohne_faelligkeit': { anzahl: 0, summe: 0 },
    '1-14': { anzahl: 0, summe: 0 },
    '15-30': { anzahl: 0, summe: 0 },
    '31-60': { anzahl: 0, summe: 0 },
    '61-90': { anzahl: 0, summe: 0 },
    '>90': { anzahl: 0, summe: 0 }
  };

  data.forEach(row => {
    const b = row.aging_bucket;
    if (buckets[b]) {
      buckets[b].anzahl += 1;
      buckets[b].summe += numberValue(row.netto);
    }
  });

  return Object.entries(buckets).map(([bucket, vals]) => ({
    aging_bucket: bucket,
    anzahl: vals.anzahl,
    summe: vals.summe
  }));
}

export async function getAuftragDbRanking(limit = 10) {
  const scope = await resolveFinanceDataScope(['perm_view_prices']);
  if (!scope.ok) return [];
  const safeLimit = Math.min(50, Math.max(1, Math.trunc(limit)));
  type RankingRow = {
    order_id: string;
    order_number: string;
    kunde_name: string;
    erloes_netto: string | number | null;
    deckungsbeitrag: string | number | null;
  };
  return rows<RankingRow>(
    await db.execute(sql`
      SELECT order_id, order_number, kunde_name, erloes_netto, deckungsbeitrag
      FROM public.v_auftrag_db
      WHERE erloes_netto > 0 OR deckungsbeitrag <> 0
      ORDER BY deckungsbeitrag DESC NULLS LAST
      LIMIT ${safeLimit}
    `),
  ).map((row) => ({
    ...row,
    erloes_netto: numberValue(row.erloes_netto),
    deckungsbeitrag: numberValue(row.deckungsbeitrag),
  }));
}

export async function getWhatIfKontext() {
  const scope = await resolveFinanceDataScope(['perm_view_prices']);
  if (!scope.ok) {
    return {
      db_marge_je_ks: {},
      kostensatz_je_ks: {},
      auslastung_je_ks: {},
      verfuegbare_stunden_je_ks: {},
      umsatz_12m_je_kundengruppe: {},
      db_marge_gesamt: 0,
      top_kunden_je_gruppe: {},
      kostenstellen_liste: [],
    };
  }
  type CustomerRevenue = { name: string; umsatz: number };
  type WhatIfContext = {
    db_marge_je_ks: Record<string, number | null>;
    kostensatz_je_ks: Record<string, number>;
    auslastung_je_ks: Record<string, number>;
    verfuegbare_stunden_je_ks: Record<string, number | null>;
    umsatz_12m_je_kundengruppe: Record<string, number>;
    db_marge_gesamt: number;
    top_kunden_je_gruppe: Record<string, CustomerRevenue[]>;
    kostenstellen_liste: Array<{ kuerzel: string; name: string }>;
  };

  const kontext: WhatIfContext = {
    db_marge_je_ks: {},
    kostensatz_je_ks: {},
    auslastung_je_ks: {},
    verfuegbare_stunden_je_ks: {},
    umsatz_12m_je_kundengruppe: {},
    db_marge_gesamt: 0,
    top_kunden_je_gruppe: {},
    kostenstellen_liste: []
  };

  type CostCenterRow = {
    kuerzel: string;
    name: string;
    verfuegbare_stunden_monatlich: string | number | null;
  };
  const kostenstellen = rows<CostCenterRow>(
    await db.execute(sql`
      SELECT kuerzel, name, verfuegbare_stunden_monatlich
      FROM public.kostenstelle
      WHERE tenant_id = ${scope.data.tenantId}
        AND typ = 'produktion'
    `),
  );
  if (kostenstellen.length > 0) {
    kontext.kostenstellen_liste = kostenstellen.map(ks => ({ kuerzel: ks.kuerzel, name: ks.name }));
    kostenstellen.forEach(ks => {
      if (ks.kuerzel) {
        kontext.verfuegbare_stunden_je_ks[ks.kuerzel] =
          ks.verfuegbare_stunden_monatlich === null
            ? null
            : numberValue(ks.verfuegbare_stunden_monatlich);
      }
    });
  }

  type EngpassRow = {
    kuerzel: string | null;
    auslastung_quote: string | number | null;
  };
  const engpass = rows<EngpassRow>(
    await db.execute(sql`SELECT kuerzel, auslastung_quote FROM public.v_engpass`),
  );
  if (engpass.length > 0) {
    engpass.forEach(e => {
      if (e.kuerzel) {
        kontext.auslastung_je_ks[e.kuerzel] = numberValue(e.auslastung_quote);
        kontext.kostensatz_je_ks[e.kuerzel] = 45; // Default if not found
      }
    });
  }

  type OrderDbRow = {
    current_station: string | null;
    erloes_netto: string | number | null;
    deckungsbeitrag: string | number | null;
    status: string | null;
  };
  const dbData = rows<OrderDbRow>(
    await db.execute(sql`
      SELECT current_station, erloes_netto, deckungsbeitrag, status
      FROM public.v_auftrag_db
      WHERE status IN ('completed', 'abgeschlossen')
    `),
  );
  if (dbData.length > 0) {
    const ksStats: Record<string, { u: number, db: number, c: number }> = {};
    let sumU = 0; let sumDb = 0;
    
    dbData.forEach(d => {
      const revenue = numberValue(d.erloes_netto);
      const contribution = numberValue(d.deckungsbeitrag);
      sumU += revenue;
      sumDb += contribution;
      
      const ks = d.current_station;
      if (ks) {
        if (!ksStats[ks]) ksStats[ks] = { u: 0, db: 0, c: 0 };
        ksStats[ks].u += revenue;
        ksStats[ks].db += contribution;
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

  type CustomerClvRow = {
    name: string;
    kundentyp: string | null;
    umsatz_gesamt: string | number | null;
  };
  const clv = rows<CustomerClvRow>(
    await db.execute(sql`
      SELECT name, kundentyp, umsatz_gesamt
      FROM public.v_kunde_clv
    `),
  );
  if (clv.length > 0) {
    clv.forEach(c => {
      const g = c.kundentyp || 'alle'; // mapped
      const revenue = numberValue(c.umsatz_gesamt);
      if (!kontext.umsatz_12m_je_kundengruppe[g]) kontext.umsatz_12m_je_kundengruppe[g] = 0;
      kontext.umsatz_12m_je_kundengruppe[g] += revenue;
      
      if (!kontext.top_kunden_je_gruppe[g]) kontext.top_kunden_je_gruppe[g] = [];
      kontext.top_kunden_je_gruppe[g].push({ name: c.name, umsatz: revenue });
      
      if (g !== 'alle') {
        if (!kontext.umsatz_12m_je_kundengruppe['alle']) kontext.umsatz_12m_je_kundengruppe['alle'] = 0;
        kontext.umsatz_12m_je_kundengruppe['alle'] += revenue;
        if (!kontext.top_kunden_je_gruppe['alle']) kontext.top_kunden_je_gruppe['alle'] = [];
        kontext.top_kunden_je_gruppe['alle'].push({ name: c.name, umsatz: revenue });
      }
    });
    
    Object.keys(kontext.top_kunden_je_gruppe).forEach(g => {
      kontext.top_kunden_je_gruppe[g].sort((a, b) => b.umsatz - a.umsatz);
    });
  }
  return kontext;
}

export async function getEngpassDetails(station: string) {
  const scope = await resolveFinanceDataScope(['perm_view_leitstand']);
  if (!scope.ok) return { waitingOrders: [] };

  const waitingOrders = await db
    .select({
      id: orders.id,
      order_number: orders.orderNumber,
      intake_date: orders.intakeDate,
      current_station: orders.currentStationId,
    })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, scope.data.tenantId),
        eq(orders.currentStationId, station),
        notInArray(orders.status, [
          'completed',
          'abgeschlossen',
          'cancelled',
          'storniert',
        ]),
      ),
    )
    .orderBy(asc(orders.intakeDate))
    .limit(10);

  return {
    waitingOrders,
  };
}

export async function getAuftragDbDetails(orderId: string) {
  const scope = await resolveFinanceDataScope(['perm_view_prices']);
  if (!scope.ok) return null;
  const [data] = rows<Record<string, unknown>>(
    await db.execute(sql`
      SELECT *
      FROM public.v_auftrag_db
      WHERE order_id = ${orderId}
      LIMIT 1
    `),
  );
  return data ?? null;
}

export async function getForecastDaten() {
  const scope = await resolveFinanceDataScope(['perm_view_prices']);
  if (!scope.ok) return { monate: [], pipeline: [], plan: null };
  const results = rows<Record<string, unknown>>(
    await db.execute(sql`
      SELECT monat,
             erloes_netto::double precision AS umsatz,
             ergebnis::double precision AS db,
             CASE
               WHEN erloes_netto > 0
               THEN (ergebnis / erloes_netto * 100)::double precision
               ELSE NULL
             END AS db_marge_prozent
      FROM public.v_monatsergebnis
      ORDER BY monat ASC
      LIMIT 12
    `),
  );
  const pipeline = rows<Record<string, unknown>>(
    await db.execute(sql`
      SELECT erwarteter_monat,
             anz_auftraege::int AS anz_auftraege,
             pipeline_wert_gewichtet::double precision AS pipeline_wert_gewichtet,
             pipeline_wert_ungewichtet::double precision AS pipeline_wert_ungewichtet
      FROM public.v_pipeline_forecast
      ORDER BY erwarteter_monat ASC
    `),
  );

  const currentYear = new Date().getFullYear();
  const [plan] = rows<{ werte: { monate?: Record<string, number> } | null }>(
    await db.execute(sql`
      SELECT werte
      FROM public.forecast_version
      WHERE tenant_id = ${scope.data.tenantId}
        AND jahr = ${currentYear}
        AND version_typ = 'plan'
        AND ist_aktiv IS TRUE
      LIMIT 1
    `),
  );

  return { monate: results, pipeline, plan: plan?.werte?.monate ?? null };
}

export async function getKundenDetails(customerId: string) {
  const scope = await resolveFinanceDataScope(['perm_view_prices']);
  if (!scope.ok) return { clv: null, letzeAuftraege: [] };

  const [clv] = rows<Record<string, unknown>>(
    await db.execute(sql`
      SELECT *
      FROM public.v_kunde_clv
      WHERE customer_id = ${customerId}
      LIMIT 1
    `),
  );
  
  const customerOrders = await db
    .select({
      id: orders.id,
      order_number: orders.orderNumber,
      intake_date: orders.intakeDate,
      due_date: orders.dueDate,
      status: orders.status,
    })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, scope.data.tenantId),
        eq(orders.customerId, customerId),
      ),
    )
    .orderBy(desc(orders.intakeDate))
    .limit(5);

  type CustomerOrderFinanceRow = {
    order_id: string;
    order_number: string;
    deckungsbeitrag: string | number | null;
    erloes_netto: string | number | null;
    intake_date: Date | null;
  };
  const auftraegeDb = rows<CustomerOrderFinanceRow>(
    await db.execute(sql`
      SELECT order_id, order_number, deckungsbeitrag, erloes_netto, intake_date
      FROM public.v_auftrag_db
      WHERE customer_id = ${customerId}
    `),
  );

  const details = customerOrders.map(o => {
    const dbInfo = auftraegeDb.find(x => x.order_id === o.id);
    return {
      ...o,
      umsatz: numberValue(dbInfo?.erloes_netto),
      db: numberValue(dbInfo?.deckungsbeitrag)
    };
  });

  return { clv: clv ?? null, letzeAuftraege: details };
}


export async function getAgingRechnungen(bucket: string) {
  const scope = await resolveFinanceDataScope(['perm_view_prices']);
  if (!scope.ok) return [];
  return rows<Record<string, unknown>>(
    await db.execute(sql`
      SELECT id AS invoice_id,
             rechnungsnummer AS rechnung_nummer,
             kunde_name,
             netto::double precision AS netto,
             tage_ueberfaellig AS faellig_seit_tagen,
             faellig_am,
             mahnstufe
      FROM public.v_aging
      WHERE aging_bucket = ${bucket}
      ORDER BY tage_ueberfaellig DESC NULLS LAST
    `),
  );
}

export async function getAktiveWarnungen() {
  const scope = await resolveFinanceDataScope(['perm_view_leitstand']);
  if (!scope.ok) return [];
  type WarningRow = {
    schwere: string | null;
    erzeugt_am: string | Date;
  } & Record<string, unknown>;
  const data = rows<WarningRow>(
    await db.execute(sql`
      SELECT *
      FROM public.warning_event
      WHERE tenant_id = ${scope.data.tenantId}
        AND dismissed_am IS NULL
      ORDER BY erzeugt_am DESC
    `),
  );
  
  // Custom sort to put 'kritisch' first, then 'warnung', then 'info'
  const severityOrder: Record<string, number> = { 'kritisch': 1, 'warnung': 2, 'info': 3 };
  const sorted = data.sort((a, b) => {
    const sA = severityOrder[a.schwere || ''] || 99;
    const sB = severityOrder[b.schwere || ''] || 99;
    if (sA !== sB) return sA - sB;
    return new Date(b.erzeugt_am).getTime() - new Date(a.erzeugt_am).getTime();
  });
  
  return sorted;
}

export async function dismissWarnung(id: string, begruendung: string) {
  if (!begruendung || begruendung.length < 10) {
    throw new Error("Begründung muss mindestens 10 Zeichen lang sein.");
  }

  const scope = await resolveFinanceDataScope(['perm_op_status']);
  if (!scope.ok) throw new Error(scope.message);
  
  // Set suppress_bis to 7 days in future
  const suppressDate = new Date();
  suppressDate.setDate(suppressDate.getDate() + 7);

  const updated = rows<{ id: string }>(
    await db.execute(sql`
      UPDATE public.warning_event
      SET dismissed_am = now(),
          dismissed_von = ${scope.data.userId},
          begruendung = ${begruendung},
          suppress_bis = ${suppressDate}
      WHERE id = ${id}
        AND tenant_id = ${scope.data.tenantId}
      RETURNING id
    `),
  );
  if (updated.length !== 1) throw new Error('Warnung nicht gefunden.');
  return true;
}

export async function refreshWarnungen() {
  const scope = await resolveFinanceDataScope(['perm_op_status']);
  if (!scope.ok) return false;
  await db.execute(sql`SELECT public.fn_compute_warnings(${scope.data.tenantId})`);
  return true;
}

export async function getAktiverJahresplan(jahr: number) {
  const scope = await resolveFinanceDataScope(['perm_view_prices']);
  if (!scope.ok) return null;
  type AnnualPlan = {
    id: string;
    werte: { monate?: Record<string, number> } | null;
  } & Record<string, unknown>;
  const [data] = rows<AnnualPlan>(
    await db.execute(sql`
      SELECT *
      FROM public.forecast_version
      WHERE tenant_id = ${scope.data.tenantId}
        AND jahr = ${Math.trunc(jahr)}
        AND version_typ = 'plan'
        AND ist_aktiv IS TRUE
      LIMIT 1
    `),
  );
  return data ?? null;
}

export async function speichereJahresplan(jahr: number, monate: Record<string, number>) {
  const scope = await resolveFinanceDataScope(['perm_view_prices']);
  if (!scope.ok) throw new Error(scope.message);
  if (!['developer', 'admin'].includes(scope.data.role)) {
    throw new Error('Keine Berechtigung zum Speichern des Jahresplans.');
  }
  const year = Math.trunc(jahr);
  const valuesJson = JSON.stringify({ monate });
  const basisJson = JSON.stringify({ source: 'manual_cockpit_plan' });

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE public.forecast_version
      SET ist_aktiv = false
      WHERE tenant_id = ${scope.data.tenantId}
        AND jahr = ${year}
        AND version_typ = 'plan'
        AND ist_aktiv IS TRUE
    `);
    await tx.execute(sql`
      INSERT INTO public.forecast_version (
        tenant_id,
        jahr,
        version_typ,
        ist_aktiv,
        erstellt_von,
        basis_data,
        werte
      )
      VALUES (
        ${scope.data.tenantId},
        ${year},
        'plan',
        true,
        ${scope.data.userId},
        ${basisJson}::jsonb,
        ${valuesJson}::jsonb
      )
    `);
  });
  return true;
}

export async function savePhoneNote(data: { customer_id?: string, caller_name?: string, raw_text: string, category: string, urgency: string }) {
  const scope = await resolveFinanceDataScope(['perm_data_customers']);
  if (!scope.ok) throw new Error(scope.message);
  await db.execute(sql`
    INSERT INTO public.phone_notes (
      tenant_id,
      customer_id,
      caller_name,
      raw_text,
      category,
      urgency,
      status,
      created_by
    )
    VALUES (
      ${scope.data.tenantId},
      ${data.customer_id || null},
      ${data.caller_name || ''},
      ${data.raw_text},
      ${data.category},
      ${data.urgency},
      'open',
      ${scope.data.userId}
    )
  `);
}
