"use server";

import { db } from "@/db";
import { qs, orders, customers } from "@/db/schema";
import { checkAppAuth } from "@/lib/server/authHelper";
import type { InferSelectModel } from "drizzle-orm";

export type QsListItem = InferSelectModel<typeof qs> & {
  orderNumber: string;
  customerName: string;
  task: string;
};
export type QsListenActionResult =
  | { ok: true; data: QsListItem[] }
  | { ok: false; error: string; message: string };

export async function getQsListenAction(): Promise<QsListenActionResult> {
  const auth = await checkAppAuth();
  if (!auth.ok) return { ok: false, error: "AUTH_ERROR", message: auth.message };

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  try {
    const qsRecords = await db.select().from(qs).orderBy(qs.datum);
    const ordersRecords = await db.select().from(orders);
    const customerRecords = await db.select().from(customers);

    const enriched = qsRecords.map(q => {
      const order = ordersRecords.find(o => o.id === q.orderId);
      const customer = order ? customerRecords.find(c => c.id === order.customerId) : null;
      return {
        ...q,
        orderNumber: order?.orderNumber || "Unbekannt",
        customerName: customer?.name || "Unbekannt",
        task: order?.task || ""
      };
    });

    return {
      ok: true,
      data: enriched
    };
  } catch (error) {
    console.error("Error in getQsListenAction:", error);
    return { ok: false, error: "QUERY_ERROR", message: String(error) };
  }
}
