import {
  createLagerBewegungAction,
  getLagerbestandAction,
  getLagerBewegungenAction,
} from "@/app/lager/actions";

export interface InventoryItem {
  id: string;
  sku: string | null;
  name: string;
  category: "chemical" | "consumable" | "tooling" | "packaging" | "other" | "unknown";
  unit: string | null;
  currentStock: number;
  minStock: number | null;
  lastStockInAt: string | null;
  storageLocation: string | null;
  isConsumable: boolean;
  isHazardous: boolean | null;
  pricePerUnit: number | null;
}

export interface InventoryCapabilities {
  canWrite: boolean;
  writeReason: string | null;
  historyLimit: number;
  quantityDecimals: number;
  quantityStep: number;
}

export interface InventorySnapshot {
  items: InventoryItem[];
  capabilities: InventoryCapabilities;
}

export interface InventoryMovementHistory {
  movements: StockMovement[];
  truncated: boolean;
  limit: number;
  unitContext: "current_inventory_item";
}

export class InventoryRepositoryError extends Error {
  constructor(
    public readonly actionCode: string,
    message: string,
  ) {
    super(message);
    this.name = "InventoryRepositoryError";
  }
}

export interface StockMovement {
  id: string;
  inventoryItemId: string;
  movementType: "stock_in" | "stock_out" | "consumption" | "correction" | "waste";
  quantity: number;
  unit: string | null;
  orderId?: string;
  reason?: string;
  createdBy: string;
  createdAt: string | null;
  replayed?: boolean;
}

function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: string; message: string }): T {
  if (!result.ok) throw new InventoryRepositoryError(result.error, result.message);
  return result.data;
}

export const inventoryRepository = {
  async getSnapshot(): Promise<InventorySnapshot> {
    return unwrap(await getLagerbestandAction());
  },

  async getAllItems(): Promise<InventoryItem[]> {
    return (await this.getSnapshot()).items;
  },

  async getMovementsByItem(inventoryItemId: string): Promise<InventoryMovementHistory> {
    return unwrap(await getLagerBewegungenAction(inventoryItemId));
  },

  async createMovement(
    data: Omit<StockMovement, "id" | "createdAt" | "createdBy" | "unit" | "replayed"> & {
      clientRequestId: string;
    },
  ): Promise<StockMovement> {
    return unwrap(await createLagerBewegungAction({
      clientRequestId: data.clientRequestId,
      inventoryItemId: data.inventoryItemId,
      movementType: data.movementType,
      quantity: data.quantity,
      ...(data.orderId ? { orderId: data.orderId } : {}),
      ...(data.reason ? { reason: data.reason } : {}),
    }));
  },

  async hasCriticalStock(): Promise<boolean> {
    const items = await this.getAllItems();
    return items.some(item => item.minStock !== null && item.currentStock < item.minStock);
  }
};
