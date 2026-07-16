import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_NAME, getSessionSecret, verifyAppSessionToken, type AppSession } from '@/lib/server/appSessionToken'
import { decideCurrentProxyIdentity, readCurrentAppUserStates } from '@/lib/server/proxySessionState'

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

  // Dev-only escape hatch; Preview und Production ignorieren den Cookie immer.
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.KREILE_ALLOW_DEV_AUTH_BYPASS === 'true' &&
    request.cookies.get('bypass-auth')?.value === 'true'
  ) {
    return supabaseResponse
  }

  const sessionToken = request.cookies.get(COOKIE_NAME)?.value
  let verifiedAppSession: AppSession | null = null
  if (sessionToken) {
    try {
      const verified = await verifyAppSessionToken(sessionToken, getSessionSecret())
      verifiedAppSession = verified.ok ? verified.session : null
    } catch {
      verifiedAppSession = null
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const candidateUserIds = [verifiedAppSession?.userId, user?.id]
    .filter((value): value is string => Boolean(value))
  const currentUsers = candidateUserIds.length > 0
    ? await readCurrentAppUserStates({
        supabaseUrl,
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        userIds: candidateUserIds,
      })
    : new Map()
  const identity = decideCurrentProxyIdentity({
    hadAppSessionCookie: Boolean(sessionToken),
    verifiedAppSession,
    supabaseUserId: user?.id ?? null,
    currentUsers,
  })
  const hasCurrentIdentity = identity.allowed

  if (identity.staleAppSession) {
    supabaseResponse.cookies.delete(COOKIE_NAME)
  }

  if (
    !hasCurrentIdentity &&
    !request.nextUrl.pathname.startsWith('/start') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/start'
    const response = NextResponse.redirect(url)
    if (identity.staleAppSession) response.cookies.delete(COOKIE_NAME)
    return response
  }

  // Verhindere, dass eingeloggte Nutzer die Start-Seite (Login) erneut aufrufen
  if (hasCurrentIdentity && request.nextUrl.pathname.startsWith('/start')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
