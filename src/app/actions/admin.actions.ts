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
