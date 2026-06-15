"use server";

import { db } from "@/db";
import { priceLines } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { checkAppAuth, ActionResult } from "@/lib/server/authHelper";

export async function getPriceLinesDb(orderId: string, itemId?: string | null): Promise<ActionResult<any[]>> {
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    let query = db.select().from(priceLines).where(eq(priceLines.orderId, orderId));
    
    if (itemId) {
      query = db.select().from(priceLines).where(
        and(
          eq(priceLines.orderId, orderId),
          eq(priceLines.itemId, itemId)
        )
      );
    }
    
    const data = await query;
    return { ok: true, data };
  } catch (error) {
    console.error("Failed to get price lines from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Preise", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function createPriceLineDb(data: any): Promise<ActionResult<any>> {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const id = createId();
    const newLine = {
      id,
      tenantId: "galvanik-kreile",
      orderId: data.order_id,
      itemId: data.item_id || null,
      positionText: data.position_text,
      qty: data.qty,
      unitPriceEur: data.unit_price_eur,
      unitTotalEur: data.unit_total_eur,
      sortOrder: data.sort_order || 0
    };
    
    await db.insert(priceLines).values(newLine);
    return { ok: true, data: newLine };
  } catch (error) {
    console.error("Failed to create price line in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Erstellen des Preises", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function updatePriceLineDb(id: string, data: any): Promise<ActionResult<any>> {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const updateData: any = {};
    if (data.position_text !== undefined) updateData.positionText = data.position_text;
    if (data.qty !== undefined) updateData.qty = data.qty;
    if (data.unit_price_eur !== undefined) updateData.unitPriceEur = data.unit_price_eur;
    if (data.unit_total_eur !== undefined) updateData.unitTotalEur = data.unit_total_eur;
    if (data.sort_order !== undefined) updateData.sortOrder = data.sort_order;
    
    if (Object.keys(updateData).length > 0) {
      await db.update(priceLines).set(updateData).where(eq(priceLines.id, id));
    }
    return { ok: true, data: { id } };
  } catch (error) {
    console.error("Failed to update price line in DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Aktualisieren des Preises", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function deletePriceLineDb(id: string): Promise<ActionResult<{ success: boolean }>> {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return auth;

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    await db.delete(priceLines).where(eq(priceLines.id, id));
    return { ok: true, data: { success: true } };
  } catch (error) {
    console.error("Failed to delete price line from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Löschen des Preises", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}
