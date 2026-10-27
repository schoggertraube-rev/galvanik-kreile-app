import { beforeEach, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { SALES_STAGE_FEATURES } from "../featureCatalog";

const { execute, withTransaction, hash } = vi.hoisted(() => ({ execute: vi.fn(), withTransaction: vi.fn(), hash: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: withTransaction }));
vi.mock("bcryptjs", () => ({ default: { hash } }));
vi.mock("drizzle-orm", () => ({ sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }) }));

const context = { tenantId: KREILE_TENANT_SLUG, actorId: "11111111-1111-4111-8111-111111111111", canManage: true };

describe("system settings port", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    withTransaction.mockImplementation(async (_context, work) => work({ execute }));
    hash.mockResolvedValue("hashed-pin");
  });

  it("reads exactly one company record and the real tenant users", async () => {
    execute
      .mockResolvedValueOnce([{
        company_name: "Galvanik Kreile", street: "Testweg 1", zip: "12345", city: "Teststadt",
        country: "Deutschland", tax_id: "DE123456789", iban: "DE0012345678", bic: "TESTDEFF",
        bank_name: "Testbank", invoice_payment_term_days: 14, logo_url: "/logo.png",
      }])
      .mockResolvedValueOnce([{
        id: "22222222-2222-4222-8222-222222222222", email: "phillip@example.invalid",
        full_name: "Phillip", role: "werkstatt", active: true,
      }])
      .mockResolvedValueOnce(SALES_STAGE_FEATURES.map((feature) => ({ feature_id: feature.id, enabled: feature.defaultEnabled })));
    const { readSystemSettings } = await import("../server/systemSettingsPort");
    await expect(readSystemSettings(context)).resolves.toMatchObject({
      code: "OK",
      snapshot: {
        company: { companyName: "Galvanik Kreile", paymentTermDays: 14 },
        users: [{ fullName: "Phillip", role: "werkstatt", active: true }],
        features: expect.arrayContaining([{ id: "S01", enabled: true }, { id: "Z01", enabled: false }]),
      },
    });
  });

  it("opens an empty, savable company draft when no settings row exists", async () => {
    execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(SALES_STAGE_FEATURES.map((feature) => ({ feature_id: feature.id, enabled: feature.defaultEnabled })));
    const { readSystemSettings } = await import("../server/systemSettingsPort");
    await expect(readSystemSettings(context)).resolves.toMatchObject({
      code: "OK",
      snapshot: { company: { companyName: "", country: "Deutschland", paymentTermDays: 14 } },
    });
  });

  it("creates the tenant company row on first save", async () => {
    execute.mockResolvedValueOnce([{ id: `company:${KREILE_TENANT_SLUG}` }]);
    const { updateCompanySettings } = await import("../server/systemSettingsPort");
    await expect(updateCompanySettings(context, {
      companyName: "Galvanik Kreile", street: "Testweg 1", zip: "12345", city: "Berlin", country: "Deutschland",
      taxId: "DE123456789", iban: "DE0012345678", bic: "TESTDEFF", bankName: "Testbank", paymentTermDays: 14, logoUrl: "/logo.png",
    })).resolves.toEqual({ code: "OK" });
    expect(execute.mock.calls[0]?.[0].text).toContain("INSERT INTO public.company_settings");
    expect(execute.mock.calls[0]?.[0].text).toContain("ON CONFLICT");
  });

  it("reads complete company data for a tenant-bound document and fails closed when it is missing", async () => {
    execute.mockResolvedValueOnce([{
      company_name: "Galvanik Kreile", street: "Testweg 1", zip: "12345", city: "Teststadt",
      country: "Deutschland", tax_id: "DE123456789", iban: "DE0012345678", bic: "TESTDEFF",
      bank_name: "Testbank", invoice_payment_term_days: 14, logo_url: "/logo.png",
    }]);
    const { readCompanyDocumentSettings } = await import("../server/systemSettingsPort");
    await expect(readCompanyDocumentSettings({ ...context, canRead: true })).resolves.toMatchObject({
      code: "OK",
      company: { companyName: "Galvanik Kreile", paymentTermDays: 14 },
    });

    execute.mockResolvedValueOnce([]);
    await expect(readCompanyDocumentSettings({ ...context, canRead: true })).resolves.toMatchObject({ code: "UNAVAILABLE" });
    await expect(readCompanyDocumentSettings({ ...context, canRead: false })).resolves.toMatchObject({ code: "FORBIDDEN" });
  });

  it("fails closed before database access for non-admin and incomplete input", async () => {
    const { readSystemSettings, updateCompanySettings, updateManagedUser } = await import("../server/systemSettingsPort");
    await expect(readSystemSettings({ ...context, canManage: false })).resolves.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateCompanySettings(context, {})).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(updateManagedUser(context, { userId: "invalid" })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("hashes a new PIN server-side and updates only the selected tenant user", async () => {
    execute
      .mockResolvedValueOnce([{
        id: "22222222-2222-4222-8222-222222222222",
        role: "werkstatt",
        active: true,
        has_pin: true,
      }])
      .mockResolvedValueOnce([{ active_count: 3, manager_count: 2 }])
      .mockResolvedValueOnce([{ id: "22222222-2222-4222-8222-222222222222" }]);
    const { updateManagedUser } = await import("../server/systemSettingsPort");
    await expect(updateManagedUser(context, {
      userId: "22222222-2222-4222-8222-222222222222",
      role: "werkstatt",
      active: true,
      pin: "0000",
    })).resolves.toEqual({ code: "OK" });
    expect(hash).toHaveBeenCalledWith("0000", 12);
    expect(execute.mock.calls[2]?.[0].text).toContain("tenant_id");
  });
});
