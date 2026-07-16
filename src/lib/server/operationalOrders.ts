import { db } from "@/db";
import { orders, customers, items, events, calendarEvents } from "@/db/schema";
import { eq, desc, and, notInArray, notIlike, sql, inArray, like } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { OrderInput } from "@/lib/validation/orderSchema";

// Short-lived in-memory cache (5 seconds) — prevents parallel duplicate DB calls
// during a single page render without blocking real-time updates.
let _ordersCache: { data: Awaited<ReturnType<typeof _fetchAndMap>>; ts: number } | null = null;
const CACHE_TTL_MS = 5_000;

export function invalidateOperationalOrdersCache() {
  _ordersCache = null;
}

export async function getOperationalOrders() {
  const now = Date.now();
  if (_ordersCache && now - _ordersCache.ts < CACHE_TTL_MS) {
    return _ordersCache.data;
  }
  const data = await _fetchAndMap();
  _ordersCache = { data, ts: now };
  return data;
}

async function _fetchAndMap() {
  if (!db) throw new Error("Database not available");

  const results = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerId: orders.customerId,
      customerName: customers.name,
      title: orders.title,
      task: orders.task,
      status: orders.status,
      statusText: orders.statusText,
      delayReason: orders.delayReason,
      recommendedAction: orders.recommendedAction,
      risk: orders.priorityComputed,
      station: orders.station,
      currentStationId: orders.currentStationId,
      intakeDate: orders.intakeDate,
      dueDate: orders.dueDate,
      promisedDueDate: orders.promisedDueDate,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(
      and(
        eq(orders.tenantId, "galvanik-kreile"),
        notInArray(
          sql`coalesce(${orders.source}, 'manual')`,
          ["seed", "test", "demo", "integration-test"]
        ),
        notIlike(sql`coalesce(${orders.orderNumber}, '')`, "A-SEED-%"),
        notIlike(sql`coalesce(${orders.orderNumber}, '')`, "%TEST%")
      )
    )
    .orderBy(desc(orders.createdAt));

  // Only load items for the fetched orders (avoids full-table scan)
  const orderIds = results.map((o) => o.id);
  const allParts = orderIds.length > 0
    ? await db
        .select()
        .from(items)
        .where(and(eq(items.tenantId, "galvanik-kreile"), inArray(items.orderId, orderIds)))
    : [];

  return results.map((o) => {
    const orderParts = allParts.filter((p) => p.orderId === o.id);
    const intakeDate = new Date(o.intakeDate || o.createdAt).toISOString();
    const dueDateValue = o.promisedDueDate || o.dueDate;
    const dueDate = dueDateValue ? new Date(dueDateValue).toISOString() : undefined;
    const station = o.currentStationId || o.station;

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      customerId: o.customerId,
      customerName: o.customerName || null,
      title: o.title,
      task: o.task || o.title,
      itemDescription: o.task || (orderParts.length > 0 ? orderParts[0].name : o.title),
      surfaceRequested: orderParts.length > 0 ? orderParts[0].surfaceRequested || null : null,
      station,
      status: o.status,
      statusText: o.statusText || undefined,
      delayReason: o.delayReason || undefined,
      recommendedAction: o.recommendedAction || undefined,
      risk: o.risk || "green",
      currentStationId: station,
      parts: orderParts,
      intakeDate,
      ...(dueDate ? {
        dueDate,
        rawDueDate: dueDate,
        dueLabel: "Fällig am",
        dueValue: new Date(dueDate).toLocaleDateString("de-DE"),
      } : {}),
      createdAt: o.createdAt?.toISOString(),
    };
  });
}

export async function getOperationalOrdersByStation(stationId: string) {
  const all = await getOperationalOrders();
  return all.filter((o) => o.currentStationId === stationId);
}

export async function getOperationalOrdersReadyForStation(stationId: string) {
  const all = await getOperationalOrders();
  // Galvanik expects orders that are still in wareneingang and not blocked
  if (stationId === "galvanik" || stationId === "beschichtung") {
    return all.filter((o) => o.currentStationId === "wareneingang" && o.status !== "blocked");
  }
  // Generic fallback if not galvanik
  return all.filter((o) => o.currentStationId === "wareneingang" && o.status !== "blocked");
}

