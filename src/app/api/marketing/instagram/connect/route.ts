import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { requireMarketingWrite } from '@/lib/server/marketingAuthorization'
import {
  buildMetaAuthorizationUrl,
  getMetaInstagramConfig,
  META_OAUTH_STATE_COOKIE,
  MetaInstagramError,
} from '@/lib/server/metaInstagram'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireMarketingWrite()
    const config = getMetaInstagramConfig()
    const state = randomBytes(32).toString('base64url')
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
    const configurationError = error instanceof MetaInstagramError && error.stage === 'configuration'
    return NextResponse.json(
      { ok: false, code: configurationError ? 'CONFIGURATION_MISSING' : 'FORBIDDEN' },
      { status: configurationError ? 503 : 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
