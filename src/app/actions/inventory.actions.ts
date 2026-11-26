"use server";

import type { ActionResult } from "@/lib/server/authHelper";
import type { CreateStockMovementInput, InventoryItem, StockMovement } from "@/lib/types/inventory";
import { readLagerEinstellungen, readLoggingSettings } from "@/modules/fundament/server-public";
import { observeAction, subjectForAction } from "@/modules/logging/server-public";
import {
  bucheLagerEinzeln,
  leseLagerArtikelAltvertrag,
  leseLagerBewegungenAltvertrag,
  type LagerPreisAufgabe,
} from "@/modules/lager/server-public";
import { readCustomerProfile } from "@/modules/customers/server-public";
import { recordIntakeTaskEffect } from "@/modules/eingang/server-public";
import { synchronizeLagerBestandTask, synchronizeLagerPreisTask } from "@/modules/tasks/server-public";

const synchronisierePreisaufgabe: LagerPreisAufgabe = (tx, auth, artikelId, einheit, lesePreisstand) =>
  synchronizeLagerPreisTask(tx, auth, artikelId, einheit, {
    lesePreisstand,
    effect: (effectTx, akteur, aufgabe) => recordIntakeTaskEffect(effectTx, akteur, aufgabe, readCustomerProfile),
  });
import { LAGER_BUCHUNG_COPY } from "@/ui/lagerBuchungCopy";

function fehlendeArtikelId(artikelId: unknown) {
  if (typeof artikelId === "string" && artikelId.trim() !== "") return null;
  return { ok: false, error: "VALIDATION_ERROR", message: LAGER_BUCHUNG_COPY.artikelFehlt } as const;
}

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
    const fehler = fehlendeArtikelId(artikelId);
    if (fehler) return fehler;
    const ergebnis = await leseLagerArtikelAltvertrag(readLagerEinstellungen, artikelId);
    return ergebnis.ok ? { ok: true, data: ergebnis.data[0] ?? null } : ergebnis;
  }, readLoggingSettings);
}

export async function getInventoryMovementsByItemAction(artikelId: string): Promise<ActionResult<StockMovement[]>> {
  return observeAction("getInventoryMovementsByItemAction", subjectForAction("getInventoryMovementsByItemAction", { artikelId }),
    async () => fehlendeArtikelId(artikelId) ?? leseLagerBewegungenAltvertrag({ artikelId }), readLoggingSettings);
}

export async function createInventoryMovementAction(input: CreateStockMovementInput): Promise<ActionResult<StockMovement>> {
  return observeAction("createInventoryMovementAction", subjectForAction("createInventoryMovementAction", input),
    () => bucheLagerEinzeln(input, readLagerEinstellungen, synchronizeLagerBestandTask, synchronisierePreisaufgabe),
    readLoggingSettings);
}
