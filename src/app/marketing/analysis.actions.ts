'use server'

import { db } from '@/db'
import { aktion, attribution, kanal, touchpoint } from '@/db/schema_marketing'
import { and, gte, lte } from 'drizzle-orm'
import { assertFinanceDateRange } from '@/lib/server/financeAuthorization'
import { requireMarketingRead } from '@/lib/server/marketingAuthorization'

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

async function loadPeriodFacts(von: string, bis: string) {
  const bounds = periodBounds(von, bis)
  const [periodTouchpoints, allAttributions, periodActions, channels] = await Promise.all([
    db.select().from(touchpoint).where(and(
      gte(touchpoint.ausgefuehrtAm, bounds.from),
      lte(touchpoint.ausgefuehrtAm, bounds.to)
    )),
    db.select().from(attribution),
    db.select().from(aktion).where(and(
      gte(aktion.ausgefuehrtAm, bounds.from),
      lte(aktion.ausgefuehrtAm, bounds.to)
    )),
    db.select().from(kanal),
  ])
  const touchpointIds = new Set(periodTouchpoints.map((entry) => entry.id))
  const linkedAttributions = allAttributions.filter((entry) => entry.touchpointId && touchpointIds.has(entry.touchpointId))
  return {
    touchpoints: periodTouchpoints,
    attributions: linkedAttributions,
    actions: periodActions,
    channelById: new Map(channels.map((entry) => [entry.id, entry.name])),
    touchpointById: new Map(periodTouchpoints.map((entry) => [entry.id, entry])),
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
  await requireMarketingRead()
  assertFinanceDateRange(von, bis)
  const facts = await loadPeriodFacts(von, bis)
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
  await requireMarketingRead()
  assertFinanceDateRange(von, bis)
  const facts = await loadPeriodFacts(von, bis)
  const revenue = facts.attributions.reduce((sum, entry) => sum + (Number(entry.umsatz) || 0), 0)
  const byMonth = new Map<string, number>()
  const topOrders = facts.attributions.flatMap((entry) => {
    if (!entry.touchpointId) return []
    const touch = facts.touchpointById.get(entry.touchpointId)
    if (!touch) return []
    const month = monthKey(touch.ausgefuehrtAm)
    byMonth.set(month, (byMonth.get(month) || 0) + (Number(entry.umsatz) || 0))
    return entry.auftragId ? [{
      auftragId: entry.auftragId,
      umsatz: Number(entry.umsatz) || 0,
      kanal: touch.kanalId ? facts.channelById.get(touch.kanalId) || 'Unbekannt' : 'Unbekannt',
    }] : []
  }).sort((a, b) => b.umsatz - a.umsatz)

  return {
    gesamt: revenue,
    chartData: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, ist]) => ({ name, ist })),
    insights: evidenceInsight(`${revenue.toLocaleString('de-DE')} € explizit attribuierter Umsatz im Zeitraum.`, false),
    topAuftraege: topOrders.slice(0, 5),
    evidence: {
      attributedOrders: new Set(topOrders.map((entry) => entry.auftragId)).size,
      attributionRows: facts.attributions.length,
      source: 'marketing.attribution.umsatz',
    },
  }
}

export async function getMarketingRoiAnalysisAction(von: string, bis: string) {
  await requireMarketingRead()
  assertFinanceDateRange(von, bis)
  const facts = await loadPeriodFacts(von, bis)
  const revenue = facts.attributions.reduce((sum, entry) => sum + (Number(entry.umsatz) || 0), 0)
  const plannedBudget = facts.actions.reduce((sum, entry) => sum + (Number(entry.kostenBudget) || 0), 0)

  return {
    gesamt: null,
    revenue,
    cost: null,
    plannedBudget,
    actions: facts.actions.length,
    chartData: [],
    insights: evidenceInsight(
      'ROI ist nicht berechenbar: kosten_budget ist ein Planwert; tatsächliche Marketingausgaben sind noch nicht mit dem Kostenledger verknüpft.',
      false
    ),
    evidence: {
      attributionRows: facts.attributions.length,
      budgetedActions: facts.actions.filter((entry) => Number(entry.kostenBudget) > 0).length,
      source: 'marketing.attribution.umsatz + marketing.aktion.kosten_budget (Planwert)',
    },
  }
}
