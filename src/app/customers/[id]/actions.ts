"use server";

import { db } from "@/db";
import { customers, priceAgreements, orders, qs, ausgangsrechnung } from "@/db/schema";
import { checkAppAuth } from "@/lib/server/authHelper";
import type { Order } from "@/lib/repositories/ordersRepository";
import type { PriceAgreement } from "@/lib/repositories/priceAgreementsRepository";
import type { Customer } from "@/lib/types/customer";
import { eq, or, type InferSelectModel } from "drizzle-orm";

type CustomerRow = InferSelectModel<typeof customers>;
type PriceAgreementRow = InferSelectModel<typeof priceAgreements>;
type OrderRow = InferSelectModel<typeof orders>;
type QualityCheckRow = InferSelectModel<typeof qs>;

type CustomerQualityCheck = {
  id: string;
  customerId: string;
  orderId: string;
  result: string;
  description: string;
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
};

type CustomerDetails = {
  customer: Customer;
  agreements: PriceAgreement[];
  orders: Order[];
  rechnungen: InferSelectModel<typeof ausgangsrechnung>[];
  complaints: CustomerQualityCheck[];
};

function toIsoString(value: Date | null): string | undefined {
  return value?.toISOString();
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value.filter((entry): entry is string => typeof entry === "string");
}

function customerType(value: string): Customer["type"] {
  switch (value) {
    case "business":
    case "institution":
    case "private":
    case "Privatkunde":
    case "Geschäftskunde":
    case "Institution":
      return value;
    case "privat":
      return "private";
    default:
      return "private";
  }
}

function preferredCommunication(value: string | null): Customer["prefComm"] {
  if (value === "E-Mail" || value === "Telefon" || value === "Brief / Post" || value === "whatsapp" || value === "unknown") {
    return value;
  }

  return undefined;
}

function customerRisk(value: string | null): Customer["risk"] {
  if (value === "Niedrig" || value === "Mittel" || value === "Hoch") {
    return value;
  }

  return undefined;
}

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    customerNumber: row.customerNumber ?? row.id,
    name: row.name,
    type: customerType(row.type),
    street: row.street ?? undefined,
    city: row.city ?? undefined,
    zipCode: row.zipCode ?? undefined,
    country: row.country ?? undefined,
    address: row.address ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    contactPerson: row.contactPerson ?? undefined,
    companyName: row.companyName ?? undefined,
    imageUrls: stringArray(row.imageUrls),
    prefComm: preferredCommunication(row.prefComm),
    risk: customerRisk(row.risk),
    riskNote: row.riskNote ?? undefined,
    notes: row.notes ?? undefined,
    internalWarning: row.internalWarning ?? undefined,
    tags: stringArray(row.tags),
    creditRating: row.creditRating ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPriceAgreement(row: PriceAgreementRow): PriceAgreement {
  const parsedRate = Number(row.rate.replace(",", "."));

  return {
    id: row.id,
    customerId: row.customerId,
    title: row.scope,
    surfaceType: row.scope,
    price: Number.isFinite(parsedRate) ? parsedRate : undefined,
    currency: "EUR",
    validFrom: row.date.toISOString(),
  };
}

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    customerId: row.customerId,
    title: row.title,
    station: row.station,
    status: row.status,
    risk: row.risk ?? "green",
    currentStationId: row.currentStationId ?? undefined,
    dueDate: toIsoString(row.dueDate),
    parts: row.parts ?? [],
    statusText: row.statusText ?? (row.status === "completed" ? "ERLEDIGT" : "IN ARBEIT"),
    delayReason: row.delayReason ?? undefined,
    recommendedAction: row.recommendedAction ?? undefined,
    intakeDate: toIsoString(row.intakeDate),
    task: row.task ?? undefined,
    attachmentUrl: row.attachmentUrl ?? undefined,
    source: row.source ?? undefined,
  };
}

function toCustomerQualityCheck(row: QualityCheckRow, customerId: string): CustomerQualityCheck {
  const isPassed = row.ergebnis === "bestanden";

  return {
    id: row.id,
    customerId,
    orderId: row.orderId,
    result: row.ergebnis,
    description: row.bemerkung ?? "Qualitätsprüfung",
    createdAt: row.createdAt.toISOString(),
    resolvedAt: isPassed ? row.datum.toISOString() : undefined,
    resolution: isPassed ? "OK" : "Nacharbeit nötig",
  };
}

export async function getCustomerDetailsAction(customerIdOrNumber: string): Promise<
  | { ok: true; data: CustomerDetails }
  | { ok: false; error: string; message: string }
> {
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
    const rechnungenRes = await db.select().from(ausgangsrechnung).where(eq(ausgangsrechnung.kundeId, customer.customerNumber || customer.id));

    // get qs logic (qs has orderId)
    // We fetch all qs and filter manually because Drizzle joins can be tricky to type dynamically here without a defined relation
    const allQs = await db.select().from(qs);
    const orderIds = ordersRes.map(o => o.id);
    const complaintsRes = allQs.filter(q => orderIds.includes(q.orderId));

    return {
      ok: true,
      data: {
        customer: toCustomer(customer),
        agreements: agreementsRes.map(toPriceAgreement),
        orders: ordersRes.map(toOrder),
        rechnungen: rechnungenRes,
        complaints: complaintsRes.map((complaint) => toCustomerQualityCheck(complaint, customer.id)),
      }
    };
  } catch (error) {
    console.error("Error in getCustomerDetailsAction:", error);
    return { ok: false, error: "QUERY_ERROR", message: String(error) };
  }
}
