export const OPERATIONAL_EVENT_TYPES = [
  'ORDER_CREATED_FROM_SCAN',
  'ORDER_CREATED_MANUAL',
  'ITEM_COUNT_CONFIRMED',
  'PHOTO_CAPTURED',
  'LABEL_PREPARED',
  'WARENEINGANG_COMPLETED',
  'STATION_STARTED',
  'STATION_COMPLETED',
  'STATION_READY',
  'QUALITY_CHECK_PASSED',
  'QUALITY_CHECK_FAILED',
  'REWORK_STARTED',
  'SHIPMENT_PREPARED',
  'SHIPMENT_SENT',
  'CUSTOMER_PICKUP',
  'COMPLAINT_OPENED',
  'COMPLAINT_RESOLVED',
  'BATH_MEASUREMENT_TAKEN',
  'BATH_BLOCKED',
  'BATH_RELEASED',
  'STOCK_LOW',
  'STOCK_REPLENISHED',
  'NOTE_ADDED',
  'COSTS_BOOKED',
] as const

export type OperationalEventType = typeof OPERATIONAL_EVENT_TYPES[number]

export const DOCUMENTARY_OPERATIONAL_EVENT_TYPES = [
  'LABEL_PREPARED',
  'PHOTO_CAPTURED',
  'NOTE_ADDED',
] as const satisfies readonly OperationalEventType[]

export type DocumentaryOperationalEventType = typeof DOCUMENTARY_OPERATIONAL_EVENT_TYPES[number]

export const SERVER_AND_LEGACY_OPERATIONAL_EVENT_TYPES = [
  'ORDER_CREATED',
  'QUOTE_CREATED',
  'CUSTOMER_BEHAVIOR_NOTE_ADDED',
  'ORDER_UPDATED',
  'ORDER_CANCELLED',
  'STATION_AUSGANG',
  'STATION_EINGANG',
  'STATION_CHANGED',
  'PROCESSING_STARTED',
  'PHOTO_ADDED',
  'STATION_COST_BOOKED',
  'PAYMENT_FAILED',
  'PAYMENT_REVIEW_REQUIRED',
  'PAYMENT_PAID',
] as const

export const PERSISTED_OPERATIONAL_EVENT_TYPES = [
  ...OPERATIONAL_EVENT_TYPES,
  ...SERVER_AND_LEGACY_OPERATIONAL_EVENT_TYPES,
] as const

export type PersistedOperationalEventType = typeof PERSISTED_OPERATIONAL_EVENT_TYPES[number]

export const OPERATIONAL_EVENT_STATUSES = ['success', 'warning'] as const
export type OperationalEventStatus = typeof OPERATIONAL_EVENT_STATUSES[number]

export function isPersistedOperationalEventType(value: unknown): value is PersistedOperationalEventType {
  return typeof value === 'string'
    && PERSISTED_OPERATIONAL_EVENT_TYPES.includes(value as PersistedOperationalEventType)
}

export type OperationalEventMetadata = {
  stationId?: string
  nextStationId?: string
  durationMinutes?: number
  materialCount?: number
  quantity?: number
  reasonCode?: string
}

export type CreateOperationalEventInput = {
  clientEventId: string
  orderId: string
  itemId?: string
  eventType: OperationalEventType
  metadata?: OperationalEventMetadata
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ENTITY_ID = /^[a-zA-Z0-9_-]{1,100}$/
const CODE = /^[a-z][a-z0-9_-]{0,79}$/

function boundedInteger(value: unknown, maximum: number): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > maximum) throw new Error('INVALID_OPERATIONAL_EVENT')
  return Number(value)
}

export function parseOperationalEvent(value: unknown): CreateOperationalEventInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_OPERATIONAL_EVENT')
  const input = value as Record<string, unknown>
  if (Object.keys(input).some((key) => !['clientEventId', 'orderId', 'itemId', 'eventType', 'metadata'].includes(key))) throw new Error('INVALID_OPERATIONAL_EVENT')
  if (typeof input.clientEventId !== 'string' || !UUID_V4.test(input.clientEventId)) throw new Error('INVALID_OPERATIONAL_EVENT')
  if (typeof input.orderId !== 'string' || !ENTITY_ID.test(input.orderId)) throw new Error('INVALID_OPERATIONAL_EVENT')
  if (input.itemId !== undefined && (typeof input.itemId !== 'string' || !ENTITY_ID.test(input.itemId))) throw new Error('INVALID_OPERATIONAL_EVENT')
  if (typeof input.eventType !== 'string' || !OPERATIONAL_EVENT_TYPES.includes(input.eventType as OperationalEventType)) throw new Error('INVALID_OPERATIONAL_EVENT')

  let metadata: OperationalEventMetadata | undefined
  if (input.metadata !== undefined) {
    if (!input.metadata || typeof input.metadata !== 'object' || Array.isArray(input.metadata)) throw new Error('INVALID_OPERATIONAL_EVENT')
    const raw = input.metadata as Record<string, unknown>
    if (Object.keys(raw).some((key) => !['stationId', 'nextStationId', 'durationMinutes', 'materialCount', 'quantity', 'reasonCode'].includes(key))) throw new Error('INVALID_OPERATIONAL_EVENT')
    for (const key of ['stationId', 'nextStationId', 'reasonCode'] as const) {
      if (raw[key] !== undefined && (typeof raw[key] !== 'string' || !CODE.test(raw[key] as string))) throw new Error('INVALID_OPERATIONAL_EVENT')
    }
    metadata = {
      ...(typeof raw.stationId === 'string' ? { stationId: raw.stationId } : {}),
      ...(typeof raw.nextStationId === 'string' ? { nextStationId: raw.nextStationId } : {}),
      ...(boundedInteger(raw.durationMinutes, 24 * 60) !== undefined ? { durationMinutes: boundedInteger(raw.durationMinutes, 24 * 60) } : {}),
      ...(boundedInteger(raw.materialCount, 10_000) !== undefined ? { materialCount: boundedInteger(raw.materialCount, 10_000) } : {}),
      ...(boundedInteger(raw.quantity, 1_000_000) !== undefined ? { quantity: boundedInteger(raw.quantity, 1_000_000) } : {}),
      ...(typeof raw.reasonCode === 'string' ? { reasonCode: raw.reasonCode } : {}),
    }
    if (JSON.stringify(metadata).length > 2_048) throw new Error('INVALID_OPERATIONAL_EVENT')
  }

  return {
    clientEventId: input.clientEventId,
    orderId: input.orderId,
    ...(typeof input.itemId === 'string' ? { itemId: input.itemId } : {}),
    eventType: input.eventType as OperationalEventType,
    ...(metadata ? { metadata } : {}),
  }
}

export function parseOperationalEntityId(value: unknown): string {
  if (typeof value !== 'string' || !ENTITY_ID.test(value)) throw new Error('INVALID_ENTITY_ID')
  return value
}

export function parseEventLimit(value: unknown, fallback = 10): number {
  if (value === undefined) return fallback
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 100) throw new Error('INVALID_EVENT_LIMIT')
  return Number(value)
}
