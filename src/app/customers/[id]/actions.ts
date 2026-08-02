"use server";

import { db } from "@/db";
import { customers, orders, priceAgreements, qs } from "@/db/schema";
import { ausgangsrechnung } from "@/db/schema_buchhaltung";
import { resolveFinanceDataScope } from "@/lib/server/financeDataAccess";
import { and, desc, eq, inArray, or } from "drizzle-orm";

export type CustomerDetailsCustomerDto = {
  id: string;
  customerNumber: string;
  name: string;
  type: string;
  street?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  address?: string;
  companyName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  prefComm?: string;
  risk?: string;
  riskNote?: string;
  notes?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type CustomerDetailsOrderDto = {
  id: string;
  orderNumber: string;
  customerId: string;
  title: string;
  task?: string;
  station: string;
  currentStationId?: string;
  status: string;
  risk: string;
  parts: Record<string, unknown>[];
  statusText?: string;
  delayReason?: string;
  recommendedAction?: string;
  intakeDate?: string;
  dueDate?: string;
  source?: string;
  attachmentUrl?: string;
};

export type CustomerPriceAgreementDto = {
  id: string;
  customerId: string;
  title: string;
  price?: number;
  currency: "EUR";
  validFrom?: string;
};

export type CustomerInvoiceDto = {
  id: string;
  number: string;
  date: string;
  dueDate?: string;
  gross: number;
  status: string;
};

export type CustomerQualityDto = {
  id: string;
  orderId: string;
  result: string;
  note?: string;
  date: string;
  createdAt: string;
};

type CustomerDetailsData = {
  customer: CustomerDetailsCustomerDto;
  orders: CustomerDetailsOrderDto[];
  capabilities: {
    canViewFinance: boolean;
    canViewQuality: boolean;
  };
  agreements?: CustomerPriceAgreementDto[];
  invoices?: CustomerInvoiceDto[];
  complaints?: CustomerQualityDto[];
};

type CustomerDetailsResult =
  | { ok: true; data: CustomerDetailsData }
  | {
      ok: false;
      error: "AUTH_ERROR" | "FORBIDDEN" | "DB_ERROR" | "NOT_FOUND" | "QUERY_ERROR";
      message: string;
    };

function logCustomerQueryError(error: unknown): void {
  const metadata = error as { message?: string; details?: string; hint?: string };
  console.error("Error in getCustomerDetailsAction:", {
    message: metadata.message ?? String(error),
    details: metadata.details,
    hint: metadata.hint,
  });
}

function sanitizeOrderParts(
  parts: Record<string, unknown>[] | null,
): Record<string, unknown>[] {
  if (!Array.isArray(parts)) return [];

  return parts.flatMap((part) => {
    if (!part || typeof part !== "object" || Array.isArray(part)) return [];

    const name = typeof part.name === "string" ? part.name : "Unbekanntes Teil";
    const parsedQuantity = Number(part.quantity ?? 1);
    const quantity = Number.isFinite(parsedQuantity) ? parsedQuantity : 1;

    return [{ name, quantity }];
  });
}

export async function getCustomerDetailsAction(
  customerIdOrNumber: string,
): Promise<CustomerDetailsResult> {
  const scope = await resolveFinanceDataScope(["perm_view_customers"]);
  if (!scope.ok) {
    return {
      ok: false,
      error:
        scope.error === "FORBIDDEN"
          ? "FORBIDDEN"
          : scope.error === "DB_ERROR"
            ? "DB_ERROR"
            : "AUTH_ERROR",
      message: scope.message,
    };
  }

  const { tenantId, canViewFinance, canViewQuality } = scope.data;

  try {
    const [customerRecord] = await db
      .select({
        id: customers.id,
        customerNumber: customers.customerNumber,
        name: customers.name,
        type: customers.type,
        street: customers.street,
        city: customers.city,
        zipCode: customers.zipCode,
        country: customers.country,
        address: customers.address,
        companyName: customers.companyName,
        contactPerson: customers.contactPerson,
        phone: customers.phone,
        email: customers.email,
        prefComm: customers.prefComm,
        risk: customers.risk,
        riskNote: customers.riskNote,
        notes: customers.notes,
        tags: customers.tags,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
      })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenantId),
          or(
            eq(customers.id, customerIdOrNumber),
            eq(customers.customerNumber, customerIdOrNumber),
          ),
        ),
      )
      .limit(1);

    if (!customerRecord) {
      return { ok: false, error: "NOT_FOUND", message: "Kunde nicht gefunden" };
    }

    const orderRecords = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerId: orders.customerId,
        title: orders.title,
        task: orders.task,
        station: orders.station,
        currentStationId: orders.currentStationId,
        status: orders.status,
        risk: orders.risk,
        parts: orders.parts,
        statusText: orders.statusText,
        delayReason: orders.delayReason,
        recommendedAction: orders.recommendedAction,
        intakeDate: orders.intakeDate,
        dueDate: orders.dueDate,
        source: orders.source,
        attachmentUrl: orders.attachmentUrl,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(
        and(
          eq(orders.customerId, customerRecord.id),
          eq(orders.tenantId, tenantId),
        ),
      )
      .orderBy(desc(orders.createdAt));

    const data: CustomerDetailsData = {
      customer: {
        id: customerRecord.id,
        customerNumber: customerRecord.customerNumber ?? customerRecord.id,
        name: customerRecord.name,
        type: customerRecord.type,
        street: customerRecord.street ?? undefined,
        city: customerRecord.city ?? undefined,
        zipCode: customerRecord.zipCode ?? undefined,
        country: customerRecord.country ?? undefined,
        address: customerRecord.address ?? customerRecord.street ?? undefined,
        companyName: customerRecord.companyName ?? undefined,
        contactPerson: customerRecord.contactPerson ?? undefined,
        phone: customerRecord.phone ?? undefined,
        email: customerRecord.email ?? undefined,
        prefComm: customerRecord.prefComm ?? undefined,
        risk: customerRecord.risk ?? undefined,
        riskNote: customerRecord.riskNote ?? undefined,
        notes: customerRecord.notes ?? undefined,
        tags: Array.isArray(customerRecord.tags)
          ? customerRecord.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
        createdAt: customerRecord.createdAt?.toISOString(),
        updatedAt: customerRecord.updatedAt?.toISOString(),
      },
      orders: orderRecords.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        title: order.title,
        task: order.task ?? undefined,
        station: order.station,
        currentStationId: order.currentStationId ?? undefined,
        status: order.status,
        risk: order.risk ?? "green",
        parts: sanitizeOrderParts(order.parts),
        statusText: order.statusText ?? undefined,
        delayReason: order.delayReason ?? undefined,
        recommendedAction: order.recommendedAction ?? undefined,
        intakeDate: order.intakeDate?.toISOString(),
        dueDate: order.dueDate?.toISOString(),
        source: order.source ?? undefined,
        attachmentUrl: order.attachmentUrl ?? undefined,
      })),
      capabilities: { canViewFinance, canViewQuality },
    };

    const orderIds = orderRecords.map((order) => order.id);

    if (canViewFinance) {
      const [agreementRecords, invoiceRecords] = await Promise.all([
        db
          .select({
            id: priceAgreements.id,
            customerId: priceAgreements.customerId,
            scope: priceAgreements.scope,
            rate: priceAgreements.rate,
            date: priceAgreements.date,
          })
          .from(priceAgreements)
          .where(eq(priceAgreements.customerId, customerRecord.id)),
        db
          .select({
            id: ausgangsrechnung.id,
            number: ausgangsrechnung.nummer,
            date: ausgangsrechnung.datum,
            dueDate: ausgangsrechnung.faelligAm,
            gross: ausgangsrechnung.brutto,
            status: ausgangsrechnung.status,
          })
          .from(ausgangsrechnung)
          .where(
            and(
              eq(ausgangsrechnung.tenantId, tenantId),
              or(
                eq(ausgangsrechnung.kundeId, customerRecord.customerNumber ?? ""),
                eq(ausgangsrechnung.kundeId, customerRecord.id),
              ),
            ),
          )
          .orderBy(desc(ausgangsrechnung.datum)),
      ]);

      data.agreements = agreementRecords.map((agreement) => ({
        id: agreement.id,
        customerId: agreement.customerId,
        title: agreement.scope,
        price: Number(agreement.rate),
        currency: "EUR",
        validFrom: agreement.date.toISOString(),
      }));
      data.invoices = invoiceRecords.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        date: invoice.date,
        dueDate: invoice.dueDate ?? undefined,
        gross: Number(invoice.gross),
        status: invoice.status,
      }));
    }

    if (canViewQuality) {
      const qualityRecords =
        orderIds.length === 0
          ? []
          : await db
              .select({
                id: qs.id,
                orderId: qs.orderId,
                result: qs.ergebnis,
                note: qs.bemerkung,
                date: qs.datum,
                createdAt: qs.createdAt,
              })
              .from(qs)
              .where(and(eq(qs.tenantId, tenantId), inArray(qs.orderId, orderIds)))
              .orderBy(desc(qs.createdAt));

      data.complaints = qualityRecords.map((quality) => ({
        id: quality.id,
        orderId: quality.orderId,
        result: quality.result,
        note: quality.note ?? undefined,
        date: quality.date.toISOString(),
        createdAt: quality.createdAt.toISOString(),
      }));
    }

    return { ok: true, data };
  } catch (error) {
    logCustomerQueryError(error);
    return {
      ok: false,
      error: "QUERY_ERROR",
      message: "Kundendaten konnten nicht geladen werden.",
    };
  }
}
