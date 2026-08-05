import crypto from "node:crypto";
import { APP_TENANT_ID, getSecretKey } from "@/lib/server/appSession";

const PIN_LOGIN_HANDLE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type PinLoginCandidate = {
  id: string;
};

export function createPinLoginHandle(userId: string): string {
  return crypto
    .createHmac("sha256", getSecretKey())
    .update(`pin-login:${APP_TENANT_ID}:${userId}`)
    .digest("base64url");
}

export function isValidPinLoginHandle(loginHandle: unknown): loginHandle is string {
  return (
    typeof loginHandle === "string" &&
    PIN_LOGIN_HANDLE_PATTERN.test(loginHandle)
  );
}

export function matchesPinLoginHandle(loginHandle: string, userId: string): boolean {
  if (!isValidPinLoginHandle(loginHandle)) return false;

  const expected = createPinLoginHandle(userId);
  return crypto.timingSafeEqual(
    Buffer.from(loginHandle, "utf8"),
    Buffer.from(expected, "utf8"),
  );
}

export function resolvePinLoginCandidate<T extends PinLoginCandidate>(
  loginHandle: string,
  candidates: readonly T[],
): T | undefined {
  if (!isValidPinLoginHandle(loginHandle)) return undefined;
  return candidates.find((candidate) =>
    matchesPinLoginHandle(loginHandle, candidate.id),
  );
}
