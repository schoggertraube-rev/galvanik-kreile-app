"use server";

import { createClient } from '@/lib/supabase/server';
import { resolveAuthorization } from '@/lib/server/authorization';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

const AGING_BUCKETS = ['nicht_faellig', 'ohne_faelligkeit', '1-14', '15-30', '31-60', '61-90', '>90'] as const;
const AGING_DETAIL_LIMIT = 100;

function confirmedNonNegativeNumber(value: unknown, code: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(code);
  return parsed;
}

function confirmedCount(value: unknown, code: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(code);
  return parsed;
}

function confirmedNullableNumber(value: unknown, code: string): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}

type ContributionTruthRow = Record<string, unknown>;

function confirmedText(value: unknown, code: string, nullable = false): string | null {
  if (nullable && (value === null || value === undefined)) return null;
  if (typeof value !== 'string' || value.trim() === '') throw new Error(code);
  return value;
}

function contributionTruth(row: ContributionTruthRow) {
  if (typeof row.db_berechenbar !== 'boolean') throw new Error('CONTRIBUTION_STATE_INVALID');
  return {
    order_id: confirmedText(row.order_id, 'CONTRIBUTION_ORDER_INVALID') as string,
    order_number: confirmedText(row.order_number, 'CONTRIBUTION_ORDER_INVALID') as string,
    customer_id: confirmedText(row.customer_id, 'CONTRIBUTION_CUSTOMER_INVALID') as string,
    kunde_name: confirmedText(row.kunde_name, 'CONTRIBUTION_CUSTOMER_INVALID', true),
    erloes_netto: confirmedNullableNumber(row.erloes_netto, 'CONTRIBUTION_REVENUE_INVALID'),
    material_kosten: confirmedNullableNumber(row.material_kosten, 'CONTRIBUTION_MATERIAL_INVALID'),
    arbeitszeit_kosten: confirmedNullableNumber(row.arbeitszeit_kosten, 'CONTRIBUTION_TIME_INVALID'),
    energie_anteil_kosten: confirmedNullableNumber(row.energie_anteil_kosten, 'CONTRIBUTION_ENERGY_INVALID'),
    deckungsbeitrag: confirmedNullableNumber(row.deckungsbeitrag, 'CONTRIBUTION_VALUE_INVALID'),
    db_marge: confirmedNullableNumber(row.db_marge, 'CONTRIBUTION_MARGIN_INVALID'),
    db_berechenbar: row.db_berechenbar,
    // Stable bridge names used by the existing detail consumer.
    kosten_verbrauch: confirmedNullableNumber(row.material_kosten, 'CONTRIBUTION_MATERIAL_INVALID'),
    kosten_zeit: confirmedNullableNumber(row.arbeitszeit_kosten, 'CONTRIBUTION_TIME_INVALID'),
    kosten_energie: confirmedNullableNumber(row.energie_anteil_kosten, 'CONTRIBUTION_ENERGY_INVALID'),
  };
}

async function requireCustomerFinanceRead() {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) throw new Error('AUTH_ERROR');
  if (authorization.data.tenantId !== 'galvanik-kreile'
    || !authorization.data.permissions.includes('perm_view_customers')
    || !authorization.data.permissions.includes('perm_view_prices')) {
    throw new Error('FORBIDDEN');
  }
  return authorization.data;
}

