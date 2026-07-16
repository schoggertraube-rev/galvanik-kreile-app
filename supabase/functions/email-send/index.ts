import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.6'
import { corsHeaders, handleCors, requireServiceRole } from '../_shared/security.ts'

const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:/-]{8,200}$/
const TEMPLATE_PATTERN = /^[a-z0-9][a-z0-9._-]{1,79}$/
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const TENANT_ID = Deno.env.get('KREILE_TENANT_ID') ?? 'galvanik-kreile'

function json(cors: Record<string, string>, body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function optionalIdentifier(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) throw new Error('INVALID_REQUEST')
  return value
}

function parseInput(value: unknown) {
  const body = objectValue(value)
  const allowed = ['tenantId', 'to', 'templateKey', 'variables', 'orderId', 'customerId', 'idempotencyKey']
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw new Error('INVALID_REQUEST')
  if (body.tenantId !== TENANT_ID || typeof body.to !== 'string' || body.to.length > 320 || !EMAIL_PATTERN.test(body.to.trim())) throw new Error('INVALID_REQUEST')
  if (typeof body.templateKey !== 'string' || !TEMPLATE_PATTERN.test(body.templateKey)) throw new Error('INVALID_REQUEST')
  if (typeof body.idempotencyKey !== 'string' || !IDEMPOTENCY_PATTERN.test(body.idempotencyKey)) throw new Error('INVALID_REQUEST')
  const rawVariables = objectValue(body.variables)
  if (Object.keys(rawVariables).length > 30) throw new Error('INVALID_REQUEST')
  const variables: Record<string, string> = {}
  for (const [key, entry] of Object.entries(rawVariables)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(key) || typeof entry !== 'string' || entry.length > 2_000 || entry.includes('\0')) throw new Error('INVALID_REQUEST')
    variables[key] = entry
  }
  return {
    tenantId: TENANT_ID,
    to: body.to.trim().toLowerCase(),
    templateKey: body.templateKey,
    idempotencyKey: body.idempotencyKey,
    orderId: optionalIdentifier(body.orderId),
    customerId: optionalIdentifier(body.customerId),
    variables,
  }
}

function htmlEscape(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function placeholders(...templates: (string | null)[]): Set<string> {
  const result = new Set<string>()
  for (const template of templates) {
    if (!template) continue
    for (const match of template.matchAll(/\{([A-Za-z][A-Za-z0-9_]{0,49})\}/g)) result.add(match[1])
  }
  return result
}

function render(template: string, variables: Record<string, string>, html: boolean): string {
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]{0,49})\}/g, (_match, key: string) => {
    const value = variables[key]
    if (value === undefined) throw new Error('TEMPLATE_INVALID')
    return html ? htmlEscape(value) : value
  })
}

