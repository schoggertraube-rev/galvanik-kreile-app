import { beforeEach, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

const { execute, withTransaction } = vi.hoisted(() => ({
  execute: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: withTransaction }));
vi.mock("drizzle-orm", () => ({
  sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }),
}));

const context = {
  tenantId: KREILE_TENANT_SLUG,
  userId: "11111111-1111-4111-8111-111111111111",
  capabilities: { canCreateCustomer: true, canManageMoney: false },
};
const updateInput = {
  clientEventId: "22222222-2222-4222-8222-222222222222",
  customerId: "customer-1",
  name: "Synthetischer Kunde",
  companyName: "Synthetik GmbH",
  contactPerson: "Test Person",
  email: "test@example.invalid",
  phone: "+49 000 123456",
  street: "Testweg 1",
  zipCode: "12345",
  city: "Teststadt",
  country: "Deutschland",
  paymentPreference: "rechnung_14",
  vatId: "DE123456789",
};

describe("customer payment guards", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    withTransaction.mockImplementation(async (_context, work) => work({ execute }));
  });

  it("lehnt ohne Bereich Geld jede Ã„nderung der Zahlungsbedingung ab", async () => {
    execute.mockResolvedValueOnce([{ payment_preference: "vorkasse" }]);
    const { updateCustomerCommercialCommand } = await import("../server/updateCustomerCommercialCommand");
    await expect(updateCustomerCommercialCommand(context, { ...updateInput, paymentPreference: "bar" }))
      .resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("lehnt auch mit Bereich Geld vorkasse zu Rechnung ohne Freischalt-Command ab", async () => {
    execute.mockResolvedValueOnce([{ payment_preference: "vorkasse" }]);
    const { updateCustomerCommercialCommand } = await import("../server/updateCustomerCommercialCommand");
    await expect(updateCustomerCommercialCommand({
      ...context,
      capabilities: { canCreateCustomer: true, canManageMoney: true },
    }, updateInput)).resolves.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("Ziel nicht freigeschaltet") });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("stellt Rechnung auf Ziel ausschlieÃŸlich Ã¼ber den Geld-Command frei", async () => {
    const { enableCustomerInvoiceTermsCommand } = await import("../server/enableCustomerInvoiceTermsCommand");
    const input = {
      clientEventId: "33333333-3333-4333-8333-333333333333",
      customerId: "customer-1",
      targetDays: 14,
      cashDiscountPercent: 2,
      cashDiscountDays: 10,
    };
    await expect(enableCustomerInvoiceTermsCommand(context, input)).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(withTransaction).not.toHaveBeenCalled();

    execute.mockResolvedValueOnce([{ result_code: "OK", replayed: false }]);
    await expect(enableCustomerInvoiceTermsCommand({
      ...context,
      capabilities: { canCreateCustomer: true, canManageMoney: true },
    }, input)).resolves.toMatchObject({ code: "OK", replayed: false });
    expect(execute.mock.calls[0]?.[0].text).toContain("private.enable_customer_invoice_terms_v1");
  });
});
