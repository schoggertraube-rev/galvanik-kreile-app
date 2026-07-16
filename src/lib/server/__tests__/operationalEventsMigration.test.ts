import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260715001200_operational_events_prepared_unapplied.sql'), 'utf8')

describe('operational events migration', () => {
  it('adds idempotency, tenant relations, and bounded types/payloads', () => {
    expect(migration).toContain('events_tenant_client_event_uidx')
    expect(migration).toContain('events_tenant_order_fk')
    expect(migration).toContain('events_tenant_item_fk')
    expect(migration).toContain('events_type_allowlist_chk')
    expect(migration).toContain('events_payload_size_chk')
  })

  it('is append-only and server-only', () => {
    expect(migration).toContain('ALTER TABLE public.events FORCE ROW LEVEL SECURITY')
    expect(migration).toContain('GRANT SELECT, INSERT ON TABLE public.events TO service_role')
    expect(migration).not.toContain('GRANT UPDATE ON TABLE public.events')
  })
})
