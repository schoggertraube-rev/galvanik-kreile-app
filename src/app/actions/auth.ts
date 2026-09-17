"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import {
  clearAppSession,
  setAppSession,
  SESSION_TTL_MS,
} from "@/lib/server/appSession";
import { resolveLoginIdentityByEmail } from "@/lib/server/authorization";
import {
  readProductActorReadiness,
  reportProductActorOperationalFailure,
} from "@/lib/server/productActorReadiness";
import { recordUserLastSeenForLogin } from "@/lib/server/userLastSeen";

export type LogoutResult = {
  ok: true;
  remoteSignOut: "success" | "failed";
};

function redirectToStart(message: string, supportReference?: string): never {
  const query = new URLSearchParams({ message });
  if (supportReference) query.set("support", supportReference);
  redirect(`/start?${query.toString()}`);
}

export async function login(formData: FormData) {
  const readiness = await readProductActorReadiness();
  if (!readiness.ok) {
    redirectToStart(
      "Anmeldung ist momentan nicht sicher verfügbar.",
      readiness.supportReference,
    );
  }

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
  const actor = readiness.actors.gregor;
  if (
    dbUser.id !== actor.actorId ||
    dbUser.tenantId !== actor.tenantId ||
    dbUser.role !== actor.role
  ) {
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
    userId: actor.actorId,
    tenantId: actor.tenantId,
    role: actor.role,
    displayName: actor.identity.name,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });

  const lastSeen = await recordUserLastSeenForLogin();
  if (lastSeen.code !== "OK") {
    await clearAppSession();
    await supabase.auth.signOut();
    redirectToStart("Login konnte nicht sicher bestätigt werden.");
  }

  revalidatePath("/", "layout");
  redirect("/settings");
}

/**
 * Logout always clears the app cookie, even if remote Supabase logout fails.
 */
export async function logout(): Promise<LogoutResult> {
  let remoteSignOut: "success" | "failed" = "success";
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    remoteSignOut = "failed";
    console.warn("Supabase signOut failed; app session cookie will still be cleared.");
  } finally {
    await clearAppSession();
  }
  return { ok: true, remoteSignOut };
}
