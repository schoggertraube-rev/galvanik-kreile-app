import { beforeEach, describe, expect, it, vi } from "vitest";

const { execute, withTransaction } = vi.hoisted(() => ({
  execute: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: withTransaction }));
vi.mock("drizzle-orm", () => ({
  sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }),
}));

const TENANT = "tenant-customer-command";
const ACTOR = "11111111-1111-4111-8111-111111111111";
const CLIENT = "22222222-2222-4222-8222-222222222222";
const CUSTOMER = "33333333-3333-4333-8333-333333333333";
const EVENT = "44444444-4444-4444-8444-444444444444";
const RECEIPT = "55555555-5555-4555-8555-555555555555";
const CORRELATION = "66666666-6666-4666-8666-666666666666";
const input = {
  city: "Kreile-Teststadt",
  clientEventId: CLIENT,
  companyName: "Synthetik GmbH",
  salutation:"ohne" as const,firstName:"Test",lastName:"Person",houseNumber:"1",
  customerType: "business" as const,
  email: "synthetisch@example.invalid",
  phone: "+49 000 12345",
  street: "Testweg",
  zipCode: "12345",
  country: "DE",
  paymentPreference: "vorkasse",
  vatId: "DE123456789",
  notes: "Synthetische Telefonnotiz",
};
let intentSha256="";
const authorization = { tenantId: TENANT, userId: ACTOR, capabilities: { canCreateCustomer: true, canManageMoney: true } };
const receiptRow = {
  receipt_id: RECEIPT,
  event_id: EVENT,
  tenant_id: TENANT,
  customer_id: CUSTOMER,
  customer_number: "K-2026-0042",
  actor_id: ACTOR,
  client_event_id: CLIENT,
  correlation_id: CORRELATION,
  intent_sha256: intentSha256,
  name: input.companyName,
  customer_type: input.customerType,
  company_name: input.companyName,
  contact_person: null,
  email: input.email,
  phone: input.phone,
  city: input.city,
  street: input.street,
  zip_code: input.zipCode,
  country: input.country,
  payment_preference: input.paymentPreference,
  vat_id: input.vatId,
  notes: input.notes,
  recorded_at: "2026-09-14T10:00:00.000Z",
  integrity_ok: true,
};

