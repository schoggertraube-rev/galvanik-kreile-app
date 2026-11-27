"use server";
import type {PackageSwitchValues} from "@/modules/fundament/public";
import {logTechnical} from '@/modules/logging/server-public';
import {actionObservationActive,withActionObservation} from '@/lib/server/actionObservation';
import {getAuthBootstrapState,readCacheLoginScope,type AuthBootstrapState} from '@/lib/server/authBootstrap';

import bcrypt from "bcryptjs";
import {withPageReadPhase} from '@/db/readBudget';
import {PIN_LOGIN_COPY} from "@/ui/situationCatalog";
import { offlinePartition } from "@/lib/server/offlinePartition";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import type {
  AccessArea,
  AppRole,
  AuthorizationActionGrants,
  PermissionKey,
} from "@/lib/auth/authorizationContract";
import { canUsePinLogin } from "@/lib/auth/authorizationContract";
import type { SessionActivityResult, SessionInactivity } from '@/lib/auth/sessionInactivity';
import {
  APP_TENANT_ID,
  clearAppSession,
  renewAppSessionActivity,
  setAppSession,
  SESSION_TTL_MS,
} from "@/lib/server/appSession";
import type {PrivilegedTenantTransaction} from "@/lib/server/privilegedDb";
import {trustedPinClientIp, runPinAttempt } from "@/lib/server/pinRateLimit";
import {
  isValidPinLoginHandle,
  resolvePinLoginCandidate,
} from "@/lib/server/pinLoginHandle";
import {
  getAuthorizationActionGrants,
  resolveAuthorization,
} from "@/lib/server/authorization";
import { recordUserLastSeenForLogin } from "@/lib/server/userLastSeen";

