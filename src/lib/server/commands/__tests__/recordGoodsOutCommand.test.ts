import { beforeEach, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

const { execute, randomUUID, resolveAuthorization, withTransaction } = vi.hoisted(() => ({
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
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: withTransaction }));
vi.mock("drizzle-orm", () => ({
  sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }),
}));

type Query = { text: string; values: unknown[] };

const ACTOR = "11111111-1111-4111-8111-111111111111";
const CLIENT_EVENT = "22222222-2222-4222-8222-222222222222";
const CORRELATION = "33333333-3333-4333-8333-333333333333";
const EVENT = "event-goods-out";
const ORDER = "order-goods-out";
const INVOICE = "44444444-4444-4444-8444-444444444444";
const OCCURRED_AT = "2026-09-09T10:15:00.000Z";

const authorization = {
  ok: true as const,
  data: {
    userId: ACTOR,
    tenantId: KREILE_TENANT_SLUG,
    displayName: "Werkstatt",
    role: "werkstatt" as const,
    permissions: ["perm_view_leitstand"] as const,
    active: true as const,
  },
};

const input = {
  orderId: ORDER,
  mode: "versand" as const,
  expectedVersion: 3,
  clientEventId: CLIENT_EVENT,
};

const finishedOrder = {
  id: ORDER,
  tenant_id: KREILE_TENANT_SLUG,
  customer_id: "customer-goods-out",
  station: "fertig",
  current_station: "fertig",
  current_station_id: "fertig",
  status: "fertig",
  version: 3,
  payment_mode: "vorkasse",
};

const pickedUpOrder = {
  ...finishedOrder,
  station: "abgeholt",
  current_station: "abgeholt",
  current_station_id: "abgeholt",
  status: "abgeholt",
  version: 4,
};

const invoice = {
  id: INVOICE,
  tenant_id: KREILE_TENANT_SLUG,
  order_id: ORDER,
  status: "issued",
  contract_version: 1,
  payment_contract_version: 1,
};

function summary(paymentMode: "vorkasse" | "abholung" | "rechnung", status: "offen" | "teilbezahlt" | "bezahlt") {
  const paid = status === "offen" ? 0 : status === "teilbezahlt" ? 4_000 : 10_000;
  const open = 10_000 - paid;
  return {
    invoice_id: INVOICE,
    tenant_id: KREILE_TENANT_SLUG,
    order_id: ORDER,
    order_number: "A-2026-9001",
    invoice_number: "R-2026-9001",
    total_amount_cents: 10_000,
    payment_contract_version: 1,
    payment_mode: paymentMode,
    payment_status: status,
    payment_open_amount_cents: open,
    payment_paid_amount_cents: paid,
    payment_currency: "EUR",
    payment_method: status === "offen" ? null : "ueberweisung",
    payment_paid_at: status === "offen" ? null : OCCURRED_AT,
    payment_receipt_id: status === "offen" ? null : `payment://${INVOICE}/1`,
    payment_event_id: status === "offen" ? null : "payment-event",
    payment_correlation_id: status === "offen" ? null : "55555555-5555-4555-8555-555555555555",
    payment_mode_version: 0,
    payment_version: status === "offen" ? 0 : 1,
    goods_out_allowed: paymentMode === "rechnung" || status === "bezahlt",
    integrity_ok: true,
  };
}

function eventRow(mode: "versand" | "abholung" = "versand", paymentMode: "vorkasse" | "abholung" | "rechnung" = "vorkasse", paymentStatus: "offen" | "teilbezahlt" | "bezahlt" = "bezahlt") {
  return {
    event_id: EVENT,
    tenant_id: KREILE_TENANT_SLUG,
    order_id: ORDER,
    client_event_id: CLIENT_EVENT,
    correlation_id: CORRELATION,
    event_schema_version: 1,
    aggregate_version: 4,
    actor_id: ACTOR,
    occurred_at: OCCURRED_AT,
    status: "success",
    station: "abgeholt",
    from_station: "fertig",
    event_type: "ORDER_PICKED_UP_V1",
    payload: {
      orderId: ORDER,
      mode,
      orderVersion: 4,
      paymentMode,
      paymentStatus,
      openAmountCents: paymentStatus === "bezahlt" ? 0 : paymentStatus === "teilbezahlt" ? 6_000 : 10_000,
      gateAllowed: true,
    },
  };
}

function eventRowV2(mode: "versand" | "abholung" = "versand") {
  return {
    ...eventRow(mode, "rechnung", "offen"),
    event_schema_version: 2,
    event_type: "ORDER_PICKED_UP_V2",
    payload: {
      orderId: ORDER,
      mode,
      orderVersion: 4,
      paymentMode: "rechnung",
      invoiceState: "not_issued",
      gateAllowed: true,
    },
  };
}