describe("createCustomerCommand", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    withTransaction.mockImplementation(async (_authorization, work) => work({ execute }));
  });

  it("validiert die exakte Eingabe und Berechtigung vor jedem DB-Zugriff", async () => {
    const { createCustomerCommand } = await import("../server/createCustomerCommand");
    await expect(createCustomerCommand(authorization, { ...input, tenantId: "foreign" })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createCustomerCommand(authorization, { ...input, email: "ungueltig" })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createCustomerCommand({ ...authorization, capabilities: { canCreateCustomer: false, canManageMoney: true } }, input)).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("vergibt die Nummer DB-seitig und liefert erst nach Event-, Receipt- und Integritäts-Readback Erfolg", async () => {
    execute.mockImplementation((query: { text: string; values: unknown[] }) => {
      if(query.text.includes("address_directory"))return Promise.resolve([]);
      if(query.text.includes("FROM public.customers"))return Promise.resolve([{...input,id:CUSTOMER,customerNumber:"K-2026-0042",name:input.companyName,contactRole:null,billingEmail:null,website:null,handoverPreference:null,iban:null,paymentTermDays:null,autoInfo:true,vorrang:false,invoiceTermsEnabled:false,invoiceTermDays:null,addressStatus:null}]);
      if (query.text.includes("private.create_customer_v2")) { intentSha256=String(query.values[3]);return Promise.resolve([{ result_code: "OK", result_receipt_id: RECEIPT, replayed: false }]);}
      if (query.text.includes("private.v_customer_create_receipts_v1")) return Promise.resolve([{...receiptRow,intent_sha256:intentSha256}]);
      throw new Error(`unexpected SQL ${query.text}`);
    });
    const { createCustomerCommand } = await import("../server/createCustomerCommand");
    const result = await createCustomerCommand(authorization, input);
    expect(result).toMatchObject({
      code: "OK",
      replayed: false,
      receipt: {
        customerId: CUSTOMER,
        customerNumber: "K-2026-0042",
        clientEventId: CLIENT,
        notes: input.notes,
        aggregateVersion: 1,
      },
    });
    const statements = execute.mock.calls.map(([query]) => query.text).join("\n");
    expect(statements).toContain("private.create_customer_v2");
    expect(statements).toContain("private.v_customer_create_receipts_v1");
    expect(statements).not.toMatch(/max\s*\(/i);
  });

  it("legt einen Interessenten mit Name und Telefon über denselben nummerierten Schreibweg an", async () => {
    const prospectInput = {
      city: null,
      clientEventId: CLIENT,
      companyName: "Synthetischer Interessent",
      customerType: "business" as const,
      email: null,
      phone: "+49 000 54321",
      street: null,
      zipCode: null,
      country: null,
      paymentPreference: null,
      vatId: null,
      notes: null,
    };
    let prospectHash="";
    execute.mockImplementation((query: { text: string; values: unknown[] }) => {
      if(query.text.includes("address_directory"))return Promise.resolve([]);
      if(query.text.includes("FROM public.customers"))return Promise.resolve([{...prospectInput,id:CUSTOMER,customerNumber:"K-2026-0042",name:prospectInput.companyName,contactRole:null,billingEmail:null,website:null,handoverPreference:null,iban:null,paymentTermDays:null,autoInfo:true,vorrang:false,invoiceTermsEnabled:false,invoiceTermDays:null,addressStatus:null}]);
      if (query.text.includes("private.create_customer_v2")) { prospectHash=String(query.values[3]);return Promise.resolve([{ result_code: "OK", result_receipt_id: RECEIPT, replayed: false }]);}
      if (query.text.includes("private.v_customer_create_receipts_v1")) return Promise.resolve([{
        ...receiptRow,
        intent_sha256: prospectHash,
        name: prospectInput.companyName,
        company_name: prospectInput.companyName,
        contact_person: null,
        email: null,
        phone: prospectInput.phone,
        city: null,
        street: null,
        zip_code: null,
        country: null,
        payment_preference: null,
        vat_id: null,
        notes: null,
      }]);
      throw new Error(`unexpected SQL ${query.text}`);
    });
    const { createCustomerCommand } = await import("../server/createCustomerCommand");
    await expect(createCustomerCommand(authorization, prospectInput)).resolves.toMatchObject({
      code: "OK",
      receipt: {
        customerNumber: "K-2026-0042",
        name: prospectInput.companyName,
        phone: prospectInput.phone,
        street: null,
        paymentPreference: null,
      },
    });
  });

  it("spielt denselben Intent exakt wieder ab und weist abweichenden Intent ohne Write ab", async () => {
    execute.mockImplementation((query:{text:string;values:unknown[]})=>{
      if(query.text.includes("address_directory"))return Promise.resolve([]);
      if(query.text.includes("create_customer_v2")){intentSha256=String(query.values[3]);return Promise.resolve([{result_code:"OK",result_receipt_id:RECEIPT,replayed:true}]);}
      if(query.text.includes("v_customer_create_receipts_v1"))return Promise.resolve([{...receiptRow,intent_sha256:intentSha256}]);
      if(query.text.includes("FROM public.customers"))return Promise.resolve([{...input,id:CUSTOMER,customerNumber:"K-2026-0042",name:input.companyName}]);
      throw new Error("unexpected SQL "+query.text);
    });
    const { createCustomerCommand } = await import("../server/createCustomerCommand");
    await expect(createCustomerCommand(authorization, input)).resolves.toMatchObject({ code: "OK", replayed: true, receipt: { receiptId: RECEIPT } });
    expect(execute.mock.calls.map(([query]) => query.text).join("\n")).toContain("private.create_customer_v2");

    execute.mockReset();
    execute.mockImplementation((query:{text:string})=>Promise.resolve(query.text.includes("address_directory")?[]:[{ result_code: "CONFLICT", result_receipt_id: null, replayed: false }]));
    await expect(createCustomerCommand(authorization, input)).resolves.toMatchObject({ code: "CONFLICT" });
    expect(execute.mock.calls.filter(([query])=>query.text.includes("create_customer_v2"))).toHaveLength(1);
  });

  it("bleibt bei unvollständigem oder fremdem Receipt fail-closed", async () => {
    execute.mockImplementation((query:{text:string;values:unknown[]})=>{if(query.text.includes("address_directory"))return Promise.resolve([]);if(query.text.includes("create_customer_v2")){intentSha256=String(query.values[3]);return Promise.resolve([{result_code:"OK",result_receipt_id:RECEIPT,replayed:true}]);}return Promise.resolve([{...receiptRow,intent_sha256:intentSha256,tenant_id:"foreign"}]);});
    const { createCustomerCommand } = await import("../server/createCustomerCommand");
    await expect(createCustomerCommand(authorization, input)).resolves.toMatchObject({ code: "UNAVAILABLE" });
  });
});
