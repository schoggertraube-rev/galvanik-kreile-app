'use server'

import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '@/db'
import { appUsageEvents } from '@/db/schema'
import { resolveAuthorization } from '@/lib/server/authorization'
import type { OperatorControlStatus } from '@/lib/server/operatorControl'

export interface FrictionSignal {
  id: string
  title: string
  detail: string
  page: string
}

export interface AnalyticsSuggestion {
  id: string
  priority: string
  page: string
  signal: string
  recommendation: string
  reason: string
  status: string
}

export interface DeviceUsage { name: string; value: number }
export type AnalyticsAvailability = 'available' | 'empty' | 'unavailable' | 'not_instrumented'

export interface DevicesOverview {
  connected: boolean
  availability: AnalyticsAvailability
  message: string
  stats: DeviceUsage[]
}

export interface AnalyticsOverview {
  availability: AnalyticsAvailability
  activeUsers: number
  activeRoles: string[]
  lastActive: string | null
  topEvents: { name: string; value: number }[]
  activityData: { date: string; events: number }[]
  recentEvents: { id: string; time: string; type: string; role: string; detail: string }[]
}

export interface DeveloperCockpitData {
  operatorControl: {
    availability: OperatorControlStatus['availability']
    plan: OperatorControlStatus['plan']
    mode: OperatorControlStatus['mode']
    reason: OperatorControlStatus['reason']
    notice: string | null
    effectiveAt: string | null
    expiresAt: string | null
    policyVersion: number | null
    enforced: boolean
    accessRestricted: boolean
  }
  overview: AnalyticsOverview
  frictionAnalysis: FrictionSignal[]
  frictionAvailability: AnalyticsAvailability
  suggestions: AnalyticsSuggestion[]
  suggestionAvailability: AnalyticsAvailability
  devices: DevicesOverview
}

function operatorControlOverview(status?: OperatorControlStatus): DeveloperCockpitData['operatorControl'] {
  return status ? {
    availability: status.availability,
    plan: status.plan,
    mode: status.mode,
    reason: status.reason,
    notice: status.notice,
    effectiveAt: status.effectiveAt,
    expiresAt: status.expiresAt,
    policyVersion: status.policyVersion,
    enforced: status.enforced,
    accessRestricted: status.accessRestricted,
  } : {
    availability: 'unavailable',
    plan: 'pro',
    mode: 'active',
    reason: null,
    notice: null,
    effectiveAt: null,
    expiresAt: null,
    policyVersion: null,
    enforced: false,
    accessRestricted: false,
  }
}

function unavailableData(status?: OperatorControlStatus): DeveloperCockpitData {
  return {
    operatorControl: operatorControlOverview(status),
    overview: { availability: 'unavailable', activeUsers: 0, activeRoles: [], lastActive: null, topEvents: [], activityData: [], recentEvents: [] },
    frictionAnalysis: [],
    frictionAvailability: 'not_instrumented',
    suggestions: [],
    suggestionAvailability: 'not_instrumented',
    devices: { connected: false, availability: 'unavailable', message: 'Nutzungsdaten sind derzeit nicht verfügbar.', stats: [] },
  }
}

