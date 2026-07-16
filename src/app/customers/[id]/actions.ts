"use server";

import { db } from "@/db";
import { complaints, customers, priceAgreements, orders, ausgangsrechnung } from "@/db/schema";
import { and, desc, eq, or } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";

const ENTITY_ID = /^[A-Za-z0-9_-]{1,100}$/;

function projectCustomer(customer: typeof customers.$inferSelect, canViewPrices: boolean) {
  const base = {
    id: customer.id,
    customerNumber: customer.customerNumber,
    name: customer.name,
    type: customer.type,
    street: customer.street,
    city: customer.city,
    zipCode: customer.zipCode,
    country: customer.country,
    address: customer.address,
    companyName: customer.companyName,
    contactPerson: customer.contactPerson,
    phone: customer.phone,
    email: customer.email,
    prefComm: customer.prefComm,
    risk: customer.risk,
    riskNote: customer.riskNote,
    notes: customer.notes,
    imageUrls: customer.imageUrls,
    approvalProfile: customer.approvalProfile,
    expectationProfile: customer.expectationProfile,
    technicalProfile: customer.technicalProfile,
    trustLevel: customer.trustLevel,
    internalWarning: customer.internalWarning,
    tags: customer.tags,
    shippingPreference: customer.shippingPreference,
    classification: customer.classification,
    internalNotes: customer.internalNotes,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
  return canViewPrices
    ? {
        ...base,
        paymentProfile: customer.paymentProfile,
        paymentPreference: customer.paymentPreference,
        creditRating: customer.creditRating,
      }
    : base;
}

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
    const canViewPrices = authorization.data.permissions.includes("perm_view_prices");
    const canViewQa = authorization.data.permissions.includes("perm_op_qa");

    const [agreementRows, ordersRes, rechnungenRes, complaintRows] = await Promise.all([
      canViewPrices
        ? db.select().from(priceAgreements).where(eq(priceAgreements.customerId, customer.id)).orderBy(desc(priceAgreements.date))
        : Promise.resolve([]),
      db.select().from(orders).where(and(eq(orders.customerId, customer.id), eq(orders.tenantId, tenantId))).orderBy(desc(orders.createdAt)),
      canViewPrices
        ? db.select().from(ausgangsrechnung).where(and(
            eq(ausgangsrechnung.tenantId, tenantId),
            eq(ausgangsrechnung.kundeId, customer.id),
            eq(ausgangsrechnung.isDemo, false),
          )).orderBy(desc(ausgangsrechnung.datum))
        : Promise.resolve([]),
      canViewQa
        ? db.select().from(complaints).where(and(
            eq(complaints.tenantId, tenantId),
            eq(complaints.customerId, customer.id),
          )).orderBy(desc(complaints.createdAt))
        : Promise.resolve([]),
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
        customer: projectCustomer(customer, canViewPrices),
        agreements: agreementsRes,
        orders: ordersRes,
        rechnungen: rechnungenRes,
        complaints: complaintsRes,
        capabilities: {
          canViewPrices,
          canViewQa,
          communicationProjection: "not_connected" as const,
          marketingProjection: "not_connected" as const,
          anonymization: "retention_policy_and_durable_receipt_missing" as const,
        },
      }
    };
  } catch (error) {
    console.error("Error in getCustomerDetailsAction:", error);
    return { ok: false, error: "QUERY_ERROR", message: "Kundendetails konnten nicht geladen werden." };
  }
}