export type ClientAuthorizationResult =
  | {
      ok: true;
      data: {
        displayName: string;
        offlineScope?: string;
        offline24h?:boolean;
        packageSwitches?:Readonly<PackageSwitchValues>;
        inactivity?: SessionInactivity;
        role: AppRole;
        areas: readonly AccessArea[];
        permissions: readonly PermissionKey[];
        actions: AuthorizationActionGrants;
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

/** Same bootstrap source and S20 sink for the actual first server render. */
export async function getAuthBootstrapAction():Promise<AuthBootstrapState>{
 return actionObservationActive()?getAuthBootstrapState():withActionObservation(getAuthBootstrapState,logTechnical);
}
export async function getAuthorizationSnapshotAction(): Promise<ClientAuthorizationResult> {
 return actionObservationActive()?readClientAuthorizationSnapshot():withActionObservation(readClientAuthorizationSnapshot,logTechnical);
}

/** Only the currently authorized signed session can acknowledge an interaction. */
export async function recordAppSessionActivity(sessionScope: string): Promise<SessionActivityResult> {
  if (typeof sessionScope !== 'string' || !/^[a-f0-9]{64}$/.test(sessionScope)) return { code: 'EXPIRED' };
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return { code: authorization.reason === 'AUTHORIZATION_UNAVAILABLE' ? 'UNAVAILABLE' : 'EXPIRED' };
  const current = authorization.data.sessionInactivity;
  if (!current) return { code: 'UNAVAILABLE' };
  const now = await renewAppSessionActivity({ userId: authorization.data.userId, issuedAt: current.issuedAt, sessionScope }, current);
  return now ? { code: 'OK', inactivity: now } : { code: 'EXPIRED' };
}

async function readClientAuthorizationSnapshot():Promise<ClientAuthorizationResult>{
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

  const inactivity = result.data.sessionInactivity;
  const sessionScope = inactivity ? await readCacheLoginScope() : undefined;
  return {
    ok: true,
    data: {
      displayName: result.data.displayName,
      ...(inactivity ? { inactivity: { lastSeen: inactivity.lastSeen, expiresAt: inactivity.expiresAt, minutes: inactivity.minutes, serverAt: inactivity.serverAt, sessionScope } } : {}),
      // Local partition only, never a credential; preserves existing intake originals.
      offlineScope: offlinePartition(result.data),
      offline24h: result.data.offline24h===true,
      ...(result.data.packageSwitches?{packageSwitches:{...result.data.packageSwitches}}:{}),
      role: result.data.role,
      areas: result.data.areas ?? [],
      permissions: result.data.permissions,
      actions: getAuthorizationActionGrants(result.data),
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
  tx:PrivilegedTenantTransaction,
): Promise<boolean> {
  const storedHash=user.pinHash;
  if (!storedHash) return false;

  if (storedHash.startsWith("$2")) {
    return withPageReadPhase('auth.bcrypt',()=>bcrypt.compare(pin, storedHash));
  }

  if (storedHash !== pin) return false;

  const hashed = await withPageReadPhase('auth.bcrypt',()=>bcrypt.hash(pin, 12));
  const updatedAt = new Date();
  await tx
    .update(appUsers)
    .set({ pinHash: hashed, updatedAt })
    .where(
      and(
        eq(appUsers.id, user.id),
        eq(appUsers.tenantId, APP_TENANT_ID),
        eq(appUsers.pinHash, storedHash),
      ),
    );

  return true;
}

/** Bounded identifiers only: no query, values, PIN, details or stack. */
function pinLoginFailureDetails(error: unknown): { name: string; code: string | null } {
  try {
    const names = new Set(["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "AggregateError", "DrizzleQueryError", "PostgresError", "DatabaseError"]);
    const ownName = error !== null && typeof error === "object" ? Object.getOwnPropertyDescriptor(error, "name")?.value : undefined;
    const name = typeof ownName === "string" && names.has(ownName) ? ownName : error instanceof Error ? "Error" : "UnknownError";
    const seen = new Set<object>();
    let current: unknown = error;
    for (let depth = 0; depth < 4 && current !== null && typeof current === "object" && !seen.has(current); depth++) {
      seen.add(current);
      const code = Object.getOwnPropertyDescriptor(current, "code")?.value;
      if (typeof code === "string" && /^(?:[0-9A-Z]{5}|E(?:CONNRESET|CONNREFUSED|TIMEDOUT|PIPE|AI_AGAIN|NOTFOUND))$/.test(code)) return { name, code };
      current = Object.getOwnPropertyDescriptor(current, "cause")?.value;
    }
    return { name, code: null };
  } catch {
    // Even a malformed diagnostic object must preserve the caught login result.
    return { name: "UnknownError", code: null };
  }
}

/** PIN login for every active tenant user exposed on the start screen. */
export async function loginWithPin(
  loginHandle: string,
  pin: string,
  tabletInput?: 'tablet',
): Promise<
  | { ok: true; role: AppRole }
  | { ok: false; message: string; supportReference?: string }
> {
  try {
    if (!isValidPinLoginHandle(loginHandle) || !/^\d{4}$/.test(pin)) {
      return { ok: false, message: "Code falsch · bitte neu eingeben" };
    }

    const candidates = await withPageReadPhase('auth.candidates',()=>db
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
      ));
    const user = resolvePinLoginCandidate(loginHandle, candidates);

    const loginRole=user&&canUsePinLogin(user.role)?user.role:null;
    const eligible=user!==undefined&&user!==null&&loginRole!==null&&user.tenantId===APP_TENANT_ID;
    const clientIp=process.env.VERCEL==='1'?trustedPinClientIp(await (await import('next/headers')).headers()):null;

    const pinAttempt = await withPageReadPhase('auth.tx',()=>runPinAttempt(
      eligible?user.id:null,
      async (tx) => {
        if(!eligible)return false;
        // A PIN reset uses the same operator lock. Read its persisted value
        // after obtaining that lock, never verify a previously read old PIN.
        const [current] = await tx.select({id:appUsers.id,pinHash:appUsers.pinHash})
          .from(appUsers).where(and(eq(appUsers.id,user.id),eq(appUsers.tenantId,APP_TENANT_ID),eq(appUsers.active,true)));
        return current ? verifyAndMigratePin(current,pin,tx) : false;
      },
      clientIp,
    ));
    if (pinAttempt.status === "blocked") {
      return {
        ok: false,
        message: PIN_LOGIN_COPY.blocked(new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date(pinAttempt.retryAtMs))),
      };
    }

    if (pinAttempt.status === "invalid") {
      return { ok: false, message: "Code falsch · bitte neu eingeben" };
    }

    if(!eligible||loginRole===null)throw Error("PIN_IDENTITY_REQUIRED");
    const now = Date.now();
    await setAppSession({
      userId: user.id,
      tenantId: user.tenantId,
      role: loginRole,
      displayName: user.fullName,
      issuedAt: now,
      expiresAt: now + SESSION_TTL_MS,
    }, tabletInput === 'tablet' ? tabletInput : undefined);

    const lastSeen = await withPageReadPhase('auth.last_seen',()=>recordUserLastSeenForLogin());
    if (lastSeen.code !== "OK") {
      await clearAppSession();
      return { ok: false, message: "Login konnte nicht sicher bestätigt werden." };
    }

    return { ok: true, role: loginRole };
  } catch (error) {
    console.error("PIN login failed.", pinLoginFailureDetails(error));
    return { ok: false, message: PIN_LOGIN_COPY.unavailable };
  }
}
