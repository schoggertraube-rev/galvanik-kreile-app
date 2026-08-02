"use server";

import { db } from "@/db";
import { orders, items, events, customers, priceLines, payments } from "@/db/schema";
import { ausgangsrechnung } from "@/db/schema_buchhaltung";
import { resolveFinanceDataScope } from "@/lib/server/financeDataAccess";
import { and, asc, desc, eq, notInArray, or, sql } from "drizzle-orm";

export type OrderDetailsItemDto = {
  id: string;
  name: string;
  quantity: number;
  currentStationId: string | null;
  material: string | null;
  surfaceRequested: string | null;
  photo: string | null;
  createdAt: Date;
};

export type OrderDetailsEventDto = {
  id: string;
  eventType: string;
  description: string | null;
  notes: string | null;
  status: string | null;
  station: string | null;
  createdAt: Date;
};

export type OrderPriceLineDto = {
  id: string;
  orderId: string;
  itemId: string | null;
  positionText: string;
  qty: string | null;
  unitPriceEur: string;
  unitTotalEur: string | null;
  sortOrder: number | null;
};

export type OrderPaymentDto = {
  id: string;
  orderId: string | null;
  amountEur: string;
  status: string;
  provider: string;
  mollieStatus: string | null;
  mollieMethod: string | null;
  receiptUrl: string | null;
  createdAt: Date;
};

type OrderFinanceDto = {
  dbGeplant: string | null;
  dbIst: string | null;
  dbLetzteBerechnung: Date | null;
  priceLines: OrderPriceLineDto[];
  payments: OrderPaymentDto[];
  customerKpis: {
    ltv: number;
    activeOrdersCount: number;
  };
};

export type OrderDetailsDto = {
  id: string;
  orderNumber: string;
  customerId: string;
  title: string;
  task: string | null;
  station: string;
  currentStationId: string | null;
  status: string;
  risk: string | null;
  priority: string | null;
  statusText: string | null;
  dueDate: Date | null;
  customer: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  items: OrderDetailsItemDto[];
  events: OrderDetailsEventDto[];
  capabilities: {
    canViewFinance: boolean;
  };
} & Partial<OrderFinanceDto>;

function logOrderQueryError(error: unknown): void {
  const metadata = error as { message?: string; details?: string; hint?: string };
  console.error("Fehler beim Laden des Auftrags:", {
    message: metadata.message ?? String(error),
    details: metadata.details,
    hint: metadata.hint,
  });
}

