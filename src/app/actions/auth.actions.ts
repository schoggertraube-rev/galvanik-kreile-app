"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import type {
  AccessArea,
  AppRole,
  PermissionKey,
} from "@/lib/auth/authorizationContract";
import { isAppRole } from "@/lib/auth/authorizationContract";
import {
  APP_TENANT_ID,
  clearAppSession,
  setAppSession,
  SESSION_TTL_MS,
} from "@/lib/server/appSession";
import { runPinAttempt } from "@/lib/server/pinRateLimit";
import {
  isValidPinLoginHandle,
  resolvePinLoginCandidate,
} from "@/lib/server/pinLoginHandle";
import { resolveAuthorization } from "@/lib/server/authorization";
import { recordUserLastSeenForLogin } from "@/lib/server/userLastSeen";

export type ClientAuthorizationResult =
  | {
      ok: true;
      data: {
        displayName: string;
        role: AppRole;
        areas: readonly AccessArea[];
        permissions: readonly PermissionKey[];
        active: true;
      };
    }
  | { ok: false; status: "unauthenticated" }
  | {
      ok: false;
      status: "error";
      message: string;
      supportReference?: string;
    };

export async function getAuthorizationSnapshotAction(): Promise<ClientAuthorizationResult> {
  const result = await resolveAuthorization();
  if (!result.ok) {
    if (result.reason === "NO_SESSION") {
      return { ok: false, status: "unauthenticated" };
    }

    return {
      ok: false,
      status: "error",
      message: "Der Produktzugang ist momentan nicht sicher verfügbar.",
    };
  }

  return {
    ok: true,
    data: {
      displayName: result.data.displayName,
      role: result.data.role,
      areas: result.data.areas ?? [],
      permissions: result.data.permissions,
      active: true,
    },
  };
}

export async function getRoleAction(): Promise<AppRole | null> {
  const result = await resolveAuthorization();
  return result.ok ? result.data.role : null;
}

export async function getMyPermissionsAction() {
  const result = await resolveAuthorization();
  if (result.ok) {
    return {
      permissions: [...result.data.permissions],
      name: result.data.displayName,
      initials: result.data.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    };
  }
  return { permissions: [], name: "", initials: "" };
}

async function verifyAndMigratePin(
  user: { id: string; pinHash: string | null },
  pin: string,
): Promise<boolean> {
  if (!user.pinHash) return false;

  if (user.pinHash.startsWith("$2")) {
    return bcrypt.compare(pin, user.pinHash);
  }

  if (user.pinHash !== pin) return false;

  const hashed = await bcrypt.hash(pin, 12);
  const updatedAt = new Date();
  await db
    .update(appUsers)
    .set({ pinHash: hashed, updatedAt })
    .where(
      and(
        eq(appUsers.id, user.id),
        eq(appUsers.tenantId, APP_TENANT_ID),
        eq(appUsers.pinHash, user.pinHash),
      ),
    );

  return true;
}

/** PIN login for every active tenant user exposed on the start screen. */
export async function loginWithPin(
  loginHandle: string,
  pin: string,
): Promise<
  | { ok: true; role: AppRole }
  | { ok: false; message: string; supportReference?: string }
> {
  try {
    if (!isValidPinLoginHandle(loginHandle) || !/^\d{4}$/.test(pin)) {
      return { ok: false, message: "Code falsch · bitte neu eingeben" };
    }

    const candidates = await db
      .select({
        id: appUsers.id,
        active: appUsers.active,
        pinHash: appUsers.pinHash,
        role: appUsers.role,
        tenantId: appUsers.tenantId,
        fullName: appUsers.fullName,
      })
      .from(appUsers)
      .where(
        and(
          eq(appUsers.tenantId, APP_TENANT_ID),
          eq(appUsers.active, true),
        ),
      );
    const user = resolvePinLoginCandidate(loginHandle, candidates);

    if (!user) {
      return { ok: false, message: "Code falsch · bitte neu eingeben" };
    }

    if (!isAppRole(user.role) || user.tenantId !== APP_TENANT_ID) {
      return { ok: false, message: "Code falsch · bitte neu eingeben" };
    }

    const pinAttempt = await runPinAttempt(
      user.id,
      () => verifyAndMigratePin(user, pin),
    );
    if (pinAttempt.status === "blocked") {
      if (pinAttempt.locked) {
        return {
          ok: false,
          message: "Konto gesperrt. Bitte Administrator kontaktieren.",
        };
      }

      return {
        ok: false,
        message: `Zu viele Fehlversuche. Bitte in ${pinAttempt.retryAfterMinutes} Minute(n) erneut versuchen.`,
      };
    }

    if (pinAttempt.status === "invalid") {
      return { ok: false, message: "Code falsch · bitte neu eingeben" };
    }

    const now = Date.now();
    await setAppSession({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      displayName: user.fullName,
      issuedAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });

    const lastSeen = await recordUserLastSeenForLogin();
    if (lastSeen.code !== "OK") {
      await clearAppSession();
      return { ok: false, message: "Login konnte nicht sicher bestätigt werden." };
    }

    return { ok: true, role: user.role };
  } catch {
    console.error("PIN login failed.");
    return { ok: false, message: "Server-Fehler beim Login." };
  }
}
