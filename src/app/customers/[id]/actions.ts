"use server";

import { db } from "@/db";
import { complaints, customers, priceAgreements, orders, ausgangsrechnung } from "@/db/schema";
import { and, desc, eq, or } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";

const ENTITY_ID = /^[A-Za-z0-9_-]{1,100}$/;

export async function getCustomerDetailsAction(customerIdOrNumber: string) {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return { ok: false, error: "AUTH_ERROR", message: authorization.message };
  if (!authorization.data.permissions.includes("perm_view_customers")) {
    return { ok: false, error: "FORBIDDEN", message: "Keine Berechtigung für Kundendetails." };
  }
  if (!ENTITY_ID.test(customerIdOrNumber)) return { ok: false, error: "INVALID_INPUT", message: "Ungültige Kunden-ID." };
  const tenantId = authorization.data.tenantId;

  try {
    const custRes = await db.select().from(customers).where(
      and(
        eq(customers.tenantId, tenantId),
        or(
          eq(customers.id, customerIdOrNumber),
          eq(customers.customerNumber, customerIdOrNumber)
        )
      )
    ).limit(1);

    if (custRes.length === 0) {
       return { ok: false, error: "NOT_FOUND", message: "Kunde nicht gefunden" };
    }

    const customer = custRes[0];

    const [agreementRows, ordersRes, rechnungenRes, complaintRows] = await Promise.all([
      db.select().from(priceAgreements).where(eq(priceAgreements.customerId, customer.id)).orderBy(desc(priceAgreements.date)),
      db.select().from(orders).where(and(eq(orders.customerId, customer.id), eq(orders.tenantId, tenantId))).orderBy(desc(orders.createdAt)),
      db.select().from(ausgangsrechnung).where(and(
        eq(ausgangsrechnung.tenantId, tenantId),
        eq(ausgangsrechnung.kundeId, customer.customerNumber || customer.id),
      )),
      db.select().from(complaints).where(and(
        eq(complaints.tenantId, tenantId),
        eq(complaints.customerId, customer.id),
      )).orderBy(desc(complaints.createdAt)),
    ]);

    const agreementsRes = agreementRows.map((agreement) => {
      const rate = Number(agreement.rate);
      return {
        id: agreement.id,
        customerId: agreement.customerId,
        title: agreement.scope,
        currency: "EUR" as const,
        ...(Number.isFinite(rate) ? { price: rate } : {}),
        validFrom: agreement.date.toISOString(),
      };
    });
    const complaintsRes = complaintRows.map((complaint) => ({
      ...complaint,
      createdAt: complaint.createdAt.toISOString(),
      resolvedAt: complaint.resolvedAt?.toISOString(),
    }));

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