export async function getOrderWithDetails(orderId: string): Promise<OrderDetailsDto | null> {
  if (!orderId.trim()) return null;

  const scope = await resolveFinanceDataScope([
    "perm_data_orders",
    "perm_view_leitstand",
  ]);
  if (!scope.ok) return null;

  const { tenantId, canViewFinance } = scope.data;

  try {
    const [orderRecord] = await db
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
        priority: orders.priority,
        statusText: orders.statusText,
        dueDate: orders.dueDate,
      })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
      .limit(1);

    if (!orderRecord) return null;

    const [customerRecord] = await db
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        customerNumber: customers.customerNumber,
      })
      .from(customers)
      .where(
        and(
          eq(customers.id, orderRecord.customerId),
          eq(customers.tenantId, tenantId),
        ),
      )
      .limit(1);

    const [itemsData, eventsData] = await Promise.all([
      db
        .select({
          id: items.id,
          name: items.name,
          quantity: items.quantity,
          currentStationId: items.currentStationId,
          material: items.material,
          surfaceRequested: items.surfaceRequested,
          photo: items.photo,
          createdAt: items.createdAt,
        })
        .from(items)
        .where(and(eq(items.orderId, orderId), eq(items.tenantId, tenantId)))
        .orderBy(asc(items.createdAt)),
      db
        .select({
          id: events.id,
          eventType: events.eventType,
          description: events.description,
          notes: events.notes,
          status: events.status,
          station: events.station,
          createdAt: events.createdAt,
        })
        .from(events)
        .where(and(eq(events.orderId, orderId), eq(events.tenantId, tenantId)))
        .orderBy(desc(events.createdAt)),
    ]);

    const baseDto: OrderDetailsDto = {
      id: orderRecord.id,
      orderNumber: orderRecord.orderNumber,
      customerId: orderRecord.customerId,
      title: orderRecord.title,
      task: orderRecord.task,
      station: orderRecord.station,
      currentStationId: orderRecord.currentStationId,
      status: orderRecord.status,
      risk: orderRecord.risk,
      priority: orderRecord.priority,
      statusText: orderRecord.statusText,
      dueDate: orderRecord.dueDate,
      customer: customerRecord
        ? {
            id: customerRecord.id,
            name: customerRecord.name,
            email: customerRecord.email,
          }
        : null,
      items: itemsData,
      events: eventsData,
      capabilities: { canViewFinance },
    };

    if (!canViewFinance) return baseDto;

    const [orderFinanceRows, priceLinesData, paymentsData, ltvResult, activeOrdersResult] =
      await Promise.all([
        db
          .select({
            dbGeplant: orders.dbGeplant,
            dbIst: orders.dbIst,
            dbLetzteBerechnung: orders.dbLetzteBerechnung,
          })
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
          .limit(1),
        db
          .select({
            id: priceLines.id,
            orderId: priceLines.orderId,
            itemId: priceLines.itemId,
            positionText: priceLines.positionText,
            qty: priceLines.qty,
            unitPriceEur: priceLines.unitPriceEur,
            unitTotalEur: priceLines.unitTotalEur,
            sortOrder: priceLines.sortOrder,
          })
          .from(priceLines)
          .where(
            and(
              eq(priceLines.orderId, orderId),
              eq(priceLines.tenantId, tenantId),
            ),
          )
          .orderBy(asc(priceLines.sortOrder)),
        db
          .select({
            id: payments.id,
            orderId: payments.orderId,
            amountEur: payments.amountEur,
            status: payments.status,
            provider: payments.provider,
            mollieStatus: payments.mollieStatus,
            mollieMethod: payments.mollieMethod,
            receiptUrl: payments.receiptUrl,
            createdAt: payments.createdAt,
          })
          .from(payments)
          .where(
            and(eq(payments.orderId, orderId), eq(payments.tenantId, tenantId)),
          )
          .orderBy(desc(payments.createdAt)),
        db
          .select({ value: sql<number>`coalesce(sum(${ausgangsrechnung.brutto}), 0)` })
          .from(ausgangsrechnung)
          .where(
            and(
              eq(ausgangsrechnung.tenantId, tenantId),
              or(
                eq(ausgangsrechnung.kundeId, customerRecord?.customerNumber ?? ""),
                eq(ausgangsrechnung.kundeId, orderRecord.customerId),
              ),
            ),
          ),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(orders)
          .where(
            and(
              eq(orders.customerId, orderRecord.customerId),
              eq(orders.tenantId, tenantId),
              notInArray(orders.status, [
                "abgeschlossen",
                "storniert",
                "completed",
                "cancelled",
              ]),
            ),
          ),
      ]);

    const orderFinance = orderFinanceRows[0];

    return {
      ...baseDto,
      dbGeplant: orderFinance?.dbGeplant ?? null,
      dbIst: orderFinance?.dbIst ?? null,
      dbLetzteBerechnung: orderFinance?.dbLetzteBerechnung ?? null,
      priceLines: priceLinesData.map((line) => ({
        id: line.id,
        orderId: line.orderId,
        itemId: line.itemId,
        positionText: line.positionText,
        qty: line.qty,
        unitPriceEur: line.unitPriceEur,
        unitTotalEur: line.unitTotalEur,
        sortOrder: line.sortOrder,
      })),
      payments: paymentsData.map((payment) => ({
        id: payment.id,
        orderId: payment.orderId,
        amountEur: payment.amountEur,
        status: payment.status,
        provider: payment.provider,
        mollieStatus: payment.mollieStatus,
        mollieMethod: payment.mollieMethod,
        receiptUrl: payment.receiptUrl,
        createdAt: payment.createdAt,
      })),
      customerKpis: {
        ltv: Number(ltvResult[0]?.value ?? 0),
        activeOrdersCount: Number(activeOrdersResult[0]?.count ?? 0),
      },
    };
  } catch (error) {
    logOrderQueryError(error);
    return null;
  }
}
