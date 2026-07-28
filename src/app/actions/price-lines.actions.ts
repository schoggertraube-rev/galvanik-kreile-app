"use server";

import type { ActionResult } from "@/lib/server/authHelper";
import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

export type PriceLineRecord = {
  id: string;
  orderId?: string;
  itemId?: string | null;
  positionText: string;
  qty: number;
  unitPriceEur: number;
  unitTotalEur?: number;
};

export type PriceLineMutation = {
  order_id?: string;
  item_id?: string | null;
  position_text?: string;
  qty?: number;
  unit_price_eur?: number;
  unit_total_eur?: number;
};

function priceLinesUnavailable(): never {
  if (!isFoundationAreaEnabled("Legacy-Preispositionen")) {
    return foundationUnavailableAction("Legacy-Preispositionen");
  }
  return foundationUnavailableAction("Legacy-Preispositionen");
}

export async function getPriceLinesDb(
  orderId: string,
  itemId?: string | null,
): Promise<ActionResult<PriceLineRecord[]>> {
  void orderId;
  void itemId;
  return priceLinesUnavailable();
}

export async function createPriceLineDb(data: PriceLineMutation): Promise<ActionResult<PriceLineRecord>> {
  void data;
  return priceLinesUnavailable();
}

export async function updatePriceLineDb(
  id: string,
  data: PriceLineMutation,
): Promise<ActionResult<PriceLineRecord>> {
  void id;
  void data;
  return priceLinesUnavailable();
}

export async function deletePriceLineDb(id: string): Promise<ActionResult<{ success: boolean }>> {
  void id;
  return priceLinesUnavailable();
}
