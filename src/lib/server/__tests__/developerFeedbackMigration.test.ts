import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260713000500_developer_feedback.sql'), 'utf8')
const route = readFileSync(resolve(process.cwd(), 'src/app/api/developer-feedback/route.ts'), 'utf8')
const schema = readFileSync(resolve(process.cwd(), 'src/db/schema.ts'), 'utf8')

describe('developer feedback migration', () => {
  it('creates a bounded store separate from marketing and telemetry payloads', () => {
    expect(migration).toContain('CREATE TABLE public.developer_feedback')
    expect(migration).toContain('developer_feedback_message_chk')
    expect(migration).not.toMatch(/payload\s+jsonb/i)
    expect(migration).not.toContain('feedback_eingang')
  })

  it('is append-only and server-only', () => {
    expect(migration).toContain('FORCE ROW LEVEL SECURITY')
    expect(migration).toContain('GRANT SELECT ON TABLE public.developer_feedback TO service_role')
    expect(migration).toContain('GRANT INSERT (')
    expect(migration).not.toMatch(/GRANT INSERT \([\s\S]*\bstatus\b[\s\S]*\) ON public\.developer_feedback/)
    expect(route).not.toContain("status: 'new'")
    expect(migration).not.toContain('GRANT UPDATE ON TABLE public.developer_feedback')
  })

  it('pins the complete PostgreSQL 17 catalog contract', () => {
    expect(migration).toContain('efc1a0101adfdb474aad32b1db6abfd2')
    expect(migration).toContain('5763760744112d926281c051452277df')
    expect(migration).toContain('31c9c745b6a5afec113c873c75917d6a')
    expect(migration).toContain('developer_feedback_tenant_fixed')
    expect(migration).toContain('NOT rolbypassrls OR rolcanlogin')
    expect(migration).toContain("has_table_privilege(role_record.oid, relation_oid, 'MAINTAIN')")
    expect(migration).toContain("'pg_write_all_data', 'pg_maintain'")
    expect(migration).toContain('constraint_record.conparentid')
    expect(migration).toContain('index_record.indislive')
    expect(migration).toContain('opclasses, collations, expressions, predicate')
    expect(migration).toContain("SELECT 1 FROM pg_policy WHERE polrelid = relation_oid")
    expect(migration).toContain('aclexplode(attribute_record.attacl)')
    expect(schema).toContain('check("developer_feedback_tenant_fixed"')
    expect(schema).toContain('unique("developer_feedback_actor_request_uidx")')
    expect(schema.match(/table\.createdAt\.desc\(\)/g)?.length).toBeGreaterThanOrEqual(2)
  })
})
