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
    expect(migration).toContain('beleg_position_final_period_guard')
    expect(migration).toContain('kraftstoff_detail_final_period_guard')
    expect(migration).toContain('ausgangsrechnung_position_final_period_guard')
    expect(migration).toContain('orders_final_finance_period_guard')
    expect(migration).toContain('FOR SHARE')
  })

  it('binds replays to actor, action, entity, and the persisted result', () => {
    expect(migration).toContain('existing_actor <> p_actor')
    expect(migration).toContain("existing_entity_type <> 'periode'")
    expect(migration).toContain("existing_after->>'geschlossen_am'")
    expect(migration).toContain('existing_state_confirmed')
  })

  it('blocks unassigned monthly evidence instead of silently excluding it', () => {
    expect(migration).toMatch(/public\.beleg b[\s\S]*b\.periode_id IS NULL/)
    expect(migration).toMatch(/public\.ausgangsrechnung r[\s\S]*r\.periode_id IS NULL/)
    expect(migration).toContain("AT TIME ZONE 'Europe/Berlin'")
  })

  it('keeps period mutation behind the server-only function', () => {
    expect(migration).toContain('ALTER TABLE public.periode FORCE ROW LEVEL SECURITY')
    expect(migration).toContain('GRANT SELECT ON TABLE public.periode TO service_role')
    expect(migration).not.toContain('GRANT UPDATE ON TABLE public.periode TO service_role')
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.finance_close_period')
  })
})
