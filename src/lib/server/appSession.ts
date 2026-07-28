import { cookies } from "next/headers";

import {
  COOKIE_NAME,
  SESSION_TTL_MS,
  TENANT_ID,
  getSessionSecret,
  signAppSession,
  verifyAppSessionToken,
  type AppSession,
  type SessionVerificationResult,
} from "./appSessionToken";

export {
  COOKIE_NAME,
  SESSION_TTL_MS,
  TENANT_ID,
  signAppSession,
  verifyAppSessionToken,
};
export { getSessionSecret as getSecretKey };
export type { AppSession, SessionVerificationResult };

export type AppSessionPayload = AppSession;

export type SessionReadResult =
  | { ok: true; session: AppSession }
  | { ok: false; reason: "NO_COOKIE" }
  | Extract<SessionVerificationResult, { ok: false }>;

function getCookieOptions(expiresAt?: Date): Parameters<
  Awaited<ReturnType<typeof cookies>>["set"]
>[2] {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

export async function readAppSession(): Promise<SessionReadResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return { ok: false, reason: "NO_COOKIE" };
  return verifyAppSessionToken(token, getSessionSecret());
}

export async function setAppSession(session: AppSession): Promise<void> {
  const token = signAppSession(session, getSessionSecret());
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, getCookieOptions(new Date(session.expiresAt)));
}

export async function clearAppSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** @deprecated Use readAppSession() for typed error information. */
export async function getAppSession(): Promise<AppSession | null> {
  const result = await readAppSession();
  return result.ok ? result.session : null;
}

/** @deprecated Use setAppSession() directly. */
export async function createAppSessionCookie(role: string, userId?: string): Promise<void> {
  const now = Date.now();
  await setAppSession({
    userId: userId ?? "",
    tenantId: TENANT_ID,
    role,
    displayName: userId ?? "",
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
}

/** @deprecated Use clearAppSession() directly. */
export async function clearAppSessionCookie(): Promise<void> {
  return clearAppSession();
}
