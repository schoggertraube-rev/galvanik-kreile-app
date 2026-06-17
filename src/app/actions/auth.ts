'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { clearAppSession } from '@/lib/server/appSession'
import { getCurrentRole } from '@/lib/auth/roles'

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

  // Security Check: Is this an Admin/Developer?
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

  revalidatePath('/', 'layout')

  if (role === 'developer') {
    redirect('/settings')
  } else {
    redirect('/')
  }
}

/**
 * Kanonische Logout-Action.
 * Löscht die App-Session garantiert, auch wenn Supabase-Logout fehlschlägt.
 */
export async function logout(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch (error) {
    // Supabase-Fehler wird geloggt, Cookie-Bereinigung erfolgt trotzdem
    console.warn("Supabase signOut failed, clearing app session cookie anyway:", error)
  } finally {
    await clearAppSession()
  }
  return { ok: true }
}
