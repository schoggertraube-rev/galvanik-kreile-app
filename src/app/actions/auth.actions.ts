"use server";

import { canUsePinLoginRole, isAppRole } from "@/lib/auth/authorizationContract";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { setAppSession, SESSION_TTL_MS, deriveSessionInitials } from "@/lib/server/appSession";
import { resolveAuthorization, type AuthorizationResult } from "@/lib/server/authorization";
import { and, eq } from "drizzle-orm";

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
 * Setzt eine vollstaendige kanonische AppSession.
 */
export async function loginWithPin(
  userId: string,
  pin: string,
): Promise<{ ok: true; role: string } | { ok: false; message: string }> {
  const invalidLoginMessage = "Ung\u00fcltige PIN oder inaktiver Benutzer.";

  try {
    const [user] = await db
      .select()
      .from(appUsers)
      .where(
        and(
          eq(appUsers.id, userId),
          eq(appUsers.tenantId, "galvanik-kreile"),
        ),
      );

    if (!user || user.pinHash !== pin || !user.active) {
      return { ok: false, message: invalidLoginMessage };
    }

    if (!isAppRole(user.role) || !canUsePinLoginRole(user.role)) {
      return { ok: false, message: invalidLoginMessage };
    }

    const displayName = user.fullName?.trim();
    if (!displayName) {
      console.error("loginWithPin: user.fullName is empty for userId:", userId);
      return {
        ok: false,
        message: "Kein Anzeigename f\u00fcr diesen Benutzer konfiguriert. Bitte Administrator kontaktieren.",
      };
    }

    await setAppSession({
      uid: user.id,
      role: user.role,
      tenant: user.tenantId,
      initials: deriveSessionInitials(displayName),
      exp: Date.now() + SESSION_TTL_MS,
    });

    return { ok: true, role: user.role };
  } catch (error) {
    console.error("Failed to login with pin:", error);
    return { ok: false, message: "Server-Fehler beim Login." };
  }
}
