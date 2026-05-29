'use server'

import { db } from '@/db'
import { orders, customers, users } from '@/db/schema'
import { count } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'

export async function getSystemStats() {
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
    const oRes = await db.select({ value: count() }).from(orders)
    const cRes = await db.select({ value: count() }).from(customers)
    const uRes = await db.select({ value: count() }).from(users)

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
  const provider = process.env.NEXT_PUBLIC_DATA_PROVIDER || 'local'
  if (provider !== 'supabase') {
    return { success: false, message: 'Datenquelle ist nicht Supabase', durationMs: 0 }
  }

  const start = Date.now()
  const testId = `__writetest__${Date.now()}`

  try {
    const supabase = await createClient()

    // 1. Insert test customer
    const { error: insertError } = await supabase.from('customers').insert({
      id: testId,
      name: '__SCHREIBTEST__',
      type: 'test',
    })

    if (insertError) {
      return {
        success: false,
        message: `Insert fehlgeschlagen: ${insertError.message} | ${insertError.details || ''} | ${insertError.hint || ''}`,
        durationMs: Date.now() - start,
      }
    }

    // 2. Read back
    const { data: readBack, error: readError } = await supabase
      .from('customers')
      .select('id, name')
      .eq('id', testId)
      .single()

    if (readError || !readBack) {
      // Cleanup attempt
      await supabase.from('customers').delete().eq('id', testId)
      return {
        success: false,
        message: `Read-Back fehlgeschlagen: ${readError?.message || 'Kein Datensatz zurück'}`,
        durationMs: Date.now() - start,
      }
    }

    // 3. Delete test customer
    const { error: deleteError } = await supabase.from('customers').delete().eq('id', testId)

    if (deleteError) {
      return {
        success: false,
        message: `Delete fehlgeschlagen: ${deleteError.message}`,
        durationMs: Date.now() - start,
      }
    }

    return {
      success: true,
      message: `Schreibtest erfolgreich: Insert → Read → Delete in ${Date.now() - start}ms`,
      durationMs: Date.now() - start,
    }
  } catch (error) {
    return {
      success: false,
      message: `Unerwarteter Fehler: ${String(error)}`,
      durationMs: Date.now() - start,
    }
  }
}
