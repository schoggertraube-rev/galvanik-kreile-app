"use server";

import { resolveAuthorization, type AuthorizationResult } from "@/lib/server/authorization";
import { setAppSession, SESSION_TTL_MS } from "@/lib/server/appSession";
import { verifyPinLogin } from "@/lib/server/pinAuth";

export async function getAuthorizationSnapshotAction(): Promise<AuthorizationResult> {
  return await resolveAuthorization();
}

export async function getRoleAction(): Promise<string | null> {
  const result = await resolveAuthorization();
  if (result.ok) {
    return result.data.role;
  }
  return null;
}

export async function getMyPermissionsAction() {
  const result = await resolveAuthorization();
  if (result.ok) {
    const initials = result.data.displayName
      .split(" ")
      .filter(Boolean)
      .map((n: string) => n[0])
      .join("")
      .toUpperCase();
    return {
      permissions: [...result.data.permissions],
      name: result.data.displayName,
      initials: initials || "?",
    };
  }
  return { permissions: [], name: "Unknown", initials: "?" };
}

/**
 * PIN-Login.
 * Setzt eine vollständige kanonische AppSession.
 */
export async function loginWithPin(
  userId: unknown,
  pin: unknown,
): Promise<
  | { ok: true; role: string }
  | { ok: false; message: string; retryAfterSeconds?: number }
> {
  try {
    const verification = await verifyPinLogin(userId, pin);
    if (!verification.ok) return verification;

    const now = Date.now();
    await setAppSession({
      userId: verification.identity.id,
      tenantId: verification.identity.tenantId,
      role: verification.identity.role,
      displayName: verification.identity.displayName,
      issuedAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });

    return { ok: true, role: verification.identity.role };
  } catch {
    // Drizzle errors may contain SQL parameters. Never log the error object here,
    // because a failed PIN query can otherwise disclose the submitted PIN.
    console.error("PIN login failed before a session could be created.");
    return { ok: false, message: "Server-Fehler beim Login." };
  }
}
