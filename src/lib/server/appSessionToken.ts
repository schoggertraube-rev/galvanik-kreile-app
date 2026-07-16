export const COOKIE_NAME = "kreile_app_session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const TENANT_ID = "galvanik-kreile";

export type AppSession = {
  userId: string;
  tenantId: string;
  role: string;
  displayName: string;
  issuedAt: number;
  expiresAt: number;
};

export type SessionVerificationResult =
  | { ok: true; session: AppSession }
  | { ok: false; reason: "MALFORMED" | "INVALID_SIGNATURE" | "EXPIRED" | "INVALID_TENANT" };

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MIN_SESSION_SECRET_BYTES = 32;

function assertStrongSessionSecret(secret: string): string {
  if (encoder.encode(secret).byteLength < MIN_SESSION_SECRET_BYTES) {
    throw new Error("Session secret must contain at least 32 UTF-8 bytes.");
  }
  return secret;
}

export function getSessionSecret(): string {
  const secret = process.env.KREILE_SESSION_SECRET ?? process.env.APP_SESSION_SECRET;
  if (!secret) {
    throw new Error("KREILE_SESSION_SECRET or APP_SESSION_SECRET is not configured.");
  }
  return assertStrongSessionSecret(secret);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!value || /[^A-Za-z0-9_-]/.test(value)) return null;
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(assertStrongSessionSecret(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function isSession(value: unknown): value is AppSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.userId === "string" && session.userId.length > 0 &&
    typeof session.tenantId === "string" &&
    typeof session.role === "string" && session.role.length > 0 &&
    typeof session.displayName === "string" &&
    typeof session.issuedAt === "number" && Number.isFinite(session.issuedAt) &&
    typeof session.expiresAt === "number" && Number.isFinite(session.expiresAt)
  );
}

export async function signAppSession(session: AppSession, secret: string): Promise<string> {
  const payload = encoder.encode(JSON.stringify(session));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), payload);
  return `${bytesToBase64Url(payload)}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAppSessionToken(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<SessionVerificationResult> {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "MALFORMED" };
  const payload = base64UrlToBytes(parts[0]);
  const signature = base64UrlToBytes(parts[1]);
  if (!payload || !signature) return { ok: false, reason: "MALFORMED" };

  const valid = await crypto.subtle.verify(
    "HMAC",
    await signingKey(secret),
    new Uint8Array(signature),
    new Uint8Array(payload),
  );
  if (!valid) return { ok: false, reason: "INVALID_SIGNATURE" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(payload));
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }
  if (!isSession(parsed)) return { ok: false, reason: "MALFORMED" };
  if (parsed.tenantId !== TENANT_ID) return { ok: false, reason: "INVALID_TENANT" };
  if (now > parsed.expiresAt) return { ok: false, reason: "EXPIRED" };
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
