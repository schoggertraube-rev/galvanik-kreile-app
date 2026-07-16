import {
  sanitizeTelemetryRoute,
  sanitizeTelemetryTarget,
  type DeviceClass,
  type EventOutcome,
  type UsageEventInput,
  type UsageEventType,
} from '@/lib/telemetry/contract'
import { telemetryOutbox, type StoredTelemetryEvent } from '@/lib/tracking/telemetryOutbox'

export type UiEventName = UsageEventType
type UiEventMetrics = {
  target?: string
  outcome?: EventOutcome
  durationMs?: number
  resultCount?: number
  queryLength?: number
  clickCount?: number
}

let memorySessionId: string | null = null
let drainPromise: Promise<void> | null = null
let listenersInstalled = false
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function sessionId(): string {
  if (memorySessionId) return memorySessionId
  const key = 'kreile_usage_session_v1'
  try {
    const existing = window.sessionStorage.getItem(key)
    if (existing && UUID_V4.test(existing)) {
      memorySessionId = existing
      return existing
    }
    const created = crypto.randomUUID()
    window.sessionStorage.setItem(key, created)
    memorySessionId = created
    return created
  } catch {
    memorySessionId = crypto.randomUUID()
    return memorySessionId
  }
}

function deviceClass(): DeviceClass {
  if (window.innerWidth < 768) return 'mobile'
  if (window.innerWidth < 1024) return 'tablet'
  return 'desktop'
}

function optionalInteger(value: unknown, maximum: number): number | undefined {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= maximum ? Number(value) : undefined
}

async function sendBatch(entries: StoredTelemetryEvent[]): Promise<void> {
  const response = await fetch('/api/telemetry/events', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: entries.map((entry) => entry.event) }),
    cache: 'no-store',
  })
  const body = await response.json() as {
    ok?: boolean
    status?: string
    code?: string
    persisted?: string[]
    duplicate?: string[]
  }
  if (response.ok && body.ok === true && body.status === 'accepted') {
    const receipts = [...(body.persisted || []), ...(body.duplicate || [])]
    await telemetryOutbox.remove(receipts)
    return
  }
  if (response.ok && body.status === 'disabled') {
    await telemetryOutbox.remove(entries.map((entry) => entry.id))
    return
  }
  if ([400, 401, 403].includes(response.status)) {
    await telemetryOutbox.block(entries, body.code || body.status || 'REJECTED')
  }
}

export function drainTelemetryOutbox(): Promise<void> {
  if (drainPromise) return drainPromise
  drainPromise = (async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return
    const entries = await telemetryOutbox.pending(25)
    if (entries.length === 0) return
    try {
      await sendBatch(entries)
    } catch {
      // A transient network/provider failure keeps the sanitized events queued.
    }
  })().finally(() => { drainPromise = null })
  return drainPromise
}

function installDrainListeners() {
  if (listenersInstalled || typeof window === 'undefined') return
  listenersInstalled = true
  window.addEventListener('online', () => void drainTelemetryOutbox())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void drainTelemetryOutbox()
  })
  void drainTelemetryOutbox()
}

export function trackUiEvent(eventName: UiEventName, metrics: UiEventMetrics = {}): void {
  if (typeof window === 'undefined') return
  installDrainListeners()
  const target = sanitizeTelemetryTarget(metrics.target)
  const event: UsageEventInput = {
    clientEventId: crypto.randomUUID(),
    sessionId: sessionId(),
    eventType: eventName,
    route: sanitizeTelemetryRoute(window.location.pathname),
    ...(target ? { target } : {}),
    deviceClass: deviceClass(),
    ...(metrics.outcome ? { outcome: metrics.outcome } : {}),
    ...(optionalInteger(metrics.durationMs, 3_600_000) !== undefined ? { durationMs: optionalInteger(metrics.durationMs, 3_600_000) } : {}),
    ...(optionalInteger(metrics.resultCount, 100_000) !== undefined ? { resultCount: optionalInteger(metrics.resultCount, 100_000) } : {}),
    ...(optionalInteger(metrics.queryLength, 500) !== undefined ? { queryLength: optionalInteger(metrics.queryLength, 500) } : {}),
    ...(optionalInteger(metrics.clickCount, 10_000) !== undefined ? { clickCount: optionalInteger(metrics.clickCount, 10_000) } : {}),
    occurredAt: new Date().toISOString(),
  }
  void telemetryOutbox.enqueue(event).then((stored) => {
    if (stored) void drainTelemetryOutbox()
  }).catch(() => undefined)
}
