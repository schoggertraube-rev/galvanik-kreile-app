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
        full_name: "Phillip", kuerzel: "P", bezeichnung: "Werkstatt", role: "werkstatt", active: true,
        areas: ["auftraege", "eingang", "kunden"],
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

  it("hides inactive rights and caps developer rights to the visible server policy", async () => {
    execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "11111111-1111-4111-8111-111111111111", email: "gregor@example.invalid", full_name: "Gregor", kuerzel: "G", bezeichnung: "Entwickler", role: "developer", active: true, areas: ["auftraege", "geld", "einstellungen", "logins", "wartung"] },
        { id: "22222222-2222-4222-8222-222222222222", email: null, full_name: "Christian Dieter", kuerzel: "CD", bezeichnung: null, role: "meister", active: false, areas: ["auftraege", "geld", "logins"] },
      ])
      .mockResolvedValueOnce(SALES_STAGE_FEATURES.map((feature) => ({ feature_id: feature.id, enabled: feature.defaultEnabled })));
    const { readSystemSettings } = await import("../server/systemSettingsPort");
    await expect(readSystemSettings(context)).resolves.toMatchObject({
      code: "OK",
      snapshot: {
        users: [
          { fullName: "Gregor", areas: ["einstellungen", "logins", "wartung"], fixedAreas: ["einstellungen", "logins", "wartung"] },
          { fullName: "Christian Dieter", active: false, areas: [], fixedAreas: [] },
        ],
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
      snapshot: { company: { companyName: null, country: null, paymentTermDays: null, logoUrl: null } },
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
      .mockResolvedValueOnce([{ id: "22222222-2222-4222-8222-222222222222" }]);
    const { updateManagedUser } = await import("../server/systemSettingsPort");
    await expect(updateManagedUser(context, {
      userId: "22222222-2222-4222-8222-222222222222",
      fullName: "Phillip Kreile",
      shortCode: "PK",
      designation: "",
      active: true,
      pin: "0000",
    })).resolves.toEqual({ code: "OK" });
    expect(hash).toHaveBeenCalledWith("0000", 12);
    expect(execute.mock.calls[1]?.[0].text).toContain("tenant_id");
  });

  it("creates a login without a designation and persists the empty value as null", async () => {
    execute
      .mockResolvedValueOnce([{ id: "33333333-3333-4333-8333-333333333333", short_code: "NN" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const { createManagedUser } = await import("../server/systemSettingsPort");
    await expect(createManagedUser(context, {
      fullName: "Nina Neu",
      shortCode: "NN",
      designation: "   ",
      template: "werkstatt",
      pin: "2468",
    })).resolves.toMatchObject({
      code: "OK",
      user: { fullName: "Nina Neu", designation: "" },
    });
    expect(execute.mock.calls[0]?.[0].values).toContain(null);
  });

  it("reports the invalid login field precisely before database access", async () => {
    const { createManagedUser, updateManagedUser } = await import("../server/systemSettingsPort");
    await expect(createManagedUser(context, {
      fullName: "N",
      shortCode: "N",
      designation: "",
      template: "werkstatt",
      pin: "2468",
    })).resolves.toEqual({ code: "VALIDATION_ERROR", message: "Name muss 2 bis 160 Zeichen haben." });
    await expect(createManagedUser(context, {
      fullName: "Nina Neu",
      shortCode: "NINA",
      designation: "",
      template: "werkstatt",
      pin: "2468",
    })).resolves.toEqual({ code: "VALIDATION_ERROR", message: "Kürzel muss 1 bis 3 erlaubte Zeichen haben." });
    await expect(updateManagedUser(context, {
      userId: "22222222-2222-4222-8222-222222222222",
      fullName: "Phillip Kreile",
      shortCode: "PK",
      designation: "x".repeat(121),
      active: true,
      pin: null,
    })).resolves.toEqual({ code: "VALIDATION_ERROR", message: "Bezeichnung darf höchstens 120 Zeichen haben." });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("rejects inactive and developer business rights and attributes future grants", async () => {
    const { setManagedUserArea } = await import("../server/systemSettingsPort");

    execute.mockResolvedValueOnce([{ role: "meister", active: false }]);
    await expect(setManagedUserArea(context, {
      userId: "22222222-2222-4222-8222-222222222222",
      area: "auftraege",
      granted: true,
    })).resolves.toEqual({ code: "CONFLICT", message: "Inaktive Logins haben keine wirksamen Rechte." });

    execute.mockResolvedValueOnce([{ role: "developer", active: true }]);
    await expect(setManagedUserArea(context, {
      userId: "22222222-2222-4222-8222-222222222222",
      area: "geld",
      granted: true,
    })).resolves.toEqual({ code: "CONFLICT", message: "Entwickler dürfen keine Geschäftsvorgänge ausführen." });

    execute
      .mockResolvedValueOnce([{ role: "werkstatt", active: true }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await expect(setManagedUserArea(context, {
      userId: "22222222-2222-4222-8222-222222222222",
      area: "kunden",
      granted: true,
    })).resolves.toEqual({ code: "OK" });
    const grant = execute.mock.calls.at(-2)?.[0];
    expect(grant.text).toContain("granted_by");
    expect(grant.values).toContain(context.actorId);
  });
});
