import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260715000500_finance_server_boundary_prepared_unapplied.sql'),
  'utf8'
)

describe('finance server boundary migration', () => {
  it('removes browser Data API policies and grants', () => {
    expect(migration).toContain('FROM pg_policies')
    expect(migration).toContain("'REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role'")
    expect(migration).toContain("AND grantee IN ('anon', 'authenticated')")
    expect(migration).toContain('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY')
  })

  it('restores only explicit non-delete service operations', () => {
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE ON TABLE public.beleg TO service_role')
    expect(migration).toContain('GRANT SELECT, INSERT ON TABLE public.bh_audit_log TO service_role')
    expect(migration).not.toMatch(/GRANT\s+DELETE/i)
    expect(migration).not.toMatch(/GRANT\s+ALL/i)
  })
})
