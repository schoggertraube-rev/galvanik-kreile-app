import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveAuthorizationSpy, withTransactionSpy, executeSpy, receiptLookupSpy } = vi.hoisted(() => ({
  resolveAuthorizationSpy: vi.fn(),
  withTransactionSpy: vi.fn(),
  executeSpy: vi.fn(),
  receiptLookupSpy: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: resolveAuthorizationSpy }));
vi.mock("@/lib/server/privilegedDb", () => ({
  withPrivilegedTenantTransaction: withTransactionSpy,
}));
vi.mock("drizzle-orm", () => ({
  sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }),
}));

const authorization = {
  ok: true as const,
  data: {
    userId: "11111111-1111-4111-8111-111111111111", tenantId: "tenant-a", displayName: "Werkstatt", role: "werkstatt" as const,
    permissions: ["perm_op_status"] as const, active: true as const,
  },
};
const validOrder = {
  id: "order-1", tenant_id: "tenant-a", customer_id: "customer-a", station: "wareneingang",
  current_station: "wareneingang", current_station_id: "wareneingang",
  status: "angenommen", version: 1,
};
const CLIENT_EVENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CORRELATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const commandInput = (orderId: string, expectedVersion = 1, clientEventId = CLIENT_EVENT_ID) => ({
  orderId,
  expectedVersion,
  clientEventId,
});

const insertedReceipt = {
  event_id: "event-1",
  tenant_id: "tenant-a",
  order_id: "order-1",
  client_event_id: CLIENT_EVENT_ID,
  correlation_id: CORRELATION_ID,
  event_schema_version: 1,
  aggregate_version: 2,
  from_station: "wareneingang",
  to_station: "galvanik",
  actor_id: ACTOR_ID,
  status: "success",
  occurred_at: "2026-08-11T15:47:32.000Z",
  event_type: "ORDER_STATION_MOVED_V1",
};
const validCustomer = { id: "customer-a", tenant_id: "tenant-a" };
const validItem = {
  id: "item-1", tenant_id: "tenant-a", customer_id: "customer-a",
  current_station_id: "wareneingang",
};

