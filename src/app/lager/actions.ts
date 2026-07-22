"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { appUsers, inventoryItems, orders, stockMovements } from "@/db/schema";
import {
  calculateNextInventoryStock,
  fitsInventoryQuantityDecimals,
  parseInventoryMovementQuantity,
  parseStoredInventoryStock,
} from "@/lib/inventory/inventoryMutationContract";
import type {
  InventoryItem,
  InventoryMovementHistory,
  InventorySnapshot,
  StockMovement,
} from "@/lib/repositories/inventoryRepository";
import type { ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization } from "@/lib/server/authorization";
import {
  inventoryWriteCapabilityAvailable,
  inventoryWriteCapabilityQuery,
  readInventoryWriteCapability,
} from "@/lib/server/inventoryWriteCapability";

const TENANT_ID = "galvanik-kreile";
const ENTITY_ID = /^[A-Za-z0-9_-]{1,100}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MOVEMENT_TYPES = ["stock_in", "stock_out", "consumption", "correction", "waste"] as const;
const HISTORY_LIMIT = 100;

const inventoryReadSessionQuery = sql<{ available: boolean }>`
  select (
    current_user = 'service_role'
    and exists (
      select 1 from pg_roles
      where rolname = current_user and rolbypassrls and not rolsuper
    )
    and has_table_privilege(current_user, 'public.inventory_items', 'SELECT')
    and has_table_privilege(current_user, 'public.stock_movements', 'SELECT')
    and has_table_privilege(current_user, 'public.app_users', 'SELECT')
  ) as available
`;

function inventoryReadSessionAvailable(row: Record<string, unknown> | undefined): boolean {
  return row?.available === true;
}

type InventoryActor = { tenantId: string; userId: string; displayName: string; canWrite: boolean };

async function authorizeInventory(): Promise<ActionResult<InventoryActor>> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) {
    if (authorization.reason === "AUTHORIZATION_UNAVAILABLE") {
      return { ok: false, error: "DB_ERROR", message: authorization.message };
    }
    if (authorization.reason === "TENANT_SUSPENDED" || authorization.reason === "TENANT_MAINTENANCE") {
      return { ok: false, error: "FORBIDDEN", message: authorization.message };
    }
    return { ok: false, error: "UNAUTHORIZED", message: authorization.message };
  }
  if (authorization.data.tenantId !== TENANT_ID || !authorization.data.permissions.includes("perm_view_leitstand")) {
    return { ok: false, error: "FORBIDDEN", message: "Keine Berechtigung für Lagerdaten." };
  }
  return {
    ok: true,
    data: {
      tenantId: authorization.data.tenantId,
      userId: authorization.data.userId,
      displayName: authorization.data.displayName,
      canWrite: authorization.data.permissions.includes("perm_op_status")
        || authorization.data.permissions.includes("perm_data_orders"),
    },
  };
}

function category(value: string | null): InventoryItem["category"] {
  const normalized = value?.trim().toLocaleLowerCase("de-DE") || "";
  if (!normalized) return "unknown";
  if (["chemie", "chemical", "chemikalie"].includes(normalized)) return "chemical";
  if (["verbrauch", "verbrauchsmaterial", "verschleiss", "verschleiß", "consumable"].includes(normalized)) return "consumable";
  if (["werkzeug", "werkzeuge", "tooling"].includes(normalized)) return "tooling";
  if (["verpackung", "packaging"].includes(normalized)) return "packaging";
  if (["sonstiges", "other"].includes(normalized)) return "other";
  return "unknown";
}

type InventoryItemRow = {
  id: string;
  name: string;
  category: string | null;
  currentStock: string | null;
  minStock: number | string | null;
  unit: string | null;
  einkaufspreisEur: number | string | null;
};

const inventoryItemSelection = {
  id: inventoryItems.id,
  name: inventoryItems.name,
  category: inventoryItems.category,
  currentStock: inventoryItems.currentStock,
  minStock: inventoryItems.minStock,
  unit: inventoryItems.unit,
  einkaufspreisEur: inventoryItems.einkaufspreisEur,
};

