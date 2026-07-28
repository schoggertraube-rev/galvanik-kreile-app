import crypto from "crypto";

import { getSecretKey } from "@/lib/server/appSession";

export const PIN_LOGIN_SELECTOR_TTL_MS = 5 * 60 * 1000;

type SelectorPayload = {
  purpose: "pin-login";
  userId: string;
  tenantId: "galvanik-kreile";
  expiresAt: number;
};

function selectorKey(): Buffer {
  return crypto.createHash("sha256").update(getSecretKey()).digest();
}

function decodeBase64Url(value: string): Buffer | null {
  if (!value || value.length > 4096 || /[^A-Za-z0-9_-]/.test(value)) return null;

  try {
    const decoded = Buffer.from(value, "base64url");
    // Reject alternate base64url spellings that decode to the same bytes.
    // Otherwise a changed trailing character can leave an AES-GCM tag intact.
    return decoded.toString("base64url") === value ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Creates a short-lived, authenticated selector for the anonymous PIN screen.
 * The browser receives no primary user id, full name, or authorization role.
 */
export function createPinLoginSelector(userId: string, now = Date.now()): string {
  const payload: SelectorPayload = {
    purpose: "pin-login",
    userId,
    tenantId: "galvanik-kreile",
    expiresAt: now + PIN_LOGIN_SELECTOR_TTL_MS,
  };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", selectorKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${ciphertext.toString("base64url")}.${tag.toString("base64url")}`;
}

export function verifyPinLoginSelector(
  selector: string,
  now = Date.now(),
): { ok: true; userId: string } | { ok: false } {
  const parts = selector.split(".");
  if (parts.length !== 3) return { ok: false };

  const [ivEncoded, ciphertextEncoded, tagEncoded] = parts;
  const iv = decodeBase64Url(ivEncoded);
  const ciphertext = decodeBase64Url(ciphertextEncoded);
  const tag = decodeBase64Url(tagEncoded);
  if (!iv || iv.length !== 12 || !ciphertext || !tag || tag.length !== 16) {
    return { ok: false };
  }

  let payload: unknown;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", selectorKey(), iv);
    decipher.setAuthTag(tag);
    payload = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8"));
  } catch {
    return { ok: false };
  }

  if (!payload || typeof payload !== "object") return { ok: false };
  const value = payload as Partial<SelectorPayload>;
  if (
    value.purpose !== "pin-login" ||
    value.tenantId !== "galvanik-kreile" ||
    typeof value.userId !== "string" ||
    value.userId.length < 1 ||
    typeof value.expiresAt !== "number" ||
    now > value.expiresAt
  ) {
    return { ok: false };
  }

  return { ok: true, userId: value.userId };
}
