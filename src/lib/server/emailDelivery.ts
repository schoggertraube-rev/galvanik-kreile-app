import { createHash } from 'node:crypto'
import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { communications, emailTemplates } from '@/db/schema'

const TENANT_ID = 'galvanik-kreile'
const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:/-]{8,200}$/
const TEMPLATE_PATTERN = /^[a-z0-9][a-z0-9._-]{1,79}$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const STALE_DELIVERY_MS = 10 * 60 * 1_000

export type EmailDeliveryInput = {
  tenantId: string
  actorId?: string
  to: string
  templateKey: string
  variables: Record<string, string>
  orderId?: string
  customerId?: string
  idempotencyKey: string
}

export type EmailDeliveryResult =
  | { ok: true; messageId: string; replayed: boolean }
  | { ok: false; code: 'CONFIGURATION_MISSING' | 'TEMPLATE_NOT_FOUND' | 'TEMPLATE_INVALID' | 'IN_PROGRESS' | 'UNCERTAIN' | 'PROVIDER_REJECTED' | 'UNAVAILABLE' }

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function optionalIdentifier(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || value.length > 128 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('INVALID_EMAIL_REQUEST')
  return value
}

export function parseEmailDeliveryRequest(value: unknown): Omit<EmailDeliveryInput, 'tenantId' | 'actorId'> {
  const object = objectValue(value)
  const allowed = ['to', 'templateKey', 'variables', 'orderId', 'customerId', 'idempotencyKey']
  if (Object.keys(object).some((key) => !allowed.includes(key))) throw new Error('INVALID_EMAIL_REQUEST')
  if (typeof object.to !== 'string' || object.to.length > 320 || !EMAIL_PATTERN.test(object.to.trim())) {
    throw new Error('INVALID_EMAIL_REQUEST')
  }
  if (typeof object.templateKey !== 'string' || !TEMPLATE_PATTERN.test(object.templateKey)) throw new Error('INVALID_EMAIL_REQUEST')
  if (typeof object.idempotencyKey !== 'string' || !IDEMPOTENCY_PATTERN.test(object.idempotencyKey)) throw new Error('INVALID_EMAIL_REQUEST')
  const rawVariables = objectValue(object.variables)
  if (Object.keys(rawVariables).length > 30) throw new Error('INVALID_EMAIL_REQUEST')
  const variables: Record<string, string> = {}
  for (const [key, entry] of Object.entries(rawVariables)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(key) || typeof entry !== 'string' || entry.length > 2_000 || entry.includes('\0')) {
      throw new Error('INVALID_EMAIL_REQUEST')
    }
    variables[key] = entry
  }
  return {
    to: object.to.trim().toLowerCase(),
    templateKey: object.templateKey,
    variables,
    orderId: optionalIdentifier(object.orderId),
    customerId: optionalIdentifier(object.customerId),
    idempotencyKey: object.idempotencyKey,
  }
}

function htmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function placeholders(...templates: (string | null)[]): Set<string> {
  const result = new Set<string>()
  for (const template of templates) {
    if (!template) continue
    for (const match of template.matchAll(/\{([A-Za-z][A-Za-z0-9_]{0,49})\}/g)) result.add(match[1])
  }
  return result
}

function renderTemplate(template: string, variables: Record<string, string>, html: boolean): string {
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]{0,49})\}/g, (_match, key: string) => {
    const value = variables[key]
    if (value === undefined) throw new Error('EMAIL_TEMPLATE_VARIABLE_MISSING')
    return html ? htmlEscape(value) : value
  })
}

function providerConfiguration(): { apiKey: string; from: string } {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM_EMAIL?.trim()
  const fromAddress = from?.match(/<([^<>]+)>$/)?.[1] || from
  if (!apiKey || !from || !fromAddress || !EMAIL_PATTERN.test(fromAddress)) throw new Error('EMAIL_CONFIGURATION_MISSING')
  return { apiKey, from }
}

export function emailProviderConfigured(): boolean {
  try {
    providerConfiguration();
    return true;
  } catch {
    return false;
  }
}

function providerIdempotencyKey(tenantId: string, key: string): string {
  return `kreile/${createHash('sha256').update(`${tenantId}\0${key}`, 'utf8').digest('hex')}`
}

async function markDelivery(
  id: string,
  status: 'failed' | 'uncertain',
  code: string,
): Promise<void> {
  try {
    await db.update(communications).set({
      status,
      errorCode: code.slice(0, 120),
      completedAt: new Date(),
    }).where(eq(communications.id, id))
  } catch {
    // The caller remains fail-closed and must not blindly retry an unsettled delivery.
  }
}

