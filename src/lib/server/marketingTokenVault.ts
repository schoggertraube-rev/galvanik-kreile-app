import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const AAD = Buffer.from('galvanik-kreile:marketing-channel:v1', 'utf8')

function encryptionKey(): Buffer {
  const configured = process.env.MARKETING_TOKEN_ENCRYPTION_KEY?.trim()
  if (!configured) throw new Error('MARKETING_TOKEN_ENCRYPTION_KEY_MISSING')
  const key = /^[0-9a-f]{64}$/i.test(configured)
    ? Buffer.from(configured, 'hex')
    : Buffer.from(configured, 'base64')
  if (key.byteLength !== 32) throw new Error('MARKETING_TOKEN_ENCRYPTION_KEY_INVALID')
  return key
}

export function encryptMarketingToken(token: string): string {
  if (!token || token.length > 16_384) throw new Error('MARKETING_TOKEN_INVALID')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  cipher.setAAD(AAD)
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.')
}

export function decryptMarketingToken(encrypted: string): string {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded, extra] = encrypted.split('.')
  if (version !== 'v1' || !ivEncoded || !tagEncoded || !ciphertextEncoded || extra) {
    throw new Error('MARKETING_TOKEN_CIPHERTEXT_INVALID')
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivEncoded, 'base64url'))
    decipher.setAAD(AAD)
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    throw new Error('MARKETING_TOKEN_DECRYPT_FAILED')
  }
}
