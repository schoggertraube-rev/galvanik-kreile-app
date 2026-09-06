import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveAuthorization, withTransaction, execute } = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  withTransaction: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization }));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: withTransaction }));
vi.mock("drizzle-orm", () => ({
  sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }),
}));

const ACTOR = "11111111-1111-4111-8111-111111111111";
const CLIENT = "22222222-2222-4222-8222-222222222222";
const CUSTOMER = "customer-a";
const ORDER = "33333333-3333-4333-8333-333333333333";
const EVENT = "44444444-4444-4444-8444-444444444444";
const CORRELATION = "55555555-5555-4555-8555-555555555555";
const ITEM = "66666666-6666-4666-8666-666666666666";
const RECEIPT = "77777777-7777-4777-8777-777777777777";
const input = {
  clientEventId: CLIENT,
  customer: { mode: "EXISTING" as const, customerId: CUSTOMER },
  dueDate: "2026-08-30",
  note: "Eilige Annahme",
  items: [{ name: "Grundplatte", quantity: 2, material: "Stahl", surfaceRequested: "Glanzverchromen" }],
};
const intentSha256 = createHash("sha256").update(JSON.stringify({
  clientEventId: CLIENT,
  customer: input.customer,
  dueDate: input.dueDate,
  items: input.items,
  note: input.note,
})).digest("hex");
const itemSnapshot = [{ id: ITEM, position: 1, ...input.items[0] }];
const receiptRow = {
  receipt_id: RECEIPT,
  event_id: EVENT,
  tenant_id: "galvanik-kreile",
  order_id: ORDER,
  customer_id: CUSTOMER,
  actor_id: ACTOR,
  client_event_id: CLIENT,
  correlation_id: CORRELATION,
  intent_sha256: intentSha256,
  customer_mode: "EXISTING",
  order_number: "A-2026-0042",
  customer_display_name: "Kunde A",
  due_date: "2026-08-30",
  note: "Eilige Annahme",
  items_snapshot: itemSnapshot,
  recorded_at: "2026-08-12T12:00:00.000Z",
  current_order_version: 1,
  current_station: "wareneingang",
  current_status: "angenommen",
  integrity_ok: true,
};

const authorization = {
  ok: true as const,
  data: {
    userId: ACTOR,
    tenantId: "galvanik-kreile",
    displayName: "Büro",
    role: "buero" as const,
    permissions: ["perm_data_customers", "perm_data_orders", "perm_view_customers", "perm_view_leitstand"] as const,
    active: true as const,
  },
};