export async function getOperationalOrdersForCustomer(customerId: string) {
  const all = await getOperationalOrders();
  return all.filter((o) => o.customerId === customerId);
}

// ── Authenticated services ─────────────────────────────────────────────────

export class OperationalOrderPersistenceError extends Error {
  constructor(
    readonly code: "CUSTOMER_NOT_FOUND" | "CUSTOMER_NOTE_LIMIT",
    message: string,
  ) {
    super(message);
    this.name = "OperationalOrderPersistenceError";
  }
}

export type OperationalOrderActor = {
  tenantId: string;
  userId: string;
};

export async function createOperationalOrderService(
  validData: OrderInput,
  actor: OperationalOrderActor,
) {
  if (!db) throw new Error("Database not available");

  const orderId = createId();
  const year = new Date().getFullYear();
  const prefix = validData.isQuote ? "KV" : "A";
  const pattern = `${prefix}-${year}-%`;
  const numberPattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const stationId = "wareneingang";

  return db.transaction(async (tx) => {
    const customer = (await tx
      .select({ id: customers.id, behaviorNotes: customers.behaviorNotes })
      .from(customers)
      .where(and(
        eq(customers.id, validData.customerId),
        eq(customers.tenantId, actor.tenantId),
        notInArray(sql`coalesce(${customers.source}, 'manual')`, ["seed", "test", "demo", "integration-test"]),
      ))
      .limit(1)
      .for("update"))[0];

    if (!customer) {
      throw new OperationalOrderPersistenceError(
        "CUSTOMER_NOT_FOUND",
        "Der ausgewählte Kunde wurde im aktuellen Mandanten nicht gefunden.",
      );
    }

    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${actor.tenantId}), ${year})`);

    const existingOrders = await tx
      .select({ orderNumber: orders.orderNumber })
      .from(orders)
      .where(and(eq(orders.tenantId, actor.tenantId), like(orders.orderNumber, pattern)));

    let maxSequence = 0;
    for (const existing of existingOrders) {
      const match = numberPattern.exec(existing.orderNumber);
      if (!match) continue;
      const sequence = Number(match[1]);
      if (Number.isSafeInteger(sequence) && sequence > maxSequence) maxSequence = sequence;
    }

    const orderNumber = `${prefix}-${year}-${String(maxSequence + 1).padStart(4, "0")}`;
    const newOrderVal: typeof orders.$inferInsert = {
      id: orderId,
      tenantId: actor.tenantId,
      orderNumber,
      customerId: validData.customerId,
      title: validData.title,
      task: validData.task,
      station: stationId,
      currentStationId: stationId,
      status: "in_progress",
      risk: "green",
      priority: "normal",
      priorityComputed: "green",
      dueDate: validData.dueDate,
      promisedDueDate: validData.dueDate,
      source: validData.source,
      sourceRef: validData.sourceRef,
      freetextOriginal: validData.freetextOriginal,
      isQuote: validData.isQuote,
      quoteStatus: validData.isQuote ? "offen" : null,
    };

    const insertedOrder = (await tx.insert(orders).values(newOrderVal).returning())[0];
    if (!insertedOrder) throw new Error("ORDER_INSERT_NOT_CONFIRMED");

    const itemValues: (typeof items.$inferInsert)[] = validData.parts.map((part) => ({
      id: createId(),
      tenantId: actor.tenantId,
      orderId,
      customerId: validData.customerId,
      name: part.name,
      quantity: part.quantity,
      currentStationId: stationId,
      material: part.material,
      surfaceRequested: part.surfaceRequested,
      photoIds: [],
      stationSequence: [],
    }));
    const insertedItems = await tx.insert(items).values(itemValues).returning();
    if (insertedItems.length !== itemValues.length) throw new Error("ORDER_ITEMS_NOT_CONFIRMED");

    if (validData.calendarSync && validData.dueDate) {
      await tx.insert(calendarEvents).values({
        id: createId(),
        tenantId: actor.tenantId,
        orderId,
        customerId: validData.customerId,
        title: `Abgabe/Lieferung: ${validData.title}`,
        eventType: "delivery",
        startsAt: validData.dueDate,
        timeSlot: validData.timeWindow || "ganztaegig",
        status: "planned",
        source: validData.source,
        sourceRef: validData.sourceRef,
      });
    }

    if (validData.customerBehaviorNote) {
      const existingNote = customer.behaviorNotes?.trim();
      const nextNote = existingNote
        ? `${existingNote}\n${validData.customerBehaviorNote}`
        : validData.customerBehaviorNote;
      if (nextNote.length > 10_000) {
        throw new OperationalOrderPersistenceError(
          "CUSTOMER_NOTE_LIMIT",
          "Die Verhaltensnotiz würde das sichere Größenlimit des Kundenprofils überschreiten.",
        );
      }
      await tx
        .update(customers)
        .set({ behaviorNotes: nextNote, updatedAt: new Date() })
        .where(and(eq(customers.id, customer.id), eq(customers.tenantId, actor.tenantId)));
    }

    await tx.insert(events).values({
      id: createId(),
      tenantId: actor.tenantId,
      orderId,
      eventType: validData.isQuote ? "QUOTE_CREATED" : "ORDER_CREATED",
      description: validData.isQuote ? "Kostenvoranschlag erstellt" : "Auftrag erstellt",
      station: stationId,
      userId: actor.userId,
    });

    if (validData.customerBehaviorNote) {
      await tx.insert(events).values({
        id: createId(),
        tenantId: actor.tenantId,
        orderId,
        eventType: "CUSTOMER_BEHAVIOR_NOTE_ADDED",
        description: "Verhaltensnotiz im Kundenprofil ergänzt",
        station: stationId,
        userId: actor.userId,
      });
    }

    return { order: insertedOrder, items: insertedItems };
  });
}

export async function moveOperationalOrderToStationService(orderId: string, stationId: string, actorId?: string) {
  if (!db) throw new Error("Database not available");

  // Canonical station fix
  const targetStation = stationId === "beschichtung" ? "galvanik" : stationId;

  return await db.transaction(async (tx) => {
    const currentOrder = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!currentOrder || currentOrder.length === 0) throw new Error("Order not found");
    const prevStation = currentOrder[0].currentStationId;

    await tx.update(orders).set({ currentStationId: targetStation, status: "ready" }).where(eq(orders.id, orderId));
    await tx.update(items).set({ currentStationId: targetStation }).where(eq(items.orderId, orderId));

    const eventId = createId();
    await tx.insert(events).values({
      id: eventId,
      tenantId: "galvanik-kreile",
      orderId,
      eventType: "STATION_CHANGED",
      description: `Verschoben von ${prevStation} nach ${targetStation}`,
      station: targetStation,
      userId: actorId,
    });
    
    return { success: true, eventId, prevStation, targetStation };
  });
}

export async function startProcessingStationService(orderId: string, stationId: string, actorId?: string) {
  if (!db) throw new Error("Database not available");

  const targetStation = stationId === "beschichtung" ? "galvanik" : stationId;

  return await db.transaction(async (tx) => {
    const currentOrder = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!currentOrder || currentOrder.length === 0) throw new Error("Order not found");

    await tx.update(orders).set({ currentStationId: targetStation, status: "in_progress" }).where(eq(orders.id, orderId));
    await tx.update(items).set({ currentStationId: targetStation }).where(eq(items.orderId, orderId));

    const eventId = createId();
    await tx.insert(events).values({
      id: eventId,
      tenantId: "galvanik-kreile",
      orderId,
      eventType: "PROCESSING_STARTED",
      description: `Bearbeitung gestartet in ${targetStation}`,
      station: targetStation,
      userId: actorId,
    });
    
    return { success: true, eventId, targetStation };
  });
}
