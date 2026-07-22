import { createHash } from "node:crypto";
import { db } from "@/db";
import { orders, customers, items, events, calendarEvents, scanUploads } from "@/db/schema";
import { eq, desc, and, notInArray, notIlike, sql, inArray, like, isNull } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { OrderInput } from "@/lib/validation/orderSchema";
import { isOrderReadyForStation } from "@/lib/orders/orderRouting";
import { createRouteSnapshot } from "@/lib/orders/routeSnapshot";
import { isConfirmedCaptureReceipt } from "@/lib/server/scanOriginalContract";

// Short-lived in-memory cache (5 seconds) — prevents parallel duplicate DB calls
// during a single page render without blocking real-time updates.
const ordersCache = new Map<string, { data: Awaited<ReturnType<typeof _fetchAndMap>>; ts: number }>();
const CACHE_TTL_MS = 5_000;

export type OperationalOrder = Awaited<ReturnType<typeof _fetchAndMap>>[number];

export function invalidateOperationalOrdersCache(tenantId?: string) {
  if (tenantId) ordersCache.delete(tenantId);
  else ordersCache.clear();
}

export async function getOperationalOrders(tenantId: string) {
  const now = Date.now();
  const cached = ordersCache.get(tenantId);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await _fetchAndMap(tenantId);
  ordersCache.set(tenantId, { data, ts: now });
  return data;
}

