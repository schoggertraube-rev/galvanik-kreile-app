"use server";

import { checkAppAuth } from "@/lib/server/authHelper";
import { createClient } from "@/lib/supabase/server";
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

type StationDurchlaufRow = {
  station: string;
  avg_tage: number | null;
  teile_aktuell: number;
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

async function getWerkstattPulsSummary(supabase: AnalyseSupabaseClient, period: string): Promise<AnalyseTileSummary> {
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
  const { data: s }: AnalyseQueryResult<StationDurchlaufRow[]> = await supabase
    .from('v_analyse_station_durchlauf')
    .select('*');

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
  const progressBars = (s || [])
    .sort((a, b) => (b.avg_tage ?? 0) - (a.avg_tage ?? 0))
    .slice(0, 4)
    .map(station => {
      const avgTage = station.avg_tage ?? 0;

      return {
        label: station.station,
        value: avgTage,
        fillRatio: Math.min(100, (avgTage / 10) * 100), // Angenommen 10 Tage ist max
        colorClass: avgTage > 5 ? "bg-red-500" : "bg-blue-500",
      };
    });

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
  filters?: unknown,
): Promise<AnalyseActionResult<AnalyseTileSummary[]>> {
  void filters;
  try {
    await checkAppAuth();
    const supabase = await createClient();

    // Werkstatt Puls
    const werkstattPuls = await getWerkstattPulsSummary(supabase, period);

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
    await checkAppAuth();
    
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
      const { data: s }: AnalyseQueryResult<StationDurchlaufRow[]> = await supabase
        .from('v_analyse_station_durchlauf')
        .select('*');
      const { data: eco } = await supabase.from('v_analyse_werkstatt_puls_economics').select('*').single();

      // Hole echte verspätete Aufträge
      const { data: delayedOrders } = await supabase.from('orders')
        .select('id, internal_id, title, customer_id, customers(name), current_station_id, promised_due_date, completed_date, status')
        .eq('tenant_id', 'galvanik-kreile')
        .not('promised_due_date', 'is', null)
        .is('completed_date', null)
        .lt('promised_due_date', new Date().toISOString())
        .limit(10);

      const { data: missingDueOrders } = await supabase.from('orders')
        .select('id, internal_id, title, customer_id, customers(name), current_station_id, promised_due_date, completed_date, status')
        .eq('tenant_id', 'galvanik-kreile')
        .is('promised_due_date', null)
        .neq('status', 'storniert')
        .limit(10);

      // Mappings
      const termintreuePct = t?.termintreue_pct ?? null;
      const termintreueMessbarN = t?.nenner ?? 0;
      const ohneZusageterminN = t?.ohne_zusagetermin ?? 0;
      const { count: openOrdersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', 'galvanik-kreile')
        .is('completed_date', null);

      const avgTage = d?.avg_tage ?? null;
      const avgDurchlaufzeitMessbarN = d?.n ?? 0;
      const wochenzielIst = w?.fertig_diese_woche ?? 0;
      const wochenzielSoll = null; 
      const offeneAuftraegeN = openOrdersCount ?? 0; 
      const kritischeAuftraegeN = delayedOrders ? delayedOrders.length : 0;
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
      const stations = (s || []).map(st => {
        const avgTage = st.avg_tage ?? 0;
        const teileAktuell = st.teile_aktuell ?? 0;

        return {
          stationId: st.station,
          stationName: st.station,
          status: (avgTage > 5 ? "critical" : (avgTage > 2 ? "watch" : "ok")) as "critical" | "watch" | "ok" | "free",
          auslastungPct: Math.min(100, Math.round((avgTage / 10) * 100)),
          wartendN: teileAktuell,
          avgWartezeitTage: st.avg_tage ?? null,
          engpassScore: Math.round(avgTage * teileAktuell),
          hauptursache: null,
          openUrl: `/orders?station=${encodeURIComponent(st.station)}&returnTo=/performance?tile=werkstatt_puls`
        };
      });

      // Affected Orders
      const affectedOrdersMapped: WerkstattPulsData["affectedOrders"] = [];
      (delayedOrders || []).forEach((o: any) => {
        affectedOrdersMapped.push({
          orderId: o.id,
          orderNumber: o.internal_id,
          title: o.title || 'Ohne Titel',
          customerId: o.customer_id,
          customerName: o.customers?.name || 'Unbekannt',
          stationName: o.current_station_id || 'Unbekannt',
          promisedDueDate: o.promised_due_date,
          completedDate: o.completed_date,
          delayDays: Math.round((new Date().getTime() - new Date(o.promised_due_date).getTime()) / (1000 * 3600 * 24)),
          status: "critical",
          priority: o.status,
          openUrl: `/orders/${o.id}?returnTo=/performance?tile=werkstatt_puls`
        });
      });
      (missingDueOrders || []).forEach((o: any) => {
        affectedOrdersMapped.push({
          orderId: o.id,
          orderNumber: o.internal_id,
          title: o.title || 'Ohne Titel',
          customerId: o.customer_id,
          customerName: o.customers?.name || 'Unbekannt',
          stationName: o.current_station_id || 'Unbekannt',
          promisedDueDate: o.promised_due_date,
          completedDate: o.completed_date,
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
        { label: "Stationen Durchlauf", sourceName: "v_analyse_station_durchlauf", recordCount: s ? s.length : 0, status: s ? "live" : "missing" },
        { label: "Wirtschaftlichkeit", sourceName: "v_analyse_werkstatt_puls_economics", recordCount: 1, status: eco ? "live" : "missing" },
        { label: "Verlauf", sourceName: "kpi_snapshots", recordCount: null, status: "missing" }
      ];

      detail.werkstattPulsData = {
        period: period as any,
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
          engpassRevenueEur: eco?.engpass_revenue_eur ?? 0,
          engpassDbEur: eco?.engpass_db_eur ?? 0,
          actualDelayCostEur: eco?.actual_delay_cost_eur ?? 0,
          modelDelayRiskEur: eco?.model_delay_risk_eur ?? 0,
          confidence: eco ? (eco.n_delayed_orders > 0 ? "high" : "medium") : "none",
          missingReasons: [],
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
    return { error: getErrorMessage(error), data: null };
  }
}

export async function getAnalyseLinkedEntities(
  tileKey: AnalyseTileKey,
  filters?: unknown,
): Promise<AnalyseActionResult<AnalyseEntityLink[]>> {
  void filters;
  try {
    await checkAppAuth();
    
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
