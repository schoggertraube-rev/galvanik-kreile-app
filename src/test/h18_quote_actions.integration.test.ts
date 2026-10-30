// @vitest-environment node

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { AppSession } from "@/lib/server/appSession";

(globalThis as typeof globalThis & { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.H18_EXPECTED_DATABASE_URL;
if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("H18_QUOTE_LOCAL_REPLAY_REQUIRED: DATABASE_URL must equal H18_EXPECTED_DATABASE_URL");
}
const parsed = new URL(DATABASE_URL);
if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/postgres" || parsed.username !== "postgres") {
  throw new Error("H18_QUOTE_LOCAL_REPLAY_REQUIRED: dedicated loopback Postgres expected");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("H18_QUOTE_LOCAL_REPLAY_REQUIRED: service role must be unset");

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const originalSecret = process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET = "h18-quote-actions-local-only";

type Fixture = {
  actorId: string;
  actorIssuedAt: number;
  customerId: string;
};

async function withRequest<T>(cookie: string, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/h18-quote-actions", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/h18-quote-actions",
    route: "/h18-quote-actions",
    afterContext: {},
    previouslyRevalidatedTags: [],
    refreshTagsByCacheKind: new Map(),
    shouldTrackFetchMetrics: false,
    deploymentId: "test",
    buildId: "test",
    incrementalCache: {},
    cacheComponentsEnabled: false,
    runInCleanSnapshot: (fn: (...args: never[]) => unknown, ...args: never[]) => fn(...args),
    reactServerErrorsByDigest: new Map(),
  } as unknown as import("next/dist/server/app-render/work-async-storage.external").WorkStore;
  const requestStore = createRequestStoreForAPI(
    request,
    { pathname: "/h18-quote-actions", search: "" },
    { tags: [], expirationsByCacheKind: new Map() },
    undefined,
    undefined as never,
  );
  return workAsyncStorage.run(workStore, () => workUnitAsyncStorage.run(requestStore, work));
}

async function withSession<T>(fixture: Fixture, work: () => Promise<T>): Promise<T> {
  const { COOKIE_NAME, getSecretKey, signAppSession } = await import("@/lib/server/appSession");
  const session: AppSession = {
    userId: fixture.actorId,
    tenantId: KREILE_TENANT_SLUG,
    role: "meister",
    displayName: "Rolf H18 KV",
    issuedAt: fixture.actorIssuedAt,
    expiresAt: Date.now() + 5 * 60_000,
  };
  return withRequest(`${COOKIE_NAME}=${signAppSession(session, getSecretKey())}`, work);
}

async function createFixture(): Promise<Fixture> {
  const actorId = randomUUID();
  const customerId = randomUUID();
  const updatedAt = new Date(Date.now() - 5_000).toISOString();
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO public.app_users
        (id, tenant_id, email, full_name, role, active, created_at, updated_at)
      VALUES (
        ${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`rolf-h18-quote-${actorId}@local.invalid`},
        'Rolf H18 KV', 'meister', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
      )
    `;
    await transaction`
      INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
      SELECT ${KREILE_TENANT_SLUG}, ${actorId}::uuid, area, ${actorId}::uuid
      FROM unnest(ARRAY['eingang', 'auftraege', 'kunden', 'geld']::text[]) area
    `;
    await transaction`
      INSERT INTO public.customers (
        id, tenant_id, customer_number, name, company_name, type, contact_person,
        email, phone, street, zip_code, city, country, payment_preference,
        ziel_freigeschaltet, ziel_tage, source
      ) VALUES (
        ${customerId}, ${KREILE_TENANT_SLUG}, ${`H18-KV-${customerId.slice(0, 8)}`},
        'H18 KV Kunde', 'H18 KV Kunde GmbH', 'business', 'Ada Angebot',
        ${`kv-${customerId}@local.invalid`}, '+49 711 5550189', 'Angebotsweg 18',
        '70175', 'Stuttgart', 'Deutschland', 'rechnung_14', true, 14, 'manual'
      )
    `;
  });
  const [clock] = await sql<{ updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS updated_at_ms
    FROM public.app_users WHERE id=${actorId}::uuid
  `;
  const actorIssuedAt = Date.now();
  if (!clock || Number(clock.updated_at_ms) >= actorIssuedAt) throw new Error("H18_QUOTE_SESSION_ORDER_INVALID");
  return { actorId, actorIssuedAt, customerId };
}

