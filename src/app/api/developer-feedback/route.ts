import { createHmac } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { developerFeedback } from '@/db/schema'
import { parseDeveloperFeedback } from '@/lib/feedback/contract'
import { resolveAuthorization } from '@/lib/server/authorization'
import { consumeDurableRateLimit } from '@/lib/server/durableRateLimit'

export const runtime = 'nodejs'

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function sameOrigin(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false
  const origin = request.headers.get('origin')
  return !origin || origin === new URL(request.url).origin
}

export async function POST(request: Request) {
  const authorization = await resolveAuthorization()
  if (!authorization.ok) return json({ ok: false, code: 'UNAUTHORIZED' }, 401)
  if (authorization.data.tenantId !== 'galvanik-kreile' || !sameOrigin(request)) return json({ ok: false, code: 'FORBIDDEN' }, 403)

  const declaredLength = Number(request.headers.get('content-length') || '0')
  if (!Number.isFinite(declaredLength) || declaredLength > 10 * 1024) return json({ ok: false, code: 'INVALID_REQUEST' }, 400)
  const secret = process.env.DEVELOPER_FEEDBACK_HMAC_SECRET?.trim()
  if (!secret || secret.length < 32) return json({ ok: false, code: 'CONFIGURATION_MISSING' }, 503)

  try {
    const rate = await consumeDurableRateLimit({
      namespace: 'developer-feedback',
      subject: `${authorization.data.tenantId}:${authorization.data.userId}`,
      actorId: authorization.data.userId,
      limit: 5,
      windowSeconds: 60 * 60,
    })
    if (!rate.allowed) return json({ ok: false, code: 'RATE_LIMITED', retryAfterSeconds: rate.retryAfterSeconds }, 429)
  } catch {
    return json({ ok: false, code: 'RATE_LIMIT_UNAVAILABLE' }, 503)
  }

  let input: ReturnType<typeof parseDeveloperFeedback>
  try {
    const rawBody = await request.text()
    if (new TextEncoder().encode(rawBody).byteLength > 10 * 1024) return json({ ok: false, code: 'INVALID_REQUEST' }, 400)
    input = parseDeveloperFeedback(JSON.parse(rawBody))
  } catch {
    return json({ ok: false, code: 'INVALID_REQUEST' }, 400)
  }

  const actorPseudonym = createHmac('sha256', secret)
    .update(`${authorization.data.tenantId}\0${authorization.data.userId}`, 'utf8')
    .digest('hex')
  const buildId = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_APP_VERSION || '').slice(0, 100) || null

  try {
    const inserted = await db.insert(developerFeedback).values({
      tenantId: authorization.data.tenantId,
      clientRequestId: input.clientRequestId,
      actorPseudonym,
      actorRole: authorization.data.role,
      route: input.route,
      message: input.message,
      buildId,
    }).onConflictDoNothing({
      target: [developerFeedback.tenantId, developerFeedback.actorPseudonym, developerFeedback.clientRequestId],
    }).returning({ id: developerFeedback.id, createdAt: developerFeedback.createdAt })

    const receipt = inserted[0] || (await db.select({ id: developerFeedback.id, createdAt: developerFeedback.createdAt })
      .from(developerFeedback)
      .where(and(
        eq(developerFeedback.tenantId, authorization.data.tenantId),
        eq(developerFeedback.actorPseudonym, actorPseudonym),
        eq(developerFeedback.clientRequestId, input.clientRequestId),
      )).limit(1))[0]
    if (!receipt) return json({ ok: false, code: 'STORAGE_UNAVAILABLE' }, 503)
    return json({ ok: true, status: 'stored', receiptId: receipt.id, storedAt: receipt.createdAt.toISOString(), replayed: inserted.length === 0 })
  } catch {
    return json({ ok: false, code: 'STORAGE_UNAVAILABLE' }, 503)
  }
}
