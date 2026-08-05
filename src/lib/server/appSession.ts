import crypto from "crypto";
import { cookies } from "next/headers";

// ─── Konstanten ─────────────────────────────────────────────────────────────
export const COOKIE_NAME = "kreile_app_session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 Stunden
export const APP_TENANT_ID = "galvanik-kreile";

// ─── Secret Key ──────────────────────────────────────────────────────────────
export function getSecretKey(): string {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CRITICAL: APP_SESSION_SECRET is not set in production!");
    }
    return "dev-secret-fallback-do-not-use-in-prod";
  }
  return secret;
}

// ─── Kanonischer Session-Typ ─────────────────────────────────────────────────
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

// ─── Typisierte Ergebnistypen ────────────────────────────────────────────────
export type SessionVerificationResult =
  | { ok: true; session: AppSession }
  | { ok: false; reason: "MALFORMED" }
  | { ok: false; reason: "INVALID_SIGNATURE" }
  | { ok: false; reason: "EXPIRED" }
  | { ok: false; reason: "INVALID_TENANT" };

export type SessionReadResult =
  | { ok: true; session: AppSession }
  | { ok: false; reason: "NO_COOKIE" }
  | { ok: false; reason: "MALFORMED" }
  | { ok: false; reason: "INVALID_SIGNATURE" }
  | { ok: false; reason: "EXPIRED" }
  | { ok: false; reason: "INVALID_TENANT" };

// ─── Cookie-Optionen ──────────────────────────────────────────────────────────
// Zentrale Konfiguration – wird beim Setzen UND Löschen verwendet.
function getCookieOptions(expiresAt?: Date): Parameters<
  Awaited<ReturnType<typeof cookies>>["set"]
>[2] {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

// ─── Pure Funktion: Session signieren ────────────────────────────────────────
/**
 * Baut einen signierten Token aus einer AppSession.
 * Reine Funktion – kein Next.js, keine Datenbank.
 */
export function signAppSession(session: AppSession, secret: string): string {
  const payloadStr = JSON.stringify(session);
  const sig = crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");
  return `${Buffer.from(payloadStr).toString("base64")}.${sig}`;
}

// ─── Pure Funktion: Token verifizieren ───────────────────────────────────────
/**
 * Verifiziert einen signierten Token und gibt einen typisierten Grund zurück.
 * Reine Funktion – kein Next.js, keine Datenbank, kein Logging.
 *
 * @param token  - Das `base64.signature`-Token aus dem Cookie.
 * @param secret - Das HMAC-Secret (nie produktives Secret in Tests verwenden).
 * @param now    - Unix-Zeitstempel in ms, Standard: Date.now().
 */
export function verifyAppSessionToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): SessionVerificationResult {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1 || dotIndex === 0 || dotIndex === token.length - 1) {
    return { ok: false, reason: "MALFORMED" };
  }

  const b64 = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);

  let payloadStr: string;
  try {
    payloadStr = Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payloadStr)
    .digest("hex");

  // Längenprüfung vor timingSafeEqual (Pflicht: gleiche Länge erforderlich)
  if (sig.length !== expectedSig.length) {
    return { ok: false, reason: "INVALID_SIGNATURE" };
  }

  try {
    const sigOk = crypto.timingSafeEqual(
      Buffer.from(sig, "utf8"),
      Buffer.from(expectedSig, "utf8"),
    );
    if (!sigOk) return { ok: false, reason: "INVALID_SIGNATURE" };
  } catch {
    return { ok: false, reason: "INVALID_SIGNATURE" };
  }

  let session: AppSession;
  try {
    session = JSON.parse(payloadStr) as AppSession;
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }

  if (
    !session ||
    typeof session.userId !== "string" ||
    typeof session.role !== "string" ||
    typeof session.tenantId !== "string"
  ) {
    return { ok: false, reason: "MALFORMED" };
  }

  if (session.tenantId !== APP_TENANT_ID) {
    return { ok: false, reason: "INVALID_TENANT" };
  }

  if (now > session.expiresAt) {
    return { ok: false, reason: "EXPIRED" };
  }

  return { ok: true, session };
}

// ─── Cookie I/O: Lesen (typisiert) ──────────────────────────────────────────
/**
 * Liest die App-Session aus dem Cookie und gibt einen typisierten Grund zurück.
 * Kein Logging von Session-Inhalten oder Secrets.
 */
export async function readAppSession(): Promise<SessionReadResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return { ok: false, reason: "NO_COOKIE" };
  return verifyAppSessionToken(token, getSecretKey());
}

// ─── Cookie I/O: Setzen ──────────────────────────────────────────────────────
export async function setAppSession(session: AppSession): Promise<void> {
  const token = signAppSession(session, getSecretKey());
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, getCookieOptions(new Date(session.expiresAt)));
}

// ─── Cookie I/O: Löschen ────────────────────────────────────────────────────
export async function clearAppSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ─── Backward-compat: getAppSession() ────────────────────────────────────────
/** @deprecated Verwende readAppSession() für typisierte Fehlergründe */
export async function getAppSession(): Promise<AppSession | null> {
  const result = await readAppSession();
  return result.ok ? result.session : null;
}

// ─── Backward-compat: createAppSessionCookie / clearAppSessionCookie ─────────
/** @deprecated Verwende setAppSession() direkt */
export async function createAppSessionCookie(role: string, userId?: string): Promise<void> {
  const now = Date.now();
  await setAppSession({
    userId: userId ?? "",
    tenantId: APP_TENANT_ID,
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