export async function getDeveloperCockpitStats(): Promise<DeveloperCockpitData> {
  const authorization = await resolveAuthorization()
  if (!authorization.ok || authorization.data.tenantId !== 'galvanik-kreile' || !authorization.data.permissions.includes('perm_sys_diag')) {
    throw new Error('AUTH_ERROR: Forbidden')
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000)
  const operatorControl = operatorControlOverview(authorization.data.operatorControl)
  const activityDate = sql<string>`to_char(${appUsageEvents.occurredAt} at time zone 'Europe/Berlin', 'YYYY-MM-DD')`
  try {
    const [topRows, activityRows, summaryRows, roleRows, deviceRows, recentRows] = await Promise.all([
      db.select({
        eventType: appUsageEvents.eventType,
        route: appUsageEvents.route,
        target: appUsageEvents.target,
        count: sql<number>`count(*)::int`,
      }).from(appUsageEvents).where(and(
        eq(appUsageEvents.tenantId, authorization.data.tenantId),
        gte(appUsageEvents.occurredAt, since)
      )).groupBy(appUsageEvents.eventType, appUsageEvents.route, appUsageEvents.target)
        .orderBy(desc(sql`count(*)`)).limit(10),
      db.select({
        date: activityDate,
        events: sql<number>`count(*)::int`,
      }).from(appUsageEvents).where(and(
        eq(appUsageEvents.tenantId, authorization.data.tenantId),
        gte(appUsageEvents.occurredAt, since)
      )).groupBy(activityDate).orderBy(activityDate),
      db.select({
        activeUsers: sql<number>`count(distinct ${appUsageEvents.actorPseudonym})::int`,
        eventCount: sql<number>`count(*)::int`,
        lastActive: sql<Date | null>`max(${appUsageEvents.occurredAt})`,
      }).from(appUsageEvents).where(and(
        eq(appUsageEvents.tenantId, authorization.data.tenantId),
        gte(appUsageEvents.occurredAt, since)
      )),
      db.select({ role: appUsageEvents.actorRole }).from(appUsageEvents).where(and(
        eq(appUsageEvents.tenantId, authorization.data.tenantId),
        gte(appUsageEvents.occurredAt, since)
      )).groupBy(appUsageEvents.actorRole).orderBy(appUsageEvents.actorRole),
      db.select({ name: appUsageEvents.deviceClass, count: sql<number>`count(*)::int` }).from(appUsageEvents).where(and(
        eq(appUsageEvents.tenantId, authorization.data.tenantId),
        gte(appUsageEvents.occurredAt, since)
      )).groupBy(appUsageEvents.deviceClass).orderBy(desc(sql`count(*)`)),
      db.select({
        id: appUsageEvents.id,
        occurredAt: appUsageEvents.occurredAt,
        type: appUsageEvents.eventType,
        role: appUsageEvents.actorRole,
        route: appUsageEvents.route,
        target: appUsageEvents.target,
      }).from(appUsageEvents).where(and(
        eq(appUsageEvents.tenantId, authorization.data.tenantId),
        gte(appUsageEvents.occurredAt, since)
      )).orderBy(desc(appUsageEvents.occurredAt)).limit(20),
    ])

    const summary = summaryRows[0]
    const eventCount = Number(summary?.eventCount || 0)
    const availability: AnalyticsAvailability = eventCount > 0 ? 'available' : 'empty'
    const deviceTotal = deviceRows.reduce((total, row) => total + Number(row.count), 0)
    return {
      operatorControl,
      overview: {
        availability,
        activeUsers: Number(summary?.activeUsers || 0),
        activeRoles: roleRows.map((row) => row.role),
        lastActive: summary?.lastActive ? new Date(summary.lastActive).toISOString() : null,
        topEvents: topRows.map((row) => ({
          name: `${row.eventType} : ${row.target || row.route}`,
          value: Number(row.count),
        })),
        activityData: activityRows.map((row) => ({ date: row.date, events: Number(row.events) })),
        recentEvents: recentRows.map((row) => ({
          id: row.id,
          time: new Date(row.occurredAt).toISOString(),
          type: row.type,
          role: row.role,
          detail: row.target || row.route,
        })),
      },
      frictionAnalysis: [],
      frictionAvailability: 'not_instrumented',
      suggestions: [],
      suggestionAvailability: 'not_instrumented',
      devices: {
        connected: eventCount > 0,
        availability,
        message: eventCount > 0 ? 'Anteile beziehen sich auf gespeicherte Ereignisse, nicht auf eindeutig erkannte Geräte.' : 'Noch keine gespeicherten Nutzungsereignisse.',
        stats: deviceRows.map((row) => ({ name: row.name, value: deviceTotal > 0 ? Math.round(Number(row.count) / deviceTotal * 100) : 0 })),
      },
    }
  } catch {
    return unavailableData(authorization.data.operatorControl)
  }
}
