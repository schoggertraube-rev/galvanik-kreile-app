import type { InventoryItem } from "@/lib/repositories/inventoryRepository";

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1_000;

export type InventorySummary = {
  criticalItems: InventoryItem[];
  chemicalItems: InventoryItem[];
  packagingItems: InventoryItem[];
  recentStockInItems: InventoryItem[];
  itemsWithoutMinStock: InventoryItem[];
};

export function summarizeInventory(items: readonly InventoryItem[], nowMs = Date.now()): InventorySummary {
  return {
    criticalItems: items.filter((item) => item.minStock !== null && item.currentStock < item.minStock),
    chemicalItems: items.filter((item) => item.category === "chemical"),
    packagingItems: items.filter((item) => item.category === "packaging"),
    itemsWithoutMinStock: items.filter((item) => item.minStock === null),
    recentStockInItems: items.filter((item) => {
      if (!item.lastStockInAt) return false;
      const occurredAt = Date.parse(item.lastStockInAt);
      return Number.isFinite(occurredAt) && occurredAt <= nowMs && occurredAt >= nowMs - FIVE_DAYS_MS;
    }),
  };
}
