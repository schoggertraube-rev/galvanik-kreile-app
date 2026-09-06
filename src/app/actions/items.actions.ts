"use server";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

import { db } from "@/db";
import { items } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { checkAppAuth, ActionResult } from "@/lib/server/authHelper";

export type ItemResponse = Record<string, unknown>;

export type ItemMutationPayload = {
  id?: string;
  orderId?: string;
  name?: string;
  quantity?: number | string;
  material?: string | null;
  surfaceRequested?: string | null;
  photoIds?: string[];
  photo?: string | null;
  currentStationId?: string | null;
  stationSequence?: string[];
  internalNotes?: string | null;
};

export async function getItemsDb(): Promise<ActionResult<ItemResponse[]>> {
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const dbItems = await db.select().from(items).where(eq(items.tenantId, KREILE_TENANT_SLUG)).orderBy(desc(items.createdAt));
    
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

export async function createItemDb(data: ItemMutationPayload): Promise<ActionResult<ItemResponse>> {
  void data;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt." };
}

export async function updateItemDb(id: string, changes: ItemMutationPayload): Promise<ActionResult<ItemResponse>> {
  void id;
  void changes;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt." };
}

export async function deleteItemDb(id: string): Promise<ActionResult<{ success: boolean }>> {
  void id;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt." };
}
