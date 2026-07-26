'use server'

import { db } from '@/db'
import {
  aktion,
  attribution,
  kampagne,
  kanal,
  lernMetrik,
  segment,
  touchpoint,
} from '@/db/schema_marketing'
import { and, desc, eq } from 'drizzle-orm'
import { requireMarketingRead } from '@/lib/server/marketingAuthorization'
import type {
  AktionVorschlag,
  FunnelDaten,
  Kampagne as MarketingCampaign,
  KanalId,
  LernInsight,
  Segment as MarketingSegment,
  SortMode,
  StoryIdee,
  WirkungMini,
} from '@/lib/marketing/marketingTypes'
import {
  exactMarketingCount,
  summarizeMarketingIdentifiers,
  summarizeMarketingMeasurements,
} from '@/lib/marketing/measurementTruth'

type JsonObject = Record<string, unknown>

function objectValue(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function channelId(value: string | null): KanalId {
  const normalized = (value || '').trim().toLowerCase()
  return normalized === 'instagram' || normalized === 'email' || normalized === 'google' || normalized === 'web'
    ? normalized
    : 'unknown'
}

function campaignStatus(value: string): MarketingCampaign['status'] {
  if (value === 'aktiv' || value === 'abgeschlossen') return value
  return 'geplant'
}

function campaignProgress(
  from: string | null,
  to: string | null,
  executed: number,
  total: number
): number {
  if (from && to) {
    const start = Date.parse(`${from}T00:00:00Z`)
    const end = Date.parse(`${to}T23:59:59Z`)
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return Math.max(0, Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100)))
    }
  }
  return total > 0 ? Math.round((executed / total) * 100) : 0
}

async function loadSuggestions(tenantId: string): Promise<AktionVorschlag[]> {
  const rows = await db.select({
    id: aktion.id,
    status: aktion.status,
    titel: aktion.titel,
    typ: aktion.typ,
    inhalt: aktion.inhalt,
    score: aktion.score,
    erwarteterOutput: aktion.erwarteterOutput,
    aufwandMin: aktion.aufwandMin,
    kostenBudget: aktion.kostenBudget,
    budgetStatus: aktion.budgetStatus,
    budgetMeasuredAt: aktion.budgetMeasuredAt,
    kanalTyp: kanal.typ,
    kanalName: kanal.name,
    segmentName: segment.name,
  })
    .from(aktion)
    .leftJoin(kanal, and(
      eq(aktion.kanalId, kanal.id),
      eq(kanal.tenantId, tenantId),
      eq(kanal.truthStatus, 'verified')
    ))
    .leftJoin(segment, and(
      eq(aktion.segmentId, segment.id),
      eq(segment.tenantId, tenantId),
      eq(segment.truthStatus, 'verified')
    ))
    .where(and(
      eq(aktion.tenantId, tenantId),
      eq(aktion.truthStatus, 'verified'),
      eq(aktion.isDemo, false),
      eq(aktion.status, 'vorschlag')
    ))

  return rows.map((row) => {
    const content = objectValue(row.inhalt)
    const caption = textValue(content.caption) || textValue(content.text)
    const hashtags = Array.isArray(content.hashtags)
      ? content.hashtags.filter((value): value is string => typeof value === 'string').join(' ')
      : textValue(content.hashtags)
    const rawScore = row.score === null ? null : Number(row.score)
    const score = rawScore !== null && Number.isFinite(rawScore) && rawScore > 0 ? rawScore : null
    const variants = Array.isArray(content.varianten)
      ? content.varianten.flatMap((value) => {
          const variant = objectValue(value)
          const title = textValue(variant.titel)
          return title ? [{ titel: title, caption: textValue(variant.caption), hashtags: textValue(variant.hashtags) }] : []
        })
      : []
    const mappedChannel = channelId(row.kanalTyp)

    return {
      id: row.id,
      titel: row.titel,
      kanal: mappedChannel,
      kanalLabel: row.kanalName || mappedChannel,
      score,
      caption,
      hashtags,
      begruendung: score !== null
        ? `Gespeicherter Prioritätsscore: ${score.toLocaleString('de-DE')}`
        : 'Noch keine belastbare Wirkungsbewertung.',
      erwarteterOutput: row.erwarteterOutput === null ? 'nicht gemessen' : String(Number(row.erwarteterOutput)),
      aufwand: row.aufwandMin && row.aufwandMin > 0 ? `${row.aufwandMin} Min` : 'nicht erfasst',
      kosten: row.budgetStatus === 'measured'
        && row.budgetMeasuredAt !== null
        && row.kostenBudget !== null
        ? `${Number(row.kostenBudget).toLocaleString('de-DE')} € Planbudget`
        : 'nicht erfasst',
      varianten: variants.length > 0 ? variants : [{ titel: row.titel, caption, hashtags }],
      segment: row.segmentName || undefined,
      assetId: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(textValue(content.assetId))
        ? textValue(content.assetId)
        : undefined,
      status: row.status as AktionVorschlag['status'],
      publishCapability: 'proposal_only' as const,
      publishReason: 'Veröffentlichung ist gesperrt, bis Freigabe, Marketing-Asset, Connector und Provider-Beleg vollständig angebunden sind.',
    }
  })
}

