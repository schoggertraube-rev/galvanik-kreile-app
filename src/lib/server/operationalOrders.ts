import { db, isDatabaseConfigured } from "@/db";
import { orders, customers, items } from "@/db/schema";
import { eq, desc, and, notInArray, notIlike, sql, inArray } from "drizzle-orm";
import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

// Short-lived in-memory cache (5 seconds) — prevents parallel duplicate DB calls
// during a single page render without blocking real-time updates.
const _ordersCache = new Map<string, { data: Awaited<ReturnType<typeof _fetchAndMap>>; ts: number }>();
const CACHE_TTL_MS = 5_000;

export function invalidateOperationalOrdersCache() {
  _ordersCache.clear();
}

export async function getOperationalOrders(tenantId: string) {
  if (!tenantId) throw new Error("Tenant context is required for operational orders");
  const now = Date.now();
  const cached = _ordersCache.get(tenantId);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await _fetchAndMap(tenantId);
  _ordersCache.set(tenantId, { data, ts: now });
  return data;
}

function toIsoString(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function formatDueDate(dueDate: string | undefined): string {
  if (!dueDate) return "nicht hinterlegt";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dueDate));
}

async function _fetchAndMap(tenantId: string) {
  if (!isDatabaseConfigured()) throw new Error("Database not available");

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
      completedDate: orders.completedDate,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(
      customers,
      and(
        eq(customers.id, orders.customerId),
        eq(customers.tenantId, tenantId),
      ),
    )
    .where(
      and(
        eq(orders.tenantId, tenantId),
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
        .where(and(eq(items.tenantId, tenantId), inArray(items.orderId, orderIds)))
    : [];

  return results.map((o) => {
    const orderParts = allParts.filter((p) => p.orderId === o.id);
    const intakeDate = toIsoString(o.intakeDate);
    const dueDate = toIsoString(o.dueDate);
    const completedDate = toIsoString(o.completedDate);
    const risk = typeof o.risk === "string" && o.risk.trim() ? o.risk : "unknown";

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      customerId: o.customerId,
      customerName: o.customerName || null,
      title: o.title,
      task: o.task,
      itemDescription: o.task || (orderParts.length > 0 ? orderParts[0].name : null),
      surfaceRequested: orderParts[0]?.surfaceRequested ?? null,
      station: o.currentStationId || "unzugeordnet",
      status: o.status,
      risk,
      currentStationId: o.currentStationId || "unzugeordnet",
      parts: orderParts,
      intakeDate,
      dueDate,
      completedDate,
      dueLabel: dueDate ? "Fällig am" : "Termin",
      dueValue: formatDueDate(dueDate),
      createdAt: o.createdAt?.toISOString(),
    };
  });
}

export async function getOperationalOrdersByStation(tenantId: string, stationId: string) {
  const all = await getOperationalOrders(tenantId);
  return all.filter((o) => o.currentStationId === stationId);
}

export async function getOperationalOrdersReadyForStation(tenantId: string, stationId: string) {
  const all = await getOperationalOrders(tenantId);
  const canonicalStationId = stationId === "beschichtung" ? "galvanik" : stationId;
  // "Bereit" is an actual process state at the requested station. Never
  // infer readiness from a different station or from "not blocked".
  return all.filter((o) => o.currentStationId === canonicalStationId && o.status === "ready");
}

export async function getOperationalOrdersForCustomer(tenantId: string, customerId: string) {
  const all = await getOperationalOrders(tenantId);
  return all.filter((o) => o.customerId === customerId);
}

// ── Auth-Independent Services ───────────────────────────────────────────────

import { createId } from "@paralleldrive/cuid2";
import { events } from "@/db/schema";
import { like } from "drizzle-orm";

async function createOperationalOrderServiceLegacyUnsafe(data: Record<string, unknown>, actorId?: string) {
  if (!isFoundationAreaEnabled("Legacy-Auftragserfassung")) {
    return foundationUnavailableAction("Legacy-Auftragserfassung");
  }

  if (!isDatabaseConfigured()) throw new Error("Database not available");

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
        surfaceRequested: p.surfaceRequested ?? null,
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
void createOperationalOrderServiceLegacyUnsafe;

async function moveOperationalOrderToStationServiceLegacyUnsafe(orderId: string, stationId: string, actorId?: string) {
  if (!isFoundationAreaEnabled("Legacy-Statuswechsel")) {
    return foundationUnavailableAction("Legacy-Statuswechsel");
  }

  if (!isDatabaseConfigured()) throw new Error("Database not available");

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
void moveOperationalOrderToStationServiceLegacyUnsafe;

async function startProcessingStationServiceLegacyUnsafe(orderId: string, stationId: string, actorId?: string) {
  if (!isFoundationAreaEnabled("Legacy-Start der Stationsbearbeitung")) {
    return foundationUnavailableAction("Legacy-Start der Stationsbearbeitung");
  }

  if (!isDatabaseConfigured()) throw new Error("Database not available");

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
void startProcessingStationServiceLegacyUnsafe;
