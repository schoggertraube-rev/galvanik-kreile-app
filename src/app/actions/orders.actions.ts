"use server";

import { db } from "@/db";
import { orders, customers, events } from "@/db/schema";
import { eq, or, and, sql, notInArray, notIlike, ilike } from "drizzle-orm";
import { ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization } from "@/lib/server/authorization";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { orderSchema, scanOrderRequestSchema, type OrderInput } from "@/lib/validation/orderSchema";
import {
  createOperationalOrderService,
  invalidateOperationalOrdersCache,
  type OperationalOrder,
  OperationalOrderPersistenceError,
} from "@/lib/server/operationalOrders";
import {
  canTransitionOrderStatus,
  getProcessTransitionConflict,
  isTerminalOrderStatus,
  normalizeStoredOrderStatus,
  orderUpdateSchema,
  parseOrderIdentifier,
  parseOrderStation,
  processTransitionSchema,
  requiredPermissionsForOrderUpdate,
  type OrderStation,
  type OrderStatus,
} from "@/lib/orders/orderMutationContract";
import type { PermissionKey } from "@/lib/auth/authorizationContract";

// DTO Typen (zur Vereinfachung)
export type OrderResponse = OperationalOrder;

type OrderWriteActor = { tenantId: string; userId: string };

async function requireOrderAccess(...permissions: PermissionKey[]): Promise<ActionResult<OrderWriteActor>> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) {
    return {
      ok: false,
      error: authorization.reason === "AUTHORIZATION_UNAVAILABLE"
        ? "DB_ERROR"
        : authorization.reason === "TENANT_SUSPENDED" || authorization.reason === "TENANT_MAINTENANCE"
          ? "FORBIDDEN"
          : "UNAUTHORIZED",
      message: authorization.message,
    };
  }
  if (permissions.some((permission) => !authorization.data.permissions.includes(permission))) {
    return { ok: false, error: "FORBIDDEN", message: "Keine Berechtigung für diese Auftragsaktion." };
  }
  return {
    ok: true,
    data: { tenantId: authorization.data.tenantId, userId: authorization.data.userId },
  };
}

async function persistValidatedOrder(
  input: OrderInput,
  actor: OrderWriteActor,
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const persisted = await createOperationalOrderService(input, actor);
    invalidateOperationalOrdersCache();
    try {
      revalidatePath("/");
      revalidatePath("/orders");
      revalidatePath("/customers");
      revalidatePath("/warendurchlauf");
      revalidatePath("/warendurchlauf/wareneingang");
    } catch {
      // Revalidation is unavailable in isolated service tests.
    }

    return {
      ok: true,
      data: {
        id: persisted.order.id,
        orderNumber: persisted.order.orderNumber,
        customerId: persisted.order.customerId,
        title: persisted.order.title,
        task: persisted.order.task || undefined,
        station: persisted.order.currentStationId || "wareneingang",
        currentStationId: persisted.order.currentStationId || "wareneingang",
        status: persisted.order.status,
        risk: persisted.order.priorityComputed || "unknown",
        source: persisted.order.source || undefined,
        dueDate: persisted.order.dueDate?.toISOString(),
        isQuote: persisted.order.isQuote === true,
        replayed: persisted.replayed,
        parts: persisted.items.map((part) => ({
          id: part.id,
          orderId: part.orderId,
          name: part.name,
          quantity: part.quantity,
          currentStationId: part.currentStationId || "wareneingang",
          ...(part.material ? { material: part.material } : {}),
          ...(part.surfaceRequested ? { surfaceRequested: part.surfaceRequested } : {}),
        })),
      },
    };
  } catch (error) {
    if (error instanceof OperationalOrderPersistenceError) {
      return {
        ok: false,
        error:
          error.code === "CUSTOMER_NOT_FOUND"
            ? "EMPTY_RESULT"
            : error.code === "REQUEST_CONFLICT" || error.code === "SCAN_SOURCE_CONFLICT"
              ? "CONFLICT"
              : "UNKNOWN",
        message: error.message,
      };
    }
    console.error("Failed to create order in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Erstellen des Auftrags" };
  }
}

