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
  capabilities: { canCreateCustomer: true,canEditCustomer:true, canManageMoney: false },
};
const profile={id:"customer-1",customerNumber:"K-2026-0001",name:"Synthetik GmbH",customerType:"business",companyName:"Synthetik GmbH",salutation:"ohne",firstName:"Test",lastName:"Person",contactRole:null,email:"test@example.invalid",phone:"0711 123456",street:"Testweg",houseNumber:"1",zipCode:"12345",city:"Teststadt",country:"DE",paymentPreference:"vorkasse",iban:null,paymentTermDays:null,autoInfo:true,vorrang:false,invoiceTermsEnabled:false,invoiceTermDays:null,addressStatus:null,billingEmail:null,website:null,vatId:null,notes:null};
const updateInput={clientEventId:"22222222-2222-4222-8222-222222222222",customerId:"customer-1",paymentPreference:"rechnung"};

describe("customer payment guards", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    withTransaction.mockImplementation(async (_context, work) => work({ execute }));
  });

  it("lehnt ohne Bereich Geld jede Ã„nderung der Zahlungsbedingung ab", async () => {
    execute.mockResolvedValueOnce([profile]);
    const { updateCustomerCommand } = await import("../server/updateCustomerCommand");
    await expect(updateCustomerCommand(context, { ...updateInput, paymentPreference: "bar" }))
      .resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("lehnt auch mit Bereich Geld vorkasse zu Rechnung ohne Freischalt-Command ab", async () => {
    execute.mockResolvedValueOnce([profile]);
    const { updateCustomerCommand } = await import("../server/updateCustomerCommand");
    await expect(updateCustomerCommand({
      ...context,
      capabilities: { canCreateCustomer: true,canEditCustomer:true, canManageMoney: true },
    }, updateInput)).resolves.toMatchObject({ code: "VALIDATION_ERROR", message: expect.stringContaining("Ziel nicht freigeschaltet") });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("accepts an invoice preference only with the stored approval", async () => {
    execute
      .mockResolvedValueOnce([{...profile,paymentPreference:"rechnung",invoiceTermsEnabled:true,invoiceTermDays:14}])
      .mockResolvedValueOnce([]) // SAVEPOINT around the existing customer writer.
      .mockResolvedValueOnce([{ result_code: "OK", replayed: false }])
      .mockResolvedValueOnce([]) // RELEASE SAVEPOINT after the successful result.
      .mockResolvedValueOnce([{...profile,paymentPreference:"rechnung",invoiceTermsEnabled:true,invoiceTermDays:14}]);
    const { updateCustomerCommand } = await import("../server/updateCustomerCommand");
    await expect(updateCustomerCommand({
      ...context,
      capabilities: { canCreateCustomer: true,canEditCustomer:true, canManageMoney: true },
    }, updateInput)).resolves.toMatchObject({ code: "OK", replayed: false, customer:{id:profile.id,paymentPreference:"rechnung"} });
    expect(execute.mock.calls[1]?.[0].text).toContain('SAVEPOINT kreile_customer_update_command');
    expect(execute.mock.calls[3]?.[0].text).toContain('RELEASE SAVEPOINT kreile_customer_update_command');
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
      capabilities: { canCreateCustomer: true,canEditCustomer:true, canManageMoney: true },
    }, input)).resolves.toMatchObject({ code: "OK", replayed: false });
    expect(execute.mock.calls[0]?.[0].text).toContain("private.enable_customer_invoice_terms_v1");
  });
  it("returns readable UTF-8 invoice-terms validation and source errors", async () => {
    const { enableCustomerInvoiceTermsCommand } = await import("../server/enableCustomerInvoiceTermsCommand");
    const auth = {...context, capabilities:{...context.capabilities,canManageMoney:true}};
    const input={clientEventId:"33333333-3333-4333-8333-333333333333",customerId:"customer-1",targetDays:14,cashDiscountPercent:2,cashDiscountDays:10};
    await expect(enableCustomerInvoiceTermsCommand(auth,null)).resolves.toMatchObject({code:"VALIDATION_ERROR",message:"Zahlungsziel oder Skonto ist ungültig."});
    for(const [code,message] of [["NOT_FOUND","Kunde ist nicht verfügbar."],["VALIDATION_ERROR","Zahlungsziel oder Skonto ist ungültig."],["INCOMPLETE","Rechnung auf Ziel braucht vollständige Kundendaten."]]){
      execute.mockResolvedValueOnce([{result_code:code,replayed:false}]);
      await expect(enableCustomerInvoiceTermsCommand(auth,input)).resolves.toMatchObject({code,message});
    }
  });

});
