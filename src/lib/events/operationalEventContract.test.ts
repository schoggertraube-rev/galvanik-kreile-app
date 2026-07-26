import { describe, expect, it } from 'vitest'
import {
  DOCUMENTARY_OPERATIONAL_EVENT_TYPES,
  isPersistedOperationalEventType,
  parseEventLimit,
  parseOperationalEvent,
} from '@/lib/events/operationalEventContract'

const valid = {
  clientEventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  orderId: 'order-a',
  itemId: 'item-a',
  eventType: 'STATION_COMPLETED',
  metadata: { stationId: 'galvanik', durationMinutes: 45 },
}

describe('operational event contract', () => {
  it('accepts the exact bounded event shape', () => {
    expect(parseOperationalEvent(valid)).toEqual(valid)
  })

  it.each([
    { ...valid, tenantId: 'other' },
    { ...valid, eventType: 'ARBITRARY' },
    { ...valid, metadata: { note: 'raw free text' } },
    { ...valid, metadata: { durationMinutes: 2_000 } },
    { ...valid, orderId: '../other' },
  ])('rejects client authority, arbitrary types, text, and bounds', (input) => {
    expect(() => parseOperationalEvent(input)).toThrow('INVALID_OPERATIONAL_EVENT')
  })

  it('bounds read limits', () => {
    expect(parseEventLimit(undefined)).toBe(10)
    expect(parseEventLimit(100)).toBe(100)
    expect(() => parseEventLimit(101)).toThrow('INVALID_EVENT_LIMIT')
  })

  it('separates documentary client writes from retained server and legacy rows', () => {
    expect(DOCUMENTARY_OPERATIONAL_EVENT_TYPES).toEqual([
      'LABEL_PREPARED',
      'PHOTO_CAPTURED',
      'NOTE_ADDED',
    ])
    expect(isPersistedOperationalEventType('PAYMENT_REVIEW_REQUIRED')).toBe(true)
    expect(isPersistedOperationalEventType('ORDER_CREATED')).toBe(true)
    expect(isPersistedOperationalEventType('ARBITRARY')).toBe(false)
  })
})
