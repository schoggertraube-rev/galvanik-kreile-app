'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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
  const role = await getCurrentRole()
  if (role !== 'admin' && role !== 'developer') {
    await supabase.auth.signOut()
    redirect('/start?message=Dieser Login ist Administratoren vorbehalten. Bitte nutzen Sie den PIN-Login.')
  }

  revalidatePath('/', 'layout')
  redirect('/admin')
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