async function providerKey(tenantId: string, idempotencyKey: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${tenantId}\0${idempotencyKey}`))
  return `kreile/${Array.from(new Uint8Array(digest), (entry) => entry.toString(16).padStart(2, '0')).join('')}`
}

serve(async (request) => {
  const cors = corsHeaders(request)
  const preflight = handleCors(request)
  if (preflight) return preflight
  const unauthorized = requireServiceRole(request)
  if (unauthorized) return unauthorized
  if (request.method !== 'POST') return json(cors, { ok: false, code: 'METHOD_NOT_ALLOWED' }, 405)

  const declaredLength = Number(request.headers.get('content-length') || '0')
  if (!Number.isFinite(declaredLength) || declaredLength > 70_000) return json(cors, { ok: false, code: 'INVALID_REQUEST' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim() ?? ''
  const from = Deno.env.get('RESEND_FROM_EMAIL')?.trim() ?? ''
  const fromAddress = from.match(/<([^<>]+)>$/)?.[1] || from
  if (!supabaseUrl || !serviceRole || !resendKey || !from || !EMAIL_PATTERN.test(fromAddress)) {
    return json(cors, { ok: false, code: 'CONFIGURATION_MISSING' }, 503)
  }

  let input: ReturnType<typeof parseInput>
  try {
    input = parseInput(await request.json())
  } catch {
    return json(cors, { ok: false, code: 'INVALID_REQUEST' }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceRole)
  const templateResult = await supabase.from('email_templates')
    .select('subject_template,body_html_template,body_text_template')
    .eq('tenant_id', input.tenantId)
    .eq('template_key', input.templateKey)
    .maybeSingle()
  if (templateResult.error) return json(cors, { ok: false, code: 'UNAVAILABLE' }, 503)
  if (!templateResult.data) return json(cors, { ok: false, code: 'TEMPLATE_NOT_FOUND' }, 404)

  const template = templateResult.data
  const required = placeholders(template.subject_template, template.body_html_template, template.body_text_template)
  if ([...required].some((key) => input.variables[key] === undefined) || Object.keys(input.variables).some((key) => !required.has(key))) {
    return json(cors, { ok: false, code: 'TEMPLATE_INVALID' }, 409)
  }

  let subject: string
  let html: string
  let text: string | undefined
  try {
    subject = render(template.subject_template, input.variables, false).trim()
    html = render(template.body_html_template, input.variables, true)
    text = template.body_text_template ? render(template.body_text_template, input.variables, false) : undefined
  } catch {
    return json(cors, { ok: false, code: 'TEMPLATE_INVALID' }, 409)
  }
  if (!subject || subject.length > 200 || /[\r\n]/.test(subject) || !html || html.length > 200_000 || (text && text.length > 100_000)) {
    return json(cors, { ok: false, code: 'TEMPLATE_INVALID' }, 409)
  }

  const inserted = await supabase.from('communications').insert({
    tenant_id: input.tenantId,
    customer_id: input.customerId,
    order_id: input.orderId,
    recipient: input.to,
    template_key: input.templateKey,
    idempotency_key: input.idempotencyKey,
    subject,
    body: html,
    type: 'email',
    channel_type: 'email',
    status: 'queued',
  })
  if (inserted.error && inserted.error.code !== '23505') return json(cors, { ok: false, code: 'UNAVAILABLE' }, 503)

  const loaded = await supabase.from('communications').select('*')
    .eq('tenant_id', input.tenantId).eq('idempotency_key', input.idempotencyKey).maybeSingle()
  if (loaded.error || !loaded.data) return json(cors, { ok: false, code: 'UNCERTAIN' }, 409)
  const delivery = loaded.data
  if (delivery.recipient !== input.to || delivery.template_key !== input.templateKey || delivery.subject !== subject || delivery.body !== html ||
      (delivery.order_id ?? undefined) !== input.orderId || (delivery.customer_id ?? undefined) !== input.customerId) {
    return json(cors, { ok: false, code: 'UNCERTAIN' }, 409)
  }
  if (['sent', 'delivered', 'opened'].includes(delivery.status) && typeof delivery.resend_message_id === 'string') {
    return json(cors, { ok: true, messageId: delivery.resend_message_id, replayed: true }, 200)
  }
  if (['bounced', 'complained', 'uncertain'].includes(delivery.status)) return json(cors, { ok: false, code: 'UNCERTAIN' }, 409)
  if (delivery.status === 'sending') {
    const claimedAt = Date.parse(delivery.claimed_at || '')
    if (Number.isFinite(claimedAt) && claimedAt < Date.now() - 10 * 60 * 1_000) {
      await supabase.from('communications').update({ status: 'uncertain', error_code: 'STALE_EMAIL_DELIVERY', completed_at: new Date().toISOString() })
        .eq('id', delivery.id).eq('status', 'sending')
      return json(cors, { ok: false, code: 'UNCERTAIN' }, 409)
    }
    return json(cors, { ok: false, code: 'IN_PROGRESS' }, 409)
  }

  const claimed = await supabase.from('communications').update({
    status: 'sending',
    claimed_at: new Date().toISOString(),
    completed_at: null,
    error_code: null,
    attempt_count: Number(delivery.attempt_count || 0) + 1,
  }).eq('id', delivery.id).in('status', ['queued', 'failed']).is('resend_message_id', null).select('id').maybeSingle()
  if (claimed.error || !claimed.data) return json(cors, { ok: false, code: 'IN_PROGRESS' }, 409)

  async function settle(status: 'failed' | 'uncertain', errorCode: string) {
    await supabase.from('communications').update({ status, error_code: errorCode, completed_at: new Date().toISOString() })
      .eq('id', delivery.id).eq('status', 'sending')
  }

  let response: Response
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': await providerKey(input.tenantId, input.idempotencyKey),
      },
      body: JSON.stringify({ from, to: [input.to], subject, html, ...(text ? { text } : {}) }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    await settle('uncertain', 'RESEND_NETWORK_UNCERTAIN')
    return json(cors, { ok: false, code: 'UNCERTAIN' }, 409)
  }

  const responseText = await response.text()
  if (responseText.length > 262_144) {
    await settle('uncertain', 'RESEND_RESPONSE_TOO_LARGE')
    return json(cors, { ok: false, code: 'UNCERTAIN' }, 409)
  }
  let responseBody: Record<string, unknown> = {}
  try { responseBody = objectValue(JSON.parse(responseText)) } catch { responseBody = {} }
  if (!response.ok) {
    const uncertain = response.status >= 500 || response.status === 409
    await settle(uncertain ? 'uncertain' : 'failed', `RESEND_HTTP_${response.status}`)
    return json(cors, { ok: false, code: uncertain ? 'UNCERTAIN' : 'PROVIDER_REJECTED' }, uncertain ? 409 : 502)
  }
  const messageId = typeof responseBody.id === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(responseBody.id) ? responseBody.id : null
  if (!messageId) {
    await settle('uncertain', 'RESEND_MESSAGE_ID_INVALID')
    return json(cors, { ok: false, code: 'UNCERTAIN' }, 409)
  }
  const settled = await supabase.from('communications').update({
    status: 'sent', resend_message_id: messageId, completed_at: new Date().toISOString(), error_code: null,
  }).eq('id', delivery.id).eq('status', 'sending').select('id').maybeSingle()
  if (settled.error || !settled.data) {
    await settle('uncertain', 'EMAIL_SETTLEMENT_UNCERTAIN')
    return json(cors, { ok: false, code: 'UNCERTAIN' }, 409)
  }
  return json(cors, { ok: true, messageId, replayed: false }, 200)
})
