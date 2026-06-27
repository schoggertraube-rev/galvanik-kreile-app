'use server'

import { createClient } from '@/lib/supabase/server'
import { clearAppSession, setAppSession, SESSION_TTL_MS } from '@/lib/server/appSession'
import { resolveLoginIdentityByEmail } from '@/lib/server/authorization'

// ─── Logout-Ergebnistyp ───────────────────────────────────────────────────────
export type LogoutResult = {
  ok: true;
  remoteSignOut: "success" | "failed";
};

// ─── Email-Login ──────────────────────────────────────────────────────────────
export type LoginResult =
  | { ok: true; targetPath: string }
  | { ok: false; message: string };

export async function login(formData: FormData): Promise<LoginResult> {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { ok: false, message: 'E-Mail oder Passwort falsch' }
  }

  // Supabase E-Mail-Identität erfolgreich
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    await supabase.auth.signOut({ scope: "local" })
    return { ok: false, message: 'Systemfehler: Benutzerprofil nicht abrufbar.' }
  }

  // tenantgebundenen app_users-Datensatz laden
  const identityResult = await resolveLoginIdentityByEmail(user.email, 'galvanik-kreile')
  if (!identityResult.ok) {
    await supabase.auth.signOut({ scope: "local" })
    if (identityResult.message.includes("deaktiviert")) {
      return { ok: false, message: 'AUTH_ERROR: Benutzer deaktiviert' }
    }
    if (identityResult.message.includes("gefunden")) {
      return { ok: false, message: 'AUTH_ERROR: Benutzer nicht gefunden' }
    }
    return { ok: false, message: 'Systemfehler: Benutzerprofil nicht abrufbar.' }
  }

  const dbUser = identityResult.data

  // Rolle prüfen (admin/developer only)
  if (dbUser.role !== 'admin' && dbUser.role !== 'developer') {
    await supabase.auth.signOut({ scope: "local" })
    return { ok: false, message: 'Dieser Login ist Administratoren vorbehalten. Bitte nutzen Sie den PIN-Login.' }
  }

  const displayName = dbUser.fullName?.trim()
  if (!displayName) {
    await supabase.auth.signOut({ scope: "local" })
    return { ok: false, message: 'Kein Anzeigename für diesen Benutzer konfiguriert. Bitte Administrator kontaktieren.' }
  }

  // Kanonische App-Session setzen
  const now = Date.now();
  await setAppSession({
    userId: dbUser.id,
    tenantId: dbUser.tenantId,
    role: dbUser.role,
    displayName: displayName,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });

  if (dbUser.role === 'developer') {
    return { ok: true, targetPath: '/settings' }
  } else {
    return { ok: true, targetPath: '/' }
  }
}

// ─── Kanonischer Logout ───────────────────────────────────────────────────────
/**
 * Logout-Action.
 *
 * Vertrag:
 * - Supabase-Remote-Logout wird versucht.
 * - App-Cookie wird in `finally` garantiert gelöscht – unabhängig vom Remote-Logout.
 * - remoteSignOut: "failed" bedeutet nur den Remote-Logout-Fehler, nicht den Logout selbst.
 */
export async function logout(): Promise<LogoutResult> {
  let remoteSignOut: "success" | "failed" = "success";
  try {
    const supabase = await createClient()
    await supabase.auth.signOut({ scope: "local" })
  } catch (error) {
    remoteSignOut = "failed";
    console.warn("Supabase signOut failed, clearing app session cookie anyway:", error)
  } finally {
    await clearAppSession()
  }
  return { ok: true, remoteSignOut }
}
