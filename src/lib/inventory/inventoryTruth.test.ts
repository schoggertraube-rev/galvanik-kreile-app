import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("canonical inventory truth and connectivity", () => {
  it("uses one tenant-bound inventory master for reads, capture, and direct movements", () => {
    const action = source("src/app/lager/actions.ts");
    const capture = source("src/app/actions/capture.actions.ts");
    expect(action).toContain("inventoryItems");
    expect(action).not.toContain("lagerArtikel");
    expect(capture).toContain("inventoryItems");
    expect(capture).toContain("stockMovements");
    expect(action).toContain("INVENTORY_TENANT_ASSIGNMENT_INCOMPLETE");
    expect(action).toContain('isolationLevel: "repeatable read"');
  });

  it("keeps direct writes atomic, replayable on the live schema, and precision-aware", () => {
    const action = source("src/app/lager/actions.ts");
    expect(action).toContain("db.transaction");
    expect(action).toContain('id: clientRequestId');
    expect(action).toContain('eq(stockMovements.id, clientRequestId)');
    expect(action).not.toContain("stockMovements.clientRequestId");
    expect(action).toContain('for("update")');
    expect(action).toContain("fitsInventoryQuantityDecimals");
    expect(action.indexOf("if (existing)")).toBeLessThan(action.indexOf("fitsInventoryQuantityDecimals(quantity"));
    expect(action.indexOf("if (persisted)")).toBeLessThan(action.indexOf("readInventoryWriteCapability()"));
    expect(action).toContain("UNIT_NOT_CONFIGURED");
    expect(action).toContain("inventoryReadSessionQuery");
    expect(action).toContain('current_user = \'service_role\'');
  });

  it("projects real purchase prices and enforces movement semantics in the database contract", () => {
    const action = source("src/app/lager/actions.ts");
    const capability = source("src/lib/server/inventoryWriteCapability.ts");
    const migration = source("supabase/migrations/20260715001550_inventory_contract_reconciliation_prepared_unapplied.sql");
    expect(action).toContain("einkaufspreisEur: inventoryItems.einkaufspreisEur");
    expect(action).toContain("pricePerUnit,");
    for (const constraint of [
      "stock_movements_type_chk",
      "stock_movements_quantity_direction_chk",
      "stock_movements_reason_required_chk",
      "stock_movements_template_provenance_chk",
    ]) {
      expect(capability).toContain(constraint);
      expect(migration).toContain(constraint);
    }
    expect(migration).toContain("movement_type IN ('stock_out', 'consumption', 'verbrauch', 'waste')");
    expect(migration).toContain("has_any_column_privilege('service_role', 'public.stock_movements', 'UPDATE')");
  });

  it("loads only bounded per-item history with explicit live-schema projections", () => {
    const action = source("src/app/lager/actions.ts");
    const repository = source("src/lib/repositories/inventoryRepository.ts");
    expect(action).toContain("HISTORY_LIMIT + 1");
    expect(action).toContain("desc(stockMovements.createdAt), desc(stockMovements.id)");
    expect(action).toContain('throw new Error("ITEM_NOT_FOUND")');
    expect(action).toContain('unit: stockMovements.unit');
    expect(action).toContain('unitContext: "movement_snapshot"');
    expect(action).not.toContain("movement: stockMovements");
    expect(repository).not.toContain("getAllMovements");
  });

  it("disables unconfirmed writes and preserves a confirmed mutation outcome across refresh failures", () => {
    const page = source("src/app/items/page.tsx");
    expect(page).toContain("capabilities.canWrite");
    expect(page).toContain("actionSuccess");
    expect(page).toContain("Lagerbuchung wurde vom Server bestätigt");
    expect(page).toContain("getMovementsByItem");
    expect(page).not.toContain("getAllMovements");
  });

  it("synchronizes capture receipts with both inventory views and quarantines the old fake drawer", () => {
    const captureSheet = source("src/components/erfassung/CaptureSheet.tsx");
    const captureAction = source("src/app/actions/capture.actions.ts");
    const drawer = source("src/components/orders/OrderMaterialTimeDrawer.tsx");
    expect(captureSheet).toContain("publishInventorySync");
    expect(captureAction).toContain('revalidatePath("/items")');
    expect(captureAction).toContain('revalidatePath("/lager")');
    expect(captureAction).toContain("readInventoryWriteCapability");
    expect(drawer).toContain("Buchungspfad stillgelegt");
    expect(drawer).not.toContain("inventoryRepository");
    expect(drawer).not.toContain("createMovement");
  });
});
