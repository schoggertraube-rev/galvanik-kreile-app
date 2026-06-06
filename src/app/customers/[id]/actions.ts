"use server";

import { db } from "@/db";
import { customers, priceAgreements, orders, qs, buchhaltung_rechnungen } from "@/db/schema";
import { checkAppAuth } from "@/lib/server/authHelper";
import { eq, or } from "drizzle-orm";

export async function getCustomerDetailsAction(customerIdOrNumber: string) {
  const auth = await checkAppAuth();
  if (!auth.ok) return { ok: false, error: "AUTH_ERROR", message: auth.message };

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  try {
    const custRes = await db.select().from(customers).where(
      or(
        eq(customers.id, customerIdOrNumber),
        eq(customers.customerNumber, customerIdOrNumber)
      )
    );

    if (custRes.length === 0) {
       return { ok: false, error: "NOT_FOUND", message: "Kunde nicht gefunden" };
    }

    const customer = custRes[0];

    const agreementsRes = await db.select().from(priceAgreements).where(eq(priceAgreements.customerId, customer.id));
    const ordersRes = await db.select().from(orders).where(eq(orders.customerId, customer.id)).orderBy(orders.createdAt);
    
    // get qs and invoices based on orders or customer
    const rechnungenRes = await db.select().from(buchhaltung_rechnungen).where(eq(buchhaltung_rechnungen.kundenId, customer.customerNumber || customer.id));

    // get qs logic (qs has orderId)
    // We fetch all qs and filter manually because Drizzle joins can be tricky to type dynamically here without a defined relation
    const allQs = await db.select().from(qs);
    const orderIds = ordersRes.map(o => o.id);
    const complaintsRes = allQs.filter(q => orderIds.includes(q.orderId));

    return {
      ok: true,
      data: {
        customer,
        agreements: agreementsRes,
        orders: ordersRes,
        rechnungen: rechnungenRes,
        complaints: complaintsRes
      }
    };
  } catch (error) {
    console.error("Error in getCustomerDetailsAction:", error);
    return { ok: false, error: "QUERY_ERROR", message: String(error) };
  }
}
