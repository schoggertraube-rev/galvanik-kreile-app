"use server";

import { db } from "@/db";
import { orders, items, events, customers, priceLines, payments, communications } from "@/db/schema";
import { and, asc, desc, eq, notInArray, sql } from "drizzle-orm";
import { ausgangsrechnung } from "@/db/schema_buchhaltung";
import { resolveAuthorization } from "@/lib/server/authorization";

const ENTITY_ID = /^[A-Za-z0-9_-]{1,100}$/;

export async function getOrderWithDetails(orderId: string) {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) throw new Error("AUTH_ERROR: Anmeldung erforderlich.");
  if (!authorization.data.permissions.includes("perm_view_leitstand") && !authorization.data.permissions.includes("perm_data_orders")) {
    throw new Error("AUTH_ERROR: Keine Berechtigung für Auftragsdetails.");
  }
  if (!ENTITY_ID.test(orderId)) throw new Error("Ungültige Auftrags-ID.");
  const tenantId = authorization.data.tenantId;

  try {
    const orderResults = await db.select()
      .from(orders)
      .leftJoin(customers, and(eq(orders.customerId, customers.id), eq(customers.tenantId, tenantId)))
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
      .limit(1);

    if (orderResults.length === 0) return null;

    const orderRecord = orderResults[0].orders;
    const customerRecord = orderResults[0].customers;

    const [itemsData, eventsData, priceLinesData, paymentsData, communicationsData] = await Promise.all([
      db.select().from(items).where(and(eq(items.orderId, orderId), eq(items.tenantId, tenantId))).orderBy(asc(items.createdAt)),
      db.select().from(events).where(and(eq(events.orderId, orderId), eq(events.tenantId, tenantId))).orderBy(desc(events.createdAt)),
      db.select().from(priceLines).where(and(eq(priceLines.orderId, orderId), eq(priceLines.tenantId, tenantId))).orderBy(asc(priceLines.sortOrder)),
      db.select().from(payments).where(and(eq(payments.orderId, orderId), eq(payments.tenantId, tenantId))).orderBy(desc(payments.createdAt)),
      db.select().from(communications).where(and(eq(communications.orderId, orderId), eq(communications.tenantId, tenantId))).orderBy(desc(communications.createdAt)),
    ]);

    let ltv = 0;
    let activeOrdersCount = 0;
    
    if (orderRecord.customerId) {
      const [ltvResult, activeOrdersResult] = await Promise.all([
        db.select({ value: sql<number>`coalesce(sum(${ausgangsrechnung.brutto}), 0)` })
          .from(ausgangsrechnung)
          .where(and(
            eq(ausgangsrechnung.tenantId, tenantId),
            sql`${ausgangsrechnung.orderId} IN (SELECT id FROM orders WHERE customer_id = ${orderRecord.customerId} AND tenant_id = ${tenantId})`,
          )),
        db.select({ count: sql<number>`count(*)::int` })
          .from(orders)
          .where(and(
            eq(orders.tenantId, tenantId),
            eq(orders.customerId, orderRecord.customerId),
            notInArray(orders.status, ["abgeschlossen", "storniert", "completed", "cancelled"]),
          )),
      ]);

      ltv = Number(ltvResult[0]?.value || 0);
      activeOrdersCount = Number(activeOrdersResult[0]?.count || 0);
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
    throw new Error("DATA_ERROR: Auftragsdetails konnten nicht geladen werden.");
  }
}
