import { timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { kanal } from '@/db/schema_marketing'
import { eq } from 'drizzle-orm'
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
  try {
    await requireMarketingWrite()
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

  if (request.nextUrl.searchParams.has('error')) {
    return clearState(NextResponse.redirect(marketingRedirect(config.redirectUri, 'authorization_declined')))
  }
  if (!stateMatches(request.cookies.get(META_OAUTH_STATE_COOKIE)?.value, request.nextUrl.searchParams.get('state'))) {
    return clearState(NextResponse.redirect(marketingRedirect(config.redirectUri, 'invalid_state')))
  }

  const code = request.nextUrl.searchParams.get('code') || ''
  try {
    const shortToken = await exchangeMetaAuthorizationCode(config, code)
    const userToken = await exchangeLongLivedMetaToken(config, shortToken)
    const selected = selectMetaInstagramPage(config, await listMetaInstagramPages(config, userToken))
    const channels = await db.select().from(kanal).where(eq(kanal.typ, 'instagram')).limit(2)
    if (channels.length !== 1) throw new MetaInstagramError('META_CHANNEL_CONFIGURATION_INVALID', 'configuration')

    await db.update(kanal).set({
      verbunden: true,
      status: 'verbunden',
      accessTokenEncrypted: encryptMarketingToken(selected.pageAccessToken),
      config: {
        provider: 'meta',
        pageId: selected.pageId,
        pageName: selected.pageName,
        igUserId: selected.igUserId,
        graphVersion: config.graphVersion,
        connectedAt: new Date().toISOString(),
      },
    }).where(eq(kanal.id, channels[0].id))

    return clearState(NextResponse.redirect(marketingRedirect(config.redirectUri, 'connected')))
  } catch (error) {
    return clearState(NextResponse.redirect(marketingRedirect(config.redirectUri, errorResult(error))))
  }
}
