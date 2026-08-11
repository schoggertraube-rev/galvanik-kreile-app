import "server-only";

import { and, desc, eq, inArray, isNull, notIlike, notInArray, or, sql } from "drizzle-orm";
import { customers, items, orders } from "@/db/schema";
import { evaluateOrderPriority } from "@/lib/priority";
import type { OperationalOrder, OperationalOrderItem } from "@/lib/types/operationalOrder";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

type Station = "wareneingang" | "galvanik";

function toSafeIsoDate(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function isPositiveVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function stationPredicate(station: Station) {
  if (station === "galvanik") {
    return and(
      eq(orders.station, "galvanik"),
      eq(orders.currentStation, "galvanik"),
      eq(orders.currentStationId, "galvanik"),
    );
  }

  return and(
    eq(orders.station, "wareneingang"),
    or(eq(orders.currentStation, "wareneingang"), isNull(orders.currentStation)),
    or(eq(orders.currentStationId, "wareneingang"), isNull(orders.currentStationId)),
  );
}

/**
 * Fresh, tenant-bound W3 station read. Its station is internal and selected only
 * by a server action after authorization; it is never a client supplied route value.
 */
export async function readTenantStationOrders(
  authorization: Pick<AuthorizationSnapshot, "tenantId">,
  station: Station,
): Promise<OperationalOrder[]> {
  const { tenantId } = authorization;
  return withPrivilegedTenantTransaction({ tenantId }, async (tx) => {
    const rows = await tx
      .select({
        id: orders.id,
        version: orders.version,
        orderNumber: orders.orderNumber,
        customerId: orders.customerId,
        customerName: customers.name,
        title: orders.title,
        task: orders.task,
        station: orders.station,
        currentStationId: orders.currentStationId,
        status: orders.status,
        risk: orders.priorityComputed,
        intakeDate: orders.intakeDate,
        dueDate: orders.dueDate,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .leftJoin(
        customers,
        and(eq(customers.id, orders.customerId), eq(customers.tenantId, tenantId)),
      )
      .where(
        and(
          eq(orders.tenantId, tenantId),
          stationPredicate(station),
          notInArray(sql`coalesce(${orders.source}, 'manual')`, [
            "seed",
            "test",
            "demo",
            "integration-test",
          ]),
          notIlike(sql`coalesce(${orders.orderNumber}, '')`, "A-SEED-%"),
          notIlike(sql`coalesce(${orders.orderNumber}, '')`, "%TEST%"),
        ),
      )
      .orderBy(desc(orders.createdAt));

    if (rows.some((row) => !isPositiveVersion(row.version))) {
      throw new Error("ORDER_VERSION_INVALID");
    }

    const orderIds = rows.map((row) => row.id);
    const tenantItems: OperationalOrderItem[] = orderIds.length === 0
      ? []
      : await tx
          .select()
          .from(items)
          .where(and(eq(items.tenantId, tenantId), inArray(items.orderId, orderIds)));

    return rows.map((row) => {
      const dueDate = toSafeIsoDate(row.dueDate);
      const priority = evaluateOrderPriority({
        dueDate,
        risk: row.risk ?? undefined,
        isBlocked: row.status === "blocked" || row.risk === "blocked",
      });
      const parts = tenantItems.filter((item) => item.orderId === row.id);

      return {
        id: row.id,
        version: row.version,
        orderNumber: row.orderNumber,
        customerId: row.customerId,
        customerName: row.customerName ?? null,
        title: row.title,
        task: row.task,
        itemDescription: row.task || parts[0]?.name || null,
        surfaceRequested: parts[0]?.surfaceRequested || null,
        station: row.station,
        status: row.status,
        statusText: priority.statusText,
        risk: priority.risk,
        currentStationId: row.currentStationId || "",
        parts,
        intakeDate: toSafeIsoDate(row.intakeDate),
        dueDate,
        dueLabel: priority.dueLabel,
        dueValue: priority.dueValue,
        createdAt: toSafeIsoDate(row.createdAt) || undefined,
      } satisfies OperationalOrder;
    });
  });
}