export async function sendTemplatedEmail(input: EmailDeliveryInput): Promise<EmailDeliveryResult> {
  let normalized: EmailDeliveryInput
  try {
    normalized = {
      ...parseEmailDeliveryRequest({
        to: input.to,
        templateKey: input.templateKey,
        variables: input.variables,
        orderId: input.orderId,
        customerId: input.customerId,
        idempotencyKey: input.idempotencyKey,
      }),
      tenantId: input.tenantId,
      actorId: input.actorId,
    }
  } catch {
    return { ok: false, code: 'UNAVAILABLE' }
  }
  if (normalized.tenantId !== TENANT_ID || (normalized.actorId !== undefined && !UUID_PATTERN.test(normalized.actorId))) {
    return { ok: false, code: 'UNAVAILABLE' }
  }
  input = normalized

  let provider: ReturnType<typeof providerConfiguration>
  try {
    provider = providerConfiguration()
  } catch {
    return { ok: false, code: 'CONFIGURATION_MISSING' }
  }

  try {
    const [template] = await db.select().from(emailTemplates).where(and(
      eq(emailTemplates.tenantId, input.tenantId),
      eq(emailTemplates.templateKey, input.templateKey)
    )).limit(1)
    if (!template) return { ok: false, code: 'TEMPLATE_NOT_FOUND' }

    const required = placeholders(template.subjectTemplate, template.bodyHtmlTemplate, template.bodyTextTemplate)
    if ([...required].some((key) => input.variables[key] === undefined) || Object.keys(input.variables).some((key) => !required.has(key))) {
      return { ok: false, code: 'TEMPLATE_INVALID' }
    }
    const subject = renderTemplate(template.subjectTemplate, input.variables, false).trim()
    const html = renderTemplate(template.bodyHtmlTemplate, input.variables, true)
    const text = template.bodyTextTemplate ? renderTemplate(template.bodyTextTemplate, input.variables, false) : undefined
    if (!subject || subject.length > 200 || /[\r\n]/.test(subject) || !html || html.length > 200_000 || (text && text.length > 100_000)) {
      return { ok: false, code: 'TEMPLATE_INVALID' }
    }

    await db.insert(communications).values({
      tenantId: input.tenantId,
      customerId: input.customerId,
      orderId: input.orderId,
      createdBy: input.actorId && UUID_PATTERN.test(input.actorId) ? input.actorId : undefined,
      recipient: input.to,
      templateKey: input.templateKey,
      idempotencyKey: input.idempotencyKey,
      subject,
      body: html,
      type: 'email',
      channelType: 'email',
      status: 'queued',
    }).onConflictDoNothing({ target: [communications.tenantId, communications.idempotencyKey] })

    const [delivery] = await db.select().from(communications).where(and(
      eq(communications.tenantId, input.tenantId),
      eq(communications.idempotencyKey, input.idempotencyKey)
    )).limit(1)
    if (!delivery || delivery.recipient !== input.to || delivery.templateKey !== input.templateKey || delivery.subject !== subject || delivery.body !== html ||
      (delivery.orderId || undefined) !== input.orderId || (delivery.customerId || undefined) !== input.customerId) {
      return { ok: false, code: 'UNCERTAIN' }
    }
    if (['sent', 'delivered', 'opened'].includes(delivery.status || '') && delivery.resendMessageId) {
      return { ok: true, messageId: delivery.resendMessageId, replayed: true }
    }
    if (['bounced', 'complained', 'uncertain'].includes(delivery.status || '')) return { ok: false, code: 'UNCERTAIN' }
    if (delivery.status === 'sending') {
      if (delivery.claimedAt && delivery.claimedAt.getTime() < Date.now() - STALE_DELIVERY_MS) {
        await db.update(communications).set({ status: 'uncertain', errorCode: 'STALE_EMAIL_DELIVERY', completedAt: new Date() })
          .where(and(eq(communications.id, delivery.id), eq(communications.status, 'sending'), lt(communications.claimedAt, new Date(Date.now() - STALE_DELIVERY_MS))))
        return { ok: false, code: 'UNCERTAIN' }
      }
      return { ok: false, code: 'IN_PROGRESS' }
    }

    const [claimed] = await db.update(communications).set({
      status: 'sending',
      claimedAt: new Date(),
      completedAt: null,
      errorCode: null,
      attemptCount: sql`${communications.attemptCount} + 1`,
    }).where(and(
      eq(communications.id, delivery.id),
      inArray(communications.status, ['queued', 'failed']),
      isNull(communications.resendMessageId)
    )).returning({ id: communications.id })
    if (!claimed) return { ok: false, code: 'IN_PROGRESS' }

    let response: Response
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': providerIdempotencyKey(input.tenantId, input.idempotencyKey),
        },
        body: JSON.stringify({ from: provider.from, to: [input.to], subject, html, ...(text ? { text } : {}) }),
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      })
    } catch {
      await markDelivery(delivery.id, 'uncertain', 'RESEND_NETWORK_UNCERTAIN')
      return { ok: false, code: 'UNCERTAIN' }
    }
    const responseText = await response.text()
    if (responseText.length > 262_144) {
      await markDelivery(delivery.id, 'uncertain', 'RESEND_RESPONSE_TOO_LARGE')
      return { ok: false, code: 'UNCERTAIN' }
    }
    let responseBody: Record<string, unknown> = {}
    try { responseBody = objectValue(JSON.parse(responseText)) } catch { responseBody = {} }
    if (!response.ok) {
      const uncertain = response.status >= 500 || response.status === 409
      await markDelivery(delivery.id, uncertain ? 'uncertain' : 'failed', `RESEND_HTTP_${response.status}`)
      return { ok: false, code: uncertain ? 'UNCERTAIN' : 'PROVIDER_REJECTED' }
    }
    const messageId = typeof responseBody.id === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(responseBody.id) ? responseBody.id : null
    if (!messageId) {
      await markDelivery(delivery.id, 'uncertain', 'RESEND_MESSAGE_ID_INVALID')
      return { ok: false, code: 'UNCERTAIN' }
    }
    const settled = await db.update(communications).set({
      status: 'sent',
      resendMessageId: messageId,
      completedAt: new Date(),
      errorCode: null,
    }).where(and(eq(communications.id, delivery.id), eq(communications.status, 'sending'))).returning({ id: communications.id })
    if (settled.length !== 1) {
      await markDelivery(delivery.id, 'uncertain', 'EMAIL_SETTLEMENT_UNCERTAIN')
      return { ok: false, code: 'UNCERTAIN' }
    }
    return { ok: true, messageId, replayed: false }
  } catch {
    return { ok: false, code: 'UNAVAILABLE' }
  }
}
