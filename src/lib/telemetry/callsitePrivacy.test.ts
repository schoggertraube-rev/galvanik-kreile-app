import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('usage telemetry callsites', () => {
  it('records search shape and result counts without the raw search term', () => {
    const orders = source('src/app/orders/page.tsx')
    const call = orders.match(/trackUiEvent\("search",\s*\{[\s\S]*?\}\);/)?.[0] || ''
    expect(call).toContain('queryLength')
    expect(call).toContain('resultCount')
    expect(call).not.toMatch(/term\s*[:,]|query\s*[:,]|customer|orderNumber/i)
  })

  it('uses category targets rather than entity identifiers', () => {
    for (const path of ['src/app/customers/page.tsx', 'src/app/items/page.tsx', 'src/app/orders/page.tsx']) {
      const calls = source(path).match(/trackUiEvent\([\s\S]*?\);/g) || []
      expect(calls.join('\n')).not.toMatch(/target:\s*(?:customer|item|order)\.id/)
    }
  })
})
