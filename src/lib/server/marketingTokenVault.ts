import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export type MarketingTokenContext = {
  tenantId: string
  channelId: string
}

function aad(context: MarketingTokenContext): Buffer {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(context.tenantId)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(context.channelId)) {
    throw new Error('MARKETING_TOKEN_CONTEXT_INVALID')
  }
  return Buffer.from(JSON.stringify(['marketing-channel', 2, context.tenantId, context.channelId]), 'utf8')
}

function encryptionKey(): Buffer {
  const configured = process.env.MARKETING_TOKEN_ENCRYPTION_KEY?.trim()
  if (!configured) throw new Error('MARKETING_TOKEN_ENCRYPTION_KEY_MISSING')
  const key = /^[0-9a-f]{64}$/i.test(configured)
    ? Buffer.from(configured, 'hex')
    : Buffer.from(configured, 'base64')
  if (key.byteLength !== 32) throw new Error('MARKETING_TOKEN_ENCRYPTION_KEY_INVALID')
  return key
}

export function assertMarketingTokenVaultConfigured(): void {
  void encryptionKey()
}

export function encryptMarketingToken(token: string, context: MarketingTokenContext): string {
  if (!token || token.length > 16_384) throw new Error('MARKETING_TOKEN_INVALID')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  cipher.setAAD(aad(context))
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v2', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.')
}

export function decryptMarketingToken(encrypted: string, context: MarketingTokenContext): string {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded, extra] = encrypted.split('.')
  if (version !== 'v2' || !ivEncoded || !tagEncoded || !ciphertextEncoded || extra) {
    throw new Error('MARKETING_TOKEN_CIPHERTEXT_INVALID')
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivEncoded, 'base64url'))
    decipher.setAAD(aad(context))
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    throw new Error('MARKETING_TOKEN_DECRYPT_FAILED')
  }
}
