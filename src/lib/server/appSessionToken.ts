import crypto from "crypto";

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

/**
 * Keeps the existing production token contract intact. Production deliberately
 * fails closed when the signing key is absent; only local development retains
 * the legacy fallback so isolated local tests can run without product secrets.
 */
export function getSessionSecret(): string {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CRITICAL: APP_SESSION_SECRET is not set in production!");
    }
    return "dev-secret-fallback-do-not-use-in-prod";
  }
  return secret;
}

export function signAppSession(session: AppSession, secret: string): string {
  const payload = JSON.stringify(session);
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64")}.${signature}`;
}

export function verifyAppSessionToken(
  token: string,
  secret: string,
  now = Date.now(),
): SessionVerificationResult {
  const dotIndex = token.indexOf(".");
  if (dotIndex <= 0 || dotIndex === token.length - 1) {
    return { ok: false, reason: "MALFORMED" };
  }

  const encodedPayload = token.slice(0, dotIndex);
  const suppliedSignature = token.slice(dotIndex + 1);
  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, "base64").toString("utf8");
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }

  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (suppliedSignature.length !== expectedSignature.length) {
    return { ok: false, reason: "INVALID_SIGNATURE" };
  }
  try {
    if (!crypto.timingSafeEqual(Buffer.from(suppliedSignature), Buffer.from(expectedSignature))) {
      return { ok: false, reason: "INVALID_SIGNATURE" };
    }
  } catch {
    return { ok: false, reason: "INVALID_SIGNATURE" };
  }

  let session: unknown;
  try {
    session = JSON.parse(payload);
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }
  if (!session || typeof session !== "object") return { ok: false, reason: "MALFORMED" };

  const value = session as Partial<AppSession>;
  if (
    typeof value.userId !== "string" ||
    typeof value.role !== "string" ||
    typeof value.tenantId !== "string" ||
    typeof value.displayName !== "string" ||
    typeof value.issuedAt !== "number" ||
    typeof value.expiresAt !== "number"
  ) {
    return { ok: false, reason: "MALFORMED" };
  }
  if (value.tenantId !== TENANT_ID) return { ok: false, reason: "INVALID_TENANT" };
  if (now > value.expiresAt) return { ok: false, reason: "EXPIRED" };

  return { ok: true, session: value as AppSession };
}
