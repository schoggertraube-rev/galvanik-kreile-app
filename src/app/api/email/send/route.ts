import { NextResponse } from 'next/server'
import { parseEmailDeliveryRequest, sendTemplatedEmail, type EmailDeliveryResult } from '@/lib/server/emailDelivery'
import { resolveAuthorization } from '@/lib/server/authorization'

export const runtime = 'nodejs'

function jsonError(code: string, status: number) {
  return NextResponse.json({ ok: false, code }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function deliveryFailure(result: Extract<EmailDeliveryResult, { ok: false }>) {
  const statusByCode: Record<typeof result.code, number> = {
    CONFIGURATION_MISSING: 503,
    TEMPLATE_NOT_FOUND: 404,
    TEMPLATE_INVALID: 409,
    IN_PROGRESS: 409,
    UNCERTAIN: 409,
    PROVIDER_REJECTED: 502,
    UNAVAILABLE: 503,
  }
  return jsonError(result.code, statusByCode[result.code])
}

export async function POST(request: Request) {
  const authorization = await resolveAuthorization()
  if (!authorization.ok) return jsonError('UNAUTHORIZED', 401)
  if (!authorization.data.permissions.includes('perm_data_customers')) return jsonError('FORBIDDEN', 403)
  if (authorization.data.tenantId !== 'galvanik-kreile') return jsonError('FORBIDDEN', 403)

  const declaredLength = Number(request.headers.get('content-length') || '0')
  if (!Number.isFinite(declaredLength) || declaredLength > 70_000) return jsonError('INVALID_REQUEST', 400)

  let input: ReturnType<typeof parseEmailDeliveryRequest>
  try {
    input = parseEmailDeliveryRequest(await request.json())
  } catch {
    return jsonError('INVALID_REQUEST', 400)
  }

  const result = await sendTemplatedEmail({
    ...input,
    tenantId: authorization.data.tenantId,
    actorId: authorization.data.userId,
  })
  if (!result.ok) return deliveryFailure(result)
  return NextResponse.json({
    ok: true,
    messageId: result.messageId,
    replayed: result.replayed,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
