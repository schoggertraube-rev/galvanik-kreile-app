import { afterEach, describe, expect, it, vi } from 'vitest'
import { decryptMarketingToken, encryptMarketingToken } from '@/lib/server/marketingTokenVault'

const context = {
  tenantId: 'galvanik-kreile',
  channelId: '018f62ea-3d58-7a3f-91dc-ae957a22a054',
}

describe('marketing token vault', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('round-trips a token without storing it in plaintext', () => {
    vi.stubEnv('MARKETING_TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'))
    const encrypted = encryptMarketingToken('page-access-token-secret', context)
    expect(encrypted).not.toContain('page-access-token-secret')
    expect(decryptMarketingToken(encrypted, context)).toBe('page-access-token-secret')
    expect(() => decryptMarketingToken(encrypted, {
      ...context,
      channelId: '018f62ea-3d58-7a3f-91dc-ae957a22a055',
    })).toThrow('MARKETING_TOKEN_DECRYPT_FAILED')
    expect(() => decryptMarketingToken(encrypted, {
      ...context,
      tenantId: 'other-tenant',
    })).toThrow('MARKETING_TOKEN_DECRYPT_FAILED')
  })

  it('fails closed for a wrong key or malformed payload', () => {
    vi.stubEnv('MARKETING_TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 1).toString('base64'))
    const encrypted = encryptMarketingToken('secret', context)
    vi.stubEnv('MARKETING_TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 2).toString('base64'))
    expect(() => decryptMarketingToken(encrypted, context)).toThrow('MARKETING_TOKEN_DECRYPT_FAILED')
    expect(() => decryptMarketingToken('plaintext', context)).toThrow('MARKETING_TOKEN_CIPHERTEXT_INVALID')
    expect(() => decryptMarketingToken(encrypted, {
      tenantId: 'invalid/tenant',
      channelId: context.channelId,
    })).toThrow('MARKETING_TOKEN_DECRYPT_FAILED')
  })
})
