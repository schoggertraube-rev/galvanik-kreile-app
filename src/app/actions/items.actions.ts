"use server";

import { db } from "@/db";
import { items, customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

export async function getItems() {
  if (!db) return [];
  try {
    const dbItems = await db.select().from(items).orderBy(items.createdAt);
    return dbItems;
  } catch (error) {
    console.error("Failed to get items from DB:", error);
    return [];
  }
}

export async function getItemsByOrder(orderId: string) {
  if (!db) return [];
  try {
    const dbItems = await db.select().from(items).where(eq(items.orderId, orderId)).orderBy(items.createdAt);
    return dbItems;
  } catch (error) {
    console.error("Failed to get items for order from DB:", error);
    return [];
  }
}

export async function createItem(data: {
  id?: string;
  orderId: string;
  name: string;
  quantity: number | string;
  currentStationId?: string;
  material?: string;
  surfaceRequested?: string;
  photoIds?: string[];
  photo?: string;
}) {
  if (!db) return null;
  try {
    const itemId = data.id || createId();
    
    // Fetch customerId from order
    const { orders } = await import("@/db/schema");
    const orderData = await db.select({ customerId: orders.customerId }).from(orders).where(eq(orders.id, data.orderId)).limit(1);
    const customerId = orderData.length > 0 ? orderData[0].customerId : "default_customer_id";
    
    const newItem = {
      id: itemId,
      tenantId: "galvanik-kreile",
      orderId: data.orderId,
      customerId,
      name: data.name,
      quantity: typeof data.quantity === "number" ? data.quantity : parseInt(data.quantity) || 1,
      currentStationId: data.currentStationId || "wareneingang",
      material: data.material || null,
      surfaceRequested: data.surfaceRequested || null,
      photoIds: data.photoIds || [],
      photo: data.photo || null
    };
    
    await db.insert(items).values(newItem);
    
    return newItem;
  } catch (error) {
    console.error("Failed to create item in DB:", error);
    return null;
  }
}

export async function updateItem(id: string, changes: {
  name?: string;
  quantity?: number;
  currentStationId?: string;
  material?: string;
  surfaceRequested?: string;
  photoIds?: string[];
  photo?: string;
}) {
  if (!db) return null;
  try {
    await db.update(items).set(changes).where(eq(items.id, id));
    return { id, ...changes };
  } catch (error) {
    console.error("Failed to update item in DB:", error);
    return null;
  }
}
