'use server'

import { db } from '@/db'
import { aktion, attribution, kanal, touchpoint } from '@/db/schema_marketing'
import { and, eq } from 'drizzle-orm'
import { requireMarketingRead } from '@/lib/server/marketingAuthorization'
import {
  summarizeMarketingIdentifiers,
  summarizeMarketingMeasurements,
} from '@/lib/marketing/measurementTruth'
import type { MarketingMetricCoverage, MarketingMetricState } from '@/lib/marketing/marketingTypes'

type ActionRow = typeof aktion.$inferSelect
type AttributionRow = typeof attribution.$inferSelect
type TouchpointRow = typeof touchpoint.$inferSelect

export type ChannelAttribution = {
  kanal: string
  plannedBudget: number | null
  budgetState: MarketingMetricState
  actualSpend: number | null
  leads: number | null
  leadState: MarketingMetricState
  auftraege: number | null
  orderState: MarketingMetricState
  umsatz: number | null
  revenueState: MarketingMetricState
  roi: number | null
  evidence: {
    touchpoints: number
    attributionRows: number
    leadCoverage: MarketingMetricCoverage
    orderCoverage: MarketingMetricCoverage
    revenueCoverage: MarketingMetricCoverage
    budgetCoverage: MarketingMetricCoverage
  }
}

export type AttributionSnapshot = {
  state: 'ready' | 'confirmed_empty'
  channels: ChannelAttribution[]
  totals: {
    leads: number | null
    leadState: MarketingMetricState
    auftraege: number | null
    orderState: MarketingMetricState
    umsatz: number | null
    revenueState: MarketingMetricState
    plannedBudget: number | null
    budgetState: MarketingMetricState
    leadCoverage: MarketingMetricCoverage
    orderCoverage: MarketingMetricCoverage
    revenueCoverage: MarketingMetricCoverage
    budgetCoverage: MarketingMetricCoverage
  }
}

function summarizeBudgets(
  actionIds: Set<string>,
  actionsById: Map<string, ActionRow>
) {
  return summarizeMarketingMeasurements([...actionIds].flatMap((actionId) => {
    const source = actionsById.get(actionId)
    return source ? [{
      value: source.kostenBudget,
      status: source.budgetStatus,
      measuredAt: source.budgetMeasuredAt,
    }] : []
  }))
}

function buildChannelAttribution(
  name: string,
  channelTouchpoints: TouchpointRow[],
  channelAttributions: AttributionRow[],
  actionsById: Map<string, ActionRow>
): ChannelAttribution {
  const actionIds = new Set(
    channelTouchpoints.flatMap((entry) => entry.aktionId ? [entry.aktionId] : [])
  )
  const budget = summarizeBudgets(actionIds, actionsById)
  const leads = summarizeMarketingIdentifiers(channelAttributions.map((entry) => entry.leadId))
  const orders = summarizeMarketingIdentifiers(channelAttributions.map((entry) => entry.auftragId))
  const revenue = summarizeMarketingMeasurements(channelAttributions.map((entry) => ({
    value: entry.umsatz,
    status: entry.revenueStatus,
    measuredAt: entry.revenueMeasuredAt,
  })))

  return {
    kanal: name,
    plannedBudget: budget.value,
    budgetState: budget.dataState,
    actualSpend: null,
    leads: leads.value,
    leadState: leads.dataState,
    auftraege: orders.value,
    orderState: orders.dataState,
    umsatz: revenue.value,
    revenueState: revenue.dataState,
    roi: null,
    evidence: {
      touchpoints: channelTouchpoints.length,
      attributionRows: channelAttributions.length,
      leadCoverage: leads.coverage,
      orderCoverage: orders.coverage,
      revenueCoverage: revenue.coverage,
      budgetCoverage: budget.coverage,
    },
  }
}

