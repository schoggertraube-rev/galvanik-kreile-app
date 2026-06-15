"use server";

import { db } from "@/db";
import { items, orders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { checkAppAuth, ActionResult } from "@/lib/server/authHelper";

export type ItemResponse = Record<string, unknown>;

export async function getItemsDb(): Promise<ActionResult<ItemResponse[]>> {
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const dbItems = await db.select().from(items).where(eq(items.tenantId, "galvanik-kreile")).orderBy(desc(items.createdAt));
    
    const data = dbItems.map(i => ({
      id: i.id,
      orderId: i.orderId,
      customerId: i.customerId,
      name: i.name,
      quantity: i.quantity,
      material: i.material || undefined,
      surfaceRequested: i.surfaceRequested || undefined,
      photoIds: i.photoIds || [],
      photo: i.photo || undefined,
    }));
    
    return { ok: true, data };
  } catch (error) {
    console.error("Failed to get items from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Artikel", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function getItemsByOrderDb(orderId: string): Promise<ActionResult<ItemResponse[]>> {
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    // orderId and tenantId
    const dbItems = await db.select().from(items)
      .where(eq(items.orderId, orderId)); 
      
    const data = dbItems.map(i => ({
      id: i.id,
      orderId: i.orderId,
      customerId: i.customerId,
      name: i.name,
      quantity: i.quantity,
      material: i.material || undefined,
      surfaceRequested: i.surfaceRequested || undefined,
      photoIds: i.photoIds || [],
      photo: i.photo || undefined,
    }));
    
    return { ok: true, data };
  } catch (error) {
    console.error("Failed to get items for order from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Artikel", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function createItemDb(data: any): Promise<ActionResult<ItemResponse>> {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const orderData = await db.select({ customerId: orders.customerId }).from(orders).where(eq(orders.id, data.orderId)).limit(1);
    
    if (orderData.length === 0) {
      return { ok: false, error: "EMPTY_RESULT", message: "Auftrag nicht gefunden" };
    }
    
    const customerId = orderData[0].customerId;
    const id = data.id || createId();
    
    const newItem = {
      id,
      tenantId: "galvanik-kreile",
      orderId: data.orderId,
      customerId,
      name: data.name,
      quantity: typeof data.quantity === "number" ? data.quantity : parseInt(data.quantity) || 1,
      material: data.material || null,
      surfaceRequested: data.surfaceRequested || null,
      photoIds: data.photoIds || [],
      photo: data.photo || null,
      currentStationId: data.currentStationId || "wareneingang"
    };
    
    await db.insert(items).values(newItem);
    
    return {
      ok: true,
      data: {
        id,
        orderId: data.orderId,
        name: data.name,
        quantity: data.quantity,
        material: data.material || undefined,
        surfaceRequested: data.surfaceRequested || undefined,
        photoIds: data.photoIds || [],
        photo: data.photo || undefined,
      }
    };
  } catch (error) {
    console.error("Failed to create item in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Erstellen des Artikels", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function updateItemDb(id: string, changes: any): Promise<ActionResult<ItemResponse>> {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const updateData: any = {};
    if (changes.name !== undefined) updateData.name = changes.name;
    if (changes.quantity !== undefined) updateData.quantity = changes.quantity;
    if (changes.material !== undefined) updateData.material = changes.material;
    if (changes.surfaceRequested !== undefined) updateData.surfaceRequested = changes.surfaceRequested;
    if (changes.photoIds !== undefined) updateData.photoIds = changes.photoIds;
    if (changes.photo !== undefined) updateData.photo = changes.photo;
    
    if (Object.keys(updateData).length > 0) {
      await db.update(items).set(updateData).where(eq(items.id, id));
    }
    
    return { ok: true, data: { id, ...changes } };
  } catch (error) {
    console.error("Failed to update item in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Aktualisieren des Artikels", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function deleteItemDb(id: string): Promise<ActionResult<{ success: boolean }>> {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    await db.delete(items).where(eq(items.id, id));
    return { ok: true, data: { success: true } };
  } catch (error) {
    console.error("Failed to delete item from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Löschen des Artikels", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}