describe("transitionWareneingangToGalvanik", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthorizationSpy.mockResolvedValue(authorization);
    receiptLookupSpy.mockResolvedValue([]);
    withTransactionSpy.mockImplementation(async (_authorization, work) => work({
      execute: (query: { text: string }) => {
        if (query.text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
        if (query.text.includes("FROM public.events") && query.text.includes("client_event_id")) {
          return receiptLookupSpy(query);
        }
        return executeSpy(query);
      },
    }));
  });

  it("returns VALIDATION_ERROR without authorization or a database port for invalid runtime input", async () => {
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    await expect(transitionWareneingangToGalvanik(undefined as never)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(transitionWareneingangToGalvanik({ orderId: " ", expectedVersion: 0 } as never)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(transitionWareneingangToGalvanik({ ...commandInput("order-1"), tenantId: "tenant-b" } as never)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      transitionWareneingangToGalvanik(commandInput("order-1", 1, CLIENT_EVENT_ID.toUpperCase())),
    ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(resolveAuthorizationSpy).not.toHaveBeenCalled();
    expect(withTransactionSpy).not.toHaveBeenCalled();
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it("returns UNAUTHENTICATED and UNAVAILABLE without a command database port", async () => {
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    resolveAuthorizationSpy.mockResolvedValueOnce({ ok: false, reason: "NO_SESSION", message: "not signed in" });
    await expect(transitionWareneingangToGalvanik(commandInput("order-1"))).resolves.toMatchObject({ code: "UNAUTHENTICATED" });
    resolveAuthorizationSpy.mockResolvedValueOnce({ ok: false, reason: "AUTHORIZATION_UNAVAILABLE", message: "down" });
    await expect(transitionWareneingangToGalvanik(commandInput("order-1"))).resolves.toMatchObject({ code: "UNAVAILABLE" });
    resolveAuthorizationSpy.mockRejectedValueOnce(new Error("down"));
    await expect(transitionWareneingangToGalvanik(commandInput("order-1"))).resolves.toMatchObject({ code: "UNAVAILABLE" });
    expect(withTransactionSpy).not.toHaveBeenCalled();
  });

  it("keeps readonly and developer snapshots out of the command transaction (D-F12-003: exact role gate)", async () => {
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    // developer intentionally holds perm_op_status generically but must still be
    // forbidden here: the gate is an explicit role allowlist, never the generic
    // permission.
    for (const [role, permissions] of [
      ["readonly", ["perm_view_leitstand"]],
      ["developer", ["perm_op_status"]],
    ] as const) {
      resolveAuthorizationSpy.mockResolvedValueOnce({
        ...authorization,
        data: { ...authorization.data, role, permissions },
      });
      await expect(transitionWareneingangToGalvanik(commandInput("order-1"))).resolves.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(withTransactionSpy).not.toHaveBeenCalled();
  });

  it("allows exactly buero, werkstatt, meister, and admin without requiring generic perm_op_status", async () => {
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    // buero intentionally lacks perm_op_status in the generic role/permission table
    // (D-F12-003) yet must still pass this explicit role gate.
    for (const role of ["buero", "werkstatt", "meister", "admin"] as const) {
      withTransactionSpy.mockClear();
      resolveAuthorizationSpy.mockResolvedValueOnce({
        ...authorization,
        data: { ...authorization.data, role, permissions: ["perm_view_leitstand"] },
      });
      const result = await transitionWareneingangToGalvanik(commandInput("order-1"));
      expect(result.code).not.toBe("FORBIDDEN");
      expect(withTransactionSpy).toHaveBeenCalledTimes(1);
    }
  });

  it("makes missing and foreign orders indistinguishable", async () => {
    executeSpy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    const missing = await transitionWareneingangToGalvanik(commandInput("missing", 1, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"));
    const foreign = await transitionWareneingangToGalvanik(commandInput("foreign", 1, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"));
    expect(missing).toEqual({ code: "NOT_FOUND", message: "Auftrag nicht verfügbar." });
    expect(foreign).toEqual(missing);
  });

  it("returns CONFLICT only for stale versions and guarded update misses", async () => {
    executeSpy.mockResolvedValueOnce([{ ...validOrder, version: 2 }]);
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    await expect(transitionWareneingangToGalvanik(commandInput("order-1"))).resolves.toMatchObject({ code: "CONFLICT" });
    executeSpy
      .mockResolvedValueOnce([validOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await expect(transitionWareneingangToGalvanik(commandInput("order-1", 1, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"))).resolves.toMatchObject({ code: "CONFLICT" });
  });

  it("returns VALIDATION_ERROR before writes for invalid station, status, or any linked item state", async () => {
    executeSpy
      .mockResolvedValueOnce([{ ...validOrder, station: null, current_station: null, current_station_id: null }])
      .mockResolvedValueOnce([{ ...validOrder, status: "fertig" }])
      .mockResolvedValueOnce([validOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([{ ...validItem, current_station_id: null }])
      .mockResolvedValueOnce([validOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([{ ...validItem, id: "item-foreign", tenant_id: "tenant-b" }])
      .mockResolvedValueOnce([validOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([{ ...validItem, id: "item-null", tenant_id: null }]);
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    for (const [index, orderId] of ["station", "status", "item", "foreign-item", "null-item"].entries()) {
      await expect(transitionWareneingangToGalvanik(commandInput(orderId, 1, `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${index + 3}`))).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    }
    expect(executeSpy).toHaveBeenCalledTimes(11);
  });

  it("rejects null and foreign order customers before the item lock or any update", async () => {
    executeSpy
      .mockResolvedValueOnce([{ ...validOrder, customer_id: null }])
      .mockResolvedValueOnce([{ ...validOrder, customer_id: "customer-b" }])
      .mockResolvedValueOnce([]);
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");

    for (const orderId of ["null-customer", "foreign-customer"]) {
      await expect(
        transitionWareneingangToGalvanik(commandInput(orderId, 1, orderId === "null-customer" ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3" : "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4")),
      ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    }

    expect(executeSpy).toHaveBeenCalledTimes(3);
    expect(executeSpy.mock.calls.map(([query]) => query.text).join("\n")).not.toContain("UPDATE public");
  });

  it("rejects null, foreign, and same-tenant mismatched item customers before any update", async () => {
    for (const customerId of [null, "customer-b", "customer-a-other"]) {
      executeSpy
        .mockResolvedValueOnce([validOrder])
        .mockResolvedValueOnce([validCustomer])
        .mockResolvedValueOnce([{ ...validItem, customer_id: customerId }]);
    }
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");

    for (const [index, orderId] of ["null-item-customer", "foreign-item-customer", "mismatched-item-customer"].entries()) {
      await expect(
        transitionWareneingangToGalvanik(commandInput(orderId, 1, `cccccccc-cccc-4ccc-8ccc-ccccccccccc${index + 1}`)),
      ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    }

    expect(executeSpy).toHaveBeenCalledTimes(9);
    expect(executeSpy.mock.calls.map(([query]) => query.text).join("\n")).not.toContain("UPDATE public");
  });

  it("updates the triple station fields, version, and items atomically after locks", async () => {
    executeSpy
      .mockResolvedValueOnce([validOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([validItem])
      .mockResolvedValueOnce([{ id: "order-1", version: 2 }])
      .mockResolvedValueOnce([{ id: "item-1" }])
      .mockResolvedValueOnce([insertedReceipt]);
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    await expect(transitionWareneingangToGalvanik(commandInput("order-1"))).resolves.toEqual({
      code: "OK",
      receipt: {
        eventId: "event-1",
        clientEventId: CLIENT_EVENT_ID,
        correlationId: CORRELATION_ID,
        eventSchemaVersion: 1,
        orderId: "order-1",
        aggregateVersion: 2,
        fromStation: "wareneingang",
        toStation: "galvanik",
        actorId: ACTOR_ID,
        occurredAt: "2026-08-11T15:47:32.000Z",
      },
      replayed: false,
    });
    expect(executeSpy.mock.calls[0][0].text).toContain("FOR UPDATE");
    expect(executeSpy.mock.calls[1][0].text).toContain("FROM public.customers");
    expect(executeSpy.mock.calls[1][0].text).toContain("FOR SHARE");
    expect(executeSpy.mock.calls[2][0].text).toContain("WHERE order_id = ?");
    expect(executeSpy.mock.calls[2][0].text).toContain("FOR UPDATE");
    expect(executeSpy.mock.calls[2][0].text).not.toContain("AND tenant_id");
    for (const predicate of [
      "station = ?",
      "current_station = ?",
      "current_station_id = ?",
      "tenant_id = ?",
      "version = ?",
    ]) {
      expect(executeSpy.mock.calls[3][0].text).toContain(predicate);
    }
    expect(executeSpy.mock.calls[4][0].text).toContain("UPDATE public.items");
  });

  it("maps a post-order-update item write failure to UNAVAILABLE without returning OK", async () => {
    executeSpy
      .mockResolvedValueOnce([validOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([validItem])
      .mockResolvedValueOnce([{ id: "order-1", version: 2 }])
      .mockRejectedValueOnce(new Error("item write failed"));
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    await expect(transitionWareneingangToGalvanik(commandInput("order-1"))).resolves.toEqual({
      code: "UNAVAILABLE",
      message: "Stationswechsel ist derzeit nicht verfügbar.",
    });
    expect(executeSpy).toHaveBeenCalledTimes(5);
  });

  it("returns an exactly bound persisted receipt on replay without touching the aggregate", async () => {
    receiptLookupSpy.mockResolvedValueOnce([insertedReceipt]);
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");

    await expect(transitionWareneingangToGalvanik(commandInput("order-1"))).resolves.toMatchObject({
      code: "OK",
      replayed: true,
      receipt: { eventId: "event-1", clientEventId: CLIENT_EVENT_ID, aggregateVersion: 2 },
    });
    expect(executeSpy).not.toHaveBeenCalled();

    const mismatches: Array<[string, Record<string, unknown>]> = [
      ["event type", { event_type: "OTHER_EVENT" }],
      ["tenant", { tenant_id: "tenant-b" }],
      ["actor", { actor_id: "22222222-2222-4222-8222-222222222222" }],
      ["order", { order_id: "other-order" }],
      ["client event", { client_event_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }],
      ["schema", { event_schema_version: 2 }],
      ["aggregate version", { aggregate_version: 3 }],
      ["source", { from_station: "galvanik" }],
      ["target", { to_station: "warenausgang" }],
      ["status", { status: "failed" }],
      ["invalid correlation", { correlation_id: "not-a-uuid" }],
      ["missing correlation", { correlation_id: null }],
      ["invalid occurrence", { occurred_at: "not-a-date" }],
      ["missing occurrence", { occurred_at: null }],
    ];
    for (const [, mismatch] of mismatches) {
      receiptLookupSpy.mockResolvedValueOnce([{ ...insertedReceipt, ...mismatch }]);
      await expect(transitionWareneingangToGalvanik(commandInput("order-1"))).resolves.toEqual({
        code: "CONFLICT",
        message: "Anfragekennung wurde bereits anders verwendet.",
      });
    }
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it("throws the transaction path closed when the event insert returns no receipt", async () => {
    executeSpy
      .mockResolvedValueOnce([validOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([validItem])
      .mockResolvedValueOnce([{ id: "order-1", version: 2 }])
      .mockResolvedValueOnce([{ id: "item-1" }])
      .mockResolvedValueOnce([]);
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    await expect(transitionWareneingangToGalvanik(commandInput("order-1"))).resolves.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("rejects a malformed inserted receipt instead of returning OK", async () => {
    executeSpy
      .mockResolvedValueOnce([validOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([validItem])
      .mockResolvedValueOnce([{ id: "order-1", version: 2 }])
      .mockResolvedValueOnce([{ id: "item-1" }])
      .mockResolvedValueOnce([{ ...insertedReceipt, occurred_at: null }]);
    const { transitionWareneingangToGalvanik } = await import("../orderStationCommand");
    await expect(transitionWareneingangToGalvanik(commandInput("order-1"))).resolves.toEqual({
      code: "UNAVAILABLE",
      message: "Stationswechsel ist derzeit nicht verfügbar.",
    });
  });

  it("uses one shared namespaced mutex across both commands and the canonical event table without RPC or Data API", async () => {
    const commandPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../orderStationCommand.ts");
    const source = await readFile(commandPath, "utf8");
    expect(source).toContain('import "server-only";');
    // Exactly one shared mutex namespace literal, used by both the forward and
    // the correction command, so cross-command reuse of the same tenant-scoped
    // clientEventId is always serialized into one clean CONFLICT instead of
    // racing into a unique-index failure (UNAVAILABLE).
    expect(source).not.toContain("w4:order-station-correction:client-event:");
    expect(source.match(/'w4:order-station:client-event:'/g)).toHaveLength(2);
    expect(source.match(/pg_advisory_xact_lock/g)).toHaveLength(2);
    expect(source).toContain("INSERT INTO public.events");
    expect(source).not.toMatch(/\.insert\(|rpc\(|createClient|supabase/i);
    expect(source).toContain("ORDER_STATION_EVENT_INSERT_FAILED");
    expect(source).toContain("ORDER_STATION_CORRECTION_EVENT_INSERT_FAILED");
    // D-F12-004: the correction command never returns the bare INSERT ...
    // RETURNING row; it must read the persisted receipt back from the
    // tenant-bound view within the same transaction and fail closed on any
    // missing or mismatched readback.
    expect(source).toContain("private.v_order_station_correction_receipts_v1");
    expect(source).toContain("ORDER_STATION_CORRECTION_RECEIPT_READBACK_INVALID");
    // D-F12-003: exact role allowlist, never the generic perm_op_status permission.
    expect(source).toContain("ORDER_STATION_FORWARD_ROLES");
    expect(source).not.toContain("perm_op_status");
    const customerLock = source.match(/SELECT id, tenant_id\s+FROM public\.customers[\s\S]+?FOR SHARE/)?.[0] ?? "";
    expect(customerLock).toContain("WHERE id = ${order.customer_id}");
    expect(customerLock).toContain("AND tenant_id = ${authorization.data.tenantId}");
    const itemLock = source.match(/SELECT id, tenant_id, customer_id, current_station_id[\s\S]+?FOR UPDATE/)?.[0] ?? "";
    expect(itemLock).toContain("WHERE order_id = ${order.id}");
    expect(itemLock).not.toContain("AND tenant_id");
    expect(source).toContain("item.tenant_id !== authorization.data.tenantId");
    expect(source).toContain("item.customer_id !== order.customer_id");
  });
});

describe("correctGalvanikToWareneingang", () => {
  const REASON = "Falsche Station versehentlich ausgewählt";
  const galvanikOrder = {
    id: "order-1", tenant_id: "tenant-a", customer_id: "customer-a", station: "galvanik",
    current_station: "galvanik", current_station_id: "galvanik",
    status: "galvanik", version: 1,
  };
  const galvanikItem = {
    id: "item-1", tenant_id: "tenant-a", customer_id: "customer-a",
    current_station_id: "galvanik",
  };
  const correctionInput = (orderId: string, expectedVersion = 1, clientEventId = CLIENT_EVENT_ID, reason = REASON) => ({
    orderId, expectedVersion, clientEventId, reason,
  });
  const insertedCorrectionReceipt = {
    event_id: "event-2",
    tenant_id: "tenant-a",
    order_id: "order-1",
    client_event_id: CLIENT_EVENT_ID,
    correlation_id: CORRELATION_ID,
    event_schema_version: 1,
    aggregate_version: 2,
    from_station: "galvanik",
    to_station: "wareneingang",
    actor_id: ACTOR_ID,
    status: "success",
    description: REASON,
    occurred_at: "2026-08-17T09:00:00.000Z",
    event_type: "ORDER_STATION_CORRECTED_V1",
  };
  // D-F12-004: the row shape of the mandatory post-insert readback from
  // private.v_order_station_correction_receipts_v1 — distinct from the bare
  // INSERT ... RETURNING row above (no status/event_type/description, but a
  // projected `reason`), matching the same intent.
  const insertedCorrectionReadback = {
    event_id: "event-2",
    tenant_id: "tenant-a",
    order_id: "order-1",
    client_event_id: CLIENT_EVENT_ID,
    correlation_id: CORRELATION_ID,
    event_schema_version: 1,
    aggregate_version: 2,
    from_station: "galvanik",
    to_station: "wareneingang",
    actor_id: ACTOR_ID,
    occurred_at: "2026-08-17T09:00:00.000Z",
    reason: REASON,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthorizationSpy.mockResolvedValue(authorization);
    receiptLookupSpy.mockResolvedValue([]);
    withTransactionSpy.mockImplementation(async (_authorization, work) => work({
      execute: (query: { text: string }) => {
        if (query.text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
        if (query.text.includes("FROM public.events") && query.text.includes("client_event_id")) {
          return receiptLookupSpy(query);
        }
        return executeSpy(query);
      },
    }));
  });

  it("returns VALIDATION_ERROR before auth or db for missing, short, long, or malformed reasons", async () => {
    const { correctGalvanikToWareneingang } = await import("../orderStationCommand");
    await expect(correctGalvanikToWareneingang(undefined as never)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(correctGalvanikToWareneingang(correctionInput("order-1", 1, CLIENT_EVENT_ID, "kurz"))).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(correctGalvanikToWareneingang(correctionInput("order-1", 1, CLIENT_EVENT_ID, "x".repeat(501)))).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(correctGalvanikToWareneingang({ ...correctionInput("order-1"), reason: undefined } as never)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(correctGalvanikToWareneingang({ ...correctionInput("order-1"), extra: "x" } as never)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(resolveAuthorizationSpy).not.toHaveBeenCalled();
    expect(withTransactionSpy).not.toHaveBeenCalled();
  });

  it("trims a valid reason before matching or persisting it", async () => {
    executeSpy
      .mockResolvedValueOnce([galvanikOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([galvanikItem])
      .mockResolvedValueOnce([{ id: "order-1", version: 2 }])
      .mockResolvedValueOnce([{ id: "item-1" }])
      .mockResolvedValueOnce([insertedCorrectionReceipt])
      .mockResolvedValueOnce([insertedCorrectionReadback]);
    const { correctGalvanikToWareneingang } = await import("../orderStationCommand");
    await expect(
      correctGalvanikToWareneingang(correctionInput("order-1", 1, CLIENT_EVENT_ID, `  ${REASON}  `)),
    ).resolves.toMatchObject({ code: "OK", receipt: { reason: REASON } });
  });

  it("keeps readonly and developer out of the correction transaction, allows the four forward roles", async () => {
    const { correctGalvanikToWareneingang } = await import("../orderStationCommand");
    for (const [role, permissions] of [
      ["readonly", ["perm_view_leitstand"]],
      ["developer", ["perm_op_status"]],
    ] as const) {
      resolveAuthorizationSpy.mockResolvedValueOnce({
        ...authorization,
        data: { ...authorization.data, role, permissions },
      });
      await expect(correctGalvanikToWareneingang(correctionInput("order-1"))).resolves.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(withTransactionSpy).not.toHaveBeenCalled();

    for (const role of ["buero", "werkstatt", "meister", "admin"] as const) {
      withTransactionSpy.mockClear();
      resolveAuthorizationSpy.mockResolvedValueOnce({
        ...authorization,
        data: { ...authorization.data, role, permissions: ["perm_view_leitstand"] },
      });
      const result = await correctGalvanikToWareneingang(correctionInput("order-1"));
      expect(result.code).not.toBe("FORBIDDEN");
      expect(withTransactionSpy).toHaveBeenCalledTimes(1);
    }
  });

  it("makes missing orders and stale versions fail without a write", async () => {
    const { correctGalvanikToWareneingang } = await import("../orderStationCommand");
    executeSpy.mockResolvedValueOnce([]);
    await expect(correctGalvanikToWareneingang(correctionInput("missing"))).resolves.toMatchObject({ code: "NOT_FOUND" });

    executeSpy.mockResolvedValueOnce([{ ...galvanikOrder, version: 2 }]);
    await expect(correctGalvanikToWareneingang(correctionInput("order-1"))).resolves.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects orders not exactly parked at galvanik/galvanik before any write", async () => {
    executeSpy
      .mockResolvedValueOnce([{ ...galvanikOrder, station: "wareneingang" }])
      .mockResolvedValueOnce([{ ...galvanikOrder, status: "fertig" }]);
    const { correctGalvanikToWareneingang } = await import("../orderStationCommand");
    await expect(correctGalvanikToWareneingang(correctionInput("order-1"))).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(correctGalvanikToWareneingang(correctionInput("order-1"))).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(executeSpy.mock.calls.map(([query]) => query.text).join("\n")).not.toContain("UPDATE public");
  });

  it("reverts the triple station fields, status, version, and items with an immutable correction event", async () => {
    executeSpy
      .mockResolvedValueOnce([galvanikOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([galvanikItem])
      .mockResolvedValueOnce([{ id: "order-1", version: 2 }])
      .mockResolvedValueOnce([{ id: "item-1" }])
      .mockResolvedValueOnce([insertedCorrectionReceipt])
      .mockResolvedValueOnce([insertedCorrectionReadback]);
    const { correctGalvanikToWareneingang } = await import("../orderStationCommand");
    await expect(correctGalvanikToWareneingang(correctionInput("order-1"))).resolves.toEqual({
      code: "OK",
      receipt: {
        eventId: "event-2",
        clientEventId: CLIENT_EVENT_ID,
        correlationId: CORRELATION_ID,
        eventSchemaVersion: 1,
        orderId: "order-1",
        aggregateVersion: 2,
        fromStation: "galvanik",
        toStation: "wareneingang",
        actorId: ACTOR_ID,
        occurredAt: "2026-08-17T09:00:00.000Z",
        reason: REASON,
      },
      replayed: false,
    });
    expect(executeSpy.mock.calls[3][0].text).toContain("status = ?");
    expect(executeSpy.mock.calls[3][0].values).toContain("wareneingang");
    expect(executeSpy.mock.calls[3][0].values).toContain("angenommen");
    expect(executeSpy.mock.calls[6][0].text).toContain("private.v_order_station_correction_receipts_v1");
  });

  it("returns UNAVAILABLE without a stale receipt when the post-insert readback is missing or mismatched", async () => {
    const { correctGalvanikToWareneingang } = await import("../orderStationCommand");

    // Fall 1: passender INSERT-Row, dann leeres Readback => UNAVAILABLE
    const EVENT_ID_1 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const correctionReceipt1 = { ...insertedCorrectionReceipt, client_event_id: EVENT_ID_1 };

    executeSpy
      .mockResolvedValueOnce([galvanikOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([galvanikItem])
      .mockResolvedValueOnce([{ id: "order-1", version: 2 }])
      .mockResolvedValueOnce([{ id: "item-1" }])
      .mockResolvedValueOnce([correctionReceipt1])
      .mockResolvedValueOnce([]);
    await expect(
      correctGalvanikToWareneingang(correctionInput("order-1", 1, EVENT_ID_1)),
    ).resolves.toEqual({ code: "UNAVAILABLE", message: "Rücknahme ist derzeit nicht verfügbar." });

    // Fall 2: passender INSERT-Row, Readback gleiche ID aber falsche reason => UNAVAILABLE
    const EVENT_ID_2 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const correctionReceipt2 = { ...insertedCorrectionReceipt, client_event_id: EVENT_ID_2 };
    const correctionReadback2 = { ...insertedCorrectionReadback, client_event_id: EVENT_ID_2, reason: "Eine andere Begründung als erwartet" };

    executeSpy
      .mockResolvedValueOnce([galvanikOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([galvanikItem])
      .mockResolvedValueOnce([{ id: "order-1", version: 2 }])
      .mockResolvedValueOnce([{ id: "item-1" }])
      .mockResolvedValueOnce([correctionReceipt2])
      .mockResolvedValueOnce([correctionReadback2]);
    await expect(
      correctGalvanikToWareneingang(correctionInput("order-1", 1, EVENT_ID_2)),
    ).resolves.toEqual({ code: "UNAVAILABLE", message: "Rücknahme ist derzeit nicht verfügbar." });

    // Fall 3: passender INSERT-Row, zwei Readback-Rows gleiche ID => UNAVAILABLE
    const EVENT_ID_3 = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const correctionReceipt3 = { ...insertedCorrectionReceipt, client_event_id: EVENT_ID_3 };
    const correctionReadback3 = { ...insertedCorrectionReadback, client_event_id: EVENT_ID_3 };

    executeSpy
      .mockResolvedValueOnce([galvanikOrder])
      .mockResolvedValueOnce([validCustomer])
      .mockResolvedValueOnce([galvanikItem])
      .mockResolvedValueOnce([{ id: "order-1", version: 2 }])
      .mockResolvedValueOnce([{ id: "item-1" }])
      .mockResolvedValueOnce([correctionReceipt3])
      .mockResolvedValueOnce([correctionReadback3, correctionReadback3]);
    await expect(
      correctGalvanikToWareneingang(correctionInput("order-1", 1, EVENT_ID_3)),
    ).resolves.toEqual({ code: "UNAVAILABLE", message: "Rücknahme ist derzeit nicht verfügbar." });
  });

  it("replays an exactly bound persisted correction receipt and treats reuse for another intent as CONFLICT", async () => {
    receiptLookupSpy.mockResolvedValueOnce([insertedCorrectionReceipt]);
    const { correctGalvanikToWareneingang } = await import("../orderStationCommand");
    await expect(correctGalvanikToWareneingang(correctionInput("order-1"))).resolves.toMatchObject({
      code: "OK",
      replayed: true,
      receipt: { eventId: "event-2", reason: REASON },
    });
    expect(executeSpy).not.toHaveBeenCalled();

    receiptLookupSpy.mockResolvedValueOnce([{ ...insertedCorrectionReceipt, description: "Andere Begründung als zuvor" }]);
    await expect(correctGalvanikToWareneingang(correctionInput("order-1"))).resolves.toEqual({
      code: "CONFLICT",
      message: "Anfragekennung wurde bereits anders verwendet.",
    });

    receiptLookupSpy.mockResolvedValueOnce([{ ...insertedReceipt, event_type: "ORDER_STATION_MOVED_V1" }]);
    await expect(correctGalvanikToWareneingang(correctionInput("order-1"))).resolves.toEqual({
      code: "CONFLICT",
      message: "Anfragekennung wurde bereits anders verwendet.",
    });
  });
});
