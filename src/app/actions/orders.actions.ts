"use server";

import { db, isDatabaseConfigured } from "@/db";
import { orders, items, customers, events } from "@/db/schema";
import { eq, like, desc, and, sql, notInArray, notIlike, ilike, lt, isNull } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { checkAppAuth, checkAppPermission, ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization } from "@/lib/server/authorization";
import { unstable_noStore as noStore } from "next/cache";
import { getNextOperationalProcessStation, isCanonicalClientEventId, normalizeOperationalProcessStation, normalizeOperationalProcessStatus, requiresQualityApprovalForCompletion, type OperationalProcessStation, type OperationalProcessStatus } from "@/lib/orders/processContract";
import { isFoundationAreaEnabled } from "@/lib/server/foundationGate";

// DTO Typen (zur Vereinfachung)
export type OrderResponse = Record<string, unknown>;

type ProcessReceiptPayload = {
  action: "start" | "complete";
  toStation: OperationalProcessStation;
  statusAfter: OperationalProcessStatus;
};

function readProcessReceiptPayload(payload: unknown): ProcessReceiptPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Record<string, unknown>;
  if (candidate.action !== "start" && candidate.action !== "complete") return null;

  const toStation = normalizeOperationalProcessStation(
    typeof candidate.toStation === "string" ? candidate.toStation : null,
  );
  const statusAfter = normalizeOperationalProcessStatus(
    typeof candidate.statusAfter === "string" ? candidate.statusAfter : null,
  );
  if (!toStation || !statusAfter) return null;

  return { action: candidate.action, toStation, statusAfter };
}

