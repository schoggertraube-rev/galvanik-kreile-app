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

const ACTOR = "11111111-1111-4111-8111-111111111111";
const CLIENT_EVENT = "22222222-2222-4222-8222-222222222222";
const CORRELATION = "33333333-3333-4333-8333-333333333333";
const EVENT = "44444444-4444-4444-8444-444444444444";
const ORDER = "f15-mode-order";
const OCCURRED_AT = "2026-09-05T20:30:00.000Z";

const authorization = {
  ok: true as const,
  data: {
    userId: ACTOR,
    tenantId: KREILE_TENANT_SLUG,
    displayName: "Büro",
    role: "buero" as const,
    permissions: [] as const,
    active: true as const,
  },
};

const input = {
  orderId: ORDER,
  paymentMode: "rechnung" as const,
  expectedVersion: 0,
  clientEventId: CLIENT_EVENT,
};

const openOrder = {
  id: ORDER,
  tenant_id: KREILE_TENANT_SLUG,
  station: "fertig",
  current_station: "fertig",
  current_station_id: "fertig",
  status: "fertig",
  payment_mode: "vorkasse",
  payment_mode_version: 0,
};

const changedOrder = {
  ...openOrder,
  payment_mode: "rechnung",
  payment_mode_version: 1,
};

const payload = {
  orderId: ORDER,
  receiptId: `payment-mode://${ORDER}/1`,
  previousPaymentMode: "vorkasse",
  paymentMode: "rechnung",
  expectedVersion: 0,
  paymentModeVersion: 1,
  occurredAt: OCCURRED_AT,
};

const eventRow = {
  event_id: EVENT,
  tenant_id: KREILE_TENANT_SLUG,
  order_id: ORDER,
  event_type: "PAYMENT_MODE_SET_V1",
  client_event_id: CLIENT_EVENT,
  correlation_id: CORRELATION,
  event_schema_version: 1,
  aggregate_version: 1,
  actor_id: ACTOR,
  occurred_at: OCCURRED_AT,
  status: "success",
  station: null,
  from_station: null,
  payload,
};

type Query = { text: string; values: unknown[] };

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

