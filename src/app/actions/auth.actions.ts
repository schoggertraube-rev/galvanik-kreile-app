"use server";

import { getCurrentRole } from "@/lib/auth/roles";
import { getUserPermissions, getCurrentAppUser } from "@/lib/auth/permissions";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createAppSessionCookie, clearAppSessionCookie } from "@/lib/server/appSession";

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

export async function loginWithPin(userId: string, pin: string) {
  try {
    const [user] = await db.select().from(appUsers).where(eq(appUsers.id, userId));

    if (!user || user.pinHash !== pin || !user.active) {
      return { ok: false, message: "Ungültige PIN oder inaktiver Benutzer." };
    }

    await createAppSessionCookie(user.role);
    return { ok: true, role: user.role };
  } catch (error) {
    console.error("Failed to login with pin:", error);
    return { ok: false, message: "Server-Fehler beim Login." };
  }
}

export async function logoutAppSessionAction() {
  await clearAppSessionCookie();
  return { ok: true };
}
