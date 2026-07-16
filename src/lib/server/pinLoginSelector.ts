import { getSessionSecret, TENANT_ID } from "@/lib/server/appSessionToken";

const SELECTOR_TTL_MS = 5 * 60 * 1000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type SelectorPayload = {
  purpose: "pin-login";
  uid: string;
  tenant: string;
  exp: number;
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decode(value: string): Uint8Array | null {
  if (!value || /[^A-Za-z0-9_-]/.test(value)) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function encryptionKey(): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    toArrayBuffer(encoder.encode(getSessionSecret())),
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function createPinLoginSelector(userId: string, now = Date.now()): Promise<string> {
  const payload: SelectorPayload = {
    purpose: "pin-login",
    uid: userId,
    tenant: TENANT_ID,
    exp: now + SELECTOR_TTL_MS,
  };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    await encryptionKey(),
    toArrayBuffer(encoder.encode(JSON.stringify(payload))),
  );
  return `${encode(iv)}.${encode(new Uint8Array(ciphertext))}`;
}

export async function verifyPinLoginSelector(
  selector: string,
  now = Date.now(),
): Promise<{ ok: true; userId: string } | { ok: false }> {
  const parts = selector.split(".");
  if (parts.length !== 2) return { ok: false };
  const iv = decode(parts[0]);
  const ciphertext = decode(parts[1]);
  if (!iv || iv.byteLength !== 12 || !ciphertext) return { ok: false };

  let payload: unknown;
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      await encryptionKey(),
      toArrayBuffer(ciphertext),
    );
    payload = JSON.parse(decoder.decode(plaintext));
  } catch {
    return { ok: false };
  }

  if (!payload || typeof payload !== "object") return { ok: false };
  const value = payload as Record<string, unknown>;
  if (
    value.purpose !== "pin-login" ||
    value.tenant !== TENANT_ID ||
    typeof value.uid !== "string" ||
    !value.uid ||
    typeof value.exp !== "number" ||
    now > value.exp
  ) {
    return { ok: false };
  }
  return { ok: true, userId: value.uid };
}
