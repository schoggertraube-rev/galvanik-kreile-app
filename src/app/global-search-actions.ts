"use server";

import { db } from "@/db";
import { beleg, ausgangsrechnung, lieferant, kostenposten } from "@/db/schema_buchhaltung";
import { orders, customers, baths, inventoryItems } from "@/db/schema";
import { ilike, or } from "drizzle-orm";

export async function globalSearchAction(term: string) {
  if (!term || term.length < 2) return [];

  const safeTerm = `%${term}%`;
  
  try {
    const [belege, foundOrders, foundCustomers, rechnungen, lieferanten, baeder, lager, kosten] = await Promise.all([
      db.select({ id: beleg.id, title: beleg.lieferantText, subtitle: beleg.ocrRohtext }).from(beleg).where(or(ilike(beleg.ocrRohtext, safeTerm), ilike(beleg.lieferantText, safeTerm))).limit(3).then(res => res.map(r => ({ ...r, type: 'beleg' }))),
      db.select({ id: orders.id, title: orders.title, subtitle: orders.status }).from(orders).where(or(ilike(orders.title, safeTerm), ilike(orders.status, safeTerm))).limit(3).then(res => res.map(r => ({ ...r, type: 'order' }))),
      db.select({ id: customers.id, title: customers.name, subtitle: customers.city }).from(customers).where(or(ilike(customers.name, safeTerm), ilike(customers.city, safeTerm), ilike(customers.companyName, safeTerm))).limit(3).then(res => res.map(r => ({ ...r, type: 'customer' }))),
      db.select({ id: ausgangsrechnung.id, title: ausgangsrechnung.nummer, subtitle: ausgangsrechnung.status }).from(ausgangsrechnung).where(ilike(ausgangsrechnung.nummer, safeTerm)).limit(3).then(res => res.map(r => ({ ...r, type: 'rechnung' }))),
      db.select({ id: lieferant.id, title: lieferant.name, subtitle: lieferant.adresse }).from(lieferant).where(ilike(lieferant.name, safeTerm)).limit(3).then(res => res.map(r => ({ ...r, type: 'lieferant' }))),
      db.select({ id: baths.id, title: baths.name, subtitle: baths.status }).from(baths).where(ilike(baths.name, safeTerm)).limit(3).then(res => res.map(r => ({ ...r, type: 'bad' }))),
      db.select({ id: inventoryItems.id, title: inventoryItems.name, subtitle: inventoryItems.category }).from(inventoryItems).where(or(ilike(inventoryItems.name, safeTerm), ilike(inventoryItems.category, safeTerm))).limit(3).then(res => res.map(r => ({ ...r, type: 'lager' }))),
      db.select({ id: kostenposten.id, title: kostenposten.bezeichnung, subtitle: kostenposten.art }).from(kostenposten).where(ilike(kostenposten.bezeichnung, safeTerm)).limit(3).then(res => res.map(r => ({ ...r, type: 'kostenposten' })))
    ]);

    return [...belege, ...foundOrders, ...foundCustomers, ...rechnungen, ...lieferanten, ...baeder, ...lager, ...kosten];
  } catch (err) {
    console.error("globalSearchAction Error:", err);
    return [];
  }
}
