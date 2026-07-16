import { createHmac } from 'node:crypto'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { appUsageEvents } from '@/db/schema'
import { resolveAuthorization } from '@/lib/server/authorization'
import { consumeDurableRateLimit } from '@/lib/server/durableRateLimit'
import { parseUsageEventBatch } from '@/lib/telemetry/contract'

export const runtime = 'nodejs'

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite === 'cross-site') return false
  return !origin || origin === new URL(request.url).origin
}

export async function POST(request: Request) {
  const authorization = await resolveAuthorization()
  if (!authorization.ok) return response({ ok: false, code: 'UNAUTHORIZED' }, 401)
  if (authorization.data.tenantId !== 'galvanik-kreile') return response({ ok: false, code: 'FORBIDDEN' }, 403)
  if (!sameOrigin(request)) return response({ ok: false, code: 'FORBIDDEN' }, 403)

  const declaredLength = Number(request.headers.get('content-length') || '0')
  if (!Number.isFinite(declaredLength) || declaredLength > 64 * 1024) return response({ ok: false, code: 'INVALID_REQUEST' }, 400)

  if (process.env.USAGE_TELEMETRY_ENABLED !== 'true') {
    return response({ ok: true, status: 'disabled', reason: 'TELEMETRY_NOT_ENABLED' })
  }
  const hmacSecret = process.env.TELEMETRY_HMAC_SECRET?.trim()
  if (!hmacSecret || hmacSecret.length < 32) return response({ ok: false, code: 'CONFIGURATION_MISSING' }, 503)

  try {
    const rateLimit = await consumeDurableRateLimit({
      namespace: 'usage-telemetry',
      subject: `${authorization.data.tenantId}:${authorization.data.userId}`,
      actorId: authorization.data.userId,
      limit: 120,
      windowSeconds: 60,
    })
    if (!rateLimit.allowed) {
      return response({ ok: false, code: 'RATE_LIMITED', retryAfterSeconds: rateLimit.retryAfterSeconds }, 429)
    }
  } catch {
    return response({ ok: false, code: 'RATE_LIMIT_UNAVAILABLE' }, 503)
  }

  let events: ReturnType<typeof parseUsageEventBatch>
  try {
    const rawBody = await request.text()
    if (new TextEncoder().encode(rawBody).byteLength > 64 * 1024) {
      return response({ ok: false, code: 'INVALID_REQUEST' }, 400)
    }
    events = parseUsageEventBatch(JSON.parse(rawBody))
  } catch {
    return response({ ok: false, code: 'INVALID_REQUEST' }, 400)
  }

  const actorPseudonym = createHmac('sha256', hmacSecret)
    .update(`${authorization.data.tenantId}\0${authorization.data.userId}`, 'utf8')
    .digest('hex')
  const buildId = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_APP_VERSION || '').slice(0, 100) || null

  try {
    const inserted = await db.insert(appUsageEvents).values(events.map((event) => ({
      tenantId: authorization.data.tenantId,
      clientEventId: event.clientEventId,
      actorPseudonym,
      actorRole: authorization.data.role,
      sessionId: event.sessionId,
      eventType: event.eventType,
      route: event.route,
      target: event.target,
      deviceClass: event.deviceClass,
      outcome: event.outcome,
      durationMs: event.durationMs,
      resultCount: event.resultCount,
      queryLength: event.queryLength,
      clickCount: event.clickCount,
      buildId,
      occurredAt: new Date(event.occurredAt),
    }))).onConflictDoNothing({
      target: [appUsageEvents.tenantId, appUsageEvents.clientEventId],
    }).returning({ clientEventId: appUsageEvents.clientEventId })

    const persisted = inserted.map((entry) => entry.clientEventId)
    const persistedSet = new Set(persisted)
    const duplicate = events.map((event) => event.clientEventId).filter((id) => !persistedSet.has(id))
    return response({ ok: true, status: 'accepted', persisted, duplicate })
  } catch {
    return response({ ok: false, code: 'TELEMETRY_STORAGE_UNAVAILABLE' }, 503)
  }
}
