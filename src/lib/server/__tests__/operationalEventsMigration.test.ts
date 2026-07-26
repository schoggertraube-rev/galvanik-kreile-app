import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  OPERATIONAL_EVENT_STATUSES,
  PERSISTED_OPERATIONAL_EVENT_TYPES,
  SERVER_AND_LEGACY_OPERATIONAL_EVENT_TYPES,
} from '@/lib/events/operationalEventContract'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260715001200_operational_events_prepared_unapplied.sql'), 'utf8')
const sourceMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260715001150_operational_events_source_prepared_unapplied.sql'), 'utf8')
const schema = readFileSync(resolve(process.cwd(), 'src/db/schema.ts'), 'utf8')

function constraintValues(constraintName: string): string[] {
  const constraint = new RegExp(
    `${constraintName}[\\s\\S]*?CHECK \\([^)]*? IN \\(([\\s\\S]*?)\\)\\s*\\)`,
  ).exec(migration)?.[1]
  if (!constraint) return []
  return [...constraint.matchAll(/'([A-Za-z_]+)'/g)].map((match) => match[1])
}

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

  it('reconciles the nullable remote source before sealing it', () => {
    expect(sourceMigration).toMatch(/ALTER TABLE public\.events[\s\S]*ALTER COLUMN tenant_id SET NOT NULL/)
    expect(sourceMigration).toMatch(/ALTER TABLE public\.events[\s\S]*ALTER COLUMN order_id SET NOT NULL/)
    expect(sourceMigration).toMatch(/ALTER TABLE public\.events[\s\S]*ALTER COLUMN status SET NOT NULL/)
    expect(schema).toMatch(/tenantId: varchar\("tenant_id", \{ length: 50 \}\)\.notNull\(\)/)
    expect(schema).toMatch(/status: varchar\("status", \{ length: 50 \}\)\.notNull\(\)/)
  })

  it('allows every canonical, server-owned, payment, and retained legacy event type', () => {
    expect(new Set(constraintValues('events_type_allowlist_chk'))).toEqual(
      new Set(PERSISTED_OPERATIONAL_EVENT_TYPES),
    )
    expect(SERVER_AND_LEGACY_OPERATIONAL_EVENT_TYPES).toEqual(expect.arrayContaining([
      'ORDER_UPDATED',
      'ORDER_CANCELLED',
      'QUOTE_CREATED',
      'CUSTOMER_BEHAVIOR_NOTE_ADDED',
      'PAYMENT_FAILED',
      'PAYMENT_REVIEW_REQUIRED',
      'PAYMENT_PAID',
    ]))
  })

  it('constrains persisted status values to the statuses real writers use', () => {
    expect(new Set(constraintValues('events_status_allowlist_chk'))).toEqual(
      new Set(OPERATIONAL_EVENT_STATUSES),
    )
  })

  it('keeps evidence when an order deletion is attempted and bounds object payloads', () => {
    expect(sourceMigration).toContain('ON DELETE RESTRICT')
    expect(sourceMigration).not.toContain('ON DELETE CASCADE')
    expect(schema).toContain('references(() => orders.id, { onDelete: "restrict" })')
    expect(migration).toMatch(/jsonb_typeof\(payload\) = 'object'/)
    expect(migration).toContain('octet_length(payload::text) <= 8192')
  })
})
