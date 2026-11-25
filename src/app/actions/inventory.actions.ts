"use server";

import type { ActionResult } from "@/lib/server/authHelper";
import type { CreateStockMovementInput, InventoryItem, StockMovement } from "@/lib/types/inventory";
import { readLagerEinstellungen, readLoggingSettings } from "@/modules/fundament/server-public";
import { observeAction, subjectForAction } from "@/modules/logging/server-public";
import {
  bucheLagerEinzeln,
  leseLagerArtikelAltvertrag,
  leseLagerBewegungenAltvertrag,
} from "@/modules/lager/server-public";
import { synchronizeLagerBestandTask } from "@/modules/tasks/server-public";

export async function getInventoryItemsAction(): Promise<ActionResult<InventoryItem[]>> {
  return observeAction("getInventoryItemsAction", subjectForAction("getInventoryItemsAction", undefined),
    () => leseLagerArtikelAltvertrag(readLagerEinstellungen), readLoggingSettings);
}

export async function getInventoryMovementsAction(): Promise<ActionResult<StockMovement[]>> {
  return observeAction("getInventoryMovementsAction", subjectForAction("getInventoryMovementsAction", undefined),
    () => leseLagerBewegungenAltvertrag(), readLoggingSettings);
}

export async function getInventoryItemAction(artikelId: string): Promise<ActionResult<InventoryItem | null>> {
  return observeAction("getInventoryItemAction", subjectForAction("getInventoryItemAction", { artikelId }), async () => {
    const ergebnis = await leseLagerArtikelAltvertrag(readLagerEinstellungen, artikelId);
    return ergebnis.ok ? { ok: true, data: ergebnis.data[0] ?? null } : ergebnis;
  }, readLoggingSettings);
}

export async function getInventoryMovementsByItemAction(artikelId: string): Promise<ActionResult<StockMovement[]>> {
  return observeAction("getInventoryMovementsByItemAction", subjectForAction("getInventoryMovementsByItemAction", { artikelId }),
    () => leseLagerBewegungenAltvertrag({ artikelId }), readLoggingSettings);
}

export async function createInventoryMovementAction(input: CreateStockMovementInput): Promise<ActionResult<StockMovement>> {
  return observeAction("createInventoryMovementAction", subjectForAction("createInventoryMovementAction", input),
    () => bucheLagerEinzeln(input, readLagerEinstellungen, synchronizeLagerBestandTask), readLoggingSettings);
}
