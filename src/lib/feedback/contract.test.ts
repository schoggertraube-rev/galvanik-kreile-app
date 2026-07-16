import { describe, expect, it } from 'vitest'
import { parseDeveloperFeedback } from '@/lib/feedback/contract'

const valid = {
  clientRequestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  route: '/buchhaltung/belege/:id',
  message: 'Bitte den gespeicherten Exportstatus zeigen.',
}

describe('developer feedback contract', () => {
  it('normalizes bounded explicit feedback', () => {
    expect(parseDeveloperFeedback({ ...valid, message: '  Zeile 1\r\nZeile 2  ' })).toEqual({ ...valid, message: 'Zeile 1\nZeile 2' })
  })

  it.each([
    { ...valid, userId: 'secret' },
    { ...valid, route: '/customers/customer-secret-identifier-123' },
    { ...valid, message: 'x' },
    { ...valid, message: 'a'.repeat(2_001) },
    { ...valid, message: 'abc\u0000def' },
  ])('rejects extra, identifying, or out-of-bounds input', (input) => {
    expect(() => parseDeveloperFeedback(input)).toThrow('INVALID_FEEDBACK')
  })
})
