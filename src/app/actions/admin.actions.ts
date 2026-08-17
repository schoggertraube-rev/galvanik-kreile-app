'use server'

import { db } from '@/db'
import { appUsers, featureFlags } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAdminOrDeveloper } from '@/lib/auth/permissions'
import { toAdminUserDto } from '@/lib/auth/userDtos'
import { APP_TENANT_ID } from '@/lib/server/appSession'

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
  void data
  throw new Error("NOT_AVAILABLE: Sichere Benutzerverwaltung benötigt den W3-Command-Vertrag.");
}

export async function updateUserRole(userId: string, newRole: string) {
  await requireAdminOrDeveloper();
  void userId
  void newRole
  throw new Error("NOT_AVAILABLE: Sichere Benutzerverwaltung benötigt den W3-Command-Vertrag.");
}

export async function updateUserPin(userId: string, newPin: string) {
  await requireAdminOrDeveloper();
  void userId
  void newPin
  throw new Error("NOT_AVAILABLE: Sichere Benutzerverwaltung benötigt den W3-Command-Vertrag.");
}

export async function toggleUserStatus(userId: string, active: boolean) {
  await requireAdminOrDeveloper();
  void userId
  void active
  throw new Error("NOT_AVAILABLE: Sichere Benutzerverwaltung benötigt den W3-Command-Vertrag.");
}

// ── Feature Flags ───────────────────────────────────────────────────────

export async function getFeatureFlags() {
  await requireAdminOrDeveloper();
  return await db.select().from(featureFlags)
}

export async function toggleFeatureFlag(id: string, enabled: boolean) {
  await requireAdminOrDeveloper();
  void id
  void enabled
  throw new Error("NOT_AVAILABLE: Sichere Feature- und Rollenverwaltung benötigt den W3-Command-Vertrag.");
}

export async function updateFeatureFlagRoles(id: string, rolesAllowed: string[]) {
  await requireAdminOrDeveloper();
  void id
  void rolesAllowed
  throw new Error("NOT_AVAILABLE: Sichere Feature- und Rollenverwaltung benötigt den W3-Command-Vertrag.");
}

export async function initializeDefaultFlags() {
  await requireAdminOrDeveloper();
  throw new Error("NOT_AVAILABLE: Sichere Feature- und Rollenverwaltung benötigt den W3-Command-Vertrag.");
}
