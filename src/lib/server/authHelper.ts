import { readAppSession, type AppSession, type SessionReadResult } from "@/lib/server/appSession";
import { resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";
import type { PermissionKey } from "@/lib/auth/authorizationContract";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: "UNAUTHORIZED" | "FORBIDDEN" | "DB_ERROR" | "NETWORK_ERROR" | "UNKNOWN" | "EMPTY_RESULT" | "NOT_CONFIGURED";
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
 * Kanonischer Session-Guard (datenbankfrei und unverändert).
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
 * Kompatibler Rollen-Guard auf Basis von resolveAuthorization().
 */
export async function checkAppAuth(mode: "read" | "write" = "read"): Promise<ActionResult<string>> {
  const result = await resolveAuthorization();

  if (!result.ok) {
    const errorMap: Record<string, "UNAUTHORIZED" | "DB_ERROR" | "UNKNOWN"> = {
      NO_SESSION: "UNAUTHORIZED",
      INVALID_SESSION: "UNAUTHORIZED",
      USER_NOT_FOUND: "UNAUTHORIZED",
      USER_INACTIVE: "UNAUTHORIZED",
      ROLE_MISMATCH: "UNAUTHORIZED",
      UNKNOWN_ROLE: "UNAUTHORIZED",
      AUTHORIZATION_UNAVAILABLE: "DB_ERROR",
    };

    return {
      ok: false,
      error: errorMap[result.reason] || "UNKNOWN",
      message: result.message,
    };
  }

  const roleLower = result.data.role.toLowerCase();
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

/**
 * Permission-level guard for mutations whose effect is narrower than a generic
 * write role.  Server actions must use this instead of trusting a client-side
 * hidden button or a broad office/workshop role.
 */
export async function checkAppPermission(permission: PermissionKey): Promise<ActionResult<AuthorizationSnapshot>> {
  const result = await resolveAuthorization();

  if (!result.ok) {
    const errorMap: Record<string, "UNAUTHORIZED" | "DB_ERROR" | "UNKNOWN"> = {
      NO_SESSION: "UNAUTHORIZED",
      INVALID_SESSION: "UNAUTHORIZED",
      USER_NOT_FOUND: "UNAUTHORIZED",
      USER_INACTIVE: "UNAUTHORIZED",
      ROLE_MISMATCH: "UNAUTHORIZED",
      UNKNOWN_ROLE: "UNAUTHORIZED",
      AUTHORIZATION_UNAVAILABLE: "DB_ERROR",
    };

    return {
      ok: false,
      error: errorMap[result.reason] || "UNKNOWN",
      message: result.message,
    };
  }

  if (!result.data.permissions.includes(permission)) {
    return {
      ok: false,
      error: "FORBIDDEN",
      message: "Keine Berechtigung für diese Aktion.",
    };
  }

  return { ok: true, data: result.data };
}
