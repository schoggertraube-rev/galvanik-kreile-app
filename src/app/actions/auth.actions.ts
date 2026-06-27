"use server";

import { resolveAuthorization, type AuthorizationResult } from "@/lib/server/authorization";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { setAppSession, SESSION_TTL_MS } from "@/lib/server/appSession";
import { createClient } from "@/lib/supabase/server";

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
  userId: string,
  pin: string,
): Promise<{ ok: true; role: string } | { ok: false; message: string }> {
  try {
    const [user] = await db
      .select()
      .from(appUsers)
      .where(
        and(
          eq(appUsers.id, userId),
          eq(appUsers.tenantId, "galvanik-kreile")
        )
      );

    if (!user || user.pinHash !== pin || !user.active) {
      return { ok: false, message: "Ungültige PIN oder inaktiver Benutzer." };
    }

    const displayName = user.fullName?.trim();
    if (!displayName) {
      console.error("loginWithPin: user.fullName is empty for userId:", userId);
      return {
        ok: false,
        message: "Kein Anzeigename für diesen Benutzer konfiguriert. Bitte Administrator kontaktieren.",
      };
    }

    // Bestehende Supabase E-Mail-Session abmelden, bevor die App-Session gesetzt wird.
    // Fehlschlag gilt als Login-Fehler: inkonsistente Sitzung verhindert.
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) {
        console.error("loginWithPin: supabase.auth.signOut() returned error:", error);
        return { ok: false, message: "Systemfehler: Bestehende Sitzung konnte nicht beendet werden." };
      }
    } catch (signOutError) {
      console.error("loginWithPin: supabase.auth.signOut() failed, aborting login:", signOutError);
      return { ok: false, message: "Systemfehler: Bestehende Sitzung konnte nicht beendet werden." };
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
  } catch (error) {
    console.error("Failed to login with pin:", error);
    return { ok: false, message: "Server-Fehler beim Login." };
  }
}
