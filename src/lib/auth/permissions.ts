import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser, getCurrentRole } from "./roles";
import { redirect } from "next/navigation";

/**
 * Returns the underlying Supabase Auth user.
 */
export async function getCurrentAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Returns true if the user has an admin or developer role.
 * Catches DB errors safely so UI doesn't crash.
 */
export async function isAdminOrDeveloper(): Promise<boolean> {
  try {
    const role = await getCurrentRole();
    return role === "admin" || role === "developer";
  } catch (error: any) {
    if (error?.message?.startsWith("DATABASE_ERROR")) {
      return false; // Safely hide UI elements if DB is down
    }
    return false;
  }
}

/**
 * Asserts that the current user has the admin or developer role.
 * Throws an error for DB failures or redirects if unauthorized.
 */
export async function requireAdminOrDeveloper() {
  try {
    const role = await getCurrentRole();
    if (role !== "admin" && role !== "developer") {
      redirect("/");
    }
  } catch (error: any) {
    // If the DB is unavailable we want a clear error, not a silent 404.
    if (error?.message?.startsWith("DATABASE_ERROR")) {
      console.error("Admin check failed (DB error):", error);
      redirect('/start?message=Systemfehler%3A+Datenbank+nicht+erreichbar+%28Admin+Pr%C3%BCfung%29');
    } else {
      redirect('/');
    }
  }
}

/**
 * Returns true if the user is a developer.
 */
export async function isDeveloper(): Promise<boolean> {
  const role = await getCurrentRole();
  return role === "developer";
}

/**
 * Asserts that the current user is a developer.
 */
export async function requireDeveloper() {
  const authorized = await isDeveloper();
  if (!authorized) {
    redirect("/");
  }
}

// ── Fine-grained Permission Checks ────────────────────────────────────────

export async function canManageSystemSettings(): Promise<boolean> {
  return await isAdminOrDeveloper();
}

export async function canManageUsersAndRoles(): Promise<boolean> {
  return await isAdminOrDeveloper();
}

export async function canUploadLogo(): Promise<boolean> {
  return await isAdminOrDeveloper();
}

export async function canEditEmailTemplates(): Promise<boolean> {
  return await isAdminOrDeveloper();
}

export async function canViewAdminAnalytics(): Promise<boolean> {
  return await isAdminOrDeveloper();
}

// Re-export current app user/role getters for convenience
export { getCurrentAppUser, getCurrentRole };
