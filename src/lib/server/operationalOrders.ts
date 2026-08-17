import "server-only";

import { db } from "@/db";
import { orders, items } from "@/db/schema";
import { sql } from "drizzle-orm";
import type { OperationalOrder } from "@/lib/types/operationalOrder";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import {
  readTenantOperationalOrderCount,
  readTenantOperationalOrders,
} from "@/lib/server/orderStationRead";

export type { OperationalOrder, OperationalOrderItem } from "@/lib/types/operationalOrder";

export async function getOperationalOrders(
  authorization: AuthorizationSnapshot,
): Promise<OperationalOrder[]> {
  return readTenantOperationalOrders(authorization);
}

export async function getOperationalOrderCount(
  authorization: AuthorizationSnapshot,
): Promise<number> {
  return readTenantOperationalOrderCount(authorization);
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

export async function moveOperationalOrderToStationService(
  orderId: string,
  stationId: string,
  actorId?: string,
) {
  void orderId;
  void stationId;
  void actorId;
  throw new Error("NOT_AVAILABLE: Stationswechsel benötigt den W3-Command-Vertrag.");
}

export async function startProcessingStationService(orderId: string, stationId: string, actorId?: string) {
  void orderId;
  void stationId;
  void actorId;
  throw new Error("NOT_AVAILABLE: Stationsstart benötigt den W3-Command-Vertrag.");
}
