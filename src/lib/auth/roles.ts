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

/** Returns the current role as data; authorization decisions use areas. */
export async function getCurrentRole(): Promise<string | null> {
  const result = await resolveAuthorization();
  return result.ok ? result.data.role : null;
}
