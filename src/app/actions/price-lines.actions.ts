"use server";

import { db } from "@/db";
import { priceLines } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { checkAppAuth, ActionResult } from "@/lib/server/authHelper";

type PriceLineListItem = {
  id: string;
  positionText: string;
  qty: number;
  unitPriceEur: number;
  unitTotalEur?: number;
};

type PriceLineMutationResult = {
  id: string;
  tenantId: string;
  orderId: string;
  itemId: string | null;
  positionText: string;
  qty?: number;
  unitPriceEur: number;
  unitTotalEur?: number;
  sortOrder: number;
};

export type PriceLinePayload = {
  order_id: string;
  item_id?: string | null;
  position_text: string;
  qty?: number;
  unit_price_eur: number;
  unit_total_eur?: number;
  sort_order?: number;
};

export async function getPriceLinesDb(orderId: string, itemId?: string | null): Promise<ActionResult<PriceLineListItem[]>> {
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
    return { ok: true, data: data as unknown as PriceLineListItem[] };
  } catch (error) {
    console.error("Failed to get price lines from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Preise", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function createPriceLineDb(data: PriceLinePayload): Promise<ActionResult<PriceLineMutationResult>> {
  void data;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt." };
}

export async function updatePriceLineDb(id: string, data: Partial<PriceLinePayload>): Promise<ActionResult<{ id: string }>> {
  void id;
  void data;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt." };
}

export async function deletePriceLineDb(id: string): Promise<ActionResult<{ success: boolean }>> {
  void id;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt." };
}