type InventoryStockScaleRow = {
  data_type: string;
  numeric_scale: number | string | null;
};

const inventoryStockScaleQuery = sql<InventoryStockScaleRow>`
  select data_type, numeric_scale
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'inventory_items'
    and column_name = 'current_stock'
  limit 1
`;

function inventoryQuantityDecimals(row: Record<string, unknown> | undefined): number {
  if (!row || typeof row.data_type !== "string") throw new Error("INVENTORY_QUANTITY_CAPABILITY_UNAVAILABLE");
  if (["smallint", "integer", "bigint"].includes(row.data_type)) return 0;
  if (!["numeric", "decimal"].includes(row.data_type)) {
    throw new Error("INVENTORY_QUANTITY_CAPABILITY_UNAVAILABLE");
  }
  const decimals = Number(row.numeric_scale);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 4) {
    throw new Error("INVENTORY_QUANTITY_CAPABILITY_UNAVAILABLE");
  }
  return decimals;
}

function itemResponse(
  row: InventoryItemRow,
  lastStockInAt: Date | string | null = null,
): InventoryItem {
  const name = row.name.trim();
  const unit = row.unit?.trim() || null;
  const normalizedCategory = category(row.category);
  const currentStock = parseStoredInventoryStock(row.currentStock);
  const minStock = row.minStock === null ? null : Number(row.minStock);
  const pricePerUnit = row.einkaufspreisEur === null ? null : Number(row.einkaufspreisEur);
  if (
    !name
    || currentStock === null
    || (minStock !== null && (!Number.isFinite(minStock) || minStock < 0))
    || (pricePerUnit !== null && (!Number.isFinite(pricePerUnit) || pricePerUnit < 0))
  ) {
    throw new Error("INVALID_INVENTORY_DATA");
  }
  const stockInTimestamp = lastStockInAt instanceof Date
    ? lastStockInAt
    : lastStockInAt
      ? new Date(lastStockInAt)
      : null;
  if (stockInTimestamp && Number.isNaN(stockInTimestamp.getTime())) {
    throw new Error("INVALID_INVENTORY_DATA");
  }
  return {
    id: row.id,
    sku: null,
    name,
    category: normalizedCategory,
    unit,
    currentStock,
    minStock,
    lastStockInAt: stockInTimestamp?.toISOString() || null,
    storageLocation: null,
    isConsumable: ["chemical", "consumable", "packaging"].includes(normalizedCategory),
    isHazardous: null,
    pricePerUnit,
  };
}

type MovementRow = {
  id: string;
  inventoryItemId: string;
  movementType: string;
  quantity: string;
  orderId: string | null;
  reason: string | null;
  erfasstVon: string | null;
  createdAt: Date | string | null;
  unit: string | null;
  actorName: string | null;
};

type DirectMovementRow = Omit<MovementRow, "actorName"> & {
  tenantId: string;
  createdBy: string;
};

const directMovementSelection = {
  id: stockMovements.id,
  tenantId: stockMovements.tenantId,
  inventoryItemId: stockMovements.inventoryItemId,
  movementType: stockMovements.movementType,
  quantity: stockMovements.quantity,
  orderId: stockMovements.orderId,
  reason: stockMovements.reason,
  unit: stockMovements.unit,
  createdBy: stockMovements.createdBy,
  erfasstVon: stockMovements.erfasstVon,
  createdAt: stockMovements.createdAt,
};

function normalizeMovementType(value: string): StockMovement["movementType"] {
  if (value === "verbrauch") return "consumption";
  if (MOVEMENT_TYPES.includes(value as typeof MOVEMENT_TYPES[number])) {
    return value as StockMovement["movementType"];
  }
  throw new Error("INVALID_MOVEMENT_DATA");
}

