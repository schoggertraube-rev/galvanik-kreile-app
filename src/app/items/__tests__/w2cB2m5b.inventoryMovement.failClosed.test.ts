import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { CreateStockMovementInput } from "@/lib/types/inventory";

vi.mock("@/app/actions/inventory.actions", () => ({
  createInventoryMovementAction: vi.fn(),
  getInventoryItemsAction: vi.fn(),
}));
import { createInventoryMovementAction, getInventoryItemsAction } from "@/app/actions/inventory.actions";
import { inventoryRepository } from "@/lib/repositories/inventoryRepository";

const eingabe: CreateStockMovementInput = {
  inventoryItemId: "TEST-Artikel", befehlId: "00000000-0000-4000-8000-000000000001",
  movementType: "stock_in", quantity: 1, einheit: "stk",
  ortId: "00000000-0000-4000-8000-000000000002", fachzeit: "2026-11-25T08:00:00.000Z",
  revision: 1, mengenqualitaet: "exakt", geschaeftsgrund: "wareneingang",
};

describe("Lagerbuchung über InventoryRepository", () => {
  it("reicht die Buchung unverändert weiter und gibt eine Ablehnung an den Aufrufer", async () => {
    vi.mocked(createInventoryMovementAction).mockResolvedValueOnce({
      ok: false, error: "FORBIDDEN", message: "TEST Lagerrecht fehlt",
    });
    await expect(inventoryRepository.createMovement(eingabe)).rejects.toThrow("TEST Lagerrecht fehlt");
    expect(createInventoryMovementAction).toHaveBeenCalledExactlyOnceWith(eingabe);
  });

  it("unterscheidet unbekannten Bestand vom bekannten Nullbestand", async () => {
    const artikel = {
      id: "TEST-Artikel", name: "TEST Artikel", category: "uncategorized" as const,
      unit: "stk", minStock: 1, isConsumable: true,
    };
    vi.mocked(getInventoryItemsAction)
      .mockResolvedValueOnce({ ok: true, data: [{ ...artikel, currentStock: null }] })
      .mockResolvedValueOnce({ ok: true, data: [{ ...artikel, currentStock: 0 }] });
    await expect(inventoryRepository.hasCriticalStock()).resolves.toBe(false);
    await expect(inventoryRepository.hasCriticalStock()).resolves.toBe(true);
  });

  it("lässt die ausgemusterte eigenständige Lagerseite entfernt", () => {
    expect(existsSync(resolve(process.cwd(), "src/app/items/page.tsx"))).toBe(false);
  });
});