export async function getBesteAktionAction(): Promise<AktionVorschlag | null> {
  const actor = await requireMarketingRead()
  const suggestions = await loadSuggestions(actor.tenantId)
  return suggestions
    .filter((suggestion) => suggestion.score !== null)
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))[0] || null
}

export async function listVorschlaegeAction(sort: SortMode = 'output'): Promise<AktionVorschlag[]> {
  const actor = await requireMarketingRead()
  const suggestions = await loadSuggestions(actor.tenantId)
  return suggestions.sort((a, b) => {
    if (sort === 'einfach') {
      const aEffort = Number.parseInt(a.aufwand)
      const bEffort = Number.parseInt(b.aufwand)
      return (Number.isFinite(aEffort) ? aEffort : Number.MAX_SAFE_INTEGER)
        - (Number.isFinite(bEffort) ? bEffort : Number.MAX_SAFE_INTEGER)
    }
    if (sort === 'kanal') return a.kanal.localeCompare(b.kanal)
    return (b.score ?? -1) - (a.score ?? -1)
  })
}

export async function getKampagnenAction(): Promise<MarketingCampaign[]> {
  const actor = await requireMarketingRead()
  const [campaigns, actions, channels, touchpoints, attributions] = await Promise.all([
    db.select().from(kampagne).where(and(
      eq(kampagne.tenantId, actor.tenantId),
      eq(kampagne.truthStatus, 'verified'),
      eq(kampagne.isDemo, false)
    )).orderBy(desc(kampagne.erstelltAm)),
    db.select().from(aktion).where(and(
      eq(aktion.tenantId, actor.tenantId),
      eq(aktion.truthStatus, 'verified'),
      eq(aktion.isDemo, false)
    )),
    db.select().from(kanal).where(and(
      eq(kanal.tenantId, actor.tenantId),
      eq(kanal.truthStatus, 'verified')
    )),
    db.select().from(touchpoint).where(eq(touchpoint.tenantId, actor.tenantId)),
    db.select().from(attribution).where(eq(attribution.tenantId, actor.tenantId)),
  ])
  const channelById = new Map(channels.map((entry) => [entry.id, entry.name]))
  const touchpointById = new Map(touchpoints.map((entry) => [entry.id, entry]))

  return campaigns.map((campaign) => {
    const campaignActions = actions.filter((entry) => entry.kampagneId === campaign.id)
    const actionIds = new Set(campaignActions.map((entry) => entry.id))
    const campaignAttributions = attributions.filter((entry) => {
      const touch = entry.touchpointId ? touchpointById.get(entry.touchpointId) : undefined
      return Boolean(touch?.aktionId && actionIds.has(touch.aktionId))
    })
    const revenue = summarizeMarketingMeasurements(campaignAttributions.map((entry) => ({
      value: entry.umsatz,
      status: entry.revenueStatus,
      measuredAt: entry.revenueMeasuredAt,
    })))
    const channelNames = [...new Set(campaignActions.flatMap((entry) =>
      entry.kanalId && channelById.get(entry.kanalId) ? [channelById.get(entry.kanalId)!] : []
    ))]
    const status = campaignStatus(campaign.status)
    return {
      id: campaign.id,
      titel: campaign.name,
      kanal: channelNames.length > 0 ? channelNames.join(', ') : 'nicht zugeordnet',
      status,
      statusLabel: status === 'aktiv' ? 'läuft' : status === 'abgeschlossen' ? 'abgeschlossen' : 'geplant',
      fortschritt: campaignProgress(
        campaign.zeitraumVon,
        campaign.zeitraumBis,
        campaignActions.filter((entry) => entry.status === 'ausgefuehrt').length,
        campaignActions.length
      ),
      ergebnis: revenue.dataState === 'confirmed_empty'
        ? 'kein Umsatzbeleg zugeordnet'
        : revenue.value === null
          ? 'Umsatz nicht gemessen'
          : revenue.dataState === 'partial'
            ? `${revenue.value.toLocaleString('de-DE', { maximumFractionDigits: 2 })} € bekannter Teilbetrag (${revenue.coverage.measuredCount}/${revenue.coverage.sourceCount} belegt)`
            : `${revenue.value.toLocaleString('de-DE', { maximumFractionDigits: 2 })} € explizit zugeordnet`,
      statusColor: status === 'aktiv' ? 'var(--good)' : status === 'abgeschlossen' ? 'var(--navy)' : 'var(--watch)',
    }
  })
}

