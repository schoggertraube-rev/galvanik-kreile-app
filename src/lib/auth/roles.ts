import { redirect } from "next/navigation";
import { resolveAuthorization } from "@/lib/server/authorization";

/**
 * Gets the current authenticated user's DB profile.
 */
export async function getCurrentAppUser() {
  const result = await resolveAuthorization();
  if (result.ok) {
    return {
      id: result.data.userId,
      fullName: result.data.displayName,
      role: result.data.role,
      active: true,
    };
  }
  return null;
}

/**
 * Gets the role of the current user. Returns null if not logged in or authorized.
 */
export async function getCurrentRole(): Promise<string | null> {
  const result = await resolveAuthorization();
  if (result.ok) {
    return result.data.role;
  }
  return null;
}

/**
 * Asserts that the current user has one of the allowed roles.
 */
export async function requireRole(allowedRoles: string[]) {
  const role = await getCurrentRole();
  if (!role || !allowedRoles.includes(role)) {
    redirect("/");
  }
}

/**
 * Shortcut to check if the current user is a developer.
 */
export async function isDeveloper(): Promise<boolean> {
  const role = await getCurrentRole();
  return role === "developer";
}
