"use server";

import { createId } from "@paralleldrive/cuid2";
import { db } from "@/db"; 
import { statusEvents } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { checkAppAuth, ActionResult } from "@/lib/server/authHelper";

export async function createStatusEvent(data: {
  orderId: string;
  eventType: string;
  tenantId?: string;
  itemId?: string;
  workerId?: string;
  notes?: string;
  payload?: Record<string, unknown>;
  status?: string;
}): Promise<ActionResult<Record<string, unknown>>> {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return auth;

  if (!db) {
    console.warn("DB not initialized, skipping createStatusEvent");
    return { ok: false, error: "DB_ERROR", message: "Database not available" };
  }
  
  try {
    const newEvent = {
      id: createId(),
      tenantId: data.tenantId || "galvanik-kreile",
      orderId: data.orderId,
      eventType: data.eventType,
      itemId: data.itemId,
      workerId: data.workerId,
      notes: data.notes,
      payload: data.payload,
      status: data.status,
    };
    
    await db.insert(statusEvents).values(newEvent);
    return { ok: true, data: newEvent };
  } catch (error) {
    console.warn("Failed to create status event in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Speichern des Events", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function getStatusEventsByOrderId(orderId: string): Promise<ActionResult<Record<string, unknown>[]>> {
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  try {
    const data = await db.query.statusEvents.findMany({
      where: eq(statusEvents.orderId, orderId),
      orderBy: [desc(statusEvents.createdAt)]
    });
    return { ok: true, data };
  } catch (error) {
    console.warn("Failed to fetch status events:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Events", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function getStatusEventsByItemId(itemId: string): Promise<ActionResult<Record<string, unknown>[]>> {
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  try {
    const data = await db.query.statusEvents.findMany({
      where: eq(statusEvents.itemId, itemId),
      orderBy: [desc(statusEvents.createdAt)]
    });
    return { ok: true, data };
  } catch (error) {
    console.warn("Failed to fetch status events by item:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Events", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function getRecentStatusEvents(limit = 10): Promise<ActionResult<Record<string, unknown>[]>> {
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  try {
    const data = await db.query.statusEvents.findMany({
      orderBy: [desc(statusEvents.createdAt)],
      limit
    });
    return { ok: true, data };
  } catch (error) {
    console.warn("Failed to fetch recent events:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Events", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}
