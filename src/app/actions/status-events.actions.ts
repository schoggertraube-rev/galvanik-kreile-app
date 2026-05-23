"use server";

import { createId } from "@paralleldrive/cuid2";
import { db } from "@/db"; // wait, the db is in src/db/index.ts
import { statusEvents } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function createStatusEvent(data: {
  orderId: string;
  eventType: string;
  tenantId?: string;
  itemId?: string;
  workerId?: string;
  notes?: string;
}) {
  if (!db) {
    console.warn("DB not initialized, skipping createStatusEvent");
    return null;
  }
  
  try {
    const newEvent = {
      id: createId(),
      tenantId: data.tenantId || "hotel-kreile",
      orderId: data.orderId,
      eventType: data.eventType,
      itemId: data.itemId,
      workerId: data.workerId,
      notes: data.notes,
    };
    
    await db.insert(statusEvents).values(newEvent);
    return newEvent;
  } catch (error) {
    console.warn("Failed to create status event in DB:", error);
    return null; // Don't crash the UI!
  }
}

export async function getStatusEventsByOrderId(orderId: string) {
  if (!db) return [];
  try {
    return await db.query.statusEvents.findMany({
      where: eq(statusEvents.orderId, orderId),
      orderBy: [desc(statusEvents.timestamp)]
    });
  } catch (error) {
    console.warn("Failed to fetch status events:", error);
    return [];
  }
}

export async function getStatusEventsByItemId(itemId: string) {
  if (!db) return [];
  try {
    return await db.query.statusEvents.findMany({
      where: eq(statusEvents.itemId, itemId),
      orderBy: [desc(statusEvents.timestamp)]
    });
  } catch (error) {
    console.warn("Failed to fetch status events by item:", error);
    return [];
  }
}

export async function getRecentStatusEvents(limit = 10) {
  if (!db) return [];
  try {
    return await db.query.statusEvents.findMany({
      orderBy: [desc(statusEvents.timestamp)],
      limit
    });
  } catch (error) {
    console.warn("Failed to fetch recent events:", error);
    return [];
  }
}
