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
  throw new Error("H18_WORKSHOP_LOCAL_REPLAY_REQUIRED: DATABASE_URL must equal H18_EXPECTED_DATABASE_URL");
}
const parsed = new URL(DATABASE_URL);
if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/postgres" || parsed.username !== "postgres") {
  throw new Error("H18_WORKSHOP_LOCAL_REPLAY_REQUIRED: dedicated loopback Postgres expected");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("H18_WORKSHOP_LOCAL_REPLAY_REQUIRED: service role must be unset");

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const originalSecret = process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET = "h18-workshop-actions-local-only";

type Fixture = { actorId: string; actorIssuedAt: number; customerId: string };

async function withRequest<T>(cookie: string, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/h18-workshop-actions", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/h18-workshop-actions",
    route: "/h18-workshop-actions",
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
    { pathname: "/h18-workshop-actions", search: "" },
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
    displayName: "Rolf H18 Werkstatt",
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
        ${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`rolf-h18-workshop-${actorId}@local.invalid`},
        'Rolf H18 Werkstatt', 'meister', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
      )
    `;
    await transaction`
      INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
      SELECT ${KREILE_TENANT_SLUG}, ${actorId}::uuid, area, ${actorId}::uuid
      FROM unnest(ARRAY['eingang', 'auftraege', 'kunden', 'geld', 'kassieren']::text[]) area
    `;
    await transaction`
      INSERT INTO public.customers (
        id, tenant_id, customer_number, name, company_name, type, contact_person,
        email, phone, street, zip_code, city, country, payment_preference,
        ziel_freigeschaltet, ziel_tage, source
      ) VALUES (
        ${customerId}, ${KREILE_TENANT_SLUG}, ${`H18-W-${customerId.slice(0, 8)}`},
        'H18 Werkstattkunde', 'H18 Werkstattkunde GmbH', 'business', 'Ada Werkstatt',
        ${`werkstatt-${customerId}@local.invalid`}, '+49 711 5550192', 'Werkstattweg 18',
        '70178', 'Stuttgart', 'Deutschland', 'rechnung_14', true, 14, 'manual'
      )
    `;
  });
  const [clock] = await sql<{ updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS updated_at_ms
    FROM public.app_users WHERE id=${actorId}::uuid
  `;
  const actorIssuedAt = Date.now();
  if (!clock || Number(clock.updated_at_ms) >= actorIssuedAt) throw new Error("H18_WORKSHOP_SESSION_ORDER_INVALID");
  return { actorId, actorIssuedAt, customerId };
}

