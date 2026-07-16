"use server";

import { and, asc, desc, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, events, items, orders, priceLines } from "@/db/schema";
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
  const canViewPrices = authorization.data.permissions.includes("perm_view_prices");
  const canViewCustomerDetails = authorization.data.permissions.includes("perm_view_customers");
  const canEditOrders = authorization.data.permissions.includes("perm_data_orders");
  const canCompleteHandover = authorization.data.permissions.includes("perm_op_status");

  try {
    const orderRecord = (await db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerId: orders.customerId,
      title: orders.title,
      task: orders.task,
      station: orders.station,
      currentStationId: orders.currentStationId,
      status: orders.status,
      risk: orders.risk,
      priority: orders.priority,
      statusText: orders.statusText,
      dueDate: orders.dueDate,
      createdAt: orders.createdAt,
      dbGeplant: canViewPrices ? orders.dbGeplant : sql<null>`null`,
      dbIst: canViewPrices ? orders.dbIst : sql<null>`null`,
    }).from(orders).where(and(
      eq(orders.id, orderId),
      eq(orders.tenantId, tenantId),
    )).limit(1))[0];

    if (!orderRecord) return null;

    const customer = canViewCustomerDetails
      ? (await db.select({
          id: customers.id,
          name: customers.name,
          customerNumber: customers.customerNumber,
          phone: customers.phone,
          email: customers.email,
        }).from(customers).where(and(
          eq(customers.id, orderRecord.customerId),
          eq(customers.tenantId, tenantId),
        )).limit(1))[0] ?? null
      : (await db.select({
          id: customers.id,
          name: customers.name,
          customerNumber: customers.customerNumber,
          phone: sql<string | null>`null`,
          email: sql<string | null>`null`,
        }).from(customers).where(and(
          eq(customers.id, orderRecord.customerId),
          eq(customers.tenantId, tenantId),
        )).limit(1))[0] ?? null;

    const [itemsData, eventsData] = await Promise.all([
      db.select().from(items).where(and(
        eq(items.orderId, orderId),
        eq(items.tenantId, tenantId),
      )).orderBy(asc(items.createdAt)),
      db.select({
        id: events.id,
        eventType: events.eventType,
        description: events.description,
        notes: events.notes,
        status: events.status,
        createdAt: events.createdAt,
      }).from(events).where(and(
        eq(events.orderId, orderId),
        eq(events.tenantId, tenantId),
      )).orderBy(desc(events.createdAt)),
    ]);

    const priceLinesData = canViewPrices
      ? await db.select().from(priceLines).where(and(
          eq(priceLines.orderId, orderId),
          eq(priceLines.tenantId, tenantId),
        )).orderBy(asc(priceLines.sortOrder))
      : [];

    let activeOrdersCount: number | null = null;
    if (canViewCustomerDetails) {
      const [result] = await db.select({ count: sql<number>`count(*)::int` })
        .from(orders)
        .where(and(
          eq(orders.tenantId, tenantId),
          eq(orders.customerId, orderRecord.customerId),
          notInArray(orders.status, ["abgeschlossen", "storniert", "completed", "cancelled"]),
        ));
      activeOrdersCount = Number(result?.count ?? 0);
    }

    return {
      ...orderRecord,
      customer,
      items: itemsData,
      events: eventsData,
      priceLines: priceLinesData,
      customerKpis: canViewCustomerDetails ? {
        activeOrdersCount,
        revenueAvailability: "not_connected" as const,
      } : null,
      capabilities: {
        canViewPrices,
        canViewCustomerDetails,
        canEditOrders,
        canCompleteHandover,
      },
    };
  } catch (error) {
    console.error("Order detail read failed", error);
    throw new Error("DATA_ERROR: Auftragsdetails konnten nicht geladen werden.");
  }
}
