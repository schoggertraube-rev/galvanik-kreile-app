// @vitest-environment node

import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
if (process.env.NODE_ENV !== "test" || process.env.DATABASE_URL !== LOCAL_DATABASE_URL) {
  throw new Error("PATH1_QUOTE_LOCAL_REQUIRED: local loopback DATABASE_URL required");
}
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== LOCAL_SUPABASE_URL || process.env.SUPABASE_URL !== LOCAL_SUPABASE_URL) {
  throw new Error("PATH1_QUOTE_LOCAL_REQUIRED: local loopback Supabase URLs required");
}

const readAppSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/appSession", () => ({ readAppSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), unstable_noStore: vi.fn() }));
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const db = postgres(LOCAL_DATABASE_URL, { max: 6, prepare: false });
const suffix = randomUUID().slice(0, 8);
const foreignTenant = `path1-quote-foreign-${suffix}`;
const users = {
  buero: randomUUID(),
  readonly: randomUUID(),
  foreign: randomUUID(),
};

function session(userId: string, role: "buero" | "readonly", tenantId = KREILE_TENANT_SLUG) {
  readAppSession.mockResolvedValue({
    ok: true,
    session: {
      userId,
      tenantId,
      role,
      displayName: `Path1 ${role}`,
      issuedAt: 4_102_444_800_000,
      expiresAt: 4_102_488_000_000,
    },
  });
}

function customerInput(label: string) {
  return {
    city: "Synthetische Teststadt",
    clientEventId: randomUUID(),
    companyName: `SYNTHETISCH ${label} GmbH`,
    contactPerson: "Synthetische Testperson",
    customerType: "business" as const,
    email: `${label.toLowerCase()}-${suffix}@example.invalid`,
    name: `SYNTHETISCH ${label} ${suffix}`,
    phone: "+49 000 98765",
  };
}

function quoteInput(customerId: string, label: string, clientEventId = randomUUID()) {
  return {
    clientEventId,
    customerId,
    dueDate: "2026-10-15",
    note: `SYNTHETISCHER KV ${label}`,
    positions: [
      { name: "Flansch", quantity: 2, material: "Stahl", surfaceRequested: "Verzinken", unitPriceCents: 12_500 },
      { name: "Halter", quantity: 3, material: null, surfaceRequested: "Vernickeln", unitPriceCents: 800 },
    ],
  };
}

async function createCustomer(label: string, tenantId = KREILE_TENANT_SLUG, userId = users.buero) {
  const { createCustomerCommand } = await import("@/modules/customers/server-public");
  const result = await createCustomerCommand({ tenantId, userId, capabilities: { canCreateCustomer: true } }, customerInput(label));
  expect(result.code).toBe("OK");
  if (result.code !== "OK") throw new Error(`CUSTOMER_SETUP_FAILED:${result.code}`);
  return result.receipt.customerId;
}

beforeAll(async () => {
  const [version] = await db<{ version: number }[]>`SELECT current_setting('server_version_num')::integer AS version`;
  if (!version || version.version < 170000 || version.version >= 180000) {
    throw new Error(`PATH1_QUOTE_PG17_REQUIRED:${version?.version ?? "missing"}`);
  }
  const timestamp = new Date(Date.now() - 5_000).toISOString();
  await db`
    INSERT INTO public.app_users (id, tenant_id, email, full_name, role, active, created_at, updated_at)
    VALUES
      (${users.buero}::uuid, ${KREILE_TENANT_SLUG}, ${`quote-buero-${suffix}@example.invalid`}, 'Quote Büro', 'buero', true, ${timestamp}::timestamptz, ${timestamp}::timestamptz),
      (${users.readonly}::uuid, ${KREILE_TENANT_SLUG}, ${`quote-readonly-${suffix}@example.invalid`}, 'Quote Readonly', 'readonly', true, ${timestamp}::timestamptz, ${timestamp}::timestamptz),
      (${users.foreign}::uuid, ${foreignTenant}, ${`quote-foreign-${suffix}@example.invalid`}, 'Quote Foreign', 'buero', true, ${timestamp}::timestamptz, ${timestamp}::timestamptz)
  `;
});

