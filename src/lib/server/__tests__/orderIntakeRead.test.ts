import { beforeEach, describe, expect, it, vi } from "vitest";
import { ORDER_LIFECYCLE_STATUS } from "@/lib/orders/orderLifecycleContract";

const { withTransaction, execute } = vi.hoisted(() => ({ withTransaction: vi.fn(), execute: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: withTransaction }));
vi.mock("drizzle-orm", () => ({ sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }) }));

const authorization = { tenantId: "galvanik-kreile", userId: "11111111-1111-4111-8111-111111111111" };
const orderId = "22222222-2222-4222-8222-222222222222";
const clientEventId = "33333333-3333-4333-8333-333333333333";
const receiptRow = {
  receipt_id: "44444444-4444-4444-8444-444444444444",
  event_id: "55555555-5555-4555-8555-555555555555",
  tenant_id: "galvanik-kreile",
  order_id: orderId,
  customer_id: "legacy-customer",
  actor_id: authorization.userId,
  client_event_id: clientEventId,
  correlation_id: "66666666-6666-4666-8666-666666666666",
  customer_mode: "EXISTING",
  order_number: "A-2026-0042",
  customer_display_name: "Musterkunde",
  due_date: "2026-08-30",
  note: null,
  items_snapshot: [{
    id: "77777777-7777-4777-8777-777777777777",
    position: 1,
    name: "Grundplatte",
    quantity: 2,
    material: "Stahl",
    surfaceRequested: "Verchromen",
  }],
  recorded_at: "2026-08-12T12:00:00.000Z",
  current_order_version: 1,
  current_station: "wareneingang",
  current_status: ORDER_LIFECYCLE_STATUS.ANGENOMMEN,
  integrity_ok: true,
};

describe("order intake read ports", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    withTransaction.mockImplementation(async (_authorization, work) => work({ execute }));
  });

  it("uses the private tenant customer view, caps results, and rejects malformed rows", async () => {
    execute.mockResolvedValueOnce([{
      id: "customer-a", tenant_id: "galvanik-kreile", customer_number: "K-1", name: "Musterkunde",
      company_name: null, customer_type: "business", city: "Berlin", orders_count: 3, integrity_ok: true,
    }]);
    const { searchOrderIntakeCustomers } = await import("../orderIntakeRead");
    await expect(searchOrderIntakeCustomers(authorization, { query: "muster" })).resolves.toEqual([{
      id: "customer-a", customerNumber: "K-1", name: "Musterkunde", companyName: null,
      customerType: "business", city: "Berlin", ordersCount: 3,
    }]);
    expect(execute.mock.calls[0]?.[0].text).toContain("private.v_order_intake_customers_v1");
    expect(execute.mock.calls[0]?.[0].text).toContain("LIMIT 20");

    execute.mockResolvedValueOnce([{ id: "foreign", tenant_id: "tenant-b", integrity_ok: true }]);
    await expect(searchOrderIntakeCustomers(authorization, { query: "" })).rejects.toThrow("READMODEL_INVALID");
    await expect(searchOrderIntakeCustomers(authorization, { query: " x" })).rejects.toThrow("INPUT_INVALID");
  });

  it("returns one exact actor-bound immutable receipt and fails closed on absence or drift", async () => {
    const { readOrderIntakeReceipt } = await import("../orderIntakeRead");
    execute.mockResolvedValueOnce([receiptRow]);
    await expect(readOrderIntakeReceipt(authorization, { orderId, clientEventId })).resolves.toMatchObject({
      receiptId: receiptRow.receipt_id,
      orderId,
      customerId: "legacy-customer",
      items: [{ id: receiptRow.items_snapshot[0]!.id, position: 1 }],
    });
    expect(execute.mock.calls[0]?.[0].text).toContain("actor_id = ?");
    expect(execute.mock.calls[0]?.[0].text).toContain("client_event_id = ?");

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
});