export async function getOrdersDb(): Promise<ActionResult<OrderResponse[]>> {
  noStore();
  const actor = await requireOrderAccess("perm_view_leitstand");
  if (!actor.ok) return actor;

  try {
    const { getOperationalOrders } = await import("@/lib/server/operationalOrders");
    const data = await getOperationalOrders(actor.data.tenantId);
    return { ok: true, data: data as OrderResponse[] };
  } catch (error: unknown) {
    console.error("[DB_ERROR_DETAIL]", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Aufträge", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

/** Leichtgewichtige Variante nur für Header-Badge — führt nur COUNT(*) aus. */
export async function getOrderCountDb(): Promise<ActionResult<{ count: number }>> {
  noStore();
  const actor = await requireOrderAccess("perm_view_leitstand");
  if (!actor.ok) return actor;

  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, actor.data.tenantId),
          notInArray(
            sql`coalesce(${orders.source}, 'manual')`,
            ["seed", "test", "demo", "integration-test"]
          ),
          notIlike(sql`coalesce(${orders.orderNumber}, '')`, "A-SEED-%"),
          notIlike(sql`coalesce(${orders.orderNumber}, '')`, "%TEST%")
        )
      );
    return { ok: true, data: { count: result[0]?.count ?? 0 } };
  } catch (error: unknown) {
    console.error("[ORDER_COUNT_ERROR]", error instanceof Error ? error.message : String(error));
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Zählen der Aufträge", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function createOrderDb(data: unknown): Promise<ActionResult<Record<string, unknown>>> {
  const actor = await requireOrderAccess("perm_data_orders");
  if (!actor.ok) return actor;

  const parsed = orderSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: "UNKNOWN",
      message: "Ungültige Auftragsdaten.",
      details: parsed.error.flatten().fieldErrors,
    };
  }

  return persistValidatedOrder(parsed.data, actor.data);
}

export async function updateOrderDb(identifierValue: unknown, changesValue: unknown): Promise<ActionResult<Record<string, unknown>>> {
  let identifier: string;
  try {
    identifier = parseOrderIdentifier(identifierValue);
  } catch {
    return { ok: false, error: "UNKNOWN", message: "Ungültige Auftragskennung." };
  }
  const parsedChanges = orderUpdateSchema.safeParse(changesValue);
  if (!parsedChanges.success) {
    return {
      ok: false,
      error: "UNKNOWN",
      message: "Ungültige oder nicht unterstützte Auftragsänderung.",
      details: parsedChanges.error.flatten().fieldErrors,
    };
  }
  const actor = await requireOrderAccess(...requiredPermissionsForOrderUpdate(parsedChanges.data));
  if (!actor.ok) return actor;

  try {
    const updated = await db.transaction(async (tx) => {
      const current = (await tx
        .select()
        .from(orders)
        .where(and(
          eq(orders.tenantId, actor.data.tenantId),
          or(eq(orders.id, identifier), eq(orders.orderNumber, identifier)),
        ))
        .limit(1)
        .for("update"))[0];
      if (!current) return null;

      const updateSet: Partial<typeof orders.$inferInsert> = {};
      if (parsedChanges.data.risk !== undefined) updateSet.priorityComputed = parsedChanges.data.risk;
      if (parsedChanges.data.title !== undefined) updateSet.title = parsedChanges.data.title;
      if (parsedChanges.data.task !== undefined) updateSet.task = parsedChanges.data.task;
      if ("dueDate" in parsedChanges.data) {
        updateSet.dueDate = parsedChanges.data.dueDate;
        updateSet.promisedDueDate = parsedChanges.data.dueDate;
      }

      const persisted = (await tx
        .update(orders)
        .set(updateSet)
        .where(and(eq(orders.id, current.id), eq(orders.tenantId, actor.data.tenantId)))
        .returning())[0];
      if (!persisted) throw new Error("ORDER_UPDATE_NOT_CONFIRMED");

      await tx.insert(events).values({
        id: crypto.randomUUID(),
        tenantId: actor.data.tenantId,
        orderId: current.id,
        eventType: "ORDER_UPDATED",
        description: "Auftragsdaten bestätigt aktualisiert",
        station: persisted.currentStationId || persisted.station,
        payload: { changedFields: Object.keys(parsedChanges.data).sort() },
        userId: actor.data.userId,
      });

      return persisted;
    });

    if (!updated) return { ok: false, error: "EMPTY_RESULT", message: "Auftrag nicht gefunden." };
    invalidateOperationalOrdersCache();
    try {
      revalidatePath("/");
      revalidatePath("/orders");
      revalidatePath("/warendurchlauf");
    } catch {
      // unavailable in isolated tests
    }
    return {
      ok: true,
      data: {
        id: updated.id,
        orderNumber: updated.orderNumber,
        status: updated.status,
        currentStationId: updated.currentStationId || updated.station,
        risk: updated.priorityComputed,
        title: updated.title,
        task: updated.task,
        dueDate: (updated.promisedDueDate || updated.dueDate)?.toISOString() || null,
        completedDate: updated.completedDate?.toISOString() || null,
      },
    };
  } catch (error) {
    console.error("Failed to update order in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Aktualisieren des Auftrags" };
  }
}