function queryText(query: Query): string {
  return [
    query.text,
    ...query.values.flatMap((value) => (
      value && typeof value === "object" && "text" in value
        ? [queryText(value as Query)]
        : []
    )),
  ].join(" ");
}

function configureSuccess(options: {
  mode?: "versand" | "abholung";
  paymentMode?: "vorkasse" | "abholung" | "rechnung";
  paymentStatus?: "offen" | "teilbezahlt" | "bezahlt";
  items?: number;
  malformedReadback?: boolean;
  invoiceIssued?: boolean;
} = {}) {
  const mode = options.mode ?? "versand";
  const paymentMode = options.paymentMode ?? "vorkasse";
  const paymentStatus = options.paymentStatus ?? "bezahlt";
  const itemCount = options.items ?? 1;
  const invoiceIssued = options.invoiceIssued ?? true;
  let eventReads = 0;
  let orderReads = 0;
  execute.mockImplementation((query: Query) => {
    const text = queryText(query);
    if (text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
    if (text.includes("FROM public.events")) {
      eventReads += 1;
      return Promise.resolve(eventReads === 1 ? [] : [{
        ...(invoiceIssued ? eventRow(mode, paymentMode, paymentStatus) : eventRowV2(mode)),
        ...(options.malformedReadback ? { aggregate_version: 5 } : {}),
      }]);
    }
    if (text.includes("FROM public.orders")) {
      orderReads += 1;
      return Promise.resolve(orderReads === 1
        ? [{ ...finishedOrder, payment_mode: paymentMode }]
        : [pickedUpOrder]);
    }
    if (text.includes("FROM public.invoices")) return Promise.resolve(invoiceIssued ? [invoice] : []);
    if (text.includes("FROM private.v_payment_summary_v1")) return Promise.resolve([summary(paymentMode, paymentStatus)]);
    if (text.includes("FROM public.items")) return Promise.resolve(Array.from({ length: itemCount }, (_, index) => ({
      id: `item-${index}`,
      tenant_id: KREILE_TENANT_SLUG,
      customer_id: finishedOrder.customer_id,
      current_station_id: "fertig",
    })));
    if (text.includes("UPDATE public.orders")) return Promise.resolve([{ id: ORDER, version: 4 }]);
    if (text.includes("UPDATE public.items")) return Promise.resolve(Array.from({ length: itemCount }, (_, index) => ({ id: `item-${index}` })));
    if (text.includes("INSERT INTO public.events")) return Promise.resolve([{ event_id: EVENT }]);
    throw new Error(`Unexpected SQL: ${text}`);
  });
}

describe("recordGoodsOut", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    randomUUID.mockReturnValue(CORRELATION);
    resolveAuthorization.mockResolvedValue(authorization);
    withTransaction.mockImplementation(async (_authorization, work) => work({ execute }));
  });

  it("rejects malformed input before authorization and accepts only the exact runtime shape", async () => {
    const { recordGoodsOut } = await import("../recordGoodsOutCommand");
    for (const candidate of [
      null,
      { ...input, mode: "pickup" },
      { ...input, expectedVersion: 0 },
      { ...input, clientEventId: "not-a-uuid" },
      { ...input, tenantId: KREILE_TENANT_SLUG },
    ]) {
      await expect(recordGoodsOut(candidate)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    }
    expect(resolveAuthorization).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("allows exactly werkstatt, meister and admin and fails closed for session, tenant and other roles", async () => {
    const { recordGoodsOut } = await import("../recordGoodsOutCommand");
    resolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "NO_SESSION", message: "none" });
    await expect(recordGoodsOut(input)).resolves.toMatchObject({ code: "UNAUTHENTICATED" });
    resolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "AUTHORIZATION_UNAVAILABLE", message: "down" });
    await expect(recordGoodsOut(input)).resolves.toMatchObject({ code: "UNAVAILABLE" });
    for (const role of ["buero", "readonly", "developer"] as const) {
      resolveAuthorization.mockResolvedValueOnce({ ...authorization, data: { ...authorization.data, role } });
      await expect(recordGoodsOut(input)).resolves.toMatchObject({ code: "FORBIDDEN" });
    }
    resolveAuthorization.mockResolvedValueOnce({ ...authorization, data: { ...authorization.data, tenantId: "foreign" } });
    await expect(recordGoodsOut(input)).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(withTransaction).not.toHaveBeenCalled();

    execute.mockImplementation((query: Query) => {
      const text = queryText(query);
      if (text.includes("pg_advisory_xact_lock") || text.includes("FROM public.events")) return Promise.resolve([]);
      if (text.includes("FROM public.orders")) return Promise.resolve([]);
      throw new Error(`Unexpected SQL: ${text}`);
    });
    for (const role of ["werkstatt", "meister", "admin"] as const) {
      resolveAuthorization.mockResolvedValueOnce({ ...authorization, data: { ...authorization.data, role } });
      await expect(recordGoodsOut({ ...input, clientEventId: `${CLIENT_EVENT.slice(0, -1)}${role === "werkstatt" ? "1" : role === "meister" ? "2" : "3"}` }))
        .resolves.toMatchObject({ code: "NOT_FOUND" });
    }
  });

  it("atomically persists both transport modes and returns only exact event/order readback", async () => {
    const { recordGoodsOut } = await import("../recordGoodsOutCommand");
    for (const mode of ["versand", "abholung"] as const) {
      execute.mockReset();
      configureSuccess({ mode, paymentMode: mode === "versand" ? "vorkasse" : "abholung" });
      await expect(recordGoodsOut({ ...input, mode })).resolves.toEqual({
        code: "OK",
        replayed: false,
        receipt: {
          eventId: EVENT,
          clientEventId: CLIENT_EVENT,
          correlationId: CORRELATION,
          eventSchemaVersion: 1,
          orderId: ORDER,
          expectedVersion: 3,
          orderVersion: 4,
          fromStation: "fertig",
          toStation: "abgeholt",
          mode,
          paymentMode: mode === "versand" ? "vorkasse" : "abholung",
          paymentStatus: "bezahlt",
          openAmountCents: 0,
          actorId: ACTOR,
          occurredAt: OCCURRED_AT,
        },
      });
      const queries = execute.mock.calls.map(([query]) => query as Query);
      const orderUpdate = queries.find((query) => queryText(query).includes("UPDATE public.orders"));
      const itemUpdate = queries.find((query) => queryText(query).includes("UPDATE public.items"));
      const insert = queries.find((query) => queryText(query).includes("INSERT INTO public.events"));
      expect(orderUpdate?.text).toContain("version = version + 1");
      expect(itemUpdate).toBeDefined();
      expect(JSON.parse(insert?.values.find((value) => typeof value === "string" && value.startsWith("{")) as string))
        .toMatchObject({ orderId: ORDER, mode, orderVersion: 4, gateAllowed: true });
      expect(queries.findIndex((query) => queryText(query).includes("FROM public.orders") && queryText(query).includes("FOR UPDATE")))
        .toBeLessThan(queries.findIndex((query) => queryText(query).includes("FROM public.invoices")));
    }
  });

  it("enforces all three payment modes from the canonical view and requires one active invoice", async () => {
    const { recordGoodsOut } = await import("../recordGoodsOutCommand");
    for (const [paymentMode, paymentStatus] of [
      ["vorkasse", "offen"],
      ["vorkasse", "teilbezahlt"],
      ["abholung", "offen"],
      ["abholung", "teilbezahlt"],
    ] as const) {
      execute.mockReset();
      configureSuccess({ paymentMode, paymentStatus });
      await expect(recordGoodsOut(input)).resolves.toEqual({
        code: "CONFLICT",
        message: "Zahlung ist für den Warenausgang noch offen.",
      });
      expect(execute.mock.calls.map(([query]) => queryText(query as Query)).join("\n")).not.toContain("UPDATE public.orders");
    }

    execute.mockReset();
    configureSuccess({ paymentMode: "rechnung", paymentStatus: "offen", mode: "abholung" });
    await expect(recordGoodsOut({ ...input, mode: "abholung" })).resolves.toMatchObject({
      code: "OK",
      receipt: { paymentMode: "rechnung", paymentStatus: "offen", openAmountCents: 10_000 },
    });

    execute.mockReset();
    configureSuccess({ paymentMode: "rechnung", mode: "versand", invoiceIssued: false });
    await expect(recordGoodsOut(input)).resolves.toMatchObject({
      code: "OK",
      replayed: false,
      receipt: {
        eventSchemaVersion: 2,
        paymentMode: "rechnung",
        invoiceState: "not_issued",
      },
    });
    const v2Sql = execute.mock.calls.map(([query]) => queryText(query as Query)).join("\n");
    expect(v2Sql).not.toContain("FROM private.v_payment_summary_v1");
    const v2Insert = execute.mock.calls
      .map(([query]) => query as Query)
      .find((query) => queryText(query).includes("INSERT INTO public.events"));
    expect(v2Insert?.values).toContain("ORDER_PICKED_UP_V2");

    for (const label of ["missing", "cancelled", "foreign"] as const) {
      execute.mockReset();
      execute.mockImplementation((query: Query) => {
        const text = queryText(query);
        if (text.includes("pg_advisory_xact_lock") || text.includes("FROM public.events")) return Promise.resolve([]);
        if (text.includes("FROM public.orders")) return Promise.resolve([{ ...finishedOrder, payment_mode: "vorkasse" }]);
        if (text.includes("FROM public.invoices")) return Promise.resolve([]);
        throw new Error(`Unexpected SQL: ${text}`);
      });
      await expect(recordGoodsOut({ ...input, orderId: `${ORDER}-${label}` })).resolves.toEqual({
        code: "CONFLICT",
        message: "Warenausgang erfordert eine gültige Rechnung.",
      });
    }
  });

  it("rejects stale versions, non-finished state and invalid linked items with exactly zero writes", async () => {
    const { recordGoodsOut } = await import("../recordGoodsOutCommand");
    for (const order of [
      { ...finishedOrder, version: 4 },
      { ...finishedOrder, station: "galvanik" },
    ]) {
      execute.mockReset();
      execute.mockImplementation((query: Query) => {
        const text = queryText(query);
        if (text.includes("pg_advisory_xact_lock") || text.includes("FROM public.events")) return Promise.resolve([]);
        if (text.includes("FROM public.orders")) return Promise.resolve([order]);
        throw new Error(`Unexpected SQL: ${text}`);
      });
      await expect(recordGoodsOut(input)).resolves.toMatchObject({ code: order.version === 4 ? "CONFLICT" : "VALIDATION_ERROR" });
      expect(execute.mock.calls.map(([query]) => queryText(query as Query)).join("\n")).not.toContain("UPDATE public");
    }

    execute.mockReset();
    configureSuccess();
    execute.mockImplementationOnce(() => Promise.resolve([]))
      .mockImplementationOnce(() => Promise.resolve([]))
      .mockImplementationOnce(() => Promise.resolve([finishedOrder]))
      .mockImplementationOnce(() => Promise.resolve([invoice]))
      .mockImplementationOnce(() => Promise.resolve([summary("vorkasse", "bezahlt")]))
      .mockImplementationOnce(() => Promise.resolve([{
        id: "foreign-item", tenant_id: "foreign", customer_id: finishedOrder.customer_id, current_station_id: "fertig",
      }]));
    await expect(recordGoodsOut(input)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(execute.mock.calls.map(([query]) => queryText(query as Query)).join("\n")).not.toContain("UPDATE public");
  });

  it("replays only the same client-event intent and rejects a changed intent without writes", async () => {
    execute.mockImplementation((query: Query) => {
      const text = queryText(query);
      if (text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (text.includes("FROM public.events")) return Promise.resolve([eventRow()]);
      if (text.includes("FROM public.orders")) return Promise.resolve([pickedUpOrder]);
      throw new Error(`Unexpected SQL: ${text}`);
    });
    const { recordGoodsOut } = await import("../recordGoodsOutCommand");
    await expect(recordGoodsOut(input)).resolves.toMatchObject({ code: "OK", replayed: true, receipt: { eventId: EVENT } });
    for (const changed of [{ mode: "abholung" as const }, { expectedVersion: 4 }, { orderId: "another-order" }]) {
      execute.mockClear();
      await expect(recordGoodsOut({ ...input, ...changed })).resolves.toEqual({
        code: "CONFLICT",
        message: "Anfragekennung wurde bereits anders verwendet.",
      });
      expect(execute.mock.calls.map(([query]) => queryText(query as Query)).join("\n")).not.toContain("UPDATE public");
    }
  });

  it("rolls back on write/readback failures, logs diagnostics and leaks no internals to the result", async () => {
    configureSuccess({ malformedReadback: true });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { recordGoodsOut } = await import("../recordGoodsOutCommand");
    await expect(recordGoodsOut(input)).resolves.toEqual({
      code: "UNAVAILABLE",
      message: "Warenausgang konnte nicht sicher gebucht werden.",
    });
    expect(errorSpy).toHaveBeenCalledWith("recordGoodsOut database error", {
      message: "GOODS_OUT_RECEIPT_INVALID",
      details: null,
      hint: null,
    });

    execute.mockReset();
    const databaseError = { message: "db unavailable", details: "internal relation", hint: "retry later" };
    execute.mockRejectedValueOnce(databaseError);
    const result = await recordGoodsOut(input);
    expect(result).toEqual({ code: "UNAVAILABLE", message: "Warenausgang konnte nicht sicher gebucht werden." });
    expect(JSON.stringify(result)).not.toMatch(/db unavailable|internal relation|retry later/);
    expect(errorSpy).toHaveBeenLastCalledWith("recordGoodsOut database error", databaseError);
    errorSpy.mockRestore();
  });
});
