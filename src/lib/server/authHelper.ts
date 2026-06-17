import { readAppSession, type AppSession, type SessionReadResult } from "@/lib/server/appSession";

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

// Typisierte Fehlermeldungen pro SessionReadResult-Grund.
// NO_COOKIE ist nicht in SessionVerificationResult – daher vollständige Map über alle Gründe.
const SESSION_ERROR_MESSAGES: Record<
  Exclude<SessionReadResult, { ok: true }>["reason"],
  string
> = {
  NO_COOKIE: "AUTH_ERROR: Nicht angemeldet",
  MALFORMED: "AUTH_ERROR: Ungültige Sitzung",
  INVALID_SIGNATURE: "AUTH_ERROR: Ungültige Sitzung",
  EXPIRED: "AUTH_ERROR: Sitzung abgelaufen",
  INVALID_TENANT: "AUTH_ERROR: Ungültiger Mandant",
};

/**
 * Kanonischer Session-Guard.
 *
 * Gibt bei Erfolg die vollständige AppSession zurück.
 * Kein Fallback auf kreile_role-Cookie, getCurrentRole() oder localStorage.
 *
 * Fehlervertrag:
 * - NO_COOKIE          → UNAUTHORIZED "AUTH_ERROR: Nicht angemeldet"
 * - MALFORMED          → UNAUTHORIZED "AUTH_ERROR: Ungültige Sitzung"
 * - INVALID_SIGNATURE  → UNAUTHORIZED "AUTH_ERROR: Ungültige Sitzung"
 * - EXPIRED            → UNAUTHORIZED "AUTH_ERROR: Sitzung abgelaufen"
 * - INVALID_TENANT     → UNAUTHORIZED "AUTH_ERROR: Ungültiger Mandant"
 */
export async function checkAppSession(): Promise<ActionResult<AppSession>> {
  try {
    const result = await readAppSession();

    if (!result.ok) {
      return {
        ok: false,
        error: "UNAUTHORIZED",
        message: SESSION_ERROR_MESSAGES[result.reason],
      };
    }

    return { ok: true, data: result.session };
  } catch (error) {
    console.error("Session check failed:", error);
    return {
      ok: false,
      error: "DB_ERROR",
      message: "Fehler bei der Überprüfung der Berechtigungen.",
    };
  }
}

/**
 * Kompatibler Rollen-Guard.
 *
 * Delegiert die Session-Prüfung an checkAppSession() und gibt bei Erfolg
 * nur die Rolle als string zurück (bestehende Konsumenten-API unverändert).
 */
export async function checkAppAuth(mode: "read" | "write" = "read"): Promise<ActionResult<string>> {
  const sessionResult = await checkAppSession();

  if (!sessionResult.ok) {
    // Fehlerstatus direkt weitergeben – keine Transformation
    return sessionResult;
  }

  const roleLower = sessionResult.data.role.toLowerCase();
  const allowedRoles = mode === "write" ? WRITE_ROLES : READ_ROLES;

  if (!allowedRoles.includes(roleLower)) {
    return {
      ok: false,
      error: "FORBIDDEN",
      message: "Keine Berechtigung für diese Aktion.",
    };
  }

  return { ok: true, data: roleLower };
}
