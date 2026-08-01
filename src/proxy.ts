import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  COOKIE_NAME,
  getSecretKey,
  verifyAppSessionToken,
} from '@/lib/server/appSession'

const LEGACY_AUTH_COOKIES = ['bypass-auth', 'kreile_role'] as const

function expireCookie(
  response: NextResponse,
  request: NextRequest,
  name: string,
) {
  response.cookies.set({
    name,
    value: '',
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  })
}

function withAuthCookieCleanup(
  response: NextResponse,
  request: NextRequest,
  clearInvalidAppSession: boolean,
) {
  for (const cookieName of LEGACY_AUTH_COOKIES) {
    if (request.cookies.has(cookieName)) {
      expireCookie(response, request, cookieName)
    }
  }

  if (clearInvalidAppSession) {
    expireCookie(response, request, COOKIE_NAME)
  }

  return response
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Supabase env vars missing. Skipping auth proxy in development.')
      return NextResponse.next({ request })
    }

    throw new Error('Missing Supabase environment variables')
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const appSessionToken = request.cookies.get(COOKIE_NAME)?.value
  let hasValidAppSession = false

  if (appSessionToken) {
    try {
      hasValidAppSession = verifyAppSessionToken(
        appSessionToken,
        getSecretKey(),
      ).ok
    } catch {
      // Fail closed when session verification is unavailable.
      hasValidAppSession = false
    }
  }

  const clearInvalidAppSession = Boolean(appSessionToken) && !hasValidAppSession

  // Keep an existing Supabase session fresh, but never use it as the app-level
  // authorization source. Both PIN and e-mail login create the canonical,
  // tenant-bound app session before entering protected routes.
  const hasSupabaseAuthCookie = request.cookies
    .getAll()
    .some(({ name }) => name.startsWith('sb-') && name.includes('-auth-token'))

  if (hasSupabaseAuthCookie) {
    try {
      await supabase.auth.getUser()
    } catch {
      // The signed app session remains authoritative when refresh is unavailable.
    }
  }

  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')

  if (isApiRoute && !hasValidAppSession) {
    return withAuthCookieCleanup(
      NextResponse.json(
        { error: 'UNAUTHORIZED' },
        { status: 401 },
      ),
      request,
      clearInvalidAppSession,
    )
  }

  if (
    !hasValidAppSession &&
    !request.nextUrl.pathname.startsWith('/start') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/start'
    return withAuthCookieCleanup(
      NextResponse.redirect(url),
      request,
      clearInvalidAppSession,
    )
  }

  // Verhindere, dass eingeloggte Nutzer die Start-Seite (Login) erneut aufrufen
  if (hasValidAppSession && request.nextUrl.pathname.startsWith('/start')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return withAuthCookieCleanup(
      NextResponse.redirect(url),
      request,
      clearInvalidAppSession,
    )
  }

  return withAuthCookieCleanup(
    supabaseResponse,
    request,
    clearInvalidAppSession,
  )
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
