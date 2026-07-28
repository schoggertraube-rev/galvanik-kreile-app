"use server";

import { db, isDatabaseConfigured } from "@/db";
import { customers, priceAgreements, orders } from "@/db/schema";
import { checkAppAuth } from "@/lib/server/authHelper";
import { resolveAuthorization } from "@/lib/server/authorization";
import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";
import { and, eq, notIlike, notInArray, or, sql } from "drizzle-orm";

/**
 * Customer detail reads are intentionally assembled only from relations that
 * exist in the product schema. Quality complaints have no product relation
 * yet, so they are returned as explicitly not configured rather than an empty
 * array that would imply "no complaints".
 */
export async function getCustomerDetailsAction(customerIdOrNumber: string) {
  if (!isFoundationAreaEnabled("Kundendetails")) {
    return foundationUnavailableAction("Kundendetails");
  }
  const auth = await checkAppAuth();
  if (!auth.ok) return { ok: false, error: auth.error, message: auth.message };

  const authorization = await resolveAuthorization();
  if (!authorization.ok) {
    return {
      ok: false,
      error: authorization.reason === "AUTHORIZATION_UNAVAILABLE" ? "DB_ERROR" : "AUTH_ERROR",
      message: authorization.message,
    };
  }
  const tenantId = authorization.data.tenantId;

  if (!isDatabaseConfigured()) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  try {
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(
        eq(customers.tenantId, tenantId),
        or(
          eq(customers.id, customerIdOrNumber),
          eq(customers.customerNumber, customerIdOrNumber),
        ),
        notInArray(sql`coalesce(${customers.source}, '')`, ["seed", "test", "demo", "integration-test"]),
        notIlike(sql`coalesce(${customers.name}, '')`, "Capture%"),
      ))
      .limit(1);

    if (!customer) {
      return { ok: false, error: "NOT_FOUND", message: "Kunde nicht gefunden" };
    }

    const [agreements, ordersForCustomer] = await Promise.all([
      db.select().from(priceAgreements).where(eq(priceAgreements.customerId, customer.id)),
      db
        .select()
        .from(orders)
        .where(and(
          eq(orders.customerId, customer.id),
          eq(orders.tenantId, tenantId),
          notInArray(sql`coalesce(${orders.source}, 'manual')`, ["seed", "test", "demo", "integration-test"]),
          notIlike(sql`coalesce(${orders.orderNumber}, '')`, "A-SEED-%"),
          notIlike(sql`coalesce(${orders.orderNumber}, '')`, "%TEST%"),
        ))
        .orderBy(orders.createdAt),
    ]);

    return {
      ok: true,
      data: {
        customer,
        agreements,
        orders: ordersForCustomer,
        complaints: [],
        complaintsAvailability: "not_configured" as const,
      },
    };
  } catch (error) {
    console.error("Error in getCustomerDetailsAction:", error);
    return { ok: false, error: "QUERY_ERROR", message: "Kundendaten konnten nicht geladen werden." };
  }
}
