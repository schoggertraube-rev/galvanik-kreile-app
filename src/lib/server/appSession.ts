import crypto from "crypto";
import { cookies } from "next/headers";

// ─── Kanonischer Cookie-Name ───────────────────────────────────────────────
export const COOKIE_NAME = "kreile_app_session";

// ─── TTL ───────────────────────────────────────────────────────────────────
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 Stunden

// ─── Cookie-Optionen (zentral – werden für set UND delete verwendet) ───────
function getCookieOptions(expiresAt?: Date): Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2] {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

// ─── Kanonischer Session-Typ ───────────────────────────────────────────────
export type AppSession = {
  userId: string;
  tenantId: string;
  role: string;
  displayName: string;
  issuedAt: number;
  expiresAt: number;
};

// Rückwärtskompatibles Alias
export type AppSessionPayload = AppSession;

// ─── Secret Key ────────────────────────────────────────────────────────────
function getSecretKey(): string {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CRITICAL: APP_SESSION_SECRET is not set in production!");
    }
    return "dev-secret-fallback-do-not-use-in-prod";
  }
  return secret;
}

// ─── Signatur ──────────────────────────────────────────────────────────────
function signPayload(payloadStr: string): string {
  return crypto.createHmac("sha256", getSecretKey()).update(payloadStr).digest("hex");
}

// ─── Token bauen ───────────────────────────────────────────────────────────
function encodeToken(session: AppSession): string {
  const payloadStr = JSON.stringify(session);
  const signature = signPayload(payloadStr);
  return `${Buffer.from(payloadStr).toString("base64")}.${signature}`;
}

// ─── Token lesen ───────────────────────────────────────────────────────────
function decodeToken(token: string): AppSession | null {
  const [b64Payload, signature] = token.split(".");
  if (!b64Payload || !signature) return null;

  try {
    const payloadStr = Buffer.from(b64Payload, "base64").toString("utf8");
    const expectedSignature = signPayload(payloadStr);

    // Längen müssen übereinstimmen für timingSafeEqual
    if (signature.length !== expectedSignature.length) return null;

    const sigOk = crypto.timingSafeEqual(
      Buffer.from(signature, "utf8"),
      Buffer.from(expectedSignature, "utf8"),
    );

    if (!sigOk) return null;

    const session: AppSession = JSON.parse(payloadStr);

    if (session.tenantId !== "galvanik-kreile") return null;
    if (Date.now() > session.expiresAt) return null;

    return session;
  } catch {
    // Kein Log – keine Session-Inhalte ausgeben
    return null;
  }
}

// ─── Kanonischer Setter ────────────────────────────────────────────────────
export async function setAppSession(session: AppSession): Promise<void> {
  const token = encodeToken(session);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, getCookieOptions(new Date(session.expiresAt)));
}

// ─── Kanonischer Leser ─────────────────────────────────────────────────────
export async function getAppSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decodeToken(token);
}

// ─── Kanonischer Löscher ───────────────────────────────────────────────────
export async function clearAppSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ─── Rückwärtskompatible Re-Exports ────────────────────────────────────────
/** @deprecated Verwende setAppSession() direkt */
export async function createAppSessionCookie(role: string, userId?: string): Promise<void> {
  const now = Date.now();
  await setAppSession({
    userId: userId ?? "",
    tenantId: "galvanik-kreile",
    role,
    displayName: userId ?? "",
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
}

/** @deprecated Verwende clearAppSession() direkt */
export async function clearAppSessionCookie(): Promise<void> {
  return clearAppSession();
}
