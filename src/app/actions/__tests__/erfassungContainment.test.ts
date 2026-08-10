import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = {
  createAuthorizedDataContext: vi.fn(),
  createAuthorizedDataClient: vi.fn(),
  createAuthorizedSessionContext: vi.fn(),
  createClient: vi.fn(),
  checkAppAuth: vi.fn(),
  getCurrentAppUser: vi.fn(),
  getKostensatz: vi.fn(),
  getEinkaufspreis: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
};
const db = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createAuthorizedDataContext: ports.createAuthorizedDataContext,
  createAuthorizedDataClient: ports.createAuthorizedDataClient,
  createAuthorizedSessionContext: ports.createAuthorizedSessionContext,
  createClient: ports.createClient,
}));
vi.mock("@/lib/erfassung/snapshot", () => ({
  getKostensatz: ports.getKostensatz,
  getEinkaufspreis: ports.getEinkaufspreis,
}));
vi.mock("@/lib/server/authHelper", () => ({ checkAppAuth: ports.checkAppAuth }));
vi.mock("@/lib/auth/permissions", () => ({ getCurrentAppUser: ports.getCurrentAppUser }));
vi.mock("@/db", () => ({ db }));
vi.mock("@/db/schema", () => ({ arbeitszeitBuchung: {}, events: {}, customers: {}, orders: {}, items: {}, calendarEvents: {} }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), like: vi.fn(), sql: vi.fn() }));
vi.mock("@paralleldrive/cuid2", () => ({ createId: vi.fn() }));
vi.mock("@/lib/validation/orderSchema", () => ({ VALID_ORDER_SOURCES: [] }));
vi.mock("next/cache", () => ({ revalidatePath: ports.revalidatePath }));

const allPorts = [...Object.values(ports), ...Object.values(db)];
const denial = "NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt.";

function expectNoPortCalls() {
  for (const port of allPorts) expect(port).not.toHaveBeenCalled();
}

describe("Erfassung containment (F0-W2C-B2M1)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("denies every legacy Erfassung command before authorization, reads, writes, RPC, audit, or revalidation", async () => {
    const actions = await import("../erfassung.actions");

    await expect(actions.startZeit({ auftrag_id: "order-1", employee_id: "employee-1", station_kuerzel: "galvanik" })).resolves.toMatchObject({ error: denial });
    await expect(actions.stopZeit({ buchung_id: "booking-1" })).resolves.toMatchObject({ error: denial });
    await expect(actions.erfasseZeitDirekt({ auftrag_id: "order-1", employee_id: "employee-1", station_kuerzel: "galvanik", dauer_minuten: 1 })).resolves.toMatchObject({ error: denial });
    await expect(actions.erfasseVerbrauch({ auftrag_id: "order-1", employee_id: "employee-1", inventory_item_id: "inventory-1", station_kuerzel: "galvanik", menge: 1 })).resolves.toMatchObject({ error: denial });
    await expect(actions.uebernehmeVorlage({ auftrag_id: "order-1", employee_id: "employee-1", schluessel: "standard" })).resolves.toMatchObject({ error: denial });
    await expect(actions.createOrderFromErfassung({})).resolves.toEqual({ ok: false, error: "CONFLICT", message: denial });

    expectNoPortCalls();
  });

  it("denies station-cost write and read commands before any client or database access", async () => {
    const costs = await import("@/features/orders/orderCost.actions");

    await expect(costs.bookStationCosts({
      orderId: "order-1", station: "galvanik", workEntries: [], consumableEntries: [], extraCostEvents: [], employeeId: "employee-1", kostenstelleKuerzel: "galvanik",
    })).resolves.toEqual({ success: false, errors: [denial] });
    await expect(costs.getStationCostSummary("order-1")).resolves.toEqual({ success: false, error: denial });

    expectNoPortCalls();
  });
});

describe("Erfassung caller containment (F0-W2C-B2M1)", () => {
  const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const callerFiles = [
    "components/erfassung/ErfassungCard.tsx",
    "components/erfassung/ErfassungSheet.tsx",
    "components/erfassung/ManualFlow/ManualWizard.tsx",
    "components/orders/variants/ErfassungVariant.tsx",
    "components/orders/variants/WareneingangReadOnly.tsx",
  ];

  it("replaces every named browser caller with a non-interactive FoundationUnavailable state", async () => {
    const sources = await Promise.all(callerFiles.map((file) => readFile(path.join(srcRoot, file), "utf8")));
    for (const source of sources) {
      expect(source).toMatch(/FoundationUnavailable|NOT_AVAILABLE/);
      expect(source).not.toMatch(/from\s+["'][^"']*(erfassung\.actions|orderCost\.actions)[^"']*["']/);
      expect(source).not.toMatch(/\b(createClient|createAuthorizedDataClient|getStationCostSummary|getBenchmarkData|bookStationCosts|startZeit|stopZeit|erfasseZeitDirekt|erfasseVerbrauch|uebernehmeVorlage|createOrderFromErfassung)\b/);
      expect(source).not.toMatch(/\b(useEffect|fetch|supabase)\b/i);
      expect(source).not.toMatch(/onClick\s*=|<button\b|Mutation-CTA/);
    }
  });

  it("removes fabricated Erfassung and Wareneingang values and paths", async () => {
    const [erfassung, wareneingang] = await Promise.all([
      readFile(path.join(srcRoot, "components/orders/variants/ErfassungVariant.tsx"), "utf8"),
      readFile(path.join(srcRoot, "components/orders/variants/WareneingangReadOnly.tsx"), "utf8"),
    ]);

    expect(erfassung).not.toContain("00000000-0000-0000-0000-000000000000");
    expect(erfassung).not.toMatch(/\|\|\s*70/);
    expect(erfassung).not.toContain("getStationCostSummary");
    expect(erfassung).not.toContain("getBenchmarkData");
    expect(wareneingang).not.toMatch(/ErfassungVariant|editMode|nacherfassen|20\s*Min|23\s*(?:€|â‚¬)|L-WE-R1-F2/);
  });
});
