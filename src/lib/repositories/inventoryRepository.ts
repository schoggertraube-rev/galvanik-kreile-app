import {
  createLagerBewegungAction,
  getLagerArtikelAction,
  getLagerbestandAction,
  getLagerBewegungenAction,
} from "@/app/lager/actions";

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: "chemical" | "consumable" | "tooling" | "packaging" | "other";
  unit: string;
  currentStock: number;
  minStock: number;
  storageLocation?: string;
  isConsumable: boolean;
  isHazardous?: boolean;
  pricePerUnit?: number;
}

export interface StockMovement {
  id: string;
  inventoryItemId: string;
  movementType: "stock_in" | "stock_out" | "consumption" | "correction" | "waste";
  quantity: number;
  unit: string;
  orderId?: string;
  reason?: string;
  createdBy: string;
  createdAt: string | null;
}

function unwrap<T>(result: { ok: true; data: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(`DATA_ERROR: ${result.message}`);
  return result.data;
}

export const inventoryRepository = {
  async getAllItems(): Promise<InventoryItem[]> {
    return unwrap(await getLagerbestandAction());
  },

  async getAllMovements(): Promise<StockMovement[]> {
    return unwrap(await getLagerBewegungenAction());
  },

  async getItemById(id: string): Promise<InventoryItem | null> {
    return unwrap(await getLagerArtikelAction(id));
  },

  async getMovementsByItem(inventoryItemId: string): Promise<StockMovement[]> {
    return unwrap(await getLagerBewegungenAction(inventoryItemId));
  },

  async createMovement(
    data: Omit<StockMovement, "id" | "createdAt" | "createdBy" | "unit"> & { unit?: string },
  ): Promise<StockMovement> {
    return unwrap(await createLagerBewegungAction({
      inventoryItemId: data.inventoryItemId,
      movementType: data.movementType,
      quantity: data.quantity,
      ...(data.orderId ? { orderId: data.orderId } : {}),
      ...(data.reason ? { reason: data.reason } : {}),
    }));
  },

  async hasCriticalStock(): Promise<boolean> {
    const items = await this.getAllItems();
    return items.some(item => item.currentStock < item.minStock);
  }
};
