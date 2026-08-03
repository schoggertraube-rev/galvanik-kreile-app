import { db } from "@/db";
import { orders, customers, items } from "@/db/schema";
import { eq, desc, and, notInArray, notIlike, sql, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type OperationalOrderItem = InferSelectModel<typeof items>;

export type OperationalOrder = {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string | null;
  title: string;
  task: string | null;
  itemDescription: string | null;
  surfaceRequested: string | null;
  station: string;
  status: string;
  risk: string;
  currentStationId: string;
  parts: OperationalOrderItem[];
  intakeDate: string;
  dueDate: string;
  dueLabel: string;
  dueValue: string;
  createdAt: string | undefined;
};

// Short-lived in-memory cache (5 seconds) — prevents parallel duplicate DB calls
// during a single page render without blocking real-time updates.
let _ordersCache: { data: OperationalOrder[]; ts: number } | null = null;
const CACHE_TTL_MS = 5_000;

export function invalidateOperationalOrdersCache() {
  _ordersCache = null;
}

export async function getOperationalOrders(): Promise<OperationalOrder[]> {
  const now = Date.now();
  if (_ordersCache && now - _ordersCache.ts < CACHE_TTL_MS) {
    return _ordersCache.data;
  }
  const data = await _fetchAndMap();
  _ordersCache = { data, ts: now };
  return data;
}

async function _fetchAndMap(): Promise<OperationalOrder[]> {
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
      risk: orders.priorityComputed,
      currentStationId: orders.currentStationId,
      intakeDate: orders.intakeDate,
      dueDate: orders.dueDate,
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
    const intakeDate = o.intakeDate ? new Date(o.intakeDate).toISOString() : (o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString());
    const dueDate = o.dueDate ? new Date(o.dueDate).toISOString() : new Date(new Date(intakeDate).getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      customerId: o.customerId,
      customerName: o.customerName || null,
      title: o.title,
      task: o.task,
      itemDescription: o.task || (orderParts.length > 0 ? orderParts[0].name : null),
      surfaceRequested: orderParts.length > 0 ? orderParts[0].surfaceRequested || null : null,
      station: o.currentStationId || "wareneingang",
      status: o.status,
      risk: o.risk || "green",
      currentStationId: o.currentStationId || "wareneingang",
      parts: orderParts,
      intakeDate,
      dueDate,
      dueLabel: "Fällig in",
      dueValue: "10 Tagen",
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

// ── Auth-Independent Services ───────────────────────────────────────────────

import { createId } from "@paralleldrive/cuid2";
import { events } from "@/db/schema";
import { like } from "drizzle-orm";

export async function createOperationalOrderService(data: Record<string, unknown>, actorId?: string) {
  if (!db) throw new Error("Database not available");

  const { orderSchema } = await import("@/lib/validation/orderSchema");
  const parsed = orderSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Validation Error: " + JSON.stringify(parsed.error.flatten().fieldErrors));
  }

  const validData = parsed.data;
  const orderId = (typeof data.id === "string" ? data.id : undefined) || createId();
  const year = new Date().getFullYear();
  const pattern = `A-${year}-%`;

  return await db.transaction(async (tx) => {
    // Advisory lock to prevent race conditions during parallel order creation
    await tx.execute(sql`SELECT pg_advisory_xact_lock(2026001)`);

    const existingOrders = await tx
      .select({ orderNumber: orders.orderNumber })
      .from(orders)
      .where(like(orders.orderNumber, pattern));

    const regex = new RegExp(`^A-\\d{4}-(\\d+)$`);
    let maxSeq = 10000;

    for (const o of existingOrders) {
      if (!o.orderNumber) continue;
      const match = regex.exec(o.orderNumber);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }

    const nextSeq = maxSeq + 1;
    const orderNumber = `A-${year}-${nextSeq}`;

    if (!regex.test(orderNumber)) {
      throw new Error(`Ungültiges Auftragsnummer-Format generiert: ${orderNumber}`);
    }

    // Canonical station check
    const stationId = validData.currentStationId === "beschichtung" ? "galvanik" : (validData.currentStationId || "wareneingang");

    const newOrderVal = {
      id: orderId,
      tenantId: "galvanik-kreile",
      orderNumber,
      customerId: validData.customerId as string,
      title: validData.title || "Unbenannt",
      currentStationId: stationId,
      status: "in_progress",
      priorityComputed: "green",
      source: validData.source,
    };

    await tx.insert(orders).values(newOrderVal);

    if (validData.parts && validData.parts.length > 0) {
      const newItems = validData.parts.map((p) => ({
        id: p.id || createId(),
        tenantId: "galvanik-kreile",
        orderId,
        customerId: validData.customerId || "",
        name: p.name,
        quantity: typeof p.quantity === "number" ? p.quantity : parseInt(p.quantity as string) || 1,
        currentStationId: stationId,
        surfaceRequested: p.surfaceRequested || null,
      }));
      await tx.insert(items).values(newItems);
    }

    await tx.insert(events).values({
      id: createId(),
      tenantId: "galvanik-kreile",
      orderId,
      eventType: "ORDER_CREATED",
      description: "Auftrag erstellt",
      station: stationId,
      userId: actorId,
    });

    return orderId;
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
