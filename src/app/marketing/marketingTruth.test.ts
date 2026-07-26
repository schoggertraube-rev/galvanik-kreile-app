import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  aktion,
  attribution,
  kampagne,
  kanal,
  lernMetrik,
  marketingAsset,
  segment,
  feedbackMail,
  einwilligung,
  touchpoint,
} from '@/db/schema_marketing'

const state = vi.hoisted(() => ({
  rows: new Map<unknown, unknown[]>(),
  suggestionRows: [] as unknown[],
  insert: vi.fn(),
}))

vi.mock('@/lib/server/marketingAuthorization', () => ({
  requireMarketingRead: vi.fn(async () => ({ tenantId: 'galvanik-kreile' })),
  requireMarketingWrite: vi.fn(async () => ({ tenantId: 'galvanik-kreile' })),
}))

vi.mock('@/db', () => ({
  db: {
    select: vi.fn((selection?: Record<string, unknown>) => {
      let result: unknown[] = []
      const query = {
        from(table: unknown) {
          result = table === aktion && selection && 'kanalTyp' in selection
            ? state.suggestionRows
            : state.rows.get(table) || []
          return query
        },
        leftJoin() { return query },
        innerJoin() { return query },
        where() { return query },
        orderBy() { return query },
        limit(count: number) { result = result.slice(0, count); return query },
        then(resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(result).then(resolve, reject)
        },
      }
      return query
    }),
    insert: state.insert,
  },
}))

import {
  getFunnelAction,
  getBesteAktionAction,
  getLernInsightsAction,
  getSegmenteAction,
  getWirkungMiniAction,
  listVorschlaegeAction,
} from '@/app/marketing/marketing.actions'
import { getAttributionData } from '@/app/marketing/attribution/actions'
import {
  getMarketingAnfragenAnalysisAction,
  getMarketingRoiAnalysisAction,
  getMarketingUmsatzAnalysisAction,
} from '@/app/marketing/analysis.actions'