export async function getCockpitKpis() {
  const actor = await requireCustomerFinanceRead();

  try {
    const [invoiceRows, timeRows, materialRows] = await Promise.all([
      db.execute(sql<{
        monthly_revenue: number | string;
        monthly_invoice_count: number | string;
        missing_monthly_net: number | string;
        open_receivables: number | string;
        overdue_count: number | string;
        period_label: string;
      }>`
        select
          coalesce(sum(ar.netto) filter (
            where ar.datum >= date_trunc('month', current_date)::date
              and ar.datum < (date_trunc('month', current_date) + interval '1 month')::date
              and ar.status <> 'storniert'
          ), 0)::numeric(14,2) as monthly_revenue,
          count(*) filter (
            where ar.datum >= date_trunc('month', current_date)::date
              and ar.datum < (date_trunc('month', current_date) + interval '1 month')::date
              and ar.status <> 'storniert'
          )::int as monthly_invoice_count,
          count(*) filter (
            where ar.datum >= date_trunc('month', current_date)::date
              and ar.datum < (date_trunc('month', current_date) + interval '1 month')::date
              and ar.status <> 'storniert'
              and ar.netto is null
          )::int as missing_monthly_net,
          coalesce(sum(greatest(ar.brutto - coalesce(ar.bezahlt_betrag_eur, 0), 0)) filter (
            where ar.status in ('offen', 'teilbezahlt', 'ueberfaellig', 'gemahnt', 'mahnung')
          ), 0)::numeric(14,2) as open_receivables,
          count(*) filter (
            where ar.status in ('offen', 'teilbezahlt', 'ueberfaellig', 'gemahnt', 'mahnung')
              and ar.faellig_am < current_date
              and greatest(ar.brutto - coalesce(ar.bezahlt_betrag_eur, 0), 0) > 0
          )::int as overdue_count,
          to_char(current_date, 'MM/YYYY') as period_label
        from public.ausgangsrechnung ar
        where ar.tenant_id = ${actor.tenantId}
          and (ar.is_demo = false or ar.is_demo is null)
      `),
      db.execute(sql<{
        station: string;
        booking_count: number | string;
        time_cost: number | string;
        invalid_count: number | string;
      }>`
        select
          ab.kostenstelle_kuerzel as station,
          count(*)::int as booking_count,
          coalesce(sum((ab.dauer_minuten::numeric / 60) * ab.kostensatz_eur_pro_stunde), 0)::numeric(14,2) as time_cost,
          count(*) filter (where ab.dauer_minuten < 0 or ab.kostensatz_eur_pro_stunde < 0)::int as invalid_count
        from public.arbeitszeit_buchung ab
        where ab.tenant_id = ${actor.tenantId}
          and ab.start_zeit >= date_trunc('month', current_timestamp)
          and ab.start_zeit < date_trunc('month', current_timestamp) + interval '1 month'
        group by ab.kostenstelle_kuerzel
        order by ab.kostenstelle_kuerzel
      `),
      db.execute(sql<{
        movement_count: number | string;
        material_cost: number | string;
        missing_price_count: number | string;
      }>`
        select
          count(*)::int as movement_count,
          coalesce(sum(abs(sm.quantity) * sm.snapshot_einkaufspreis_eur), 0)::numeric(14,2) as material_cost,
          count(*) filter (where sm.snapshot_einkaufspreis_eur is null or sm.snapshot_einkaufspreis_eur < 0)::int as missing_price_count
        from public.stock_movements sm
        where sm.tenant_id = ${actor.tenantId}
          and sm.movement_type in ('consumption', 'verbrauch')
          and sm.created_at >= date_trunc('month', current_timestamp)
          and sm.created_at < date_trunc('month', current_timestamp) + interval '1 month'
      `),
    ]);

    const invoice = invoiceRows[0];
    const material = materialRows[0];
    if (!invoice || !material || typeof invoice.period_label !== 'string') throw new Error('COCKPIT_KPI_DATA_INVALID');

    const umsatz = confirmedNonNegativeNumber(invoice.monthly_revenue, 'COCKPIT_REVENUE_INVALID');
    const monthlyInvoiceCount = confirmedCount(invoice.monthly_invoice_count, 'COCKPIT_INVOICE_COUNT_INVALID');
    const missingMonthlyNet = confirmedCount(invoice.missing_monthly_net, 'COCKPIT_REVENUE_INVALID');
    const offeneForderungen = confirmedNonNegativeNumber(invoice.open_receivables, 'COCKPIT_RECEIVABLES_INVALID');
    const ueberfaelligCount = confirmedCount(invoice.overdue_count, 'COCKPIT_OVERDUE_COUNT_INVALID');
    const materialCost = confirmedNonNegativeNumber(material.material_cost, 'COCKPIT_MATERIAL_COST_INVALID');
    const materialBookingCount = confirmedCount(material.movement_count, 'COCKPIT_MATERIAL_COUNT_INVALID');
    const missingMaterialPrices = confirmedCount(material.missing_price_count, 'COCKPIT_MATERIAL_COST_INVALID');

    const zeitkostenNachStation: Record<string, number> = {};
    let timeCost = 0;
    let timeBookingCount = 0;
    for (const row of timeRows) {
      const station = typeof row.station === 'string' ? row.station.trim() : '';
      const stationCost = confirmedNonNegativeNumber(row.time_cost, 'COCKPIT_TIME_COST_INVALID');
      const stationBookings = confirmedCount(row.booking_count, 'COCKPIT_TIME_COUNT_INVALID');
      const invalidBookings = confirmedCount(row.invalid_count, 'COCKPIT_TIME_COST_INVALID');
      if (!station || invalidBookings > 0 || Object.hasOwn(zeitkostenNachStation, station)) throw new Error('COCKPIT_TIME_COST_INVALID');
      zeitkostenNachStation[station] = stationCost;
      timeCost += stationCost;
      timeBookingCount += stationBookings;
    }

    const contributionAvailable = missingMonthlyNet === 0 && missingMaterialPrices === 0;
    const contribution = contributionAvailable ? Math.round((umsatz - timeCost - materialCost) * 100) / 100 : null;
    const contributionMargin = contribution !== null && umsatz > 0 ? contribution / umsatz : null;

    return {
      periodLabel: invoice.period_label,
      umsatz: missingMonthlyNet === 0 ? umsatz : null,
      db: contribution,
      dbMarge: contributionMargin,
      dbScope: 'Nettoerloes minus bestaetigte Zeit- und Materialkosten; Energie und Sachkosten sind nicht enthalten.',
      offeneForderungen,
      ueberfaelligCount,
      liquiditaet: null,
      liquiditaetReason: 'Bankkonten und Zahlungsabfluesse sind noch nicht belastbar angebunden.',
      zeitkostenNachStation,
      sourceCounts: {
        rechnungen: monthlyInvoiceCount,
        zeitbuchungen: timeBookingCount,
        verbrauchsbuchungen: materialBookingCount,
      },
    };
  } catch (error) {
    console.error('Cockpit KPI data unavailable', error);
    throw new Error('COCKPIT_KPI_DATA_UNAVAILABLE');
  }
}

