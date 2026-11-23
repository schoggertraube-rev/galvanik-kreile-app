"use server";

import { readAuthorizedArea } from "@/lib/server/authHelper";
import { createClient } from "@/lib/supabase/server";
import { belegteTermintreue } from "@/lib/analyse/termintreue";
import { readWerkstattStationszahlen, readWerkstattWochenzielInTransaction, type WerkstattStationszahl } from "@/lib/server/werkstattStationszahlen";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { WERKSTATT_PULS_COPY } from "@/ui/situationCatalog";
import {
  AnalyseTileKey,
  AnalyseTileSummary,
  AnalyseTileDetail,
  AnalyseEntityLink,
  AnalyseTileStatus,
  WerkstattPulsData,
} from "@/lib/analyse/dataContracts";

type AnalyseSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type TermintreueRow = {
  termintreue_pct: number | null;
  ohne_zusagetermin: number;
  nenner: number;
};

type DurchlaufzeitRow = {
  avg_tage: number | null;
  n: number;
};

type WochenzielRow = {
  fertig_diese_woche: number;
};

type CustomerNameRow = {
  name: string | null;
};

type AffectedOrderRow = {
  id: string;
  order_number: string;
  title: string | null;
  customer_id: string;
  customers: CustomerNameRow | CustomerNameRow[] | null;
  station: string | null;
  promised_due_date: string | null;
  completed_date: string | null;
  status: string | null;
};

type AnalyseActionResult<T> = {
  data: T;
  error?: string;
};

type AnalyseQueryResult<T> = {
  data: T | null;
};

function getErrorMessage(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return undefined;
}

function getCustomerName(customer: AffectedOrderRow["customers"]): string {
  if (Array.isArray(customer)) return customer[0]?.name ?? "Unbekannt";
  return customer?.name ?? "Unbekannt";
}

function toWerkstattPulsPeriod(period: string): WerkstattPulsData["period"] {
  switch (period.toLowerCase()) {
    case "today":
    case "heute":
      return "today";
    case "week":
    case "woche":
      return "week";
    case "month":
    case "monat":
      return "month";
    default:
      return "custom";
  }
}

function toAffectedOrder(
  order: AffectedOrderRow,
  status: "critical" | "missing_due_date",
): WerkstattPulsData["affectedOrders"][number] {
  const delayDays = order.promised_due_date
    ? Math.round((new Date().getTime() - new Date(order.promised_due_date).getTime()) / (1000 * 3600 * 24))
    : null;

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    title: order.title || "Ohne Titel",
    customerId: order.customer_id,
    customerName: getCustomerName(order.customers),
    stationName: order.station || "Unbekannt",
    promisedDueDate: order.promised_due_date,
    completedDate: order.completed_date,
    delayDays: status === "critical" ? delayDays : null,
    status,
    priority: order.status,
    openUrl: `/orders/${order.id}?returnTo=/performance?tile=werkstatt_puls`,
  };
}

async function autorisierteStationszahlen(
  authorization: { tenantId: string; permissions: readonly string[] },
): Promise<readonly WerkstattStationszahl[] | null> {
  if (!authorization.permissions.includes("perm_view_leitstand")) return null;
  try {
    return await withPrivilegedTenantTransaction(authorization,
      tx => readWerkstattStationszahlen(tx, authorization.tenantId));
  } catch {
    return null;
  }
}

export async function getWerkstattStationszahlen(): Promise<readonly WerkstattStationszahl[] | null> {
  const authorization = await readAuthorizedArea("buchhaltung");
  return authorization.ok ? autorisierteStationszahlen(authorization.data) : null;
}

async function readWerkstattWochenziel(tenantId: string): Promise<number | null> {
  try {
    return await withPrivilegedTenantTransaction({ tenantId }, tx => readWerkstattWochenzielInTransaction(tx, tenantId));
  } catch {
    return null;
  }
}

export async function getWerkstattWochenziel(): Promise<number | null> {
  const authorization = await readAuthorizedArea("buchhaltung");
  return authorization.ok ? readWerkstattWochenziel(authorization.data.tenantId) : null;
}

