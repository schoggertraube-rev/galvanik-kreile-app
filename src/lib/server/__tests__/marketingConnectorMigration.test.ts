import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260715000700_marketing_connector_prepared_unapplied.sql'),
  'utf8'
)

describe('marketing connector migration', () => {
  it('creates a forced-RLS idempotency ledger with explicit state constraints', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.marketing_publish_job')
    expect(migration).toContain("'reserved', 'publishing', 'succeeded', 'failed', 'uncertain'")
    expect(migration).toContain('ALTER TABLE public.marketing_publish_job FORCE ROW LEVEL SECURITY')
    expect(migration).toContain('marketing_publish_job_action_uidx UNIQUE (tenant_id, aktion_id)')
    expect(migration).toContain('FOREIGN KEY (tenant_id, aktion_id)')
    expect(migration).toContain('FOREIGN KEY (tenant_id, asset_id)')
    expect(migration).toContain('FOREIGN KEY (tenant_id, kanal_id)')
    expect(migration).toContain('CONSTRAINT marketing_publish_job_status_chk')
    expect(migration).toContain('CONSTRAINT marketing_publish_job_attempt_count_chk')
    expect(migration).toContain('CONSTRAINT marketing_publish_job_error_code_chk')
    expect(migration).toContain("status <> 'succeeded' OR (external_container_id IS NOT NULL AND external_media_id IS NOT NULL)")
  })

  it('keeps browser roles and delete privileges outside the connector boundary', () => {
    expect(migration).toContain('FROM PUBLIC, anon, authenticated, service_role')
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE ON TABLE public.marketing_publish_job TO service_role')
    expect(migration).not.toMatch(/GRANT\s+(?:[^;]*,\s*)?DELETE/i)
    expect(migration).not.toMatch(/GRANT\s+ALL/i)
  })

  it('requires unique provider references and an explicit storage bucket', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS storage_bucket text')
    expect(migration).toContain('CREATE UNIQUE INDEX touchpoint_externe_ref_uidx')
    expect(migration).toContain('ON public.touchpoint (tenant_id, externe_ref)')
    expect(migration).toContain('Duplicate touchpoint.externe_ref values must be resolved')
  })

  it('binds every approved asset to one immutable item-photo upload receipt', () => {
    expect(migration).toContain('source_item_photo_job_id uuid')
    expect(migration).toContain('source_item_photo_uploaded_at timestamptz')
    expect(migration).toContain('item_photo_jobs_marketing_source_uidx')
    expect(migration).toContain('marketing_asset_source_pair_chk')
    expect(migration).toContain('marketing_asset_item_photo_source_fkey')
    expect(migration).toContain('FOREIGN KEY (')
    expect(migration).toContain('source_item_photo_job_id,')
    expect(migration).toContain('source_item_photo_uploaded_at')
    expect(migration).toContain('ON UPDATE RESTRICT')
    expect(migration).toContain('MARKETING_ASSET_SOURCE_IMMUTABLE')
    expect(migration).toContain('SECURITY INVOKER')
    expect(migration).not.toContain('SECURITY DEFINER')
    expect(migration).toContain('freigabe_marketing IS NOT TRUE OR ((')
    expect(migration).toContain(') IS TRUE)')
  })
})