beforeEach(() => session(users.buero, "buero"));
afterAll(async () => db.end());

describe("PATH1 quote to existing F1.1 order", () => {
  it("creates and reads one tenant-bound quote with DB total, number and exact replay", async () => {
    const customerId = await createCustomer("CREATE");
    const input = quoteInput(customerId, "CREATE");
    const { createQuoteAction, readQuoteAction } = await import("@/app/actions/quotes.actions");
    const first = await createQuoteAction(input);
    expect(first.code).toBe("OK");
    if (first.code !== "OK") return;
    expect(first).toMatchObject({
      replayed: false,
      quote: { customerId, status: "draft", version: 1, currency: "EUR", totalNetCents: 27_400, linkedOrderId: null },
      receipt: { quoteId: first.quote.quoteId, aggregateVersion: 1 },
    });
    expect(first.quote.quoteNumber).toMatch(/^KV-\d{4}-\d{4,}$/);
    await expect(readQuoteAction({ quoteId: first.quote.quoteId })).resolves.toMatchObject({ code: "OK", quote: { quoteId: first.quote.quoteId } });
    await expect(createQuoteAction(input)).resolves.toMatchObject({ code: "OK", replayed: true, receipt: { receiptId: first.receipt.receiptId } });
    await expect(createQuoteAction({ ...input, note: "SYNTHETISCH GEÄNDERTER INTENT" })).resolves.toMatchObject({ code: "CONFLICT" });
    const [counts] = await db<{ quotes: number; positions: number; events: number; receipts: number }[]>`
      SELECT
        (SELECT count(*)::integer FROM private.quotes WHERE tenant_id = ${KREILE_TENANT_SLUG} AND id = ${first.quote.quoteId}::uuid) AS quotes,
        (SELECT count(*)::integer FROM private.quote_positions WHERE tenant_id = ${KREILE_TENANT_SLUG} AND quote_id = ${first.quote.quoteId}::uuid) AS positions,
        (SELECT count(*)::integer FROM public.events WHERE tenant_id = ${KREILE_TENANT_SLUG} AND event_type = 'QUOTE_CREATED_V1' AND payload->>'quoteId' = ${first.quote.quoteId}) AS events,
        (SELECT count(*)::integer FROM private.quote_create_receipts WHERE tenant_id = ${KREILE_TENANT_SLUG} AND quote_id = ${first.quote.quoteId}::uuid) AS receipts
    `;
    expect(counts).toEqual({ quotes: 1, positions: 2, events: 1, receipts: 1 });
  });

  it("keeps a tenant-bound draft resumable, versioned and conflict-safe before award", async () => {
    const customerId = await createCustomer("UPDATE");
    const { createQuoteAction, convertQuoteToOrderAction, listOpenQuotesAction, readQuoteAction, updateQuoteAction } = await import("@/app/actions/quotes.actions");
    const created = await createQuoteAction(quoteInput(customerId, "UPDATE"));
    expect(created.code).toBe("OK");
    if (created.code !== "OK") return;
    const update = {
      quoteId: created.quote.quoteId, clientEventId: randomUUID(), expectedVersion: created.quote.version,
      dueDate: "2026-10-22", note: "SYNTHETISCHER KV UPDATE",
      positions: [{ name: "Aktualisierter Flansch", quantity: 4, material: "Stahl", surfaceRequested: "Vernickeln", unitPriceCents: 9000 }],
    };
    const updated = await updateQuoteAction(update);
    expect(updated).toMatchObject({ code: "OK", replayed: false, quote: { version: 2, dueDate: "2026-10-22", totalNetCents: 36000 }, receipt: { expectedVersion: 1, aggregateVersion: 2 } });
    await expect(updateQuoteAction(update)).resolves.toMatchObject({ code: "OK", replayed: true, receipt: { receiptId: updated.code === "OK" ? updated.receipt.receiptId : undefined } });
    await expect(updateQuoteAction({ ...update, note: "SYNTHETISCHER ANDERER INTENT" })).resolves.toMatchObject({ code: "CONFLICT" });
    await expect(updateQuoteAction({ ...update, clientEventId: randomUUID(), expectedVersion: 1 })).resolves.toMatchObject({ code: "CONFLICT" });
    await expect(readQuoteAction({ quoteId: created.quote.quoteId })).resolves.toMatchObject({ code: "OK", quote: { version: 2, positions: [expect.objectContaining({ name: "Aktualisierter Flansch", quantity: 4 })] } });
    await expect(listOpenQuotesAction()).resolves.toMatchObject({ code: "OK", quotes: expect.arrayContaining([expect.objectContaining({ quoteId: created.quote.quoteId, version: 2 })]) });
    const [counts] = await db<{ revisions: number; updates: number; receipts: number }[]>`
      SELECT
        (SELECT count(DISTINCT revision)::integer FROM private.quote_positions WHERE tenant_id = ${KREILE_TENANT_SLUG} AND quote_id = ${created.quote.quoteId}::uuid) AS revisions,
        (SELECT count(*)::integer FROM public.events WHERE tenant_id = ${KREILE_TENANT_SLUG} AND event_type = 'QUOTE_UPDATED_V1' AND payload->>'quoteId' = ${created.quote.quoteId}) AS updates,
        (SELECT count(*)::integer FROM private.quote_update_receipts WHERE tenant_id = ${KREILE_TENANT_SLUG} AND quote_id = ${created.quote.quoteId}::uuid) AS receipts
    `;
    expect(counts).toEqual({ revisions: 2, updates: 1, receipts: 1 });

    const conversion = await convertQuoteToOrderAction({
      quoteId: created.quote.quoteId,
      clientEventId: randomUUID(),
      expectedVersion: 2,
      confirmedAward: true,
      confirmedOrderDueDate: "2026-10-24",
    });
    expect(conversion).toMatchObject({
      code: "OK",
      quote: { status: "converted", version: 3 },
      quoteReceipt: { aggregateVersion: 3 },
      orderReceipt: { customerId },
    });
  });

  it("converts the persisted quote through F1.1 exactly once and replays both receipts", async () => {
    const customerId = await createCustomer("CONVERT");
    const { createQuoteAction, convertQuoteToOrderAction } = await import("@/app/actions/quotes.actions");
    const created = await createQuoteAction(quoteInput(customerId, "CONVERT"));
    expect(created.code).toBe("OK");
    if (created.code !== "OK") return;
    const conversion = { quoteId: created.quote.quoteId, clientEventId: randomUUID(), expectedVersion: 1, confirmedAward: true as const, confirmedOrderDueDate: "2026-10-20" };
    const first = await convertQuoteToOrderAction(conversion);
    expect(first.code).toBe("OK");
    if (first.code !== "OK") return;
    expect(first).toMatchObject({
      replayed: false,
      quote: { status: "converted", version: 2, linkedOrderId: first.orderReceipt.orderId },
      quoteReceipt: { orderId: first.orderReceipt.orderId, orderIntakeEventId: first.orderReceipt.eventId, aggregateVersion: 2 },
      orderReceipt: { customerId, station: "wareneingang", orderVersion: 1 },
    });
    const replay = await convertQuoteToOrderAction(conversion);
    expect(replay).toMatchObject({
      code: "OK",
      replayed: true,
      quoteReceipt: { receiptId: first.quoteReceipt.receiptId, eventId: first.quoteReceipt.eventId, orderId: first.orderReceipt.orderId },
      orderReceipt: { receiptId: first.orderReceipt.receiptId, orderId: first.orderReceipt.orderId },
    });
    const [counts] = await db<{ orders: number; intake_events: number; award_events: number; conversion_receipts: number }[]>`
      SELECT
        (SELECT count(*)::integer FROM public.orders WHERE tenant_id = ${KREILE_TENANT_SLUG} AND id = ${first.orderReceipt.orderId}) AS orders,
        (SELECT count(*)::integer FROM public.events WHERE tenant_id = ${KREILE_TENANT_SLUG} AND event_type = 'ORDER_INTAKE_CREATED_V1' AND order_id = ${first.orderReceipt.orderId}) AS intake_events,
        (SELECT count(*)::integer FROM public.events WHERE tenant_id = ${KREILE_TENANT_SLUG} AND event_type = 'QUOTE_AWARDED_V1' AND payload->>'quoteId' = ${created.quote.quoteId}) AS award_events,
        (SELECT count(*)::integer FROM private.quote_conversion_receipts WHERE tenant_id = ${KREILE_TENANT_SLUG} AND quote_id = ${created.quote.quoteId}::uuid) AS conversion_receipts
    `;
    expect(counts).toEqual({ orders: 1, intake_events: 1, award_events: 1, conversion_receipts: 1 });
  });

  it("fails closed for stale version, changed intent and concurrent double conversion", async () => {
    const customerId = await createCustomer("CONCURRENCY");
    const { createQuoteAction, convertQuoteToOrderAction } = await import("@/app/actions/quotes.actions");
    const staleQuote = await createQuoteAction(quoteInput(customerId, "STALE"));
    expect(staleQuote.code).toBe("OK");
    if (staleQuote.code !== "OK") return;
    await expect(convertQuoteToOrderAction({ quoteId: staleQuote.quote.quoteId, clientEventId: randomUUID(), expectedVersion: 2, confirmedAward: true, confirmedOrderDueDate: "2026-10-20" })).resolves.toMatchObject({ code: "CONFLICT" });

    const concurrentQuote = await createQuoteAction(quoteInput(customerId, "CONCURRENT"));
    expect(concurrentQuote.code).toBe("OK");
    if (concurrentQuote.code !== "OK") return;
    const results = await Promise.all([
      convertQuoteToOrderAction({ quoteId: concurrentQuote.quote.quoteId, clientEventId: randomUUID(), expectedVersion: 1, confirmedAward: true, confirmedOrderDueDate: "2026-10-20" }),
      convertQuoteToOrderAction({ quoteId: concurrentQuote.quote.quoteId, clientEventId: randomUUID(), expectedVersion: 1, confirmedAward: true, confirmedOrderDueDate: "2026-10-20" }),
    ]);
    expect(results.filter((result) => result.code === "OK")).toHaveLength(1);
    expect(results.filter((result) => result.code === "CONFLICT")).toHaveLength(1);
    const [counts] = await db<{ orders: number; receipts: number }[]>`
      SELECT
        (SELECT count(*)::integer FROM public.orders orders JOIN private.quote_conversion_receipts receipt ON receipt.tenant_id = orders.tenant_id AND receipt.order_id = orders.id WHERE receipt.quote_id = ${concurrentQuote.quote.quoteId}::uuid) AS orders,
        (SELECT count(*)::integer FROM private.quote_conversion_receipts WHERE quote_id = ${concurrentQuote.quote.quoteId}::uuid) AS receipts
    `;
    expect(counts).toEqual({ orders: 1, receipts: 1 });
  });

  it("keeps tenant, session and permission boundaries fail-closed without acceptance writes", async () => {
    const customerId = await createCustomer("BOUNDARY");
    const foreignCustomerId = await createCustomer("FOREIGN", foreignTenant, users.foreign);
    const { createQuoteAction } = await import("@/app/actions/quotes.actions");
    await expect(createQuoteAction(quoteInput(foreignCustomerId, "FOREIGN-CUSTOMER"))).resolves.toMatchObject({ code: "NOT_FOUND" });
    readAppSession.mockResolvedValueOnce({ ok: false, reason: "NO_COOKIE" });
    await expect(createQuoteAction(quoteInput(customerId, "NO-SESSION"))).resolves.toMatchObject({ code: "UNAUTHENTICATED" });
    session(users.readonly, "readonly");
    await expect(createQuoteAction(quoteInput(customerId, "READONLY"))).resolves.toMatchObject({ code: "FORBIDDEN" });

    const { createQuoteCommand, readQuoteCommand } = await import("@/modules/quotes/server-public");
  const foreign = await createQuoteCommand({ tenantId: foreignTenant, userId: users.foreign, capabilities: { canCreateQuote: true, canReadQuote: true, canUpdateQuote: true, canConvertQuote: true } }, quoteInput(foreignCustomerId, "FOREIGN-OWN"));
    expect(foreign.code).toBe("OK");
    if (foreign.code !== "OK") return;
    await expect(readQuoteCommand({ tenantId: KREILE_TENANT_SLUG, userId: users.buero, capabilities: { canCreateQuote: false, canReadQuote: true, canUpdateQuote: false, canConvertQuote: false } }, { quoteId: foreign.quote.quoteId })).resolves.toMatchObject({ code: "NOT_FOUND" });
    await expect(createQuoteCommand({ tenantId: "", userId: users.buero, capabilities: { canCreateQuote: true, canReadQuote: true, canUpdateQuote: true, canConvertQuote: true } }, quoteInput(customerId, "EMPTY-TENANT"))).resolves.not.toMatchObject({ code: "OK" });
  });

  it("does not award when F1.1 fails and keeps events and receipts append-only", async () => {
    const customerId = await createCustomer("ROLLBACK");
    const { createQuoteAction } = await import("@/app/actions/quotes.actions");
    const created = await createQuoteAction(quoteInput(customerId, "ROLLBACK"));
    expect(created.code).toBe("OK");
    if (created.code !== "OK") return;
    const clientEventId = randomUUID();
    const { prepareQuoteConversionCommand } = await import("@/modules/quotes/server-public");
    const prepared = await prepareQuoteConversionCommand({ tenantId: KREILE_TENANT_SLUG, userId: users.buero, capabilities: { canCreateQuote: true, canReadQuote: true, canUpdateQuote: true, canConvertQuote: true } }, {
      quoteId: created.quote.quoteId, clientEventId, expectedVersion: 1, confirmedAward: true, confirmedOrderDueDate: "2026-10-20",
    });
    expect(prepared.code).toBe("OK");
    if (prepared.code !== "OK") return;
    readAppSession.mockResolvedValueOnce({ ok: false, reason: "NO_COOKIE" });
    const { createOrderIntake } = await import("@/lib/server/commands/orderIntakeCommand");
    await expect(createOrderIntake(prepared.orderInput)).resolves.toMatchObject({ code: "UNAUTHENTICATED" });
    const [pending] = await db<{ status: string; version: number; linked_order_id: string | null; orders: number; awards: number }[]>`
      SELECT quote.status, quote.version, quote.linked_order_id,
        (SELECT count(*)::integer FROM public.orders WHERE tenant_id = quote.tenant_id AND source_ref = ${clientEventId}) AS orders,
        (SELECT count(*)::integer FROM public.events WHERE tenant_id = quote.tenant_id AND event_type = 'QUOTE_AWARDED_V1' AND payload->>'quoteId' = quote.id::text) AS awards
      FROM private.quotes quote WHERE quote.id = ${created.quote.quoteId}::uuid
    `;
    expect(pending).toEqual({ status: "draft", version: 1, linked_order_id: null, orders: 0, awards: 0 });
    await expect(db`UPDATE private.quote_create_receipts SET intent_sha256 = ${"0".repeat(64)} WHERE quote_id = ${created.quote.quoteId}::uuid`).rejects.toThrow();
    await expect(db`DELETE FROM public.events WHERE id = ${created.receipt.eventId}`).rejects.toThrow();
  });
});