export async function getSegmenteAction(): Promise<MarketingSegment[]> {
  const actor = await requireMarketingRead()
  const segments = await db.select().from(segment).where(and(
    eq(segment.tenantId, actor.tenantId),
    eq(segment.truthStatus, 'verified'),
    eq(segment.isDemo, false)
  ))
  return segments.map((entry) => ({
    id: entry.id,
    name: entry.name,
    emoji: entry.icon || '👤',
    kundenAnzahl: null,
    weckbar: null,
    evidence: 'membership_not_connected' as const,
  }))
}

export async function getLernInsightsAction(): Promise<LernInsight[]> {
  const actor = await requireMarketingRead()
  const metrics = await db.select().from(lernMetrik)
    .where(and(
      eq(lernMetrik.tenantId, actor.tenantId),
      eq(lernMetrik.truthStatus, 'verified')
    ))
    .orderBy(desc(lernMetrik.aktualisiertAm))
  return metrics.flatMap((metric) => {
    const actions = metric.aktionen || 0
    const inquiries = metric.anfragen || 0
    const revenue = Number(metric.umsatz || 0)
    const confidence = Number(metric.konfidenz || 0)
    if (actions <= 0 && inquiries <= 0 && revenue <= 0 && confidence <= 0) return []
    const evidence = [
      actions > 0 ? `${actions} Aktionen` : null,
      inquiries > 0 ? `${inquiries} Anfragen` : null,
      revenue > 0 ? `${revenue.toLocaleString('de-DE')} € attribuierter Umsatz` : null,
    ].filter((value): value is string => value !== null)
    return [{
      id: metric.id,
      titel: metric.wert,
      text: evidence.length > 0 ? evidence.join(' · ') : 'Konfidenzwert ohne verknüpfte Wirkungsbasis.',
      konfidenz: confidence > 0 ? confidence : undefined,
      datenbasis: metric.dimension,
    }]
  })
}

