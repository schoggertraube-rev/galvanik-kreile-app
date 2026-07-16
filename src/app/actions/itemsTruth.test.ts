import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('item repository truth', () => {
  it('has no provider switch or generated fallback items', () => {
    const repository = readFileSync(resolve(process.cwd(), 'src/lib/repositories/itemsRepository.ts'), 'utf8')
    expect(repository).not.toContain('NEXT_PUBLIC_DATA_PROVIDER')
    expect(repository).not.toContain('createId')
    expect(repository).not.toContain('returning empty')
    expect(repository).not.toContain('mock item')
  })

  it('tenant-qualifies reads and quarantines standalone writes without an atomic receipt', () => {
    const actions = readFileSync(resolve(process.cwd(), 'src/app/actions/items.actions.ts'), 'utf8')
    expect(actions).toContain('eq(items.tenantId, actor.data.tenantId)')
    expect(actions).toContain('atomarer, idempotenter Rework-/Handling-Unit-Beleg')
    expect(actions).toContain('Wareneingangsgrenze, Idempotenz und Auditbeleg atomar verbunden')
    expect(actions).not.toContain('db.insert(items)')
    expect(actions).not.toContain('db.update(items)')
    expect(actions).not.toContain('db.delete(items)')
    expect(actions).not.toMatch(/data:\s*\{\s*id,\s*\.\.\.changes/)
  })

  it('does not expose direct deletion as a fake completed action', () => {
    const actions = readFileSync(resolve(process.cwd(), 'src/app/actions/items.actions.ts'), 'utf8')
    expect(actions).not.toContain('db.delete(items)')
    expect(actions).toContain('freigegebener Storno-/Auditablauf')
  })
})
