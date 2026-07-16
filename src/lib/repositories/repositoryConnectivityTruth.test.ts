import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("repository connectivity truth", () => {
  it("does not gate active order or bath persistence behind a public provider flag", () => {
    for (const path of [
      "src/lib/repositories/ordersRepository.ts",
      "src/lib/repositories/bathMeasurementsRepository.ts",
      "src/lib/repositories/kvpRepository.ts",
      "src/lib/repositories/inventoryRepository.ts",
      "src/lib/repositories/companySettingsRepository.ts",
      "src/lib/repositories/inquiriesRepository.ts",
      "src/lib/repositories/complaintsRepository.ts",
      "src/lib/repositories/priceAgreementsRepository.ts",
    ]) {
      expect(source(path)).not.toContain("NEXT_PUBLIC_DATA_PROVIDER");
      expect(source(path)).not.toContain("Mock Fallback");
    }
  });

  it("keeps customer details and price agreements tenant-scoped and schema-true", () => {
    const customerAction = source("src/app/customers/[id]/actions.ts");
    const priceAction = source("src/app/actions/price-agreements.actions.ts");
    expect(customerAction).toContain("customers.tenantId");
    expect(customerAction).toContain("complaints.tenantId");
    expect(customerAction).not.toContain("from(qs)");
    expect(priceAction).toContain("innerJoin(customers");
    expect(priceAction).toContain("customers.tenantId");
  });

  it("does not hide customer or timeline authorization failures and never substitutes another order", () => {
    const customers = source("src/lib/repositories/customersRepository.ts");
    const timeline = source("src/lib/repositories/timelineRepository.ts");
    const detail = source("src/app/orders/[id]/page.tsx");
    const live = source("src/lib/useOrderLive.ts");
    expect(customers).not.toContain('return []');
    expect(timeline).not.toContain("OfflineManager");
    expect(timeline).not.toContain('return []');
    expect(detail).not.toContain("|| orders[0]");
    expect(live).not.toContain("postgres_changes");
    expect(live).toContain('refreshMode: "polling"');
  });

  it("never creates an unknown placeholder customer during intake", () => {
    const intake = source("src/lib/services/intakeService.ts");
    expect(intake).not.toContain("Unbekannter Kunde");
    expect(intake).toContain("muss ein echter Kunde ausgewählt");
  });

  it("loads detailed orders only through authorized tenant-scoped queries", () => {
    const query = source("src/lib/repositories/orderQueries.ts");
    expect(query).toContain("resolveAuthorization");
    for (const table of ["orders", "customers", "items", "events", "priceLines"]) {
      expect(query).toContain(`${table}.tenantId`);
    }
    expect(query).toContain('permissions.includes("perm_view_prices")');
    expect(query).toContain('permissions.includes("perm_view_customers")');
    expect(query).not.toContain("payments");
    expect(query).not.toContain("communications");
    expect(query).not.toContain("ausgangsrechnung");
    expect(query).not.toContain("return null;\n  }");
  });

  it("keeps unsupported order-overlay actions disabled and removes browser storage uploads", () => {
    const overlay = source("src/components/orders/OrderOverlay.tsx");
    expect(overlay).not.toContain("createClient");
    expect(overlay).not.toContain("uploadOrderPhotoRecord");
    expect(overlay).not.toContain("quoteTotalGross");
    expect(overlay).not.toContain("cost_ist");
    expect(overlay).toContain("noch nicht belastbar instrumentiert");
  });

  it("binds complaints to same-tenant order, customer, and item parents", () => {
    const action = source("src/app/actions/complaints.actions.ts");
    expect(action).toContain("resolveAuthorization");
    expect(action).toContain("db.transaction");
    expect(action).toContain("order.customerId !== customerId");
    expect(action).toContain("items.tenantId");
    expect(action).toContain("complaints.tenantId");
    expect(action).toContain('error: "DB_ERROR"');
  });

  it("requires authorization and tenant filters for inquiry reads and writes", () => {
    const action = source("src/app/actions/inquiries.actions.ts");
    expect(action).toContain("resolveAuthorization");
    expect(action).toContain("inquiries.tenantId");
    expect(action).toContain("customers.tenantId");
    expect(action).toContain(".returning()");
    expect(action).not.toContain("return []");
  });

  it("never substitutes local or fabricated company settings", () => {
    const repository = source("src/lib/repositories/companySettingsRepository.ts");
    const action = source("src/app/actions/company.actions.ts");
    expect(repository).not.toContain("localStorage");
    expect(repository).not.toContain("Musterbank");
    expect(repository).not.toContain("Musterstra");
    expect(action).toContain("configured: false");
    expect(action).toContain("companySettingsTable.tenantId");
  });

  it("persists inventory movements with server identity and an atomic stock transaction", () => {
    const action = source("src/app/lager/actions.ts");
    const repository = source("src/lib/repositories/inventoryRepository.ts");
    expect(action).toContain("resolveAuthorization");
    expect(action).toContain("db.transaction");
    expect(action).toContain('.for("update")');
    expect(action).toContain("erfasstVon: actor.data.userId");
    expect(repository).not.toContain("created_by");
    expect(repository).not.toContain("Standardlager");
  });

  it("does not present KVP mock photos, local persistence, or fabricated management metrics", () => {
    const content = source("src/app/betrieb-kvp/BetriebKvpClient.tsx");
    expect(content).not.toContain("Foto Platzhalter - Demo");
    expect(content).not.toContain("2 an Station");
    expect(content).not.toContain("Mocked");
    expect(content).toContain("Noch nicht instrumentiert");
  });

  it("keeps the retired marketing mail compatibility seam fail-closed", () => {
    const content = source("src/lib/services/marketingEmailService.ts");
    expect(content).not.toContain("localStorage");
    expect(content).toContain("retiredService");
  });

  it("records bath measurements atomically with tenant, actor, and an honest evaluated status", () => {
    const action = source("src/app/actions/baths.actions.ts");
    const repository = source("src/lib/repositories/bathsRepository.ts");
    const dashboard = source("src/app/baeder/BaederDashboardClient.tsx");
    expect(action).toContain("resolveAuthorization");
    expect(action).toContain("baeder.tenantId");
    expect(action).toContain("db.transaction");
    expect(action).toContain('.for("update")');
    expect(action).toContain("statusAfterMeasurement: status");
    expect(action).toContain("measuredByUserId: actor.data.userId");
    expect(repository).not.toContain('measuredBy: "System"');
    expect(repository).not.toContain('return [];');
    expect(dashboard).not.toContain("0 kg verbraucht");
    expect(dashboard).not.toContain("0% Abweichung");
    expect(dashboard).toContain("Noch nicht belastbar instrumentiert");
  });

  it("awaits real order creation before showing success", () => {
    const content = source("src/app/quotes/page.tsx");
    expect(content).toContain("await ordersRepository.create");
    expect(content).toContain("Als angeboten markieren (manuell)");
    expect(content).not.toContain("A-2026-QUOTE-");
  });
});