async function loadFunnelFacts(tenantId: string) {
  const [actions, touchpoints, attributions] = await Promise.all([
    db.select().from(aktion).where(and(
      eq(aktion.tenantId, tenantId),
      eq(aktion.truthStatus, 'verified'),
      eq(aktion.isDemo, false)
    )),
    db.select().from(touchpoint).where(eq(touchpoint.tenantId, tenantId)),
    db.select().from(attribution).where(eq(attribution.tenantId, tenantId)),
  ])
  const executedActions = actions.filter((entry) => entry.status === 'ausgefuehrt')
  const executedIds = new Set(executedActions.map((entry) => entry.id))
  const executedTouchpoints = touchpoints.filter((entry) => entry.aktionId && executedIds.has(entry.aktionId))
  const touchpointIds = new Set(executedTouchpoints.map((entry) => entry.id))
  const linkedAttributions = attributions.filter((entry) => entry.touchpointId && touchpointIds.has(entry.touchpointId))
  const reach = summarizeMarketingMeasurements(executedTouchpoints.map((entry) => ({
    value: entry.reichweite,
    status: entry.metricsStatus,
    measuredAt: entry.metricsMeasuredAt,
  })))
  const clicks = summarizeMarketingMeasurements(executedTouchpoints.map((entry) => ({
    value: entry.klicks,
    status: entry.metricsStatus,
    measuredAt: entry.metricsMeasuredAt,
  })))
  const inquiries = summarizeMarketingIdentifiers(linkedAttributions.map((entry) => entry.leadId))
  const orders = summarizeMarketingIdentifiers(linkedAttributions.map((entry) => entry.auftragId))
  const revenue = summarizeMarketingMeasurements(linkedAttributions.map((entry) => ({
    value: entry.umsatz,
    status: entry.revenueStatus,
    measuredAt: entry.revenueMeasuredAt,
  })))
  const budget = summarizeMarketingMeasurements(executedActions.map((entry) => ({
    value: entry.kostenBudget,
    status: entry.budgetStatus,
    measuredAt: entry.budgetMeasuredAt,
  })))
  return {
    actions: executedActions.length,
    actionSummary: exactMarketingCount(executedActions.length),
    reach,
    clicks,
    inquiries,
    orders,
    revenue,
    plannedBudget: budget.value,
    budgetState: budget.dataState,
    budgetCoverage: budget.coverage,
    budgetedActions: budget.coverage.measuredCount,
    attributionRows: linkedAttributions.length,
  }
}

export async function getWirkungMiniAction(): Promise<WirkungMini[]> {
  const actor = await requireMarketingRead()
  const facts = await loadFunnelFacts(actor.tenantId)
  return [
    {
      label: 'Anfragen aus Marketing',
      wert: facts.inquiries.value,
      suffix: '',
      sparkValues: facts.inquiries.value === null ? [] : [facts.inquiries.value],
      dataState: facts.inquiries.dataState,
      coverage: facts.inquiries.coverage,
    },
    {
      label: 'Zugeordneter Umsatz',
      wert: facts.revenue.value,
      suffix: ' €',
      sparkValues: facts.revenue.value === null ? [] : [facts.revenue.value],
      dataState: facts.revenue.dataState,
      coverage: facts.revenue.coverage,
    },
    {
      label: 'Planbudget ausgeführter Aktionen',
      wert: facts.plannedBudget,
      suffix: ' €',
      sparkValues: facts.plannedBudget === null ? [] : [facts.plannedBudget],
      dataState: facts.budgetState,
      coverage: facts.budgetCoverage,
    },
  ]
}

export async function getFunnelAction(): Promise<FunnelDaten> {
  const actor = await requireMarketingRead()
  const facts = await loadFunnelFacts(actor.tenantId)
  const values = [
    facts.actionSummary.value,
    facts.reach.value,
    facts.clicks.value,
    facts.inquiries.value,
    facts.orders.value,
  ].filter((value): value is number => value !== null)
  const maxValue = Math.max(1, ...values)
  const width = (value: number | null) => value !== null && value > 0
    ? Math.max(6, Math.round((value / maxValue) * 100))
    : 0
  const stage = (
    label: string,
    metric: ReturnType<typeof exactMarketingCount>,
  ) => ({
    label,
    wert: metric.value,
    breite: width(metric.value),
    dataState: metric.dataState,
    coverage: metric.coverage,
  })
  return {
    stufen: [
      stage('Ausgeführte Aktionen', facts.actionSummary),
      stage('Reichweite', facts.reach),
      stage('Klicks / Profil', facts.clicks),
      stage('Zugeordnete Anfragen', facts.inquiries),
      stage('Zugeordnete Aufträge', facts.orders),
    ],
    umsatz: facts.revenue.value,
    umsatzState: facts.revenue.dataState,
    umsatzCoverage: facts.revenue.coverage,
    plannedBudget: facts.plannedBudget,
    roi: null,
  }
}

export async function getStoryIdeenAction(): Promise<StoryIdee[]> {
  const actor = await requireMarketingRead()
  const suggestions = await loadSuggestions(actor.tenantId)
  return suggestions.map((suggestion) => ({
    id: `st-${suggestion.id}`,
    label: suggestion.titel,
    caption: suggestion.caption,
    hashtags: suggestion.hashtags,
    titel: suggestion.titel,
    icon: suggestion.kanal === 'instagram' ? 'Star' : suggestion.kanal === 'email' ? 'Landmark' : 'Building2',
  }))
}
