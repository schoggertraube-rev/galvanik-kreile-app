"use server";

import { resolveAuthorization, type AuthorizationResult } from "@/lib/server/authorization";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { setAppSession, SESSION_TTL_MS } from "@/lib/server/appSession";
import { compare } from "bcryptjs";
import { canUsePinLoginRole, isAppRole } from "@/lib/auth/authorizationContract";
import { verifyPinLoginSelector } from "@/lib/server/pinLoginSelector";
import {
  PIN_LOGIN_PUBLIC_RETRY_SECONDS,
  reservePinLoginAttempt,
  resetPinLoginAttempts,
} from "@/lib/server/pinLoginAttempts";

type LoginWithPinResult =
  | { ok: true; role: string }
  | { ok: false; message: string; retryAfterSeconds: number };

export async function getAuthorizationSnapshotAction(): Promise<AuthorizationResult> {
  return await resolveAuthorization();
}

export async function getRoleAction(): Promise<string | null> {
  const result = await resolveAuthorization();
  if (result.ok) {
    return result.data.role;
  }
  return null;
}

export async function getMyPermissionsAction() {
  const result = await resolveAuthorization();
  if (result.ok) {
    const initials = result.data.displayName
      .split(" ")
      .filter(Boolean)
      .map((n: string) => n[0])
      .join("")
      .toUpperCase();
    return {
      permissions: [...result.data.permissions],
      name: result.data.displayName,
      initials: initials || "?",
    };
  }
  return { permissions: [], name: "Unknown", initials: "?" };
}

/**
 * PIN-Login.
 * Setzt eine vollständige kanonische AppSession.
 */
export async function loginWithPin(
  selector: string,
  pin: string,
): Promise<LoginWithPinResult> {
  const invalidMessage = "Ungültige PIN oder inaktiver Benutzer.";
  const invalidResult = (): LoginWithPinResult => ({
    ok: false,
    message: invalidMessage,
    retryAfterSeconds: PIN_LOGIN_PUBLIC_RETRY_SECONDS,
  });
  try {
    if (!/^\d{4}$/.test(pin)) return invalidResult();
    const selectorResult = await verifyPinLoginSelector(selector);
    if (!selectorResult.ok) return invalidResult();

    const [user] = await db
      .select()
      .from(appUsers)
      .where(
        and(
          eq(appUsers.id, selectorResult.userId),
          eq(appUsers.tenantId, "galvanik-kreile")
        )
      );

    if (
      !user ||
      !user.active ||
      !isAppRole(user.role) ||
      !canUsePinLoginRole(user.role) ||
      !user.pinHash ||
      !/^\$2[aby]\$\d{2}\$/.test(user.pinHash)
    ) {
      return invalidResult();
    }

    const reservation = await reservePinLoginAttempt({
      tenantId: user.tenantId,
      userId: user.id,
      role: user.role,
    });
    if (!reservation.allowed) {
      console.warn("loginWithPin: durable attempt budget exhausted", {
        tenantId: user.tenantId,
        userId: user.id,
        retryAfterSeconds: reservation.retryAfterSeconds,
      });
      return invalidResult();
    }

    if (!(await compare(pin, user.pinHash))) {
      return invalidResult();
    }

    const displayName = user.fullName?.trim();
    if (!displayName) {
      console.error("loginWithPin: user.fullName is empty for selected user");
      return invalidResult();
    }

    // A session is issued only after the append-only reset marker commits.
    // Any ledger error therefore fails closed without a PIN-validity oracle.
    await resetPinLoginAttempts({
      tenantId: user.tenantId,
      userId: user.id,
      role: user.role,
    });

    const now = Date.now();
    await setAppSession({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      displayName,
      issuedAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });

    return { ok: true, role: user.role };
  } catch (error) {
    console.error("Failed to login with pin:", error);
    return invalidResult();
  }
}
