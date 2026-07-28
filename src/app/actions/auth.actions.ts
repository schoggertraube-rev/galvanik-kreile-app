"use server";

import crypto from "crypto";

import { resolveAuthorization, type AuthorizationResult } from "@/lib/server/authorization";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { setAppSession, SESSION_TTL_MS } from "@/lib/server/appSession";
import { canUsePinLoginRole, isAppRole } from "@/lib/auth/authorizationContract";
import { verifyPinLoginSelector } from "@/lib/server/pinLoginSelector";
import {
  canAttemptPinLogin,
  clearPinLoginFailures,
  recordPinLoginFailure,
} from "@/lib/server/pinAttemptLimiter";

function matchesCurrentPin(storedPin: string | null, submittedPin: string): boolean {
  if (!storedPin || storedPin.length !== submittedPin.length) return false;
  return crypto.timingSafeEqual(Buffer.from(storedPin), Buffer.from(submittedPin));
}

export async function getAuthorizationSnapshotAction(): Promise<AuthorizationResult> {
  return await resolveAuthorization();
}

export async function getRoleAction(): Promise<string | null> {
  const result = await resolveAuthorization();
  return result.ok ? result.data.role : null;
}

export async function getMyPermissionsAction() {
  const result = await resolveAuthorization();
  if (result.ok) {
    const initials = result.data.displayName
      .split(" ")
      .filter(Boolean)
      .map((name: string) => name[0])
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
 * PIN login issues the canonical signed AppSession. The anonymous page submits
 * only a short-lived encrypted selector, never a raw app_users id.
 *
 * PIN hashes are a product-data migration concern. Until the approved W3
 * credential migration, the legacy stored value is compared in constant time
 * and is never sent to the browser.
 */
export async function loginWithPin(
  selector: string,
  pin: string,
): Promise<{ ok: true; role: string } | { ok: false; message: string }> {
  const invalidResult = () => ({ ok: false as const, message: "Ungültige PIN oder inaktiver Benutzer." });

  try {
    if (!/^\d{4}$/.test(pin)) return invalidResult();
    const selectorResult = verifyPinLoginSelector(selector);
    if (!selectorResult.ok) return invalidResult();
    if (!canAttemptPinLogin(selectorResult.userId).allowed) return invalidResult();

    const [user] = await db
      .select()
      .from(appUsers)
      .where(
        and(
          eq(appUsers.id, selectorResult.userId),
          eq(appUsers.tenantId, "galvanik-kreile"),
        ),
      );

    if (
      !user ||
      !user.active ||
      !isAppRole(user.role) ||
      !canUsePinLoginRole(user.role) ||
      !matchesCurrentPin(user.pinHash, pin)
    ) {
      recordPinLoginFailure(selectorResult.userId);
      return invalidResult();
    }

    const displayName = user.fullName?.trim();
    if (!displayName) {
      console.error("loginWithPin: user.fullName is empty for selected user");
      return invalidResult();
    }

    const now = Date.now();
    await setAppSession({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      displayName,
      issuedAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });

    clearPinLoginFailures(selectorResult.userId);

    return { ok: true, role: user.role };
  } catch (error) {
    console.error("Failed to login with pin:", error);
    return invalidResult();
  }
}