async function _fetchAndMap(tenantId: string) {
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
      completedDate: orders.completedDate,
      source: orders.source,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(customers, and(eq(customers.id, orders.customerId), eq(customers.tenantId, tenantId)))
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
    const intakeDate = new Date(o.intakeDate || o.createdAt).toISOString();
    const dueDate = o.dueDate ? new Date(o.dueDate).toISOString() : undefined;
    const promisedDueDate = o.promisedDueDate ? new Date(o.promisedDueDate).toISOString() : undefined;
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
      risk: o.risk || "unknown",
      currentStationId: station,
      source: o.source || undefined,
      parts: orderParts,
      intakeDate,
      completedDate: o.completedDate?.toISOString(),
      promisedDueDate,
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

export async function getOperationalOrdersByStation(stationId: string, tenantId: string) {
  const all = await getOperationalOrders(tenantId);
  return all.filter((o) => o.currentStationId === stationId);
}

export async function getOperationalOrdersReadyForStation(stationId: string, tenantId: string) {
  const all = await getOperationalOrders(tenantId);
  // Galvanik admission requires an explicitly ready predecessor state.
  if (stationId === "galvanik" || stationId === "beschichtung") {
    return all.filter((order) => isOrderReadyForStation(order, "galvanik"));
  }
  throw new Error("UNSUPPORTED_READY_STATION");
}

export async function getOperationalOrdersForCustomer(customerId: string, tenantId: string) {
  const all = await getOperationalOrders(tenantId);
  return all.filter((o) => o.customerId === customerId);
}

// ── Authenticated services ─────────────────────────────────────────────────

export class OperationalOrderPersistenceError extends Error {
  constructor(
    readonly code: "CUSTOMER_NOT_FOUND" | "CUSTOMER_NOTE_LIMIT" | "REQUEST_CONFLICT" | "SCAN_SOURCE_CONFLICT",
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

function orderCreationHash(value: OrderInput): string {
  return createHash("sha256").update(JSON.stringify({
    contract: "kreile-order-create/v1",
    clientRequestId: value.clientRequestId,
    customerId: value.customerId,
    title: value.title,
    task: value.task ?? null,
    source: value.source,
    sourceRef: value.sourceRef ?? null,
    dueDate: value.dueDate?.toISOString() ?? null,
    isQuote: value.isQuote,
    calendarSync: value.calendarSync,
    timeWindow: value.timeWindow ?? null,
    freetextOriginal: value.freetextOriginal ?? null,
    customerBehaviorNote: value.customerBehaviorNote ?? null,
    parts: value.parts.map((part) => ({
      name: part.name,
      quantity: part.quantity,
      material: part.material ?? null,
      surfaceRequested: part.surfaceRequested ?? null,
      routeTemplateId: part.routeTemplateId ?? null,
    })),
  })).digest("hex");
}

async function findOrderCreationReplay(tenantId: string, clientRequestId: string, requestHash: string) {
  const [receipt] = await db.select({
    orderId: events.orderId,
    eventType: events.eventType,
    payload: events.payload,
  }).from(events).where(and(
    eq(events.tenantId, tenantId),
    eq(events.clientEventId, clientRequestId),
  )).limit(1);
  if (!receipt) return null;

  const payload = receipt.payload;
  if (
    (receipt.eventType !== "ORDER_CREATED" && receipt.eventType !== "QUOTE_CREATED")
    || payload?.orderCreationContract !== "kreile-order-create/v1"
    || payload?.orderCreationHash !== requestHash
  ) {
    throw new OperationalOrderPersistenceError(
      "REQUEST_CONFLICT",
      "Diese Anforderungs-ID wurde bereits mit anderen Auftragsdaten verwendet.",
    );
  }

  const [order] = await db.select().from(orders).where(and(
    eq(orders.id, receipt.orderId),
    eq(orders.tenantId, tenantId),
  )).limit(1);
  if (!order) throw new Error("ORDER_RECEIPT_WITHOUT_ORDER");
  if (order.source === "scan") {
    const [scan] = await db.select({
      id: scanUploads.id,
      tenantId: scanUploads.tenantId,
      fileUrl: scanUploads.fileUrl,
      fileType: scanUploads.fileType,
      uploadedBy: scanUploads.uploadedBy,
      linkedOrderId: scanUploads.linkedOrderId,
      linkedCustomerId: scanUploads.linkedCustomerId,
      recordKind: scanUploads.recordKind,
      contentSha256: scanUploads.contentSha256,
      fileSizeBytes: scanUploads.fileSizeBytes,
      status: scanUploads.status,
    }).from(scanUploads).where(and(
      eq(scanUploads.id, order.sourceRef || ""),
      eq(scanUploads.tenantId, tenantId),
    )).limit(1);
    if (
      !scan
      || !isConfirmedCaptureReceipt(scan, tenantId)
      || scan.linkedOrderId !== order.id
      || scan.linkedCustomerId !== order.customerId
      || scan.recordKind !== "capture_scan"
      || !["secured", "processed"].includes(scan.status)
    ) throw new Error("ORDER_RECEIPT_WITHOUT_SCAN_LINK");
  }
  const persistedItems = await db.select().from(items).where(and(
    eq(items.orderId, order.id),
    eq(items.tenantId, tenantId),
  ));
  return { order, items: persistedItems, replayed: true as const };
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "23505");
}

export async function createOperationalOrderService(
  validData: OrderInput,
  actor: OperationalOrderActor,
) {
  if (!db) throw new Error("Database not available");

  const requestHash = orderCreationHash(validData);
  const replay = await findOrderCreationReplay(actor.tenantId, validData.clientRequestId, requestHash);
  if (replay) return replay;

  const orderId = createId();
  const year = new Date().getFullYear();
  const prefix = validData.isQuote ? "KV" : "A";
  const pattern = `${prefix}-${year}-%`;
  const numberPattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const stationId = "wareneingang";

  try {
    return await db.transaction(async (tx) => {
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

    let scanReceipt: {
      id: string;
      uploadedBy: string;
      contentSha256: string;
      fileSizeBytes: number;
    } | null = null;
    if (validData.source === "scan") {
      const [scan] = await tx.select().from(scanUploads).where(and(
        eq(scanUploads.id, validData.sourceRef || ""),
        eq(scanUploads.tenantId, actor.tenantId),
      )).limit(1).for("update");
      if (
        !scan
        || !isConfirmedCaptureReceipt(scan, actor.tenantId)
        || !["secured", "processed"].includes(scan.status)
        || scan.linkedOrderId
        || (scan.linkedCustomerId && scan.linkedCustomerId !== validData.customerId)
      ) {
        throw new OperationalOrderPersistenceError(
          "SCAN_SOURCE_CONFLICT",
          "Der Scan-Originalbeleg fehlt, ist nicht gesichert oder bereits anders zugeordnet.",
        );
      }
      scanReceipt = {
        id: scan.id,
        uploadedBy: scan.uploadedBy,
        contentSha256: scan.contentSha256,
        fileSizeBytes: scan.fileSizeBytes,
      };
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
      risk: "unknown",
      priority: "unassigned",
      priorityComputed: null,
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
      stationSequence: part.routeTemplateId ? createRouteSnapshot(part.routeTemplateId) : [],
      currentStep: 0,
    }));
    const insertedItems = await tx.insert(items).values(itemValues).returning();
    if (insertedItems.length !== itemValues.length) throw new Error("ORDER_ITEMS_NOT_CONFIRMED");

    if (scanReceipt) {
      const [linked] = await tx.update(scanUploads).set({
        linkedOrderId: orderId,
        linkedCustomerId: validData.customerId,
      }).where(and(
        eq(scanUploads.id, scanReceipt.id),
        eq(scanUploads.tenantId, actor.tenantId),
        eq(scanUploads.recordKind, "capture_scan"),
        inArray(scanUploads.status, ["secured", "processed"]),
        isNull(scanUploads.linkedOrderId),
      )).returning({ id: scanUploads.id });
      if (!linked) throw new Error("SCAN_LINK_RECEIPT_MISSING");
    }

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
      clientEventId: validData.clientRequestId,
      orderId,
      eventType: validData.isQuote ? "QUOTE_CREATED" : "ORDER_CREATED",
      description: validData.isQuote ? "Kostenvoranschlag erstellt" : "Auftrag erstellt",
      station: stationId,
      payload: {
        orderCreationContract: "kreile-order-create/v1",
        orderCreationHash: requestHash,
        routeTemplates: validData.parts.map((part) => part.routeTemplateId ?? null),
        ...(scanReceipt ? {
          scanOriginalReceipt: {
            scanId: scanReceipt.id,
            contentSha256: scanReceipt.contentSha256,
            fileSizeBytes: scanReceipt.fileSizeBytes,
            uploadedBy: scanReceipt.uploadedBy,
            assignedBy: actor.userId,
          },
        } : {}),
      },
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

      return { order: insertedOrder, items: insertedItems, replayed: false as const };
    });
  } catch (error) {
    if (
      isUniqueViolation(error)
      || (error instanceof OperationalOrderPersistenceError && error.code === "SCAN_SOURCE_CONFLICT")
    ) {
      const concurrentReplay = await findOrderCreationReplay(actor.tenantId, validData.clientRequestId, requestHash);
      if (concurrentReplay) return concurrentReplay;
    }
    throw error;
  }
}
