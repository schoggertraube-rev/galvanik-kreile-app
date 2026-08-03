"use server";

import { db } from "@/db";
import { customers, orders, items } from "@/db/schema";
import { ilike, or, eq } from "drizzle-orm";
import { checkAppAuth } from "@/lib/server/authHelper";

export interface SearchResult {
  id: string;
  type: "customer" | "order" | "item";
  title: string;
  subtitle: string;
  url: string;
}

export async function globalSearch(query: string): Promise<{ ok: boolean; results?: SearchResult[]; error?: string }> {
  const auth = await checkAppAuth("read");
  if (!auth.ok) return { ok: false, error: auth.message };

  if (!query || query.trim().length < 2) {
    return { ok: true, results: [] };
  }

  const q = `%${query.trim()}%`;
  const results: SearchResult[] = [];

  try {
    // 1. Search Customers
    const foundCustomers = await db.select({
      id: customers.id,
      name: customers.name,
      city: customers.city
    })
    .from(customers)
    .where(or(ilike(customers.name, q), ilike(customers.city, q)))
    .limit(5);

    for (const c of foundCustomers) {
      results.push({
        id: c.id,
        type: "customer",
        title: c.name,
        subtitle: c.city || "Kunde",
        url: `/customers?id=${c.id}`
      });
    }

    // 2. Search Orders
    const foundOrders = await db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      title: orders.title,
      customerName: customers.name
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(or(ilike(orders.orderNumber, q), ilike(orders.title, q)))
    .limit(5);

    for (const o of foundOrders) {
      results.push({
        id: o.id,
        type: "order",
        title: o.orderNumber,
        subtitle: `${o.title} (${o.customerName || "Unbekannt"})`,
        url: `/orders?id=${o.id}`
      });
    }

    // 3. Search Items
    const foundItems = await db.select({
      id: items.id,
      name: items.name,
      orderNumber: orders.orderNumber
    })
    .from(items)
    .leftJoin(orders, eq(items.orderId, orders.id))
    .where(ilike(items.name, q))
    .limit(5);

    for (const i of foundItems) {
      results.push({
        id: i.id,
        type: "item",
        title: i.name,
        subtitle: `Teil in Auftrag ${i.orderNumber || "?"}`,
        url: `/orders?id=${i.orderNumber ? "search" : ""}` // Depending on actual routing
      });
    }

    return { ok: true, results };
  } catch (err: unknown) {
    console.error("Global search failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Suche fehlgeschlagen" };
  }
}
