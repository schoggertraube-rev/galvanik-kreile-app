"use server";

import { db } from "@/db";
import { qs, orders, customers } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";

export async function getQsListenAction() {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return { ok: false, error: "AUTH_ERROR", message: authorization.message };
  if (!authorization.data.permissions.includes("perm_op_qa")) {
    return { ok: false, error: "FORBIDDEN", message: "Keine Berechtigung für QS-Prüfprotokolle." };
  }

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  try {
    const tenantId = authorization.data.tenantId;
    const enriched = await db.select({
      id: qs.id,
      orderId: qs.orderId,
      ergebnis: qs.ergebnis,
      pruefer: qs.pruefer,
      datum: qs.datum,
      bemerkung: qs.bemerkung,
      orderNumber: orders.orderNumber,
      customerName: customers.name,
      task: orders.task,
    })
      .from(qs)
      .innerJoin(orders, and(eq(qs.orderId, orders.id), eq(qs.tenantId, orders.tenantId)))
      .innerJoin(customers, and(eq(orders.customerId, customers.id), eq(orders.tenantId, customers.tenantId)))
      .where(and(
        eq(qs.tenantId, tenantId),
        eq(orders.tenantId, tenantId),
        eq(customers.tenantId, tenantId),
      ))
      .orderBy(desc(qs.datum))
      .limit(50);

    return {
      ok: true,
      data: enriched
    };
  } catch (error) {
    console.error("Error in getQsListenAction:", error);
    return { ok: false, error: "QUERY_ERROR", message: "QS-Prüfprotokolle konnten nicht geladen werden." };
  }
}
