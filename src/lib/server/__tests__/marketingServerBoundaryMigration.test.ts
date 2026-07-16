import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260715000600_marketing_server_boundary_prepared_unapplied.sql'),
  'utf8'
)

describe('marketing server boundary migration', () => {
  it('removes all browser policies and grants from the complete marketing graph', () => {
    for (const table of ['kampagne', 'kanal', 'segment', 'aktion', 'touchpoint', 'attribution', 'einwilligung', 'telemetrie_event']) {
      expect(migration).toContain(`'${table}'`)
    }
    expect(migration).toContain('FROM pg_policies')
    expect(migration).toContain('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY')
    expect(migration).toContain("FROM PUBLIC, anon, authenticated, service_role")
  })

  it('never restores delete or broad table access', () => {
    expect(migration).not.toMatch(/GRANT\s+DELETE/i)
    expect(migration).not.toMatch(/GRANT\s+ALL/i)
    expect(migration).toContain('GRANT SELECT, INSERT ON TABLE public.telemetrie_event TO service_role')
  })
})
