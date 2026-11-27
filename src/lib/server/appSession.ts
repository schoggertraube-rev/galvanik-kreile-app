import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import crypto from "crypto";
import { cookies, headers } from "next/headers";
import {CACHE_SCOPE_COOKIE} from '@/lib/offline/cacheScopeMarker';
import { readSessionInactivity, type SessionInactivity } from '@/lib/auth/sessionInactivity';
import type { Geraet } from '@/ui/kr/typen';

// ─── Konstanten ─────────────────────────────────────────────────────────────
export const COOKIE_NAME = "kreile_app_session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 Stunden
export function cacheScopeFromCredential(credential:string):string{return crypto.createHash('sha256').update('offline-cache:'+credential).digest('hex');}
export const APP_TENANT_ID = KREILE_TENANT_SLUG;

// ─── Secret Key ──────────────────────────────────────────────────────────────
export function getSecretKey(): string {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) throw new Error("APP_SESSION_SECRET_REQUIRED");
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
  lastSeen?: number;
  device?: Geraet;
  readScope?: string;
};

export function appSessionReadScope(token: string, session: AppSession): string {
  return session.readScope ?? cacheScopeFromCredential(token);
}

export function detectSessionDevice(agent: string): Geraet {
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(agent)) return 'tablet';
  if (/Android|iPhone|iPod|Mobile/i.test(agent)) return 'handy';
  return 'desktop';
}

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

  if (session.lastSeen !== undefined && (!Number.isSafeInteger(session.lastSeen)
    || session.lastSeen < session.issuedAt || session.lastSeen > session.expiresAt)) {
    return { ok: false, reason: "MALFORMED" };
  }
  if (session.device !== undefined && !['desktop', 'tablet', 'handy'].includes(session.device)) {
    return { ok: false, reason: "MALFORMED" };
  }
  if (session.readScope !== undefined && (typeof session.readScope !== 'string' || !/^[0-9a-f]{64}$/.test(session.readScope))) {
    return { ok: false, reason: "MALFORMED" };
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
export async function setAppSession(session: AppSession, tabletInput?: 'tablet'): Promise<void> {
  const cookieStore = await cookies();
  let device = session.device;
  if (!device) {
    try {
      const agent = (await headers()).get('user-agent');
      if (agent) device = detectSessionDevice(agent);
    } catch {
      console.error('[APP_SESSION_DEVICE_UNAVAILABLE]');
    }
    if (device === 'desktop' || device === undefined) {
      const previousToken = cookieStore.get(COOKIE_NAME)?.value;
      const previous = previousToken && verifyAppSessionToken(previousToken, getSecretKey());
      if (previous && previous.ok && previous.session.userId === session.userId
        && previous.session.tenantId === session.tenantId && previous.session.device === 'tablet') {
        device = 'tablet';
      }
    }
  }
  if ((device === 'desktop' || device === undefined) && tabletInput === 'tablet') device = 'tablet';
  const initialized = { ...session, device, lastSeen: session.lastSeen ?? session.issuedAt };
  const token = signAppSession(initialized, getSecretKey());
  cookieStore.set(COOKIE_NAME, token, getCookieOptions(new Date(session.expiresAt)));
  // Persistent reading fence, not a session lease. Offline contact age and
  // online authorization remain independently checked at their existing ports.
  cookieStore.set(CACHE_SCOPE_COOKIE,appSessionReadScope(token, initialized),{...getCookieOptions(),httpOnly:false,maxAge:365*24*60*60});
}

/** Updates only this signed session. The fixed end and its offline reading partition stay the same. */
export async function renewAppSessionActivity(
  identity: { userId: string; issuedAt: number },
  inactivity: SessionInactivity,
): Promise<SessionInactivity | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const now = Date.now();
  const secret = getSecretKey();
  const result = verifyAppSessionToken(token, secret, now);
  if (!result.ok || result.session.userId !== identity.userId
    || result.session.issuedAt !== identity.issuedAt) return null;

  const session = result.session;
  const allowed = readSessionInactivity(session, { minutes: inactivity.minutes });
  if (now >= allowed.expiresAt || now >= inactivity.expiresAt) return null;
  const minimumInterval = Math.min(30_000, inactivity.minutes * 10_000);
  if (now - allowed.lastSeen < minimumInterval) return { ...allowed, serverAt: now };

  const renewed = { ...session, lastSeen: now, readScope: appSessionReadScope(token, session) };
  cookieStore.set(COOKIE_NAME, signAppSession(renewed, secret), getCookieOptions(new Date(session.expiresAt)));
  return { ...readSessionInactivity(renewed, { minutes: inactivity.minutes }), serverAt: now };
}

// ─── Cookie I/O: Löschen ────────────────────────────────────────────────────
export async function clearAppSession(): Promise<void> {
  const cookieStore = await cookies();
  try{cookieStore.delete(COOKIE_NAME);}finally{cookieStore.delete(CACHE_SCOPE_COOKIE);}
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
