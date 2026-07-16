import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260715000900_usage_telemetry_prepared_unapplied.sql'), 'utf8')

describe('usage telemetry migration', () => {
  it('creates a structured event table without arbitrary payload JSON', () => {
    expect(migration).toContain('CREATE TABLE public.app_usage_events')
    expect(migration).toContain('query_length integer')
    expect(migration).toContain('result_count integer')
    expect(migration).not.toMatch(/app_usage_events[\s\S]{0,1000}\bpayload\s+jsonb/i)
  })

  it('is append-only and server-only', () => {
    expect(migration).toContain('ALTER TABLE public.app_usage_events FORCE ROW LEVEL SECURITY')
    expect(migration).toContain('GRANT SELECT, INSERT ON TABLE public.app_usage_events TO service_role')
    expect(migration).not.toMatch(/GRANT\s+(?:[^;]*,\s*)?(?:UPDATE|DELETE|ALL)/i)
  })

  it('seals rather than trusting the legacy arbitrary event sink', () => {
    expect(migration).toContain("to_regclass('public.ui_events')")
    expect(migration).toContain('REVOKE ALL ON TABLE public.ui_events')
  })
})
