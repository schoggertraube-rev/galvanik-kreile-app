'use server'

import { db } from '@/db'
import { appUsers, featureFlags, pinRateLimits } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { requireAdminOrDeveloper } from '@/lib/auth/permissions'
import { isAppRole } from '@/lib/auth/authorizationContract'
import { toAdminUserDto } from '@/lib/auth/userDtos'
import { APP_TENANT_ID } from '@/lib/server/appSession'

const PIN_HASH_ROUNDS = 12

function validatePin(pin: unknown): string {
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    throw new Error('PIN muss aus genau vier Ziffern bestehen.')
  }
  return pin
}

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
  await requireAdminOrDeveloper();
  const users = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.tenantId, APP_TENANT_ID))
  return users.map(toAdminUserDto)
}

export async function createUser(data: { email: string, fullName: string, role: string, location?: string, language?: string, pin: string }) {
  await requireAdminOrDeveloper();
  const pin = validatePin(data.pin)
  if (!isAppRole(data.role)) {
    throw new Error('Ungültige Benutzerrolle.')
  }
  const email = data.email.trim()
  const fullName = data.fullName.trim()
  if (!email || !fullName) {
    throw new Error('Name und E-Mail sind erforderlich.')
  }
  const pinHash = await bcrypt.hash(pin, PIN_HASH_ROUNDS)
  const supabase = getAdminSupabase()
  
  // 1. Create user in Supabase Auth
  // We use admin.createUser which also skips email confirmation if desired.
  // For production, you might want email_confirm: true to send a Magic Link.
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
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
      tenantId: APP_TENANT_ID,
      email,
      fullName,
      role: data.role,
      location: data.location || null,
      language: data.language || 'de',
      pinHash,
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
  await requireAdminOrDeveloper();
  if (!isAppRole(newRole)) {
    throw new Error('Ungültige Benutzerrolle.')
  }
  await db
    .update(appUsers)
    .set({ role: newRole, updatedAt: new Date() })
    .where(and(eq(appUsers.id, userId), eq(appUsers.tenantId, APP_TENANT_ID)))
  return { success: true }
}

export async function updateUserPin(userId: string, newPin: string) {
  await requireAdminOrDeveloper();
  const pinHash = await bcrypt.hash(validatePin(newPin), PIN_HASH_ROUNDS)
  const updatedAt = new Date()

  await db.transaction(async (tx) => {
    const [updatedUser] = await tx
      .update(appUsers)
      .set({ pinHash, updatedAt })
      .where(and(eq(appUsers.id, userId), eq(appUsers.tenantId, APP_TENANT_ID)))
      .returning({ id: appUsers.id })

    if (!updatedUser) {
      throw new Error('Benutzer nicht gefunden.')
    }

    await tx
      .delete(pinRateLimits)
      .where(eq(pinRateLimits.operatorId, updatedUser.id))
  })
  return { success: true }
}

export async function toggleUserStatus(userId: string, active: boolean) {
  await requireAdminOrDeveloper();
  await db
    .update(appUsers)
    .set({ active, updatedAt: new Date() })
    .where(and(eq(appUsers.id, userId), eq(appUsers.tenantId, APP_TENANT_ID)))
  return { success: true }
}

// ── Feature Flags ───────────────────────────────────────────────────────

export async function getFeatureFlags() {
  await requireAdminOrDeveloper();
  return await db.select().from(featureFlags)
}

export async function toggleFeatureFlag(id: string, enabled: boolean) {
  await requireAdminOrDeveloper();
  await db.update(featureFlags).set({ enabled }).where(eq(featureFlags.id, id))
  return { success: true }
}

export async function updateFeatureFlagRoles(id: string, rolesAllowed: string[]) {
  await requireAdminOrDeveloper();
  await db.update(featureFlags).set({ rolesAllowed }).where(eq(featureFlags.id, id))
  return { success: true }
}

export async function initializeDefaultFlags() {
  await requireAdminOrDeveloper();
  const defaults = [
    { id: 'module_performance', name: 'Performance Dashboard', description: 'Erweiterte Statistiken', enabled: true },
    { id: 'module_archiv', name: 'Archiv', description: 'Zugriff auf abgeschlossene Aufträge', enabled: true },
    { id: 'module_scan', name: 'Scan/Kamera', description: 'Schnellannahme per OCR', enabled: true },
    { id: 'module_portal', name: 'Kundenportal', description: 'Externer Kunden-Login', enabled: false },
    { id: 'module_payment', name: 'Zahlungsmodul', description: 'Rechnungen & Zahlungen', enabled: false },
    // Permissions System
    { id: 'perm_sys_toggles', name: 'Feature-Toggles steuern', description: 'System', enabled: true, rolesAllowed: ['developer'] },
    { id: 'perm_sys_diag', name: 'Diagnose & Tests', description: 'System', enabled: true, rolesAllowed: ['developer', 'admin'] },
    { id: 'perm_sys_users', name: 'Benutzer verwalten', description: 'System', enabled: true, rolesAllowed: ['developer', 'admin'] },
    // Permissions Daten & Import
    { id: 'perm_data_csv', name: 'CSV Massenimport', description: 'Daten & Import', enabled: true, rolesAllowed: ['developer', 'admin'] },
    { id: 'perm_data_customers', name: 'Kunden anlegen/löschen', description: 'Daten & Import', enabled: true, rolesAllowed: ['developer', 'admin', 'buero'] },
    { id: 'perm_data_orders', name: 'Aufträge anlegen', description: 'Daten & Import', enabled: true, rolesAllowed: ['developer', 'admin', 'buero', 'meister'] },
    // Permissions Operativ
    { id: 'perm_op_status', name: 'Auftragsstatus ändern', description: 'Operativ (Werkstatt)', enabled: true, rolesAllowed: ['developer', 'admin', 'meister', 'werkstatt'] },
    { id: 'perm_op_risk', name: 'Priorität / Risiko ändern', description: 'Operativ (Werkstatt)', enabled: true, rolesAllowed: ['developer', 'admin', 'meister'] },
    { id: 'perm_op_photos', name: 'Fotos hochladen', description: 'Operativ (Werkstatt)', enabled: true, rolesAllowed: ['developer', 'admin', 'meister', 'werkstatt'] },
    { id: 'perm_op_qa', name: 'Qualitätskontrolle', description: 'Operativ (Werkstatt)', enabled: true, rolesAllowed: ['developer', 'admin', 'meister'] },
    // Permissions Ansicht
    { id: 'perm_view_leitstand', name: 'Leitstand sehen', description: 'Ansicht', enabled: true, rolesAllowed: ['developer', 'admin', 'meister', 'buero', 'werkstatt', 'readonly'] },
    { id: 'perm_view_customers', name: 'Kundendaten sehen', description: 'Ansicht', enabled: true, rolesAllowed: ['developer', 'admin', 'meister', 'buero', 'werkstatt', 'readonly'] },
    { id: 'perm_view_prices', name: 'Preise und Rechnungen sehen', description: 'Ansicht', enabled: true, rolesAllowed: ['developer', 'admin', 'buero'] },
  ];
  
  for (const flag of defaults) {
    await db.insert(featureFlags).values(flag).onConflictDoNothing()
  }
  return { success: true }
}
