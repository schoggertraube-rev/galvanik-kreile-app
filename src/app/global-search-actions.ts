"use server";

import { db } from "@/db";
import { beleg, ausgangsrechnung, lieferant, kostenposten, zahlung } from "@/db/schema_buchhaltung";
import { orders, customers, baths, inventoryItems, phoneNotes } from "@/db/schema";
import { ilike, or } from "drizzle-orm";

export async function globalSearchAction(term: string) {
  if (!term || term.length < 2) return [];

  const safeTerm = `%${term}%`;
  
  try {
    const [belege, foundOrders, foundCustomers, rechnungen, lieferanten, baeder, lager, kosten, notizen, zahlungen] = await Promise.all([
      db.select({ id: beleg.id, title: beleg.lieferantText, subtitle: beleg.ocrRohtext }).from(beleg).where(or(ilike(beleg.ocrRohtext, safeTerm), ilike(beleg.lieferantText, safeTerm))).limit(3).then(res => res.map(r => ({ ...r, type: 'beleg' }))),
      db.select({ id: orders.id, title: orders.title, subtitle: orders.status }).from(orders).where(or(ilike(orders.title, safeTerm), ilike(orders.status, safeTerm))).limit(3).then(res => res.map(r => ({ ...r, type: 'order' }))),
      db.select({ id: customers.id, title: customers.name, subtitle: customers.city }).from(customers).where(or(ilike(customers.name, safeTerm), ilike(customers.city, safeTerm), ilike(customers.companyName, safeTerm))).limit(3).then(res => res.map(r => ({ ...r, type: 'customer' }))),
      db.select({ id: ausgangsrechnung.id, title: ausgangsrechnung.nummer, subtitle: ausgangsrechnung.status }).from(ausgangsrechnung).where(ilike(ausgangsrechnung.nummer, safeTerm)).limit(3).then(res => res.map(r => ({ ...r, type: 'rechnung' }))),
      db.select({ id: lieferant.id, title: lieferant.name, subtitle: lieferant.adresse }).from(lieferant).where(ilike(lieferant.name, safeTerm)).limit(3).then(res => res.map(r => ({ ...r, type: 'lieferant' }))),
      db.select({ id: baths.id, title: baths.name, subtitle: baths.status }).from(baths).where(ilike(baths.name, safeTerm)).limit(3).then(res => res.map(r => ({ ...r, type: 'bad' }))),
      db.select({ id: inventoryItems.id, title: inventoryItems.name, subtitle: inventoryItems.category }).from(inventoryItems).where(or(ilike(inventoryItems.name, safeTerm), ilike(inventoryItems.category, safeTerm))).limit(3).then(res => res.map(r => ({ ...r, type: 'lager' }))),
      db.select({ id: kostenposten.id, title: kostenposten.bezeichnung, subtitle: kostenposten.art }).from(kostenposten).where(ilike(kostenposten.bezeichnung, safeTerm)).limit(3).then(res => res.map(r => ({ ...r, type: 'kostenposten' }))),
      db.select({ id: phoneNotes.id, title: phoneNotes.callerName, subtitle: phoneNotes.company }).from(phoneNotes).where(or(ilike(phoneNotes.callerName, safeTerm), ilike(phoneNotes.company, safeTerm), ilike(phoneNotes.rawText, safeTerm), ilike(phoneNotes.phone, safeTerm))).limit(3).then(res => res.map(r => ({ ...r, type: 'telefonnotiz' }))),
      db.select({ id: zahlung.id, title: zahlung.bankUmsatzRef, subtitle: zahlung.art }).from(zahlung).where(or(ilike(zahlung.bankUmsatzRef, safeTerm), ilike(zahlung.art, safeTerm))).limit(3).then(res => res.map(r => ({ ...r, type: 'zahlung' })))
    ]);

    return [...belege, ...foundOrders, ...foundCustomers, ...rechnungen, ...lieferanten, ...baeder, ...lager, ...kosten, ...notizen, ...zahlungen];
  } catch (err) {
    console.error("globalSearchAction Error:", err);
    return [];
  }
}
