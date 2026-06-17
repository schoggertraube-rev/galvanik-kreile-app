import crypto from "crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "kreile_app_session";
const EXPIRATION_HOURS = 12;

export interface AppSessionPayload {
  role: string;
  tenantId: string;
  userId?: string;
  issuedAt: number;
  expiresAt: number;
}

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

function signPayload(payloadStr: string): string {
  return crypto.createHmac("sha256", getSecretKey()).update(payloadStr).digest("hex");
}

export async function createAppSessionCookie(role: string, userId?: string): Promise<void> {
  const now = Date.now();
  const expiresAt = now + EXPIRATION_HOURS * 60 * 60 * 1000;
  
  const payload: AppSessionPayload = {
    role,
    tenantId: "galvanik-kreile",
    userId,
    issuedAt: now,
    expiresAt,
  };
  
  const payloadStr = JSON.stringify(payload);
  const signature = signPayload(payloadStr);
  const token = `${Buffer.from(payloadStr).toString("base64")}.${signature}`;
  
  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function getAppSession(): Promise<AppSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  
  if (!token) return null;
  
  const [b64Payload, signature] = token.split(".");
  if (!b64Payload || !signature) return null;
  
  try {
    const payloadStr = Buffer.from(b64Payload, "base64").toString("utf8");
    const expectedSignature = signPayload(payloadStr);
    
    // Constant time comparison
    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      const payload: AppSessionPayload = JSON.parse(payloadStr);
      
      if (Date.now() > payload.expiresAt) {
        return null; // expired
      }
      return payload;
    }
  } catch (error) {
    console.warn("Session token parsing failed:", error);
  }
  
  return null;
}

export async function clearAppSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
