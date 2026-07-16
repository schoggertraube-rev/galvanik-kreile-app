import { cookies } from "next/headers";
import {
  COOKIE_NAME,
  SESSION_TTL_MS,
  TENANT_ID,
  getSessionSecret,
  signAppSession,
  verifyAppSessionToken,
  getAppSessionCookieOptions,
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
};
export type { AppSession, SessionVerificationResult };
export type AppSessionPayload = AppSession;

export type SessionReadResult =
  | { ok: true; session: AppSession }
  | { ok: false; reason: "NO_COOKIE" | "MALFORMED" | "INVALID_SIGNATURE" | "EXPIRED" | "INVALID_TENANT" };

export async function readAppSession(): Promise<SessionReadResult> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return { ok: false, reason: "NO_COOKIE" };
  return verifyAppSessionToken(token, getSessionSecret());
}

export async function setAppSession(session: AppSession): Promise<void> {
  const token = await signAppSession(session, getSessionSecret());
  (await cookies()).set(COOKIE_NAME, token, getAppSessionCookieOptions(new Date(session.expiresAt)));
}

export async function clearAppSession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

export async function getAppSession(): Promise<AppSession | null> {
  const result = await readAppSession();
  return result.ok ? result.session : null;
}
