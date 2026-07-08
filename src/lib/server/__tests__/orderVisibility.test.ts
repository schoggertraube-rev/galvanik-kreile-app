import { describe, it, expect } from "vitest";
import {
  isProductionOrderVisible,
  type ProductionOrderVisibilityInput,
} from "../orderVisibility";

/** Helper – builds a minimum-valid production input, override as needed */
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

// ─── Tenant guard ────────────────────────────────────────────────────────────

describe("tenantId guard", () => {
  it("blocks a different tenantId", () => {
    expect(isProductionOrderVisible(prod({ tenantId: "other-tenant" }))).toBe(false);
  });

  it("blocks null tenantId", () => {
    expect(isProductionOrderVisible(prod({ tenantId: null }))).toBe(false);
  });

  it("allows galvanik-kreile", () => {
    expect(isProductionOrderVisible(prod())).toBe(true);
  });
});

// ─── Blocked sources ─────────────────────────────────────────────────────────

describe("blocked sources", () => {
  it.each(["seed", "test", "demo", "integration-test", "e2e"])(
    "blocks source=%s",
    (source) => {
      expect(isProductionOrderVisible(prod({ source }))).toBe(false);
    }
  );

  it.each(["SEED", "TEST", "DEMO", "Integration-Test", "E2E"])(
    "blocks source=%s case-insensitively",
    (source) => {
      expect(isProductionOrderVisible(prod({ source }))).toBe(false);
    }
  );

  it("allows source=manual", () => {
    expect(isProductionOrderVisible(prod({ source: "manual" }))).toBe(true);
  });

  it("allows source=scan", () => {
    expect(isProductionOrderVisible(prod({ source: "scan" }))).toBe(true);
  });

  it("allows source=customer", () => {
    expect(isProductionOrderVisible(prod({ source: "customer" }))).toBe(true);
  });

  it("blocks null source", () => {
    expect(isProductionOrderVisible(prod({ source: null }))).toBe(false);
  });
});

// ─── orderNumber pattern guards ───────────────────────────────────────────────

describe("orderNumber pattern guards", () => {
  it("blocks A-SEED-* orderNumbers", () => {
    expect(isProductionOrderVisible(prod({ orderNumber: "A-SEED-001" }))).toBe(false);
    expect(isProductionOrderVisible(prod({ orderNumber: "A-SEED-9999" }))).toBe(false);
  });

  it("blocks orderNumbers containing TEST", () => {
    expect(isProductionOrderVisible(prod({ orderNumber: "TEST-001" }))).toBe(false);
    expect(isProductionOrderVisible(prod({ orderNumber: "A-2026-TEST01" }))).toBe(false);
  });

  it("allows normal A-YYYY-NNNNN pattern", () => {
    expect(isProductionOrderVisible(prod({ orderNumber: "A-2026-10001" }))).toBe(true);
  });

  it("blocks null orderNumber", () => {
    expect(isProductionOrderVisible(prod({ orderNumber: null }))).toBe(false);
  });
});

// ─── Text-field keyword scan ──────────────────────────────────────────────────

describe("title keyword guard", () => {
  it.each(["test", "e2e", "demo", "seed", "mock", "fixture", "sample", "placeholder"])(
    "blocks title containing keyword '%s'",
    (kw) => {
      expect(isProductionOrderVisible(prod({ title: `Auftrag ${kw} Sonderfall` }))).toBe(false);
    }
  );

  it("blocks 'Test Order'", () => {
    expect(isProductionOrderVisible(prod({ title: "Test Order" }))).toBe(false);
  });

  it("blocks 'Auftrag per Scan Test E2E'", () => {
    expect(
      isProductionOrderVisible(prod({ title: "Auftrag per Scan Test E2E" }))
    ).toBe(false);
  });

  it("blocks 'Test Stoßstange Kundenakte'", () => {
    expect(
      isProductionOrderVisible(prod({ title: "Test Stoßstange Kundenakte" }))
    ).toBe(false);
  });

  it("allows legitimate title with no keywords", () => {
    expect(
      isProductionOrderVisible(prod({ title: "Stoßstange Sonderbeschichtung" }))
    ).toBe(true);
  });
});

describe("task keyword guard", () => {
  it("blocks task containing keyword 'demo'", () => {
    expect(isProductionOrderVisible(prod({ task: "demo run galvanik" }))).toBe(false);
  });

  it("allows legitimate task", () => {
    expect(isProductionOrderVisible(prod({ task: "Vernickeln, Polieren" }))).toBe(true);
  });
});

// ─── Combined realistic scenarios ─────────────────────────────────────────────

