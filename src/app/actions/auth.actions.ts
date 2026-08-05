"use server";

import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import {
  APP_TENANT_ID,
  setAppSession,
  SESSION_TTL_MS,
} from "@/lib/server/appSession";
import { resolveAuthorization, type AuthorizationResult } from "@/lib/server/authorization";
import { runPinAttempt } from "@/lib/server/pinRateLimit";
import {
  isValidPinLoginHandle,
  resolvePinLoginCandidate,
} from "@/lib/server/pinLoginHandle";

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

  const hashed = await bcrypt.hash(pin, 12);
  const updatedAt = new Date();
  await db
    .update(appUsers)
    .set({ pinHash: hashed, updatedAt })
    .where(
      and(
        eq(appUsers.id, user.id),
        eq(appUsers.tenantId, APP_TENANT_ID),
        eq(appUsers.pinHash, user.pinHash),
      ),
    );

  return true;
}

/**
 * PIN-Login.
 * Setzt eine vollständige kanonische AppSession.
 */
export async function loginWithPin(
  loginHandle: string,
  pin: string,
): Promise<{ ok: true; role: string } | { ok: false; message: string }> {
  try {
    if (!isValidPinLoginHandle(loginHandle) || !/^\d{4}$/.test(pin)) {
      return { ok: false, message: "Ungültige PIN oder inaktiver Benutzer." };
    }

    const candidates = await db
      .select({
        id: appUsers.id,
        active: appUsers.active,
        fullName: appUsers.fullName,
        pinHash: appUsers.pinHash,
        role: appUsers.role,
        tenantId: appUsers.tenantId,
      })
      .from(appUsers)
      .where(
        and(
          eq(appUsers.tenantId, APP_TENANT_ID),
          eq(appUsers.active, true),
          ne(appUsers.role, "developer"),
        ),
      );
    const user = resolvePinLoginCandidate(loginHandle, candidates);

    if (!user) {
      return { ok: false, message: "Ungültige PIN oder inaktiver Benutzer." };
    }

    const pinAttempt = await runPinAttempt(
      user.id,
      () => verifyAndMigratePin(user, pin),
    );
    if (pinAttempt.status === "blocked") {
      if (pinAttempt.locked) {
        return {
          ok: false,
          message: "Konto gesperrt. Bitte Administrator kontaktieren.",
        };
      }

      return {
        ok: false,
        message: `Zu viele Fehlversuche. Bitte in ${pinAttempt.retryAfterMinutes} Minute(n) erneut versuchen.`,
      };
    }

    if (pinAttempt.status === "invalid") {
      return { ok: false, message: "Ungültige PIN oder inaktiver Benutzer." };
    }

    const displayName = user.fullName?.trim();
    if (!displayName) {
      console.error("loginWithPin: user.fullName is empty for resolved operator.");
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