function movementResponse(row: MovementRow): StockMovement {
  const normalizedType = normalizeMovementType(row.movementType);
  const quantity = Number(row.quantity);
  if (!Number.isFinite(quantity) || quantity === 0) throw new Error("INVALID_MOVEMENT_DATA");
  const createdAt = row.createdAt instanceof Date
    ? row.createdAt
    : row.createdAt
      ? new Date(row.createdAt)
      : null;
  if (createdAt && Number.isNaN(createdAt.getTime())) throw new Error("INVALID_MOVEMENT_DATA");
  return {
    id: row.id,
    inventoryItemId: row.inventoryItemId,
    movementType: normalizedType,
    quantity,
    unit: row.unit?.trim() || null,
    orderId: row.orderId || undefined,
    reason: row.reason?.trim() || undefined,
    createdBy: row.actorName?.trim() || (row.erfasstVon ? "Benutzer nicht auflösbar" : "Nicht erfasst"),
    createdAt: createdAt?.toISOString() || null,
  };
}

function replayDirectMovement(
  existing: DirectMovementRow,
  actor: InventoryActor,
  expected: {
    inventoryItemId: string;
    movementType: StockMovement["movementType"];
    quantity: number;
    reason: string;
    orderId: string | undefined;
  },
): StockMovement {
  const existingQuantity = parseInventoryMovementQuantity(Number(existing.quantity));
  if (
    existing.tenantId !== actor.tenantId
    || existing.inventoryItemId !== expected.inventoryItemId
    || existing.movementType !== expected.movementType
    || existingQuantity !== expected.quantity
    || (existing.reason || "") !== expected.reason
    || (existing.orderId || undefined) !== expected.orderId
    || existing.createdBy !== actor.userId
    || existing.erfasstVon !== actor.userId
  ) {
    throw new Error("REQUEST_CONFLICT");
  }
  return {
    ...movementResponse({ ...existing, actorName: actor.displayName }),
    replayed: true,
  };
}

async function readMovements(tenantId: string, inventoryItemId: string): Promise<InventoryMovementHistory> {
  const [itemRows, rows, readCapabilityRows] = await db.transaction(async (tx) => Promise.all([
    tx.select({ id: inventoryItems.id }).from(inventoryItems).where(and(
      eq(inventoryItems.id, inventoryItemId),
      eq(inventoryItems.tenantId, tenantId),
    )).limit(1),
    tx
      .select({
        id: stockMovements.id,
        inventoryItemId: stockMovements.inventoryItemId,
        movementType: stockMovements.movementType,
        quantity: stockMovements.quantity,
        orderId: stockMovements.orderId,
        reason: stockMovements.reason,
        erfasstVon: stockMovements.erfasstVon,
        createdAt: stockMovements.createdAt,
        unit: stockMovements.unit,
        actorName: appUsers.fullName,
      })
      .from(stockMovements)
      .leftJoin(appUsers, and(eq(stockMovements.erfasstVon, appUsers.id), eq(appUsers.tenantId, tenantId)))
      .where(and(eq(stockMovements.tenantId, tenantId), eq(stockMovements.inventoryItemId, inventoryItemId)))
      .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
      .limit(HISTORY_LIMIT + 1),
    tx.execute(inventoryReadSessionQuery),
  ]), { isolationLevel: "repeatable read", accessMode: "read only" });
  if (!inventoryReadSessionAvailable(readCapabilityRows[0])) {
    throw new Error("INVENTORY_READ_ADAPTER_UNAVAILABLE");
  }
  if (!itemRows[0]) throw new Error("ITEM_NOT_FOUND");

  return {
    movements: rows.slice(0, HISTORY_LIMIT).map(movementResponse),
    truncated: rows.length > HISTORY_LIMIT,
    limit: HISTORY_LIMIT,
    unitContext: "movement_snapshot",
  };
}

