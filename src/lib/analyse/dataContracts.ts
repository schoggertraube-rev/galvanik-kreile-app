export type AnalyseTileKey =
  | "better_next"
  | "werkstatt_puls"
  | "umsatz_marge"
  | "qualitaet_risiko"
  | "baeder_material"
  | "kunden_markt"
  | "marketing_reaktivierung"
  | "datenqualitaet";

export type AnalyseTileStatus =
  | "stable"
  | "watch"
  | "critical"
  | "data_missing"
  | "disabled";

export type AnalyseEntityLink = {
  id: string;
  label: string;
  type:
    | "order"
    | "customer"
    | "item"
    | "station"
    | "bath"
    | "invoice"
    | "payment"
    | "communication"
    | "complaint"
    | "inventory"
    | "marketing"
    | "data_quality";
  href?: string;
  overlay?: "order" | "customer" | "invoice" | "none";
  returnTo: string;
};

export type AnalyseDataSource = {
  tableOrView: string;
  fields?: string[];
  calculation?: string;
  maturityNote?: string;
};

export type AnalyseTileSummary = {
  key: AnalyseTileKey;
  title: string;
  subtitle: string;
  status: AnalyseTileStatus;
  primaryLabel: string;
  primaryValue: string | null;
  secondaryLabel?: string;
  secondaryValue?: string | null;
  tertiaryLabel?: string;
  tertiaryValue?: string | null;
  periodLabel: string;
  scoreRing?: number; // 0-100 for a radial progress indicator
  progressBars?: Array<{ label: string; value: number; fillRatio: number; colorClass?: string }>; // for mini bar charts
  sparkline?: Array<{ x: string; y: number }>;
  chips?: Array<{ label: string; value?: string; status?: AnalyseTileStatus }>;
  dataSources: AnalyseDataSource[];
  linkedEntities: AnalyseEntityLink[];
  emptyState?: {
    title: string;
    description: string;
    targetLabel?: string;
    targetHref?: string;
  };
  nextAction?: {
    label: string;
    reason: string;
    target: AnalyseEntityLink;
  };
};

export type AnalyseTileDetail = {
  summary: AnalyseTileSummary;
  charts: Array<{
    id: string;
    title: string;
    type: "line" | "bar" | "stacked_bar" | "heatmap" | "matrix" | "list";
    dataset: unknown[];
    emptyState?: AnalyseTileSummary["emptyState"];
  }>;
  rankings: Array<{
    id: string;
    title: string;
    rows: unknown[];
  }>;
  affectedEntities: AnalyseEntityLink[];
  measures: Array<{
    id: string;
    title: string;
    reason: string;
    target: AnalyseEntityLink;
    enabled: boolean;
    disabledReason?: string;
  }>;
  dataSources: AnalyseDataSource[];
  werkstattPulsData?: WerkstattPulsData;
};

export type WerkstattPulsData = {
  period: "today" | "week" | "month" | "custom";

  dataStatus: {
    isLive: boolean;
    lastUpdatedAt: string | null;
    maturity: "S0" | "S1" | "S2" | "S3" | "S4";
    warnings: string[];
  };

  hero: {
    termintreuePct: number | null;
    termintreueMessbarN: number;
    ohneZusageterminN: number;

    avgDurchlaufzeitTage: number | null;
    avgDurchlaufzeitMessbarN: number;

    wochenzielIst: number | null;
    wochenzielSoll: number | null;
    wochenzielQuelle: "company_settings" | "kpi_targets" | "view_default" | "missing";

    offeneAuftraegeN: number;
    kritischeAuftraegeN: number;

    dokumentationsquotePct: number | null;
    dokumentationsquoteMessbarN: number;

    werkstattScore: number | null;
    scoreStatus: "ok" | "watch" | "critical" | "insufficient_data";
  };

  trend: {
    termintreue: Array<{
      label: string;
      periodStart: string;
      valuePct: number | null;
      messbarN: number;
    }>;
    avgDurchlaufzeit: Array<{
      label: string;
      periodStart: string;
      valueTage: number | null;
      messbarN: number;
    }>;
    comparison?: {
      mode: "previous_period" | "previous_year";
      available: boolean;
      reasonIfMissing?: string;
    };
  };

  stations: Array<{
    stationId: string;
    stationName: string;
    status: "free" | "ok" | "watch" | "critical" | "unavailable";
    auslastungPct: number | null;
    wartendN: number;
    avgWartezeitTage: number | null;
    engpassScore: number | null;
    hauptursache: string | null;
    openUrl: string;
  }>;

  affectedOrders: Array<{
    orderId: string;
    orderNumber: string;
    title: string;
    customerId: string;
    customerName: string;
    stationName: string;
    promisedDueDate: string | null;
    completedDate: string | null;
    delayDays: number | null;
    status: "critical" | "watch" | "ok" | "missing_due_date";
    priority: string | null;
    openUrl: string;
  }>;

  economics: {
    engpassRevenueEur: number | null;
    engpassDbEur: number | null;
    actualDelayCostEur: number | null;
    modelDelayRiskEur: number | null;
    confidence: "none" | "low" | "medium" | "high";
    missingReasons: string[];
    affectedOrderCount: number;
  };

  insight: {
    available: boolean;
    source: "rules" | "edge_function" | "none";
    observation: string | null;
    recommendation: string | null;
    actionLinks: Array<{
      label: string;
      href: string;
    }>;
  };

  connectedLinks: Array<{
    label: string;
    value: string;
    href: string;
    enabled: boolean;
    emptyReason?: string;
  }>;

  dataSources: Array<{
    label: string;
    sourceName: string;
    recordCount: number | null;
    status: "live" | "empty" | "missing" | "partial";
  }>;
};
