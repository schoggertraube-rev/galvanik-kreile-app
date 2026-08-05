import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCheckAppAuthorization = vi.fn();
const mockDbSelect = vi.fn();
const mockDbTransaction = vi.fn();
const mockTxSelect = vi.fn();
const mockTxInsert = vi.fn();
const mockTxUpdate = vi.fn();
const mockTxValues = vi.fn();
const mockTxSet = vi.fn();
const mockTxUpdateWhere = vi.fn();
const mockTxFor = vi.fn();
const mockRevalidatePath = vi.fn();
const mockAnd = vi.fn((...conditions: unknown[]) => conditions);
const mockEq = vi.fn((column: unknown, value: unknown) => ({
  kind: "eq",
  column,
  value,
}));
const mockDesc = vi.fn((column: unknown) => ({ kind: "desc", column }));

const tx = {
  select: mockTxSelect,
  insert: mockTxInsert,
  update: mockTxUpdate,
};

vi.mock("@/db", () => ({
  db: {
    select: mockDbSelect,
    transaction: mockDbTransaction,
  },
}));

vi.mock("@/db/schema", () => ({
  appUsers: {
    id: "app_users.id",
    fullName: "app_users.full_name",
  },
  inventoryItems: {
    id: "inventory_items.id",
    tenantId: "inventory_items.tenant_id",
    name: "inventory_items.name",
    category: "inventory_items.category",
    currentStock: "inventory_items.current_stock",
    minStock: "inventory_items.min_stock",
    unit: "inventory_items.unit",
    einkaufspreisEur: "inventory_items.einkaufspreis_eur",
    einheitNormiert: "inventory_items.einheit_normiert",
  },
  orders: {
    id: "orders.id",
    tenantId: "orders.tenant_id",
  },
  stockMovements: {
    id: "stock_movements.id",
    tenantId: "stock_movements.tenant_id",
    inventoryItemId: "stock_movements.inventory_item_id",
    movementType: "stock_movements.movement_type",
    quantity: "stock_movements.quantity",
    reason: "stock_movements.reason",
    orderId: "stock_movements.order_id",
    createdAt: "stock_movements.created_at",
    erfasstVon: "stock_movements.erfasst_von",
  },
}));

vi.mock("@/lib/server/authHelper", () => ({
  checkAppAuthorization: mockCheckAppAuthorization,
}));

vi.mock("drizzle-orm", () => ({
  and: mockAnd,
  desc: mockDesc,
  eq: mockEq,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

const authorization = {
  ok: true as const,
  data: {
    userId: "223e4567-e89b-12d3-a456-426614174001",
    tenantId: "galvanik-kreile",
    displayName: "Max Kreile",
    role: "meister" as const,
    permissions: [],
    active: true as const,
  },
};

function inventoryRow(currentStock = 10) {
  return {
    id: "test-inv-123",
    tenantId: "galvanik-kreile",
    name: "Testartikel",
    category: null,
    currentStock,
    minStock: 2,
    unit: "pcs",
    einkaufspreisEur: "2.50",
    einheitNormiert: null,
    kostenstelleDefaultKuerzel: null,
    letzterPreisAktualisiertAm: null,
    letzterPreisQuelleBelegId: null,
  };
}

function mockInventoryRead(rows: unknown[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  mockDbSelect.mockReturnValue({ from });
  return { from, where, orderBy };
}

function mockLockedItem(row: unknown) {
  mockTxFor.mockResolvedValue(row ? [row] : []);
  const limit = vi.fn(() => ({ for: mockTxFor }));
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  mockTxSelect.mockReturnValue({ from });
  return { from, where, limit };
}

describe("inventory actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAppAuthorization.mockResolvedValue(authorization);
    mockDbTransaction.mockImplementation(async (callback) => callback(tx));
    mockTxInsert.mockReturnValue({ values: mockTxValues });
    mockTxValues.mockResolvedValue(undefined);
    mockTxUpdateWhere.mockResolvedValue(undefined);
    mockTxSet.mockReturnValue({ where: mockTxUpdateWhere });
    mockTxUpdate.mockReturnValue({ set: mockTxSet });
  });

  it("fails closed before querying inventory without a valid session", async () => {
    mockCheckAppAuthorization.mockResolvedValue({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Nicht angemeldet",
    });
    const { getInventoryItemsAction } = await import(
      "@/app/actions/inventory.actions"
    );

    await expect(getInventoryItemsAction()).resolves.toEqual({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Nicht angemeldet",
    });
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it("reads only the authorized tenant and does not invent missing SKU/location fields", async () => {
    mockInventoryRead([inventoryRow()]);
    const { getInventoryItemsAction } = await import(
      "@/app/actions/inventory.actions"
    );

    const result = await getInventoryItemsAction();

    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: "test-inv-123",
          name: "Testartikel",
          category: "uncategorized",
          unit: "pcs",
          currentStock: 10,
          minStock: 2,
          isConsumable: true,
          pricePerUnit: 2.5,
        },
      ],
    });
    expect(mockEq).toHaveBeenCalledWith(
      "inventory_items.tenant_id",
      "galvanik-kreile",
    );
    expect(JSON.stringify(result)).not.toContain("Standardlager");
  });

  it("books stock and history atomically with the canonical session identity", async () => {
    mockLockedItem(inventoryRow(10));
    const { createInventoryMovementAction } = await import(
      "@/app/actions/inventory.actions"
    );

    const result = await createInventoryMovementAction({
      inventoryItemId: "test-inv-123",
      movementType: "consumption",
      quantity: 3,
      reason: "Verbrauch",
      ...({ createdBy: "forged@example.test", unit: "forged" } as object),
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        inventoryItemId: "test-inv-123",
        movementType: "consumption",
        quantity: -3,
        unit: "pcs",
        createdBy: "Max Kreile",
      }),
    });
    expect(mockDbTransaction).toHaveBeenCalledOnce();
    expect(mockTxFor).toHaveBeenCalledWith("update");
    expect(mockTxValues).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "galvanik-kreile",
        inventoryItemId: "test-inv-123",
        quantity: "-3",
        erfasstVon: authorization.data.userId,
      }),
    );
    expect(mockTxSet).toHaveBeenCalledWith({ currentStock: 7 });
    expect(JSON.stringify(mockTxValues.mock.calls)).not.toContain(
      "forged@example.test",
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/items");
  });

  it("rolls back before either write when stock would become negative", async () => {
    mockLockedItem(inventoryRow(1));
    const { createInventoryMovementAction } = await import(
      "@/app/actions/inventory.actions"
    );

    await expect(
      createInventoryMovementAction({
        inventoryItemId: "test-inv-123",
        movementType: "stock_out",
        quantity: 2,
      }),
    ).resolves.toEqual({
      ok: false,
      error: "CONFLICT",
      message: "Buchung würde einen negativen Lagerbestand erzeugen.",
    });
    expect(mockTxValues).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
