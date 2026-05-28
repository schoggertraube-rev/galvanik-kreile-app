'use server'

import { db } from '@/db'
import { orders } from '@/db/schema'
import { seedDatabase } from '@/db/seed'
import { count } from 'drizzle-orm'

export async function initializeDemoIfNeeded() {
  try {
    const result = await db.select({ value: count() }).from(orders)
    const orderCount = result[0].value

    if (orderCount === 0) {
      console.log('👷 Keine Auftragsdaten gefunden. Initialisiere Demo-Datenbank...')
      await seedDatabase()
      return { initialized: true }
    }
    
    return { initialized: false }
  } catch (error) {
    console.error('Fehler beim Initialisieren der Demo-Daten:', error)
    return { error: 'Fehler beim Initialisieren der Demo-Daten' }
  }
}
