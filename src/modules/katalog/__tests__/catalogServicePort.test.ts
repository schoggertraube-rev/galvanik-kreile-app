import { beforeEach, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

const { execute, withTransaction, readVat } = vi.hoisted(() => ({
  execute: vi.fn(), withTransaction: vi.fn(), readVat: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: withTransaction }));
vi.mock("drizzle-orm", () => ({ sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }) }));

const context = {
  tenantId: KREILE_TENANT_SLUG,
  actorId: "22222222-2222-4222-8222-222222222222",
  canRead: true,
  canManage: true,
  readVat,
};
const row = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Verchromen",
  surface: "verchromen",
  unit: "stueck",
  net_price_cents: 12500,
  vat_rate_basis_points: 1900,
  standard_lead_time_working_days: 5,
  active: true,
};

describe("catalog service port", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    readVat.mockResolvedValue({ regelsatzBasispunkte: row.vat_rate_basis_points, ermaessigtBasispunkte: 825 });
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
    execute.mockResolvedValueOnce([]).mockResolvedValueOnce([row]);
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
    expect(execute.mock.calls[0]?.[0].text).toContain("set_config('app.actor_id'");
    expect(execute.mock.calls[1]?.[0].text).toContain("catalog_services");
  });

  it("uses the tenant rate and keeps an unchanged historical rate", async () => {
    const { saveCatalogService } = await import("../server/catalogServicePort");
    const basis = {
      name: row.name, surface: row.surface, unit: row.unit, netPriceCents: row.net_price_cents,
      standardLeadTimeWorkingDays: row.standard_lead_time_working_days, active: true,
    };
    await expect(saveCatalogService(context, { ...basis, id: null, vatRateBasisPoints: 1200 }))
      .resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(execute).not.toHaveBeenCalled();
    execute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ ...row, vat_rate_basis_points: 825 }]);
    await expect(saveCatalogService(context, { ...basis, id: null, vatRateBasisPoints: 825 }))
      .resolves.toMatchObject({ code: "OK", service: { vatRateBasisPoints: 825 } });
    expect(readVat).toHaveBeenCalledWith(expect.anything(), context.tenantId);
    execute.mockResolvedValueOnce([{ vat_rate_basis_points: 1200 }]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...row, vat_rate_basis_points: 1200 }]);
    await expect(saveCatalogService(context, { ...basis, id: row.id, vatRateBasisPoints: 1200 }))
      .resolves.toMatchObject({ code: "OK", service: { vatRateBasisPoints: 1200 } });
  });

  it("projects catalog metadata without querying or returning prices", async () => {
    const metadata={id:row.id,name:row.name,surface:row.surface,unit:row.unit,standard_lead_time_working_days:row.standard_lead_time_working_days,active:row.active};
    execute.mockResolvedValueOnce([metadata]);
    const {listCatalogServices}=await import("../server/catalogServicePort");
    const result=await listCatalogServices(context,false,"metadata");
    expect(result).toEqual({code:"OK",services:[{id:row.id,name:row.name,surface:row.surface,unit:row.unit,standardLeadTimeWorkingDays:5,active:true}]});
    const query = execute.mock.calls[0]?.[0];
    expect(JSON.stringify(query.values[0])).not.toMatch(/net_price_cents|vat_rate_basis_points/);
    expect(query.values.at(-1)?.text).toContain("AND vat_rate_basis_points IN");
    expect(withTransaction.mock.calls[0]?.[0].tenantId).toBe(context.tenantId);
  });

});
