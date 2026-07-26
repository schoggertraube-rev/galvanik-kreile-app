"use server";

import { and, asc, eq, gte, inArray, isNull, lt, notIlike, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import type {
  AnalyseEntityLink,
  AnalyseTileDetail,
  AnalyseTileKey,
  AnalyseTileStatus,
  AnalyseTileSummary,
  WerkstattPulsData,
} from "@/lib/analyse/dataContracts";
import type { ClaimEvidenceV1 } from "@/lib/analytics/evidenceContract";
import {
  getAnalyseReturnTo,
  type AnalysePeriod,
} from "@/lib/analyse/routes";
import {
  buildUnavailableAnalysisEvidence,
  buildWorkshopEvidence,
  type WorkshopEvidenceOrder,
} from "@/lib/analytics/workshopEvidence";
import { resolveAuthorization } from "@/lib/server/authorization";

const TENANT_ID = "galvanik-kreile";
const DAY_MS = 24 * 60 * 60 * 1_000;

type AnalyseActor = { tenantId: string };
type Period = {
  key: "today" | "week" | "month";
  label: AnalysePeriod;
  start: Date;
  end: Date;
};

type WorkshopSnapshot = {
  period: Period;
  summary: AnalyseTileSummary;
  detail: WerkstattPulsData;
  evidence: ClaimEvidenceV1[];
};

async function requireAnalyseRead(): Promise<AnalyseActor> {
  const authorization = await resolveAuthorization();
  if (
    !authorization.ok ||
    authorization.data.tenantId !== TENANT_ID ||
    !authorization.data.permissions.includes("perm_view_leitstand")
  ) {
    throw new Error("AUTH_ERROR: Forbidden");
  }
  return { tenantId: authorization.data.tenantId };
}

function parsePeriod(value: string, now = new Date()): Period {
  const normalized = value.trim().toLowerCase();
  if (normalized === "heute" || normalized === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { key: "today", label: "Heute", start, end: new Date(start.getTime() + DAY_MS) };
  }
  if (normalized === "woche" || normalized === "week") {
    const start = new Date(now);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    start.setHours(0, 0, 0, 0);
    return { key: "week", label: "Woche", start, end: new Date(start.getTime() + 7 * DAY_MS) };
  }
  if (normalized === "monat" || normalized === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { key: "month", label: "Monat", start, end };
  }
  throw new Error("INVALID_ANALYSE_PERIOD");
}

function unavailableTiles(periodLabel: string): AnalyseTileSummary[] {
  const tiles: Array<Pick<AnalyseTileSummary, "key" | "title" | "subtitle" | "primaryLabel"> & { description: string }> = [
    {
      key: "umsatz_marge",
      title: "Umsatz & Marge",
      subtitle: "Finanzielle Kennzahlen",
      primaryLabel: "Umsatz",
      description: "Diese Kennzahl wird erst angezeigt, wenn der mandantengebundene Rechnungs- und Kostenpfad vollständig auswertbar ist.",
    },
    {
      key: "qualitaet_risiko",
      title: "Qualität & Risiko",
      subtitle: "Reklamationen & Ausschuss",
      primaryLabel: "Reklamationen",
      description: "Eine belastbare Qualitätsquote ist noch nicht instrumentiert. Fehlende Daten werden nicht als null Reklamationen gewertet.",
    },
    {
      key: "baeder_material",
      title: "Bäder & Material",
      subtitle: "Verbräuche & Messungen",
      primaryLabel: "Status",
      description: "Mess- und Verbrauchsdaten besitzen noch keine vollständige, periodisierte Auswertungsgrundlage.",
    },
    {
      key: "kunden_markt",
      title: "Kunden & Markt",
      subtitle: "Neukunden & Abwanderung",
      primaryLabel: "Aktivität",
      description: "Aktiv- und Abwanderungsdefinitionen sind noch nicht fachlich festgelegt und werden deshalb nicht geschätzt.",
    },
    {
      key: "marketing_reaktivierung",
      title: "Marketing & Kundenreaktivierung",
      subtitle: "Kampagnen & Response",
      primaryLabel: "Wirkung",
      description: "Marketingwirkung wird erst mit bestätigten Touchpoints und Attribution angezeigt.",
    },
  ];

  return tiles.map((tile) => ({
    key: tile.key,
    title: tile.title,
    subtitle: tile.subtitle,
    status: "data_missing",
    primaryLabel: tile.primaryLabel,
    primaryValue: null,
    periodLabel,
    dataSources: [{ tableOrView: "nicht_instrumentiert", maturityNote: tile.description }],
    linkedEntities: [],
    emptyState: { title: "Noch nicht belastbar", description: tile.description },
  }));
}

async function loadWorkshopSnapshot(actor: AnalyseActor, periodInput: string, now = new Date()): Promise<WorkshopSnapshot> {
  const period = parsePeriod(periodInput, now);
  const normalizedStatus = sql<string>`lower(coalesce(${orders.status}, ''))`;
  const promisedDueDate = orders.promisedDueDate;
  const productionOrder = and(
    notInArray(sql`coalesce(${orders.source}, 'manual')`, ["seed", "test", "demo", "integration-test"]),
    notIlike(sql`coalesce(${orders.orderNumber}, '')`, "A-SEED-%"),
    notIlike(sql`coalesce(${orders.orderNumber}, '')`, "%TEST%"),
  );
  const activeOrder = and(
    eq(orders.tenantId, actor.tenantId),
    isNull(orders.completedDate),
    notInArray(normalizedStatus, ["completed", "shipped", "cancelled", "canceled", "abgeschlossen", "versendet", "storniert", "fertig", "done"]),
    productionOrder,
  );
  const completedInPeriod = and(
    eq(orders.tenantId, actor.tenantId),
    gte(orders.completedDate, period.start),
    lt(orders.completedDate, period.end),
    inArray(normalizedStatus, ["completed", "shipped", "abgeschlossen", "versendet", "fertig", "done"]),
    productionOrder,
  );
  const stationName = sql<string>`coalesce(${orders.currentStationId}, ${orders.station}, 'nicht_zugeordnet')`;

  const [completedRows, openRows, stationRows, delayedOrders, missingDueOrders, evidenceRows] = await db.transaction(async (tx) => Promise.all([
    tx.select({
      completedCount: sql<number>`count(*)::int`,
      dueDateMeasurable: sql<number>`count(*) filter (where ${promisedDueDate} is not null)::int`,
      deliveredOnTime: sql<number>`count(*) filter (
        where ${promisedDueDate} is not null and ${orders.completedDate} <= ${promisedDueDate}
      )::int`,
      cycleMeasurable: sql<number>`count(*) filter (
        where ${orders.intakeDate} is not null and ${orders.completedDate} >= ${orders.intakeDate}
      )::int`,
      averageCycleDays: sql<number | null>`avg(
        extract(epoch from (${orders.completedDate} - ${orders.intakeDate})) / 86400.0
      ) filter (where ${orders.intakeDate} is not null and ${orders.completedDate} >= ${orders.intakeDate})`,
    }).from(orders).where(completedInPeriod),
    tx.select({
      openCount: sql<number>`count(*)::int`,
      withoutDueDate: sql<number>`count(*) filter (where ${promisedDueDate} is null)::int`,
      overdueCount: sql<number>`count(*) filter (where ${promisedDueDate} < ${now})::int`,
    }).from(orders).where(activeOrder),
    tx.select({ station: stationName, count: sql<number>`count(*)::int` })
      .from(orders)
      .where(activeOrder)
      .groupBy(stationName)
      .orderBy(sql`count(*) desc`, stationName),
    tx.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      title: orders.title,
      customerId: orders.customerId,
      customerName: customers.name,
      station: stationName,
      promisedDueDate,
      completedDate: orders.completedDate,
      priority: orders.priority,
    }).from(orders).leftJoin(customers, and(
      eq(customers.id, orders.customerId),
      eq(customers.tenantId, actor.tenantId),
    )).where(and(activeOrder, lt(promisedDueDate, now)))
      .orderBy(asc(promisedDueDate)).limit(10),
    tx.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      title: orders.title,
      customerId: orders.customerId,
      customerName: customers.name,
      station: stationName,
      promisedDueDate,
      completedDate: orders.completedDate,
      priority: orders.priority,
    }).from(orders).leftJoin(customers, and(
      eq(customers.id, orders.customerId),
      eq(customers.tenantId, actor.tenantId),
    )).where(and(activeOrder, isNull(promisedDueDate)))
      .orderBy(asc(orders.createdAt)).limit(10),
    tx.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      title: orders.title,
      createdAt: orders.createdAt,
      intakeDate: orders.intakeDate,
      completedDate: orders.completedDate,
      promisedDueDate,
      station: stationName,
      active: sql<boolean>`case when ${activeOrder} then true else false end`,
      completedInPeriod: sql<boolean>`case when ${completedInPeriod} then true else false end`,
    }).from(orders)
      .where(or(activeOrder, completedInPeriod))
      .orderBy(asc(orders.createdAt), asc(orders.id))
      .limit(501),
  ]), { isolationLevel: "repeatable read", accessMode: "read only" });

  const completed = completedRows[0];
  const open = openRows[0];
  const completedCount = Number(completed?.completedCount || 0);
  const dueDateMeasurable = Number(completed?.dueDateMeasurable || 0);
  const deliveredOnTime = Number(completed?.deliveredOnTime || 0);
  const cycleMeasurable = Number(completed?.cycleMeasurable || 0);
  const openCount = Number(open?.openCount || 0);
  const withoutDueDate = Number(open?.withoutDueDate || 0);
  const overdueCount = Number(open?.overdueCount || 0);
  const termintreuePct = dueDateMeasurable > 0 ? Math.round(deliveredOnTime / dueDateMeasurable * 1_000) / 10 : null;
  const averageCycleDays = completed?.averageCycleDays === null || completed?.averageCycleDays === undefined
    ? null
    : Math.round(Number(completed.averageCycleDays) * 10) / 10;
  const hasData = completedCount > 0 || openCount > 0;
  const status: AnalyseTileStatus = !hasData || dueDateMeasurable === 0
    ? "data_missing"
    : overdueCount > 0
      ? "watch"
      : "stable";
  const maxStationCount = stationRows.reduce((maximum, row) => Math.max(maximum, Number(row.count)), 0);
  const returnTo = getAnalyseReturnTo("werkstatt_puls", period.label);
  const calculatedAt = new Date();

  const mappedAffectedOrders: WerkstattPulsData["affectedOrders"] = [
    ...delayedOrders.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      title: order.title,
      customerId: order.customerId,
      customerName: order.customerName || "Kunde nicht zugeordnet",
      stationName: order.station,
      promisedDueDate: order.promisedDueDate?.toISOString() || null,
      completedDate: null,
      delayDays: order.promisedDueDate ? Math.max(1, Math.floor((now.getTime() - order.promisedDueDate.getTime()) / DAY_MS)) : null,
      status: "critical" as const,
      priority: order.priority,
      openUrl: `/orders/${encodeURIComponent(order.id)}?returnTo=${encodeURIComponent(returnTo)}`,
    })),
    ...missingDueOrders.slice(0, Math.max(0, 10 - delayedOrders.length)).map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      title: order.title,
      customerId: order.customerId,
      customerName: order.customerName || "Kunde nicht zugeordnet",
      stationName: order.station,
      promisedDueDate: null,
      completedDate: null,
      delayDays: null,
      status: "missing_due_date" as const,
      priority: order.priority,
      openUrl: `/orders/${encodeURIComponent(order.id)}?returnTo=${encodeURIComponent(returnTo)}`,
    })),
  ];

  const linkedEntities: AnalyseEntityLink[] = mappedAffectedOrders.map((order) => ({
    id: order.orderId,
    label: `${order.orderNumber} · ${order.title}`,
    type: "order",
    href: order.openUrl,
    overlay: "order",
    returnTo,
  }));

  const summary: AnalyseTileSummary = {
    key: "werkstatt_puls",
    title: "Werkstatt-Puls",
    subtitle: "Termintreue & Durchlaufzeit",
    status,
    primaryLabel: "Termintreue",
    primaryValue: termintreuePct === null ? null : `${termintreuePct.toLocaleString("de-DE")}%`,
    secondaryLabel: "Ø Durchlaufzeit",
    secondaryValue: averageCycleDays === null ? null : `${averageCycleDays.toLocaleString("de-DE")} Tage`,
    tertiaryLabel: "Fertig im Zeitraum",
    tertiaryValue: completedCount.toLocaleString("de-DE"),
    periodLabel: period.label,
    scoreRing: termintreuePct ?? undefined,
    progressBars: stationRows.slice(0, 4).map((row) => ({
      label: row.station,
      value: Number(row.count),
      fillRatio: maxStationCount > 0 ? Number(row.count) / maxStationCount * 100 : 0,
      colorClass: "bg-blue-500",
    })),
    dataSources: [{
      tableOrView: "orders",
      fields: ["tenant_id", "completed_date", "promised_due_date", "intake_date", "current_station_id"],
      calculation: "Mandantengefilterte Aufträge; Zeitraum ist halboffen [Start, Ende).",
    }],
    linkedEntities,
    emptyState: !hasData ? {
      title: "Keine auswertbaren Aufträge",
      description: "Im gewählten Zeitraum liegen keine abgeschlossenen Aufträge und aktuell keine offenen Aufträge vor.",
      targetLabel: "Warendurchlauf öffnen",
      targetHref: "/warendurchlauf",
    } : undefined,
  };

  const detail: WerkstattPulsData = {
    period: period.key,
    dataStatus: {
      isLive: false,
      lastUpdatedAt: calculatedAt.toISOString(),
      maturity: "S1",
      warnings: [
        "Die Kennzahlen stammen aus einem konsistenten Datenbank-Snapshot, nicht aus einem Live-Stream.",
        ...(dueDateMeasurable === 0 ? ["Für abgeschlossene Aufträge fehlen im Zeitraum messbare Zusagetermine."] : []),
        ...(cycleMeasurable === 0 ? ["Für abgeschlossene Aufträge fehlen im Zeitraum messbare Eingangszeiten."] : []),
        "Stationswerte zeigen Bestände, keine Kapazitätsauslastung oder Wartezeit.",
      ],
    },
    hero: {
      termintreuePct,
      termintreueMessbarN: dueDateMeasurable,
      ohneZusageterminN: withoutDueDate,
      avgDurchlaufzeitTage: averageCycleDays,
      avgDurchlaufzeitMessbarN: cycleMeasurable,
      wochenzielIst: completedCount,
      wochenzielSoll: null,
      wochenzielQuelle: "missing",
      offeneAuftraegeN: openCount,
      kritischeAuftraegeN: overdueCount,
      dokumentationsquotePct: null,
      dokumentationsquoteMessbarN: 0,
      werkstattScore: null,
      scoreStatus: "insufficient_data",
    },
    trend: {
      termintreue: [],
      avgDurchlaufzeit: [],
      comparison: { mode: "previous_period", available: false, reasonIfMissing: "Historische Vergleichsreihen sind noch nicht instrumentiert." },
    },
    stations: stationRows.map((row) => ({
      stationId: row.station,
      stationName: row.station,
      status: "unavailable",
      auslastungPct: null,
      wartendN: Number(row.count),
      avgWartezeitTage: null,
      engpassScore: null,
      hauptursache: null,
      openUrl: `/orders?station=${encodeURIComponent(row.station)}&returnTo=${encodeURIComponent(returnTo)}`,
    })),
    affectedOrders: mappedAffectedOrders,
    economics: {
      engpassRevenueEur: null,
      engpassDbEur: null,
      actualDelayCostEur: null,
      modelDelayRiskEur: null,
      confidence: "none",
      missingReasons: ["Auftragsumsatz und bestätigte Verzögerungskosten sind nicht vollständig verknüpft."],
      affectedOrderCount: overdueCount,
    },
    insight: {
      available: overdueCount > 0,
      source: overdueCount > 0 ? "rules" : "none",
      observation: overdueCount > 0 ? `${overdueCount} offene Aufträge liegen hinter ihrem gespeicherten Zusagetermin.` : null,
      recommendation: overdueCount > 0 ? "Betroffene Aufträge und gespeicherte Verzögerungsgründe prüfen." : null,
      actionLinks: overdueCount > 0 ? [{ label: "Auftragsbuch öffnen", href: "/orders" }] : [],
    },
    connectedLinks: [
      { label: "Bäder & Material", value: "Bäder öffnen", href: "/baeder", enabled: true },
      { label: "Qualitätskontrolle", value: "Kontrolle öffnen", href: "/kontrolle", enabled: true },
      { label: "Warendurchlauf", value: "Stationen öffnen", href: "/warendurchlauf", enabled: true },
    ],
    dataSources: [
      { label: "Aufträge im Zeitraum", sourceName: "orders", recordCount: completedCount, status: completedCount > 0 ? "live" : "empty" },
      { label: "Offene Aufträge", sourceName: "orders", recordCount: openCount, status: openCount > 0 ? "live" : "empty" },
      { label: "Verlauf", sourceName: "nicht_instrumentiert", recordCount: null, status: "missing" },
      { label: "Wirtschaftlichkeit", sourceName: "nicht_instrumentiert", recordCount: null, status: "missing" },
    ],
  };

  const evidence = buildWorkshopEvidence({
    tenantId: actor.tenantId,
    period: {
      start: period.start,
      end: period.end,
      grain: period.key === "today" ? "day" : period.key,
    },
    calculatedAt,
    now,
    returnTo,
    rows: evidenceRows.slice(0, 500) as WorkshopEvidenceOrder[],
    totals: {
      completed: completedCount,
      completedWithDueDate: dueDateMeasurable,
      deliveredOnTime,
      completedWithCycleTime: cycleMeasurable,
      averageCycleDays,
      deliveryReliabilityPct: termintreuePct,
      open: openCount,
      overdue: overdueCount,
      openWithoutDueDate: withoutDueDate,
    },
    stations: stationRows.map((row) => ({ station: row.station, count: Number(row.count) })),
  });

  return { period, summary, detail, evidence };
}

