'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

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
  } catch (err: any) {
    if (err.message?.startsWith("DATABASE_ERROR")) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("DB failed during email login. Setting dev mode admin cookie.");
        role = "admin";
        const cookieStore = await cookies();
        cookieStore.set("bypass-auth", "true", { path: "/" });
        cookieStore.set("kreile_role", "admin", { path: "/" });
      } else {
        await supabase.auth.signOut()
        redirect('/start?message=Systemfehler: Datenbank nicht erreichbar (Rollenprüfung fehlgeschlagen).')
      }
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

export async function logout() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch (error) {
    console.warn("Supabase signout failed (maybe not configured), redirecting anyway...", error)
  }
  redirect('/start')
}
