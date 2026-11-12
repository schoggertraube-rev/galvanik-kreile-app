'use server'

import { db } from '@/db'
import { orders, customers, appUsers } from '@/db/schema'
import { count, eq } from 'drizzle-orm'
import {resolveAuthorization,hasAuthorizationArea} from '@/lib/server/authorization'
import {LEGACY_ACTION_ACCESS_COPY} from '@/ui/situationCatalog'

export async function getSystemStats() {
  const authorization = await resolveAuthorization()
  if (!authorization.ok) {
    throw new Error(authorization.message)
  }

  if (!hasAuthorizationArea(authorization.data,'wartung')) throw new Error(LEGACY_ACTION_ACCESS_COPY.forbidden)

  const provider = process.env.NEXT_PUBLIC_DATA_PROVIDER || 'local'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  
  // Extract only the host — never expose full URL or keys
  let supabaseHost = ''
  try {
    supabaseHost = new URL(supabaseUrl).host
  } catch {
    supabaseHost = supabaseUrl ? '(ungültige URL)' : '(nicht konfiguriert)'
  }
  
  if (provider !== 'supabase') {
    return {
      provider,
      supabaseHost,
      reachable: false,
      orders: 0,
      customers: 0,
      users: 0,
      lastCheck: new Date().toISOString(),
      lastError: null as string | null,
    }
  }

  try {
    const oRes = await db.select({ value: count() }).from(orders).where(eq(orders.tenantId,authorization.data.tenantId))
    const cRes = await db.select({ value: count() }).from(customers).where(eq(customers.tenantId,authorization.data.tenantId))
    const uRes = await db.select({ value: count() }).from(appUsers).where(eq(appUsers.tenantId,authorization.data.tenantId))

    return {
      provider,
      supabaseHost,
      reachable: true,
      orders: oRes[0].value,
      customers: cRes[0].value,
      users: uRes[0].value,
      lastCheck: new Date().toISOString(),
      lastError: null as string | null,
    }
  } catch (error) {
    return {
      provider,
      supabaseHost,
      reachable: false,
      orders: 0,
      customers: 0,
      users: 0,
      lastCheck: new Date().toISOString(),
      lastError: String(error),
    }
  }
}

export async function runSupabaseWriteTest(): Promise<{
  success: boolean;
  message: string;
  durationMs: number;
}> {
  return {
    success: false,
    message: 'NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt.',
    durationMs: 0,
  }
}
