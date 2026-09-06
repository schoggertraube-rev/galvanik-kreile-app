import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCheckAppAuthorization = vi.fn();
const mockDbSelect = vi.fn();
const mockDbTransaction = vi.fn();
const mockTxSelect = vi.fn();
const mockTxInsert = vi.fn();
const mockTxUpdate = vi.fn();
const mockTxValues = vi.fn();
const mockTxSet = vi.fn();
const mockRevalidatePath = vi.fn();
const mockEq = vi.fn((column: unknown, value: unknown) => ({ column, value }));
const mockDesc = vi.fn((column: unknown) => column);

vi.mock("@/db", () => ({
  db: { select: mockDbSelect, transaction: mockDbTransaction },
}));
vi.mock("@/db/schema", () => ({
  appUsers: { id: "app_users.id", fullName: "app_users.full_name" },
  inventoryItems: {
    id: "inventory_items.id", tenantId: "inventory_items.tenant_id", name: "inventory_items.name",
    category: "inventory_items.category", currentStock: "inventory_items.current_stock",
    minStock: "inventory_items.min_stock", unit: "inventory_items.unit",
    einkaufspreisEur: "inventory_items.einkaufspreis_eur", einheitNormiert: "inventory_items.einheit_normiert",
  },
  stockMovements: {},
}));
vi.mock("@/lib/server/authHelper", () => ({ checkAppAuthorization: mockCheckAppAuthorization }));
vi.mock("drizzle-orm", () => ({ and: vi.fn(), desc: mockDesc, eq: mockEq }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

const authorization = {
  ok: true as const,
  data: { userId: "user-1", tenantId: KREILE_TENANT_SLUG, displayName: "Max Kreile", role: "meister" as const, permissions: [], active: true as const },
};

function inventoryRow() {
  return { id: "test-inv-123", tenantId: KREILE_TENANT_SLUG, name: "Testartikel", category: null, currentStock: 10, minStock: 2, unit: "pcs", einkaufspreisEur: "2.50", einheitNormiert: null };
}

describe("inventory actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAppAuthorization.mockResolvedValue(authorization);
  });

  it("fails closed before querying inventory without a valid session", async () => {
    mockCheckAppAuthorization.mockResolvedValue({ ok: false, error: "UNAUTHORIZED", message: "Nicht angemeldet" });
    const { getInventoryItemsAction } = await import("@/app/actions/inventory.actions");
    await expect(getInventoryItemsAction()).resolves.toEqual({ ok: false, error: "UNAUTHORIZED", message: "Nicht angemeldet" });
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it("reads only the authorized tenant and does not invent missing SKU/location fields", async () => {
    const orderBy = vi.fn().mockResolvedValue([inventoryRow()]);
    const where = vi.fn(() => ({ orderBy }));
    mockDbSelect.mockReturnValue({ from: vi.fn(() => ({ where })) });
    const { getInventoryItemsAction } = await import("@/app/actions/inventory.actions");
    await expect(getInventoryItemsAction()).resolves.toEqual({ ok: true, data: [{ id: "test-inv-123", name: "Testartikel", category: "uncategorized", unit: "pcs", currentStock: 10, minStock: 2, isConsumable: true, pricePerUnit: 2.5 }] });
    expect(mockEq).toHaveBeenCalledWith("inventory_items.tenant_id", KREILE_TENANT_SLUG);
  });

  it("denies every inventory movement before authorization or a write port", async () => {
    const { createInventoryMovementAction } = await import("@/app/actions/inventory.actions");
    await expect(createInventoryMovementAction({ inventoryItemId: "test-inv-123", movementType: "stock_in", quantity: 1 })).resolves.toEqual({ ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Sicherer W3-Lagerbewegungs-Command-Vertrag fehlt." });
    expect(mockCheckAppAuthorization).not.toHaveBeenCalled();
    expect(mockDbTransaction).not.toHaveBeenCalled();
    expect(mockTxSelect).not.toHaveBeenCalled();
    expect(mockTxInsert).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxValues).not.toHaveBeenCalled();
    expect(mockTxSet).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("keeps the writer body free of authorization, database, clock, and UUID ports", async () => {
    const source = await readFile(resolve(process.cwd(), "src/app/actions/inventory.actions.ts"), "utf8");
    const body = source.slice(source.indexOf("export async function createInventoryMovementAction"));
    expect(body).not.toMatch(/checkAppAuthorization|validateMovementInput|db\.|transaction|\.select\(|\.insert\(|\.update\(|revalidatePath|console\.|randomUUID|new Date/);
    expect(body).toContain('error: "CONFLICT"');
    expect(body).toContain('message: "NOT_AVAILABLE: Sicherer W3-Lagerbewegungs-Command-Vertrag fehlt."');
  });
});
