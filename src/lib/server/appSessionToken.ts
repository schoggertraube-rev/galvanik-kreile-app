// Edge-kompatibles, gemeinsames Sign/Verify-Modul der kanonischen App-Session.
//
// Bewusst OHNE `next/headers` und OHNE `node:crypto` — ausschliesslich Web Crypto
// (globalThis.crypto.subtle) plus TextEncoder/atob/btoa. Dadurch koennen proxy.ts
// (Edge/Middleware) und Server-Actions denselben Verifier verwenden (eine Wahrheit).
//
// Payload-Vertrag: { uid, role, tenant, initials, exp }. Secret aus KREILE_SESSION_SECRET.

export const COOKIE_NAME = "kreile_app_session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 Stunden
export const TENANT_ID = "galvanik-kreile";

export type AppSession = {
  uid: string;
  role: string;
  tenant: string;
  initials: string;
  exp: number; // Unix-Zeitstempel in ms
};

export type SessionVerificationResult =
  | { ok: true; session: AppSession }
  | { ok: false; reason: "MALFORMED" }
  | { ok: false; reason: "INVALID_SIGNATURE" }
  | { ok: false; reason: "EXPIRED" }
  | { ok: false; reason: "INVALID_TENANT" };

export function getSessionSecret(): string {
  const secret = process.env.KREILE_SESSION_SECRET;
  if (!secret) {
    throw new Error("KREILE_SESSION_SECRET is not configured.");
  }
  return secret;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// ─── base64url ohne Buffer (Edge-safe) ───────────────────────────────────────
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(input: string): Uint8Array | null {
  if (!input || /[^A-Za-z0-9\-_]/.test(input)) return null;
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLength);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function isValidSessionShape(value: unknown): value is AppSession {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.uid === "string" &&
    p.uid.length > 0 &&
    typeof p.role === "string" &&
    p.role.length > 0 &&
    typeof p.tenant === "string" &&
    p.tenant.length > 0 &&
    typeof p.initials === "string" &&
    typeof p.exp === "number" &&
    Number.isFinite(p.exp)
  );
}

/**
 * Deterministische Initialen aus einem Anzeigenamen.
 * Zwei Woerter -> erste Buchstaben; ein Wort -> erste zwei Zeichen.
 */
export function deriveSessionInitials(displayName: string): string {
  const trimmed = (displayName || "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase() || "?";
}

/**
 * Signiert eine AppSession zu `payloadB64url.signatureB64url`.
 * Reine Funktion (kein Cookie, keine DB). Async wegen Web Crypto.
 */
export async function signAppSession(session: AppSession, secret: string): Promise<string> {
  const payloadBytes = textEncoder.encode(JSON.stringify(session));
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, payloadBytes);
  return `${bytesToBase64Url(payloadBytes)}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

/**
 * Verifiziert Signatur + Tenant + Ablauf. Reihenfolge: Format -> Signatur ->
 * Payload-Form -> Tenant -> Expiry. Reine Funktion, async wegen Web Crypto.
 */
export async function verifyAppSessionToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): Promise<SessionVerificationResult> {
  const dotIndex = token.indexOf(".");
  if (dotIndex <= 0 || dotIndex === token.length - 1) {
    return { ok: false, reason: "MALFORMED" };
  }

  const payloadBytes = base64UrlToBytes(token.slice(0, dotIndex));
  const signatureBytes = base64UrlToBytes(token.slice(dotIndex + 1));
  if (!payloadBytes || !signatureBytes) {
    return { ok: false, reason: "MALFORMED" };
  }

  const key = await importSigningKey(secret);
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    new Uint8Array(signatureBytes),
    new Uint8Array(payloadBytes),
  );
  if (!isValid) {
    return { ok: false, reason: "INVALID_SIGNATURE" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textDecoder.decode(payloadBytes));
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }

  if (!isValidSessionShape(parsed)) {
    return { ok: false, reason: "MALFORMED" };
  }
  if (parsed.tenant !== TENANT_ID) {
    return { ok: false, reason: "INVALID_TENANT" };
  }
  if (now > parsed.exp) {
    return { ok: false, reason: "EXPIRED" };
  }

  return { ok: true, session: parsed };
}

export function getAppSessionCookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(expires ? { expires } : {}),
  };
}
