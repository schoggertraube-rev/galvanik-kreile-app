import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("global search security and truth", () => {
  it("authorizes and meters the global AI provider call before execution", () => {
    const action = source("src/app/actions/aiSearch.ts");
    const auth = action.indexOf("resolveAuthorization()");
    const context = action.indexOf("buildDataContext(");
    const reserve = action.indexOf("reserveDirectAiUsage({");
    const claim = action.indexOf("claimDirectAiUsage({");
    const provider = action.indexOf("generateAiResponse(prompt, false)");
    const settle = action.indexOf('outcome: "succeeded"');
    expect(auth).toBeGreaterThan(-1);
    expect(context).toBeGreaterThan(auth);
    expect(reserve).toBeGreaterThan(context);
    expect(claim).toBeGreaterThan(reserve);
    expect(provider).toBeGreaterThan(claim);
    expect(settle).toBeGreaterThan(provider);
    expect(action).toContain("parseGlobalAiResponse");
    expect(action).not.toContain("needsWebSearch");
    expect(action).not.toContain("GeminiConfigError");
  });

  it("aggregates only tenant-bound operational and finance data", () => {
    const aggregation = source("src/lib/search/aiAggregation.ts");
    expect(aggregation).toContain('tenantId !== "galvanik-kreile"');
    expect(aggregation).toContain("orders.tenantId");
    expect(aggregation).toContain("customers.tenantId");
    expect(aggregation).toContain("ausgangsrechnung.tenantId");
    expect(aggregation).toContain("eq(appUsers.tenantId, tenantId)");
    expect(aggregation).toContain('gesamtUmsatz: anzahlRechnungen > 0');
    expect(aggregation).not.toContain('topKunden : ["Keine Daten"]');
  });

  it("uses one authorized server search path without browser database fallbacks", () => {
    const action = source("src/app/actions/search.actions.ts");
    const hook = source("src/features/analyse/hooks/useGlobalSearch.ts");
    const compatibility = source("src/lib/search/globalSearch.ts");
    const legacyAction = source("src/app/global-search-actions.ts");
    expect(action).toContain("resolveAuthorization");
    for (const tenantColumn of [
      "customers.tenantId",
      "orders.tenantId",
      "items.tenantId",
      "baeder.tenantId",
      "inventoryItems.tenantId",
      "ausgangsrechnung.tenantId",
    ]) {
      expect(action).toContain(tenantColumn);
    }
    expect(action).toContain("eq(appUsers.tenantId, tenantId)");
    expect(action).toContain("normalized.length > 100");
    expect(hook).not.toContain("supabase");
    expect(hook).not.toContain("search_global");
    expect(compatibility).not.toContain("supabase");
    expect(legacyAction).toContain("return globalSearch(term)");
    expect(action).toContain('url: `/items?item=${encodeURIComponent(inventoryItem.id)}`');
    expect(action).not.toMatch(/Ã|Â|â|�/);
  });

  it("routes inventory and bath intents to their real, separate capabilities", () => {
    const registry = source("src/lib/search/actionRegistry.ts");
    const fuzzy = source("src/lib/search/fuzzy.ts");
    expect(registry).toContain('routeOnSelect: "/items"');
    expect(registry).toContain('routeOnSelect: "/baeder"');
    expect(registry).not.toContain("Lagerbestände und Badwerte");
    expect(fuzzy).toContain('route: "/items"');
    expect(fuzzy).toContain('route: "/baeder"');
    expect(fuzzy).not.toContain("Bestände und Badwerte");
  });
});
