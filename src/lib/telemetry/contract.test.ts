import { describe, expect, it } from 'vitest'
import {
  parseUsageEventBatch,
  sanitizeTelemetryRoute,
  sanitizeTelemetryTarget,
} from '@/lib/telemetry/contract'

const now = Date.parse('2026-07-15T10:00:00.000Z')
const validEvent = {
  clientEventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  eventType: 'search',
  route: '/orders',
  target: 'orders',
  deviceClass: 'desktop',
  outcome: 'success',
  durationMs: 150,
  resultCount: 3,
  queryLength: 8,
  occurredAt: '2026-07-15T09:59:00.000Z',
}

describe('usage telemetry contract', () => {
  it('accepts only the bounded structured event shape', () => {
    expect(parseUsageEventBatch({ events: [validEvent] }, now)).toEqual([validEvent])
  })

  it.each([
    { ...validEvent, rawQuery: 'Kundenname' },
    { ...validEvent, target: 'customeridentifier123456789' },
    { ...validEvent, durationMs: 3_600_001 },
    { ...validEvent, occurredAt: '2026-07-01T00:00:00.000Z' },
    { ...validEvent, clientEventId: 'not-a-uuid' },
  ])('rejects unapproved, identifying, or out-of-bounds fields', (event) => {
    expect(() => parseUsageEventBatch({ events: [event] }, now)).toThrow()
  })

  it('rejects oversized batches', () => {
    const events = Array.from({ length: 26 }, (_, index) => ({
      ...validEvent,
      clientEventId: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, '0')}`,
    }))
    expect(() => parseUsageEventBatch({ events }, now)).toThrow('INVALID_TELEMETRY_BATCH')
  })

  it('normalizes dynamic routes without retaining identifiers', () => {
    expect(sanitizeTelemetryRoute('/orders/9b163f65-4bea-4d28-8888-0123456789ab?tab=data')).toBe('/orders/:id')
    expect(sanitizeTelemetryTarget('9b163f65-4bea-4d28-8888-0123456789ab')).toBeUndefined()
    expect(sanitizeTelemetryTarget('orders')).toBe('orders')
  })
})
