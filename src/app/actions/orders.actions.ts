"use server";

import { db } from "@/db";
import { orders, items, customers, events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { checkAppAuth, ActionResult } from "@/lib/server/authHelper";

// DTO Typen (zur Vereinfachung)
export type OrderResponse = Record<string, unknown>;

export async function getOrdersDb(): Promise<ActionResult<OrderResponse[]>> {
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  try {
    const dbOrders = await db.select().from(orders).where(eq(orders.tenantId, "galvanik-kreile")).orderBy(orders.createdAt);
    const dbItems = await db.select().from(items).where(eq(items.tenantId, "galvanik-kreile")).orderBy(items.createdAt);
    const dbCustomers = await db.select().from(customers);
    
    const data = dbOrders.map(o => {
      const orderItems = dbItems.filter(item => item.orderId === o.id);
      const customer = dbCustomers.find(c => c.id === o.customerId);
      const customerName = customer ? customer.name : "Unbekannter Kunde";
      
      const intakeDate = o.intakeDate ? new Date(o.intakeDate).toISOString() : (o.createdAt ? new Date(o.createdAt).toISOString() : "2026-05-01T08:00:00.000Z");
      const dueDate = o.dueDate ? new Date(o.dueDate).toISOString() : new Date(new Date(intakeDate).getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
      const dueLabel = "Fällig in";
      const dueValue = "10 Tagen";
      
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerId: o.customerId || "",
        customerName,
        title: o.title,
        station: o.currentStationId || "wareneingang",
        status: o.status,
        risk: o.priorityComputed || "green",
        currentStationId: o.currentStationId || "wareneingang",
        parts: orderItems.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          surfaceRequested: ""
        })),
        intakeDate,
        dueDate,
        dueLabel,
        dueValue
      };
    });
    
    return { ok: true, data };
  } catch (error) {
    console.error("Failed to get orders from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Aufträge", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function createOrderDb(data: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  const { orderSchema } = await import("@/lib/validation/orderSchema");
  const parsed = orderSchema.safeParse(data);
  
  if (!parsed.success) {
    const formattedErrors = parsed.error.flatten().fieldErrors;
    return { ok: false, error: "UNKNOWN", message: "Validierungsfehler", details: formattedErrors };
  }
  
  const validData = parsed.data;
  
  try {
    const orderId = (typeof data.id === 'string' ? data.id : undefined) || createId();
    const year = new Date().getFullYear();
    // Generate sequence number based on timestamp since this is an older action
    const sequenceNumber = Math.floor(Date.now() % 10000).toString().padStart(4, '0');
    const orderNumber = `A-${year}-${sequenceNumber}`;
    
    const newOrder = {
      id: orderId,
      tenantId: "galvanik-kreile",
      orderNumber,
      customerId: validData.customerId || "",
      title: validData.title || "Unbenannt",
      currentStationId: validData.currentStationId || "wareneingang",
      status: "in_progress",
      priorityComputed: "green",
    };
    
    await db.insert(orders).values(newOrder);
    
    if (validData.parts && validData.parts.length > 0) {
      const newItems = validData.parts.map(p => ({
        id: p.id || createId(),
        tenantId: "galvanik-kreile",
        orderId,
        customerId: validData.customerId || "",
        name: p.name,
        quantity: typeof p.quantity === "number" ? p.quantity : parseInt(p.quantity as string) || 1,
        currentStationId: validData.currentStationId || "wareneingang"
      }));
      await db.insert(items).values(newItems);
    }
    
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
}): Promise<ActionResult<Record<string, unknown>>> {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  try {
    const updateData: Record<string, string> = {};
    if (changes.status !== undefined) updateData.status = changes.status;
    if (changes.currentStationId !== undefined) updateData.currentStationId = changes.currentStationId;
    if (changes.priorityComputed !== undefined) updateData.priorityComputed = changes.priorityComputed;
    if (changes.title !== undefined) updateData.title = changes.title;
    
    await db.update(orders).set(updateData).where(eq(orders.id, id));
    
    if (changes.currentStationId !== undefined) {
      await db.update(items).set({ currentStationId: changes.currentStationId }).where(eq(items.orderId, id));
    }

    if (changes.status === "abgeschlossen" || changes.status === "completed") {
      try {
        const orderRec = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
        if (orderRec.length > 0) {
          const o = orderRec[0];
          if (o.customerId) {
            const plannedDate = new Date();
            plannedDate.setDate(plannedDate.getDate() + 7); // Schedule for 7 days later
            const { feedbackMail } = await import("@/db/schema_marketing");
            // Check if one already exists
            const existing = await db.select().from(feedbackMail).where(eq(feedbackMail.auftragId, id)).limit(1);
            if (existing.length === 0) {
              await db.insert(feedbackMail).values({
                auftragId: id,
                kundeId: o.customerId,
                geplantFuer: plannedDate,
                status: "geplant",
                tokenFeedback: crypto.randomUUID()
              });
            }
          }
        }
      } catch (err) {
        console.error("Failed to schedule feedback mail:", err);
      }
    }
    
    return { ok: true, data: { id, ...changes } };
  } catch (error) {
    console.error("Failed to update order in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Aktualisieren des Auftrags", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function getRiskOrders(limit = 3) {
  try {
    const { sql, desc } = await import("drizzle-orm");
    const riskOrders = await db.select({
      id: orders.orderNumber,
      kunde: customers.name,
      tage: sql<number>`-2` // Mock risk days for now to keep the UI the same
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.status, 'in_progress'))
    .orderBy(desc(orders.createdAt))
    .limit(limit);

    return riskOrders.map((o, i) => ({
      id: o.id || `A-2026-00${89 + i}`,
      kunde: o.kunde || "Unbekannter Kunde",
      tage: -2 + i
    }));
  } catch (error) {
    console.error("Failed to get risk orders:", error);
    return [];
  }
}

export async function setOrderStationDb(orderId: string, newStation: string): Promise<ActionResult<{ success: boolean }>> {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  try {
    // removed unused createId import
    
    // fetch current order to get current station
    const currentOrder = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    const aktuelleStation = currentOrder[0]?.currentStationId || currentOrder[0]?.station || "wareneingang";
    // update order to new station
    await db.update(orders).set({ currentStationId: newStation }).where(eq(orders.id, orderId));
    
    // Insert exit event
    // events are imported statically
    await db.insert(events).values({
      id: crypto.randomUUID(),
      tenantId: "galvanik-kreile",
      orderId,
      eventType: "STATION_AUSGANG",
      station: aktuelleStation,
      description: `Station verlassen: ${aktuelleStation}`,
      createdAt: new Date()
    });
    
    // Insert entry event
    await db.insert(events).values({
      id: crypto.randomUUID(),
      tenantId: "galvanik-kreile",
      orderId,
      eventType: "STATION_EINGANG",
      station: newStation,
      description: `Station betreten: ${newStation}`,
      createdAt: new Date()
    });

    return { ok: true, data: { success: true } };
  } catch (error) {
    console.error("Failed to update station:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Setzen der Station", details: String(error) };
  }
}
