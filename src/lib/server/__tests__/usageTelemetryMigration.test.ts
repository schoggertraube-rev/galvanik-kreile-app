import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260713000400_usage_telemetry.sql'), 'utf8')
const legacyContract = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260720000300_ui_events_contract_prepared_unapplied.sql'), 'utf8')
const schema = readFileSync(resolve(process.cwd(), 'src/db/schema.ts'), 'utf8')

describe('usage telemetry migration', () => {
  it('creates a structured event table without arbitrary payload JSON', () => {
    expect(migration).toContain('CREATE TABLE public.app_usage_events')
    expect(migration).toContain('query_length integer')
    expect(migration).toContain('result_count integer')
    expect(migration).not.toMatch(/app_usage_events[\s\S]{0,1000}\bpayload\s+jsonb/i)
  })

  it('is append-only and server-only', () => {
    expect(migration).toContain('ALTER TABLE public.app_usage_events FORCE ROW LEVEL SECURITY')
    expect(migration).toContain('GRANT SELECT ON TABLE public.app_usage_events TO service_role')
    expect(migration).toContain('GRANT INSERT (')
    expect(migration).toContain('occurred_at')
    expect(migration).not.toMatch(/GRANT INSERT \([\s\S]*received_at[\s\S]*\) ON public\.app_usage_events/)
    expect(migration).toContain("has_column_privilege(service_role_oid, relation_oid, 'received_at', 'INSERT')")
    expect(migration).not.toMatch(/GRANT\s+(?:[^;]*,\s*)?(?:UPDATE|DELETE|ALL)/i)
  })

  it('pins the complete PostgreSQL 17 catalog contract', () => {
    expect(migration).toContain('96329a27f16c1bbbac9763e7079f39e2')
    expect(migration).toContain('44fb44262bab6f001fea45c5921c3988')
    expect(migration).toContain('0d21423c3153c809e951c2a93b44287d')
    expect(migration).toContain('app_usage_events_tenant_fixed')
    expect(migration).toContain('NOT rolbypassrls OR rolcanlogin')
    expect(migration).toContain("has_table_privilege(role_record.oid, relation_oid, 'MAINTAIN')")
    expect(migration).toContain("'pg_write_all_data', 'pg_maintain'")
    expect(migration).toContain('constraint_record.conparentid')
    expect(migration).toContain('index_record.indislive')
    expect(migration).toContain('opclasses, collations, expressions, predicate')
    expect(migration).toContain("SELECT 1 FROM pg_policy WHERE polrelid = relation_oid")
    expect(migration).toContain('aclexplode(attribute_record.attacl)')
    expect(schema).toContain('check("app_usage_events_tenant_fixed"')
    expect(schema).toContain('unique("app_usage_events_tenant_client_uidx")')
    expect(schema.match(/table\.occurredAt\.desc\(\)/g)).toHaveLength(2)
  })

  it('keeps expand compatible and seals the legacy sink only in the later contract', () => {
    expect(migration).not.toContain("to_regclass('public.ui_events')")
    expect(migration).not.toContain('REVOKE ALL ON TABLE public.ui_events')
    expect(legacyContract).toContain("to_regclass('public.ui_events')")
    expect(legacyContract).toContain('ALTER TABLE public.ui_events FORCE ROW LEVEL SECURITY')
    expect(legacyContract).toContain('aclexplode(relation_record.relacl)')
    expect(legacyContract).toContain('unexpected legacy grants remain')
  })

  it('does not copy arbitrary legacy payloads into the typed event ledger', () => {
    expect(migration).not.toMatch(/insert\s+into\s+public\.app_usage_events[\s\S]*public\.ui_events/i)
    expect(legacyContract).not.toContain('app_usage_events')
  })
})
