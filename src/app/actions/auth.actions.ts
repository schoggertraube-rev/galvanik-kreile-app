"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { setAppSession, SESSION_TTL_MS } from "@/lib/server/appSession";
import { resolveAuthorization, type AuthorizationResult } from "@/lib/server/authorization";
import {
  checkPinRateLimit,
  recordFailedPinAttempt,
  resetPinRateLimit,
} from "@/lib/server/pinRateLimit";

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

async function verifyAndMigratePin(
  user: { id: string; pinHash: string | null },
  pin: string,
): Promise<boolean> {
  if (!user.pinHash) return false;

  if (user.pinHash.startsWith("$2")) {
    return bcrypt.compare(pin, user.pinHash);
  }

  if (user.pinHash !== pin) return false;

  const hashed = await bcrypt.hash(pin, 10);
  await db
    .update(appUsers)
    .set({ pinHash: hashed })
    .where(eq(appUsers.id, user.id));

  return true;
}

/**
 * PIN-Login.
 * Setzt eine vollständige kanonische AppSession.
 */
export async function loginWithPin(
  userId: string,
  pin: string,
): Promise<{ ok: true; role: string } | { ok: false; message: string }> {
  try {
    const rateLimit = await checkPinRateLimit(userId);
    if (!rateLimit.allowed) {
      if (rateLimit.locked) {
        return {
          ok: false,
          message: "Konto gesperrt. Bitte Administrator kontaktieren.",
        };
      }

      return {
        ok: false,
        message: `Zu viele Fehlversuche. Bitte in ${rateLimit.retryAfterMinutes} Minute(n) erneut versuchen.`,
      };
    }

    const [user] = await db
      .select()
      .from(appUsers)
      .where(
        and(
          eq(appUsers.id, userId),
          eq(appUsers.tenantId, "galvanik-kreile"),
        ),
      );

    if (!user || !user.active) {
      return { ok: false, message: "Ungültige PIN oder inaktiver Benutzer." };
    }

    const pinValid = await verifyAndMigratePin(user, pin);
    if (!pinValid) {
      await recordFailedPinAttempt(user.id);
      return { ok: false, message: "Ungültige PIN oder inaktiver Benutzer." };
    }

    await resetPinRateLimit(user.id);

    const displayName = user.fullName?.trim();
    if (!displayName) {
      console.error("loginWithPin: user.fullName is empty for userId:", userId);
      return {
        ok: false,
        message: "Kein Anzeigename für diesen Benutzer konfiguriert. Bitte Administrator kontaktieren.",
      };
    }

    const now = Date.now();
    await setAppSession({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      displayName,
      issuedAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });

    return { ok: true, role: user.role };
  } catch {
    console.error("PIN login failed.");
    return { ok: false, message: "Server-Fehler beim Login." };
  }
}
