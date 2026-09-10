"use server";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { complaints, customers, orders, priceAgreements } from "@/db/schema";
import type { ausgangsrechnung } from "@/db/schema_buchhaltung";

const NOT_AVAILABLE_MESSAGE = "NOT_AVAILABLE: Die Kundenakte benötigt einen tenant- und ownership-geprüften W3-Read-/Command-Vertrag.";

export type CustomerTimelineEntry = {
  id: string;
  type: "status" | "note" | "email";
  title: string | null;
  subtitle: string | null;
  timestamp: string;
  relatedOrderId?: string;
  severity: "critical" | "neutral";
};

export type CustomerKpiRow = {
  customer_id: string;
  kunde: string;
  classification: string;
  kunde_seit: string;
  umsatz_ltv: number;
  gewinn_ltv: number;
  offene_posten: number;
  aktive_auftraege: number;
  puenktlichkeit_pct: number | null;
  reklamationen: number;
};

export type CustomerItemProfileRow = {
  bezeichnung: string;
  material: string | null;
  oberflaeche: string | null;
  count: number;
  last_seen: string;
  avg_price: null;
};

export type CustomerInvoice = Pick<InferSelectModel<typeof ausgangsrechnung>,
  "id" | "nummer" | "status" | "datum" | "faelligAm" | "brutto"
>;

export type CustomerFinancials = {
  invoices: CustomerInvoice[];
};

export type CustomerPriceAgreement = Pick<InferSelectModel<typeof priceAgreements>,
  "id" | "scope" | "date" | "rate"
>;

type CustomerRow = InferSelectModel<typeof customers>;
type OrderRow = InferSelectModel<typeof orders>;
type CustomerComplaintRow = {
  complaints: InferSelectModel<typeof complaints>;
  orders: OrderRow;
};
type CustomerCardData = CustomerRow & {
  kpi: CustomerKpiRow | null;
  openOrders: OrderRow[];
};
type CustomerCorePatch = Pick<InferInsertModel<typeof customers>,
  "shippingPreference" | "paymentPreference" | "classification" | "internalNotes" | "tags" | "name" | "contactPerson" | "email" | "phone"
>;
type CustomerCardDenial = {
  ok: false;
  error: "NOT_AVAILABLE";
  message: typeof NOT_AVAILABLE_MESSAGE;
};
type CustomerCardReadResult<T> = { ok: true; data: T } | CustomerCardDenial;
type CustomerCardWriteResult = { ok: true } | CustomerCardDenial;

function unavailable(): CustomerCardDenial {
  return {
    ok: false,
    error: "NOT_AVAILABLE",
    message: NOT_AVAILABLE_MESSAGE,
  };
}

export async function getCustomerCard(customerId: string): Promise<CustomerCardReadResult<CustomerCardData>> {
  void customerId;
  return unavailable();
}

export async function getCustomerOrders(customerId: string): Promise<CustomerCardReadResult<OrderRow[]>> {
  void customerId;
  return unavailable();
}

export async function getCustomerTimeline(customerId: string): Promise<CustomerCardReadResult<CustomerTimelineEntry[]>> {
  void customerId;
  return unavailable();
}

export async function getCustomerFinancials(customerId: string): Promise<CustomerCardReadResult<CustomerFinancials>> {
  void customerId;
  return unavailable();
}

export async function getCustomerSimilarOrders(customerId: string, orderId?: string): Promise<CustomerCardReadResult<OrderRow[]>> {
  void customerId;
  void orderId;
  return unavailable();
}

export async function getCustomerItems(customerId: string): Promise<CustomerCardReadResult<CustomerItemProfileRow[]>> {
  void customerId;
  return unavailable();
}

export async function getCustomerPrices(customerId: string): Promise<CustomerCardReadResult<CustomerPriceAgreement[]>> {
  void customerId;
  return unavailable();
}

export async function getCustomerComplaints(customerId: string): Promise<CustomerCardReadResult<CustomerComplaintRow[]>> {
  void customerId;
  return unavailable();
}

export async function updateCustomerCore(customerId: string, patch: Partial<CustomerCorePatch>): Promise<CustomerCardWriteResult> {
  void customerId;
  void patch;
  return unavailable();
}

export async function addCustomerTag(customerId: string, tag: string): Promise<CustomerCardWriteResult> {
  void customerId;
  void tag;
  return unavailable();
}

export async function removeCustomerTag(customerId: string, tag: string): Promise<CustomerCardWriteResult> {
  void customerId;
  void tag;
  return unavailable();
}
