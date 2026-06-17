'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { clearAppSession, setAppSession, SESSION_TTL_MS } from '@/lib/server/appSession'
import { getCurrentRole, getCurrentAppUser } from '@/lib/auth/roles'

// ─── Logout-Ergebnistyp ───────────────────────────────────────────────────────
export type LogoutResult = {
  ok: true;
  remoteSignOut: "success" | "failed";
};

// ─── Email-Login ──────────────────────────────────────────────────────────────
export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/start?message=E-Mail oder Passwort falsch')
  }

  // Rollenprüfung (admin/developer only)
  let role: string | null = null;

  try {
    role = await getCurrentRole()
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.startsWith("DATABASE_ERROR")) {
      await supabase.auth.signOut()
      redirect('/start?message=Systemfehler: Datenbank nicht erreichbar (Rollenprüfung fehlgeschlagen).')
    } else {
      throw err;
    }
  }

  if (role !== 'admin' && role !== 'developer') {
    await supabase.auth.signOut()
    redirect('/start?message=Dieser Login ist Administratoren vorbehalten. Bitte nutzen Sie den PIN-Login.')
  }

  // AppUser laden für displayName
  let appUser: Awaited<ReturnType<typeof getCurrentAppUser>> = null;
  try {
    appUser = await getCurrentAppUser();
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("AppUser lookup failed after successful email login:", {
      message: errMsg,
    });
    await supabase.auth.signOut()
    redirect('/start?message=Systemfehler: Benutzerprofil nicht abrufbar.')
  }

  const displayName = appUser?.fullName?.trim();
  if (!displayName) {
    await supabase.auth.signOut()
    redirect('/start?message=Kein Anzeigename für diesen Benutzer konfiguriert. Bitte Administrator kontaktieren.')
  }

  // Kanonische App-Session setzen
  const now = Date.now();
  await setAppSession({
    userId: appUser!.id,
    tenantId: 'galvanik-kreile',
    role: role!,
    displayName: displayName!,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });

  revalidatePath('/', 'layout')

  if (role === 'developer') {
    redirect('/settings')
  } else {
    redirect('/')
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
    await supabase.auth.signOut()
  } catch (error) {
    remoteSignOut = "failed";
    console.warn("Supabase signOut failed, clearing app session cookie anyway:", error)
  } finally {
    await clearAppSession()
  }
  return { ok: true, remoteSignOut }
}
