import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@/lib/repositories/inventoryRepository";
import { summarizeInventory } from "./inventorySummary";

const NOW = Date.parse("2026-07-20T12:00:00.000Z");

function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "item-1",
    sku: "SKU-1",
    name: "Nickelsalz",
    category: "chemical",
    unit: "kg",
    currentStock: 5,
    minStock: 10,
    lastStockInAt: "2026-07-18T12:00:00.000Z",
    storageLocation: null,
    isConsumable: true,
    isHazardous: null,
    pricePerUnit: null,
    ...overrides,
  };
}

describe("inventory presentation truth", () => {
  it("uses canonical categories and treats only stock below the minimum as critical", () => {
    const summary = summarizeInventory([
      item(),
      item({ id: "equal", currentStock: 10, minStock: 10 }),
      item({ id: "package", category: "packaging" }),
    ], NOW);

    expect(summary.criticalItems.map((entry) => entry.id)).toEqual(["item-1", "package"]);
    expect(summary.chemicalItems.map((entry) => entry.id)).toEqual(["item-1", "equal"]);
    expect(summary.packagingItems.map((entry) => entry.id)).toEqual(["package"]);
  });

  it("counts only confirmed stock-in timestamps from the preceding five days", () => {
    const summary = summarizeInventory([
      item(),
      item({ id: "old", lastStockInAt: "2026-07-14T11:59:59.000Z" }),
      item({ id: "future", lastStockInAt: "2026-07-20T12:00:01.000Z" }),
      item({ id: "unknown", lastStockInAt: null }),
    ], NOW);

    expect(summary.recentStockInItems.map((entry) => entry.id)).toEqual(["item-1"]);
  });

  it("reports missing minimum thresholds separately from stable stock", () => {
    const summary = summarizeInventory([
      item({ id: "unknown-minimum", minStock: null }),
      item({ id: "stable", currentStock: 15, minStock: 10 }),
    ], NOW);

    expect(summary.criticalItems).toEqual([]);
    expect(summary.itemsWithoutMinStock.map((entry) => entry.id)).toEqual(["unknown-minimum"]);
  });
});