export async function getTopKunden(limit = 10) {
  await requireCustomerFinanceRead();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_kunde_clv')
    .select('*')
    .order('db_gesamt', { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error getTopKunden:", error.message, error.details, error.hint);
    throw new Error('TOP_CUSTOMERS_UNAVAILABLE');
  }
  return data || [];
}

export async function getInaktiveKunden() {
  await requireCustomerFinanceRead();
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
    throw new Error('INACTIVE_CUSTOMERS_UNAVAILABLE');
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
  const actor = await requireCustomerFinanceRead();
  try {
    const rows = await db.execute(sql<{ aging_bucket: string; anzahl: number | string; summe: number | string }>`
      select aging_bucket, count(*)::int as anzahl, sum(offener_betrag)::numeric(14,2) as summe
      from (
        select
          case
            when ar.faellig_am is null then 'ohne_faelligkeit'
            when current_date <= ar.faellig_am then 'nicht_faellig'
            when current_date - ar.faellig_am <= 14 then '1-14'
            when current_date - ar.faellig_am <= 30 then '15-30'
            when current_date - ar.faellig_am <= 60 then '31-60'
            when current_date - ar.faellig_am <= 90 then '61-90'
            else '>90'
          end as aging_bucket,
          greatest(ar.brutto - coalesce(ar.bezahlt_betrag_eur, 0), 0) as offener_betrag
        from public.ausgangsrechnung ar
        where ar.tenant_id = ${actor.tenantId}
          and (ar.is_demo = false or ar.is_demo is null)
          and ar.status in ('offen', 'teilbezahlt', 'ueberfaellig', 'gemahnt', 'mahnung')
          and greatest(ar.brutto - coalesce(ar.bezahlt_betrag_eur, 0), 0) > 0
      ) confirmed_open_invoices
      group by aging_bucket
    `);
    const byBucket = new Map(rows.map((row) => {
      if (!AGING_BUCKETS.includes(row.aging_bucket as typeof AGING_BUCKETS[number])) throw new Error('AGING_BUCKET_INVALID');
      const count = Number(row.anzahl);
      const total = Number(row.summe);
      if (!Number.isSafeInteger(count) || count < 0 || !Number.isFinite(total) || total < 0) throw new Error('AGING_DATA_INVALID');
      return [row.aging_bucket, { anzahl: count, summe: total }] as const;
    }));
    return AGING_BUCKETS.map((bucket) => ({
      aging_bucket: bucket,
      anzahl: byBucket.get(bucket)?.anzahl || 0,
      summe: byBucket.get(bucket)?.summe || 0,
    }));
  } catch (error) {
    console.error('Aging aggregation unavailable', error);
    throw new Error('AGING_DATA_UNAVAILABLE');
  }
}

export async function getAuftragDbRanking(limit = 10) {
  const actor = await requireCustomerFinanceRead();
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('CONTRIBUTION_LIMIT_INVALID');
  const rows = await db.execute(sql<ContributionTruthRow>`
    select
      order_id,
      order_number,
      customer_id,
      kunde_name,
      erloes_netto,
      material_kosten,
      arbeitszeit_kosten,
      energie_anteil_kosten,
      deckungsbeitrag,
      db_marge,
      db_berechenbar
    from public.v_auftrag_db
    where tenant_id = ${actor.tenantId}
      and db_berechenbar = true
      and (erloes_netto > 0 or deckungsbeitrag <> 0)
    order by deckungsbeitrag desc, order_id
    limit ${limit}
  `);
  return rows.map(contributionTruth).map((row) => {
    if (!row.db_berechenbar || row.kunde_name === null || row.erloes_netto === null || row.deckungsbeitrag === null) {
      throw new Error('CONTRIBUTION_RANKING_INCOMPLETE');
    }
    return {
      ...row,
      kunde_name: row.kunde_name,
      erloes_netto: row.erloes_netto,
      deckungsbeitrag: row.deckungsbeitrag,
    };
  });
}

export async function getWhatIfKontext(): Promise<never> {
  await requireCustomerFinanceRead();
  throw new Error('WHAT_IF_CONTEXT_UNAVAILABLE');
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
  const actor = await requireCustomerFinanceRead();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(orderId)) throw new Error('ORDER_ID_INVALID');
  const rows = await db.execute(sql<ContributionTruthRow>`
    select
      order_id,
      order_number,
      customer_id,
      kunde_name,
      erloes_netto,
      material_kosten,
      arbeitszeit_kosten,
      energie_anteil_kosten,
      deckungsbeitrag,
      db_marge,
      db_berechenbar
    from public.v_auftrag_db
    where tenant_id = ${actor.tenantId}
      and order_id = ${orderId}
    limit 2
  `);
  if (rows.length !== 1) throw new Error(rows.length === 0 ? 'CONTRIBUTION_NOT_FOUND' : 'CONTRIBUTION_DUPLICATE');
  return contributionTruth(rows[0]);
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

  const currentYear = new Date().getFullYear();
  const { data: plan } = await supabase.from('forecast_version')
    .select('werte')
    .eq('tenant_id', 'galvanik-kreile')
    .eq('jahr', currentYear)
    .eq('version_typ', 'plan')
    .eq('ist_aktiv', true)
    .single();

  if (error) {
    console.error("Error getForecastDaten:", error);
    return { monate: [], pipeline: [], plan: null };
  }
  return { monate: results || [], pipeline: pipeline || [], plan: plan?.werte || null };
}

