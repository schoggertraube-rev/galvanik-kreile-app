import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateStockMovementInput } from "@/lib/types/inventory";

vi.mock("@/app/actions/inventory.actions", () => ({
  createInventoryMovementAction: vi.fn(),
  getInventoryItemsAction: vi.fn(),
  getInventoryMovementsAction: vi.fn(),
}));
import { createInventoryMovementAction, getInventoryItemsAction, getInventoryMovementsAction } from "@/app/actions/inventory.actions";
import { inventoryRepository } from "@/lib/repositories/inventoryRepository";

const eingabe: CreateStockMovementInput = {
  inventoryItemId: "TEST-Artikel", befehlId: "00000000-0000-4000-8000-000000000001",
  movementType: "stock_in", quantity: 1, einheit: "stk",
  ortId: "00000000-0000-4000-8000-000000000002", fachzeit: "2026-11-25T08:00:00.000Z",
  revision: 1, mengenqualitaet: "exakt", geschaeftsgrund: "wareneingang",
};

describe("Lagerbuchung über InventoryRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("liest alle Bewegungen über den vorhandenen Bewegungsleser", async () => {
    const bewegungen = [{
      id: "TEST-Bewegung", inventoryItemId: eingabe.inventoryItemId, movementType: eingabe.movementType,
      quantity: 1, unit: eingabe.einheit, createdAt: eingabe.fachzeit, createdBy: "TEST Lager",
    }];
    vi.mocked(getInventoryMovementsAction).mockResolvedValueOnce({ ok: true, data: bewegungen });

    await expect(inventoryRepository.getAllMovements()).resolves.toBe(bewegungen);
    expect(getInventoryMovementsAction).toHaveBeenCalledExactlyOnceWith();
  });

  it("reicht die Buchung unverändert weiter und gibt eine Ablehnung an den Aufrufer", async () => {
    vi.mocked(createInventoryMovementAction).mockResolvedValueOnce({
      ok: false, error: "FORBIDDEN", message: "TEST Lagerrecht fehlt",
    });
    await expect(inventoryRepository.createMovement(eingabe)).rejects.toThrow("TEST Lagerrecht fehlt");
    expect(createInventoryMovementAction).toHaveBeenCalledExactlyOnceWith(eingabe);
  });

  it("führt beim Buchen ausschließlich den Lageraufruf aus", () => {
    const quelle = readFileSync(resolve(process.cwd(), "src/lib/repositories/inventoryRepository.ts"), "utf8");
    const methode = quelle.slice(quelle.indexOf("async createMovement"), quelle.indexOf("async hasCriticalStock"));

    expect(methode.trim()).toMatch(/^async createMovement\(data: CreateStockMovementInput\): Promise<StockMovement> \{\s*return unwrap\(await createInventoryMovementAction\(data\)\);\s*\},$/u);
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
