import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/inventory.actions", () => ({
  getInventoryItemAction: vi.fn(),
  getInventoryItemsAction: vi.fn(),
  getInventoryMovementsAction: vi.fn(),
  getInventoryMovementsByItemAction: vi.fn(),
}));
import { inventoryRepository } from "@/lib/repositories/inventoryRepository";

const notAvailable = "NOT_AVAILABLE: Sicherer W3-Lagerbewegungs-Command-Vertrag fehlt.";

describe("W2C-B2M5B inventory movement quarantine", () => {
  it("rejects the repository writer with the W3 contract denial", async () => {
    await expect(inventoryRepository.createMovement({ inventoryItemId: "item-1", movementType: "stock_in", quantity: 1 })).rejects.toThrow(notAvailable);
  });

  it("keeps the repository read ports and removes every writer bridge or side effect", async () => {
    const source = await readFile(resolve(process.cwd(), "src/lib/repositories/inventoryRepository.ts"), "utf8");
    const body = source.slice(source.indexOf("async createMovement"), source.indexOf("async hasCriticalStock"));
    expect(source).toContain("getInventoryItemsAction");
    expect(source).toContain("getInventoryMovementsAction");
    expect(source).toContain("async getAllItems");
    expect(source).toContain("async getAllMovements");
    expect(source).not.toContain("createInventoryMovementAction");
    expect(body).not.toMatch(/createInventoryMovementAction|window|Event|dispatch|cache/);
    expect(body).toContain(`throw new Error("${notAvailable}")`);
  });

  it("keeps the removed standalone inventory route absent", async () => {
    await expect(readFile(resolve(process.cwd(), "src/app/items/page.tsx"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
