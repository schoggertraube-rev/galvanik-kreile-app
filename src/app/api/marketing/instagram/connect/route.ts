import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { kanal } from '@/db/schema_marketing'
import { requireMarketingWrite } from '@/lib/server/marketingAuthorization'
import { assertMarketingTokenVaultConfigured } from '@/lib/server/marketingTokenVault'
import {
  buildMetaAuthorizationUrl,
  createMetaOAuthState,
  getMetaInstagramConfig,
  META_OAUTH_STATE_COOKIE,
  MetaInstagramError,
} from '@/lib/server/metaInstagram'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const actor = await requireMarketingWrite()
    const config = getMetaInstagramConfig()
    assertMarketingTokenVaultConfigured()
    // Intentionally includes a quarantined pre-contract channel shell: an
    // explicit OAuth round-trip is the only path allowed to verify/promote it.
    // Status and publish reads remain verified-only.
    const channels = await db.select({ id: kanal.id }).from(kanal).where(and(
      eq(kanal.tenantId, actor.tenantId),
      eq(kanal.typ, 'instagram')
    )).limit(2)
    if (channels.length !== 1) {
      throw new MetaInstagramError('META_CHANNEL_CONFIGURATION_INVALID', 'configuration')
    }
    const state = createMetaOAuthState(config, {
      tenantId: actor.tenantId,
      userId: actor.userId,
      channelId: channels[0].id,
    })
    const response = NextResponse.redirect(buildMetaAuthorizationUrl(config, state))
    response.cookies.set(META_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: new URL(config.redirectUri).protocol === 'https:',
      sameSite: 'lax',
      maxAge: 10 * 60,
      path: '/api/marketing/instagram/callback',
    })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    const configurationError = (error instanceof MetaInstagramError && error.stage === 'configuration')
      || (error instanceof Error && error.message.startsWith('MARKETING_TOKEN_'))
    return NextResponse.json(
      { ok: false, code: configurationError ? 'CONFIGURATION_MISSING' : 'FORBIDDEN' },
      { status: configurationError ? 503 : 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
