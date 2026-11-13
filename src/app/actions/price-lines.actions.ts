"use server";

import { db } from "@/db";
import { priceLines } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { ActionResult } from "@/lib/server/authHelper";
import {resolveAuthorization,hasAuthorizationArea} from "@/lib/server/authorization";
import {LEGACY_ACTION_ACCESS_COPY} from "@/ui/situationCatalog";

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
  const auth = await resolveAuthorization();
  if (!auth.ok) return {ok:false,error:"UNAUTHORIZED",message:auth.message};
  if (!hasAuthorizationArea(auth.data,"geld")) return {ok:false,error:"FORBIDDEN",message:LEGACY_ACTION_ACCESS_COPY.forbidden};

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    let query = db.select().from(priceLines).where(and(eq(priceLines.orderId, orderId),eq(priceLines.tenantId,auth.data.tenantId)));
    
    if (itemId) {
      query = db.select().from(priceLines).where(
        and(
          eq(priceLines.orderId, orderId),
          eq(priceLines.tenantId, auth.data.tenantId),
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
