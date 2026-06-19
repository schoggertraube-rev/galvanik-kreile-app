"use server";

import { db } from "@/db";
import { orders, items, customers, events } from "@/db/schema";
import { eq, like, desc, and, sql, notInArray, notIlike } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { checkAppAuth, ActionResult } from "@/lib/server/authHelper";
import { unstable_noStore as noStore } from "next/cache";

// DTO Typen (zur Vereinfachung)
export type OrderResponse = Record<string, unknown>;

export async function getOrdersDb(): Promise<ActionResult<OrderResponse[]>> {
  noStore();
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  try {
    const { getOperationalOrders } = await import("@/lib/server/operationalOrders");
    const data = await getOperationalOrders();
    return { ok: true, data: data as any };
  } catch (error: any) {
    console.error("[DB_ERROR_DETAIL]", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Aufträge", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

/** Leichtgewichtige Variante nur für Header-Badge — führt nur COUNT(*) aus. */
export async function getOrderCountDb(): Promise<ActionResult<{ count: number }>> {
  noStore();
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
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
      );
    return { ok: true, data: { count: result[0]?.count ?? 0 } };
  } catch (error: any) {
    console.error("[ORDER_COUNT_ERROR]", error?.message, error?.details);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Zählen der Aufträge", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
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
    const pattern = `A-${year}-%`;

    const newOrder = await db.transaction(async (tx) => {
      const existingOrders = await tx
        .select({ orderNumber: orders.orderNumber })
        .from(orders)
        .where(like(orders.orderNumber, pattern))
        .orderBy(desc(orders.orderNumber))
        .limit(1);

      let sequenceNum = 1;
      if (existingOrders.length > 0 && existingOrders[0].orderNumber) {
        const parts = existingOrders[0].orderNumber.split("-");
        if (parts.length === 3) {
          sequenceNum = parseInt(parts[2], 10) + 1;
        }
      }
      const sequenceString = sequenceNum.toString().padStart(4, "0");
      const orderNumber = `A-${year}-${sequenceString}`;
      
      const newOrderVal = {
        id: orderId,
        tenantId: "galvanik-kreile",
        orderNumber,
        customerId: validData.customerId || "",
        title: validData.title || "Unbenannt",
        currentStationId: validData.currentStationId || "wareneingang",
        status: "in_progress",
        priorityComputed: "green",
      };
      
      await tx.insert(orders).values(newOrderVal);
      
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
        await tx.insert(items).values(newItems);
      }
      
      await tx.insert(events).values({
        id: createId(),
        tenantId: "galvanik-kreile",
        orderId,
        eventType: "ORDER_CREATED",
        description: "Auftrag erstellt",
        station: "wareneingang",
      });

      return newOrderVal;
    });

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

export async function transitionOrderProcess(params: {
  orderId: string;
  targetStep?: string;
  action?: string;
}) {
  const { orderId, targetStep, action } = params;
  const auth = await checkAppAuth("write");
  if (!auth.ok) return auth;
  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const currentOrder = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (currentOrder.length === 0) return { ok: false, error: "NOT_FOUND", message: "Auftrag nicht gefunden" };
    const o = currentOrder[0];
    
    let newStation = o.currentStationId || "wareneingang";
    let newStatus = o.status;
    let eventType = "STATION_STARTED";
    let description = "Prozessschritt gestartet";
    
    if (action === "start") {
      newStatus = "in_progress";
      description = `Bearbeitung gestartet in ${newStation}`;
    } else if (action === "complete") {
      const orderProcessChain = ["wareneingang", "entmetallisierung", "schleiferei", "galvanik", "qualitaetssicherung", "warenausgang"];
      const currIdx = orderProcessChain.indexOf(newStation);
      if (currIdx >= 0 && currIdx < orderProcessChain.length - 1) {
        newStation = orderProcessChain[currIdx + 1];
        if (newStation === "qualitaetssicherung") {
          newStatus = "QS/Fertigprüfung";
        } else if (newStation === "warenausgang") {
          newStatus = "Bereit für Versand";
        } else {
          newStatus = "ready";
        }
        eventType = "STATION_COMPLETED";
        description = `Station abgeschlossen. Weitergeleitet an ${newStation}`;
      } else if (currIdx === orderProcessChain.length - 1) {
        newStatus = "abgeschlossen";
        eventType = "STATION_COMPLETED";
        description = `Auftrag abgeschlossen und versendet.`;
      }
    } else if (targetStep) {
      newStation = targetStep;
      if (newStation === "qualitaetssicherung") newStatus = "QS/Fertigprüfung";
      else if (newStation === "warenausgang") newStatus = "Bereit für Versand";
      else newStatus = "ready";
      description = `Manuell zu Station ${newStation} gewechselt`;
    }

    await db.transaction(async (tx) => {
      await tx.update(orders).set({
        currentStationId: newStation,
        status: newStatus
      }).where(eq(orders.id, orderId));
      
      await tx.update(items).set({
        currentStationId: newStation
      }).where(eq(items.orderId, orderId));
      
      await tx.insert(events).values({
        id: crypto.randomUUID(),
        tenantId: "galvanik-kreile",
        orderId,
        eventType,
        station: newStation,
        description,
        createdAt: new Date()
      });
    });

    try { 
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/"); 
      revalidatePath("/orders");
      revalidatePath("/warendurchlauf");
    } catch { /* ignore */ }

    return { ok: true, data: { success: true, newStation, newStatus } };
  } catch (error) {
    console.error("Failed transition:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Prozesswechsel" };
  }
}

