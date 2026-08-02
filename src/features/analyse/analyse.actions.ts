"use server";

import { db } from "@/db";
import { and, eq, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { customers, orders } from "@/db/schema";
import { resolveFinanceDataScope } from "@/lib/server/financeDataAccess";
import {
  AnalyseTileKey,
  AnalyseTileSummary,
  AnalyseTileDetail,
  AnalyseEntityLink,
  AnalyseTileStatus,
  WerkstattPulsData,
} from "@/lib/analyse/dataContracts";

type StationMetric = {
  station: string;
  avg_tage: number;
  teile_aktuell: number | null;
};
type TermintreueMetric = {
  termintreue_pct: number | null;
  nenner: number;
  ohne_zusagetermin: number;
};
type DurchlaufMetric = { avg_tage: number | null; n: number };
type WochenzielMetric = { fertig_diese_woche: number };
type EconomicsMetric = {
  engpass_revenue_eur: number | null;
  engpass_db_eur: number | null;
  actual_delay_cost_eur: number | null;
  model_delay_risk_eur: number | null;
  n_delayed_orders: number;
  missing_reasons: string[] | null;
};

function rows<T>(result: unknown): T[] {
  return Array.from(result as Iterable<T>);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unbekannter Analysefehler";
}

async function getWerkstattPulsSummary(period: string): Promise<AnalyseTileSummary> {
  const [termintreueResult, durchlaufResult, wochenzielResult, stationResult] =
    await Promise.all([
      db.execute(sql`
        SELECT termintreue_pct::double precision AS termintreue_pct,
               nenner::int AS nenner,
               ohne_zusagetermin::int AS ohne_zusagetermin
        FROM public.v_analyse_termintreue
        LIMIT 1
      `),
      db.execute(sql`
        SELECT avg_tage::double precision AS avg_tage, n::int AS n
        FROM public.v_analyse_durchlaufzeit
        LIMIT 1
      `),
      db.execute(sql`
        SELECT fertig_diese_woche::int AS fertig_diese_woche
        FROM public.v_analyse_wochenziel
        LIMIT 1
      `),
      db.execute(sql`
        SELECT station,
               avg_tage::double precision AS avg_tage,
               teile_aktuell::int AS teile_aktuell
        FROM public.v_analyse_station_durchlauf
      `),
    ]);
  const [t] = rows<TermintreueMetric>(termintreueResult);
  const [d] = rows<DurchlaufMetric>(durchlaufResult);
  const [w] = rows<WochenzielMetric>(wochenzielResult);
  const s = rows<StationMetric>(stationResult);

  // Ampellogik & Werte
  const termintreue = t?.termintreue_pct ?? 0;
  const ohneZusage = t?.ohne_zusagetermin ?? 0;
  const avgTage = d?.avg_tage ?? 0;
  
  // Wochenziel
  const wochenzielIst = w?.fertig_diese_woche ?? 0;
  // Status-Logik
  let status: AnalyseTileStatus = "data_missing";
  if (t && d && w) {
    if (termintreue < 80 || avgTage > 10 || ohneZusage > 10) {
      status = "critical";
    } else if (termintreue < 90 || avgTage > 7 || ohneZusage > 0) {
      status = "watch";
    } else {
      status = "stable";
    }
  }

  // Score Ring (Beispiel: Ohne Wochenziel nur Termintreue)
  let scoreRing: number | undefined = undefined;
  if (t) {
    scoreRing = termintreue;
  }

  // Stationen-Minibalken (Top 4 Stationen mit dem höchsten Durchlauf)
  const progressBars = s
    .sort((a, b) => b.avg_tage - a.avg_tage)
    .slice(0, 4)
    .map((station) => ({
      label: station.station,
      value: station.avg_tage,
      fillRatio: Math.min(100, (station.avg_tage / 10) * 100), // Angenommen 10 Tage ist max
      colorClass: station.avg_tage > 5 ? "bg-red-500" : "bg-blue-500",
    }));

  return {
    key: "werkstatt_puls",
    title: "Werkstatt-Puls",
    subtitle: "Termintreue & Durchlaufzeit",
    status,
    primaryLabel: "Termintreue",
    primaryValue: t?.termintreue_pct ? `${t.termintreue_pct}%` : null,
    secondaryLabel: "Ø Durchlaufzeit",
    secondaryValue: d?.avg_tage ? `${d.avg_tage} Tage` : null,
    tertiaryLabel: "Wochenziel",
    tertiaryValue: w ? `${wochenzielIst} (kein Ziel gesetzt)` : null,
    periodLabel: period,
    scoreRing,
    progressBars,
    dataSources: [
      { tableOrView: "v_analyse_termintreue" },
      { tableOrView: "v_analyse_durchlaufzeit" },
      { tableOrView: "v_analyse_wochenziel" },
      { tableOrView: "v_analyse_station_durchlauf" }
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
  filters?: Record<string, unknown>,
): Promise<{ data: AnalyseTileSummary[]; error?: string }> {
  try {
    void filters;
    const scope = await resolveFinanceDataScope(["perm_view_leitstand"]);
    if (!scope.ok) return { error: scope.message, data: [] };
    // Werkstatt Puls
    const werkstattPuls = await getWerkstattPulsSummary(period);

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
    return { error: errorMessage(error), data: [] };
  }
}

export async function getAnalyseTileDetail(
  tileKey: AnalyseTileKey,
  period: string,
  filters?: Record<string, unknown>,
): Promise<{ data: AnalyseTileDetail | null; error?: string }> {
  try {
    const scope = await resolveFinanceDataScope(["perm_view_leitstand"]);
    if (!scope.ok) throw new Error(scope.message);
    
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

    if (tileKey === "werkstatt_puls") {
      // 1. Fetch Views for Level 2 Details
      const [termintreueResult, durchlaufResult, wochenzielResult, stationResult] =
        await Promise.all([
          db.execute(sql`
            SELECT termintreue_pct::double precision AS termintreue_pct,
                   nenner::int AS nenner,
                   ohne_zusagetermin::int AS ohne_zusagetermin
            FROM public.v_analyse_termintreue
            LIMIT 1
          `),
          db.execute(sql`
            SELECT avg_tage::double precision AS avg_tage, n::int AS n
            FROM public.v_analyse_durchlaufzeit
            LIMIT 1
          `),
          db.execute(sql`
            SELECT fertig_diese_woche::int AS fertig_diese_woche
            FROM public.v_analyse_wochenziel
            LIMIT 1
          `),
          db.execute(sql`
            SELECT station,
                   avg_tage::double precision AS avg_tage,
                   teile_aktuell::int AS teile_aktuell
            FROM public.v_analyse_station_durchlauf
          `),
        ]);
      const [t] = rows<TermintreueMetric>(termintreueResult);
      const [d] = rows<DurchlaufMetric>(durchlaufResult);
      const [w] = rows<WochenzielMetric>(wochenzielResult);
      const s = rows<StationMetric>(stationResult);
      const [eco] = scope.data.canViewFinance
        ? rows<EconomicsMetric>(
            await db.execute(sql`
              SELECT
                COALESCE(sum(revenue_reference_eur), 0)::double precision AS engpass_revenue_eur,
                COALESCE(sum(db_ist), 0)::double precision AS engpass_db_eur,
                COALESCE(sum(actual_delay_cost_eur), 0)::double precision AS actual_delay_cost_eur,
                COALESCE(sum(model_delay_risk_eur), 0)::double precision AS model_delay_risk_eur,
                count(*)::int AS n_delayed_orders,
                COALESCE(
                  (
                    SELECT array_agg(DISTINCT reason)
                    FROM public.v_analyse_werkstatt_puls_economics AS detail
                    CROSS JOIN LATERAL unnest(detail.missing_reasons) AS reason
                    WHERE detail.delay_days > 0
                  ),
                  ARRAY[]::text[]
                ) AS missing_reasons
              FROM public.v_analyse_werkstatt_puls_economics
              WHERE delay_days > 0
            `),
          )
        : [];

      // Hole echte verspätete Aufträge
      const orderProjection = {
        id: orders.id,
        orderNumber: orders.orderNumber,
        title: orders.title,
        customerId: orders.customerId,
        customerName: customers.name,
        currentStationId: orders.currentStationId,
        promisedDueDate: orders.promisedDueDate,
        completedDate: orders.completedDate,
        status: orders.status,
      };
      const delayedOrders = await db
        .select(orderProjection)
        .from(orders)
        .leftJoin(
          customers,
          and(
            eq(customers.id, orders.customerId),
            eq(customers.tenantId, scope.data.tenantId),
          ),
        )
        .where(
          and(
            eq(orders.tenantId, scope.data.tenantId),
            isNotNull(orders.promisedDueDate),
            isNull(orders.completedDate),
            lt(orders.promisedDueDate, new Date()),
          ),
        )
        .limit(10);

      const missingDueOrders = await db
        .select(orderProjection)
        .from(orders)
        .leftJoin(
          customers,
          and(
            eq(customers.id, orders.customerId),
            eq(customers.tenantId, scope.data.tenantId),
          ),
        )
        .where(
          and(
            eq(orders.tenantId, scope.data.tenantId),
            isNull(orders.promisedDueDate),
            ne(orders.status, "storniert"),
          ),
        )
        .limit(10);

      // Mappings
      const termintreuePct = t?.termintreue_pct ?? null;
      const termintreueMessbarN = t?.nenner ?? 0;
      const ohneZusageterminN = t?.ohne_zusagetermin ?? 0;
      const [openOrders] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, scope.data.tenantId),
            isNull(orders.completedDate),
          ),
        );

      const avgTage = d?.avg_tage ?? null;
      const avgDurchlaufzeitMessbarN = d?.n ?? 0;
      const wochenzielIst = w?.fertig_diese_woche ?? 0;
      const wochenzielSoll = null; 
      const offeneAuftraegeN = openOrders?.count ?? 0;
      const kritischeAuftraegeN = delayedOrders.length;
      const dokumentationsquotePct = null; // not in view yet
      const dokumentationsquoteMessbarN = 0;
      
      let status: "ok" | "watch" | "critical" | "insufficient_data" = "insufficient_data";
      if (t && d) {
        if ((termintreuePct !== null && termintreuePct < 80) || (avgTage !== null && avgTage > 10) || ohneZusageterminN > 10) status = "critical";
        else if ((termintreuePct !== null && termintreuePct < 90) || (avgTage !== null && avgTage > 7) || ohneZusageterminN > 0) status = "watch";
        else status = "ok";
      }

      const scoreRing = termintreuePct !== null ? termintreuePct : null;

      // Stations
      const stations: WerkstattPulsData["stations"] = s.map((st) => ({
        stationId: st.station,
        stationName: st.station,
        status: (st.avg_tage > 5 ? "critical" : (st.avg_tage > 2 ? "watch" : "ok")) as "critical" | "watch" | "ok" | "free",
        auslastungPct: Math.min(100, Math.round((st.avg_tage / 10) * 100)),
        wartendN: st.teile_aktuell ?? 0,
        avgWartezeitTage: st.avg_tage ?? null,
        engpassScore: Math.round((st.avg_tage ?? 0) * (st.teile_aktuell ?? 0)),
        hauptursache: null,
        openUrl: `/orders?station=${encodeURIComponent(st.station)}&returnTo=/performance?tile=werkstatt_puls`
      }));

      // Affected Orders
      const affectedOrdersMapped: WerkstattPulsData["affectedOrders"] = [];
      delayedOrders.forEach((o) => {
        affectedOrdersMapped.push({
          orderId: o.id,
          orderNumber: o.orderNumber,
          title: o.title || 'Ohne Titel',
          customerId: o.customerId,
          customerName: o.customerName || 'Unbekannt',
          stationName: o.currentStationId || 'Unbekannt',
          promisedDueDate: o.promisedDueDate?.toISOString() ?? null,
          completedDate: o.completedDate?.toISOString() ?? null,
          delayDays: o.promisedDueDate
            ? Math.round((Date.now() - o.promisedDueDate.getTime()) / (1000 * 3600 * 24))
            : null,
          status: "critical",
          priority: o.status,
          openUrl: `/orders/${o.id}?returnTo=/performance?tile=werkstatt_puls`
        });
      });
      missingDueOrders.forEach((o) => {
        affectedOrdersMapped.push({
          orderId: o.id,
          orderNumber: o.orderNumber,
          title: o.title || 'Ohne Titel',
          customerId: o.customerId,
          customerName: o.customerName || 'Unbekannt',
          stationName: o.currentStationId || 'Unbekannt',
          promisedDueDate: o.promisedDueDate?.toISOString() ?? null,
          completedDate: o.completedDate?.toISOString() ?? null,
          delayDays: null,
          status: "missing_due_date",
          priority: o.status,
          openUrl: `/orders/${o.id}?returnTo=/performance?tile=werkstatt_puls`
        });
      });

      // Data Sources list
      const ds: WerkstattPulsData["dataSources"] = [
        { label: "Termintreue & DQ", sourceName: "v_analyse_termintreue", recordCount: 1, status: t ? "live" : "missing" },
        { label: "Durchlaufzeit", sourceName: "v_analyse_durchlaufzeit", recordCount: 1, status: d ? "live" : "missing" },
        { label: "Wochenziel", sourceName: "v_analyse_wochenziel", recordCount: 1, status: w ? "live" : "missing" },
        { label: "Stationen Durchlauf", sourceName: "v_analyse_station_durchlauf", recordCount: s.length, status: "live" },
        { label: "Wirtschaftlichkeit", sourceName: "v_analyse_werkstatt_puls_economics", recordCount: eco ? 1 : 0, status: eco ? "live" : "missing" },
        { label: "Verlauf", sourceName: "kpi_snapshots", recordCount: null, status: "missing" }
      ];

      const normalizedPeriod: WerkstattPulsData["period"] = [
        "today",
        "week",
        "month",
        "custom",
      ].includes(period)
        ? (period as WerkstattPulsData["period"])
        : "month";

      detail.werkstattPulsData = {
        period: normalizedPeriod,
        dataStatus: {
          isLive: true,
          lastUpdatedAt: new Date().toISOString(),
          maturity: "S2",
          warnings: []
        },
        hero: {
          termintreuePct, termintreueMessbarN, ohneZusageterminN,
          avgDurchlaufzeitTage: avgTage, avgDurchlaufzeitMessbarN,
          wochenzielIst, wochenzielSoll, wochenzielQuelle: "missing",
          offeneAuftraegeN, kritischeAuftraegeN,
          dokumentationsquotePct, dokumentationsquoteMessbarN,
          werkstattScore: scoreRing, scoreStatus: status
        },
        trend: {
          termintreue: [],
          avgDurchlaufzeit: [],
          comparison: { mode: "previous_period", available: false, reasonIfMissing: "Für einen Wochenverlauf werden mindestens zwei auswertbare Wochen benötigt." }
        },
        stations,
        affectedOrders: affectedOrdersMapped,
        economics: {
          engpassRevenueEur: eco?.engpass_revenue_eur ?? null,
          engpassDbEur: eco?.engpass_db_eur ?? null,
          actualDelayCostEur: eco?.actual_delay_cost_eur ?? null,
          modelDelayRiskEur: eco?.model_delay_risk_eur ?? null,
          confidence: eco ? (eco.n_delayed_orders > 0 ? "high" : "medium") : "none",
          missingReasons: eco?.missing_reasons ?? [],
          affectedOrderCount: eco?.n_delayed_orders ?? 0,
        },
        insight: {
          available: stations.length > 0,
          source: "rules",
          observation: stations.length > 0 ? `${stations[0].stationName} ist aktuell stärkster Engpass. ${stations[0].wartendN} Teile warten dort, Ø Wartezeit ${stations[0].avgWartezeitTage} Tage.` : 'Noch keine belastbare Engpass-Einschätzung.',
          recommendation: stations.length > 0 ? "Betroffene Aufträge prüfen und Reihenfolge für heute festlegen." : null,
          actionLinks: stations.length > 0 ? [{ label: "Aufträge öffnen", href: stations[0].openUrl }] : []
        },
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
    return { error: errorMessage(error), data: null };
  }
}

export async function getAnalyseLinkedEntities(
  tileKey: AnalyseTileKey,
  filters?: Record<string, unknown>,
): Promise<{ data: AnalyseEntityLink[]; error?: string }> {
  try {
    void filters;
    const scope = await resolveFinanceDataScope(["perm_view_leitstand"]);
    if (!scope.ok) return { error: scope.message, data: [] };
    
    if (tileKey === "werkstatt_puls") {
      // In future: load delayed orders
      return { data: [] };
    }

    return { data: [] };
  } catch (error: unknown) {
    console.error("Error in getAnalyseLinkedEntities:", error);
    return { error: errorMessage(error), data: [] };
  }
}
