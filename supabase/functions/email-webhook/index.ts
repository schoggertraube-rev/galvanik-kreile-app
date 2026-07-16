import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.6'

const TENANT_ID = Deno.env.get('KREILE_TENANT_ID') ?? 'galvanik-kreile'
const MESSAGE_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/
const EVENT_ID_PATTERN = /^msg_[A-Za-z0-9_-]{8,200}$/
const MAX_CLOCK_SKEW_SECONDS = 5 * 60

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function base64Bytes(value: string): Uint8Array {
  let normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  while (normalized.length % 4 !== 0) normalized += '='
  const decoded = atob(normalized)
  return Uint8Array.from(decoded, (entry) => entry.charCodeAt(0))
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}

async function verifySignature(rawBody: string, eventId: string, timestamp: string, signatures: string, secret: string): Promise<boolean> {
  if (!/^\d{10}$/.test(timestamp)) return false
  const seconds = Number(timestamp)
  if (!Number.isSafeInteger(seconds) || Math.abs(Math.floor(Date.now() / 1_000) - seconds) > MAX_CLOCK_SKEW_SECONDS) return false

  let secretBytes: Uint8Array
  try {
    secretBytes = base64Bytes(secret.startsWith('whsec_') ? secret.slice(6) : secret)
  } catch {
    return false
  }
  if (secretBytes.length < 32) return false
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${eventId}.${timestamp}.${rawBody}`)))
  for (const versioned of signatures.split(' ')) {
    const [version, encoded] = versioned.split(',', 2)
    if (version !== 'v1' || !encoded || encoded.length > 128) continue
    try {
      if (constantTimeEqual(mac, base64Bytes(encoded))) return true
    } catch {
      // Continue with the remaining independently signed values.
    }
  }
  return false
}

serve(async (request) => {
  if (request.method !== 'POST') return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405)
  const declaredLength = Number(request.headers.get('content-length') || '0')
  if (!Number.isFinite(declaredLength) || declaredLength > 262_144) return json({ ok: false, code: 'INVALID_REQUEST' }, 400)

  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET')?.trim() ?? ''
  const eventId = request.headers.get('svix-id') ?? ''
  const timestamp = request.headers.get('svix-timestamp') ?? ''
  const signatures = request.headers.get('svix-signature') ?? ''
  if (!secret || !EVENT_ID_PATTERN.test(eventId) || signatures.length > 1_024) return json({ ok: false, code: 'UNAUTHORIZED' }, 401)

  const rawBody = await request.text()
  if (rawBody.length > 262_144 || !(await verifySignature(rawBody, eventId, timestamp, signatures, secret))) {
    return json({ ok: false, code: 'INVALID_SIGNATURE' }, 401)
  }

  let payload: Record<string, unknown>
  try { payload = objectValue(JSON.parse(rawBody)) } catch { return json({ ok: false, code: 'INVALID_REQUEST' }, 400) }
  const eventType = typeof payload.type === 'string' && /^email\.[a-z_]{2,50}$/.test(payload.type) ? payload.type : null
  const data = objectValue(payload.data)
  const messageId = typeof data.email_id === 'string' && MESSAGE_ID_PATTERN.test(data.email_id) ? data.email_id : null
  if (!eventType || !messageId) return json({ ok: false, code: 'INVALID_REQUEST' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceRole) return json({ ok: false, code: 'CONFIGURATION_MISSING' }, 503)
  const supabase = createClient(supabaseUrl, serviceRole)

  const inserted = await supabase.from('email_webhook_events').insert({
    tenant_id: TENANT_ID,
    provider_event_id: eventId,
    provider_message_id: messageId,
    event_type: eventType,
    status: 'processing',
  })
  if (inserted.error && inserted.error.code !== '23505') return json({ ok: false, code: 'WEBHOOK_LEDGER_UNAVAILABLE' }, 503)
  if (inserted.error?.code === '23505') {
    const existing = await supabase.from('email_webhook_events').select('status,provider_message_id,event_type')
      .eq('provider_event_id', eventId).maybeSingle()
    if (existing.error || !existing.data || existing.data.provider_message_id !== messageId || existing.data.event_type !== eventType) {
      return json({ ok: false, code: 'WEBHOOK_REPLAY_CONFLICT' }, 409)
    }
    if (existing.data.status === 'succeeded') return json({ ok: true, replayed: true }, 200)
  }

  async function settleEvent(status: 'succeeded' | 'failed', errorCode?: string) {
    return await supabase.from('email_webhook_events').update({
      status,
      processed_at: new Date().toISOString(),
      error_code: errorCode || null,
    }).eq('provider_event_id', eventId)
  }

  const current = await supabase.from('communications').select('id,status')
    .eq('tenant_id', TENANT_ID).eq('resend_message_id', messageId).maybeSingle()
  if (current.error || !current.data) {
    await settleEvent('failed', 'COMMUNICATION_NOT_FOUND')
    return json({ ok: false, code: 'COMMUNICATION_NOT_FOUND' }, 503)
  }

  const now = new Date().toISOString()
  let target: string | null = null
  let allowed: string[] = []
  let timestamps: Record<string, string> = {}
  if (eventType === 'email.delivered') {
    target = 'delivered'; allowed = ['sent', 'delivered']
  } else if (eventType === 'email.opened') {
    target = 'opened'; allowed = ['sent', 'delivered', 'opened']; timestamps = { opened_at: now }
  } else if (eventType === 'email.bounced') {
    target = 'bounced'; allowed = ['sent', 'delivered', 'opened', 'failed', 'bounced']; timestamps = { bounced_at: now }
  } else if (eventType === 'email.complained') {
    target = 'complained'; allowed = ['sent', 'delivered', 'opened', 'failed', 'bounced', 'complained']; timestamps = { complained_at: now }
  } else if (eventType === 'email.failed' || eventType === 'email.suppressed') {
    target = 'failed'; allowed = ['sent', 'failed']
  }

  if (target && allowed.includes(current.data.status)) {
    const updated = await supabase.from('communications').update({ status: target, completed_at: now, ...timestamps })
      .eq('id', current.data.id).in('status', allowed).select('id').maybeSingle()
    if (updated.error || !updated.data) {
      await settleEvent('failed', 'COMMUNICATION_UPDATE_FAILED')
      return json({ ok: false, code: 'COMMUNICATION_UPDATE_FAILED' }, 503)
    }
  }

  const settled = await settleEvent('succeeded')
  if (settled.error) return json({ ok: false, code: 'WEBHOOK_SETTLEMENT_UNAVAILABLE' }, 503)
  return json({ ok: true, replayed: false }, 200)
})
