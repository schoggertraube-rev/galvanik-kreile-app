import { afterEach, describe, expect, it, vi } from 'vitest'
import { decryptMarketingToken, encryptMarketingToken } from '@/lib/server/marketingTokenVault'

describe('marketing token vault', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('round-trips a token without storing it in plaintext', () => {
    vi.stubEnv('MARKETING_TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'))
    const encrypted = encryptMarketingToken('page-access-token-secret')
    expect(encrypted).not.toContain('page-access-token-secret')
    expect(decryptMarketingToken(encrypted)).toBe('page-access-token-secret')
  })

  it('fails closed for a wrong key or malformed payload', () => {
    vi.stubEnv('MARKETING_TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 1).toString('base64'))
    const encrypted = encryptMarketingToken('secret')
    vi.stubEnv('MARKETING_TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 2).toString('base64'))
    expect(() => decryptMarketingToken(encrypted)).toThrow('MARKETING_TOKEN_DECRYPT_FAILED')
    expect(() => decryptMarketingToken('plaintext')).toThrow('MARKETING_TOKEN_CIPHERTEXT_INVALID')
  })
})
