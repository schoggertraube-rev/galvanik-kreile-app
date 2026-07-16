import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
}))

vi.mock('@/lib/server/authorization', () => ({ resolveAuthorization: mocks.resolveAuthorization }))
vi.mock('@/db', () => ({ db: { select: mocks.select, insert: mocks.insert } }))

import { createStatusEvent } from './status-events.actions'

const valid = {
  clientEventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  orderId: 'order-a',
  eventType: 'STATION_STARTED',
  metadata: { stationId: 'galvanik' },
}

function selectResult(rows: unknown[]) {
  const query = {
    from: () => query,
    where: () => query,
    limit: () => Promise.resolve(rows),
  }
  return query
}

function insertResult(rows: unknown[]) {
  const query = {
    values: () => query,
    onConflictDoNothing: () => query,
    returning: () => Promise.resolve(rows),
  }
  return query
}

describe('operational event actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveAuthorization.mockResolvedValue({
      ok: true,
      data: { tenantId: 'galvanik-kreile', userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', permissions: ['perm_op_status', 'perm_view_leitstand'] },
    })
  })

  it('authorizes before parsing or querying', async () => {
    mocks.resolveAuthorization.mockResolvedValue({ ok: false, reason: 'NO_SESSION' })
    await expect(createStatusEvent({ tenantId: 'other' })).resolves.toMatchObject({ ok: false, error: 'UNAUTHORIZED' })
    expect(mocks.select).not.toHaveBeenCalled()
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('rejects client tenant authority and unknown fields', async () => {
    await expect(createStatusEvent({ ...valid, tenantId: 'other' })).resolves.toMatchObject({ ok: false, error: 'INVALID_INPUT' })
    expect(mocks.select).not.toHaveBeenCalled()
  })

  it('rejects an order outside the authenticated tenant', async () => {
    mocks.select.mockReturnValue(selectResult([]))
    await expect(createStatusEvent(valid)).resolves.toMatchObject({ ok: false, error: 'NOT_FOUND' })
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('returns the durable event receipt instead of a generated fallback', async () => {
    mocks.select.mockReturnValue(selectResult([{ id: 'order-a' }]))
    mocks.insert.mockReturnValue(insertResult([{
      id: 'persisted-event',
      clientEventId: valid.clientEventId,
      orderId: valid.orderId,
      itemId: null,
      eventType: valid.eventType,
      payload: valid.metadata,
      createdAt: new Date('2026-07-15T12:00:00Z'),
    }]))
    await expect(createStatusEvent(valid)).resolves.toEqual({
      ok: true,
      data: {
        id: 'persisted-event',
        clientEventId: valid.clientEventId,
        orderId: valid.orderId,
        eventType: valid.eventType,
        metadata: valid.metadata,
        createdAt: '2026-07-15T12:00:00.000Z',
        replayed: false,
      },
    })
  })

  it('contains no provider switch, local storage, or fabricated receipt path', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/repositories/eventsRepository.ts'), 'utf8')
    expect(source).not.toContain('NEXT_PUBLIC_DATA_PROVIDER')
    expect(source).not.toContain('localStorage')
    expect(source).not.toContain('createId')
    expect(source).not.toContain('Date.now')
  })
})
