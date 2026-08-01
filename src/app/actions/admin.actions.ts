'use server'

import { db } from '@/db'
import { appUsers, featureFlags } from '@/db/schema'
import { and, eq, ne, sql } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'
import { requireAdminOrDeveloper } from '@/lib/auth/permissions'
import { toAdminUserDto } from '@/lib/auth/userDtos'
import type { AdminPinStatus } from '@/lib/auth/userDtos'
import {
  isPinLoginRole,
  POSTGRES_BCRYPT_PATTERN,
  validateNewPin,
} from '@/lib/auth/pinPolicy'

const TENANT_ID = 'galvanik-kreile'
const PIN_ASSIGNMENT_LOCK = `${TENANT_ID}:pin-assignment`
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_ROLES = new Set([
  'developer',
  'admin',
  'meister',
  'buero',
  'werkstatt',
  'readonly',
])

class SafeAdminActionError extends Error {}

function assertRole(role: unknown): asserts role is string {
  if (typeof role !== 'string' || !ALLOWED_ROLES.has(role)) {
    throw new Error('Ungültige Benutzerrolle.')
  }
}

function assertUserId(userId: unknown): asserts userId is string {
  if (typeof userId !== 'string' || !UUID_PATTERN.test(userId)) {
    throw new Error('Ungültige Benutzer-ID.')
  }
}

async function assertUniquePin(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  pin: string,
  excludedUserId?: string,
) {
  const conditions = [
    eq(appUsers.tenantId, TENANT_ID),
    sql`(
      (${appUsers.pinHash} ~ '^[0-9]{4}$' AND ${appUsers.pinHash} = ${pin})
      OR (
        ${appUsers.pinHash} ~ ${POSTGRES_BCRYPT_PATTERN}
        AND extensions.crypt(${pin}, ${appUsers.pinHash}) = ${appUsers.pinHash}
      )
    )`,
  ]

  if (excludedUserId) conditions.push(ne(appUsers.id, excludedUserId))

  const [duplicate] = await tx
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(and(...conditions))
    .limit(1)

  if (duplicate) {
    throw new SafeAdminActionError('Diese PIN wird bereits verwendet. Bitte eine eindeutige PIN wählen.')
  }
}

function pinHash(pin: string) {
  return sql<string>`extensions.crypt(${pin}, extensions.gen_salt('bf', 12))`
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
    .select({
      id: appUsers.id,
      email: appUsers.email,
      fullName: appUsers.fullName,
      role: appUsers.role,
      active: appUsers.active,
      location: appUsers.location,
      language: appUsers.language,
      pinStatus: sql<AdminPinStatus>`CASE
        WHEN ${appUsers.role} IN ('developer', 'admin') THEN 'not_applicable'
        WHEN ${appUsers.pinHash} IS NULL THEN 'missing'
        WHEN ${appUsers.pinHash} ~ ${POSTGRES_BCRYPT_PATTERN} THEN 'ready'
        ELSE 'needs_rotation'
      END`,
    })
    .from(appUsers)
    .where(eq(appUsers.tenantId, TENANT_ID))
  return users.map(toAdminUserDto)
}

export async function createUser(data: { email: string, fullName: string, role: string, location?: string, language?: string, pin?: string }) {
  await requireAdminOrDeveloper();
  assertRole(data.role)

  const email = data.email?.trim().toLowerCase()
  const fullName = data.fullName?.trim()
  if (!email || !fullName) throw new Error('Name und E-Mail sind erforderlich.')

  const validatedPin = isPinLoginRole(data.role)
    ? validateNewPin(data.pin)
    : null

  if (validatedPin && !validatedPin.ok) throw new Error(validatedPin.message)

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
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${PIN_ASSIGNMENT_LOCK}, 0))`,
      )

      if (validatedPin?.ok) await assertUniquePin(tx, validatedPin.pin)

      await tx.insert(appUsers).values({
        id: userId,
        tenantId: TENANT_ID,
        email,
        fullName,
        role: data.role,
        location: data.location || null,
        language: data.language || 'de',
        pinHash: validatedPin?.ok ? pinHash(validatedPin.pin) : null,
        active: true,
      })
    })
    return { success: true, userId }
  } catch (error) {
    // Rollback Auth user if DB insert fails
    await supabase.auth.admin.deleteUser(userId)
    if (error instanceof SafeAdminActionError) throw error
    throw new SafeAdminActionError('Benutzer konnte nicht sicher gespeichert werden.')
  }
}

export async function updateUserRole(userId: string, newRole: string) {
  await requireAdminOrDeveloper();
  assertUserId(userId)
  assertRole(newRole)

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${PIN_ASSIGNMENT_LOCK}, 0))`,
    )

    const [user] = await tx
      .select({ id: appUsers.id, role: appUsers.role })
      .from(appUsers)
      .where(and(eq(appUsers.id, userId), eq(appUsers.tenantId, TENANT_ID)))
      .limit(1)

    if (!user) throw new SafeAdminActionError('Benutzer nicht gefunden.')

    await tx
      .update(appUsers)
      .set({
        role: newRole,
        updatedAt: new Date(),
        ...(
          !isPinLoginRole(user.role) || !isPinLoginRole(newRole)
            ? { pinHash: null }
            : {}
        ),
      })
      .where(and(eq(appUsers.id, user.id), eq(appUsers.tenantId, TENANT_ID)))
  })
  return { success: true }
}

export async function updateUserPin(userId: string, newPin: string) {
  await requireAdminOrDeveloper();
  assertUserId(userId)
  const validatedPin = validateNewPin(newPin)
  if (!validatedPin.ok) throw new Error(validatedPin.message)

  try {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${PIN_ASSIGNMENT_LOCK}, 0))`,
      )

      const [user] = await tx
        .select({ id: appUsers.id, role: appUsers.role })
        .from(appUsers)
        .where(and(eq(appUsers.id, userId), eq(appUsers.tenantId, TENANT_ID)))
        .limit(1)

      if (!user) throw new SafeAdminActionError('Benutzer nicht gefunden.')
      if (!isPinLoginRole(user.role)) {
        throw new SafeAdminActionError('Privilegierte Konten verwenden ausschließlich den E-Mail-Login.')
      }

      await assertUniquePin(tx, validatedPin.pin, user.id)
      await tx
        .update(appUsers)
        .set({ pinHash: pinHash(validatedPin.pin), updatedAt: new Date() })
        .where(and(eq(appUsers.id, user.id), eq(appUsers.tenantId, TENANT_ID)))
    })
  } catch (error) {
    // Drizzle errors may contain SQL parameters, including the submitted PIN.
    if (error instanceof SafeAdminActionError) throw error
    throw new SafeAdminActionError('PIN konnte nicht sicher gespeichert werden.')
  }
  return { success: true }
}

export async function toggleUserStatus(userId: string, active: boolean) {
  await requireAdminOrDeveloper();
  assertUserId(userId)
  if (typeof active !== 'boolean') throw new Error('Ungültiger Aktivstatus.')
  await db
    .update(appUsers)
    .set({ active, updatedAt: new Date() })
    .where(and(eq(appUsers.id, userId), eq(appUsers.tenantId, TENANT_ID)))
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
