import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { isProductionOrderVisible, type ProductionOrderVisibilityInput } from "../orderVisibility";

function prod(overrides: Partial<ProductionOrderVisibilityInput> = {}): ProductionOrderVisibilityInput {
  return {
    tenantId: "galvanik-kreile",
    source: "manual",
    orderNumber: "A-2026-10001",
    title: "Stoßstange Kundenauftrag",
    task: "Vernickeln",
    customerId: "cust-123",
    ...overrides,
  };
}

describe("v_production_orders is canonical", () => {
  it("verifies operationalOrders.ts does not use isProductionOrderVisible", () => {
    const file = readFileSync(join(__dirname, "../../server/operationalOrders.ts"), "utf-8");
    expect(file).not.toContain("isProductionOrderVisible");
    expect(file).toContain("vProductionOrders");
  });

  it("verifies getOrderCountDb does not use isProductionOrderVisible", () => {
    const file = readFileSync(join(__dirname, "../../../app/actions/orders.actions.ts"), "utf-8");
    expect(file).not.toContain("isProductionOrderVisible");
  });
});

describe("Legacy isProductionOrderVisible contract", () => {
  it("allows source=NULL when other rules pass", () => {
    expect(isProductionOrderVisible(prod({ source: null }))).toBe(true);
  });

  it("blocks seed, test, demo, integration-test sources", () => {
    ["seed", "test", "demo", "integration-test", "e2e"].forEach(source => {
      expect(isProductionOrderVisible(prod({ source }))).toBe(false);
    });
  });

  it("blocks missing customerId", () => {
    expect(isProductionOrderVisible(prod({ customerId: "" }))).toBe(false);
    expect(isProductionOrderVisible(prod({ customerId: null }))).toBe(false);
  });

  it("blocks missing orderNumber", () => {
    expect(isProductionOrderVisible(prod({ orderNumber: "" }))).toBe(false);
    expect(isProductionOrderVisible(prod({ orderNumber: null }))).toBe(false);
  });

  it("blocks missing title AND task", () => {
    expect(isProductionOrderVisible(prod({ title: "", task: "" }))).toBe(false);
  });
});
