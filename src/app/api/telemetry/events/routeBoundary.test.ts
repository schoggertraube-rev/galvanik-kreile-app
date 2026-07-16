import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/app/api/telemetry/events/route.ts'), 'utf8')

describe('usage telemetry HTTP boundary', () => {
  it('authenticates and fixes the tenant before reading the body', () => {
    expect(source.indexOf('await resolveAuthorization()')).toBeGreaterThan(-1)
    expect(source.indexOf('await readUtf8BodyWithinLimit(request')).toBeGreaterThan(source.indexOf('await resolveAuthorization()'))
    expect(source).toContain("authorization.data.tenantId !== 'galvanik-kreile'")
    expect(source).not.toMatch(/body\.tenant|event\.tenant/i)
  })

  it('bounds input and uses durable abuse protection', () => {
    expect(source).toContain('64 * 1024')
    expect(source).toContain('consumeDurableRateLimit')
    expect(source).toContain("namespace: 'usage-telemetry'")
  })

  it('pseudonymizes the actor and persists only the strict contract', () => {
    expect(source).toContain("createHmac('sha256', hmacSecret)")
    expect(source).toContain('parseUsageEventBatch')
    expect(source).not.toMatch(/payload\s*:/)
  })
})