export async function getRiskOrders(limit = 3) {
  const authorization = await resolveAuthorization();
  if (!authorization.ok || !authorization.data.permissions.includes("perm_view_leitstand")) return [];
  const safeLimit = Number.isInteger(limit) ? Math.min(20, Math.max(1, limit)) : 3;
  try {
    const riskOrders = await db.select({
      id: orders.orderNumber,
      kunde: customers.name,
      tage: sql<number>`-greatest(0, floor(extract(epoch from (now() - ${orders.dueDate})) / 86400))::int`
    })
    .from(orders)
    .innerJoin(customers, and(eq(orders.customerId, customers.id), eq(customers.tenantId, authorization.data.tenantId)))
    .where(and(
      eq(orders.tenantId, authorization.data.tenantId),
      eq(orders.status, 'in_progress'),
      sql`${orders.dueDate} IS NOT NULL AND ${orders.dueDate} < now()`
    ))
    .orderBy(orders.dueDate)
    .limit(safeLimit);

    return riskOrders;
  } catch (error) {
    console.error("Failed to get risk orders:", error);
    return [];
  }
}

export async function transitionOrderProcess(params: unknown) {
  const actor = await requireOrderAccess("perm_op_status");
  if (!actor.ok) return actor;
  const parsed = processTransitionSchema.safeParse(params);
  if (!parsed.success) {
    return { ok: false, error: "UNKNOWN" as const, message: "Ungültiger Prozesswechsel.", details: parsed.error.flatten().fieldErrors };
  }

  try {
    const transitioned = await db.transaction(async (tx) => {
      const current = (await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, parsed.data.orderId), eq(orders.tenantId, actor.data.tenantId)))
        .limit(1)
        .for("update"))[0];
      if (!current) return null;

      const [existingReceipt] = await tx
        .select({
          orderId: events.orderId,
          eventType: events.eventType,
          payload: events.payload,
        })
        .from(events)
        .where(and(
          eq(events.tenantId, actor.data.tenantId),
          eq(events.clientEventId, parsed.data.clientRequestId),
        ))
        .limit(1);
      if (existingReceipt) {
        const payload = existingReceipt.payload;
        const expectedAction = parsed.data.action;
        const expectedEventType = expectedAction === "cancel"
          ? "ORDER_CANCELLED"
          : "STATION_STARTED";
        if (
          !payload
          || existingReceipt.orderId !== current.id
          || existingReceipt.eventType !== expectedEventType
          || payload.processAction !== expectedAction
          || payload.expectedStation !== parsed.data.expectedStation
          || typeof payload.newStation !== "string"
          || typeof payload.newStatus !== "string"
        ) {
          throw new Error("REQUEST_CONFLICT");
        }
        const replayStatus = normalizeStoredOrderStatus(payload.newStatus);
        if (replayStatus === "unknown") throw new Error("REQUEST_CONFLICT");
        return {
          newStation: parseOrderStation(payload.newStation),
          newStatus: replayStatus,
          replayed: true,
        };
      }

      const currentStatus = normalizeStoredOrderStatus(current.status);
      if (currentStatus === "unknown" || isTerminalOrderStatus(currentStatus)) {
        throw new Error("ORDER_PROCESS_LOCKED");
      }
      let storedStation: OrderStation;
      try {
        storedStation = parseOrderStation(current.currentStationId || current.station);
      } catch {
        throw new Error("UNKNOWN_ORDER_STATION");
      }
      const stateConflict = getProcessTransitionConflict(currentStatus, storedStation, parsed.data);
      if (stateConflict) throw new Error(stateConflict);

      const newStation = storedStation;
      let newStatus: OrderStatus = currentStatus;
      let eventType: "STATION_STARTED" | "ORDER_CANCELLED" = "STATION_STARTED";
      let description = `Bearbeitung in ${newStation} gestartet`;

      if (parsed.data.action === "start") {
        newStatus = "in_progress";
      } else if (parsed.data.action === "cancel") {
        newStatus = "cancelled";
        eventType = "ORDER_CANCELLED";
        description = "Auftrag storniert";
      }

      if (!canTransitionOrderStatus(currentStatus, newStatus)) throw new Error("INVALID_ORDER_STATUS_TRANSITION");
      const updateSet: Partial<typeof orders.$inferInsert> = {
        currentStationId: newStation,
        station: newStation,
        status: newStatus,
      };
      const persisted = (await tx
        .update(orders)
        .set(updateSet)
        .where(and(eq(orders.id, current.id), eq(orders.tenantId, actor.data.tenantId)))
        .returning())[0];
      if (!persisted) throw new Error("ORDER_TRANSITION_NOT_CONFIRMED");

      await tx.insert(events).values({
        id: crypto.randomUUID(),
        tenantId: actor.data.tenantId,
        clientEventId: parsed.data.clientRequestId,
        orderId: current.id,
        eventType,
        station: newStation,
        description,
        userId: actor.data.userId,
        payload: {
          processAction: parsed.data.action,
          expectedStation: parsed.data.expectedStation,
          newStation,
          newStatus,
        },
      });

      return { newStation, newStatus, replayed: false };
    });

    if (!transitioned) return { ok: false, error: "EMPTY_RESULT" as const, message: "Auftrag nicht gefunden." };
    invalidateOperationalOrdersCache();
    try {
      revalidatePath("/");
      revalidatePath("/orders");
      revalidatePath("/warendurchlauf");
    } catch {
      // unavailable in isolated tests
    }

    return { ok: true, data: { success: true, ...transitioned } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if ([
      "ORDER_PROCESS_LOCKED",
      "UNKNOWN_ORDER_STATION",
      "INVALID_ORDER_STATUS_TRANSITION",
      "ORDER_NOT_READY",
      "STALE_ORDER_STATION",
      "REQUEST_CONFLICT",
    ].includes(message)) {
      return { ok: false, error: "FORBIDDEN" as const, message: "Dieser Prozesswechsel ist aus dem aktuellen Auftragszustand nicht zulässig." };
    }
    console.error("Failed transition:", error);
    return { ok: false, error: "DB_ERROR" as const, message: "Fehler beim Prozesswechsel" };
  }
}

