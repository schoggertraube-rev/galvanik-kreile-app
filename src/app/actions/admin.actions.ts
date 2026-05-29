'use server'

import { db } from '@/db'
import { appUsers, featureFlags, importJobs, importJobRows } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'

// Admin client using Service Role Key (MUST ONLY BE USED IN SERVER ACTIONS)
const getAdminSupabase = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined');
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// ── Users ──────────────────────────────────────────────────────────────

export async function getUsers() {
  const users = await db.select().from(appUsers)
  return users
}

export async function createUser(data: { email: string, fullName: string, role: string, location?: string, language?: string }) {
  const supabase = getAdminSupabase()
  
  // 1. Create user in Supabase Auth
  // We use admin.createUser which also skips email confirmation if desired.
  // For production, you might want email_confirm: true to send a Magic Link.
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: data.email,
    email_confirm: true,
  })

  if (authError) {
    console.error("Supabase Auth Error:", authError)
    throw new Error(`Failed to create user in Auth: ${authError.message}`)
  }

  const userId = authData.user.id

  // 2. Create user in app_users
  try {
    await db.insert(appUsers).values({
      id: userId,
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      location: data.location || null,
      language: data.language || 'de',
      active: true,
    })
    return { success: true, userId }
  } catch (error) {
    // Rollback Auth user if DB insert fails
    await supabase.auth.admin.deleteUser(userId)
    throw error
  }
}

export async function updateUserRole(userId: string, newRole: string) {
  await db.update(appUsers).set({ role: newRole }).where(eq(appUsers.id, userId))
  return { success: true }
}

export async function toggleUserStatus(userId: string, active: boolean) {
  await db.update(appUsers).set({ active }).where(eq(appUsers.id, userId))
  return { success: true }
}

// ── Feature Flags ───────────────────────────────────────────────────────

export async function getFeatureFlags() {
  return await db.select().from(featureFlags)
}

export async function toggleFeatureFlag(id: string, enabled: boolean) {
  await db.update(featureFlags).set({ enabled }).where(eq(featureFlags.id, id))
  return { success: true }
}

export async function initializeDefaultFlags() {
  const defaults = [
    { id: 'module_performance', name: 'Performance Dashboard', description: 'Erweiterte Statistiken', enabled: true },
    { id: 'module_archiv', name: 'Archiv', description: 'Zugriff auf abgeschlossene Aufträge', enabled: true },
    { id: 'module_scan', name: 'Scan/Kamera', description: 'Schnellannahme per OCR', enabled: true },
    { id: 'module_portal', name: 'Kundenportal', description: 'Externer Kunden-Login', enabled: false },
    { id: 'module_payment', name: 'Zahlungsmodul', description: 'Rechnungen & Zahlungen', enabled: false },
  ]
  
  for (const flag of defaults) {
    await db.insert(featureFlags).values(flag).onConflictDoNothing()
  }
  return { success: true }
}
