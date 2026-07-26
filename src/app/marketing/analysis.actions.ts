'use server'

import { db } from '@/db'
import { aktion, attribution, kanal, touchpoint } from '@/db/schema_marketing'
import { and, eq, gte, lte } from 'drizzle-orm'
import { assertFinanceDateRange } from '@/lib/server/financeAuthorization'
import { requireMarketingRead } from '@/lib/server/marketingAuthorization'
import {
  measuredMarketingNumber,
  summarizeMarketingMeasurements,
} from '@/lib/marketing/measurementTruth'

type Insight = {
  beobachtungen: string[]
  vermutungen: string[]
  vorschlaege: { label: string; href: string }[]
}

function periodBounds(von: string, bis: string): { from: Date; to: Date } {
  return {
    from: new Date(`${von}T00:00:00.000Z`),
    to: new Date(`${bis}T23:59:59.999Z`),
  }
}

function monthKey(value: Date): string {
  return value.toISOString().substring(0, 7)
}

async function loadPeriodFacts(tenantId: string, von: string, bis: string) {
  const bounds = periodBounds(von, bis)
  const [periodTouchpoints, allAttributions, periodActions, channels] = await Promise.all([
    db.select().from(touchpoint).where(and(
      eq(touchpoint.tenantId, tenantId),
      gte(touchpoint.ausgefuehrtAm, bounds.from),
      lte(touchpoint.ausgefuehrtAm, bounds.to)
    )),
    db.select().from(attribution).where(eq(attribution.tenantId, tenantId)),
    db.select().from(aktion).where(and(
      eq(aktion.tenantId, tenantId),
      eq(aktion.truthStatus, 'verified'),
      eq(aktion.isDemo, false),
      gte(aktion.ausgefuehrtAm, bounds.from),
      lte(aktion.ausgefuehrtAm, bounds.to)
    )),
    db.select().from(kanal).where(and(
      eq(kanal.tenantId, tenantId),
      eq(kanal.truthStatus, 'verified')
    )),
  ])
  const verifiedActionIds = new Set(periodActions.map((entry) => entry.id))
  const verifiedChannelIds = new Set(channels.map((entry) => entry.id))
  const eligibleTouchpoints = periodTouchpoints.filter((entry) =>
    (!entry.aktionId || verifiedActionIds.has(entry.aktionId))
    && (!entry.kanalId || verifiedChannelIds.has(entry.kanalId))
  )
  const touchpointIds = new Set(eligibleTouchpoints.map((entry) => entry.id))
  const linkedAttributions = allAttributions.filter((entry) =>
    Boolean(entry.touchpointId && touchpointIds.has(entry.touchpointId))
  )
  return {
    touchpoints: eligibleTouchpoints,
    attributions: linkedAttributions,
    actions: periodActions,
    channelById: new Map(channels.map((entry) => [entry.id, entry.name])),
    touchpointById: new Map(eligibleTouchpoints.map((entry) => [entry.id, entry])),
  }
}

function evidenceInsight(observation: string, missingAttribution: boolean): Insight {
  return {
    beobachtungen: [observation],
    vermutungen: [],
    vorschlaege: missingAttribution
      ? [{ label: 'Attribution vervollständigen', href: '/marketing/attribution' }]
      : [],
  }
}

export async function getMarketingAnfragenAnalysisAction(von: string, bis: string) {
  const actor = await requireMarketingRead()
  assertFinanceDateRange(von, bis)
  const facts = await loadPeriodFacts(actor.tenantId, von, bis)
  const leadIds = new Set(facts.attributions.flatMap((entry) => entry.leadId ? [entry.leadId] : []))
  const byChannel = new Map<string, Set<string>>()
  const byMonth = new Map<string, Set<string>>()
  for (const entry of facts.attributions) {
    if (!entry.leadId || !entry.touchpointId) continue
    const touch = facts.touchpointById.get(entry.touchpointId)
    if (!touch) continue
    const channel = touch.kanalId ? facts.channelById.get(touch.kanalId) || 'Unbekannt' : 'Unbekannt'
    const channelLeads = byChannel.get(channel) || new Set<string>()
    channelLeads.add(entry.leadId)
    byChannel.set(channel, channelLeads)
    const month = monthKey(touch.ausgefuehrtAm)
    const monthLeads = byMonth.get(month) || new Set<string>()
    monthLeads.add(entry.leadId)
    byMonth.set(month, monthLeads)
  }
  const missingAttribution = facts.touchpoints.length > 0 && facts.attributions.length === 0

  return {
    gesamt: leadIds.size,
    chartData: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, ids]) => ({ name, ist: ids.size })),
    topKategorien: [...byChannel.entries()]
      .map(([name, ids]) => ({ name, amount: ids.size }))
      .sort((a, b) => b.amount - a.amount),
    insights: evidenceInsight(`${leadIds.size} eindeutig zugeordnete Marketing-Anfragen im Zeitraum.`, missingAttribution),
    topAnfragen: facts.attributions.filter((entry) => entry.leadId).slice(0, 5),
    evidence: {
      touchpoints: facts.touchpoints.length,
      attributionRows: facts.attributions.length,
      source: 'marketing.attribution.lead_id',
    },
  }
}

