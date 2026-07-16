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
import { desc, eq } from 'drizzle-orm'
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

async function loadSuggestions(): Promise<AktionVorschlag[]> {
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
    kanalTyp: kanal.typ,
    kanalName: kanal.name,
    segmentName: segment.name,
  })
    .from(aktion)
    .leftJoin(kanal, eq(aktion.kanalId, kanal.id))
    .leftJoin(segment, eq(aktion.segmentId, segment.id))
    .where(eq(aktion.status, 'vorschlag'))

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
      kosten: row.kostenBudget !== null && Number(row.kostenBudget) > 0
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
  await requireMarketingRead()
  const suggestions = await loadSuggestions()
  return suggestions
    .filter((suggestion) => suggestion.score !== null)
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))[0] || null
}

export async function listVorschlaegeAction(sort: SortMode = 'output'): Promise<AktionVorschlag[]> {
  await requireMarketingRead()
  const suggestions = await loadSuggestions()
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
  await requireMarketingRead()
  const [campaigns, actions, channels, touchpoints, attributions] = await Promise.all([
    db.select().from(kampagne).orderBy(desc(kampagne.erstelltAm)),
    db.select().from(aktion),
    db.select().from(kanal),
    db.select().from(touchpoint),
    db.select().from(attribution),
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
    const revenue = campaignAttributions.reduce((sum, entry) => sum + (Number(entry.umsatz) || 0), 0)
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
      ergebnis: campaignAttributions.length > 0
        ? `${revenue.toLocaleString('de-DE', { maximumFractionDigits: 2 })} € explizit zugeordnet`
        : 'kein Umsatzbeleg zugeordnet',
      statusColor: status === 'aktiv' ? 'var(--good)' : status === 'abgeschlossen' ? 'var(--navy)' : 'var(--watch)',
    }
  })
}

export async function getSegmenteAction(): Promise<MarketingSegment[]> {
  await requireMarketingRead()
  const segments = await db.select().from(segment)
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
  await requireMarketingRead()
  const metrics = await db.select().from(lernMetrik).orderBy(desc(lernMetrik.aktualisiertAm))
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

async function loadFunnelFacts() {
  const [actions, touchpoints, attributions] = await Promise.all([
    db.select().from(aktion),
    db.select().from(touchpoint),
    db.select().from(attribution),
  ])
  const executedActions = actions.filter((entry) => entry.status === 'ausgefuehrt')
  const executedIds = new Set(executedActions.map((entry) => entry.id))
  const executedTouchpoints = touchpoints.filter((entry) => entry.aktionId && executedIds.has(entry.aktionId))
  const touchpointIds = new Set(executedTouchpoints.map((entry) => entry.id))
  const linkedAttributions = attributions.filter((entry) => entry.touchpointId && touchpointIds.has(entry.touchpointId))
  const revenue = linkedAttributions.reduce((sum, entry) => sum + (Number(entry.umsatz) || 0), 0)
  const budgetedActions = executedActions.filter((entry) => Number(entry.kostenBudget) > 0)
  const plannedBudget = budgetedActions.length > 0
    ? budgetedActions.reduce((sum, entry) => sum + Number(entry.kostenBudget), 0)
    : null
  return {
    actions: executedActions.length,
    reach: executedTouchpoints.reduce((sum, entry) => sum + (entry.reichweite || 0), 0),
    clicks: executedTouchpoints.reduce((sum, entry) => sum + (entry.klicks || 0), 0),
    inquiries: new Set(linkedAttributions.flatMap((entry) => entry.leadId ? [entry.leadId] : [])).size,
    orders: new Set(linkedAttributions.flatMap((entry) => entry.auftragId ? [entry.auftragId] : [])).size,
    revenue,
    plannedBudget,
    budgetedActions: budgetedActions.length,
    attributionRows: linkedAttributions.length,
  }
}

export async function getWirkungMiniAction(): Promise<WirkungMini[]> {
  await requireMarketingRead()
  const facts = await loadFunnelFacts()
  return [
    { label: 'Anfragen aus Marketing', wert: facts.inquiries, suffix: '', sparkValues: [facts.inquiries] },
    { label: 'Zugeordneter Umsatz', wert: facts.revenue, suffix: ' €', sparkValues: [facts.revenue] },
    ...(facts.plannedBudget === null ? [] : [{
      label: 'Planbudget ausgeführter Aktionen',
      wert: facts.plannedBudget,
      suffix: ' €',
      sparkValues: [facts.plannedBudget],
    }]),
  ]
}

export async function getFunnelAction(): Promise<FunnelDaten> {
  await requireMarketingRead()
  const facts = await loadFunnelFacts()
  const values = [facts.actions, facts.reach, facts.clicks, facts.inquiries, facts.orders]
  const maxValue = Math.max(1, ...values)
  const width = (value: number) => value > 0 ? Math.max(6, Math.round((value / maxValue) * 100)) : 0
  return {
    stufen: [
      { label: 'Ausgeführte Aktionen', wert: facts.actions, breite: width(facts.actions) },
      { label: 'Reichweite', wert: facts.reach, breite: width(facts.reach) },
      { label: 'Klicks / Profil', wert: facts.clicks, breite: width(facts.clicks) },
      { label: 'Zugeordnete Anfragen', wert: facts.inquiries, breite: width(facts.inquiries) },
      { label: 'Zugeordnete Aufträge', wert: facts.orders, breite: width(facts.orders) },
    ],
    umsatz: facts.revenue,
    plannedBudget: facts.plannedBudget,
    roi: null,
  }
}

export async function getStoryIdeenAction(): Promise<StoryIdee[]> {
  await requireMarketingRead()
  const suggestions = await loadSuggestions()
  return suggestions.map((suggestion) => ({
    id: `st-${suggestion.id}`,
    label: suggestion.titel,
    caption: suggestion.caption,
    hashtags: suggestion.hashtags,
    titel: suggestion.titel,
    icon: suggestion.kanal === 'instagram' ? 'Star' : suggestion.kanal === 'email' ? 'Landmark' : 'Building2',
  }))
}
