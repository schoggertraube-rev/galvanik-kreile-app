import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260715001000_period_close_prepared_unapplied.sql'), 'utf8')

describe('period close migration', () => {
  it('uses a row lock, guarded transition, and permanent idempotency receipt', () => {
    expect(migration).toContain('FOR UPDATE')
    expect(migration).toContain('INVALID_PERIOD_TRANSITION')
    expect(migration).toContain('bh_audit_log_tenant_request_uidx')
    expect(migration).toContain('PERIOD_CLOSE_BLOCKED')
  })

  it('makes final-period finance records immutable', () => {
    expect(migration).toContain('FINAL_PERIOD_IMMUTABLE')
    expect(migration).toContain('beleg_final_period_guard')
    expect(migration).toContain('ausgangsrechnung_final_period_guard')
  })

  it('keeps period mutation behind the server-only function', () => {
    expect(migration).toContain('ALTER TABLE public.periode FORCE ROW LEVEL SECURITY')
    expect(migration).toContain('GRANT SELECT ON TABLE public.periode TO service_role')
    expect(migration).not.toContain('GRANT UPDATE ON TABLE public.periode TO service_role')
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.finance_close_period')
  })
})
