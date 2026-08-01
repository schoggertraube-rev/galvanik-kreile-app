'use server'

import { db } from '@/db'
import { orders, customers, appUsers } from '@/db/schema'
import { seedDatabase } from '@/db/seed'
import { count } from 'drizzle-orm'
import { resolveAuthorization } from '@/lib/server/authorization'

export async function initializeDemoIfNeeded() {
  // Wenn DATA_PROVIDER nicht supabase ist, machen wir gar nichts
  if (process.env.NEXT_PUBLIC_DATA_PROVIDER !== 'supabase') {
    return { initialized: false, reason: 'not_supabase' }
  }

  // Demo-Seeding ist niemals ein Produktionspfad. Außerhalb der Produktion
  // bleibt es zusätzlich an den expliziten Demo-Modus und eine echte Sitzung gebunden.
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.NEXT_PUBLIC_DEMO_MODE !== 'true'
  ) {
    return { initialized: false, reason: 'disabled' }
  }

  const authorization = await resolveAuthorization()
  if (!authorization.ok) {
    return { initialized: false, reason: 'unauthorized' }
  }

  try {
    const oRes = await db.select({ value: count() }).from(orders)
    const cRes = await db.select({ value: count() }).from(customers)
    const uRes = await db.select({ value: count() }).from(appUsers)
    
    const orderCount = oRes[0].value
    const customerCount = cRes[0].value
    const userCount = uRes[0].value

    const total = orderCount + customerCount + userCount

    if (total === 0) {
      console.log('👷 Keine Daten gefunden (Orders/Customers/Users = 0). Initialisiere Demo-Datenbank...')
      await seedDatabase({ safeMode: true })
      return { initialized: true }
    }
    
    return { initialized: false, reason: 'data_exists' }
  } catch (error) {
    console.error('Fehler beim Initialisieren der Demo-Daten:', error)
    return { error: 'Fehler beim Initialisieren der Demo-Daten' }
  }
}
