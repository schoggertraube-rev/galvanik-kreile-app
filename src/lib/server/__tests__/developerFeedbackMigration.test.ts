import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260715001100_developer_feedback_prepared_unapplied.sql'), 'utf8')

describe('developer feedback migration', () => {
  it('creates a bounded store separate from marketing and telemetry payloads', () => {
    expect(migration).toContain('CREATE TABLE public.developer_feedback')
    expect(migration).toContain('developer_feedback_message_chk')
    expect(migration).not.toMatch(/payload\s+jsonb/i)
    expect(migration).not.toContain('feedback_eingang')
  })

  it('is append-only and server-only', () => {
    expect(migration).toContain('FORCE ROW LEVEL SECURITY')
    expect(migration).toContain('GRANT SELECT, INSERT ON TABLE public.developer_feedback TO service_role')
    expect(migration).not.toContain('GRANT UPDATE ON TABLE public.developer_feedback')
  })
})