export async function getLagerbestandAction(): Promise<ActionResult<InventorySnapshot>> {
  const actor = await authorizeInventory();
  if (!actor.ok) return actor;
  try {
    const [rows, stockInRows, tenantHealthRows, stockScaleRows, directWriteRows, readCapabilityRows] = await db.transaction(async (tx) => Promise.all([
      tx
        .select(inventoryItemSelection)
        .from(inventoryItems)
        .where(eq(inventoryItems.tenantId, actor.data.tenantId))
        .orderBy(inventoryItems.name),
      tx
        .select({
          inventoryItemId: stockMovements.inventoryItemId,
          lastStockInAt: sql<Date | null>`max(${stockMovements.createdAt})`,
        })
        .from(stockMovements)
        .where(and(
          eq(stockMovements.tenantId, actor.data.tenantId),
          eq(stockMovements.movementType, "stock_in"),
        ))
        .groupBy(stockMovements.inventoryItemId),
      tx.execute(sql<{ unassigned_count: number | string }>`
        select count(*)::int as unassigned_count
        from public.inventory_items
        where tenant_id is null or btrim(tenant_id) = ''
      `),
      tx.execute(inventoryStockScaleQuery),
      tx.execute(inventoryWriteCapabilityQuery),
      tx.execute(inventoryReadSessionQuery),
    ]), { isolationLevel: "repeatable read", accessMode: "read only" });
    if (!inventoryReadSessionAvailable(readCapabilityRows[0])) {
      throw new Error("INVENTORY_READ_ADAPTER_UNAVAILABLE");
    }
    const unassignedCount = Number(tenantHealthRows[0]?.unassigned_count);
    if (!Number.isSafeInteger(unassignedCount) || unassignedCount < 0) {
      throw new Error("INVALID_INVENTORY_TENANT_HEALTH");
    }
    if (unassignedCount > 0) throw new Error("INVENTORY_TENANT_ASSIGNMENT_INCOMPLETE");
    const quantityDecimals = inventoryQuantityDecimals(stockScaleRows[0]);
    const schemaCanWrite = inventoryWriteCapabilityAvailable(directWriteRows[0]);
    const canWrite = actor.data.canWrite && schemaCanWrite;
    const stockInByItem = new Map(stockInRows.map((row) => [row.inventoryItemId, row.lastStockInAt]));
    return {
      ok: true,
      data: {
        items: rows.map((row) => itemResponse(row, stockInByItem.get(row.id) || null)),
        capabilities: {
          canWrite,
          writeReason: !actor.data.canWrite
            ? "Ihre Rolle hat nur Leserechte für Lagerbuchungen."
            : !schemaCanWrite
              ? "Der serverseitige Lager-Schreibadapter ist in dieser Datenbank noch nicht vollständig ausgerollt."
              : null,
          historyLimit: HISTORY_LIMIT,
          quantityDecimals,
          quantityStep: 1 / (10 ** quantityDecimals),
        },
      },
    };
  } catch (error) {
    console.error("Error in getLagerbestandAction:", error);
    if (error instanceof Error && error.message === "INVENTORY_TENANT_ASSIGNMENT_INCOMPLETE") {
      return {
        ok: false,
        error: "DB_ERROR",
        message: "Lagerartikel sind noch nicht vollständig dem Mandanten zugeordnet. Der Bestand wird bis zur Datenzuordnung nicht als leer dargestellt.",
      };
    }
    return { ok: false, error: "DB_ERROR", message: "Lagerbestand konnte nicht geladen werden." };
  }
}