export async function createOrderFromScan(params: unknown): Promise<
  | { ok: true; data: { orderId: string; status: "persisted" } }
  | { ok: false; error: string; message: string; details?: unknown }
> {
  const actor = await requireOrderAccess("perm_data_orders");
  if (!actor.ok) return actor;

  const parsedRequest = scanOrderRequestSchema.safeParse(params);
  if (!parsedRequest.success) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "Ungültige oder unvollständige Scan-Auftragsdaten.",
      details: parsedRequest.error.flatten().fieldErrors,
    };
  }

  try {
    let finalCustomerId = parsedRequest.data.customerId;

    if (!finalCustomerId && parsedRequest.data.customerName) {
      const escapedName = parsedRequest.data.customerName.replace(/[\\%_]/g, "\\$&");
      const matches = await db
        .select({ id: customers.id, name: customers.name, companyName: customers.companyName })
        .from(customers)
        .where(and(
          eq(customers.tenantId, actor.data.tenantId),
          ilike(customers.name, `%${escapedName}%`),
          notInArray(sql`coalesce(${customers.source}, 'manual')`, ["seed", "test", "demo", "integration-test"]),
        ))
        .limit(11);

      if (matches.length === 1) {
        finalCustomerId = matches[0].id;
      } else if (matches.length > 1) {
        return {
          ok: false,
          error: "CUSTOMER_AMBIGUOUS",
          message: "Mehrere Kunden mit diesem Namen gefunden.",
          details: matches.slice(0, 10),
        };
      } else {
        return {
          ok: false,
          error: "CUSTOMER_NOT_FOUND",
          message: "Kunde wurde nicht gefunden. Bitte zuerst vollständige Kundendaten im Kundenmodul erfassen.",
          details: { customerName: parsedRequest.data.customerName },
        };
      }
    }

    if (!finalCustomerId) {
      return {
        ok: false,
        error: "CUSTOMER_REQUIRED",
        message: "Ein gespeicherter Kunde ist für den Auftrag erforderlich.",
      };
    }

    const parsedOrder = orderSchema.safeParse({
      clientRequestId: parsedRequest.data.clientRequestId,
      customerId: finalCustomerId,
      title: parsedRequest.data.title,
      source: "scan",
      sourceRef: parsedRequest.data.sourceRef,
      parts: parsedRequest.data.parts.map((part) => ({
        ...part,
        routeTemplateId: parsedRequest.data.routeTemplateId,
      })),
    });
    if (!parsedOrder.success) {
      return {
        ok: false,
        error: "INVALID_INPUT",
        message: "Scan-Daten konnten nicht in einen gültigen Auftrag überführt werden.",
        details: parsedOrder.error.flatten().fieldErrors,
      };
    }

    const orderResult = await persistValidatedOrder(parsedOrder.data, actor.data);
    if (!orderResult.ok) {
      return {
        ok: false,
        error: orderResult.error,
        message: orderResult.message,
        details: orderResult.details
      };
    }

    return {
      ok: true,
      data: {
        orderId: String(orderResult.data.id),
        status: "persisted",
      },
    };
  } catch (error: unknown) {
    console.error("createOrderFromScan error:", error);
    return {
      ok: false,
      error: "SERVER_ERROR",
      message: "Interner Serverfehler beim Erstellen des Auftrags",
    };
  }
}
