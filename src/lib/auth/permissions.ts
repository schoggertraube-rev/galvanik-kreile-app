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
 */
export async function isAdminOrDeveloper(): Promise<boolean> {
  const role = await getCurrentRole();
  return role === "admin" || role === "developer";
}

/**
 * Asserts that the current user has the admin or developer role.
 * Throws an error or redirects if unauthorized.
 */
export async function requireAdminOrDeveloper() {
  const isAuthorized = await isAdminOrDeveloper();
  if (!isAuthorized) {
    redirect("/"); // or throw new Error("Unauthorized");
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