function configureSuccessfulChange() {
  let eventReads = 0;
  execute.mockImplementation((query: Query) => {
    const text = queryText(query);
    if (text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
    if (text.includes("FROM public.events") && text.includes("client_event_id")) {
      eventReads += 1;
      return Promise.resolve(eventReads === 1 ? [] : [eventRow]);
    }
    if (text.includes("FOR UPDATE")) return Promise.resolve([openOrder]);
    if (text.includes("SELECT EXISTS")) return Promise.resolve([{ has_goods_out: false }]);
    if (text.includes("clock_timestamp")) return Promise.resolve([{ occurred_at: OCCURRED_AT }]);
    if (text.includes("set_config")) return Promise.resolve([]);
    if (text.includes("UPDATE public.orders")) {
      return Promise.resolve([{ id: ORDER, payment_mode: "rechnung", payment_mode_version: 1 }]);
    }
    if (text.includes("INSERT INTO public.events")) return Promise.resolve([{ event_id: EVENT }]);
    if (text.includes("FROM public.orders")) return Promise.resolve([changedOrder]);
    throw new Error(`Unexpected SQL: ${text}`);
  });
}

describe("setPaymentMode", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    randomUUID.mockReturnValue(CORRELATION);
    resolveAuthorization.mockResolvedValue(authorization);
    withTransaction.mockImplementation(async (_authorization, work) => work({ execute }));
  });

  it("rejects malformed input before authorization or database access", async () => {
    const { setPaymentMode } = await import("../setPaymentModeCommand");
    for (const candidate of [
      null,
      { ...input, paymentMode: "ueberweisung" },
      { ...input, expectedVersion: -1 },
      { ...input, clientEventId: "not-a-uuid" },
      { ...input, tenantId: "foreign" },
    ]) {
      await expect(setPaymentMode(candidate)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    }
    expect(resolveAuthorization).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("allows exactly buero, meister and admin and denies all other roles or tenants before a transaction", async () => {
    const { setPaymentMode } = await import("../setPaymentModeCommand");
    resolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "NO_SESSION", message: "none" });
    await expect(setPaymentMode(input)).resolves.toMatchObject({ code: "UNAUTHENTICATED" });
    resolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "AUTHORIZATION_UNAVAILABLE", message: "down" });
    await expect(setPaymentMode(input)).resolves.toMatchObject({ code: "UNAVAILABLE" });
    resolveAuthorization.mockResolvedValueOnce({
      ...authorization,
      data: { ...authorization.data, tenantId: "foreign" },
    });
    await expect(setPaymentMode(input)).resolves.toMatchObject({ code: "FORBIDDEN" });
    for (const role of ["werkstatt", "readonly", "developer"] as const) {
      resolveAuthorization.mockResolvedValueOnce({ ...authorization, data: { ...authorization.data, role } });
      await expect(setPaymentMode(input)).resolves.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(withTransaction).not.toHaveBeenCalled();

    execute.mockImplementation((query: Query) => {
      if (query.text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (query.text.includes("FROM public.events")) return Promise.resolve([]);
      if (query.text.includes("FOR UPDATE")) return Promise.resolve([]);
      throw new Error(`Unexpected SQL: ${query.text}`);
    });
    for (const role of ["buero", "meister", "admin"] as const) {
      resolveAuthorization.mockResolvedValueOnce({ ...authorization, data: { ...authorization.data, role } });
      await expect(setPaymentMode({
        ...input,
        clientEventId: `${CLIENT_EVENT.slice(0, -1)}${role === "buero" ? "1" : role === "meister" ? "2" : "3"}`,
      })).resolves.toMatchObject({ code: "NOT_FOUND" });
    }
    expect(withTransaction).toHaveBeenCalledTimes(3);
  });

  it("updates only the independent mode version and returns exact event/state readback", async () => {
    configureSuccessfulChange();
    const { setPaymentMode } = await import("../setPaymentModeCommand");
    await expect(setPaymentMode(input)).resolves.toEqual({
      code: "OK",
      replayed: false,
      receipt: {
        eventId: EVENT,
        orderId: ORDER,
        receiptId: payload.receiptId,
        clientEventId: CLIENT_EVENT,
        correlationId: CORRELATION,
        eventSchemaVersion: 1,
        expectedVersion: 0,
        paymentModeVersion: 1,
        previousPaymentMode: "vorkasse",
        paymentMode: "rechnung",
        changedAt: OCCURRED_AT,
        changedBy: ACTOR,
      },
    });
    const queries = execute.mock.calls.map(([query]) => query as Query);
    const update = queries.find((query) => query.text.includes("UPDATE public.orders"));
    const insert = queries.find((query) => query.text.includes("INSERT INTO public.events"));
    expect(update?.text).toContain("payment_mode_version =");
    expect(update?.text).not.toMatch(/\bversion\s*=/);
    expect(JSON.parse(insert?.values.find((value) => typeof value === "string" && value.startsWith("{")) as string))
      .toEqual(payload);
    expect(queries.findIndex((query) => query.text.includes("FOR UPDATE")))
      .toBeLessThan(queries.findIndex((query) => query.text.includes("UPDATE public.orders")));
  });

  it("replays identical intent after a later mode change and rejects changed intent without mutation", async () => {
    execute.mockImplementation((query: Query) => {
      if (query.text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (query.text.includes("FROM public.events")) return Promise.resolve([eventRow]);
      if (query.text.includes("FROM public.orders")) {
        return Promise.resolve([{ ...changedOrder, payment_mode: "abholung", payment_mode_version: 2 }]);
      }
      throw new Error(`Unexpected SQL: ${query.text}`);
    });
    const { setPaymentMode } = await import("../setPaymentModeCommand");
    await expect(setPaymentMode(input)).resolves.toMatchObject({
      code: "OK",
      replayed: true,
      receipt: { paymentMode: "rechnung", paymentModeVersion: 1 },
    });
    for (const changed of [{ paymentMode: "abholung" as const }, { expectedVersion: 1 }]) {
      execute.mockClear();
      await expect(setPaymentMode({ ...input, ...changed })).resolves.toEqual({
        code: "CONFLICT",
        message: "Anfragekennung wurde bereits anders verwendet.",
      });
      expect(execute.mock.calls.map(([query]) => query.text).join("\n")).not.toContain("UPDATE public.orders");
    }
  });

  it("rejects stale versions and any completed goods-out state with null mutation", async () => {
    const { setPaymentMode } = await import("../setPaymentModeCommand");
    for (const order of [openOrder, { ...openOrder, station: "abgeholt" }]) {
      execute.mockReset();
      execute.mockImplementation((query: Query) => {
        if (query.text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
        if (query.text.includes("FROM public.events") && query.text.includes("client_event_id")) return Promise.resolve([]);
        if (query.text.includes("FOR UPDATE")) return Promise.resolve([order]);
        if (query.text.includes("SELECT EXISTS")) return Promise.resolve([{ has_goods_out: false }]);
        throw new Error(`Unexpected SQL: ${query.text}`);
      });
      const command = order.station === "abgeholt" ? input : { ...input, expectedVersion: 1 };
      await expect(setPaymentMode(command)).resolves.toMatchObject({ code: "CONFLICT" });
      const sqlText = execute.mock.calls.map(([query]) => query.text).join("\n");
      expect(sqlText).not.toContain("UPDATE public.orders");
      expect(sqlText).not.toContain("INSERT INTO public.events");
    }

    execute.mockReset();
    execute.mockImplementation((query: Query) => {
      if (query.text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (query.text.includes("FROM public.events") && query.text.includes("client_event_id")) return Promise.resolve([]);
      if (query.text.includes("FOR UPDATE")) return Promise.resolve([openOrder]);
      if (query.text.includes("SELECT EXISTS")) return Promise.resolve([{ has_goods_out: true }]);
      throw new Error(`Unexpected SQL: ${query.text}`);
    });
    await expect(setPaymentMode(input)).resolves.toMatchObject({ code: "CONFLICT" });
    expect(execute.mock.calls.map(([query]) => query.text).join("\n")).not.toContain("UPDATE public.orders");
  });

  it("maps database or malformed exact readback failures to UNAVAILABLE", async () => {
    const { setPaymentMode } = await import("../setPaymentModeCommand");
    execute.mockRejectedValueOnce(new Error("down"));
    await expect(setPaymentMode(input)).resolves.toMatchObject({ code: "UNAVAILABLE" });

    execute.mockReset();
    configureSuccessfulChange();
    const invalidEvent = { ...eventRow, payload: { ...payload, paymentModeVersion: 2 } };
    let eventReads = 0;
    execute.mockImplementation((query: Query) => {
      if (query.text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (query.text.includes("FROM public.events") && query.text.includes("client_event_id")) {
        eventReads += 1;
        return Promise.resolve(eventReads === 1 ? [] : [invalidEvent]);
      }
      if (query.text.includes("FOR UPDATE")) return Promise.resolve([openOrder]);
      if (query.text.includes("SELECT EXISTS")) return Promise.resolve([{ has_goods_out: false }]);
      if (query.text.includes("clock_timestamp")) return Promise.resolve([{ occurred_at: OCCURRED_AT }]);
      if (query.text.includes("set_config")) return Promise.resolve([]);
      if (query.text.includes("UPDATE public.orders")) {
        return Promise.resolve([{ id: ORDER, payment_mode: "rechnung", payment_mode_version: 1 }]);
      }
      if (query.text.includes("INSERT INTO public.events")) return Promise.resolve([{ event_id: EVENT }]);
      throw new Error(`Unexpected SQL: ${query.text}`);
    });
    await expect(setPaymentMode(input)).resolves.toMatchObject({ code: "UNAVAILABLE" });
  });
});