export async function getLagerBewegungenAction(inventoryItemId: unknown): Promise<ActionResult<InventoryMovementHistory>> {
  const actor = await authorizeInventory();
  if (!actor.ok) return actor;
  if (typeof inventoryItemId !== "string" || !ENTITY_ID.test(inventoryItemId)) {
    return { ok: false, error: "UNKNOWN", message: "Ungültige Artikel-ID." };
  }
  try {
    return { ok: true, data: await readMovements(actor.data.tenantId, inventoryItemId) };
  } catch (error) {
    if (error instanceof Error && error.message === "ITEM_NOT_FOUND") {
      return { ok: false, error: "EMPTY_RESULT", message: "Lagerartikel wurde nicht gefunden." };
    }
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
    const allowed = ["clientRequestId", "inventoryItemId", "movementType", "quantity", "orderId", "reason"];
    if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error("INVALID_MOVEMENT");
    if (typeof value.clientRequestId !== "string" || !UUID.test(value.clientRequestId)) throw new Error("INVALID_MOVEMENT");
    if (typeof value.inventoryItemId !== "string" || !ENTITY_ID.test(value.inventoryItemId)) throw new Error("INVALID_MOVEMENT");
    if (!MOVEMENT_TYPES.includes(value.movementType as typeof MOVEMENT_TYPES[number])) throw new Error("INVALID_MOVEMENT");
    const quantity = parseInventoryMovementQuantity(value.quantity);
    const isCorrection = value.movementType === "correction";
    if (quantity === null || (!isCorrection && quantity < 0)) {
      throw new Error("INVALID_MOVEMENT");
    }
    if (value.reason !== undefined && typeof value.reason !== "string") throw new Error("INVALID_MOVEMENT");
    const reason = typeof value.reason === "string" ? value.reason.trim() : "";
    if (reason.length > 500 || /[\u0000-\u001F\u007F]/.test(reason)) throw new Error("INVALID_MOVEMENT");
    if ((value.movementType === "correction" || value.movementType === "waste") && !reason) {
      throw new Error("INVALID_MOVEMENT");
    }
    const orderId = value.orderId;
    if (orderId !== undefined && (typeof orderId !== "string" || !ENTITY_ID.test(orderId))) throw new Error("INVALID_MOVEMENT");

    const movementType = value.movementType as StockMovement["movementType"];
    const clientRequestId = value.clientRequestId as string;
    const delta = ["stock_out", "consumption", "waste"].includes(movementType)
      ? -Math.abs(quantity)
      : movementType === "stock_in"
        ? Math.abs(quantity)
        : quantity;

    // A valid, already persisted receipt remains replayable during a later
    // rollout/configuration incident. Only new writes depend on the full write
    // capability.
    const [persisted] = await db
      .select(directMovementSelection)
      .from(stockMovements)
      .where(eq(stockMovements.id, clientRequestId))
      .limit(1);
    if (persisted) {
      return {
        ok: true,
        data: replayDirectMovement(persisted, actor.data, {
          inventoryItemId: value.inventoryItemId as string,
          movementType,
          quantity: delta,
          reason,
          orderId: typeof orderId === "string" ? orderId : undefined,
        }),
      };
    }

    if (!await readInventoryWriteCapability()) throw new Error("INVENTORY_WRITE_ADAPTER_UNAVAILABLE");

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${actor.data.tenantId}:inventory:${clientRequestId}`}, 0))`);

      const [existing] = await tx
        .select(directMovementSelection)
        .from(stockMovements)
        .where(eq(stockMovements.id, clientRequestId))
        .limit(1);
      if (existing) {
        return replayDirectMovement(existing, actor.data, {
          inventoryItemId: value.inventoryItemId as string,
          movementType,
          quantity: delta,
          reason,
          orderId: typeof orderId === "string" ? orderId : undefined,
        });
      }

      const [item] = await tx
        .select({
          id: inventoryItems.id,
          currentStock: inventoryItems.currentStock,
          unit: inventoryItems.unit,
        })
        .from(inventoryItems)
        .where(and(eq(inventoryItems.id, value.inventoryItemId as string), eq(inventoryItems.tenantId, actor.data.tenantId)))
        .limit(1)
        .for("update");
      if (!item) throw new Error("ITEM_NOT_FOUND");

      const stockScaleRows = await tx.execute(inventoryStockScaleQuery);
      const quantityDecimals = inventoryQuantityDecimals(stockScaleRows[0]);
      if (!fitsInventoryQuantityDecimals(quantity, quantityDecimals)) {
        throw new Error("UNSUPPORTED_QUANTITY_PRECISION");
      }
      if (!item.unit?.trim()) throw new Error("UNIT_NOT_CONFIGURED");

      if (typeof orderId === "string") {
        const [order] = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.tenantId, actor.data.tenantId)))
          .limit(1);
        if (!order) throw new Error("ORDER_NOT_FOUND");
      }

      const currentStock = parseStoredInventoryStock(item.currentStock);
      if (currentStock === null) throw new Error("INVALID_INVENTORY_DATA");
      const nextStock = calculateNextInventoryStock(currentStock, delta);
      if (nextStock === null) {
        throw new Error(delta < 0 ? "INSUFFICIENT_STOCK" : "INVALID_INVENTORY_DATA");
      }

      const occurredAt = new Date();

      const [updated] = await tx
        .update(inventoryItems)
        .set({ currentStock: String(nextStock) })
        .where(and(eq(inventoryItems.id, item.id), eq(inventoryItems.tenantId, actor.data.tenantId)))
        .returning({ id: inventoryItems.id });
      if (!updated) throw new Error("ITEM_UPDATE_NOT_CONFIRMED");

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          // One direct inventory request creates exactly one movement. Reusing the
          // request UUID as the primary key provides replay safety on the live schema.
          id: clientRequestId,
          tenantId: actor.data.tenantId,
          inventoryItemId: item.id,
          movementType,
          quantity: String(delta),
          unit: item.unit.trim(),
          reason: reason || null,
          orderId: typeof orderId === "string" ? orderId : null,
          createdBy: actor.data.userId,
          erfasstVon: actor.data.userId,
          createdAt: occurredAt,
        })
        .returning({
          id: stockMovements.id,
          inventoryItemId: stockMovements.inventoryItemId,
          movementType: stockMovements.movementType,
          quantity: stockMovements.quantity,
          unit: stockMovements.unit,
          orderId: stockMovements.orderId,
          reason: stockMovements.reason,
          erfasstVon: stockMovements.erfasstVon,
          createdAt: stockMovements.createdAt,
        });

      if (!movement) throw new Error("MOVEMENT_NOT_CONFIRMED");
      return {
        ...movementResponse({ ...movement, actorName: actor.data.displayName }),
        replayed: false,
      };
    });

    try {
      revalidatePath("/items");
      revalidatePath("/lager");
    } catch {
      // Revalidation is unavailable in isolated service tests.
    }
    return { ok: true, data: result };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_MOVEMENT") return { ok: false, error: "UNKNOWN", message: "Ungültige Lagerbuchung." };
    if (code === "INVENTORY_WRITE_ADAPTER_UNAVAILABLE") {
      return { ok: false, error: "DB_ERROR", message: "Der serverseitige Lager-Schreibadapter ist in dieser Datenbank noch nicht vollständig ausgerollt." };
    }
    if (code === "UNSUPPORTED_QUANTITY_PRECISION") {
      return { ok: false, error: "CONFLICT", message: "Die Mengenpräzision wird vom aktuell bestätigten Datenbankschema nicht unterstützt." };
    }
    if (code === "ITEM_NOT_FOUND") return { ok: false, error: "EMPTY_RESULT", message: "Lagerartikel wurde nicht gefunden." };
    if (code === "ORDER_NOT_FOUND") return { ok: false, error: "EMPTY_RESULT", message: "Auftrag wurde nicht gefunden." };
    if (code === "UNIT_NOT_CONFIGURED") {
      return { ok: false, error: "CONFLICT", message: "Für diesen Lagerartikel ist keine Einheit hinterlegt. Die Buchung wurde nicht ausgeführt." };
    }
    if (code === "INSUFFICIENT_STOCK") return { ok: false, error: "UNKNOWN", message: "Die Buchung würde einen negativen Bestand erzeugen." };
    if (code === "INVALID_INVENTORY_DATA") {
      return { ok: false, error: "DB_ERROR", message: "Der bestätigte Lagerbestand ist ungültig; die Buchung wurde nicht ausgeführt." };
    }
    if (code === "REQUEST_CONFLICT") {
      return { ok: false, error: "CONFLICT", message: "Diese Anfrage-ID wurde bereits für eine andere Lagerbuchung verwendet." };
    }
    console.error("Inventory movement create failed", error);
    return { ok: false, error: "DB_ERROR", message: "Lagerbuchung konnte nicht gespeichert werden." };
  }
}
