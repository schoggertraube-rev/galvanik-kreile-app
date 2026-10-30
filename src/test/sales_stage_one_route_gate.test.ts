import { describe, expect, it } from 'vitest'
import { isSalesStageOneRoute } from '@/proxy'

describe('Verkaufsstufe 1 route gate', () => {
  it.each([
    '/',
    '/start',
    '/auth/callback',
    '/warendurchlauf',
    '/orders/auftrag-1',
    '/customers/kunde-1',
    '/buchhaltung/rechnungen',
    '/settings',
  ])('keeps the approved route visible: %s', (pathname) => {
    expect(isSalesStageOneRoute(pathname)).toBe(true)
  })

  it.each([
    '/cockpit',
    '/performance',
    '/marketing',
    '/admin/analytics',
    '/kommunikation',
    '/finanzen',
  ])('returns the non-stage route to the 404 boundary: %s', (pathname) => {
    expect(isSalesStageOneRoute(pathname)).toBe(false)
  })

  it('does not accept lookalike prefixes', () => {
    expect(isSalesStageOneRoute('/orders-alt')).toBe(false)
    expect(isSalesStageOneRoute('/settings-old')).toBe(false)
  })
})
