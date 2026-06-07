"use server";

import { db } from "@/db";
import { beleg, ausgangsrechnung, lieferant } from "@/db/schema_buchhaltung";
import { orders, customers } from "@/db/schema";
import { ilike, or } from "drizzle-orm";

export async function globalSearchAction(term: string) {
  if (!term || term.length < 2) return [];

  const safeTerm = `%${term}%`;
  
  try {
    // 1. Belege
    const belege = await db.select({
      id: beleg.id,
      title: beleg.lieferantText,
      subtitle: beleg.ocrRohtext
    })
    .from(beleg)
    .where(
      or(
        ilike(beleg.ocrRohtext, safeTerm),
        ilike(beleg.lieferantText, safeTerm)
      )
    )
    .limit(3)
    .then(res => res.map(r => ({ ...r, type: 'beleg' })));

    // 2. Orders
    const foundOrders = await db.select({
      id: orders.id,
      title: orders.title,
      subtitle: orders.status
    })
    .from(orders)
    .where(
      or(
        ilike(orders.title, safeTerm),
        ilike(orders.status, safeTerm)
      )
    )
    .limit(3)
    .then(res => res.map(r => ({ ...r, type: 'order' })));

    // 3. Customers
    const foundCustomers = await db.select({
      id: customers.id,
      title: customers.name,
      subtitle: customers.city
    })
    .from(customers)
    .where(
      or(
        ilike(customers.name, safeTerm),
        ilike(customers.city, safeTerm),
        ilike(customers.companyName, safeTerm)
      )
    )
    .limit(3)
    .then(res => res.map(r => ({ ...r, type: 'customer' })));

    // 4. Ausgangsrechnungen
    const rechnungen = await db.select({
      id: ausgangsrechnung.id,
      title: ausgangsrechnung.nummer,
      subtitle: ausgangsrechnung.status
    })
    .from(ausgangsrechnung)
    .where(
      or(
        ilike(ausgangsrechnung.nummer, safeTerm)
      )
    )
    .limit(3)
    .then(res => res.map(r => ({ ...r, type: 'rechnung' })));

    // 5. Lieferanten
    const lieferanten = await db.select({
      id: lieferant.id,
      title: lieferant.name,
      subtitle: lieferant.adresse
    })
    .from(lieferant)
    .where(ilike(lieferant.name, safeTerm))
    .limit(3)
    .then(res => res.map(r => ({ ...r, type: 'lieferant' })));

    return [...belege, ...foundOrders, ...foundCustomers, ...rechnungen, ...lieferanten];
  } catch (err) {
    console.error("globalSearchAction Error:", err);
    return [];
  }
}