beforeAll(async () => {
  const migrations = await sql<{ version: string }[]>`
    SELECT version::text FROM supabase_migrations.schema_migrations ORDER BY version
  `;
  const repositoryMigrations = readdirSync(join(process.cwd(), "supabase", "migrations"))
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .map((file) => file.slice(0, file.indexOf("_")))
    .sort();
  expect(migrations.map((row) => row.version)).toEqual(repositoryMigrations);
});

afterAll(async () => {
  await sql.end({ timeout: 1 });
  if (originalSecret === undefined) delete process.env.APP_SESSION_SECRET;
  else process.env.APP_SESSION_SECRET = originalSecret;
});

describe("H18 quote Server Actions against the real replay database", () => {
  it("creates, updates and converts through the UI actions with DB, event and view readback", async () => {
    const fixture = await createFixture();
    const createClientEventId = randomUUID();
    const updateClientEventId = randomUUID();
    const convertClientEventId = randomUUID();
    const {
      convertQuoteToOrderAction,
      createQuoteAction,
      readQuoteAction,
      updateQuoteAction,
    } = await import("@/app/actions/quotes.actions");
    const { getLiveOrderCardAction } = await import("@/app/actions/orders.actions");

    const created = await withSession(fixture, () => createQuoteAction({
      clientEventId: createClientEventId,
      customerId: fixture.customerId,
      dueDate: "2027-04-10",
      note: "H18 KV Anlage",
      positions: [
        { name: "H18 Flansch", quantity: 2, material: "Stahl", surfaceRequested: "Verzinken", unitPriceCents: 12_500 },
        { name: "H18 Halter", quantity: 3, material: null, surfaceRequested: "Vernickeln", unitPriceCents: 800 },
      ],
    }));
    expect(created.code).toBe("OK");
    if (created.code !== "OK") throw new Error(`H18_QUOTE_CREATE_FAILED:${created.code}:${created.message}`);
    const [createdRow] = await sql<{
      id: string;
      customer_id: string;
      status: string;
      version: number;
      event_type: string;
      actor_id: string;
    }[]>`
      SELECT quote.id::text, quote.customer_id::text, quote.status, quote.version,
        event.event_type, event.user_id::text AS actor_id
      FROM private.quotes quote
      JOIN public.events event ON event.tenant_id=quote.tenant_id
        AND event.client_event_id=${createClientEventId}::uuid
      WHERE quote.id=${created.quote.quoteId}::uuid AND quote.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(createdRow).toEqual({
      id: created.quote.quoteId,
      customer_id: fixture.customerId,
      status: "draft",
      version: 1,
      event_type: "QUOTE_CREATED_V1",
      actor_id: fixture.actorId,
    });
    const createdView = await withSession(fixture, () => readQuoteAction({ quoteId: created.quote.quoteId }));
    expect(createdView).toMatchObject({ code: "OK", quote: { quoteId: created.quote.quoteId, version: 1, status: "draft" } });

    const updated = await withSession(fixture, () => updateQuoteAction({
      quoteId: created.quote.quoteId,
      clientEventId: updateClientEventId,
      expectedVersion: 1,
      dueDate: "2027-04-17",
      note: "H18 KV Aenderung",
      positions: [
        { name: "H18 Flansch aktualisiert", quantity: 4, material: "Stahl", surfaceRequested: "Vernickeln", unitPriceCents: 9_000 },
      ],
    }));
    expect(updated.code).toBe("OK");
    if (updated.code !== "OK") throw new Error(`H18_QUOTE_UPDATE_FAILED:${updated.code}:${updated.message}`);
    const [updatedRow] = await sql<{
      due_date: string;
      status: string;
      version: number;
      event_type: string;
      position_count: number;
    }[]>`
      SELECT quote.due_date::text, quote.status, quote.version, event.event_type,
        (SELECT count(*)::integer FROM private.quote_positions position
          WHERE position.tenant_id=quote.tenant_id AND position.quote_id=quote.id
            AND position.revision=quote.version) AS position_count
      FROM private.quotes quote
      JOIN public.events event ON event.tenant_id=quote.tenant_id
        AND event.client_event_id=${updateClientEventId}::uuid
      WHERE quote.id=${created.quote.quoteId}::uuid AND quote.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(updatedRow).toEqual({
      due_date: "2027-04-17",
      status: "draft",
      version: 2,
      event_type: "QUOTE_UPDATED_V1",
      position_count: 1,
    });
    const updatedView = await withSession(fixture, () => readQuoteAction({ quoteId: created.quote.quoteId }));
    expect(updatedView).toMatchObject({
      code: "OK",
      quote: { version: 2, dueDate: "2027-04-17", positions: [expect.objectContaining({ name: "H18 Flansch aktualisiert", quantity: 4 })] },
    });

    const converted = await withSession(fixture, () => convertQuoteToOrderAction({
      quoteId: created.quote.quoteId,
      clientEventId: convertClientEventId,
      expectedVersion: 2,
      confirmedAward: true,
      confirmedOrderDueDate: "2027-04-24",
      handoverMode: "pickup",
      paymentMode: "rechnung",
    }));
    expect(converted.code).toBe("OK");
    if (converted.code !== "OK") throw new Error(`H18_QUOTE_CONVERT_FAILED:${converted.code}:${converted.message}`);
    const [convertedRow] = await sql<{
      status: string;
      version: number;
      linked_order_id: string;
      order_customer_id: string;
      intake_events: number;
      award_events: number;
    }[]>`
      SELECT quote.status, quote.version, quote.linked_order_id::text,
        orders.customer_id::text AS order_customer_id,
        (SELECT count(*)::integer FROM public.events event
          WHERE event.tenant_id=quote.tenant_id AND event.order_id=orders.id
            AND event.event_type='ORDER_INTAKE_CREATED_V1'
            AND event.client_event_id=${convertClientEventId}::uuid) AS intake_events,
        (SELECT count(*)::integer FROM public.events event
          WHERE event.tenant_id=quote.tenant_id AND event.event_type='QUOTE_AWARDED_V1'
            AND event.payload->>'quoteId'=quote.id::text) AS award_events
      FROM private.quotes quote
      JOIN public.orders orders ON orders.id=quote.linked_order_id AND orders.tenant_id=quote.tenant_id
      WHERE quote.id=${created.quote.quoteId}::uuid AND quote.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(convertedRow).toEqual({
      status: "converted",
      version: 3,
      linked_order_id: converted.orderReceipt.orderId,
      order_customer_id: fixture.customerId,
      intake_events: 1,
      award_events: 1,
    });
    const convertedQuoteView = await withSession(fixture, () => readQuoteAction({ quoteId: created.quote.quoteId }));
    expect(convertedQuoteView).toMatchObject({
      code: "OK",
      quote: { status: "converted", version: 3, linkedOrderId: converted.orderReceipt.orderId },
    });
    const convertedOrderView = await withSession(fixture, () => getLiveOrderCardAction({ orderId: converted.orderReceipt.orderId }));
    expect(convertedOrderView).toMatchObject({
      code: "OK",
      data: { card: { id: converted.orderReceipt.orderId, customerId: fixture.customerId } },
    });
  });
});