describe("createOrderIntake", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resolveAuthorization.mockResolvedValue(authorization);
    withTransaction.mockImplementation(async (_authorization, work) => work({ execute }));
  });

  it("rejects malformed runtime input before auth or database access", async () => {
    const { createOrderIntake } = await import("../orderIntakeCommand");
    await expect(createOrderIntake({ ...input, tenantId: "foreign" })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createOrderIntake({ ...input, items: [] })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createOrderIntake({ ...input, dueDate: "2026-02-30" })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(resolveAuthorization).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("denies missing sessions, roles, and unauthorized new-customer creation without a transaction", async () => {
    const { createOrderIntake } = await import("../orderIntakeCommand");
    resolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "NO_SESSION", message: "no" });
    await expect(createOrderIntake(input)).resolves.toMatchObject({ code: "UNAUTHENTICATED" });
    resolveAuthorization.mockResolvedValueOnce({ ...authorization, data: { ...authorization.data, permissions: ["perm_view_leitstand"] } });
    await expect(createOrderIntake(input)).resolves.toMatchObject({ code: "FORBIDDEN" });
    resolveAuthorization.mockResolvedValueOnce({ ...authorization, data: { ...authorization.data, permissions: ["perm_data_orders"] } });
    await expect(createOrderIntake({
      ...input,
      customer: { mode: "NEW", name: "Neu", customerType: "business", companyName: null, contactPerson: null, email: null, phone: null, city: null },
    })).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("creates customer-bound order, item, immutable event and receipt before returning exact fresh readback", async () => {
    const created = { orderId: "", eventId: "", correlationId: "", itemId: "", receiptId: "" };
    execute.mockImplementation((query: { text: string; values: unknown[] }) => {
      if (query.text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (query.text.includes("FROM private.order_intake_receipts") && !query.text.includes("v_order")) return Promise.resolve([]);
      if (query.text.includes("FROM public.customers")) return Promise.resolve([{ id: CUSTOMER, tenant_id: "galvanik-kreile", name: "Kunde A", company_name: null }]);
      if (query.text.includes("next_number")) return Promise.resolve([{ current_year: 2026, next_number: 42 }]);
      if (query.text.includes("INSERT INTO public.orders")) {
        created.orderId = String(query.values[0]);
        return Promise.resolve([{
          id: created.orderId,
          tenant_id: "galvanik-kreile",
          order_number: "A-2026-0042",
          version: 1,
          payment_mode: "vorkasse",
          payment_mode_version: 0,
        }]);
      }
      if (query.text.includes("INSERT INTO public.items")) {
        created.itemId = String(query.values[0]);
        return Promise.resolve([{ id: created.itemId, tenant_id: "galvanik-kreile", order_id: created.orderId, customer_id: CUSTOMER }]);
      }
      if (query.text.includes("INSERT INTO public.events")) {
        created.eventId = String(query.values[0]);
        created.correlationId = String(query.values[10]);
        return Promise.resolve([{ id: created.eventId, tenant_id: "galvanik-kreile", order_id: created.orderId, user_id: ACTOR, client_event_id: CLIENT }]);
      }
      if (query.text.includes("INSERT INTO private.order_intake_receipts")) {
        created.receiptId = String(query.values[0]);
        return Promise.resolve([{ id: created.receiptId, event_id: created.eventId, order_id: created.orderId, intent_sha256: intentSha256 }]);
      }
      if (query.text.includes("private.v_order_intake_receipts_v1")) return Promise.resolve([{
        ...receiptRow,
        receipt_id: created.receiptId,
        event_id: created.eventId,
        order_id: created.orderId,
        correlation_id: created.correlationId,
        items_snapshot: [{ ...itemSnapshot[0], id: created.itemId }],
      }]);
      throw new Error(`unexpected SQL ${query.text}`);
    });
    const { createOrderIntake } = await import("../orderIntakeCommand");
    const result = await createOrderIntake(input);
    expect(result).toEqual({
      code: "OK",
      replayed: false,
      receipt: {
        receiptId: created.receiptId,
        eventId: created.eventId,
        orderId: created.orderId,
        orderNumber: "A-2026-0042",
        customerId: CUSTOMER,
        customerDisplayName: "Kunde A",
        customerMode: "EXISTING",
        clientEventId: CLIENT,
        correlationId: created.correlationId,
        actorId: ACTOR,
        dueDate: "2026-08-30",
        note: "Eilige Annahme",
        items: [{ ...itemSnapshot[0], id: created.itemId }],
        recordedAt: "2026-08-12T12:00:00.000Z",
        orderVersion: 1,
        station: "wareneingang",
        status: "angenommen",
      },
    });
    const sqlText = execute.mock.calls.map(([query]) => query.text).join("\n");
    expect(sqlText).toContain("INSERT INTO public.orders");
    expect(sqlText).toContain("INSERT INTO public.items");
    expect(sqlText).toContain("INSERT INTO public.events");
    expect(sqlText).toContain("INSERT INTO private.order_intake_receipts");
    expect(sqlText).toContain("private.v_order_intake_receipts_v1");
    const orderInsert = execute.mock.calls
      .map(([query]) => query)
      .find((query) => query.text.includes("INSERT INTO public.orders"));
    expect(orderInsert?.text.split(") VALUES")[0]).not.toContain("payment_mode");
    expect(orderInsert?.text).toContain("payment_mode_version");
    expect(sqlText).not.toMatch(/createClient|supabase|rpc\(/i);
  });

  it("replays exactly one matching receipt and rejects client-event reuse without new rows", async () => {
    execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ intent_sha256: intentSha256 }])
      .mockResolvedValueOnce([receiptRow]);
    const { createOrderIntake } = await import("../orderIntakeCommand");
    await expect(createOrderIntake(input)).resolves.toMatchObject({ code: "OK", replayed: true, receipt: { receiptId: RECEIPT } });
    expect(execute.mock.calls.map(([query]) => query.text).join("\n")).not.toContain("INSERT INTO public.orders");

    execute.mockReset();
    execute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ intent_sha256: "0".repeat(64) }]);
    await expect(createOrderIntake(input)).resolves.toMatchObject({ code: "CONFLICT" });
    expect(execute.mock.calls.map(([query]) => query.text).join("\n")).not.toContain("INSERT INTO public.orders");
  });

  it("maps any post-mutation exception or malformed readback to UNAVAILABLE, never success", async () => {
    execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("db"));
    const { createOrderIntake } = await import("../orderIntakeCommand");
    await expect(createOrderIntake(input)).resolves.toEqual({
      code: "UNAVAILABLE",
      message: "Wareneingang konnte nicht sicher gespeichert werden.",
    });
  });
});
