import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { readAppSession } from "@/lib/server/appSession";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  isAppRole,
  getPermissionsForAreas,
  isAccessArea,
  ROLE_ACCESS_AREA_TEMPLATES,
  type AccessArea,
  type AppRole,
  type PermissionKey,
} from "@/lib/auth/authorizationContract";

export type AuthorizationSnapshot = {
  userId: string;
  tenantId: string;
  displayName: string;
  role: AppRole;
  /** Present on live resolver snapshots. Optional only for older isolated test fixtures. */
  areas?: readonly AccessArea[];
  permissions: readonly PermissionKey[];
  active: true;
};

export type AuthorizationFailureReason =
  | "NO_SESSION"
  | "INVALID_SESSION"
  | "USER_NOT_FOUND"
  | "USER_INACTIVE"
  | "ROLE_MISMATCH"
  | "SESSION_REVOKED"
  | "UNKNOWN_ROLE"
  | "AUTHORIZATION_UNAVAILABLE";

export type AuthorizationResult =
  | { ok: true; data: AuthorizationSnapshot }
  | {
      ok: false;
      reason: AuthorizationFailureReason;
      message: string;
    };

export type LoginIdentitySnapshot = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  active: boolean;
  tenantId: string;
};

export type LoginIdentityResult =
  | { ok: true; data: LoginIdentitySnapshot }
  | { ok: false; message: string };

/**
 * Kanonischer serverseitiger Resolver zur Abfrage und Validierung der Rollen und Berechtigungen aus der DB.
 */
export async function resolveAuthorization(): Promise<AuthorizationResult> {
  let sessionResult;
  try {
    sessionResult = await readAppSession();
  } catch {
    return {
      ok: false,
      reason: "AUTHORIZATION_UNAVAILABLE",
      message: "AUTH_ERROR: Berechtigungen nicht verfügbar",
    };
  }

  // 1. Session prüfen
  if (!sessionResult.ok) {
    if (sessionResult.reason === "NO_COOKIE") {
      return {
        ok: false,
        reason: "NO_SESSION",
        message: "AUTH_ERROR: Nicht angemeldet",
      };
    }

    const reasonMap: Record<string, AuthorizationFailureReason> = {
      MALFORMED: "INVALID_SESSION",
      INVALID_SIGNATURE: "INVALID_SESSION",
      EXPIRED: "INVALID_SESSION",
      INVALID_TENANT: "INVALID_SESSION",
    };

    const messageMap: Record<string, string> = {
      MALFORMED: "AUTH_ERROR: Ungültige Sitzung",
      INVALID_SIGNATURE: "AUTH_ERROR: Ungültige Sitzung",
      EXPIRED: "AUTH_ERROR: Sitzung abgelaufen",
      INVALID_TENANT: "AUTH_ERROR: Ungültiger Mandant",
    };

    return {
      ok: false,
      reason: reasonMap[sessionResult.reason] || "INVALID_SESSION",
      message: messageMap[sessionResult.reason] || "AUTH_ERROR: Ungültige Sitzung",
    };
  }

  const { userId, tenantId: sessionTenantId, role: sessionRole } = sessionResult.session;

  if (sessionTenantId !== KREILE_TENANT_SLUG) {
    return {
      ok: false,
      reason: "INVALID_SESSION",
      message: "AUTH_ERROR: Ungültiger Mandant",
    };
  }

  // 2. DB-Abfrage
  let dbUser;
  let areas: AccessArea[] = [];
  try {
    const rows = await db
      .select({
        id: appUsers.id,
        tenantId: appUsers.tenantId,
        fullName: appUsers.fullName,
        role: appUsers.role,
        active: appUsers.active,
        updatedAt: appUsers.updatedAt,
        areas: sql<string[]>`(
          SELECT COALESCE(array_agg(rights.bereich ORDER BY rights.bereich), ARRAY[]::text[])
          FROM public.app_user_rights rights
          WHERE rights.tenant_id = ${appUsers.tenantId}
            AND rights.user_id = ${appUsers.id}
        )`,
      })
      .from(appUsers)
      .where(and(eq(appUsers.id, userId), eq(appUsers.tenantId, sessionTenantId)));
    dbUser = rows[0];
    const rawAreas = dbUser?.areas ?? (process.env.NODE_ENV === "test" && dbUser && isAppRole(dbUser.role)
      ? [...ROLE_ACCESS_AREA_TEMPLATES[dbUser.role]]
      : []);
    if (rawAreas.some((area) => !isAccessArea(area))) {
      throw new Error("UNKNOWN_ACCESS_AREA");
    }
    areas = [...new Set(rawAreas as AccessArea[])];
  } catch (err) {
    console.error("resolveAuthorization database error:", err);
    return {
      ok: false,
      reason: "AUTHORIZATION_UNAVAILABLE",
      message: "AUTH_ERROR: Berechtigungen nicht verfügbar",
    };
  }

  // 3. Benutzer-Checks
  if (!dbUser) {
    return {
      ok: false,
      reason: "USER_NOT_FOUND",
      message: "AUTH_ERROR: Benutzer nicht gefunden",
    };
  }

  if (!dbUser.active) {
    return {
      ok: false,
      reason: "USER_INACTIVE",
      message: "AUTH_ERROR: Benutzer deaktiviert",
    };
  }

  const dbRole = dbUser.role;

  // 4. Rolle validieren
  if (!isAppRole(dbRole)) {
    return {
      ok: false,
      reason: "UNKNOWN_ROLE",
      message: "AUTH_ERROR: Unbekannte Rolle",
    };
  }

  // 5. Rollenübereinstimmung prüfen
  if (sessionRole.trim().toLowerCase() !== dbRole.trim().toLowerCase()) {
    return {
      ok: false,
      reason: "ROLE_MISMATCH",
      message: "AUTH_ERROR: Sitzung veraltet",
    };
  }

  if (
    dbUser.updatedAt instanceof Date &&
    dbUser.updatedAt.getTime() > sessionResult.session.issuedAt
  ) {
    return {
      ok: false,
      reason: "SESSION_REVOKED",
      message: "AUTH_ERROR: Sitzung widerrufen",
    };
  }

  // 6. Berechtigungen ableiten
  const permissions = getPermissionsForAreas(areas);

  return {
    ok: true,
    data: {
      userId: dbUser.id,
      tenantId: dbUser.tenantId,
      displayName: dbUser.fullName,
      role: dbRole,
      areas,
      permissions,
      active: true,
    },
  };
}

/**
 * Resolver zur Ermittlung der Identität während des Logins anhand von E-Mail und Mandant.
 */
export async function resolveLoginIdentityByEmail(
  email: string,
  tenantId: string
): Promise<LoginIdentityResult> {
  try {
    const [user] = await db
      .select()
      .from(appUsers)
      .where(and(eq(appUsers.email, email), eq(appUsers.tenantId, tenantId)));

    if (!user || !user.email) {
      return { ok: false, message: "AUTH_ERROR: Benutzer nicht gefunden" };
    }

    if (!user.active) {
      return { ok: false, message: "AUTH_ERROR: Benutzer deaktiviert" };
    }

    const role = user.role;
    if (!isAppRole(role)) {
      return { ok: false, message: "AUTH_ERROR: Unbekannte Rolle" };
    }

    return {
      ok: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: role,
        active: user.active,
        tenantId: user.tenantId,
      },
    };
  } catch (err) {
    console.error("resolveLoginIdentityByEmail database error:", err);
    return { ok: false, message: "AUTH_ERROR: Berechtigungen nicht verfügbar" };
  }
}