describe('marketing truth and networking contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const at = new Date('2026-07-10T10:00:00.000Z')
    state.rows = new Map<unknown, unknown[]>([
      [aktion, [
        {
          id: 'a1',
          status: 'ausgefuehrt',
          kostenBudget: '100',
          budgetStatus: 'measured',
          budgetMeasuredAt: at,
          budgetSource: 'manual_plan',
          ausgefuehrtAm: at,
        },
      ]],
      [touchpoint, [{
        id: 't1',
        aktionId: 'a1',
        kanalId: 'k1',
        reichweite: 100,
        klicks: 20,
        metricsStatus: 'measured',
        metricsMeasuredAt: at,
        metricsSource: 'provider_insights',
        ausgefuehrtAm: at,
      }]],
      [attribution, [{
        id: 'at1',
        touchpointId: 't1',
        leadId: 'lead-1',
        auftragId: 'order-1',
        umsatz: '300',
        revenueStatus: 'measured',
        revenueMeasuredAt: at,
        revenueSource: 'invoice_link',
      }]],
      [kanal, [{ id: 'k1', name: 'Instagram', typ: 'instagram' }]],
      [kampagne, []],
      [segment, []],
      [marketingAsset, []],
      [feedbackMail, []],
      [einwilligung, []],
      [lernMetrik, []],
    ] as Array<[unknown, unknown[]]>)
    state.suggestionRows = [{
      id: 'a2',
      titel: 'Echter Vorschlag',
      typ: 'post',
      inhalt: { caption: 'Aus gespeicherten Daten', hashtags: '#galvanik' },
      score: '42',
      erwarteterOutput: null,
      aufwandMin: 5,
      kostenBudget: '0',
      kanalTyp: 'instagram',
      kanalName: 'Instagram',
      segmentName: null,
    }]
  })

  it('derives the funnel from evidence but keeps ROI unavailable without actual spend', async () => {
    await expect(getFunnelAction()).resolves.toEqual(expect.objectContaining({
      umsatz: 300,
      plannedBudget: 100,
      roi: null,
      stufen: expect.arrayContaining([
        expect.objectContaining({ label: 'Ausgeführte Aktionen', wert: 1 }),
        expect.objectContaining({ label: 'Zugeordnete Anfragen', wert: 1 }),
        expect.objectContaining({ label: 'Zugeordnete Aufträge', wert: 1 }),
      ]),
    }))
    await expect(getWirkungMiniAction()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Zugeordneter Umsatz', wert: 300 }),
      expect.objectContaining({ label: 'Planbudget ausgeführter Aktionen', wert: 100 }),
    ]))
  })

  it('keeps unmeasured reach, clicks and revenue unknown instead of presenting zero', async () => {
    const at = new Date('2026-07-10T10:00:00.000Z')
    state.rows.set(touchpoint, [{
      id: 't1',
      aktionId: 'a1',
      kanalId: 'k1',
      reichweite: null,
      klicks: null,
      metricsStatus: 'not_measured',
      metricsMeasuredAt: null,
      metricsSource: null,
      ausgefuehrtAm: at,
    }])
    state.rows.set(attribution, [{
      id: 'at1',
      touchpointId: 't1',
      leadId: 'lead-1',
      auftragId: 'order-1',
      umsatz: null,
      revenueStatus: 'not_measured',
      revenueMeasuredAt: null,
      revenueSource: null,
    }])

    await expect(getFunnelAction()).resolves.toEqual(expect.objectContaining({
      umsatz: null,
      umsatzState: 'not_measured',
      stufen: expect.arrayContaining([
        expect.objectContaining({ label: 'Reichweite', wert: null, dataState: 'not_measured' }),
        expect.objectContaining({ label: 'Klicks / Profil', wert: null, dataState: 'not_measured' }),
      ]),
    }))
    await expect(getWirkungMiniAction()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Zugeordneter Umsatz', wert: null, dataState: 'not_measured' }),
    ]))
    await expect(getAttributionData()).resolves.toEqual(expect.objectContaining({
      state: 'ready',
      channels: [
        expect.objectContaining({ kanal: 'Instagram', umsatz: null, revenueState: 'not_measured' }),
      ],
      totals: expect.objectContaining({ umsatz: null, revenueState: 'not_measured' }),
    }))
    await expect(getMarketingUmsatzAnalysisAction('2026-07-01', '2026-07-31'))
      .resolves.toEqual(expect.objectContaining({
        gesamt: null,
        evidence: expect.objectContaining({
          revenueState: 'not_measured',
          revenueCoverage: { sourceCount: 1, measuredCount: 0, missingCount: 1 },
        }),
      }))
  })

  it('returns stored proposals without auto-seeding production-looking demo records', async () => {
    await expect(listVorschlaegeAction()).resolves.toEqual([
      expect.objectContaining({ titel: 'Echter Vorschlag', caption: 'Aus gespeicherten Daten', score: 42 }),
    ])
    expect(state.insert).not.toHaveBeenCalled()
  })

  it('keeps missing proposal evidence unknown instead of inventing zero scores or a channel', async () => {
    state.suggestionRows = [{
      id: 'a3',
      titel: 'Unbewerteter Vorschlag',
      typ: 'post',
      status: 'vorschlag',
      inhalt: { text: 'Entwurf' },
      score: null,
      erwarteterOutput: null,
      aufwandMin: 0,
      kostenBudget: '0',
      kanalTyp: 'mystery',
      kanalName: null,
      segmentName: null,
    }]

    await expect(getBesteAktionAction()).resolves.toBeNull()
    await expect(listVorschlaegeAction()).resolves.toEqual([
      expect.objectContaining({
        score: null,
        kanal: 'unknown',
        aufwand: 'nicht erfasst',
        kosten: 'nicht erfasst',
        publishCapability: 'proposal_only',
      }),
    ])
  })

  it('does not derive segment membership or learned facts from unrelated rows and default zeros', async () => {
    state.rows.set(segment, [{ id: 's1', name: 'Oldtimer', icon: '🚗' }])
    state.rows.set(marketingAsset, [{ id: 'm1', segmentId: 's1', kundeId: 'c1' }])
    state.rows.set(lernMetrik, [{
      id: 'l1', dimension: 'format', wert: 'Unbelegt', aktionen: 0, anfragen: 0, umsatz: '0', konfidenz: '0', aktualisiertAm: new Date(),
    }])

    await expect(getSegmenteAction()).resolves.toEqual([
      expect.objectContaining({ kundenAnzahl: null, weckbar: null, evidence: 'membership_not_connected' }),
    ])
    await expect(getLernInsightsAction()).resolves.toEqual([])
  })

  it('uses exact attribution links instead of distributing orders and revenue heuristically', async () => {
    await expect(getAttributionData()).resolves.toEqual(expect.objectContaining({
      channels: [
        expect.objectContaining({ kanal: 'Instagram', plannedBudget: 100, actualSpend: null, leads: 1, auftraege: 1, umsatz: 300, roi: null }),
      ],
      totals: expect.objectContaining({ leads: 1, auftraege: 1, umsatz: 300, plannedBudget: 100 }),
    }))
    await expect(getMarketingAnfragenAnalysisAction('2026-07-01', '2026-07-31'))
      .resolves.toEqual(expect.objectContaining({ gesamt: 1 }))
    await expect(getMarketingUmsatzAnalysisAction('2026-07-01', '2026-07-31'))
      .resolves.toEqual(expect.objectContaining({ gesamt: 300 }))
    await expect(getMarketingRoiAnalysisAction('2026-07-01', '2026-07-31'))
      .resolves.toEqual(expect.objectContaining({ gesamt: null, revenue: 300, cost: null, plannedBudget: 100 }))
  })

  it('deduplicates global lead, order and plan-budget totals across channels on the server', async () => {
    const at = new Date('2026-07-10T10:00:00.000Z')
    state.rows.set(kanal, [
      { id: 'k1', name: 'Instagram', typ: 'instagram' },
      { id: 'k2', name: 'E-Mail', typ: 'email' },
    ])
    state.rows.set(touchpoint, [
      { id: 't1', aktionId: 'a1', kanalId: 'k1', ausgefuehrtAm: at },
      { id: 't2', aktionId: 'a1', kanalId: 'k2', ausgefuehrtAm: at },
    ])
    state.rows.set(attribution, [
      {
        id: 'at1',
        touchpointId: 't1',
        leadId: 'lead-1',
        auftragId: 'order-1',
        umsatz: '300',
        revenueStatus: 'measured',
        revenueMeasuredAt: at,
      },
      {
        id: 'at2',
        touchpointId: 't2',
        leadId: 'lead-1',
        auftragId: 'order-1',
        umsatz: null,
        revenueStatus: 'not_measured',
        revenueMeasuredAt: null,
      },
    ])

    await expect(getAttributionData()).resolves.toEqual(expect.objectContaining({
      channels: [
        expect.objectContaining({ kanal: 'Instagram', leads: 1, auftraege: 1 }),
        expect.objectContaining({ kanal: 'E-Mail', leads: 1, auftraege: 1 }),
      ],
      totals: expect.objectContaining({
        leads: 1,
        auftraege: 1,
        plannedBudget: 100,
        budgetState: 'ready',
      }),
    }))
  })

  it('does not present planned budgets as actual spend or a live ROI', () => {
    const actionSource = readFileSync(resolve(process.cwd(), 'src/app/marketing/analysis.actions.ts'), 'utf8')
    const attributionPage = readFileSync(resolve(process.cwd(), 'src/app/marketing/attribution/page.tsx'), 'utf8')
    const consentPage = readFileSync(resolve(process.cwd(), 'src/app/marketing/einwilligungen/page.tsx'), 'utf8')

    expect(actionSource).toContain('cost: null')
    expect(actionSource).toContain('kosten_budget ist ein Planwert')
    expect(attributionPage).not.toContain('Live-Auswertung')
    expect(attributionPage).toContain('Ist-Ausgaben')
    expect(attributionPage).toContain('Erneut laden')
    expect(attributionPage).toContain('setData(null)')
    expect(attributionPage).not.toContain('.reduce(')
    expect(consentPage).not.toContain('alert(')
  })

  it('does not expose a providerless execute button and requires an update receipt for approval', () => {
    const actionPage = readFileSync(resolve(process.cwd(), 'src/app/marketing/aktion/page.tsx'), 'utf8')
    const actionServer = readFileSync(resolve(process.cwd(), 'src/app/marketing/aktion/actions.ts'), 'utf8')

    expect(actionPage).not.toContain("updateStatus(row.id, 'ausgefuehrt')")
    expect(actionPage).toContain('Provider-Receipt')
    expect(actionServer).toContain("eq(aktion.status, target.status)")
    expect(actionServer).toContain('.returning({')
    expect(actionServer).toContain('MARKETING_ACTION_STATUS_CONFLICT')
  })

  it('keeps proposal-only Studio controls out of the provider publish path', () => {
    const studio = readFileSync(resolve(process.cwd(), 'src/app/marketing/components/StudioView.tsx'), 'utf8')
    const client = readFileSync(resolve(process.cwd(), 'src/app/marketing/MarketingStudioClient.tsx'), 'utf8')

    expect(studio).not.toContain('Jetzt posten')
    expect(studio).toContain('Zur Prüfung und Freigabe')
    expect(studio).toContain('Asset-Workflow und Provider-Beleg fehlen')
    expect(client).not.toContain('instagramAdapter.publish')
  })
})