async function createOrder(fixture: Fixture, label: string, paymentMode: "vorkasse" | "rechnung") {
  const { createOrderIntakeAction } = await import("@/app/warendurchlauf/actions");
  const result = await withSession(fixture, () => createOrderIntakeAction({
    clientEventId: randomUUID(),
    customer: { mode: "EXISTING", customerId: fixture.customerId },
    dueDate: "2027-05-15",
    termStatus: "bestaetigt",
    intakeSource: "persoenlich",
    handoverMode: "pickup",
    paymentMode,
    note: `H18 Werkstatt ${label}`,
    items: [{
      catalogServiceId: null,
      name: `H18 Werkstattteil ${label}`,
      quantity: 1,
      material: "Stahl",
      surfaceRequested: "Hartchrom",
      executionRequested: "offen",
      unit: null,
      unitPriceCents: null,
      vatRateBasisPoints: null,
    }],
  }));
  if (result.code !== "OK") throw new Error(`H18_WORKSHOP_INTAKE_FAILED:${result.code}:${result.message}`);
  return result.receipt;
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

describe("H18 workshop Server Actions against the real replay database", () => {
  it("changes payment mode, moves stations and marks a part finished with DB, event and view readback", async () => {
    const fixture = await createFixture();
    const order = await createOrder(fixture, "A", "vorkasse");
    const itemId = order.items[0]?.id;
    if (!itemId) throw new Error("H18_WORKSHOP_ITEM_MISSING");
    const paymentClientEventId = randomUUID();
    const stationForwardClientEventId = randomUUID();
    const stationCorrectionClientEventId = randomUUID();
    const stationForwardAgainClientEventId = randomUUID();
    const finishedClientEventId = randomUUID();
    const { setPaymentModeAction } = await import("@/app/actions/payments.actions");
    const {
      correctGalvanikToWareneingangAction,
      getLiveOrderCardAction,
      setOrderItemFinishedAction,
      transitionWareneingangToGalvanikAction,
    } = await import("@/app/actions/orders.actions");

    const payment = await withSession(fixture, () => setPaymentModeAction({
      orderId: order.orderId,
      paymentMode: "rechnung",
      expectedVersion: 0,
      clientEventId: paymentClientEventId,
    }));
    expect(payment.code).toBe("OK");
    if (payment.code !== "OK") throw new Error(`H18_PAYMENT_MODE_FAILED:${payment.code}:${payment.message}`);
    const [paymentRow] = await sql<{ payment_mode: string; payment_mode_version: number; event_type: string }[]>`
      SELECT orders.payment_mode, orders.payment_mode_version, event.event_type
      FROM public.orders orders
      JOIN public.events event ON event.tenant_id=orders.tenant_id
        AND event.client_event_id=${paymentClientEventId}::uuid
      WHERE orders.id=${order.orderId} AND orders.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(paymentRow).toEqual({ payment_mode: "rechnung", payment_mode_version: 1, event_type: "PAYMENT_MODE_SET_V1" });
    const paymentView = await withSession(fixture, () => getLiveOrderCardAction({ orderId: order.orderId }));
    expect(paymentView).toMatchObject({ code: "OK", data: { card: { id: order.orderId } } });

    const firstForward = await withSession(fixture, () => transitionWareneingangToGalvanikAction({
      orderId: order.orderId,
      expectedVersion: 1,
      clientEventId: stationForwardClientEventId,
    }));
    expect(firstForward.code).toBe("OK");
    if (firstForward.code !== "OK") throw new Error(`H18_STATION_FORWARD_FAILED:${firstForward.code}:${firstForward.message}`);
    const correction = await withSession(fixture, () => correctGalvanikToWareneingangAction({
      orderId: order.orderId,
      expectedVersion: 2,
      clientEventId: stationCorrectionClientEventId,
      reason: "H18 Pruefruecknahme",
    }));
    expect(correction.code).toBe("OK");
    if (correction.code !== "OK") throw new Error(`H18_STATION_CORRECTION_FAILED:${correction.code}:${correction.message}`);
    const secondForward = await withSession(fixture, () => transitionWareneingangToGalvanikAction({
      orderId: order.orderId,
      expectedVersion: 3,
      clientEventId: stationForwardAgainClientEventId,
    }));
    expect(secondForward.code).toBe("OK");
    if (secondForward.code !== "OK") throw new Error(`H18_STATION_FORWARD_AGAIN_FAILED:${secondForward.code}:${secondForward.message}`);
    const [stationRow] = await sql<{
      station: string;
      version: number;
      forward_events: number;
      correction_events: number;
    }[]>`
      SELECT orders.station, orders.version,
        count(*) FILTER (WHERE event.event_type='ORDER_STATION_MOVED_V1')::integer AS forward_events,
        count(*) FILTER (WHERE event.event_type='ORDER_STATION_CORRECTED_V1')::integer AS correction_events
      FROM public.orders orders
      JOIN public.events event ON event.tenant_id=orders.tenant_id AND event.order_id=orders.id
      WHERE orders.id=${order.orderId} AND orders.tenant_id=${KREILE_TENANT_SLUG}
      GROUP BY orders.station, orders.version
    `;
    expect(stationRow).toEqual({ station: "galvanik", version: 4, forward_events: 2, correction_events: 1 });
    const stationView = await withSession(fixture, () => getLiveOrderCardAction({ orderId: order.orderId }));
    expect(stationView).toMatchObject({ code: "OK", data: { card: { id: order.orderId, station: "galvanik", version: 4 } } });

    const finished = await withSession(fixture, () => setOrderItemFinishedAction({
      orderId: order.orderId,
      itemId,
      expectedVersion: 4,
      clientEventId: finishedClientEventId,
      finished: true,
    }));
    expect(finished.code).toBe("OK");
    if (finished.code !== "OK") throw new Error(`H18_ITEM_FINISHED_FAILED:${finished.code}:${finished.message}`);
    const [finishedRow] = await sql<{ item_station: string; order_version: number; event_type: string }[]>`
      SELECT item.current_station_id AS item_station, orders.version AS order_version, event.event_type
      FROM public.items item
      JOIN public.orders orders ON orders.id=item.order_id AND orders.tenant_id=item.tenant_id
      JOIN public.events event ON event.tenant_id=orders.tenant_id
        AND event.client_event_id=${finishedClientEventId}::uuid
      WHERE item.id=${itemId} AND item.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(finishedRow).toEqual({ item_station: "fertig", order_version: 5, event_type: "ORDER_ITEM_FINISHED_CHANGED_V1" });
    const finishedView = await withSession(fixture, () => getLiveOrderCardAction({ orderId: order.orderId }));
    expect(finishedView).toMatchObject({
      code: "OK",
      data: { card: { id: order.orderId, version: 5, items: [expect.objectContaining({ id: itemId, finished: true })] } },
    });
  });

  it("records goods out through the UI action with DB, event and order-card readback", async () => {
    const fixture = await createFixture();
    const order = await createOrder(fixture, "B", "rechnung");
    const itemId = order.items[0]?.id;
    if (!itemId) throw new Error("H18_GOODS_OUT_ITEM_MISSING");
    const stationClientEventId = randomUUID();
    const finishedClientEventId = randomUUID();
    const freezeClientEventId = randomUUID();
    const freezeId = randomUUID();
    const rateId = randomUUID();
    const goodsOutClientEventId = randomUUID();
    await sql`
      INSERT INTO private.extra_work_hourly_rates
        (id, tenant_id, hourly_rate_cents, version, created_by, effective_at)
      SELECT ${rateId}::uuid, ${KREILE_TENANT_SLUG}, 12000,
        coalesce(max(version), 0) + 1, ${fixture.actorId}::uuid, now()
      FROM private.extra_work_hourly_rates
      WHERE tenant_id=${KREILE_TENANT_SLUG}
    `;
    const { recordGoodsOutAction } = await import("@/app/actions/goodsOut.actions");
    const {
      freezeOrderAction,
      getLiveOrderCardAction,
      setOrderItemFinishedAction,
      transitionWareneingangToGalvanikAction,
    } = await import("@/app/actions/orders.actions");
    const station = await withSession(fixture, () => transitionWareneingangToGalvanikAction({
      orderId: order.orderId,
      expectedVersion: 1,
      clientEventId: stationClientEventId,
    }));
    expect(station.code).toBe("OK");
    const finished = await withSession(fixture, () => setOrderItemFinishedAction({
      orderId: order.orderId,
      itemId,
      expectedVersion: 2,
      clientEventId: finishedClientEventId,
      finished: true,
    }));
    expect(finished.code).toBe("OK");
    const frozen = await withSession(fixture, () => freezeOrderAction({
      orderId: order.orderId,
      freezeId,
      expectedVersion: 3,
      clientEventId: freezeClientEventId,
    }));
    expect(frozen.code).toBe("OK");
    if (frozen.code !== "OK") throw new Error(`H18_FREEZE_FAILED:${frozen.code}:${frozen.message}`);
    const frozenView = await withSession(fixture, () => getLiveOrderCardAction({ orderId: order.orderId }));
    expect(frozenView).toMatchObject({ code: "OK", data: { card: { id: order.orderId, station: "fertig", status: "fertig", version: 4 } } });
    const result = await withSession(fixture, () => recordGoodsOutAction({
      orderId: order.orderId,
      mode: "abholung",
      expectedVersion: 4,
      clientEventId: goodsOutClientEventId,
    }));
    expect(result.code).toBe("OK");
    if (result.code !== "OK") throw new Error(`H18_GOODS_OUT_FAILED:${result.code}:${result.message}`);
    const [row] = await sql<{
      station: string;
      status: string;
      version: number;
      item_station: string;
      event_type: string;
    }[]>`
      SELECT orders.station, orders.status, orders.version,
        min(item.current_station_id) AS item_station, event.event_type
      FROM public.orders orders
      JOIN public.items item ON item.order_id=orders.id AND item.tenant_id=orders.tenant_id
      JOIN public.events event ON event.tenant_id=orders.tenant_id
        AND event.client_event_id=${goodsOutClientEventId}::uuid
      WHERE orders.id=${order.orderId} AND orders.tenant_id=${KREILE_TENANT_SLUG}
      GROUP BY orders.station, orders.status, orders.version, event.event_type
    `;
    expect(row).toEqual({
      station: "abgeholt",
      status: "abgeholt",
      version: 5,
      item_station: "abgeholt",
      event_type: "ORDER_PICKED_UP_V2",
    });
    const view = await withSession(fixture, () => getLiveOrderCardAction({ orderId: order.orderId }));
    expect(view).toMatchObject({ code: "OK", data: { card: { id: order.orderId, station: "abgeholt", status: "abgeholt", version: 5 } } });
  });
});
