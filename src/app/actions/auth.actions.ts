"use server";

import bcrypt from "bcryptjs";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import type {
  AppRole,
  PermissionKey,
  ProductIdentity,
} from "@/lib/auth/authorizationContract";
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
import {
  readProductActorReadiness,
  resolveProductActorAuthorization,
} from "@/lib/server/productActorReadiness";
import { recordUserLastSeenForLogin } from "@/lib/server/userLastSeen";

export type ClientAuthorizationResult =
  | {
      ok: true;
      data: {
        displayName: ProductIdentity["name"];
        role: AppRole;
        permissions: readonly PermissionKey[];
        active: true;
      };
    }
  | { ok: false; message: string; supportReference?: string };

export async function getAuthorizationSnapshotAction(): Promise<ClientAuthorizationResult> {
  const result = await resolveProductActorAuthorization();
  if (!result.ok) {
    return {
      ok: false,
      message: "Der Produktzugang ist momentan nicht sicher verfügbar.",
      supportReference: result.supportReference,
    };
  }

  return {
    ok: true,
    data: {
      displayName: result.data.actor.identity.name,
      role: result.data.authorization.role,
      permissions: result.data.authorization.permissions,
      active: true,
    },
  };
}

export async function getRoleAction(): Promise<AppRole | null> {
  const result = await resolveProductActorAuthorization();
  return result.ok ? result.data.authorization.role : null;
}

export async function getMyPermissionsAction() {
  const result = await resolveProductActorAuthorization();
  if (result.ok) {
    return {
      permissions: [...result.data.authorization.permissions],
      name: result.data.actor.identity.name,
      initials: result.data.actor.identity.initials,
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

/** PIN login for the two exact, fully validated product actors. */
export async function loginWithPin(
  loginHandle: string,
  pin: string,
): Promise<
  | { ok: true; role: AppRole }
  | { ok: false; message: string; supportReference?: string }
> {
  try {
    if (!isValidPinLoginHandle(loginHandle) || !/^\d{4}$/.test(pin)) {
      return { ok: false, message: "Ungültige PIN oder inaktiver Benutzer." };
    }

    const readiness = await readProductActorReadiness();
    if (!readiness.ok) {
      return {
        ok: false,
        message: "Anmeldung ist momentan nicht sicher verfügbar.",
        supportReference: readiness.supportReference,
      };
    }

    const pinActors = [readiness.actors.rolf, readiness.actors.phillip] as const;
    const candidates = await db
      .select({
        id: appUsers.id,
        active: appUsers.active,
        pinHash: appUsers.pinHash,
        role: appUsers.role,
        tenantId: appUsers.tenantId,
      })
      .from(appUsers)
      .where(
        and(
          eq(appUsers.tenantId, APP_TENANT_ID),
          eq(appUsers.active, true),
          inArray(appUsers.id, pinActors.map((actor) => actor.actorId)),
        ),
      );
    const user = resolvePinLoginCandidate(loginHandle, candidates);

    if (!user) {
      return { ok: false, message: "Ungültige PIN oder inaktiver Benutzer." };
    }

    const actor = pinActors.find((candidate) => candidate.actorId === user.id);
    if (!actor || actor.role !== user.role || actor.tenantId !== user.tenantId) {
      return { ok: false, message: "Ungültige PIN oder inaktiver Benutzer." };
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
      return { ok: false, message: "Ungültige PIN oder inaktiver Benutzer." };
    }

    const now = Date.now();
    await setAppSession({
      userId: user.id,
      tenantId: user.tenantId,
      role: actor.role,
      displayName: actor.identity.name,
      issuedAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });

    const lastSeen = await recordUserLastSeenForLogin();
    if (lastSeen.code !== "OK") {
      await clearAppSession();
      return { ok: false, message: "Login konnte nicht sicher bestätigt werden." };
    }

    return { ok: true, role: actor.role };
  } catch {
    console.error("PIN login failed.");
    return { ok: false, message: "Server-Fehler beim Login." };
  }
}
