import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('Instagram connector truth boundary', () => {
  it('contains no browser token storage, implicit flow, placeholder media or hardcoded Graph version', () => {
    const adapter = source('src/lib/marketing/adapters/InstagramAdapter.ts')
    const client = source('src/app/marketing/MarketingStudioClient.tsx')
    expect(adapter + client).not.toContain('localStorage')
    expect(adapter + client).not.toContain('access_token')
    expect(adapter + client).not.toContain('via.placeholder.com')
    expect(adapter + client).not.toMatch(/graph\.facebook\.com\/v\d+/)
    expect(adapter + client).not.toContain('NEXT_PUBLIC_META_APP_ID')
  })

  it('authorizes before parsing publish input and requires durable idempotency', () => {
    const publish = source('src/app/api/marketing/instagram/publish/route.ts')
    expect(publish.indexOf('await requireMarketingWrite()')).toBeLessThan(publish.indexOf('await request.json()'))
    expect(publish).toContain('reservePublishJob')
    expect(publish).toContain("status: 'uncertain'")
    expect(publish).toContain("record.actionStatus !== 'freigegeben'")
    expect(publish).toContain('asset.freigabeMarketing !== true')
  })

  it('uses an HttpOnly state cookie and never returns provider tokens', () => {
    const connect = source('src/app/api/marketing/instagram/connect/route.ts')
    const callback = source('src/app/api/marketing/instagram/callback/route.ts')
    const status = source('src/app/api/marketing/instagram/status/route.ts')
    expect(connect).toContain('httpOnly: true')
    expect(connect).toContain("sameSite: 'lax'")
    expect(callback).toContain('timingSafeEqual')
    expect(status).not.toContain('pageAccessToken')
    expect(status).not.toContain('accessTokenEncrypted:')
  })

  it('binds OAuth and token ciphertext to the authorized tenant, user and channel', () => {
    const connect = source('src/app/api/marketing/instagram/connect/route.ts')
    const callback = source('src/app/api/marketing/instagram/callback/route.ts')
    const status = source('src/app/api/marketing/instagram/status/route.ts')
    const publish = source('src/app/api/marketing/instagram/publish/route.ts')

    expect(connect).toContain('createMetaOAuthState(config, {')
    expect(connect).toContain('tenantId: actor.tenantId')
    expect(connect).toContain('userId: actor.userId')
    expect(connect).toContain('channelId: channels[0].id')
    expect(callback).toContain('verifyMetaOAuthState(config, state, {')
    expect(callback).toContain('encryptMarketingToken(selected.pageAccessToken, {')
    expect(status).toContain('decryptMarketingToken(channel.accessTokenEncrypted, {')
    expect(publish).toContain('decryptMarketingToken(record.accessTokenEncrypted, {')
  })

  it('requires tenant-owned item-photo evidence and a CAS receipt around provider publication', () => {
    const publish = source('src/app/api/marketing/instagram/publish/route.ts')

    expect(publish).toContain("bucket !== 'item-photos'")
    expect(publish).toContain('path.startsWith(`${tenantId}/${orderId}/`)')
    expect(publish).toContain("'PUBLISH_EVIDENCE_MISSING'")
    expect(publish).toContain("eq(aktion.status, 'freigegeben')")
    expect(publish).toContain('PUBLISH_ACTION_STATE_CONFLICT_AFTER_PROVIDER')
  })
})
