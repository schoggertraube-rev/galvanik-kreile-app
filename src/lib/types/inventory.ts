export type InventoryCategory =
  | "chemical"
  | "consumable"
  | "tooling"
  | "packaging"
  | "uncategorized";

export interface InventoryItem {
  id: string;
  sku?: string;
  name: string;
  category: InventoryCategory;
  unit: string;
  currentStock: number;
  minStock: number;
  storageLocation?: string;
  isConsumable: boolean;
  isHazardous?: boolean;
  pricePerUnit?: number;
}

export type StockMovementType =
  | "stock_in"
  | "stock_out"
  | "consumption"
  | "correction"
  | "waste";

export interface StockMovement {
  id: string;
  inventoryItemId: string;
  movementType: StockMovementType;
  quantity: number;
  unit: string;
  orderId?: string;
  reason?: string;
  createdBy: string;
  createdAt: string;
}

export type CreateStockMovementInput = {
  inventoryItemId: string;
  movementType: StockMovementType;
  quantity: number;
  orderId?: string;
  reason?: string;
};
