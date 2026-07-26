import { timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { kanal } from '@/db/schema_marketing'
import { and, eq } from 'drizzle-orm'
import { requireMarketingWrite } from '@/lib/server/marketingAuthorization'
import { encryptMarketingToken } from '@/lib/server/marketingTokenVault'
import {
  exchangeLongLivedMetaToken,
  exchangeMetaAuthorizationCode,
  getMetaInstagramConfig,
  listMetaInstagramPages,
  META_OAUTH_STATE_COOKIE,
  MetaInstagramError,
  selectMetaInstagramPage,
  verifyMetaOAuthState,
} from '@/lib/server/metaInstagram'

export const runtime = 'nodejs'

function stateMatches(expected: string | undefined, actual: string | null): boolean {
  if (!expected || !actual || expected.length !== actual.length || expected.length > 256) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
}

function marketingRedirect(redirectUri: string, result: string): URL {
  const callback = new URL(redirectUri)
  const destination = new URL('/marketing', callback.origin)
  destination.searchParams.set('instagram', result)
  return destination
}

function errorResult(error: unknown): string {
  if (!(error instanceof MetaInstagramError)) return 'connection_failed'
  if (error.code === 'META_PAGE_SELECTION_REQUIRED') return 'page_selection_required'
  if (error.code === 'META_CONFIGURED_PAGE_NOT_FOUND') return 'configured_page_not_found'
  return 'connection_failed'
}

export async function GET(request: NextRequest) {
  let config: ReturnType<typeof getMetaInstagramConfig>
  let actor: Awaited<ReturnType<typeof requireMarketingWrite>>
  try {
    actor = await requireMarketingWrite()
    config = getMetaInstagramConfig()
  } catch (error) {
    const configurationError = error instanceof MetaInstagramError && error.stage === 'configuration'
    return NextResponse.json(
      { ok: false, code: configurationError ? 'CONFIGURATION_MISSING' : 'FORBIDDEN' },
      { status: configurationError ? 503 : 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const clearState = (response: NextResponse) => {
    response.cookies.set(META_OAUTH_STATE_COOKIE, '', {
      httpOnly: true,
      secure: new URL(config.redirectUri).protocol === 'https:',
      sameSite: 'lax',
      maxAge: 0,
      path: '/api/marketing/instagram/callback',
    })
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  if (!stateMatches(request.cookies.get(META_OAUTH_STATE_COOKIE)?.value, request.nextUrl.searchParams.get('state'))) {
    return clearState(NextResponse.redirect(marketingRedirect(config.redirectUri, 'invalid_state')))
  }

  const code = request.nextUrl.searchParams.get('code') || ''
  try {
    // The callback may reconcile one quarantined channel shell, but only after
    // the signed state and provider exchange below succeed. No other active
    // read path treats that shell as verified.
    const channels = await db.select().from(kanal).where(and(
      eq(kanal.tenantId, actor.tenantId),
      eq(kanal.typ, 'instagram')
    )).limit(2)
    if (channels.length !== 1) throw new MetaInstagramError('META_CHANNEL_CONFIGURATION_INVALID', 'configuration')
    const state = request.nextUrl.searchParams.get('state') || ''
    if (!verifyMetaOAuthState(config, state, {
      tenantId: actor.tenantId,
      userId: actor.userId,
      channelId: channels[0].id,
    })) {
      return clearState(NextResponse.redirect(marketingRedirect(config.redirectUri, 'invalid_state')))
    }
    if (request.nextUrl.searchParams.has('error')) {
      return clearState(NextResponse.redirect(marketingRedirect(config.redirectUri, 'authorization_declined')))
    }

    const shortToken = await exchangeMetaAuthorizationCode(config, code)
    const userToken = await exchangeLongLivedMetaToken(config, shortToken)
    const selected = selectMetaInstagramPage(config, await listMetaInstagramPages(config, userToken))

    const updated = await db.update(kanal).set({
      // Provider page ownership plus a stored encrypted token is the receipt
      // that promotes this source into the active marketing graph.
      truthStatus: 'verified',
      verbunden: true,
      status: 'verbunden',
      accessTokenEncrypted: encryptMarketingToken(selected.pageAccessToken, {
        tenantId: actor.tenantId,
        channelId: channels[0].id,
      }),
      config: {
        provider: 'meta',
        pageId: selected.pageId,
        pageName: selected.pageName,
        igUserId: selected.igUserId,
        graphVersion: config.graphVersion,
        connectedAt: new Date().toISOString(),
      },
    }).where(and(
      eq(kanal.tenantId, actor.tenantId),
      eq(kanal.id, channels[0].id)
    )).returning({ id: kanal.id })
    if (updated.length !== 1) throw new Error('META_CHANNEL_UPDATE_RECEIPT_MISSING')

    return clearState(NextResponse.redirect(marketingRedirect(config.redirectUri, 'connected')))
  } catch (error) {
    return clearState(NextResponse.redirect(marketingRedirect(config.redirectUri, errorResult(error))))
  }
}