export async function getKundenDetails(customerId: string) {
  const actor = await requireCustomerFinanceRead();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(customerId)) throw new Error('CUSTOMER_ID_INVALID');
  const supabase = await createClient();

  const clvQuery = supabase.from('v_kunde_clv').select('*').eq('customer_id', customerId).single();
  const ordersQuery = supabase.from('orders')
    .select('id, order_number, intake_date, due_date, status')
    .eq('tenant_id', 'galvanik-kreile')
    .eq('customer_id', customerId)
    .order('intake_date', { ascending: false })
    .limit(5);
  const contributionQuery = db.execute(sql<{
    order_id: string;
    order_number: string;
    deckungsbeitrag: number | string | null;
    erloes_netto: number | string | null;
  }>`
    select order_id, order_number, deckungsbeitrag, erloes_netto
    from public.v_auftrag_db
    where tenant_id = ${actor.tenantId}
      and customer_id = ${customerId}
  `);

  const [clvResult, ordersResult, contributionResult] = await Promise.all([clvQuery, ordersQuery, contributionQuery]);
  if (clvResult.error || ordersResult.error || !clvResult.data) {
    console.error('Customer cockpit detail unavailable', clvResult.error, ordersResult.error);
    throw new Error('CUSTOMER_DETAILS_UNAVAILABLE');
  }
  const clv = clvResult.data;
  const orders = ordersResult.data;
  const auftraegeDb = contributionResult;

  const details = orders.map(o => {
    const dbInfo = auftraegeDb?.find(x => x.order_id === o.id);
    const revenue = dbInfo?.erloes_netto === null || dbInfo?.erloes_netto === undefined ? null : Number(dbInfo.erloes_netto);
    const contribution = dbInfo?.deckungsbeitrag === null || dbInfo?.deckungsbeitrag === undefined ? null : Number(dbInfo.deckungsbeitrag);
    return {
      ...o,
      umsatz: Number.isFinite(revenue) ? revenue : null,
      db: Number.isFinite(contribution) ? contribution : null,
    };
  });

  return { clv, letzeAuftraege: details };
}


