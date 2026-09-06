import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  execute,
  randomUUID,
  resolveAuthorization,
  withTransaction,
} = vi.hoisted(() => ({
  execute: vi.fn(),
  randomUUID: vi.fn(),
  resolveAuthorization: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, randomUUID };
});
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization }));
vi.mock("@/lib/server/privilegedDb", () => ({
  withPrivilegedTenantTransaction: withTransaction,
}));
vi.mock("drizzle-orm", () => ({
  sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }),
}));

const ACTOR = "11111111-1111-4111-8111-111111111111";
const CLIENT_EVENT = "22222222-2222-4222-8222-222222222222";
const INVOICE = "33333333-3333-4333-8333-333333333333";
const EVENT = "44444444-4444-4444-8444-444444444444";
const CORRELATION = "55555555-5555-4555-8555-555555555555";
const ORDER = "f15-payment-order";
const OCCURRED_AT = "2026-09-05T12:30:00.000Z";
const orderReference = {
  id: ORDER,
  tenant_id: "galvanik-kreile",
  payment_mode: "vorkasse",
  payment_mode_version: 0,
};

const authorization = {
  ok: true as const,
  data: {
    userId: ACTOR,
    tenantId: "galvanik-kreile",
    displayName: "Büro",
    role: "buero" as const,
    permissions: ["perm_data_orders"] as const,
    active: true as const,
  },
};

const input = {
  invoiceId: INVOICE,
  amount: 2_500,
  method: "ueberweisung" as const,
  expectedVersion: 0,
  clientEventId: CLIENT_EVENT,
};

const openInvoice = {
  id: INVOICE,
  tenant_id: "galvanik-kreile",
  order_id: ORDER,
  invoice_number: "R-2026-9501",
  status: "issued",
  gross_amount_cents: 10_000,
  payment_contract_version: 1,
  payment_mode: "vorkasse",
  payment_status: "offen",
  payment_open_amount_cents: 10_000,
  payment_paid_amount_cents: 0,
  payment_currency: "EUR",
  payment_method: null,
  payment_paid_at: null,
  payment_receipt_id: null,
  payment_event_id: null,
  payment_correlation_id: null,
  payment_version: 0,
};

const partialPayload = {
  invoiceId: INVOICE,
  orderId: ORDER,
  receiptId: `payment://${INVOICE}/1`,
  amountCents: 2_500,
  grossAmountCents: 10_000,
  paidAmountCents: 2_500,
  openAmountCents: 7_500,
  currency: "EUR",
  paymentMode: "vorkasse",
  paymentStatus: "teilbezahlt",
  method: "ueberweisung",
  occurredAt: OCCURRED_AT,
  paymentVersion: 1,
  source: "manual",
};

const partialEvent = {
  event_id: EVENT,
  tenant_id: "galvanik-kreile",
  order_id: ORDER,
  event_type: "PAYMENT_CONFIRMED_V1",
  client_event_id: CLIENT_EVENT,
  correlation_id: CORRELATION,
  event_schema_version: 1,
  aggregate_version: 1,
  actor_id: ACTOR,
  occurred_at: OCCURRED_AT,
  status: "success",
  station: null,
  from_station: null,
  payload: partialPayload,
};

const partialInvoice = {
  ...openInvoice,
  payment_status: "teilbezahlt",
  payment_open_amount_cents: 7_500,
  payment_paid_amount_cents: 2_500,
  payment_method: "ueberweisung",
  payment_paid_at: OCCURRED_AT,
  payment_receipt_id: partialPayload.receiptId,
  payment_event_id: EVENT,
  payment_correlation_id: CORRELATION,
  payment_version: 1,
};

type Query = { text: string; values: unknown[] };

function queryText(query: Query): string {
  return [
    query.text,
    ...query.values.flatMap((value) => (
      value && typeof value === "object" && "text" in value
        ? [String((value as { text: unknown }).text)]
        : []
    )),
  ].join(" ");
}

