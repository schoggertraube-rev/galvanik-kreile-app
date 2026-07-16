import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireFinanceRead: vi.fn(),
  requireFinanceAdmin: vi.fn(),
  execute: vi.fn(),
}))

vi.mock('@/lib/server/financeAuthorization', () => ({
  requireFinanceRead: mocks.requireFinanceRead,
  requireFinanceAdmin: mocks.requireFinanceAdmin,
}))
vi.mock('@/db', () => ({ db: { execute: mocks.execute } }))

import {
  getPeriodenabschlussStatusAction,
  runEnergieVerteilungAction,
  schliessePeriodeAction,
} from './actions'

const periodId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const requestId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe('period close actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireFinanceRead.mockResolvedValue({ tenantId: 'galvanik-kreile', userId: periodId, role: 'admin' })
    mocks.requireFinanceAdmin.mockResolvedValue({ tenantId: 'galvanik-kreile', userId: periodId, role: 'admin' })
  })

  it('authorizes before reading period data', async () => {
    mocks.requireFinanceRead.mockRejectedValue(new Error('AUTH_ERROR: Forbidden'))
    await expect(getPeriodenabschlussStatusAction()).rejects.toThrow('AUTH_ERROR')
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('rejects malformed close identifiers before the database function', async () => {
    await expect(schliessePeriodeAction('bad', requestId)).resolves.toMatchObject({ ok: false, code: 'INVALID_REQUEST' })
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('reports an unapplied capability instead of claiming success', async () => {
    mocks.execute.mockRejectedValue(Object.assign(new Error('function missing'), { code: '42883' }))
    await expect(schliessePeriodeAction(periodId, requestId)).resolves.toMatchObject({ ok: false, code: 'CAPABILITY_NOT_APPLIED' })
  })

  it('returns only a confirmed database receipt as success', async () => {
    mocks.execute.mockResolvedValue([{ status: 'vorlaeufig_geschlossen', closedAt: new Date('2026-07-15T12:00:00Z'), replayed: false }])
    await expect(schliessePeriodeAction(periodId, requestId)).resolves.toEqual({
      ok: true,
      status: 'vorlaeufig_geschlossen',
      closedAt: '2026-07-15T12:00:00.000Z',
      replayed: false,
    })
  })

  it('never runs the legacy destructive energy allocator', async () => {
    await expect(runEnergieVerteilungAction(2026, 7)).resolves.toMatchObject({ ok: false, code: 'NOT_CONFIGURED' })
    expect(mocks.execute).not.toHaveBeenCalled()
  })
})
