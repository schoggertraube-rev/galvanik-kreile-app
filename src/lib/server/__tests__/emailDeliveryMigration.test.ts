import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260715000800_email_delivery_ledger_prepared_unapplied.sql'),
  'utf8'
)

describe('email delivery migration', () => {
  it('adds permanent request and provider idempotency', () => {
    expect(migration).toContain('communications_tenant_idempotency_uidx')
    expect(migration).toContain('communications_resend_message_uidx')
    expect(migration).toContain('communications_sent_provider_id_chk')
    expect(migration).toContain("'uncertain'")
  })

  it('seals templates, delivery records, and webhook audit behind the server role', () => {
    expect(migration).toContain("ARRAY['communications', 'email_templates', 'email_webhook_events']")
    expect(migration).toContain('FORCE ROW LEVEL SECURITY')
    expect(migration).toContain('FROM PUBLIC, anon, authenticated, service_role')
    expect(migration).not.toMatch(/GRANT\s+(?:[^;]*,\s*)?DELETE/i)
    expect(migration).not.toMatch(/GRANT\s+ALL/i)
  })

  it('provides real, placeholder-complete status and feedback templates', () => {
    expect(migration).toContain("'status_update'")
    expect(migration).toContain("'feedback_request'")
    expect(migration).toContain("'[\"customer_name\", \"order_number\", \"status\"]'::jsonb")
  })
})
