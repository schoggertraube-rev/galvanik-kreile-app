import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveAuthorization = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/authorization', () => ({ resolveAuthorization }))

import { requireMarketingRead, requireMarketingWrite } from '@/lib/server/marketingAuthorization'

const actor = {
  userId: 'office-user',
  tenantId: 'galvanik-kreile',
  displayName: 'Büro',
  role: 'buero',
  active: true,
  permissions: ['perm_view_customers', 'perm_view_prices', 'perm_data_customers'],
} as const

describe('marketing authorization boundary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fails closed for missing sessions, wrong tenants and insufficient permissions', async () => {
    resolveAuthorization.mockResolvedValueOnce({ ok: false, reason: 'NO_SESSION' })
    await expect(requireMarketingRead()).rejects.toThrow('AUTH_ERROR: Forbidden')

    resolveAuthorization.mockResolvedValueOnce({ ok: true, data: { ...actor, tenantId: 'other' } })
    await expect(requireMarketingRead()).rejects.toThrow('AUTH_ERROR: Forbidden')

    resolveAuthorization.mockResolvedValueOnce({ ok: true, data: { ...actor, permissions: ['perm_view_customers'] } })
    await expect(requireMarketingRead()).rejects.toThrow('AUTH_ERROR: Forbidden')

    resolveAuthorization.mockResolvedValueOnce({ ok: true, data: { ...actor, permissions: ['perm_view_customers', 'perm_view_prices'] } })
    await expect(requireMarketingWrite()).rejects.toThrow('AUTH_ERROR: Forbidden')
  })

  it('returns the current database-backed actor for entitled reads and writes', async () => {
    resolveAuthorization.mockResolvedValue({ ok: true, data: actor })
    await expect(requireMarketingRead()).resolves.toEqual(actor)
    await expect(requireMarketingWrite()).resolves.toEqual(actor)
  })
})
