"use server";

import { db } from "@/db";
import { orders, items, events, customers, priceLines, payments, communications } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";

export async function getOrderWithDetails(orderId: string) {
  try {
    const orderResults = await db.select()
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(eq(orders.id, orderId));

    if (orderResults.length === 0) return null;

    const orderRecord = orderResults[0].orders;
    const customerRecord = orderResults[0].customers;

    const itemsData = await db.select().from(items).where(eq(items.orderId, orderId)).orderBy(asc(items.createdAt));
    const eventsData = await db.select().from(events).where(eq(events.orderId, orderId)).orderBy(desc(events.createdAt));

    // Phase 2 additions: Parallel queries
    const [priceLinesData, paymentsData, communicationsData] = await Promise.all([
      db.select().from(priceLines).where(eq(priceLines.orderId, orderId)).orderBy(asc(priceLines.sortOrder)),
      db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.createdAt)),
      db.select().from(communications).where(eq(communications.orderId, orderId)).orderBy(desc(communications.createdAt)),
    ]);

    let ltv = 0;
    let activeOrdersCount = 0;
    
    if (orderRecord.customerId) {
      const { sql, and, notInArray } = await import("drizzle-orm");
      const { ausgangsrechnung } = await import("@/db/schema_buchhaltung");
      
      try {
        const [ltvResult, activeOrdersResult] = await Promise.all([
          db.select({ value: sql<number>`SUM(${ausgangsrechnung.brutto})` })
            .from(ausgangsrechnung)
            .where(sql`${ausgangsrechnung.orderId} IN (SELECT id FROM orders WHERE customer_id = ${orderRecord.customerId})`),
          db.select({ count: sql<number>`COUNT(*)` })
            .from(orders)
            .where(and(
              eq(orders.customerId, orderRecord.customerId),
              notInArray(orders.status, ['abgeschlossen', 'storniert', 'completed', 'cancelled'])
            ))
        ]);
        
        ltv = ltvResult[0]?.value || 0;
        activeOrdersCount = activeOrdersResult[0]?.count || 0;
      } catch (e) {
        console.error("Failed to load customer KPIs", e);
      }
    }

    return {
      ...orderRecord,
      customer: customerRecord,
      items: itemsData,
      events: eventsData,
      priceLines: priceLinesData,
      payments: paymentsData,
      communications: communicationsData,
      customerKpis: {
        ltv,
        activeOrdersCount
      }
    };
  } catch (error) {
    console.error("Fehler beim Laden des Auftrags:", error);
    return null;
  }
}
