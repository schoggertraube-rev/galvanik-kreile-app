import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser, getCurrentRole } from "./roles";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { featureFlags } from "@/db/schema";
import { eq } from "drizzle-orm";

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
    if (!role) return false;
    const normalizedRole = role.toLowerCase();
    return normalizedRole === "admin" || normalizedRole === "developer" || normalizedRole === "inhaber";
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith("DATABASE_ERROR")) {
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
    const normalizedRole = role?.toLowerCase() || "";
    if (normalizedRole !== "admin" && normalizedRole !== "developer" && normalizedRole !== "inhaber") {
      redirect("/");
    }
  } catch (error: unknown) {
    // If the DB is unavailable we want a clear error, not a silent 404.
    if (error instanceof Error && error.message.startsWith("DATABASE_ERROR")) {
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

/**
 * Checks if the current user has the specified permission based on the feature_flags table.
 */
export async function hasPermission(permissionKey: string): Promise<boolean> {
  try {
    const role = await getCurrentRole();
    if (!role) return false;
    const normalizedRole = role.toLowerCase();
    
    // Developer and Admin always have access
    if (normalizedRole === "developer" || normalizedRole === "admin" || normalizedRole === "inhaber") return true;

    const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.id, permissionKey));
    if (!flag) return false; // Default deny if flag doesn't exist

    return flag.rolesAllowed?.includes(normalizedRole) ?? false;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith("DATABASE_ERROR")) {
      return false; // Safely hide UI elements if DB is down
    }
    console.error(`Permission check failed for ${permissionKey}:`, error);
    return false;
  }
}

// Helper function to get all permissions for the current user in one query
export async function getUserPermissions(): Promise<string[]> {
  try {
    const role = await getCurrentRole();
    if (!role) return [];
    const normalizedRole = role.toLowerCase();
    
    const flags = await db.select().from(featureFlags);
    
    // Admin and Developer get all permissions
    if (normalizedRole === "developer" || normalizedRole === "admin" || normalizedRole === "inhaber") {
      return flags.map(f => f.id);
    }
    
    return flags
      .filter(flag => (flag.rolesAllowed?.includes(normalizedRole)))
      .map(flag => flag.id);
  } catch (err) {
    console.error("Error fetching user permissions:", err);
    return [];
  }
}

export async function canManageSystemSettings(): Promise<boolean> {
  return await hasPermission("perm_sys_toggles");
}

export async function canManageUsersAndRoles(): Promise<boolean> {
  return await hasPermission("perm_sys_users");
}

export async function canUploadLogo(): Promise<boolean> {
  return await hasPermission("perm_sys_toggles");
}

export async function canEditEmailTemplates(): Promise<boolean> {
  return await hasPermission("perm_sys_toggles");
}

export async function canViewAdminAnalytics(): Promise<boolean> {
  return await hasPermission("perm_sys_diag");
}

// Re-export current app user/role getters for convenience
export { getCurrentAppUser, getCurrentRole };
