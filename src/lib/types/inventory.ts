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
  currentStock: number | null;
  availableStock?: number | null;
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
  | "waste"
  | "opening"
  | "move"
  | "count_correction"
  | "reversal"
  | "observation";

export interface StockMovement {
  id: string;
  inventoryItemId: string;
  movementType: StockMovementType;
  quantity: number | null;
  unit: string;
  orderId?: string;
  reason?: string;
  createdBy: string;
  createdAt: string;
  fachzeit?: string;
  kalk_ek?: number | null;
  aufschlag_pct?: number | null;
  snapshot_einkaufspreis_eur?: number | null;
}

export type CreateStockMovementInput = {
  befehlId: string;
  inventoryItemId: string;
  movementType: "stock_in" | "stock_out" | "consumption" | "waste" | "move";
  quantity: number | string;
  einheit: string;
  ortId: string;
  fachzeit: string;
  revision: number;
  mengenqualitaet: "exakt" | "geschaetzt";
  geschaeftsgrund: string;
  orderId?: string;
  reason?: string;
  belegId?: string;
  originalDateiId?: string;
  kostenstelle?: string;
  werkstattOrtId?: string;
  zielOrtId?: string;
  imPreisEnthalten?: boolean;
  badProzessOrtId?: string;
  mehrarbeitBelegId?: string;
};
