import { beforeEach, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

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
      }]);
    const { readSystemSettings } = await import("../server/systemSettingsPort");
    await expect(readSystemSettings(context)).resolves.toMatchObject({
      code: "OK",
      snapshot: {
        company: { companyName: "Galvanik Kreile", paymentTermDays: 14 },
        users: [{ fullName: "Phillip", role: "werkstatt", active: true }],
      },
    });
  });

  it("fails closed before database access for non-admin and incomplete input", async () => {
    const { readSystemSettings, updateCompanySettings, updateManagedUser } = await import("../server/systemSettingsPort");
    await expect(readSystemSettings({ ...context, canManage: false })).resolves.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateCompanySettings(context, {})).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(updateManagedUser(context, { userId: "invalid" })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("hashes a new PIN server-side and updates only the selected tenant user", async () => {
    execute.mockResolvedValueOnce([{ id: "22222222-2222-4222-8222-222222222222" }]);
    const { updateManagedUser } = await import("../server/systemSettingsPort");
    await expect(updateManagedUser(context, {
      userId: "22222222-2222-4222-8222-222222222222",
      role: "werkstatt",
      active: true,
      pin: "7315",
    })).resolves.toEqual({ code: "OK" });
    expect(hash).toHaveBeenCalledWith("7315", 12);
    expect(execute.mock.calls[0]?.[0].text).toContain("tenant_id");
  });
});
