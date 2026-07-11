// Server-seitige Cookie-I/O-Schicht ueber dem edge-kompatiblen Kernmodul
// `appSessionToken`. Diese Datei importiert `next/headers` und darf daher NICHT
// aus der Middleware (proxy.ts) importiert werden — proxy.ts nutzt direkt
// `appSessionToken`. So teilen sich beide exakt EINEN Sign/Verify-Vertrag.

import { cookies } from "next/headers";
import {
  COOKIE_NAME,
  SESSION_TTL_MS,
  TENANT_ID,
  getSessionSecret,
  signAppSession,
  verifyAppSessionToken,
  getAppSessionCookieOptions,
  deriveSessionInitials,
  type AppSession,
  type SessionVerificationResult,
} from "@/lib/server/appSessionToken";

export {
  COOKIE_NAME,
  SESSION_TTL_MS,
  TENANT_ID,
  getSessionSecret,
  signAppSession,
  verifyAppSessionToken,
  deriveSessionInitials,
};
export type { AppSession, SessionVerificationResult };

export type SessionReadResult =
  | { ok: true; session: AppSession }
  | { ok: false; reason: "NO_COOKIE" }
  | { ok: false; reason: "MALFORMED" }
  | { ok: false; reason: "INVALID_SIGNATURE" }
  | { ok: false; reason: "EXPIRED" }
  | { ok: false; reason: "INVALID_TENANT" };

/** Liest und verifiziert die App-Session aus dem HttpOnly-Cookie. */
export async function readAppSession(): Promise<SessionReadResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return { ok: false, reason: "NO_COOKIE" };
  return verifyAppSessionToken(token, getSessionSecret());
}

/** Signiert die Session und setzt den HttpOnly-Cookie. */
export async function setAppSession(session: AppSession): Promise<void> {
  const token = await signAppSession(session, getSessionSecret());
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, getAppSessionCookieOptions(new Date(session.exp)));
}

/** Loescht den App-Session-Cookie. */
export async function clearAppSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
