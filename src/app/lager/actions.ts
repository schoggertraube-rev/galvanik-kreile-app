"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { appUsers, lagerArtikel, orders, stockMovements } from "@/db/schema";
import type { InventoryItem, StockMovement } from "@/lib/repositories/inventoryRepository";
import type { ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization } from "@/lib/server/authorization";

const TENANT_ID = "galvanik-kreile";
const ENTITY_ID = /^[A-Za-z0-9_-]{1,100}$/;
const MOVEMENT_TYPES = ["stock_in", "stock_out", "consumption", "correction", "waste"] as const;

type InventoryActor = { tenantId: string; userId: string; displayName: string; canWrite: boolean };

async function authorizeInventory(): Promise<ActionResult<InventoryActor>> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return { ok: false, error: "UNAUTHORIZED", message: "Anmeldung erforderlich." };
  if (authorization.data.tenantId !== TENANT_ID || !authorization.data.permissions.includes("perm_view_leitstand")) {
    return { ok: false, error: "FORBIDDEN", message: "Keine Berechtigung für Lagerdaten." };
  }
  return {
    ok: true,
    data: {
      tenantId: authorization.data.tenantId,
      userId: authorization.data.userId,
      displayName: authorization.data.displayName,
      canWrite: authorization.data.role !== "readonly",
    },
  };
}

function category(value: string): InventoryItem["category"] {
  const normalized = value.trim().toLowerCase();
  if (["chemie", "chemical", "chemikalie"].includes(normalized)) return "chemical";
  if (["verbrauch", "verbrauchsmaterial", "verschleiss", "verschleiß", "consumable"].includes(normalized)) return "consumable";
  if (["werkzeug", "werkzeuge", "tooling"].includes(normalized)) return "tooling";
  if (["verpackung", "packaging"].includes(normalized)) return "packaging";
  return "other";
}

function itemResponse(row: typeof lagerArtikel.$inferSelect): InventoryItem {
  const normalizedCategory = category(row.kategorie);
  return {
    id: row.id,
    sku: row.artikelnummer,
    name: row.name,
    category: normalizedCategory,
    unit: row.einheit,
    currentStock: Number(row.bestand),
    minStock: Number(row.mindestbestand),
    isConsumable: ["chemical", "consumable", "packaging"].includes(normalizedCategory),
  };
}

type MovementRow = {
  movement: typeof stockMovements.$inferSelect;
  unit: string | null;
  actorName: string | null;
};

function movementResponse(row: MovementRow): StockMovement {
  return {
    id: row.movement.id,
    inventoryItemId: row.movement.inventoryItemId,
    movementType: row.movement.movementType as StockMovement["movementType"],
    quantity: Number(row.movement.quantity),
    unit: row.unit || "",
    orderId: row.movement.orderId || undefined,
    reason: row.movement.reason || row.movement.notiz || undefined,
    createdBy: row.actorName || row.movement.erfasstVon || "",
    createdAt: row.movement.createdAt?.toISOString() || null,
  };
}

async function readMovements(tenantId: string, inventoryItemId?: string): Promise<StockMovement[]> {
  const base = db
    .select({
      movement: stockMovements,
      unit: lagerArtikel.einheit,
      actorName: appUsers.fullName,
    })
    .from(stockMovements)
    .leftJoin(
      lagerArtikel,
      and(eq(stockMovements.inventoryItemId, lagerArtikel.id), eq(lagerArtikel.tenantId, tenantId)),
    )
    .leftJoin(appUsers, eq(stockMovements.erfasstVon, appUsers.id));

  const rows = inventoryItemId
    ? await base
        .where(and(eq(stockMovements.tenantId, tenantId), eq(stockMovements.inventoryItemId, inventoryItemId)))
        .orderBy(desc(stockMovements.createdAt))
    : await base
        .where(eq(stockMovements.tenantId, tenantId))
        .orderBy(desc(stockMovements.createdAt));
  return rows.map(movementResponse);
}

export async function getLagerbestandAction(): Promise<ActionResult<InventoryItem[]>> {
  const actor = await authorizeInventory();
  if (!actor.ok) return actor;
  try {
    const rows = await db
      .select()
      .from(lagerArtikel)
      .where(eq(lagerArtikel.tenantId, actor.data.tenantId))
      .orderBy(lagerArtikel.name);
    return { ok: true, data: rows.map(itemResponse) };
  } catch (error) {
    console.error("Error in getLagerbestandAction:", error);
    return { ok: false, error: "DB_ERROR", message: "Lagerbestand konnte nicht geladen werden." };
  }
}

export async function getLagerArtikelAction(id: unknown): Promise<ActionResult<InventoryItem | null>> {
  const actor = await authorizeInventory();
  if (!actor.ok) return actor;
  if (typeof id !== "string" || !ENTITY_ID.test(id)) return { ok: false, error: "UNKNOWN", message: "Ungültige Artikel-ID." };
  try {
    const [row] = await db
      .select()
      .from(lagerArtikel)
      .where(and(eq(lagerArtikel.id, id), eq(lagerArtikel.tenantId, actor.data.tenantId)))
      .limit(1);
    return { ok: true, data: row ? itemResponse(row) : null };
  } catch (error) {
    console.error("Inventory item read failed", error);
    return { ok: false, error: "DB_ERROR", message: "Lagerartikel konnte nicht geladen werden." };
  }
}

