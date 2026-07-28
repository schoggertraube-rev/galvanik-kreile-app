import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_NAME, getSessionSecret, verifyAppSessionToken, type AppSession } from "@/lib/server/appSessionToken";
import { allowsDevelopmentAuthBypass } from "@/lib/server/devAuthBypass";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Supabase env vars missing. Skipping auth proxy in development.");
      return NextResponse.next({ request });
    }
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  if (allowsDevelopmentAuthBypass({
    nodeEnv: process.env.NODE_ENV,
    explicitFlag: process.env.KREILE_ALLOW_DEV_AUTH_BYPASS,
    cookieValue: request.cookies.get("bypass-auth")?.value,
  })) {
    return supabaseResponse;
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  let appSession: AppSession | null = null;
  if (token) {
    try {
      const verification = verifyAppSessionToken(token, getSessionSecret());
      appSession = verification.ok ? verification.session : null;
    } catch {
      appSession = null;
    }
  }

  // Supabase may refresh its own cookie here, but it is not an authorization
  // fallback. Server Actions and protected routes have one canonical identity:
  // the verified Kreile app session.
  await supabase.auth.getUser();

  const hasVerifiedAppSession = appSession !== null;
  const mustClearInvalidSession = Boolean(token) && !hasVerifiedAppSession;
  if (mustClearInvalidSession) {
    supabaseResponse.cookies.delete(COOKIE_NAME);
  }

  if (
    !hasVerifiedAppSession &&
    !request.nextUrl.pathname.startsWith("/start") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/start";
    const response = NextResponse.redirect(url);
    if (mustClearInvalidSession) response.cookies.delete(COOKIE_NAME);
    return response;
  }

  if (hasVerifiedAppSession && request.nextUrl.pathname.startsWith("/start")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  const guardedDetailRoot = ["/buchhaltung", "/marketing", "/performance"].find(
    (root) => request.nextUrl.pathname.startsWith(`${root}/`),
  );
  if (guardedDetailRoot) {
    const url = request.nextUrl.clone();
    url.pathname = guardedDetailRoot;
    return NextResponse.redirect(url);
  }

  // These test dashboards are not a production capability. Hiding their entry
  // points is insufficient because their direct URL rendered fake analytics.
  if (process.env.NODE_ENV === "production" && request.nextUrl.pathname.startsWith("/admin/testanalyse")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
