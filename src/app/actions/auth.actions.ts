"use server";

import { getCurrentRole } from "@/lib/auth/roles";
import { getUserPermissions, getCurrentAppUser } from "@/lib/auth/permissions";

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