describe("realistic DB row scenarios", () => {
  it("blocks integration-test source row", () => {
    expect(
      isProductionOrderVisible({
        tenantId: "galvanik-kreile",
        source: "integration-test",
        orderNumber: "A-2026-10005",
        title: "Echt-Auftrag",
        task: "Verchromen",
        customerId: "cust-1",
      })
    ).toBe(false);
  });

  it("blocks seed source row even with clean title", () => {
    expect(
      isProductionOrderVisible({
        tenantId: "galvanik-kreile",
        source: "seed",
        orderNumber: "A-SEED-001",
        title: "Legitime Beschriftung",
        task: "Vernickeln",
        customerId: "cust-1",
      })
    ).toBe(false);
  });

  it("allows manual source row with clean data", () => {
    expect(
      isProductionOrderVisible({
        tenantId: "galvanik-kreile",
        source: "manual",
        orderNumber: "A-2026-10010",
        title: "Fahrzeugrahmen Sonderlackierung",
        task: "Galvanisieren",
        customerId: "cust-1",
      })
    ).toBe(true);
  });

  it("allows scan source row with clean data", () => {
    expect(
      isProductionOrderVisible({
        tenantId: "galvanik-kreile",
        source: "scan",
        orderNumber: "A-2026-10011",
        title: "Auftrag per Scan - 08.07.2026",
        task: "Verchromen",
        customerId: "cust-1",
      })
    ).toBe(true);
  });

  it("allows customer source row with clean data", () => {
    expect(
      isProductionOrderVisible({
        tenantId: "galvanik-kreile",
        source: "customer",
        orderNumber: "A-2026-10012",
        title: "Kundenauftrag Sonderanfertigung",
        task: "Vernickeln",
        customerId: "cust-1",
      })
    ).toBe(true);
  });

  it("blocks null-source row", () => {
    expect(
      isProductionOrderVisible({
        tenantId: "galvanik-kreile",
        source: null,
        orderNumber: "A-2026-10013",
        title: "Demo Beschichtung Muster",
        task: null,
        customerId: "cust-1",
      })
    ).toBe(false);
  });
});

// ─── Remote Altlasten specific examples from audit ────────────────────────────

describe("remote altlasten specific audit examples", () => {
  it("blocks specific remote test/gibberish cases", () => {
    // source scan, title "Gjgvvh", customerId egal
    expect(
      isProductionOrderVisible(prod({ source: "scan", title: "Gjgvvh", customerId: "cust-1" }))
    ).toBe(false);
    expect(
      isProductionOrderVisible(prod({ source: "scan", title: "Gjgvvh", customerId: null }))
    ).toBe(false);

    // source manual, title "sfdghgjklji", customerId egal
    expect(
      isProductionOrderVisible(prod({ source: "manual", title: "sfdghgjklji", customerId: "cust-1" }))
    ).toBe(false);
    expect(
      isProductionOrderVisible(prod({ source: "manual", title: "sfdghgjklji", customerId: null }))
    ).toBe(false);

    // source null, title "Produktionsauftrag 4711", customerId vorhanden
    expect(
      isProductionOrderVisible(prod({ source: null, title: "Produktionsauftrag 4711", customerId: "cust-1" }))
    ).toBe(false);

    // source manual, title "kühlergrill 300sl", customerId null
    expect(
      isProductionOrderVisible(prod({ source: "manual", title: "kühlergrill 300sl", customerId: null }))
    ).toBe(false);

    // source manual, title "kronleuchter", customerId null
    expect(
      isProductionOrderVisible(prod({ source: "manual", title: "kronleuchter", customerId: null }))
    ).toBe(false);

    // source manual, title "Stoßstange rekord c", customerId null
    expect(
      isProductionOrderVisible(prod({ source: "manual", title: "Stoßstange rekord c", customerId: null }))
    ).toBe(false);

    // source customer, title "Test Stoßstange Kundenakte", customerId vorhanden
    expect(
      isProductionOrderVisible(prod({ source: "customer", title: "Test Stoßstange Kundenakte", customerId: "cust-1" }))
    ).toBe(false);
  });

  it("allows realistic valid examples", () => {
    // source manual, title "Kühlergrill 300SL verchromen", customerId vorhanden, orderNumber vorhanden
    expect(
      isProductionOrderVisible(prod({ source: "manual", title: "Kühlergrill 300SL verchromen", customerId: "cust-1", orderNumber: "A-2026-00001" }))
    ).toBe(true);

    // source scan, title "Kundenauftrag Chromteile", customerId vorhanden, orderNumber vorhanden
    expect(
      isProductionOrderVisible(prod({ source: "scan", title: "Kundenauftrag Chromteile", customerId: "cust-1", orderNumber: "A-2026-00002" }))
    ).toBe(true);

    // source customer, title "Kronleuchter neu vernickeln", customerId vorhanden, orderNumber vorhanden
    expect(
      isProductionOrderVisible(prod({ source: "customer", title: "Kronleuchter neu vernickeln", customerId: "cust-1", orderNumber: "A-2026-00003" }))
    ).toBe(true);
  });
});