async function getWerkstattPulsSummary(
  supabase: AnalyseSupabaseClient, period: string, wochenzielSoll: number | null,
  stationszahlen: readonly WerkstattStationszahl[] | null,
): Promise<AnalyseTileSummary> {
  const { data: t }: AnalyseQueryResult<TermintreueRow> = await supabase
    .from('v_analyse_termintreue')
    .select('*')
    .single();
  const { data: d }: AnalyseQueryResult<DurchlaufzeitRow> = await supabase
    .from('v_analyse_durchlaufzeit')
    .select('*')
    .single();
  const { data: w }: AnalyseQueryResult<WochenzielRow> = await supabase
    .from('v_analyse_wochenziel')
    .select('*')
    .single();
  const termintreue = belegteTermintreue(t);
  const status: AnalyseTileStatus = termintreue === null ? "data_missing"
    : t && t.ohne_zusagetermin > 0 ? "watch" : "stable";

  const groessteStation = Math.max(1, ...(stationszahlen ?? []).map(station => station.auftraege));
  const progressBars = stationszahlen?.map(station => ({
    label: WERKSTATT_PULS_COPY.station[station.station] ?? station.station,
    value: station.auftraege,
    fillRatio: station.auftraege / groessteStation * 100,
    colorClass: "bg-blue-500",
  }));

  return {
    key: "werkstatt_puls",
    title: "Werkstatt-Puls",
    subtitle: "Termintreue & Durchlaufzeit",
    status,
    primaryLabel: "Termintreue",
    primaryValue: termintreue === null ? WERKSTATT_PULS_COPY.fehlt : `${termintreue}%`,
    secondaryLabel: "Ø Durchlaufzeit",
    secondaryValue: d?.avg_tage ? `${d.avg_tage} Tage` : null,
    tertiaryLabel: "Wochenziel",
    tertiaryValue: w ? wochenzielSoll === null ? String(w.fertig_diese_woche)
      : `${w.fertig_diese_woche} / ${wochenzielSoll}` : null,
    periodLabel: period,
    progressBars,
    dataSources: [
      { tableOrView: "v_analyse_termintreue" },
      { tableOrView: "v_analyse_durchlaufzeit" },
      { tableOrView: "v_analyse_wochenziel" },
      { tableOrView: "v_operational_station_queue_v1" }
    ],
    linkedEntities: [], 
    emptyState: status === "data_missing" ? {
      title: "Daten nicht belastbar",
      description: "Es fehlen Start-/End-Events oder Zusagetermine.",
      targetLabel: "Zur Erfassung",
      targetHref: "/warendurchlauf"
    } : undefined
  };
}

export async function getAnalyseOverview(
  period: string,
  filters?: unknown,
): Promise<AnalyseActionResult<AnalyseTileSummary[]>> {
  void filters;
  try {
    const authorization = await readAuthorizedArea('buchhaltung');
    if (!authorization.ok) return {data:[],error:authorization.message};
    const supabase = await createClient();

    // Werkstatt Puls
    const [wochenziel, stationszahlen] = await Promise.all([
      readWerkstattWochenziel(authorization.data.tenantId), autorisierteStationszahlen(authorization.data),
    ]);
    const werkstattPuls = await getWerkstattPulsSummary(supabase, period, wochenziel, stationszahlen);

    const emptyTiles: AnalyseTileSummary[] = [
      {
        key: "umsatz_marge",
        title: "Umsatz & Marge",
        subtitle: "Finanzielle Kennzahlen",
        status: "data_missing",
        primaryLabel: "Umsatz",
        primaryValue: null,
        periodLabel: period,
        dataSources: [{ tableOrView: "v_analyse_umsatz_marge", maturityNote: "View not yet created." }],
        linkedEntities: [],
        emptyState: {
          title: "Datenansicht in Vorbereitung",
          description: "Diese Kachel wird zukünftig auf Basis echter Rechnungsausgänge aggregiert. Derzeit fehlen noch Live-Daten aus dem Buchhaltungsmodul.",
        }
      },
      {
        key: "qualitaet_risiko",
        title: "Qualität & Risiko",
        subtitle: "Reklamationen & Ausschuss",
        status: "data_missing",
        primaryLabel: "Reklamationen",
        primaryValue: null,
        periodLabel: period,
        dataSources: [{ tableOrView: "v_analyse_qualitaet_risiko", maturityNote: "View not yet created." }],
        linkedEntities: [],
        emptyState: {
          title: "Datenansicht in Vorbereitung",
          description: "Die Integration der Qualitätsdaten wird in einer späteren Phase erfolgen.",
        }
      },
      {
        key: "baeder_material",
        title: "Bäder & Material",
        subtitle: "Verbräuche & Messungen",
        status: "data_missing",
        primaryLabel: "Status",
        primaryValue: null,
        periodLabel: period,
        dataSources: [{ tableOrView: "v_analyse_baeder_material", maturityNote: "View not yet created." }],
        linkedEntities: [],
        emptyState: {
          title: "Datenansicht in Vorbereitung",
          description: "Bäderdaten werden noch nicht zentral gesammelt.",
        }
      },
      {
        key: "kunden_markt",
        title: "Kunden & Markt",
        subtitle: "Neukunden & Abwanderung",
        status: "data_missing",
        primaryLabel: "Aktiv",
        primaryValue: null,
        periodLabel: period,
        dataSources: [{ tableOrView: "v_analyse_kunden_markt", maturityNote: "View not yet created." }],
        linkedEntities: [],
        emptyState: {
          title: "Datenansicht in Vorbereitung",
          description: "Kundendaten werden in der CRM Phase 3 angebunden.",
        }
      },
      {
        key: "marketing_reaktivierung",
        title: "Marketing & Kundenreaktivierung",
        subtitle: "Kampagnen & Response",
        status: "data_missing",
        primaryLabel: "Wirkung",
        primaryValue: null,
        periodLabel: period,
        dataSources: [{ tableOrView: "v_analyse_marketing_reaktivierung", maturityNote: "View not yet created." }],
        linkedEntities: [],
        emptyState: {
          title: "Datenansicht in Vorbereitung",
          description: "Noch keine Marketing-Attribution verfügbar.",
        }
      }
    ];

    return { data: [werkstattPuls, ...emptyTiles] };
  } catch (error: unknown) {
    console.error("Error in getAnalyseOverview:", error);
    return { error: getErrorMessage(error), data: [] };
  }
}

