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

/**
 * Server-Guard: Prüft ausschließlich die kanonische App-Session.
 *
 * Fehlervertrag:
 * - kein Cookie        → UNAUTHORIZED "AUTH_ERROR: Nicht angemeldet"
 * - ungültige Signatur → UNAUTHORIZED "AUTH_ERROR: Ungültige Sitzung"
 * - abgelaufen         → UNAUTHORIZED "AUTH_ERROR: Sitzung abgelaufen"
 * - falscher Tenant    → UNAUTHORIZED "AUTH_ERROR: Ungültiger Mandant"
 * - gültig             → { ok: true, data: role }
 *
 * Kein Fallback auf getCurrentRole() oder kreile_role-Cookie.
 */
export async function checkAppAuth(mode: "read" | "write" = "read"): Promise<ActionResult<string>> {
  try {
    const session = await getAppSession();

    if (!session) {
      return { ok: false, error: "UNAUTHORIZED", message: "AUTH_ERROR: Nicht angemeldet" };
    }

    const roleLower = session.role.toLowerCase();
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
