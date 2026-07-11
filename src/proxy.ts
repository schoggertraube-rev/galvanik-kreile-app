import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_NAME, getSessionSecret, verifyAppSessionToken } from '@/lib/server/appSessionToken'

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

  // Dev-only; Preview/Production ignorieren diesen Cookie.
  if (
    process.env.NODE_ENV === 'development' &&
    request.cookies.get('bypass-auth')?.value === 'true'
  ) {
    return supabaseResponse
  }

  // Signatur + Ablauf verifizieren (nicht bloss Cookie-Praesenz).
  // Fehlt das Secret (z. B. Preview vor Konfiguration), gilt: keine gueltige Session.
  let hasAppSession = false
  const appSessionToken = request.cookies.get(COOKIE_NAME)?.value
  if (appSessionToken) {
    try {
      const sessionResult = await verifyAppSessionToken(appSessionToken, getSessionSecret())
      hasAppSession = sessionResult.ok
    } catch {
      hasAppSession = false
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    !user && !hasAppSession &&
    !request.nextUrl.pathname.startsWith('/start') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/start'
    return NextResponse.redirect(url)
  }

  // Verhindere, dass eingeloggte Nutzer die Start-Seite (Login) erneut aufrufen
  if ((user || hasAppSession) && request.nextUrl.pathname.startsWith('/start')) {
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