export async function getMarketingUmsatzAnalysisAction(von: string, bis: string) {
  const actor = await requireMarketingRead()
  assertFinanceDateRange(von, bis)
  const facts = await loadPeriodFacts(actor.tenantId, von, bis)
  const revenueSummary = summarizeMarketingMeasurements(facts.attributions.map((entry) => ({
    value: entry.umsatz,
    status: entry.revenueStatus,
    measuredAt: entry.revenueMeasuredAt,
  })))
  const revenueRows = facts.attributions.flatMap((entry) => {
    const value = measuredMarketingNumber({
      value: entry.umsatz,
      status: entry.revenueStatus,
      measuredAt: entry.revenueMeasuredAt,
    })
    return value === null ? [] : [{ entry, value }]
  })
  const byMonth = new Map<string, number>()
  const topOrders = revenueRows.flatMap(({ entry, value }) => {
    if (!entry.touchpointId) return []
    const touch = facts.touchpointById.get(entry.touchpointId)
    if (!touch) return []
    const month = monthKey(touch.ausgefuehrtAm)
    byMonth.set(month, (byMonth.get(month) || 0) + value)
    return entry.auftragId ? [{
      auftragId: entry.auftragId,
      umsatz: value,
      kanal: touch.kanalId ? facts.channelById.get(touch.kanalId) || 'Unbekannt' : 'Unbekannt',
    }] : []
  }).sort((a, b) => b.umsatz - a.umsatz)

  return {
    gesamt: revenueSummary.value,
    chartData: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, ist]) => ({ name, ist })),
    insights: evidenceInsight(
      revenueSummary.dataState === 'confirmed_empty'
        ? 'Keine Attributionszeile im Zeitraum; explizit zugeordneter Umsatz ist 0 €.'
        : revenueSummary.value === null
          ? 'Attributionszeilen sind vorhanden, aber Umsatz wurde nicht gemessen.'
          : revenueSummary.dataState === 'partial'
            ? `${revenueSummary.value.toLocaleString('de-DE')} € bekannter Teilbetrag; ${revenueSummary.coverage.measuredCount}/${revenueSummary.coverage.sourceCount} Zuordnungen sind belegt.`
            : `${revenueSummary.value.toLocaleString('de-DE')} € explizit attribuierter Umsatz im Zeitraum.`,
      false
    ),
    topAuftraege: topOrders.slice(0, 5),
    evidence: {
      attributedOrders: new Set(topOrders.map((entry) => entry.auftragId)).size,
      attributionRows: facts.attributions.length,
      revenueEvidenceRows: revenueRows.length,
      revenueState: revenueSummary.dataState,
      revenueCoverage: revenueSummary.coverage,
      source: 'marketing.attribution.umsatz',
    },
  }
}

export async function getMarketingRoiAnalysisAction(von: string, bis: string) {
  const actor = await requireMarketingRead()
  assertFinanceDateRange(von, bis)
  const facts = await loadPeriodFacts(actor.tenantId, von, bis)
  const revenueSummary = summarizeMarketingMeasurements(facts.attributions.map((entry) => ({
    value: entry.umsatz,
    status: entry.revenueStatus,
    measuredAt: entry.revenueMeasuredAt,
  })))
  const budgetSummary = summarizeMarketingMeasurements(facts.actions.map((entry) => ({
    value: entry.kostenBudget,
    status: entry.budgetStatus,
    measuredAt: entry.budgetMeasuredAt,
  })))

  return {
    gesamt: null,
    revenue: revenueSummary.value,
    cost: null,
    plannedBudget: budgetSummary.value,
    actions: facts.actions.length,
    chartData: [],
    insights: evidenceInsight(
      'ROI ist nicht berechenbar: kosten_budget ist ein Planwert; tatsächliche Marketingausgaben sind noch nicht mit dem Kostenledger verknüpft.',
      false
    ),
    evidence: {
      attributionRows: facts.attributions.length,
      budgetedActions: budgetSummary.coverage.measuredCount,
      budgetState: budgetSummary.dataState,
      budgetCoverage: budgetSummary.coverage,
      revenueEvidenceRows: revenueSummary.coverage.measuredCount,
      revenueState: revenueSummary.dataState,
      revenueCoverage: revenueSummary.coverage,
      source: 'marketing.attribution.umsatz + marketing.aktion.kosten_budget (Planwert)',
    },
  }
}
