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
const disabledAttribute = /\sdisabled(?:\s|\/?>)/;

function jsxOpeningTags(source: string, tagName: string): string[] {
  return [...source.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "g"))].map(([openingTag]) => openingTag);
}

function expectDisabled(openingTag: string | undefined, control: string): void {
  expect(openingTag, `${control} opening tag`).toBeDefined();
  expect(openingTag).toMatch(disabledAttribute);
}

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

  it("preserves read UI while disabling every visible movement control", async () => {
    const source = await readFile(resolve(process.cwd(), "src/app/items/page.tsx"), "utf8");
    expect(source).toContain("inventoryRepository.getAllItems()");
    expect(source).toContain("inventoryRepository.getAllMovements()");
    expect(source).not.toMatch(/inventoryRepository\.createMovement|handleQuickAdjust|handleDetailedBooking/);
    expect(source).toContain("NOT_AVAILABLE: Lagerbuchungen sind bis zum sicheren W3-Command-Vertrag deaktiviert.");

    const buttonTags = jsxOpeningTags(source, "Button");
    const nativeButtonTags = jsxOpeningTags(source, "button");
    const inputTags = jsxOpeningTags(source, "input");
    const inputComponentTags = jsxOpeningTags(source, "Input");

    const quickAdjustTags = buttonTags.filter((tag) => tag.includes('size="icon"') && tag.includes('className="h-9 w-9'));
    expect(quickAdjustTags).toHaveLength(2);
    expectDisabled(quickAdjustTags[0], "Quick Minus Button");
    expectDisabled(quickAdjustTags[1], "Quick Plus Button");

    expectDisabled(
      nativeButtonTags.find((tag) => tag.includes('type="button"') && tag.includes('bg-white text-navy-900 shadow-sm')),
      "Stock-In direction button",
    );
    expectDisabled(
      nativeButtonTags.find((tag) => tag.includes('type="button"') && tag.includes('text-text-muted bg-transparent')),
      "Stock-Out direction button",
    );

    const quantityButtonTags = buttonTags.filter((tag) => tag.includes('type="button"') && tag.includes('size="icon"') && tag.includes('className="h-8 w-8'));
    expect(quantityButtonTags).toHaveLength(2);
    expectDisabled(quantityButtonTags[0], "quantity minus Button");
    expectDisabled(quantityButtonTags[1], "quantity plus Button");

    expectDisabled(inputTags.find((tag) => tag.includes('type="number"') && tag.includes('min="1"')), "quantity input");
    expectDisabled(inputComponentTags.find((tag) => tag.includes('placeholder="z.B. Lieferung Fa. BASF, Materialbruch etc."')), "reason Input");
    expectDisabled(buttonTags.find((tag) => tag.includes('type="submit"')), "submit Button");
  });
});
