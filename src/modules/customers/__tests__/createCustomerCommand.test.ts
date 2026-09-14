import { createHash } from "node:crypto";
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
  contactPerson: "Test Person",
  customerType: "business" as const,
  email: "synthetisch@example.invalid",
  name: "Synthetischer Kunde",
  phone: "+49 000 12345",
};
const intentSha256 = createHash("sha256").update(JSON.stringify(input), "utf8").digest("hex");
const authorization = { tenantId: TENANT, userId: ACTOR, permissions: ["perm_data_customers"] };
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
  name: input.name,
  customer_type: input.customerType,
  company_name: input.companyName,
  contact_person: input.contactPerson,
  email: input.email,
  phone: input.phone,
  city: input.city,
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
    await expect(createCustomerCommand({ ...authorization, permissions: [] }, input)).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("vergibt die Nummer DB-seitig und liefert erst nach Event-, Receipt- und Integritäts-Readback Erfolg", async () => {
    const created = { customerId: "", eventId: "", receiptId: "", correlationId: "" };
    execute.mockImplementation((query: { text: string; values: unknown[] }) => {
      if (query.text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (query.text.includes("FROM private.customer_create_receipts") && !query.text.includes("v_customer")) return Promise.resolve([]);
      if (query.text.includes("private.allocate_customer_number")) return Promise.resolve([{ customer_number: "K-2026-0042" }]);
      if (query.text.includes("INSERT INTO public.customers")) {
        created.customerId = String(query.values[0]);
        return Promise.resolve([{ id: created.customerId, tenant_id: TENANT, customer_number: "K-2026-0042" }]);
      }
      if (query.text.includes("INSERT INTO public.events")) {
        created.eventId = String(query.values[0]);
        created.correlationId = String(query.values[6]);
        return Promise.resolve([{ id: created.eventId, tenant_id: TENANT, user_id: ACTOR, client_event_id: CLIENT }]);
      }
      if (query.text.includes("INSERT INTO private.customer_create_receipts")) {
        created.receiptId = String(query.values[0]);
        return Promise.resolve([{ id: created.receiptId, event_id: created.eventId, customer_id: created.customerId, intent_sha256: intentSha256 }]);
      }
      if (query.text.includes("private.v_customer_create_receipts_v1")) return Promise.resolve([{
        ...receiptRow,
        receipt_id: created.receiptId,
        event_id: created.eventId,
        customer_id: created.customerId,
        correlation_id: created.correlationId,
      }]);
      throw new Error(`unexpected SQL ${query.text}`);
    });
    const { createCustomerCommand } = await import("../server/createCustomerCommand");
    const result = await createCustomerCommand(authorization, input);
    expect(result).toMatchObject({
      code: "OK",
      replayed: false,
      receipt: {
        customerId: created.customerId,
        customerNumber: "K-2026-0042",
        clientEventId: CLIENT,
        aggregateVersion: 1,
      },
    });
    const statements = execute.mock.calls.map(([query]) => query.text).join("\n");
    expect(statements).toContain("private.allocate_customer_number");
    expect(statements).toContain("INSERT INTO public.customers");
    expect(statements).toContain("INSERT INTO public.events");
    expect(statements).toContain("INSERT INTO private.customer_create_receipts");
    expect(statements).toContain("private.v_customer_create_receipts_v1");
    expect(statements).not.toMatch(/max\s*\(/i);
  });

  it("spielt denselben Intent exakt wieder ab und weist abweichenden Intent ohne Write ab", async () => {
    execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ intent_sha256: intentSha256 }])
      .mockResolvedValueOnce([receiptRow]);
    const { createCustomerCommand } = await import("../server/createCustomerCommand");
    await expect(createCustomerCommand(authorization, input)).resolves.toMatchObject({ code: "OK", replayed: true, receipt: { receiptId: RECEIPT } });
    expect(execute.mock.calls.map(([query]) => query.text).join("\n")).not.toContain("INSERT INTO public.customers");

    execute.mockReset();
    execute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ intent_sha256: "0".repeat(64) }]);
    await expect(createCustomerCommand(authorization, input)).resolves.toMatchObject({ code: "CONFLICT" });
    expect(execute.mock.calls.map(([query]) => query.text).join("\n")).not.toContain("INSERT INTO public.customers");
  });

  it("bleibt bei unvollständigem oder fremdem Receipt fail-closed", async () => {
    execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ intent_sha256: intentSha256 }])
      .mockResolvedValueOnce([{ ...receiptRow, tenant_id: "foreign" }]);
    const { createCustomerCommand } = await import("../server/createCustomerCommand");
    await expect(createCustomerCommand(authorization, input)).resolves.toMatchObject({ code: "UNAVAILABLE" });
  });
});
