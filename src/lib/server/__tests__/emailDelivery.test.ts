import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/db', () => ({ db: {} }))

import { parseEmailDeliveryRequest } from '@/lib/server/emailDelivery'

describe('email delivery input contract', () => {
  it('normalizes a bounded, exact delivery request', () => {
    expect(parseEmailDeliveryRequest({
      to: ' KUNDE@example.com ',
      templateKey: 'status_update',
      variables: { customer_name: 'Kreile', order_number: 'A-1', status: 'Fertig' },
      orderId: 'order_1',
      customerId: 'customer_1',
      idempotencyKey: 'status/order_1/attempt_1',
    })).toEqual({
      to: 'kunde@example.com',
      templateKey: 'status_update',
      variables: { customer_name: 'Kreile', order_number: 'A-1', status: 'Fertig' },
      orderId: 'order_1',
      customerId: 'customer_1',
      idempotencyKey: 'status/order_1/attempt_1',
    })
  })

  it('rejects unknown fields, identifiers, and oversized variables', () => {
    const valid = {
      to: 'kunde@example.com',
      templateKey: 'status_update',
      variables: { status: 'Fertig' },
      idempotencyKey: 'status/order_1/attempt_1',
    }
    expect(() => parseEmailDeliveryRequest({ ...valid, tenantId: 'other' })).toThrow('INVALID_EMAIL_REQUEST')
    expect(() => parseEmailDeliveryRequest({ ...valid, orderId: '../other' })).toThrow('INVALID_EMAIL_REQUEST')
    expect(() => parseEmailDeliveryRequest({ ...valid, variables: { status: 'x'.repeat(2_001) } })).toThrow('INVALID_EMAIL_REQUEST')
  })
})

describe('email delivery wiring truth', () => {
  const nextRoute = readFileSync(resolve(process.cwd(), 'src/app/api/email/send/route.ts'), 'utf8')
  const edgeSender = readFileSync(resolve(process.cwd(), 'supabase/functions/email-send/index.ts'), 'utf8')
  const webhook = readFileSync(resolve(process.cwd(), 'supabase/functions/email-webhook/index.ts'), 'utf8')
  const cron = readFileSync(resolve(process.cwd(), 'src/app/api/cron/send-feedback/route.ts'), 'utf8')

  it('authorizes before parsing and sends only through the durable server helper', () => {
    expect(nextRoute.indexOf('resolveAuthorization()')).toBeLessThan(nextRoute.indexOf('request.json()'))
    expect(nextRoute).toContain('sendTemplatedEmail')
    expect(nextRoute).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('requires provider idempotency and a confirmed message ID', () => {
    expect(edgeSender).toContain("'Idempotency-Key'")
    expect(edgeSender).toContain('RESEND_MESSAGE_ID_INVALID')
    expect(edgeSender).toContain("status: 'sent', resend_message_id: messageId")
    expect(edgeSender).not.toContain('success: true')
  })

  it('verifies raw webhook signatures, freshness, and replay IDs', () => {
    expect(webhook).toContain('MAX_CLOCK_SKEW_SECONDS')
    expect(webhook).toContain('email_webhook_events')
    expect(webhook).toContain('data.email_id')
    expect(webhook).toContain('constantTimeEqual')
  })

  it('never marks feedback sent without the provider delivery receipt', () => {
    expect(cron).toContain('sendTemplatedEmail')
    expect(cron).toContain("if (result.ok)")
    expect(cron).not.toMatch(/Mock:|console\.log\(.*Sending feedback/i)
  })
})
