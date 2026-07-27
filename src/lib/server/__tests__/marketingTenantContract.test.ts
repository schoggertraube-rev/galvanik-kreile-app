import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const tenantMigration = source(
  'supabase/migrations/20260715000575_marketing_tenant_relationships_prepared_unapplied.sql'
)
const sourceMigration = source(
  'supabase/migrations/20260715000550_marketing_source_contract_prepared_unapplied.sql'
)

describe('marketing tenant graph contract', () => {
  it('keeps provider measurements nullable and requires an explicit measurement receipt', () => {
    expect(sourceMigration).toContain('metrics_status text NOT NULL')
    expect(sourceMigration).toContain('metrics_measured_at timestamp without time zone')
    expect(sourceMigration).toContain('metrics_source text')
    expect(sourceMigration).toContain('revenue_status text NOT NULL')
    expect(sourceMigration).toContain('revenue_measured_at timestamp without time zone')
    expect(sourceMigration).toContain('revenue_source text')
    expect(sourceMigration).toContain('budget_status text NOT NULL')
    expect(sourceMigration).toContain('budget_measured_at timestamp without time zone')
    expect(sourceMigration).toContain('budget_source text')
    expect(sourceMigration).toContain('ALTER COLUMN reichweite DROP DEFAULT')
    expect(sourceMigration).toContain('ALTER COLUMN klicks DROP DEFAULT')
    expect(sourceMigration).toContain('ALTER COLUMN umsatz DROP DEFAULT')
    expect(sourceMigration).toContain('ALTER COLUMN kosten_budget DROP DEFAULT')
    expect(sourceMigration).toContain("  umsatz numeric(12,2),\n  revenue_status text NOT NULL DEFAULT 'not_measured'")
    expect(sourceMigration).toContain('touchpoint_measurement_truth_check')
    expect(sourceMigration).toContain('attribution_revenue_truth_check')
    expect(sourceMigration).toContain('aktion_budget_truth_check')
    expect(sourceMigration).not.toMatch(/reichweite integer NOT NULL DEFAULT 0/)
    expect(sourceMigration).not.toMatch(/klicks integer NOT NULL DEFAULT 0/)
  })

  it('quarantines every pre-contract marketing source row without deleting it', () => {
    expect(sourceMigration).toContain('legacy_marketing_source_quarantine')
    expect(sourceMigration).toContain("'kampagne', 'kanal', 'segment', 'aktion', 'lern_metrik'")
    expect(sourceMigration).toContain("'legacy_unverified'")
    expect(sourceMigration).toContain("'verified'")
    expect(sourceMigration).not.toMatch(/DELETE FROM public\.(kampagne|kanal|segment|aktion|lern_metrik)/)

    const marketingActions = source('src/app/marketing/marketing.actions.ts')
    const attributionActions = source('src/app/marketing/attribution/actions.ts')
    expect(marketingActions).toContain("eq(aktion.truthStatus, 'verified')")
    expect(marketingActions).toContain("eq(kampagne.truthStatus, 'verified')")
    expect(marketingActions).toContain("eq(segment.truthStatus, 'verified')")
    expect(marketingActions).toContain("eq(lernMetrik.truthStatus, 'verified')")
    expect(attributionActions).toContain("eq(kanal.truthStatus, 'verified')")
    expect(attributionActions).toContain("eq(aktion.truthStatus, 'verified')")
  })

  it('fails closed on orphaned or cross-tenant graph edges before replacing every relationship', () => {
    expect(tenantMigration).toContain('MARKETING_TENANT_RECONCILIATION_REQUIRED')
    expect(tenantMigration.match(/FOREIGN KEY \(tenant_id,/g)).toHaveLength(16)
    expect(tenantMigration).toContain('REFERENCES public.kampagne (tenant_id, id)')
    expect(tenantMigration).toContain('REFERENCES public.kanal (tenant_id, id)')
    expect(tenantMigration).toContain('REFERENCES public.segment (tenant_id, id)')
    expect(tenantMigration).toContain('REFERENCES public.touchpoint (tenant_id, id)')
    expect(tenantMigration).toContain('REFERENCES public.inquiries (tenant_id, id)')
    expect(tenantMigration).toContain('REFERENCES public.orders (tenant_id, id)')
    expect(tenantMigration).toContain('REFERENCES public.customers (tenant_id, id)')
    expect(tenantMigration).toContain('REFERENCES public.feedback_mail (tenant_id, id)')
  })

  it('mirrors the database tenant keys and foreign keys in the Drizzle schema', () => {
    const schema = source('src/db/schema_marketing.ts')
    expect(schema).not.toMatch(/\.references\(\(\) => (kampagne|kanal|segment|aktion|touchpoint|marketingAsset|feedbackMail)\.id/)
    expect(schema.match(/columns: \[table\.tenantId, table\./g)).toHaveLength(20)
    expect(schema).toContain('uniqueIndex("touchpoint_externe_ref_uidx").on(table.tenantId, table.externeRef)')
    expect(schema).toContain('uniqueIndex("marketing_publish_job_action_uidx").on(table.tenantId, table.aktionId)')
  })

  it('scopes every active marketing entry point with the authorized tenant', () => {
    const files = [
      'src/app/marketing/marketing.actions.ts',
      'src/app/marketing/analysis.actions.ts',
      'src/app/marketing/attribution/actions.ts',
      'src/app/marketing/aktion/actions.ts',
      'src/app/marketing/kanaele/actions.ts',
      'src/app/marketing/segmente/actions.ts',
      'src/app/marketing/einwilligungen/actions.ts',
      'src/app/api/marketing/instagram/callback/route.ts',
      'src/app/api/marketing/instagram/status/route.ts',
      'src/app/api/marketing/instagram/publish/route.ts',
      'src/app/api/cron/send-feedback/route.ts',
    ]

    for (const file of files) {
      const content = source(file)
      expect(content, file).toMatch(/\.tenantId/)
      expect(content, file).toMatch(/tenantId|TENANT_ID/)
    }
  })

  it('rejects malformed identifiers before querying UUID-backed marketing records', () => {
    const actions = source('src/app/marketing/aktion/actions.ts')
    const segments = source('src/app/marketing/segmente/actions.ts')

    expect(actions).toContain("if (!UUID_PATTERN.test(id)) throw new Error('MARKETING_ACTION_ID_INVALID')")
    expect(actions).toContain('[1-8][0-9a-f]{3}')
    expect(segments.match(/if \(!UUID_PATTERN\.test\(id\)\)/g)).toHaveLength(2)
    expect(segments).toContain("MARKETING_SEGMENT_ID_INVALID")
  })
})
