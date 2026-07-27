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
type CustomerClvTruthRow = Record<string, unknown>;

function confirmedText(value: unknown, code: string, nullable = false): string | null {
  if (nullable && (value === null || value === undefined)) return null;
  if (typeof value !== 'string' || value.trim() === '') throw new Error(code);
  return value;
}

function confirmedTimestampText(value: unknown, code: string, nullable = false): string | null {
  if (nullable && (value === null || value === undefined)) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error(code);
  return parsed.toISOString();
}

function customerClvTruth(row: CustomerClvTruthRow) {
  const margin = confirmedNullableNumber(row.db_marge, 'CUSTOMER_CLV_MARGIN_INVALID');
  return {
    customer_id: confirmedText(row.customer_id, 'CUSTOMER_CLV_ID_INVALID') as string,
    name: confirmedText(row.name, 'CUSTOMER_CLV_NAME_INVALID') as string,
    company_name: confirmedText(row.company_name, 'CUSTOMER_CLV_COMPANY_INVALID', true),
    kundentyp: confirmedText(row.kundentyp, 'CUSTOMER_CLV_TYPE_INVALID', true),
    erstkontakt: confirmedTimestampText(row.erstkontakt, 'CUSTOMER_CLV_CREATED_INVALID') as string,
    auftraege_gesamt: confirmedCount(row.auftraege_gesamt, 'CUSTOMER_CLV_ORDER_COUNT_INVALID'),
    auftraege_12m: confirmedCount(row.auftraege_12m, 'CUSTOMER_CLV_ORDER_COUNT_INVALID'),
    umsatz_gesamt: confirmedNullableNumber(row.umsatz_gesamt, 'CUSTOMER_CLV_REVENUE_INVALID'),
    db_gesamt: confirmedNullableNumber(row.db_gesamt, 'CUSTOMER_CLV_CONTRIBUTION_INVALID'),
    db_marge: margin,
    db_marge_prozent: margin,
    letzter_auftrag: confirmedTimestampText(row.letzter_auftrag, 'CUSTOMER_CLV_LAST_ORDER_INVALID', true),
    reklamationen: confirmedCount(row.reklamationen, 'CUSTOMER_CLV_COMPLAINT_COUNT_INVALID'),
    avg_durchlauf_tage: confirmedNullableNumber(row.avg_durchlauf_tage, 'CUSTOMER_CLV_DURATION_INVALID'),
    avg_zahlungsverzug_tage: confirmedNullableNumber(row.avg_zahlungsverzug_tage, 'CUSTOMER_CLV_PAYMENT_DELAY_INVALID'),
    email: confirmedText(row.email, 'CUSTOMER_CLV_EMAIL_INVALID', true),
  };
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
  const actor = await requireCustomerFinanceRead();
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('TOP_CUSTOMERS_LIMIT_INVALID');
  }
  const rows = await db.execute(sql<CustomerClvTruthRow>`
    select
      customer_id,
      name,
      company_name,
      kundentyp,
      erstkontakt,
      auftraege_gesamt,
      auftraege_12m,
      umsatz_gesamt,
      db_gesamt,
      db_marge,
      letzter_auftrag,
      reklamationen,
      avg_durchlauf_tage,
      avg_zahlungsverzug_tage
    from public.v_kunde_clv
    where tenant_id = ${actor.tenantId}
      and db_gesamt is not null
    order by db_gesamt desc nulls last, customer_id
    limit ${limit}
  `);
  return rows.map(customerClvTruth);
}

export async function getInaktiveKunden() {
  const actor = await requireCustomerFinanceRead();
  const rows = await db.execute(sql<CustomerClvTruthRow>`
    select
      customer_id,
      name,
      company_name,
      kundentyp,
      erstkontakt,
      auftraege_gesamt,
      auftraege_12m,
      umsatz_gesamt,
      db_gesamt,
      db_marge,
      letzter_auftrag,
      reklamationen,
      avg_durchlauf_tage,
      avg_zahlungsverzug_tage
    from public.v_kunde_clv
    where tenant_id = ${actor.tenantId}
      and letzter_auftrag < current_timestamp - interval '9 months'
      and auftraege_gesamt >= 3
    order by letzter_auftrag, customer_id
  `);
  return rows.map(customerClvTruth);
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

export type ForecastData = {
  monate: Array<{
    monat: string;
    umsatz: number;
  }>;
  pipeline: Array<{
    erwarteter_monat: string;
    pipeline_wert_gewichtet: number;
    pipeline_wert_ungewichtet: number;
  }>;
  plan?: Record<string, number> | null;
};

export type ForecastResult =
  | { status: 'available'; data: ForecastData }
  | { status: 'not_configured'; reason: 'FORECAST_NOT_CONFIGURED' };

export async function getForecastDaten(): Promise<ForecastResult> {
  await requireCustomerFinanceRead();
  return { status: 'not_configured', reason: 'FORECAST_NOT_CONFIGURED' };
}

export async function getKundenDetails(customerId: string) {
  const actor = await requireCustomerFinanceRead();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(customerId)) throw new Error('CUSTOMER_ID_INVALID');
  const clvQuery = db.execute(sql<CustomerClvTruthRow>`
    select
      clv.customer_id,
      clv.name,
      clv.company_name,
      clv.kundentyp,
      clv.erstkontakt,
      clv.auftraege_gesamt,
      clv.auftraege_12m,
      clv.umsatz_gesamt,
      clv.db_gesamt,
      clv.db_marge,
      clv.letzter_auftrag,
      clv.reklamationen,
      clv.avg_durchlauf_tage,
      clv.avg_zahlungsverzug_tage,
      customer.email
    from public.v_kunde_clv clv
    join public.customers customer
      on customer.tenant_id = clv.tenant_id
     and customer.id = clv.customer_id
    where clv.tenant_id = ${actor.tenantId}
      and clv.customer_id = ${customerId}
    limit 2
  `);
  const ordersQuery = db.execute(sql<Record<string, unknown>>`
    select id, order_number, intake_date, due_date, status
    from public.orders
    where tenant_id = ${actor.tenantId}
      and customer_id = ${customerId}
    order by intake_date desc nulls last, id
    limit 5
  `);
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

  const [clvRows, ordersRows, contributionResult] = await Promise.all([clvQuery, ordersQuery, contributionQuery]);
  if (clvRows.length !== 1) {
    throw new Error(clvRows.length === 0 ? 'CUSTOMER_DETAILS_NOT_FOUND' : 'CUSTOMER_DETAILS_DUPLICATE');
  }
  const clv = customerClvTruth(clvRows[0]);
  const orders = ordersRows.map((order) => ({
    id: confirmedText(order.id, 'CUSTOMER_ORDER_ID_INVALID') as string,
    order_number: confirmedText(order.order_number, 'CUSTOMER_ORDER_NUMBER_INVALID') as string,
    intake_date: confirmedTimestampText(order.intake_date, 'CUSTOMER_ORDER_DATE_INVALID') as string,
    due_date: confirmedTimestampText(order.due_date, 'CUSTOMER_ORDER_DUE_DATE_INVALID', true),
    status: confirmedText(order.status, 'CUSTOMER_ORDER_STATUS_INVALID') as string,
  }));
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
  await requireCustomerFinanceRead();
  throw new Error('WARNING_RECOMPUTE_NOT_CONFIGURED');
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
