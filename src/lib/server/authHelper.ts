import { getCurrentRole } from "@/lib/auth/roles";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: "UNAUTHORIZED" | "FORBIDDEN" | "DB_ERROR" | "NETWORK_ERROR" | "UNKNOWN" | "EMPTY_RESULT";
      message: string;
      details?: unknown;
    };

const READ_ROLES = [
  "admin",
  "developer",
  "inhaber",
  "meister",
  "mitarbeiter",
  "werkstatt",
  "buero",
  "office",
  "quality",
  "readonly",
];

const WRITE_ROLES = [
  "admin",
  "developer",
  "inhaber",
  "meister",
  "mitarbeiter",
  "werkstatt",
  "buero",
  "office",
  "quality",
];

export async function checkAppAuth(mode: "read" | "write" = "read"): Promise<ActionResult<string>> {
  try {
    const role = await getCurrentRole();
    if (!role) {
      return { ok: false, error: "UNAUTHORIZED", message: "Nicht angemeldet." };
    }
    const roleLower = role.toLowerCase();
    
    const allowedRoles = mode === "write" ? WRITE_ROLES : READ_ROLES;
    
    if (!allowedRoles.includes(roleLower)) {
      return { ok: false, error: "FORBIDDEN", message: "Keine Berechtigung für diese Aktion." };
    }
    return { ok: true, data: roleLower };
  } catch (error) {
    console.error("Auth check failed:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler bei der Überprüfung der Berechtigungen." };
  }
}
