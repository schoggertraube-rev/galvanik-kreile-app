import { beforeEach, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

const { execute, withTransaction } = vi.hoisted(() => ({ execute: vi.fn(), withTransaction: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: withTransaction }));
vi.mock("drizzle-orm", () => ({ sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }) }));

const context = { tenantId: KREILE_TENANT_SLUG, canRead: true, canManage: true };
const row = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Verchromen",
  surface: "Chrom glanz",
  unit: "Stück",
  net_price_cents: 12500,
  vat_rate_basis_points: 1900,
  standard_lead_time_working_days: 5,
  active: true,
};

describe("catalog service port", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    withTransaction.mockImplementation(async (_context, work) => work({ execute }));
  });

  it("denies reads and writes before database access", async () => {
    const { listCatalogServices, saveCatalogService } = await import("../server/catalogServicePort");
    await expect(listCatalogServices({ ...context, canRead: false })).resolves.toMatchObject({ code: "FORBIDDEN" });
    await expect(saveCatalogService({ ...context, canManage: false }, {})).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("maps the tenant-bound catalog and rejects incomplete writes", async () => {
    execute.mockResolvedValueOnce([row]);
    const { listCatalogServices, saveCatalogService } = await import("../server/catalogServicePort");
    await expect(listCatalogServices(context)).resolves.toEqual({
      code: "OK",
      services: [{
        id: row.id,
        name: row.name,
        surface: row.surface,
        unit: row.unit,
        netPriceCents: 12500,
        vatRateBasisPoints: 1900,
        standardLeadTimeWorkingDays: 5,
        active: true,
      }],
    });
    await expect(saveCatalogService(context, { name: "unvollständig" })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("returns only the database readback after a valid upsert", async () => {
    execute.mockResolvedValueOnce([row]);
    const { saveCatalogService } = await import("../server/catalogServicePort");
    await expect(saveCatalogService(context, {
      id: row.id,
      name: row.name,
      surface: row.surface,
      unit: row.unit,
      netPriceCents: row.net_price_cents,
      vatRateBasisPoints: row.vat_rate_basis_points,
      standardLeadTimeWorkingDays: row.standard_lead_time_working_days,
      active: true,
    })).resolves.toMatchObject({ code: "OK", service: { id: row.id, netPriceCents: 12500 } });
    expect(execute.mock.calls[0]?.[0].text).toContain("catalog_services");
  });
});
