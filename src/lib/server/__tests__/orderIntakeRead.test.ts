import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ORDER_LIFECYCLE_STATUS } from "@/modules/orders/public";

const { withTransaction, execute } = vi.hoisted(() => ({ withTransaction: vi.fn(), execute: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: withTransaction }));
vi.mock("drizzle-orm", () => ({ sql: Object.assign((parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }),{join:(parts:Array<{text:string}>,separator:{text:string})=>({text:parts.map(part=>part.text).join(separator.text),values:[]})}) }));

const authorization = { tenantId: KREILE_TENANT_SLUG, userId: "11111111-1111-4111-8111-111111111111" };
const orderId = "22222222-2222-4222-8222-222222222222";
const clientEventId = "33333333-3333-4333-8333-333333333333";
const receiptRow = {
  receipt_id: "44444444-4444-4444-8444-444444444444",
  event_id: "55555555-5555-4555-8555-555555555555",
  tenant_id: KREILE_TENANT_SLUG,
  order_id: orderId,
  customer_id: "legacy-customer",
  actor_id: authorization.userId,
  client_event_id: clientEventId,
  correlation_id: "66666666-6666-4666-8666-666666666666",
  customer_mode: "EXISTING",
  order_number: "A-2026-0042",
  customer_display_name: "Musterkunde",
  due_date: "2026-08-30",
  intake_term_status: "bestaetigt",
  intake_source: "persoenlich",
  note: null,
  items_snapshot: [{
    id: "77777777-7777-4777-8777-777777777777",
    position: 1,
    name: "Grundplatte",
    quantity: 2,
    material: "Stahl",
    surfaceRequested: "Verchromen",
    executionRequested: "hochglanz",
    catalogServiceId:"88888888-8888-4888-8888-888888888888",
    unit:"Stück",
    unitPriceCents:1250,
    vatRateBasisPoints:1900,
  }],
  recorded_at: "2026-08-12T12:00:00.000Z",
  current_order_version: 1,
  current_station: "angenommen",
  current_status: ORDER_LIFECYCLE_STATUS.ANGENOMMEN,
  handover_mode: "pickup",
  payment_mode: "abholung",
  integrity_ok: true,
};

