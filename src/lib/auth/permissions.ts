import { redirect } from "next/navigation";
import { getCurrentRole, getCurrentAppUser } from "./roles";
import {
  isAppRole,
  getPermissionsForRole,
  type PermissionKey,
} from "./authorizationContract";

/**
 * Returns true if the user has an admin or developer role.
 */
export async function isAdminOrDeveloper(): Promise<boolean> {
  try {
    const role = await getCurrentRole();
    if (!role) return false;
    const normalizedRole = role.toLowerCase();
    return normalizedRole === "admin" || normalizedRole === "developer" || normalizedRole === "inhaber";
  } catch {
    return false;
  }
}

/**
 * Asserts that the current user has the admin or developer role.
 */
export async function requireAdminOrDeveloper() {
  try {
    const role = await getCurrentRole();
    const normalizedRole = role?.toLowerCase() || "";
    if (normalizedRole !== "admin" && normalizedRole !== "developer" && normalizedRole !== "inhaber") {
      redirect("/");
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("DATABASE_ERROR")) {
      redirect('/start?message=Systemfehler%3A+Datenbank+nicht+erreichbar');
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

/**
 * Checks if the current user has the specified permission.
 */
export async function hasPermission(permissionKey: PermissionKey): Promise<boolean> {
  try {
    const role = await getCurrentRole();
    if (!role || !isAppRole(role)) return false;
    return getPermissionsForRole(role).includes(permissionKey);
  } catch {
    return false;
  }
}

/**
 * Helper function to get all permissions for the current user.
 */
export async function getUserPermissions(): Promise<string[]> {
  try {
    const role = await getCurrentRole();
    if (!role || !isAppRole(role)) return [];
    return [...getPermissionsForRole(role)];
  } catch {
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

export { getCurrentAppUser, getCurrentRole };
