"use server";

import { db } from "@/db";
import {
  appUsers,
  inventoryItems,
  stockMovements,
} from "@/db/schema";
import type {ActionResult} from "@/lib/server/authHelper";
import {resolveAuthorization,hasAuthorizationArea} from "@/lib/server/authorization";
import {LEGACY_ACTION_ACCESS_COPY} from "@/ui/situationCatalog";
import type {
  CreateStockMovementInput,
  InventoryCategory,
  InventoryItem,
  StockMovement,
  StockMovementType,
} from "@/lib/types/inventory";
import { and, desc, eq, type InferSelectModel } from "drizzle-orm";

type InventoryRow = InferSelectModel<typeof inventoryItems>;

type MovementRow = {
  id: string;
  inventoryItemId: string;
  movementType: string;
  quantity: string;
  unit: string | null;
  normalizedUnit: string | null;
  orderId: string | null;
  reason: string | null;
  createdBy: string | null;
  createdAt: Date | null;
};

const MOVEMENT_TYPES = new Set<StockMovementType>([
  "stock_in",
  "stock_out",
  "consumption",
  "correction",
  "waste",
]);

class InventoryDomainError extends Error {
  constructor(
    readonly code: "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT",
    message: string,
  ) {
    super(message);
  }
}

function toCategory(value: string | null): InventoryCategory {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "chemical" || normalized === "chemie") return "chemical";
  if (normalized === "consumable" || normalized === "verbrauch") return "consumable";
  if (normalized === "tooling" || normalized === "werkzeug") return "tooling";
  if (normalized === "packaging" || normalized === "verpackung") return "packaging";

  return "uncategorized";
}

function toFiniteNumber(value: string | number | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toInventoryItem(row: InventoryRow,showPrices:boolean): InventoryItem {
  const category = toCategory(row.category);

  return {
    id: row.id,
    name: row.name,
    category,
    unit: row.unit ?? row.einheitNormiert ?? "Stk.",
    currentStock: row.currentStock ?? 0,
    minStock: row.minStock ?? 0,
    isConsumable: category !== "tooling",
    pricePerUnit: showPrices?toFiniteNumber(row.einkaufspreisEur):undefined,
  };
}

function toMovementType(value: string): StockMovementType {
  if (MOVEMENT_TYPES.has(value as StockMovementType)) {
    return value as StockMovementType;
  }

  throw new InventoryDomainError(
    "VALIDATION_ERROR",
    `Unbekannter Lagerbewegungstyp: ${value}`,
  );
}

function toStockMovement(row: MovementRow): StockMovement {
  return {
    id: row.id,
    inventoryItemId: row.inventoryItemId,
    movementType: toMovementType(row.movementType),
    quantity: Number(row.quantity),
    unit: row.unit ?? row.normalizedUnit ?? "Stk.",
    orderId: row.orderId ?? undefined,
    reason: row.reason ?? undefined,
    createdBy: row.createdBy ?? "System",
    createdAt: row.createdAt?.toISOString() ?? "",
  };
}

function validateIdentifier(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 128 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw new InventoryDomainError(
      "VALIDATION_ERROR",
      `${field} ist ungültig.`,
    );
  }

  return value;
}

function movementSelection() {
  return {
    id: stockMovements.id,
    inventoryItemId: stockMovements.inventoryItemId,
    movementType: stockMovements.movementType,
    quantity: stockMovements.quantity,
    unit: inventoryItems.unit,
    normalizedUnit: inventoryItems.einheitNormiert,
    orderId: stockMovements.orderId,
    reason: stockMovements.reason,
    createdBy: appUsers.fullName,
    createdAt: stockMovements.createdAt,
  };
}

function databaseFailure<T>(message: string, error: unknown): ActionResult<T> {
  console.error(message, error);
  return {
    ok: false,
    error: "DB_ERROR",
    message: "Lagerdaten sind derzeit nicht verfügbar.",
  };
}

export async function getInventoryItemsAction(): Promise<ActionResult<InventoryItem[]>> {
  const auth = await resolveAuthorization();
  if (!auth.ok) return {ok:false,error:"UNAUTHORIZED",message:auth.message};
  if (!hasAuthorizationArea(auth.data,"auftraege")) return {ok:false,error:"FORBIDDEN",message:LEGACY_ACTION_ACCESS_COPY.forbidden};

  try {
    const rows = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.tenantId, auth.data.tenantId))
      .orderBy(inventoryItems.name);

    return { ok: true, data: rows.map(row=>toInventoryItem(row,hasAuthorizationArea(auth.data,"geld"))) };
  } catch (error) {
    return databaseFailure("getInventoryItemsAction failed:", error);
  }
}