describe("order intake read ports", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    withTransaction.mockImplementation(async (_authorization, work) => work({ execute }));
  });

  it("uses the private tenant customer view, caps results, and rejects malformed rows", async () => {
    const customerRow={
      id: "customer-a", tenant_id: KREILE_TENANT_SLUG, customer_number: "K-1", name: "Musterkunde",
      company_name: null, customer_type: "business",salutation:null,first_name:"Ada",last_name:"Beispiel",contact_role:null,house_number:"1",handover_preference:"shipping",ziel_freigeschaltet:false,ziel_tage:null,auto_info:true,vorrang:false, phone: "03012345",
      email: "ada@example.test", street: "Testweg 1", zip_code: "10115", city: "Berlin", country: "DE",
      payment_preference: "vorkasse", vat_id: null,  orders_count: 3, integrity_ok: true,
    };
    execute.mockResolvedValueOnce([customerRow]);
    const { searchOrderIntakeCustomers } = await import("../orderIntakeRead");
    await expect(searchOrderIntakeCustomers(authorization, { query: "muster" })).resolves.toEqual([{
      id: "customer-a", customerNumber: "K-1", name: "Musterkunde", companyName: null,
      customerType: "business",salutation:null,firstName:"Ada",lastName:"Beispiel",contactRole:null,houseNumber:"1",invoiceTermsEnabled:false,invoiceTermDays:null,autoInfo:true,vorrang:false,duplicateMatch:null,contactPerson: "Ada Beispiel", phone: "03012345", email: "ada@example.test",
      street: "Testweg 1", zipCode: "10115", city: "Berlin", country: "DE",
      paymentPreference: "vorkasse", vatId: null, handoverPreference: "shipping", ordersCount: 3,
    }]);
    expect(execute.mock.calls[0]?.[0].text).toContain("private.v_order_intake_customers_v1");
    expect(execute.mock.calls[0]?.[0].text).toContain("private.v_order_intake_customers_v1");
    expect(execute.mock.calls[0]?.[0].text).toContain("customer.customer_type");

    execute.mockResolvedValueOnce(Array.from({length:11},(_,index)=>({...customerRow,id:"customer-"+String(index).padStart(2,"0"),name:"Musterkunde "+String(index).padStart(2,"0")})));
    const capped=await searchOrderIntakeCustomers(authorization,{query:"muster"});
    expect(capped).toHaveLength(10);
    expect(capped.map(row=>row.id)).toEqual(["customer-00","customer-01","customer-02","customer-03","customer-04","customer-05","customer-06","customer-07","customer-08","customer-09"]);
    execute.mockResolvedValueOnce([{ id: "foreign", tenant_id: "tenant-b", integrity_ok: true }]);
    await expect(searchOrderIntakeCustomers(authorization, { query: "muster" })).rejects.toThrow("READMODEL_INVALID");
    await expect(searchOrderIntakeCustomers(authorization, { query: " x" })).rejects.toThrow("INPUT_INVALID");
  });

  it("returns one exact actor-bound immutable receipt and fails closed on absence or drift", async () => {
    const { readOrderIntakeReceipt } = await import("../orderIntakeRead");
    execute.mockResolvedValueOnce([receiptRow]);
    await expect(readOrderIntakeReceipt(authorization, { orderId, clientEventId })).resolves.toMatchObject({
      receiptId: receiptRow.receipt_id,
      orderId,
      customerId: "legacy-customer",
      handoverMode: "pickup",
      paymentMode: "abholung",
      items: [{ id: receiptRow.items_snapshot[0]!.id, position: 1, executionRequested: "hochglanz" }],
    });
    expect(execute.mock.calls[0]?.[0].text).toContain("actor_id = ?");
    expect(execute.mock.calls[0]?.[0].text).toContain("client_event_id = ?");
    const receiptSelect = execute.mock.calls[0]?.[0].text ?? "";
    for (const validatedColumn of Object.keys(receiptRow)) {
      expect(receiptSelect, `validated receipt column missing from SELECT: ${validatedColumn}`)
        .toMatch(new RegExp(`\\b${validatedColumn}\\b`));
    }

    execute.mockResolvedValueOnce([]);
    await expect(readOrderIntakeReceipt(authorization, { orderId, clientEventId })).resolves.toBeNull();
    execute.mockResolvedValueOnce([{ ...receiptRow, tenant_id: "tenant-b" }]);
    await expect(readOrderIntakeReceipt(authorization, { orderId, clientEventId })).rejects.toThrow("RECEIPT_INVALID");
    execute.mockResolvedValueOnce([receiptRow, receiptRow]);
    await expect(readOrderIntakeReceipt(authorization, { orderId, clientEventId })).rejects.toThrow("AMBIGUOUS");
  });

  it("rejects extra tenant input and malformed identifiers before opening a transaction", async () => {
    const { readOrderIntakeReceipt, searchOrderIntakeCustomers } = await import("../orderIntakeRead");
    await expect(readOrderIntakeReceipt(authorization, { orderId, clientEventId, tenantId: "tenant-b" })).rejects.toThrow("INPUT_INVALID");
    await expect(searchOrderIntakeCustomers(authorization, { query: "x", tenantId: "tenant-b" })).rejects.toThrow("INPUT_INVALID");
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it.each(["Stück", "kg", "dm²", "Satz", "Std."])("reads an allowed free-text unit %s from the immutable receipt", async (unit) => {
    const { readOrderIntakeReceipt } = await import("../orderIntakeRead");
    execute.mockResolvedValueOnce([{
      ...receiptRow,
      items_snapshot: [{
        ...receiptRow.items_snapshot[0],
        catalogServiceId: null,
        unit,
        unitPriceCents: null,
        vatRateBasisPoints: null,
      }],
    }]);

    await expect(readOrderIntakeReceipt(authorization, { orderId, clientEventId })).resolves.toMatchObject({
      items: [{ catalogServiceId: null, unit, unitPriceCents: null, vatRateBasisPoints: null }],
    });
  });
});
