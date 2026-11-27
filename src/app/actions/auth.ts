"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import {
  clearAppSession,
  restoreAppSessionReadScope,
  setAppSession,
  SESSION_TTL_MS,
} from "@/lib/server/appSession";
import { hasAuthorizationArea, resolveAuthorization, resolveLoginIdentityByEmail } from "@/lib/server/authorization";
import { readCacheLoginScope } from '@/lib/server/authBootstrap';
import type { SessionInactivity } from '@/lib/auth/sessionInactivity';
import {
  reportProductActorOperationalFailure,
} from "@/lib/server/productActorReadiness";
import { recordUserLastSeenForLogin } from "@/lib/server/userLastSeen";

export type LogoutResult = {
  ok: true;
  remoteSignOut: "success" | "failed";
};

export type InactivityLogoutResult = LogoutResult
  | { ok: false; code: 'ACTIVE'; inactivity: SessionInactivity }
  | { ok: false; code: 'SESSION_CHANGED' };

function redirectToStart(message: string, supportReference?: string): never {
  const query = new URLSearchParams({ message, mode: "email" });
  if (supportReference) query.set("support", supportReference);
  redirect(`/start?${query.toString()}`);
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);
  if (error) {
    redirectToStart("E-Mail oder Passwort falsch");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    await supabase.auth.signOut();
    redirectToStart("Benutzerprofil konnte nicht sicher bestätigt werden.");
  }

  const identityResult = await resolveLoginIdentityByEmail(
    user.email,
    KREILE_TENANT_SLUG,
  );
  if (!identityResult.ok) {
    await supabase.auth.signOut();
    redirectToStart("Benutzerprofil konnte nicht sicher bestätigt werden.");
  }

  const dbUser = identityResult.data;
  if (!hasAuthorizationArea(dbUser, "wartung")) {
    await supabase.auth.signOut();
    const supportReference = reportProductActorOperationalFailure(
      "EMAIL_LOGIN_IDENTITY_MISMATCH",
    );
    redirectToStart(
      "Dieser Zugang ist nicht für die Systemadministration freigegeben.",
      supportReference,
    );
  }

  const now = Date.now();
  await setAppSession({
    userId: dbUser.id,
    tenantId: dbUser.tenantId,
    role: dbUser.role,
    displayName: dbUser.fullName,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  }, formData.get('tabletInput') === 'tablet' ? 'tablet' : undefined);

  const lastSeen = await recordUserLastSeenForLogin();
  if (lastSeen.code !== "OK") {
    await clearAppSession();
    await supabase.auth.signOut();
    redirectToStart("Login konnte nicht sicher bestätigt werden.");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Explicit logout keeps its normal scope. A deadline can only end its own idle session.
 */
export async function logout(): Promise<LogoutResult>;
export async function logout(input: { sessionScope: string | undefined }): Promise<InactivityLogoutResult>;
export async function logout(input?: { sessionScope: string | undefined }): Promise<InactivityLogoutResult> {
  if (input !== undefined) {
    const expected = input?.sessionScope;
    const changed = { ok: false, code: 'SESSION_CHANGED' } as const;
    if (!expected || !/^[a-f0-9]{64}$/.test(expected) || await readCacheLoginScope() !== expected) return changed;
    const current = await resolveAuthorization();
    if (current.ok) {
      const inactivity = current.data.sessionInactivity;
      if (!inactivity || !await restoreAppSessionReadScope(expected)) return changed;
      return { ok: false, code: 'ACTIVE', inactivity: {
        lastSeen: inactivity.lastSeen, expiresAt: inactivity.expiresAt, minutes: inactivity.minutes,
        serverAt: inactivity.serverAt, sessionScope: expected,
      } };
    }
    if (current.reason !== 'INVALID_SESSION' || current.message !== 'AUTH_SESSION_INACTIVE') return changed;
  }
  let remoteSignOut: "success" | "failed" = "success";
  try {
    // A response from the old session can arrive after a new login in another tab.
    const supabase = input !== undefined ? await createClient({ writeCookies: false }) : await createClient();
    const result = input !== undefined
      ? await supabase.auth.signOut({ scope: 'local' })
      : await supabase.auth.signOut();
    if (result.error) return { ok: true, remoteSignOut: "failed" };
  } catch {
    remoteSignOut = "failed";
    console.warn("Supabase signOut failed.");
  } finally {
    if (input === undefined) await clearAppSession();
  }
  return { ok: true, remoteSignOut };
}
