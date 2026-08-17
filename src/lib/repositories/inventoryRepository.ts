import {
  getInventoryItemAction,
  getInventoryItemsAction,
  getInventoryMovementsAction,
  getInventoryMovementsByItemAction,
} from "@/app/actions/inventory.actions";
import type {
  CreateStockMovementInput,
  InventoryItem,
  StockMovement,
} from "@/lib/types/inventory";

export type {
  CreateStockMovementInput,
  InventoryCategory,
  InventoryItem,
  StockMovement,
  StockMovementType,
} from "@/lib/types/inventory";

function unwrap<T>(result: { ok: true; data: T } | { ok: false; message: string }): T {
  if (!result.ok) {
    throw new Error(result.message);
  }

  return result.data;
}

export const inventoryRepository = {
  async getAllItems(): Promise<InventoryItem[]> {
    return unwrap(await getInventoryItemsAction());
  },

  async getAllMovements(): Promise<StockMovement[]> {
    return unwrap(await getInventoryMovementsAction());
  },

  async getItemById(id: string): Promise<InventoryItem | null> {
    return unwrap(await getInventoryItemAction(id));
  },

  async getMovementsByItem(inventoryItemId: string): Promise<StockMovement[]> {
    return unwrap(await getInventoryMovementsByItemAction(inventoryItemId));
  },

  async createMovement(data: CreateStockMovementInput): Promise<StockMovement> {
    void data;
    throw new Error("NOT_AVAILABLE: Sicherer W3-Lagerbewegungs-Command-Vertrag fehlt.");
  },

  async hasCriticalStock(): Promise<boolean> {
    const items = await this.getAllItems();
    return items.some((item) => item.currentStock < item.minStock);
  },
};
