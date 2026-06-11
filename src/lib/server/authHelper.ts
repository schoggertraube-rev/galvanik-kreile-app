import { getCurrentRole } from "@/lib/auth/roles";
import { getAppSession } from "@/lib/server/appSession";

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
    let role: string | null = null;
      try {
        const session = await getAppSession();
        if (session && session.tenantId === "galvanik-kreile") {
          role = session.role;
        } else if (session) {
          // session exists but different tenant – treat as unauthorized
          role = null;
        } else {
            role = await getCurrentRole();
        }
      } catch (e) {
        // getAppSession throws when called outside a Next.js request (e.g., test script)
        const allowDevScriptAuth =
          process.env.NODE_ENV !== "production" &&
          process.env.KREILE_ALLOW_DEV_SCRIPT_AUTH === "true";

        if (allowDevScriptAuth) {
          role = "admin"; // bypass for local test scripts
        } else {
          console.error("Auth check failed outside request context:", e);
          return { ok: false, error: "DB_ERROR", message: "Fehler bei der Überprüfung der Berechtigungen." };
        }
      }


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
