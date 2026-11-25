import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { LAGER_BUCHUNG_COPY } from "@/ui/lagerBuchungCopy";

const ports = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  transaktion: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/lib/server/authorization", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/server/authorization")>(),
  resolveAuthorization: ports.resolveAuthorization,
}));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/server/privilegedDb", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/server/privilegedDb")>(),
  withPrivilegedTenantTransaction: ports.transaktion,
}));

import { createInventoryMovementAction, getInventoryItemAction, getInventoryItemsAction } from "@/app/actions/inventory.actions";

const leser = {
  active: true, userId: "00000000-0000-4000-8000-000000000001", tenantId: "TEST-Mandant",
  role: "readonly", displayName: "TEST Leser", permissions: [], packageSwitches: { p4_lager: true },
} as const;

describe("Lageranschluss der bisherigen Inventory-Actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    ports.resolveAuthorization.mockResolvedValue({ ok: true, data: leser });
    ports.transaktion.mockImplementation(async (_auth, work) => work({ execute: ports.execute }));
  });

  it("lehnt ohne Sitzung ab, bevor der Lagerleser eine Datenbankabfrage öffnet", async () => {
    ports.resolveAuthorization.mockResolvedValue({ ok: false, error: "UNAUTHORIZED" });
    await expect(getInventoryItemsAction()).resolves.toEqual({
      ok: false, error: "UNAUTHORIZED", message: LAGER_BUCHUNG_COPY.sitzung,
    });
    expect(ports.transaktion).not.toHaveBeenCalled();
  });

  it("belässt unbekannten Bestand bei null und gibt für Leser keine Preise aus", async () => {
    ports.execute.mockResolvedValue([{
      id: "TEST-Artikel", name: "TEST Artikel", category: "chemical",
      currentStock: null, availableStock: null, unit: "kg", minStock: 2, pricePerUnit: null,
    }]);
    await expect(getInventoryItemAction("TEST-Artikel")).resolves.toMatchObject({
      ok: true, data: { id: "TEST-Artikel", currentStock: null, availableStock: null },
    });
    const liste = await getInventoryItemsAction();
    if (!liste.ok) throw Error("TEST_ARTIKEL_FEHLT");
    expect(liste.data[0]).not.toHaveProperty("pricePerUnit");
    expect(ports.transaktion).toHaveBeenCalledWith(leser, expect.any(Function));
  });

  it("erlaubt einem Leser keine Buchung und führt keinen Lagerzugriff aus", async () => {
    await expect(createInventoryMovementAction({
      inventoryItemId: "TEST-Artikel", befehlId: "00000000-0000-4000-8000-000000000001",
      movementType: "stock_in", quantity: "17.125", einheit: "kg",
      ortId: "00000000-0000-4000-8000-000000000002", fachzeit: "2026-11-25T08:00:00.000Z",
      revision: 1, mengenqualitaet: "exakt", geschaeftsgrund: "wareneingang",
    })).resolves.toEqual({ ok: false, error: "FORBIDDEN", message: LAGER_BUCHUNG_COPY.recht });
    expect(ports.transaktion).not.toHaveBeenCalled();
  });

  it("bindet alle Inventory-Actions an die vorhandene Protokollierung", async () => {
    const source = await readFile("src/app/actions/inventory.actions.ts", "utf8");
    for (const name of [
      "getInventoryItemsAction", "getInventoryMovementsAction", "getInventoryItemAction",
      "getInventoryMovementsByItemAction", "createInventoryMovementAction",
    ]) {
      expect(source).toContain('observeAction("' + name + '", subjectForAction("' + name + '",');
    }
    expect(source).not.toMatch(/console\.|JSON\.stringify\(/);
  });
});