export async function getOrdersDb(): Promise<ActionResult<OrderResponse[]>> {
  noStore();
  const authorization = await checkAppPermission("perm_data_orders");
  if (!authorization.ok) return authorization;

  try {
    const { getOperationalOrders } = await import("@/lib/server/operationalOrders");
    const data = await getOperationalOrders(authorization.data.tenantId);
    return { ok: true, data: data as OrderResponse[] };
  } catch (error: unknown) {
    console.error("[DB_ERROR_DETAIL]", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Aufträge", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

/** Leichtgewichtige Variante nur für Header-Badge — führt nur COUNT(*) aus. */
export async function getOrderCountDb(): Promise<ActionResult<{ count: number }>> {
  noStore();
  const authorization = await checkAppPermission("perm_data_orders");
  if (!authorization.ok) return authorization;

  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, authorization.data.tenantId),
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

export async function createOrderDb(data: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {
  const authorization = await checkAppPermission("perm_data_orders");
  if (!authorization.ok) return authorization;
  const { tenantId, userId } = authorization.data;

  if (!isDatabaseConfigured()) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  const { orderSchema } = await import("@/lib/validation/orderSchema");
  const parsed = orderSchema.safeParse(data);
  
  if (!parsed.success) {
    const formattedErrors = parsed.error.flatten().fieldErrors;
    return { ok: false, error: "UNKNOWN", message: "Validierungsfehler", details: formattedErrors };
  }
  
  const validData = parsed.data;
  if (!validData.customerId) {
    return { ok: false, error: "UNKNOWN", message: "Ein Kunde ist für einen Auftrag erforderlich." };
  }
  const customerId: string = validData.customerId;

  // A regular order always enters through intake. Exceptional imports or
  // rerouting require a separate audited server process and cannot be
  // requested by a browser payload.
  const canonicalStation: OperationalProcessStation = "wareneingang";
  
  try {
    const orderId = (typeof data.id === 'string' ? data.id : undefined) || createId();
    const year = new Date().getFullYear();
    const pattern = `A-${year}-%`;

    const newOrder = await db.transaction(async (tx) => {
      const [customer] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
        .limit(1);
      if (!customer) {
        throw new Error("CUSTOMER_NOT_AVAILABLE");
      }

      const existingOrders = await tx
        .select({ orderNumber: orders.orderNumber })
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), like(orders.orderNumber, pattern)))
        .orderBy(desc(orders.orderNumber))
        .limit(50);

      let maxSequenceNum = 0;
      for (const o of existingOrders) {
        if (o.orderNumber) {
          const parts = o.orderNumber.split("-");
          if (parts.length === 3) {
            const num = parseInt(parts[2], 10);
            if (!isNaN(num) && num > maxSequenceNum) {
              maxSequenceNum = num;
            }
          }
        }
      }
      const sequenceNum = maxSequenceNum > 0 ? maxSequenceNum + 1 : 1;
      const sequenceString = sequenceNum.toString().padStart(4, "0");
      const orderNumber = `A-${year}-${sequenceString}`;
      
      const newOrderVal = {
        id: orderId,
        tenantId,
        orderNumber,
        customerId,
        title: validData.title || "Unbenannt",
        station: canonicalStation,
        currentStationId: canonicalStation,
        status: "ready",
        priorityComputed: null,
        dueDate: validData.dueDate || null,
        source: validData.source,
      };
      
      await tx.insert(orders).values(newOrderVal);
      
      if (validData.parts && validData.parts.length > 0) {
        const newItems = validData.parts.map(p => ({
          id: p.id || createId(),
          tenantId,
          orderId,
          customerId,
          name: p.name,
          quantity: typeof p.quantity === "number" ? p.quantity : parseInt(p.quantity as string) || 1,
          currentStationId: canonicalStation
        }));
        await tx.insert(items).values(newItems);
      }
      
      await tx.insert(events).values({
        id: createId(),
        tenantId,
        orderId,
        eventType: "ORDER_CREATED",
        description: "Auftrag erstellt",
        station: canonicalStation,
        userId,
      });

      return newOrderVal;
    });

    const { invalidateOperationalOrdersCache } = await import("@/lib/server/operationalOrders");
    invalidateOperationalOrdersCache();

    try { 
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/"); 
      revalidatePath("/orders");
      revalidatePath("/customers");
      revalidatePath("/warendurchlauf");
      revalidatePath("/warendurchlauf/wareneingang");
    } catch { /* ignore when not in Next runtime */ }
    
    return {
      ok: true,
      data: {
        ...newOrder,
        station: newOrder.currentStationId,
        risk: newOrder.priorityComputed,
        parts: validData.parts
      }
    };
  } catch (error) {
    console.error("Failed to create order in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Erstellen des Auftrags", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function updateOrderDb(id: string, changes: {
  status?: string;
  currentStationId?: string;
  priorityComputed?: string;
  title?: string;
  task?: string;
  customerId?: string;
  rawIntakeDate?: string;
  rawDueDate?: string;
}): Promise<ActionResult<Record<string, unknown>>> {
  const authorization = await checkAppPermission("perm_data_orders");
  if (!authorization.ok) return authorization;
  const { tenantId, userId } = authorization.data;

  if (!isDatabaseConfigured()) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  if (changes.status !== undefined || changes.currentStationId !== undefined || changes.priorityComputed !== undefined) {
    return {
      ok: false,
      error: "NOT_CONFIGURED",
      message: "Status, Station und Dringlichkeit werden nur über den kanonischen Prozesswechsel aktualisiert.",
    };
  }

  const parseDate = (value: string | undefined, fieldLabel: string) => {
    if (value === undefined) return { ok: true as const, value: undefined };
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return { ok: false as const, message: `${fieldLabel} ist kein gültiges Datum.` };
    }
    return { ok: true as const, value: date };
  };

  const intakeDate = parseDate(changes.rawIntakeDate, "Eingangsdatum");
  if (!intakeDate.ok) return { ok: false, error: "UNKNOWN", message: intakeDate.message };
  const dueDate = parseDate(changes.rawDueDate, "Liefertermin");
  if (!dueDate.ok) return { ok: false, error: "UNKNOWN", message: dueDate.message };

  try {
    const [currentOrder] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)))
      .limit(1);
    if (!currentOrder) {
      return { ok: false, error: "UNKNOWN", message: "Auftrag nicht verfügbar." };
    }

    if (changes.customerId !== undefined) {
      const [customer] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, changes.customerId), eq(customers.tenantId, tenantId)))
        .limit(1);
      if (!customer) {
        return { ok: false, error: "UNKNOWN", message: "Der ausgewählte Kunde ist nicht verfügbar." };
      }
    }

    const updateData: {
      title?: string;
      task?: string;
      customerId?: string;
      intakeDate?: Date;
      dueDate?: Date;
    } = {};
    if (changes.title !== undefined) updateData.title = changes.title;
    if (changes.task !== undefined) updateData.task = changes.task;
    if (changes.customerId !== undefined) updateData.customerId = changes.customerId;
    if (intakeDate.value !== undefined) updateData.intakeDate = intakeDate.value;
    if (dueDate.value !== undefined) updateData.dueDate = dueDate.value;
    if (Object.keys(updateData).length === 0) {
      return { ok: false, error: "UNKNOWN", message: "Keine änderbaren Auftragsdaten übergeben." };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set(updateData)
        .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)));

      if (changes.customerId !== undefined) {
        await tx
          .update(items)
          .set({ customerId: changes.customerId })
          .where(and(eq(items.orderId, id), eq(items.tenantId, tenantId)));
      }

      await tx.insert(events).values({
        id: createId(),
        tenantId,
        orderId: id,
        eventType: "ORDER_UPDATED",
        description: "Auftragsstammdaten aktualisiert",
        station: currentOrder.currentStationId || currentOrder.station,
        userId,
      });
    });

    const { invalidateOperationalOrdersCache } = await import("@/lib/server/operationalOrders");
    invalidateOperationalOrdersCache();
    
    return { ok: true, data: { id, ...updateData } };
  } catch (error) {
    console.error("Failed to update order in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Aktualisieren des Auftrags", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export type RiskOrder = {
  id: string;
  kunde: string;
  tage: number;
};

export async function getRiskOrders(limit = 3): Promise<ActionResult<RiskOrder[]>> {
  if (!isFoundationAreaEnabled("Risikoauswertung")) {
    return {
      ok: false,
      error: "NOT_CONFIGURED",
      message: "Risikoauswertungen bleiben bis zum belegten Performance- und Evidenzvertrag gesperrt.",
    };
  }

  const auth = await checkAppAuth();
  if (!auth.ok) return auth;
  const authorization = await resolveAuthorization();
  if (!authorization.ok) {
    return {
      ok: false,
      error: authorization.reason === "AUTHORIZATION_UNAVAILABLE" ? "DB_ERROR" : "UNAUTHORIZED",
      message: authorization.message,
    };
  }
  if (!isDatabaseConfigured()) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  try {
    const tenantId = authorization.data.tenantId;
    const now = new Date();
    const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 50);
    const riskOrders = await db.select({
      id: orders.orderNumber,
      kunde: customers.name,
      dueDate: orders.dueDate,
    })
    .from(orders)
    .leftJoin(customers, and(eq(orders.customerId, customers.id), eq(customers.tenantId, tenantId)))
    .where(and(
      eq(orders.tenantId, tenantId),
      eq(orders.status, "in_progress"),
      lt(orders.dueDate, now),
      notInArray(sql`coalesce(${orders.source}, 'manual')`, ["seed", "test", "demo", "integration-test"]),
    ))
    .orderBy(orders.dueDate)
    .limit(safeLimit);

    return {
      ok: true,
      data: riskOrders.map((o) => ({
        id: o.id,
        kunde: o.kunde || "Kunde nicht hinterlegt",
        tage: Math.floor((new Date(o.dueDate as Date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      })),
    };
  } catch (error) {
    console.error("Failed to get risk orders:", error);
    return { ok: false, error: "DB_ERROR", message: "Überfällige Aufträge konnten nicht geladen werden." };
  }
}

export async function setOrderStationDb(orderId: string, newStation: string): Promise<ActionResult<{ success: boolean }>> {
  void orderId;
  void newStation;
  return {
    ok: false,
    error: "NOT_CONFIGURED",
    message: "Direkte Stationssprünge sind nicht freigegeben. Verwende den kanonischen Prozessschritt.",
  };
}

export async function transitionOrderProcess(params: {
  orderId: string;
  expectedStation: string;
  expectedStatus: string;
  clientEventId: string;
  targetStep?: string;
  action: "start" | "complete";
}): Promise<ActionResult<{ success: boolean; newStation: string; newStatus: string | null; receiptId: string; idempotent: boolean }>> {
  if (!isFoundationAreaEnabled("Auftragsprozess")) {
    return {
      ok: false,
      error: "NOT_CONFIGURED",
      message: "Prozesswechsel bleiben bis zur geprüften W1-Receipt-Migration und dem Retry-Nachweis gesperrt.",
    };
  }

  const { orderId, expectedStation, expectedStatus, clientEventId, targetStep, action } = params;
  const authorization = await checkAppPermission("perm_op_status");
  if (!authorization.ok) return authorization;
  const tenantId = authorization.data.tenantId;
  const userId = authorization.data.userId;
  if (!isDatabaseConfigured()) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  if (targetStep !== undefined) {
    return {
      ok: false,
      error: "NOT_CONFIGURED",
      message: "Zielstationen werden serverseitig aus dem Prozessvertrag bestimmt.",
    };
  }

  if (!isCanonicalClientEventId(clientEventId)) {
    return {
      ok: false,
      error: "NOT_CONFIGURED",
      message: "Der Prozessbefehl benötigt eine stabile Ereignis-ID für den Wiederholungsnachweis.",
    };
  }

  const normalizedExpectedStation = normalizeOperationalProcessStation(expectedStation);
  const normalizedExpectedStatus = normalizeOperationalProcessStatus(expectedStatus);
  if (!normalizedExpectedStation || !normalizedExpectedStatus) {
    return {
      ok: false,
      error: "NOT_CONFIGURED",
      message: "Der erwartete Prozesszustand ist ungültig oder unvollständig.",
    };
  }

  if (action !== "start" && action !== "complete") {
    return {
      ok: false,
      error: "NOT_CONFIGURED",
      message: "Nur Starten oder Abschließen eines aktuellen Prozessschritts ist freigegeben.",
    };
  }
  
  try {
    const [existingReceipt] = await db
      .select({
        id: events.id,
        orderId: events.orderId,
        eventType: events.eventType,
        payload: events.payload,
      })
      .from(events)
      .where(and(eq(events.tenantId, tenantId), eq(events.clientEventId, clientEventId)))
      .limit(1);

    if (existingReceipt) {
      const receipt = readProcessReceiptPayload(existingReceipt.payload);
      const expectedEventType = action === "start" ? "STATION_STARTED" : "STATION_COMPLETED";
      if (
        existingReceipt.orderId !== orderId ||
        existingReceipt.eventType !== expectedEventType ||
        !receipt ||
        receipt.action !== action
      ) {
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Diese Ereignis-ID gehört nicht zu diesem Prozessbefehl.",
        };
      }

      return {
        ok: true,
        data: {
          success: true,
          newStation: receipt.toStation,
          newStatus: receipt.statusAfter,
          receiptId: existingReceipt.id,
          idempotent: true,
        },
      };
    }

    const currentOrder = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
      .limit(1);
    if (currentOrder.length === 0) return { ok: false, error: "UNKNOWN", message: "Auftrag nicht gefunden" };
    const o = currentOrder[0];
    const persistedStationCondition = o.currentStationId === null
      ? isNull(orders.currentStationId)
      : eq(orders.currentStationId, o.currentStationId);
    
    const currentStation = normalizeOperationalProcessStation(o.currentStationId || o.station);
    if (!currentStation) {
      return { ok: false, error: "UNKNOWN", message: "Auftrag hat keinen gültigen Prozessstatus." };
    }

    const storedStation = normalizeOperationalProcessStation(o.station);
    if (!storedStation || storedStation !== currentStation) {
      return { ok: false, error: "UNKNOWN", message: "Die gespeicherten Stationsfelder widersprechen sich. Der Prozesswechsel wurde nicht ausgeführt." };
    }

    const currentStatus = normalizeOperationalProcessStatus(o.status);
    if (!currentStatus) {
      return { ok: false, error: "UNKNOWN", message: "Auftrag hat keinen freigegebenen Prozessstatus." };
    }

    if (normalizedExpectedStation !== currentStation || normalizedExpectedStatus !== currentStatus) {
      return { ok: false, error: "UNKNOWN", message: "Der Auftrag wurde zwischenzeitlich verändert. Bitte neu laden." };
    }

    let newStation = currentStation;
    let newStatus: OperationalProcessStatus = currentStatus;
    let eventType = "STATION_STARTED";
    let description = "Prozessschritt gestartet";
    
    if (action === "start") {
      if (currentStatus !== "ready") {
        return { ok: false, error: "FORBIDDEN", message: "Nur ein bereiter Prozessschritt kann gestartet werden." };
      }
      newStatus = "in_progress";
      description = `Bearbeitung gestartet in ${newStation}`;
    } else {
      if (currentStatus !== "in_progress") {
        return { ok: false, error: "FORBIDDEN", message: "Nur ein gestarteter Prozessschritt kann abgeschlossen werden." };
      }
      if (o.status !== "in_progress") {
        return { ok: false, error: "FORBIDDEN", message: "Nur ein gestarteter Prozessschritt kann abgeschlossen werden." };
      }
      if (requiresQualityApprovalForCompletion(currentStation) && !authorization.data.permissions.includes("perm_op_qa")) {
        return { ok: false, error: "FORBIDDEN", message: "Für den Abschluss der Qualitätsprüfung fehlt die Berechtigung." };
      }
      const nextStation = getNextOperationalProcessStation(currentStation);
      newStation = nextStation || currentStation;
      newStatus = nextStation ? "ready" : "completed";
      eventType = "STATION_COMPLETED";
      description = nextStation
        ? `Station abgeschlossen. Weitergeleitet an ${nextStation}`
        : "Auftrag im Prozess als abgeschlossen markiert.";
    }

    const transitionAt = new Date();
    const isFinalCompletion = action === "complete" && newStatus === "completed";
    const receiptId = createId();

    await db.transaction(async (tx) => {
      const [updatedOrder] = await tx.update(orders).set({
        station: newStation,
        currentStationId: newStation,
        status: newStatus,
        ...(isFinalCompletion ? { completedDate: transitionAt } : {}),
      }).where(and(
        eq(orders.id, orderId),
        eq(orders.tenantId, tenantId),
        persistedStationCondition,
        eq(orders.station, o.station),
        eq(orders.status, o.status),
      )).returning({ id: orders.id });

      if (!updatedOrder) {
        throw new Error("TRANSITION_CONFLICT");
      }
      
      await tx.update(items).set({
        currentStationId: newStation
      }).where(and(eq(items.orderId, orderId), eq(items.tenantId, tenantId)));
      
      await tx.insert(events).values({
        id: receiptId,
        tenantId,
        clientEventId,
        orderId,
        eventType,
        station: currentStation,
        description,
        payload: {
          action,
          fromStation: currentStation,
          toStation: newStation,
          statusBefore: currentStatus,
          statusAfter: newStatus,
          transitionAt: transitionAt.toISOString(),
        },
        userId,
        createdAt: transitionAt
      });
    });

    const { invalidateOperationalOrdersCache } = await import("@/lib/server/operationalOrders");
    invalidateOperationalOrdersCache();

    try { 
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/"); 
      revalidatePath("/orders");
      revalidatePath("/warendurchlauf");
    } catch { /* ignore */ }

    return { ok: true, data: { success: true, newStation, newStatus, receiptId, idempotent: false } };
  } catch (error) {
    console.error("Failed transition:", error);
    if (error instanceof Error && error.message === "TRANSITION_CONFLICT") {
      return { ok: false, error: "UNKNOWN", message: "Der Auftrag wurde zwischenzeitlich verändert. Bitte neu laden." };
    }
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Prozesswechsel" };
  }
}

/**
 * Scan capture has no durable, tenant-bound upload/OCR receipt yet. Keep the
 * public server-action surface fail-closed rather than synthesising an order
 * from browser text or a fallback title.
 */
export async function createOrderFromScan(_params: {
  customerId?: string;
  customerName?: string;
  title?: string;
  parts: { name: string; quantity: number; surfaceRequested?: string; material?: string }[];
  forceCreateCustomer?: boolean;
}): Promise<
  | { ok: true; data: { orderId: string; newCustomerId?: string; status: string; customerChoices?: Record<string, unknown>[] } }
  | { ok: false; error: string; message: string; details?: unknown }
> {
void _params;
  return {
    ok: false,
    error: "NOT_CONFIGURED",
    message: "Scan-Erfassung benötigt einen geprüften Upload-, OCR- und Receipt-Vertrag.",
  };
}

/** @deprecated Kept private only while the new capture contract is designed. */
async function createOrderFromScanLegacyUnsafe(params: {
  customerId?: string;
  customerName?: string;
  title?: string;
  parts: { name: string; quantity: number; surfaceRequested?: string; material?: string }[];
  forceCreateCustomer?: boolean;
}): Promise<
  | { ok: true; data: { orderId: string; newCustomerId?: string; status: string; customerChoices?: Record<string, unknown>[] } }
  | { ok: false; error: string; message: string; details?: unknown }
> {
  const authorization = await checkAppPermission("perm_data_orders");
  if (!authorization.ok) return { ok: false, error: authorization.error, message: authorization.message };
  const tenantId = authorization.data.tenantId;

  if (!isDatabaseConfigured()) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  try {
    let finalCustomerId = params.customerId;

    // 1. Wenn kein customerId übergeben wurde, suchen wir über den Namen
    if (!finalCustomerId && params.customerName && params.customerName.trim() !== "") {
      const searchPattern = `%${params.customerName.trim()}%`;
      const matches = await db.select().from(customers).where(
        and(
          eq(customers.tenantId, tenantId),
          ilike(customers.name, searchPattern),
          sql`coalesce(${customers.source}, '') not in ('seed', 'test', 'demo', 'integration-test')`
        )
      );

      if (matches.length === 1) {
        // Eindeutiger Treffer
        finalCustomerId = matches[0].id;
      } else if (matches.length > 1) {
        // Mehrdeutige Treffer
        return {
          ok: false,
          error: "CUSTOMER_AMBIGUOUS",
          message: "Mehrere Kunden mit diesem Namen gefunden",
          details: matches.map(c => ({ id: c.id, name: c.name, companyName: c.companyName }))
        };
      } else {
        // Kein Treffer
        if (params.forceCreateCustomer) {
          return {
            ok: false,
            error: "CUSTOMER_DETAILS_REQUIRED",
            message: "Für einen neuen Kunden müssen die echten Stammdaten erfasst werden. Es werden keine Platzhalterdaten angelegt.",
            details: { customerName: params.customerName },
          };
        } else {
          return {
            ok: false,
            error: "CUSTOMER_NOT_FOUND",
            message: "Kunde wurde in der Datenbank nicht gefunden. Möchten Sie diesen neu anlegen?",
            details: { customerName: params.customerName }
          };
        }
      }
    }

    if (!finalCustomerId) {
      return {
        ok: false,
        error: "CUSTOMER_REQUIRED",
        message: "Ein Kunde ist zwingend erforderlich, um einen Auftrag zu erstellen."
      };
    }

    // 2. Erstelle den Auftrag mit der Server Action createOrderDb
    const orderData = {
      customerId: finalCustomerId,
      title: params.title || `Auftrag per Scan - ${new Date().toLocaleDateString("de-DE")}`,
      source: "scan",
      parts: params.parts
    };

    const orderResult = await createOrderDb(orderData);
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
        newCustomerId: params.forceCreateCustomer ? finalCustomerId : undefined,
        status: "success"
      }
    };
  } catch (error: unknown) {
    console.error("createOrderFromScan error:", error);
    return {
      ok: false,
      error: "SERVER_ERROR",
      message: "Interner Serverfehler beim Erstellen des Auftrags",
      details: error instanceof Error ? error.message : "Unbekannter Fehler"
    };
  }
}
void createOrderFromScanLegacyUnsafe;
