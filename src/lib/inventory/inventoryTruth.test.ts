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
    expect(action).toContain("UNIT_NOT_CONFIGURED");
  });

  it("loads only bounded per-item history with explicit live-schema projections", () => {
    const action = source("src/app/lager/actions.ts");
    const repository = source("src/lib/repositories/inventoryRepository.ts");
    expect(action).toContain("HISTORY_LIMIT + 1");
    expect(action).toContain("desc(stockMovements.createdAt), desc(stockMovements.id)");
    expect(action).toContain('throw new Error("ITEM_NOT_FOUND")');
    expect(action).toContain('unitContext: "current_inventory_item"');
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
    expect(captureAction).toContain("pi.indisvalid");
    expect(captureAction).toContain("pi.indisready");
    expect(drawer).toContain("Buchungspfad stillgelegt");
    expect(drawer).not.toContain("inventoryRepository");
    expect(drawer).not.toContain("createMovement");
  });
});
