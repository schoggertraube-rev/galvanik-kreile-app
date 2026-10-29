import { redirect } from "next/navigation";
import { getCurrentRole, getCurrentAppUser } from "./roles";
import { type PermissionKey } from "./authorizationContract";
import { resolveAuthorization } from "@/lib/server/authorization";

/**
 * Returns true if the user has an admin or developer role.
 */
export async function isAdminOrDeveloper(): Promise<boolean> {
  const result = await resolveAuthorization();
  return Boolean(result?.ok && result.data.permissions.includes("perm_sys_diag"));
}

/**
 * Asserts that the current user has the admin or developer role.
 */
export async function requireAdminOrDeveloper() {
  const result = await resolveAuthorization();
  if (!result?.ok || !result.data.permissions.includes("perm_sys_diag")) redirect("/");
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

/**
 * Checks if the current user has the specified permission.
 */
export async function hasPermission(permissionKey: PermissionKey): Promise<boolean> {
  const result = await resolveAuthorization();
  return Boolean(result?.ok && result.data.permissions.includes(permissionKey));
}

/**
 * Helper function to get all permissions for the current user.
 */
export async function getUserPermissions(): Promise<string[]> {
  const result = await resolveAuthorization();
  return result?.ok ? [...result.data.permissions] : [];
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

export { getCurrentAppUser, getCurrentRole };
