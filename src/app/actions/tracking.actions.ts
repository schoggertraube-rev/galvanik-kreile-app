'use server'

import { and, desc, eq, gte } from 'drizzle-orm'
import { db } from '@/db'
import { appUsageEvents } from '@/db/schema'
import { resolveAuthorization } from '@/lib/server/authorization'

async function requireDiagnostics() {
  const authorization = await resolveAuthorization()
  if (!authorization.ok || authorization.data.tenantId !== 'galvanik-kreile' || !authorization.data.permissions.includes('perm_sys_diag')) {
    throw new Error('AUTH_ERROR: Forbidden')
  }
  return authorization.data
}

/** Legacy arbitrary-payload writes are deliberately disabled. */
export async function logUiEvent(): Promise<never> {
  throw new Error('LEGACY_TELEMETRY_DISABLED')
}

export async function getRecentUiEvents() {
  const actor = await requireDiagnostics()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000)
  return db.select({
    id: appUsageEvents.id,
    eventType: appUsageEvents.eventType,
    route: appUsageEvents.route,
    target: appUsageEvents.target,
    deviceClass: appUsageEvents.deviceClass,
    outcome: appUsageEvents.outcome,
    occurredAt: appUsageEvents.occurredAt,
    createdAt: appUsageEvents.receivedAt,
  }).from(appUsageEvents).where(and(
    eq(appUsageEvents.tenantId, actor.tenantId),
    gte(appUsageEvents.occurredAt, since)
  )).orderBy(desc(appUsageEvents.occurredAt)).limit(50)
}
