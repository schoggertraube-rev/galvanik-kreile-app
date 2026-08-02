"use server";

import { db } from "@/db";
import { communications, customers, orders, payments, qs } from "@/db/schema";
import { resolveFinanceDataScope } from "@/lib/server/financeDataAccess";
import { and, desc, eq, inArray } from "drizzle-orm";

export type ClientDossierDataDto = {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    prefComm: string | null;
    type: string;
    risk: string | null;
    notes: string | null;
    tags: string[];
    createdAt: string;
  };
  orders: Array<{
    id: string;
    orderNumber: string;
    title: string;
    task: string | null;
    status: string;
    statusText: string | null;
    dueDate: string | null;
  }>;
  communications: Array<{
    id: string;
    type: string | null;
    channelType: string | null;
    createdAt: string;
  }>;
  capabilities: {
    canViewFinance: boolean;
    canViewQuality: boolean;
  };
  payments?: Array<{
    id: string;
    amountEur: string;
    status: string;
    provider: string;
    mollieMethod: string | null;
    createdAt: string;
  }>;
  quality?: Array<{
    id: string;
    orderId: string;
    result: string;
  }>;
};

type ClientDossierResult =
  | { ok: true; data: ClientDossierDataDto }
  | {
      ok: false;
      error: "UNAUTHORIZED" | "FORBIDDEN" | "DB_ERROR" | "NOT_FOUND";
      message: string;
    };

function logDossierQueryError(error: unknown): void {
  const metadata = error as { message?: string; details?: string; hint?: string };
  console.error("Client dossier query failed:", {
    message: metadata.message ?? String(error),
    details: metadata.details,
    hint: metadata.hint,
  });
}

export async function getClientDossierAction(
  customerId: string,
): Promise<ClientDossierResult> {
  const scope = await resolveFinanceDataScope(["perm_view_customers"]);
  if (!scope.ok) return scope;

  const { tenantId, canViewFinance, canViewQuality } = scope.data;

  try {
    const [customer] = await db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
        street: customers.street,
        city: customers.city,
        prefComm: customers.prefComm,
        type: customers.type,
        risk: customers.risk,
        notes: customers.notes,
        tags: customers.tags,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
      .limit(1);

    if (!customer) {
      return { ok: false, error: "NOT_FOUND", message: "Kunde nicht gefunden" };
    }

    const [orderRows, communicationRows] = await Promise.all([
      db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          title: orders.title,
          task: orders.task,
          status: orders.status,
          statusText: orders.statusText,
          dueDate: orders.dueDate,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(and(eq(orders.customerId, customerId), eq(orders.tenantId, tenantId)))
        .orderBy(desc(orders.createdAt)),
      db
        .select({
          id: communications.id,
          type: communications.type,
          channelType: communications.channelType,
          createdAt: communications.createdAt,
        })
        .from(communications)
        .where(
          and(
            eq(communications.customerId, customerId),
            eq(communications.tenantId, tenantId),
          ),
        )
        .orderBy(desc(communications.createdAt)),
    ]);

    const data: ClientDossierDataDto = {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address ?? customer.street,
        city: customer.city,
        prefComm: customer.prefComm,
        type: customer.type,
        risk: customer.risk,
        notes: customer.notes,
        tags: Array.isArray(customer.tags)
          ? customer.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
        createdAt: customer.createdAt.toISOString(),
      },
      orders: orderRows.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        title: order.title,
        task: order.task,
        status: order.status,
        statusText: order.statusText,
        dueDate: order.dueDate?.toISOString() ?? null,
      })),
      communications: communicationRows.map((communication) => ({
        id: communication.id,
        type: communication.type,
        channelType: communication.channelType,
        createdAt: communication.createdAt.toISOString(),
      })),
      capabilities: { canViewFinance, canViewQuality },
    };

    const orderIds = orderRows.map((order) => order.id);

    if (canViewFinance) {
      const paymentRows =
        orderIds.length === 0
          ? []
          : await db
              .select({
                id: payments.id,
                amountEur: payments.amountEur,
                status: payments.status,
                provider: payments.provider,
                mollieMethod: payments.mollieMethod,
                createdAt: payments.createdAt,
              })
              .from(payments)
              .where(
                and(
                  eq(payments.tenantId, tenantId),
                  inArray(payments.orderId, orderIds),
                ),
              )
              .orderBy(desc(payments.createdAt));

      data.payments = paymentRows.map((payment) => ({
        id: payment.id,
        amountEur: payment.amountEur,
        status: payment.status,
        provider: payment.provider,
        mollieMethod: payment.mollieMethod,
        createdAt: payment.createdAt.toISOString(),
      }));
    }

    if (canViewQuality) {
      const qualityRows =
        orderIds.length === 0
          ? []
          : await db
              .select({
                id: qs.id,
                orderId: qs.orderId,
                result: qs.ergebnis,
              })
              .from(qs)
              .where(and(eq(qs.tenantId, tenantId), inArray(qs.orderId, orderIds)));

      data.quality = qualityRows;
    }

    return { ok: true, data };
  } catch (error) {
    logDossierQueryError(error);
    return {
      ok: false,
      error: "DB_ERROR",
      message: "Kundendossier konnte nicht geladen werden.",
    };
  }
}