function configureSuccessfulWrite(
  currentInvoice: unknown = openInvoice,
  persistedEvent: unknown = partialEvent,
  persistedInvoice: unknown = partialInvoice,
) {
  let eventReads = 0;
  execute.mockImplementation((query: Query) => {
    const text = queryText(query);
    if (text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
    if (text.includes("FROM public.events")) {
      eventReads += 1;
      return Promise.resolve(eventReads === 1 ? [] : [persistedEvent]);
    }
    if (text.includes("FOR UPDATE OF orders")) return Promise.resolve([orderReference]);
    if (text.includes("FROM public.invoices") && text.includes("FOR UPDATE")) {
      return Promise.resolve([currentInvoice]);
    }
    if (text.includes("clock_timestamp")) return Promise.resolve([{ occurred_at: OCCURRED_AT }]);
    if (text.includes("INSERT INTO public.events")) return Promise.resolve([{ event_id: EVENT }]);
    if (text.includes("set_config")) return Promise.resolve([]);
    if (text.includes("UPDATE public.invoices")) return Promise.resolve([{ id: INVOICE }]);
    if (text.includes("FROM public.invoices")) return Promise.resolve([persistedInvoice]);
    throw new Error(`Unexpected SQL: ${text}`);
  });
}

describe("confirmPayment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    randomUUID.mockReturnValue(CORRELATION);
    resolveAuthorization.mockResolvedValue(authorization);
    withTransaction.mockImplementation(async (_authorization, work) => work({ execute }));
  });

  it("rejects malformed runtime input before authorization or database access", async () => {
    const { confirmPayment } = await import("../confirmPaymentCommand");
    for (const candidate of [
      null,
      { ...input, amount: 0 },
      { ...input, amount: 1.5 },
      { ...input, amount: 2_147_483_648 },
      { ...input, expectedVersion: -1 },
      { ...input, expectedVersion: 2_147_483_647 },
      { ...input, method: "cash" },
      { ...input, invoiceId: "not-a-uuid" },
      { ...input, clientEventId: "A2222222-2222-4222-8222-222222222222" },
      { ...input, tenantId: "foreign" },
    ]) {
      await expect(confirmPayment(candidate)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    }
    expect(resolveAuthorization).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("fails closed for unavailable auth, missing sessions, foreign tenants, and every disallowed role", async () => {
    const { confirmPayment } = await import("../confirmPaymentCommand");
    resolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "NO_SESSION", message: "none" });
    await expect(confirmPayment(input)).resolves.toMatchObject({ code: "UNAUTHENTICATED" });
    resolveAuthorization.mockResolvedValueOnce({
      ok: false,
      reason: "AUTHORIZATION_UNAVAILABLE",
      message: "down",
    });
    await expect(confirmPayment(input)).resolves.toMatchObject({ code: "UNAVAILABLE" });
    resolveAuthorization.mockRejectedValueOnce(new Error("down"));
    await expect(confirmPayment(input)).resolves.toMatchObject({ code: "UNAVAILABLE" });
    resolveAuthorization.mockResolvedValueOnce({
      ...authorization,
      data: { ...authorization.data, tenantId: "foreign" },
    });
    await expect(confirmPayment(input)).resolves.toMatchObject({ code: "FORBIDDEN" });
    for (const role of ["werkstatt", "readonly", "developer"] as const) {
      resolveAuthorization.mockResolvedValueOnce({
        ...authorization,
        data: { ...authorization.data, role },
      });
      await expect(confirmPayment(input)).resolves.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("allows exactly buero, meister, and admin without a generic finance permission", async () => {
    const { confirmPayment } = await import("../confirmPaymentCommand");
    execute.mockImplementation((query: Query) => {
      const text = queryText(query);
      if (text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (text.includes("FROM public.events")) return Promise.resolve([]);
      if (text.includes("FOR UPDATE OF orders")) return Promise.resolve([]);
      throw new Error(`Unexpected SQL: ${text}`);
    });
    for (const role of ["buero", "meister", "admin"] as const) {
      resolveAuthorization.mockResolvedValueOnce({
        ...authorization,
        data: { ...authorization.data, role, permissions: [] },
      });
      await expect(confirmPayment({
        ...input,
        clientEventId: `${CLIENT_EVENT.slice(0, -1)}${role === "buero" ? "1" : role === "meister" ? "2" : "3"}`,
      })).resolves.toEqual({ code: "NOT_FOUND", message: "Rechnung nicht verfügbar." });
    }
    expect(withTransaction).toHaveBeenCalledTimes(3);
  });

  it("makes missing and foreign invoices indistinguishable and performs no write", async () => {
    execute.mockImplementation((query: Query) => {
      const text = queryText(query);
      if (text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (text.includes("FROM public.events")) return Promise.resolve([]);
      if (text.includes("FOR UPDATE OF orders")) return Promise.resolve([]);
      throw new Error(`Unexpected SQL: ${text}`);
    });
    const { confirmPayment } = await import("../confirmPaymentCommand");
    await expect(confirmPayment(input)).resolves.toEqual({
      code: "NOT_FOUND",
      message: "Rechnung nicht verfügbar.",
    });
    const sqlText = execute.mock.calls.map(([query]) => queryText(query)).join("\n");
    expect(sqlText).not.toContain("INSERT INTO");
    expect(sqlText).not.toContain("UPDATE public.invoices");
  });

  it("rejects cancelled and uninitialized payment contracts with null mutation", async () => {
    const { confirmPayment } = await import("../confirmPaymentCommand");
    for (const [invoice, expectedCode] of [
      [{ ...openInvoice, status: "cancelled" }, "CONFLICT"],
      [{ ...openInvoice, payment_contract_version: null }, "VALIDATION_ERROR"],
      [{ ...openInvoice, payment_currency: "USD" }, "VALIDATION_ERROR"],
    ] as const) {
      execute.mockReset();
      execute.mockImplementation((query: Query) => {
        const text = queryText(query);
        if (text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
        if (text.includes("FROM public.events")) return Promise.resolve([]);
        if (text.includes("FOR UPDATE OF orders")) return Promise.resolve([orderReference]);
        if (text.includes("FROM public.invoices") && text.includes("FOR UPDATE")) {
          return Promise.resolve([invoice]);
        }
        throw new Error(`Unexpected SQL: ${text}`);
      });
      await expect(confirmPayment(input)).resolves.toMatchObject({ code: expectedCode });
      expect(execute.mock.calls.map(([query]) => queryText(query)).join("\n")).not.toContain("INSERT INTO");
    }
  });

  it("rejects stale versions and overpayments before event or invoice mutation", async () => {
    const { confirmPayment } = await import("../confirmPaymentCommand");
    for (const command of [
      { ...input, expectedVersion: 1 },
      { ...input, amount: 10_001 },
    ]) {
      execute.mockReset();
      execute.mockImplementation((query: Query) => {
        const text = queryText(query);
        if (text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
        if (text.includes("FROM public.events")) return Promise.resolve([]);
        if (text.includes("FOR UPDATE OF orders")) {
          return Promise.resolve([orderReference]);
        }
        if (text.includes("FROM public.invoices") && text.includes("FOR UPDATE")) {
          return Promise.resolve([openInvoice]);
        }
        throw new Error(`Unexpected SQL: ${text}`);
      });
      const result = await confirmPayment(command);
      expect(result.code).toBe(command.expectedVersion === 1 ? "CONFLICT" : "VALIDATION_ERROR");
      const sqlText = execute.mock.calls.map(([query]) => queryText(query)).join("\n");
      expect(sqlText).not.toContain("INSERT INTO");
      expect(sqlText).not.toContain("UPDATE public.invoices");
    }
  });

  it("persists a partial payment and returns only exact event/invoice readback", async () => {
    configureSuccessfulWrite();
    const { confirmPayment } = await import("../confirmPaymentCommand");
    await expect(confirmPayment(input)).resolves.toEqual({
      code: "OK",
      replayed: false,
      receipt: {
        eventId: EVENT,
        invoiceId: INVOICE,
        invoiceNumber: "R-2026-9501",
        orderId: ORDER,
        receiptId: partialPayload.receiptId,
        clientEventId: CLIENT_EVENT,
        correlationId: CORRELATION,
        eventSchemaVersion: 1,
        expectedVersion: 0,
        paymentVersion: 1,
        amountCents: 2_500,
        grossAmountCents: 10_000,
        paidAmountCents: 2_500,
        openAmountCents: 7_500,
        currency: "EUR",
        paymentMode: "vorkasse",
        paymentStatus: "teilbezahlt",
        method: "ueberweisung",
        confirmedAt: OCCURRED_AT,
        confirmedBy: ACTOR,
        source: "manual",
      },
    });
    const queries = execute.mock.calls.map(([query]) => query as Query);
    const insert = queries.find((query) => queryText(query).includes("INSERT INTO public.events"));
    const update = queries.find((query) => queryText(query).includes("UPDATE public.invoices"));
    expect(insert).toBeDefined();
    expect(update).toBeDefined();
    const storedPayload = JSON.parse(
      insert?.values.find((value) => typeof value === "string" && value.startsWith("{")) as string,
    );
    expect(storedPayload).toEqual(partialPayload);
    expect(update?.text).toContain("payment_version =");
    expect(update?.text).toContain("payment_open_amount_cents =");
    expect(queries.some((query) => query.text.includes("set_config"))).toBe(true);
    expect(queries.some((query) => (
      queryText(query).includes("FOR UPDATE OF orders")
    ))).toBe(true);
  });

  it("supports a full payment from a valid partial state", async () => {
    const fullInput = { ...input, amount: 7_500, method: "bar" as const, expectedVersion: 1 };
    const fullPayload = {
      ...partialPayload,
      receiptId: `payment://${INVOICE}/2`,
      amountCents: 7_500,
      paidAmountCents: 10_000,
      openAmountCents: 0,
      paymentStatus: "bezahlt",
      method: "bar",
      paymentVersion: 2,
    };
    const fullEvent = {
      ...partialEvent,
      aggregate_version: 2,
      payload: fullPayload,
    };
    const fullInvoice = {
      ...partialInvoice,
      payment_status: "bezahlt",
      payment_open_amount_cents: 0,
      payment_paid_amount_cents: 10_000,
      payment_method: "bar",
      payment_receipt_id: fullPayload.receiptId,
      payment_version: 2,
    };
    configureSuccessfulWrite(partialInvoice, fullEvent, fullInvoice);
    const { confirmPayment } = await import("../confirmPaymentCommand");
    await expect(confirmPayment(fullInput)).resolves.toMatchObject({
      code: "OK",
      replayed: false,
      receipt: {
        paymentStatus: "bezahlt",
        amountCents: 7_500,
        paidAmountCents: 10_000,
        openAmountCents: 0,
        paymentVersion: 2,
      },
    });
  });

  it("replays only an identical client-event intent without another mutation", async () => {
    execute.mockImplementation((query: Query) => {
      const text = queryText(query);
      if (text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (text.includes("FROM public.events")) return Promise.resolve([partialEvent]);
      if (text.includes("FROM public.invoices")) return Promise.resolve([partialInvoice]);
      throw new Error(`Unexpected SQL: ${text}`);
    });
    const { confirmPayment } = await import("../confirmPaymentCommand");
    await expect(confirmPayment(input)).resolves.toMatchObject({
      code: "OK",
      replayed: true,
      receipt: { eventId: EVENT, amountCents: 2_500, expectedVersion: 0 },
    });
    expect(execute.mock.calls.map(([query]) => queryText(query)).join("\n")).not.toContain("INSERT INTO");

    for (const changed of [
      { amount: 2_501 },
      { method: "karte" as const },
      { expectedVersion: 1 },
    ]) {
      execute.mockClear();
      await expect(confirmPayment({ ...input, ...changed })).resolves.toEqual({
        code: "CONFLICT",
        message: "Anfragekennung wurde bereits anders verwendet.",
      });
      expect(execute.mock.calls.map(([query]) => queryText(query)).join("\n")).not.toContain("FROM public.invoices");
    }
  });

  it("maps database and exact-readback failures to UNAVAILABLE without returning OK", async () => {
    const { confirmPayment } = await import("../confirmPaymentCommand");
    execute.mockRejectedValueOnce(new Error("database down"));
    await expect(confirmPayment(input)).resolves.toEqual({
      code: "UNAVAILABLE",
      message: "Zahlung konnte nicht sicher bestätigt werden.",
    });

    execute.mockReset();
    configureSuccessfulWrite(openInvoice, partialEvent, {
      ...partialInvoice,
      payment_open_amount_cents: 7_499,
    });
    await expect(confirmPayment(input)).resolves.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("keeps the production command tenant-bound, transactional, and provider-free", async () => {
    const commandPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../confirmPaymentCommand.ts",
    );
    const actionPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../../app/actions/payments.actions.ts",
    );
    const [source, actionSource] = await Promise.all([
      readFile(commandPath, "utf8"),
      readFile(actionPath, "utf8"),
    ]);
    expect(source).toContain('import "server-only";');
    expect(source).toContain("withPrivilegedTenantTransaction");
    expect(source).toContain("resolveAuthorization");
    expect(source).toContain("INSERT INTO public.events");
    expect(source).toContain("UPDATE public.invoices");
    expect(source).toContain("set_config('app.payment_command', 'v1', true)");
    expect(source).not.toMatch(/public\.(?:payments|zahlung)\b/);
    expect(source).not.toMatch(/mollie|bank|createClient|supabase|rpc\(/i);
    expect(actionSource).toContain('"use server"');
    expect(actionSource).toContain("confirmPayment(input)");
  });
});
