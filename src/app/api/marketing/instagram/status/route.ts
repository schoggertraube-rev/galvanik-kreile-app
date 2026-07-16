import { NextResponse } from 'next/server'
import { db } from '@/db'
import { kanal } from '@/db/schema_marketing'
import { eq } from 'drizzle-orm'
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
  try {
    await requireMarketingRead()
    const channels = await db.select().from(kanal).where(eq(kanal.typ, 'instagram')).limit(2)
    const configured = metaInstagramIsConfigured()
    if (channels.length !== 1) {
      return NextResponse.json({ connected: false, configured }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const channel = channels[0]
    const config = objectValue(channel.config)
    let tokenValid = false
    try {
      tokenValid = !!channel.accessTokenEncrypted && decryptMarketingToken(channel.accessTokenEncrypted).length > 0
    } catch {
      tokenValid = false
    }
    const connected = configured && channel.verbunden === true && channel.status === 'verbunden' && tokenValid &&
      typeof config.igUserId === 'string' && /^\d{5,32}$/.test(config.igUserId)
    return NextResponse.json({ connected, configured }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ connected: false, configured: false }, {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
