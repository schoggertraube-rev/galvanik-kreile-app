import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/app/api/developer-feedback/route.ts'), 'utf8')

describe('developer feedback HTTP boundary', () => {
  it('authenticates, fixes tenant, and checks origin before body parsing', () => {
    expect(source.indexOf('await resolveAuthorization()')).toBeGreaterThan(-1)
    expect(source.indexOf('await request.text()')).toBeGreaterThan(source.indexOf('await resolveAuthorization()'))
    expect(source).toContain("authorization.data.tenantId !== 'galvanik-kreile'")
    expect(source).toContain('sameOrigin(request)')
    expect(source).not.toMatch(/input\.tenant|body\.tenant/i)
  })

  it('pseudonymizes actors, bounds payloads, and rate limits durably', () => {
    expect(source).toContain("createHmac('sha256', secret)")
    expect(source).toContain('10 * 1024')
    expect(source).toContain("namespace: 'developer-feedback'")
    expect(source).toContain('parseDeveloperFeedback')
  })

  it('confirms only a database receipt and supports idempotent retry', () => {
    expect(source).toContain('onConflictDoNothing')
    expect(source).toContain('receiptId: receipt.id')
    expect(source).toContain("status: 'stored'")
  })
})
