export const USAGE_EVENT_TYPES = [
  'nav_click',
  'overlay_open',
  'overlay_close_backdrop',
  'overlay_close_esc',
  'page_view',
  'detail_open',
  'search',
  'action',
  'tool_usage',
  'workflow_started',
  'workflow_step',
  'workflow_completed',
  'workflow_abandoned',
  'error',
] as const

export const DEVICE_CLASSES = ['desktop', 'tablet', 'mobile', 'unknown'] as const
export const EVENT_OUTCOMES = ['success', 'failure', 'cancelled', 'empty', 'unknown'] as const

export type UsageEventType = typeof USAGE_EVENT_TYPES[number]
export type DeviceClass = typeof DEVICE_CLASSES[number]
export type EventOutcome = typeof EVENT_OUTCOMES[number]

export type UsageEventInput = {
  clientEventId: string
  sessionId: string
  eventType: UsageEventType
  route: string
  target?: string
  deviceClass: DeviceClass
  outcome?: EventOutcome
  durationMs?: number
  resultCount?: number
  queryLength?: number
  clickCount?: number
  occurredAt: string
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ROUTE = /^\/(?:[a-z][a-z-]{0,39}|:id)?(?:\/(?:[a-z][a-z-]{0,39}|:id)){0,4}$/
const TARGET = /^(?:[a-z][a-z0-9._:-]{0,79}|\/(?:[a-z][a-z-]{0,39})(?:\/[a-z][a-z-]{0,39})?)$/

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function boundedInteger(value: unknown, maximum: number): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > maximum) throw new Error('INVALID_TELEMETRY_EVENT')
  return Number(value)
}

export function sanitizeTelemetryRoute(value: string): string {
  const path = value.split(/[?#]/, 1)[0]
  const sanitized = path.split('/').map((segment, index) => {
    if (index === 0 || segment === '') return segment
    return /^[a-z][a-z-]{0,39}$/.test(segment) ? segment : ':id'
  }).slice(0, 6).join('/')
  return ROUTE.test(sanitized) ? sanitized : '/unknown'
}

export function sanitizeTelemetryTarget(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 100) return undefined
  if (value === '/') return 'home'
  if (value.startsWith('/')) {
    const route = sanitizeTelemetryRoute(value)
    return route.includes(':id') || !TARGET.test(route) ? undefined : route
  }
  if (!TARGET.test(value) || /[0-9a-f]{8}-[0-9a-f-]{20,}/i.test(value) || /[a-z0-9_-]{20,}/i.test(value)) return undefined
  return value
}

export function parseUsageEventBatch(value: unknown, nowMs = Date.now()): UsageEventInput[] {
  const body = objectValue(value)
  if (Object.keys(body).length !== 1 || !Array.isArray(body.events) || body.events.length < 1 || body.events.length > 25) {
    throw new Error('INVALID_TELEMETRY_BATCH')
  }

  return body.events.map((entry) => {
    const event = objectValue(entry)
    const allowed = ['clientEventId', 'sessionId', 'eventType', 'route', 'target', 'deviceClass', 'outcome', 'durationMs', 'resultCount', 'queryLength', 'clickCount', 'occurredAt']
    if (Object.keys(event).some((key) => !allowed.includes(key))) throw new Error('INVALID_TELEMETRY_EVENT')
    if (typeof event.clientEventId !== 'string' || !UUID_V4.test(event.clientEventId) || typeof event.sessionId !== 'string' || !UUID_V4.test(event.sessionId)) {
      throw new Error('INVALID_TELEMETRY_EVENT')
    }
    if (typeof event.eventType !== 'string' || !USAGE_EVENT_TYPES.includes(event.eventType as UsageEventType)) throw new Error('INVALID_TELEMETRY_EVENT')
    if (typeof event.route !== 'string' || !ROUTE.test(event.route)) throw new Error('INVALID_TELEMETRY_EVENT')
    if (event.target !== undefined && (
      typeof event.target !== 'string' ||
      !TARGET.test(event.target) ||
      sanitizeTelemetryTarget(event.target) !== event.target
    )) throw new Error('INVALID_TELEMETRY_EVENT')
    if (typeof event.deviceClass !== 'string' || !DEVICE_CLASSES.includes(event.deviceClass as DeviceClass)) throw new Error('INVALID_TELEMETRY_EVENT')
    if (event.outcome !== undefined && (typeof event.outcome !== 'string' || !EVENT_OUTCOMES.includes(event.outcome as EventOutcome))) throw new Error('INVALID_TELEMETRY_EVENT')
    if (typeof event.occurredAt !== 'string' || event.occurredAt.length > 40) throw new Error('INVALID_TELEMETRY_EVENT')
    const occurredMs = Date.parse(event.occurredAt)
    if (!Number.isFinite(occurredMs) || occurredMs < nowMs - 7 * 24 * 60 * 60 * 1_000 || occurredMs > nowMs + 5 * 60 * 1_000) {
      throw new Error('INVALID_TELEMETRY_EVENT')
    }

    return {
      clientEventId: event.clientEventId,
      sessionId: event.sessionId,
      eventType: event.eventType as UsageEventType,
      route: event.route,
      ...(typeof event.target === 'string' ? { target: event.target } : {}),
      deviceClass: event.deviceClass as DeviceClass,
      ...(typeof event.outcome === 'string' ? { outcome: event.outcome as EventOutcome } : {}),
      ...(event.durationMs !== undefined ? { durationMs: boundedInteger(event.durationMs, 3_600_000) } : {}),
      ...(event.resultCount !== undefined ? { resultCount: boundedInteger(event.resultCount, 100_000) } : {}),
      ...(event.queryLength !== undefined ? { queryLength: boundedInteger(event.queryLength, 500) } : {}),
      ...(event.clickCount !== undefined ? { clickCount: boundedInteger(event.clickCount, 10_000) } : {}),
      occurredAt: new Date(occurredMs).toISOString(),
    }
  })
}