export async function getAnalyseTileDetail(
  tileKey: AnalyseTileKey,
  period: string,
  filters?: unknown,
): Promise<AnalyseActionResult<AnalyseTileDetail | null>> {
  try {
    const authorization = await readAuthorizedArea('buchhaltung');
    if (!authorization.ok) return {data:null,error:authorization.message};
    
    // We get the summary for this tile
    const { data: overviews } = await getAnalyseOverview(period, filters);
    const summary = overviews.find(o => o.key === tileKey);
    
    if (!summary) throw new Error("Tile not found");

    const detail: AnalyseTileDetail = {
      summary,
      charts: [],
      rankings: [],
      affectedEntities: [],
      measures: [],
      dataSources: summary.dataSources
    };

    const supabase = await createClient();

    if (tileKey === "werkstatt_puls") {
      // 1. Fetch Views for Level 2 Details
      const { data: t }: AnalyseQueryResult<TermintreueRow> = await supabase
        .from('v_analyse_termintreue')
        .select('*')
        .single();
      const { data: d }: AnalyseQueryResult<DurchlaufzeitRow> = await supabase
        .from('v_analyse_durchlaufzeit')
        .select('*')
        .single();
      const { data: w }: AnalyseQueryResult<WochenzielRow> = await supabase
        .from('v_analyse_wochenziel')
        .select('*')
        .single();
      // Hole echte verspätete Aufträge
      const { data: delayedOrders, error: verzugFehler }: AnalyseQueryResult<AffectedOrderRow[]> & {error?:unknown} = await supabase.from('orders')
        .select('id, order_number, title, customer_id, customers(name), station, promised_due_date, completed_date, status')
        .eq('tenant_id', authorization.data.tenantId)
        .not('promised_due_date', 'is', null)
        .neq('status', 'storniert')
        .is('completed_date', null)
        .lt('promised_due_date', new Date().toISOString())
        .limit(10);

      const { data: missingDueOrders, error: zusageFehler }: AnalyseQueryResult<AffectedOrderRow[]> & {error?:unknown} = await supabase.from('orders')
        .select('id, order_number, title, customer_id, customers(name), station, promised_due_date, completed_date, status')
        .eq('tenant_id', authorization.data.tenantId)
        .eq('tenant_id', authorization.data.tenantId)
        .is('promised_due_date', null)
        .is('completed_date', null)
        .neq('status', 'storniert')
        .limit(10);

      if (verzugFehler || zusageFehler) {
        return { data: null, error: WERKSTATT_PULS_COPY.auftraegeFehlen };
      }

      // Mappings
      const termintreuePct = belegteTermintreue(t);
      const termintreueMessbarN = t?.nenner ?? 0;
      const ohneZusageterminN = t?.ohne_zusagetermin ?? 0;
      const { count: openOrdersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', authorization.data.tenantId)
        .is('completed_date', null);

      const avgTage = d?.avg_tage ?? null;
      const avgDurchlaufzeitMessbarN = d?.n ?? 0;
      const wochenzielIst = w?.fertig_diese_woche ?? null;
      const wochenzielSoll = await readWerkstattWochenziel(authorization.data.tenantId);
      const offeneAuftraegeN = openOrdersCount ?? 0; 
      const kritischeAuftraegeN = delayedOrders ? delayedOrders.length : 0;
      const dokumentationsquotePct = null; // not in view yet
      const dokumentationsquoteMessbarN = 0;
      
      // Affected Orders
      const affectedOrdersMapped: WerkstattPulsData["affectedOrders"] = [];
      (delayedOrders || []).forEach(order => {
        affectedOrdersMapped.push(toAffectedOrder(order, "critical"));
      });
      (missingDueOrders || []).forEach(order => {
        affectedOrdersMapped.push(toAffectedOrder(order, "missing_due_date"));
      });

      const auftraegeJeStation = await autorisierteStationszahlen(authorization.data);

      // Data Sources list
      const ds: WerkstattPulsData["dataSources"] = [
        { label: "Termintreue & DQ", sourceName: "v_analyse_termintreue", recordCount: 1, status: t ? "live" : "missing" },
        { label: "Durchlaufzeit", sourceName: "v_analyse_durchlaufzeit", recordCount: 1, status: d ? "live" : "missing" },
        { label: "Wochenziel", sourceName: "v_analyse_wochenziel", recordCount: 1, status: w ? "live" : "missing" },
        { label: WERKSTATT_PULS_COPY.stationszahlen, sourceName: "v_operational_station_queue_v1",
          recordCount: auftraegeJeStation?.length ?? null, status: auftraegeJeStation === null ? "missing" : "live" },
        { label: "Verlauf", sourceName: "kpi_snapshots", recordCount: null, status: "missing" }
      ];

      const requiredDataSources = ds.filter(source => source.sourceName !== "kpi_snapshots");
      const isLive = requiredDataSources.every(source => source.status === "live");
      const missingSourceWarnings = requiredDataSources
        .filter(source => source.status !== "live")
        .map(source => `DATA_THIN: Quelle fehlt — ${source.label}`);

      detail.werkstattPulsData = {
        period: toWerkstattPulsPeriod(period),
        dataStatus: {
          isLive,
          lastUpdatedAt: new Date().toISOString(),
          maturity: "S2",
          warnings: missingSourceWarnings
        },
        hero: {
          termintreuePct, termintreueMessbarN, ohneZusageterminN,
          avgDurchlaufzeitTage: avgTage, avgDurchlaufzeitMessbarN,
          wochenzielIst, wochenzielSoll, wochenzielQuelle: wochenzielSoll === null ? "missing" : "company_settings",
          offeneAuftraegeN, kritischeAuftraegeN,
          dokumentationsquotePct, dokumentationsquoteMessbarN
        },
        trend: {
          termintreue: [],
          avgDurchlaufzeit: [],
          comparison: { mode: "previous_period", available: false, reasonIfMissing: "Für einen Wochenverlauf werden mindestens zwei auswertbare Wochen benötigt." }
        },
        auftraegeJeStation,
        affectedOrders: affectedOrdersMapped,
        connectedLinks: [
          { label: "Bäder & Material", value: "Galvanik Status prüfen", href: "/baeder", enabled: true },
          { label: "Qualitätskontrolle", value: "Ausschuss prüfen", href: "/kontrolle", enabled: true },
          { label: "Warendurchlauf", value: "Stationen anzeigen", href: "/warendurchlauf", enabled: true }
        ],
        dataSources: ds
      };

      detail.charts = [];
    } else {
      detail.charts = [
        {
          id: "empty_chart",
          title: "Historie",
          type: "line",
          dataset: [],
          emptyState: summary.emptyState
        }
      ];
    }

    return { data: detail };
  } catch (error: unknown) {
    console.error("Error in getAnalyseTileDetail:", error);
    return { error: getErrorMessage(error), data: null };
  }
}

export async function getAnalyseLinkedEntities(
  tileKey: AnalyseTileKey,
  filters?: unknown,
): Promise<AnalyseActionResult<AnalyseEntityLink[]>> {
  void filters;
  try {
    const authorization = await readAuthorizedArea('buchhaltung');
    if (!authorization.ok) return {data:[],error:authorization.message};
    
    if (tileKey === "werkstatt_puls") {
      // In future: load delayed orders
      return { data: [] };
    }

    return { data: [] };
  } catch (error: unknown) {
    console.error("Error in getAnalyseLinkedEntities:", error);
    return { error: getErrorMessage(error), data: [] };
  }
}