export async function getAttributionData(): Promise<AttributionSnapshot> {
  const actor = await requireMarketingRead()
  const [channels, actions, touchpoints, attributions] = await Promise.all([
    db.select().from(kanal).where(and(
      eq(kanal.tenantId, actor.tenantId),
      eq(kanal.truthStatus, 'verified')
    )),
    db.select().from(aktion).where(and(
      eq(aktion.tenantId, actor.tenantId),
      eq(aktion.truthStatus, 'verified'),
      eq(aktion.isDemo, false)
    )),
    db.select().from(touchpoint).where(eq(touchpoint.tenantId, actor.tenantId)),
    db.select().from(attribution).where(eq(attribution.tenantId, actor.tenantId)),
  ])

  const verifiedChannelIds = new Set(channels.map((entry) => entry.id))
  const actionsById = new Map(actions.map((entry) => [entry.id, entry]))
  const verifiedActionIds = new Set(actionsById.keys())
  const eligibleTouchpoints = touchpoints.filter((entry) =>
    (!entry.kanalId || verifiedChannelIds.has(entry.kanalId))
    && (!entry.aktionId || verifiedActionIds.has(entry.aktionId))
  )
  const eligibleTouchpointIds = new Set(eligibleTouchpoints.map((entry) => entry.id))
  const eligibleAttributions = attributions.filter((entry) =>
    Boolean(entry.touchpointId && eligibleTouchpointIds.has(entry.touchpointId))
  )

  const channelRows = channels.map((channel) => {
    const channelTouchpoints = eligibleTouchpoints.filter((entry) => entry.kanalId === channel.id)
    const touchpointIds = new Set(channelTouchpoints.map((entry) => entry.id))
    const channelAttributions = eligibleAttributions.filter((entry) =>
      Boolean(entry.touchpointId && touchpointIds.has(entry.touchpointId))
    )
    return buildChannelAttribution(channel.name, channelTouchpoints, channelAttributions, actionsById)
  })

  const unassignedTouchpoints = eligibleTouchpoints.filter((entry) => entry.kanalId === null)
  if (unassignedTouchpoints.length > 0) {
    const touchpointIds = new Set(unassignedTouchpoints.map((entry) => entry.id))
    const unassignedAttributions = eligibleAttributions.filter((entry) =>
      Boolean(entry.touchpointId && touchpointIds.has(entry.touchpointId))
    )
    channelRows.push(buildChannelAttribution(
      'Nicht zugeordnet',
      unassignedTouchpoints,
      unassignedAttributions,
      actionsById
    ))
  }

  const globalActionIds = new Set(
    eligibleTouchpoints.flatMap((entry) => entry.aktionId ? [entry.aktionId] : [])
  )
  const totalBudget = summarizeBudgets(globalActionIds, actionsById)
  const totalLeads = summarizeMarketingIdentifiers(eligibleAttributions.map((entry) => entry.leadId))
  const totalOrders = summarizeMarketingIdentifiers(eligibleAttributions.map((entry) => entry.auftragId))
  const totalRevenue = summarizeMarketingMeasurements(eligibleAttributions.map((entry) => ({
    value: entry.umsatz,
    status: entry.revenueStatus,
    measuredAt: entry.revenueMeasuredAt,
  })))

  return {
    state: channelRows.length === 0
      && eligibleTouchpoints.length === 0
      && eligibleAttributions.length === 0
      ? 'confirmed_empty'
      : 'ready',
    channels: channelRows,
    totals: {
      leads: totalLeads.value,
      leadState: totalLeads.dataState,
      auftraege: totalOrders.value,
      orderState: totalOrders.dataState,
      umsatz: totalRevenue.value,
      revenueState: totalRevenue.dataState,
      plannedBudget: totalBudget.value,
      budgetState: totalBudget.dataState,
      leadCoverage: totalLeads.coverage,
      orderCoverage: totalOrders.coverage,
      revenueCoverage: totalRevenue.coverage,
      budgetCoverage: totalBudget.coverage,
    },
  }
}
