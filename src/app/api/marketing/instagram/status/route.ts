import { NextResponse } from 'next/server'
import { db } from '@/db'
import { kanal } from '@/db/schema_marketing'
import { and, eq } from 'drizzle-orm'
import { requireMarketingRead } from '@/lib/server/marketingAuthorization'
import { decryptMarketingToken } from '@/lib/server/marketingTokenVault'
import { metaInstagramIsConfigured } from '@/lib/server/metaInstagram'

export const runtime = 'nodejs'

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export async function GET() {
  let actor: Awaited<ReturnType<typeof requireMarketingRead>>
  try {
    actor = await requireMarketingRead()
  } catch {
    return NextResponse.json({ state: 'unavailable', configured: false, providerVerified: false }, {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  try {
    const channels = await db.select().from(kanal).where(and(
      eq(kanal.tenantId, actor.tenantId),
      eq(kanal.truthStatus, 'verified'),
      eq(kanal.typ, 'instagram')
    )).limit(2)
    const configured = metaInstagramIsConfigured()
    if (channels.length === 0) {
      return NextResponse.json({ state: configured ? 'not_connected' : 'not_configured', configured, providerVerified: false }, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }
    if (channels.length !== 1) {
      return NextResponse.json({ state: 'unavailable', configured, providerVerified: false }, {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      })
    }
    const channel = channels[0]
    const config = objectValue(channel.config)
    let tokenValid = false
    try {
      tokenValid = !!channel.accessTokenEncrypted && decryptMarketingToken(channel.accessTokenEncrypted, {
        tenantId: actor.tenantId,
        channelId: channel.id,
      }).length > 0
    } catch {
      return NextResponse.json({ state: 'unavailable', configured, providerVerified: false }, {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      })
    }
    const locallyConfigured = configured && channel.verbunden === true && channel.status === 'verbunden' && tokenValid &&
      typeof config.igUserId === 'string' && /^\d{5,32}$/.test(config.igUserId)
    return NextResponse.json({
      state: locallyConfigured ? 'configured_local' : configured ? 'not_connected' : 'not_configured',
      configured,
      providerVerified: false,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ state: 'unavailable', configured: false, providerVerified: false }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