export async function getAnalyseOverview(period: string): Promise<{ data: AnalyseTileSummary[]; error?: { code: string; message: string } }> {
  const actor = await requireAnalyseRead();
  try {
    const workshop = await loadWorkshopSnapshot(actor, period);
    return { data: [workshop.summary, ...unavailableTiles(workshop.period.label)] };
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_ANALYSE_PERIOD") {
      return { data: [], error: { code: "INVALID_PERIOD", message: "Der gewählte Analysezeitraum wird nicht unterstützt." } };
    }
    return { data: [], error: { code: "ANALYSE_UNAVAILABLE", message: "Analysedaten konnten nicht geladen werden." } };
  }
}

export async function getAnalyseTileDetail(tileKey: AnalyseTileKey, period: string): Promise<{ data: AnalyseTileDetail | null; error?: { code: string; message: string } }> {
  const actor = await requireAnalyseRead();
  try {
    const workshop = await loadWorkshopSnapshot(actor, period);
    const summary = tileKey === "werkstatt_puls"
      ? workshop.summary
      : unavailableTiles(workshop.period.label).find((tile) => tile.key === tileKey);
    if (!summary) return { data: null, error: { code: "UNKNOWN_TILE", message: "Diese Analyseansicht ist nicht verfügbar." } };

    return {
      data: {
        summary,
        evidence: tileKey === "werkstatt_puls"
          ? workshop.evidence
          : [buildUnavailableAnalysisEvidence({
              tileKey,
              label: summary.title,
              description: summary.emptyState?.description ?? "Der belegbare Fachdatenpfad ist noch nicht aktiv.",
              tenantId: actor.tenantId,
              period: {
                start: workshop.period.start,
                end: workshop.period.end,
                grain: workshop.period.key === "today" ? "day" : workshop.period.key,
              },
              calculatedAt: new Date(),
            })],
        charts: tileKey === "werkstatt_puls" ? [] : [{ id: "empty", title: "Historie", type: "line", dataset: [], emptyState: summary.emptyState }],
        rankings: [],
        affectedEntities: summary.linkedEntities,
        measures: [],
        dataSources: summary.dataSources,
        ...(tileKey === "werkstatt_puls" ? { werkstattPulsData: workshop.detail } : {}),
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_ANALYSE_PERIOD") {
      return { data: null, error: { code: "INVALID_PERIOD", message: "Der gewählte Analysezeitraum wird nicht unterstützt." } };
    }
    return { data: null, error: { code: "ANALYSE_UNAVAILABLE", message: "Analysedaten konnten nicht geladen werden." } };
  }
}

export async function getAnalyseLinkedEntities(tileKey: AnalyseTileKey, period = "Monat"): Promise<{ data: AnalyseEntityLink[]; error?: { code: string; message: string } }> {
  const actor = await requireAnalyseRead();
  try {
    if (tileKey !== "werkstatt_puls") return { data: [] };
    const workshop = await loadWorkshopSnapshot(actor, period);
    return { data: workshop.summary.linkedEntities };
  } catch {
    return { data: [], error: { code: "ANALYSE_UNAVAILABLE", message: "Verknüpfte Datensätze konnten nicht geladen werden." } };
  }
}