export async function getLagerBewegungenAction(inventoryItemId?: unknown): Promise<ActionResult<StockMovement[]>> {
  const actor = await authorizeInventory();
  if (!actor.ok) return actor;
  if (inventoryItemId !== undefined && (typeof inventoryItemId !== "string" || !ENTITY_ID.test(inventoryItemId))) {
    return { ok: false, error: "UNKNOWN", message: "Ungültige Artikel-ID." };
  }
  try {
    return { ok: true, data: await readMovements(actor.data.tenantId, inventoryItemId as string | undefined) };
  } catch (error) {
    console.error("Inventory movement read failed", error);
    return { ok: false, error: "DB_ERROR", message: "Lagerbewegungen konnten nicht geladen werden." };
  }
}

export async function createLagerBewegungAction(input: unknown): Promise<ActionResult<StockMovement>> {
  const actor = await authorizeInventory();
  if (!actor.ok) return actor;
  if (!actor.data.canWrite) return { ok: false, error: "FORBIDDEN", message: "Keine Schreibberechtigung für Lagerbuchungen." };

  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_MOVEMENT");
    const value = input as Record<string, unknown>;
    const allowed = ["inventoryItemId", "movementType", "quantity", "orderId", "reason"];
    if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error("INVALID_MOVEMENT");
    if (typeof value.inventoryItemId !== "string" || !ENTITY_ID.test(value.inventoryItemId)) throw new Error("INVALID_MOVEMENT");
    if (!MOVEMENT_TYPES.includes(value.movementType as typeof MOVEMENT_TYPES[number])) throw new Error("INVALID_MOVEMENT");
    const quantity = Number(value.quantity);
    const isCorrection = value.movementType === "correction";
    if (!Number.isFinite(quantity) || quantity === 0 || Math.abs(quantity) > 1_000_000 || (!isCorrection && quantity < 0)) {
      throw new Error("INVALID_MOVEMENT");
    }
    const reason = typeof value.reason === "string" ? value.reason.trim() : "";
    if (reason.length > 500 || /[\u0000-\u001F\u007F]/.test(reason)) throw new Error("INVALID_MOVEMENT");
    const orderId = value.orderId;
    if (orderId !== undefined && (typeof orderId !== "string" || !ENTITY_ID.test(orderId))) throw new Error("INVALID_MOVEMENT");

    const movementType = value.movementType as StockMovement["movementType"];
    const delta = ["stock_out", "consumption", "waste"].includes(movementType)
      ? -Math.abs(quantity)
      : movementType === "stock_in"
        ? Math.abs(quantity)
        : quantity;

    const result = await db.transaction(async (tx) => {
      const [item] = await tx
        .select()
        .from(lagerArtikel)
        .where(and(eq(lagerArtikel.id, value.inventoryItemId as string), eq(lagerArtikel.tenantId, actor.data.tenantId)))
        .limit(1)
        .for("update");
      if (!item) throw new Error("ITEM_NOT_FOUND");

      if (typeof orderId === "string") {
        const [order] = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.tenantId, actor.data.tenantId)))
          .limit(1);
        if (!order) throw new Error("ORDER_NOT_FOUND");
      }

      const currentStock = Number(item.bestand);
      const nextStock = currentStock + delta;
      if (!Number.isFinite(currentStock) || nextStock < 0) throw new Error("INSUFFICIENT_STOCK");

      await tx
        .update(lagerArtikel)
        .set({ bestand: String(nextStock) })
        .where(and(eq(lagerArtikel.id, item.id), eq(lagerArtikel.tenantId, actor.data.tenantId)));

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          id: crypto.randomUUID(),
          tenantId: actor.data.tenantId,
          inventoryItemId: item.id,
          movementType,
          quantity: String(delta),
          reason: reason || null,
          orderId: typeof orderId === "string" ? orderId : null,
          erfasstVon: actor.data.userId,
          notiz: null,
        })
        .returning();

      return movementResponse({ movement, unit: item.einheit, actorName: actor.data.displayName });
    });

    return { ok: true, data: result };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_MOVEMENT") return { ok: false, error: "UNKNOWN", message: "Ungültige Lagerbuchung." };
    if (code === "ITEM_NOT_FOUND") return { ok: false, error: "EMPTY_RESULT", message: "Lagerartikel wurde nicht gefunden." };
    if (code === "ORDER_NOT_FOUND") return { ok: false, error: "EMPTY_RESULT", message: "Auftrag wurde nicht gefunden." };
    if (code === "INSUFFICIENT_STOCK") return { ok: false, error: "UNKNOWN", message: "Die Buchung würde einen negativen Bestand erzeugen." };
    console.error("Inventory movement create failed", error);
    return { ok: false, error: "DB_ERROR", message: "Lagerbuchung konnte nicht gespeichert werden." };
  }
}
