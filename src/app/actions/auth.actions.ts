"use server";

import { getCurrentRole } from "@/lib/auth/roles";
import { getUserPermissions, getCurrentAppUser } from "@/lib/auth/permissions";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { setAppSession, SESSION_TTL_MS } from "@/lib/server/appSession";

export async function getRoleAction() {
  try {
    const role = await getCurrentRole();
    return role ? role.toLowerCase() : null;
  } catch (error) {
    console.error("Failed to get role in getRoleAction:", error);
    return null;
  }
}

export async function getMyPermissionsAction() {
  try {
    const user = await getCurrentAppUser();
    const permissions = await getUserPermissions();
    return {
      permissions,
      name: user?.fullName || "User",
      initials: user?.fullName?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "?",
    };
  } catch (error) {
    console.error("Failed to get permissions:", error);
    return { permissions: [], name: "Unknown", initials: "?" };
  }
}

/**
 * PIN-Login.
 *
 * Setzt eine vollständige kanonische AppSession.
 * displayName kommt ausschließlich aus user.fullName.
 * Eine UUID wird niemals als sichtbarer Anzeigename verwendet.
 */
export async function loginWithPin(
  userId: string,
  pin: string,
): Promise<{ ok: true; role: string } | { ok: false; message: string }> {
  try {
    const [user] = await db.select().from(appUsers).where(eq(appUsers.id, userId));

    if (!user || user.pinHash !== pin || !user.active) {
      return { ok: false, message: "Ungültige PIN oder inaktiver Benutzer." };
    }

    // Fachliche Anzeigeidentität: fullName ist Pflichtfeld (NOT NULL im Schema).
    // Leerer String ist ein Datenfehler, der klar zurückgemeldet wird.
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
      tenantId: "galvanik-kreile",
      role: user.role,
      displayName,
      issuedAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });

    return { ok: true, role: user.role };
  } catch (error) {
    console.error("Failed to login with pin:", error);
    return { ok: false, message: "Server-Fehler beim Login." };
  }
}
