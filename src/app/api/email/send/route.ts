import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { customers, orders } from '@/db/schema'
import { parseStatusEmailRequest } from '@/lib/email/statusEmailContract'
import { sendTemplatedEmail, type EmailDeliveryResult } from '@/lib/server/emailDelivery'
import { resolveAuthorization } from '@/lib/server/authorization'
import { readUtf8BodyWithinLimit } from '@/lib/server/boundedRequestBody'
import { readStatusEmailSendCapability } from '@/lib/server/statusEmailCapability'

export const runtime = 'nodejs'
const MAX_BODY_BYTES = 8 * 1024
const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/

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
  if (
    !authorization.data.permissions.includes('perm_data_customers')
    || !authorization.data.permissions.includes('perm_data_orders')
  ) return jsonError('FORBIDDEN', 403)
  if (authorization.data.tenantId !== 'galvanik-kreile') return jsonError('FORBIDDEN', 403)

  const capability = await readStatusEmailSendCapability()
  if (!capability.available) {
    return NextResponse.json({ ok: false, code: 'CONFIGURATION_MISSING', reason: capability.reason }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const declaredLength = Number(request.headers.get('content-length') || '0')
  if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > MAX_BODY_BYTES) return jsonError('INVALID_REQUEST', 400)
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return jsonError('INVALID_REQUEST', 415)
  }

  let input: ReturnType<typeof parseStatusEmailRequest>
  try {
    input = parseStatusEmailRequest(JSON.parse(await readUtf8BodyWithinLimit(request, MAX_BODY_BYTES)))
  } catch {
    return jsonError('INVALID_REQUEST', 400)
  }

  let context: {
    orderId: string
    orderNumber: string
    status: string
    customerId: string
    customerName: string
    customerEmail: string
  } | null = null
  try {
    const [row] = await db.select({
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      statusText: orders.statusText,
      customerId: customers.id,
      customerName: customers.name,
      companyName: customers.companyName,
      customerEmail: customers.email,
    }).from(orders).innerJoin(customers, and(
      eq(customers.id, orders.customerId),
      eq(customers.tenantId, authorization.data.tenantId),
    )).where(and(
      eq(orders.id, input.orderId),
      eq(orders.tenantId, authorization.data.tenantId),
    )).limit(1)
    const email = row?.customerEmail?.trim().toLowerCase() || ''
    const status = row?.statusText?.trim() || row?.status?.trim() || ''
    const customerName = row?.companyName?.trim() || row?.customerName?.trim() || ''
    if (row && EMAIL_PATTERN.test(email) && status && customerName) {
      context = {
        orderId: row.orderId,
        orderNumber: row.orderNumber,
        status,
        customerId: row.customerId,
        customerName,
        customerEmail: email,
      }
    }
  } catch {
    return jsonError('UNAVAILABLE', 503)
  }
  if (!context) return jsonError('ORDER_OR_RECIPIENT_NOT_CONFIRMED', 409)

  const result = await sendTemplatedEmail({
    to: context.customerEmail,
    templateKey: input.templateKey,
    variables: {
      order_number: context.orderNumber,
      customer_name: context.customerName,
      status: context.status,
    },
    orderId: context.orderId,
    customerId: context.customerId,
    idempotencyKey: input.idempotencyKey,
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
