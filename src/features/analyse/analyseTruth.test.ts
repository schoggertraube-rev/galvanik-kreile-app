import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  select: vi.fn(),
}))

vi.mock('@/lib/server/authorization', () => ({ resolveAuthorization: mocks.resolveAuthorization }))
vi.mock('@/db', () => ({ db: { select: mocks.select } }))

import { getAnalyseOverview } from '@/features/analyse/analyse.actions'

function queryResult(rows: unknown[]) {
  const query = {
    from: () => query,
    innerJoin: () => query,
    leftJoin: () => query,
    where: () => query,
    groupBy: () => query,
    orderBy: () => query,
    limit: () => query,
    then: (resolvePromise: (value: unknown[]) => unknown, rejectPromise?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolvePromise, rejectPromise),
  }
  return query
}

describe('analyse truth boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveAuthorization.mockResolvedValue({
      ok: true,
      data: { tenantId: 'galvanik-kreile', permissions: ['perm_view_leitstand'] },
    })
  })

  it('authorizes before any database read', async () => {
    mocks.resolveAuthorization.mockResolvedValue({ ok: false, error: { code: 'UNAUTHORIZED' } })
    await expect(getAnalyseOverview('Monat')).rejects.toThrow('AUTH_ERROR')
    expect(mocks.select).not.toHaveBeenCalled()
  })

  it('preserves a measured zero instead of treating it as missing', async () => {
    const results = [
      [{ completedCount: 1, dueDateMeasurable: 1, deliveredOnTime: 0, cycleMeasurable: 1, averageCycleDays: 0 }],
      [{ openCount: 0, withoutDueDate: 0, overdueCount: 0 }],
      [],
      [],
      [],
    ]
    mocks.select.mockImplementation(() => queryResult(results.shift() || []))

    const result = await getAnalyseOverview('Monat')
    expect(result.error).toBeUndefined()
    expect(result.data[0].primaryValue).toBe('0%')
    expect(result.data[0].secondaryValue).toBe('0 Tage')
  })

  it('returns an unavailable state instead of fabricated zeroes on query failure', async () => {
    mocks.select.mockImplementation(() => {
      throw new Error('database unavailable')
    })
    const result = await getAnalyseOverview('Monat')
    expect(result).toEqual({
      data: [],
      error: { code: 'ANALYSE_UNAVAILABLE', message: 'Analysedaten konnten nicht geladen werden.' },
    })
  })

  it('rejects unsupported periods before querying', async () => {
    const result = await getAnalyseOverview('irgendwann')
    expect(result.error?.code).toBe('INVALID_PERIOD')
    expect(mocks.select).not.toHaveBeenCalled()
  })

  it('does not use browser Supabase views or fabricated economics', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/analyse/analyse.actions.ts'), 'utf8')
    expect(source).not.toContain('createClient')
    expect(source).not.toContain('v_analyse_')
    expect(source).not.toMatch(/actualDelayCostEur:\s*0/)
    expect(source).not.toMatch(/auslastungPct:\s*Math\./)
  })

  it('keeps unmeasured station capacity explicitly unavailable', () => {
    const actionSource = readFileSync(resolve(process.cwd(), 'src/features/analyse/analyse.actions.ts'), 'utf8')
    const stationSource = readFileSync(
      resolve(process.cwd(), 'src/features/analyse/kacheln/werkstatt-puls/WerkstattPulsStationArena.tsx'),
      'utf8',
    )

    expect(actionSource).toContain('status: "unavailable"')
    expect(stationSource).toContain('Kapazitätsauslastung nicht gemessen')
    expect(stationSource).not.toMatch(/auslastungPct\s*\|\|\s*0/)
  })

  it('uses only explicit customer promises for delivery reliability and removes fabricated tile facts', () => {
    const actionSource = readFileSync(resolve(process.cwd(), 'src/features/analyse/analyse.actions.ts'), 'utf8')
    const customerTile = readFileSync(resolve(process.cwd(), 'src/app/performance/components/KundenMarktKachel.tsx'), 'utf8')
    const revenueTile = readFileSync(resolve(process.cwd(), 'src/app/performance/components/UmsatzMargeKachel.tsx'), 'utf8')
    const drill = readFileSync(resolve(process.cwd(), 'src/features/analyse/AnalyseDrillOverlay.tsx'), 'utf8')

    expect(actionSource).toContain('const promisedDueDate = orders.promisedDueDate')
    expect(actionSource).not.toContain('coalesce(${orders.promisedDueDate}, ${orders.dueDate})')
    expect(actionSource).not.toContain('/orders?risk=overdue')
    expect(customerTile).not.toContain('82%')
    expect(customerTile).not.toContain('18%')
    expect(customerTile).not.toContain('3 Länder')
    expect(revenueTile).not.toContain('points="0,22')
    expect(drill).not.toContain('[Chart Placeholder')
  })

  it('replaces fabricated legacy performance details with a minimal redirect', () => {
    const legacyPages = [
      'werkstatt-puls',
      'umsatz-marge',
      'qualitaet-risiko',
      'baeder-material',
      'kunden-markt',
      'ki-empfehlungen',
    ]

    for (const page of legacyPages) {
      const source = readFileSync(resolve(process.cwd(), `src/app/performance/${page}/page.tsx`), 'utf8')
      const redirectAt = source.indexOf("redirect('/performance')")

      expect(redirectAt, page).toBeGreaterThan(-1)
      expect(source, page).not.toMatch(/(?:React\.)?use(?:State|Effect)\s*[<(]/)
      expect(source, page).not.toContain('PerformanceDetailLayout')
      expect(source, page).not.toContain('AnalysisOverlay')
    }
  })

  it('routes the legacy analysis entry point to the hardened cockpit', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/analyse/page.tsx'), 'utf8')

    expect(source).toContain("redirect('/performance')")
    expect(source).not.toContain('AnalysePage')
  })
})
