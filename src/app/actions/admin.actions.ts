'use server'

import { db } from '@/db'
import { appUsers, featureFlags } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'
import { requireAdminOrDeveloper } from '@/lib/auth/permissions'
import { toAdminUserDto } from '@/lib/auth/userDtos'
import { hash } from 'bcryptjs'
import { canUsePinLoginRole, isAppRole, type AppRole } from '@/lib/auth/authorizationContract'
import { resolveAuthorization } from '@/lib/server/authorization'

const PIN_PATTERN = /^\d{4}$/
const TENANT_ID = 'galvanik-kreile'

type UserAdminActor = {
  tenantId: typeof TENANT_ID
  role: AppRole
}

async function requireUserAdminActor(): Promise<UserAdminActor> {
  const authorization = await resolveAuthorization()
  if (
    !authorization.ok ||
    authorization.data.tenantId !== TENANT_ID ||
    !authorization.data.permissions.includes('perm_sys_users')
  ) {
    throw new Error('AUTH_ERROR: Benutzerverwaltung nicht erlaubt.')
  }
  return { tenantId: TENANT_ID, role: authorization.data.role }
}

function assertMayManageRole(actor: UserAdminActor, targetRole: AppRole): void {
  if (actor.role !== 'developer' && targetRole === 'developer') {
    throw new Error('AUTH_ERROR: Entwicklerkonten dürfen nur von Entwicklern verwaltet werden.')
  }
}

async function getManagedTarget(actor: UserAdminActor, userId: string): Promise<{ role: AppRole }> {
  const [target] = await db
    .select({ role: appUsers.role })
    .from(appUsers)
    .where(and(eq(appUsers.id, userId), eq(appUsers.tenantId, actor.tenantId)))
  if (!target || !isAppRole(target.role)) {
    throw new Error('Benutzer nicht gefunden.')
  }
  assertMayManageRole(actor, target.role)
  return { role: target.role }
}

function assertSingleUserReceipt(rows: Array<{ id: string }>, userId: string): void {
  if (rows.length !== 1 || rows[0]?.id !== userId) {
    throw new Error('USER_MUTATION_RECEIPT_MISSING')
  }
}

function assertValidPin(pin: string): void {
  if (!PIN_PATTERN.test(pin)) {
    throw new Error('PIN muss exakt vier Ziffern enthalten.')
  }
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
  const actor = await requireUserAdminActor()
  const users = await db.select().from(appUsers).where(eq(appUsers.tenantId, actor.tenantId))
  return users.map(toAdminUserDto)
}

export async function createUser(data: { email: string, fullName: string, role: string, location?: string, language?: string, pin?: string }) {
  const actor = await requireUserAdminActor()
  if (!isAppRole(data.role)) {
    throw new Error('Ungültige Rolle.')
  }
  assertMayManageRole(actor, data.role)

  const pinAllowed = canUsePinLoginRole(data.role)
  if (pinAllowed && !data.pin) {
    throw new Error('Für diese Rolle ist eine PIN erforderlich.')
  }
  if (!pinAllowed && data.pin) {
    throw new Error('Für diese Rolle ist keine PIN erlaubt.')
  }
  if (data.pin) assertValidPin(data.pin)
  const pinHash = data.pin ? await hash(data.pin, 12) : null
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
    const insertedRows = await db.insert(appUsers).values({
      id: userId,
      tenantId: actor.tenantId,
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      location: data.location || null,
      language: data.language || 'de',
      pinHash,
      active: true,
    }).returning({ id: appUsers.id })
    assertSingleUserReceipt(insertedRows, userId)
    return { success: true, userId }
  } catch (error) {
    // Rollback Auth user if DB insert fails
    await supabase.auth.admin.deleteUser(userId)
    throw error
  }
}

export async function updateUserRole(userId: string, newRole: string) {
  const actor = await requireUserAdminActor()
  if (!isAppRole(newRole)) {
    throw new Error('Ungültige Rolle.')
  }
  assertMayManageRole(actor, newRole)
  const target = await getManagedTarget(actor, userId)
  const updatedRows = await db.update(appUsers).set({
    role: newRole,
    ...(canUsePinLoginRole(newRole) ? {} : { pinHash: null }),
  }).where(and(
    eq(appUsers.id, userId),
    eq(appUsers.tenantId, actor.tenantId),
    eq(appUsers.role, target.role),
  )).returning({ id: appUsers.id })
  assertSingleUserReceipt(updatedRows, userId)
  return { success: true }
}

export async function updateUserPin(userId: string, newPin: string) {
  const actor = await requireUserAdminActor()
  assertValidPin(newPin)
  const target = await getManagedTarget(actor, userId)
  if (!canUsePinLoginRole(target.role)) {
    throw new Error('Benutzer nicht gefunden oder PIN für Rolle nicht erlaubt.')
  }
  const updatedRows = await db.update(appUsers).set({ pinHash: await hash(newPin, 12) }).where(and(
    eq(appUsers.id, userId),
    eq(appUsers.tenantId, actor.tenantId),
    eq(appUsers.role, target.role),
  )).returning({ id: appUsers.id })
  assertSingleUserReceipt(updatedRows, userId)
  return { success: true }
}

export async function toggleUserStatus(userId: string, active: boolean) {
  const actor = await requireUserAdminActor()
  const target = await getManagedTarget(actor, userId)
  const updatedRows = await db.update(appUsers).set({ active }).where(and(
    eq(appUsers.id, userId),
    eq(appUsers.tenantId, actor.tenantId),
    eq(appUsers.role, target.role),
  )).returning({ id: appUsers.id })
  assertSingleUserReceipt(updatedRows, userId)
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