export async function getInventoryMovementsAction(): Promise<ActionResult<StockMovement[]>> {
  const auth = await resolveAuthorization();
  if (!auth.ok) return {ok:false,error:"UNAUTHORIZED",message:auth.message};
  if (!hasAuthorizationArea(auth.data,"auftraege")) return {ok:false,error:"FORBIDDEN",message:LEGACY_ACTION_ACCESS_COPY.forbidden};

  try {
    const rows = await db
      .select(movementSelection())
      .from(stockMovements)
      .leftJoin(
        inventoryItems,
        and(eq(inventoryItems.id, stockMovements.inventoryItemId),eq(inventoryItems.tenantId,auth.data.tenantId)),
      )
      .leftJoin(appUsers, and(eq(appUsers.id, stockMovements.erfasstVon),eq(appUsers.tenantId,auth.data.tenantId)))
      .where(eq(stockMovements.tenantId, auth.data.tenantId))
      .orderBy(desc(stockMovements.createdAt));

    return { ok: true, data: rows.map(toStockMovement) };
  } catch (error) {
    return databaseFailure("getInventoryMovementsAction failed:", error);
  }
}

export async function getInventoryItemAction(
  rawId: string,
): Promise<ActionResult<InventoryItem | null>> {
  const auth = await resolveAuthorization();
  if (!auth.ok) return {ok:false,error:"UNAUTHORIZED",message:auth.message};
  if (!hasAuthorizationArea(auth.data,"auftraege")) return {ok:false,error:"FORBIDDEN",message:LEGACY_ACTION_ACCESS_COPY.forbidden};

  let id: string;
  try {
    id = validateIdentifier(rawId, "Artikel-ID");
  } catch (error) {
    if (error instanceof InventoryDomainError) {
      return { ok: false, error: error.code, message: error.message };
    }
    throw error;
  }

  try {
    const [row] = await db
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.id, id),
          eq(inventoryItems.tenantId, auth.data.tenantId),
        ),
      )
      .limit(1);

    return { ok: true, data: row ? toInventoryItem(row,hasAuthorizationArea(auth.data,"geld")) : null };
  } catch (error) {
    return databaseFailure("getInventoryItemAction failed:", error);
  }
}

export async function getInventoryMovementsByItemAction(
  rawInventoryItemId: string,
): Promise<ActionResult<StockMovement[]>> {
  const auth = await resolveAuthorization();
  if (!auth.ok) return {ok:false,error:"UNAUTHORIZED",message:auth.message};
  if (!hasAuthorizationArea(auth.data,"auftraege")) return {ok:false,error:"FORBIDDEN",message:LEGACY_ACTION_ACCESS_COPY.forbidden};

  let inventoryItemId: string;
  try {
    inventoryItemId = validateIdentifier(rawInventoryItemId, "Artikel-ID");
  } catch (error) {
    if (error instanceof InventoryDomainError) {
      return { ok: false, error: error.code, message: error.message };
    }
    throw error;
  }

  try {
    const rows = await db
      .select(movementSelection())
      .from(stockMovements)
      .leftJoin(
        inventoryItems,
        and(eq(inventoryItems.id, stockMovements.inventoryItemId),eq(inventoryItems.tenantId,auth.data.tenantId)),
      )
      .leftJoin(appUsers, and(eq(appUsers.id, stockMovements.erfasstVon),eq(appUsers.tenantId,auth.data.tenantId)))
      .where(
        and(
          eq(stockMovements.tenantId, auth.data.tenantId),
          eq(stockMovements.inventoryItemId, inventoryItemId),
        ),
      )
      .orderBy(desc(stockMovements.createdAt));

    return { ok: true, data: rows.map(toStockMovement) };
  } catch (error) {
    return databaseFailure("getInventoryMovementsByItemAction failed:", error);
  }
}

export async function createInventoryMovementAction(
  rawInput: CreateStockMovementInput,
): Promise<ActionResult<StockMovement>> {
  void rawInput;
  return {
    ok: false,
    error: "CONFLICT",
    message: "NOT_AVAILABLE: Sicherer W3-Lagerbewegungs-Command-Vertrag fehlt.",
  };
}