export async function getAgingRechnungen(bucket: string) {
  const actor = await requireCustomerFinanceRead();
  if (!AGING_BUCKETS.includes(bucket as typeof AGING_BUCKETS[number])) throw new Error('AGING_BUCKET_INVALID');
  try {
    const rows = await db.execute(sql<{
      invoice_id: string;
      order_id: string | null;
      customer_id: string;
      rechnung_nummer: string;
      kunde_name: string;
      offener_betrag: number | string;
      faellig_seit_tagen: number | string | null;
      faellig_am: string | null;
      mahnstufe: number | string | null;
      aging_bucket: string;
    }>`
      select * from (
        select
          ar.id as invoice_id,
          ar.order_id,
          ar.kunde_id as customer_id,
          ar.nummer as rechnung_nummer,
          coalesce(nullif(btrim(c.company_name), ''), c.name) as kunde_name,
          greatest(ar.brutto - coalesce(ar.bezahlt_betrag_eur, 0), 0) as offener_betrag,
          case when ar.faellig_am is null then null else greatest(current_date - ar.faellig_am, 0) end as faellig_seit_tagen,
          ar.faellig_am,
          coalesce(ar.mahnstufe, 0) as mahnstufe,
          case
            when ar.faellig_am is null then 'ohne_faelligkeit'
            when current_date <= ar.faellig_am then 'nicht_faellig'
            when current_date - ar.faellig_am <= 14 then '1-14'
            when current_date - ar.faellig_am <= 30 then '15-30'
            when current_date - ar.faellig_am <= 60 then '31-60'
            when current_date - ar.faellig_am <= 90 then '61-90'
            else '>90'
          end as aging_bucket
        from public.ausgangsrechnung ar
        join public.customers c on c.id = ar.kunde_id and c.tenant_id = ar.tenant_id
        where ar.tenant_id = ${actor.tenantId}
          and (ar.is_demo = false or ar.is_demo is null)
          and ar.status in ('offen', 'teilbezahlt', 'ueberfaellig', 'gemahnt', 'mahnung')
          and greatest(ar.brutto - coalesce(ar.bezahlt_betrag_eur, 0), 0) > 0
      ) confirmed_open_invoices
      where aging_bucket = ${bucket}
      order by faellig_seit_tagen desc nulls last, invoice_id
      limit ${AGING_DETAIL_LIMIT + 1}
    `);
    const invoices = rows.slice(0, AGING_DETAIL_LIMIT).map((row) => {
      const invoiceId = typeof row.invoice_id === 'string' ? row.invoice_id : '';
      const orderId = row.order_id === null || typeof row.order_id === 'string' ? row.order_id : undefined;
      const customerId = typeof row.customer_id === 'string' ? row.customer_id : '';
      const invoiceNumber = typeof row.rechnung_nummer === 'string' ? row.rechnung_nummer : '';
      const customerName = typeof row.kunde_name === 'string' ? row.kunde_name : '';
      const dueAt = row.faellig_am === null || typeof row.faellig_am === 'string' ? row.faellig_am : undefined;
      const outstanding = Number(row.offener_betrag);
      const overdueDays = row.faellig_seit_tagen === null ? null : Number(row.faellig_seit_tagen);
      const dunningLevel = Number(row.mahnstufe);
      if (
        row.aging_bucket !== bucket
        || !invoiceId || orderId === undefined || !customerId || !invoiceNumber || !customerName || dueAt === undefined
        || !Number.isFinite(outstanding) || outstanding <= 0
        || (overdueDays !== null && (!Number.isSafeInteger(overdueDays) || overdueDays < 0))
        || !Number.isSafeInteger(dunningLevel) || dunningLevel < 0
      ) throw new Error('AGING_DATA_INVALID');
      return {
        invoice_id: invoiceId,
        order_id: orderId,
        customer_id: customerId,
        rechnung_nummer: invoiceNumber,
        kunde_name: customerName,
        offener_betrag: outstanding,
        faellig_seit_tagen: overdueDays,
        faellig_am: dueAt,
        mahnstufe: dunningLevel,
      };
    });
    return { invoices, limit: AGING_DETAIL_LIMIT, truncated: rows.length > AGING_DETAIL_LIMIT };
  } catch (error) {
    console.error('Aging invoice detail unavailable', error);
    throw new Error('AGING_DATA_UNAVAILABLE');
  }
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

export async function getAktiverJahresplan(jahr: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('forecast_version')
    .select('*')
    .eq('tenant_id', 'galvanik-kreile')
    .eq('jahr', jahr)
    .eq('version_typ', 'plan')
    .eq('ist_aktiv', true)
    .maybeSingle();

  if (error) {
    console.error("Error getAktiverJahresplan:", error);
    return null;
  }
  return data;
}

export async function speichereJahresplan(jahr: number, monate: Record<string, number>) {
  const supabase = await createClient();
  
  await supabase
    .from('forecast_version')
    .update({ ist_aktiv: false })
    .eq('tenant_id', 'galvanik-kreile')
    .eq('jahr', jahr)
    .eq('version_typ', 'plan')
    .eq('ist_aktiv', true);
    
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  const { error } = await supabase
    .from('forecast_version')
    .insert({
      tenant_id: 'galvanik-kreile',
      jahr,
      version_typ: 'plan',
      ist_aktiv: true,
      erstellt_von: userId,
      werte: { monate }
    });

  if (error) {
    console.error("Error speichereJahresplan:", error);
    throw new Error(error.message);
  }
  return true;
}
