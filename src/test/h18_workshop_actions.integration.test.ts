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

async function createFixture(areas:string[]=['eingang', 'auftraege', 'kunden', 'geld', 'kassieren', 'entscheiden']): Promise<Fixture> {
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
      FROM unnest(${areas}::text[]) area
    `;
    await transaction`
      INSERT INTO public.customers (
        id, tenant_id, customer_number, name, company_name, type, contact_person, email, phone, street, zip_code, city, country, payment_preference, ziel_freigeschaltet, ziel_tage, source, first_name, last_name, salutation, house_number
      ) VALUES (
        ${customerId}, ${KREILE_TENANT_SLUG}, ${`H18-W-${customerId.slice(0, 8)}`}, 'H18 Werkstattkunde', 'H18 Werkstattkunde GmbH', 'business', 'Ada Werkstatt', ${`werkstatt-${customerId}@local.invalid`}, '+49 711 5550192', (SELECT street FROM private.kunde_split_street('Werkstattweg 18')), '70178', 'Stuttgart', private.kunde_land_schluessel('Deutschland'), 'rechnung', true, 14, 'manual', (SELECT first_name FROM private.kunde_split_name('Ada Werkstatt')), (SELECT last_name FROM private.kunde_split_name('Ada Werkstatt')), (SELECT salutation FROM private.kunde_split_name('Ada Werkstatt')), (SELECT house_number FROM private.kunde_split_street('Werkstattweg 18'))
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
  const { createOrderIntakeAction } = await import("@/app/actions/eingang.actions");
  const result = await withSession(fixture, () => createOrderIntakeAction({ geprueft: true,
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
      surfaceRequested: "Verchromen",
      executionRequested: "offen",
      unit: null,
      unitPriceCents: null,
      vatRateBasisPoints: null,
    }],
  }));
  if (result.code !== "OK") throw new Error(`H18_WORKSHOP_INTAKE_FAILED:${result.code}:${result.message}`);
  return result.receipt;
}

async function createReworkComplaint(
  fixture: Fixture,
  order: { orderId: string; items: Array<{ id: string }> },
): Promise<{ complaintId: string; version: number }> {
  const sourceItem = order.items[0];
  if (!sourceItem) throw new Error("H18_REWORK_SOURCE_ITEM_MISSING");
  const complaintId = randomUUID();
  await sql`
    INSERT INTO public.complaints (
      id, tenant_id, order_id, customer_id, item_id, reason, description, status,
      nummer, client_key, teile, mangel, fotos, ware_zurueck, stand, version,
      erstellt_von, erstellt_am
    ) VALUES (
      ${complaintId}, ${KREILE_TENANT_SLUG}, ${order.orderId}, ${fixture.customerId}, ${sourceItem.id},
      'H18 Reklamation', 'H18 Nacharbeit pruefen', 'open',
      ${`RK-H18-${complaintId.slice(0, 8)}`}, ${randomUUID()}::uuid,
      ${sql.json([{ position_id: sourceItem.id, menge: 1 }])}::jsonb,
      'H18 Mangel', '[]'::jsonb, 'ja', 'aufgenommen', 1,
      ${fixture.actorId}::uuid, statement_timestamp() AT TIME ZONE 'UTC'
    )
  `;
  return { complaintId, version: 1 };
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
    const labelPrintClientEventId = randomUUID();
    const stationForwardClientEventId = randomUUID();
    const stationCorrectionClientEventId = randomUUID();
    const stationForwardAgainClientEventId = randomUUID();
    const finishedClientEventId = randomUUID();
    const { setPaymentModeAction } = await import("@/app/actions/payments.actions");
    const {
      correctGalvanikToWareneingangAction,
      getLiveOrderCardAction,
      recordOrderLabelPrintAction,
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

    const label = await withSession(fixture, () => recordOrderLabelPrintAction({
      orderId: order.orderId,
      clientEventId: labelPrintClientEventId,
    }));
    expect(label.code).toBe("OK");
    if (label.code !== "OK") throw new Error(`H18_LABEL_PRINT_FAILED:${label.code}:${label.message}`);
    const [labelRow] = await sql<{
      order_id: string;
      event_type: string;
      description: string;
      aggregate_version: number;
    }[]>`
      SELECT order_id, event_type, description, aggregate_version
      FROM public.events
      WHERE tenant_id=${KREILE_TENANT_SLUG}
        AND client_event_id=${labelPrintClientEventId}::uuid
    `;
    expect(labelRow).toEqual({
      order_id: order.orderId,
      event_type: "laufzettel_gedruckt",
      description: "Laufzettel gedruckt",
      aggregate_version: 1,
    });
    const labelReplay = await withSession(fixture, () => recordOrderLabelPrintAction({
      orderId: order.orderId,
      clientEventId: labelPrintClientEventId,
    }));
    expect(labelReplay).toMatchObject({ code: "OK", replayed: true, receipt: { eventId: label.receipt.eventId } });
    const labelView = await withSession(fixture, () => getLiveOrderCardAction({ orderId: order.orderId }));
    expect(labelView).toMatchObject({
      code: "OK",
      data: { card: { labelPrints: [expect.objectContaining({ eventId: label.receipt.eventId })] } },
    });

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

  it("ABS-07 records a collection goods-out once through the action with collection, event and card reread", async () => {
    const fixture = await createFixture();
    const order = await createOrder(fixture, "Sammelrechnung", "rechnung");
    const itemId = order.items[0]?.id;
    if (!itemId) throw new Error("H18_COLLECTION_ITEM_MISSING");
    const agreementClientKey = randomUUID();
    const stationClientEventId = randomUUID();
    const finishedClientEventId = randomUUID();
    const freezeClientEventId = randomUUID();
    const goodsOutClientEventId = randomUUID();
    const freezeId = randomUUID();
    const rateId = randomUUID();
    const { saveCustomerAgreementAction } = await import("@/app/actions/customers.actions");
    const { recordGoodsOutAction } = await import("@/app/actions/goodsOut.actions");
    const {
      freezeOrderAction,
      getLiveOrderCardAction,
      setOrderItemFinishedAction,
      transitionWareneingangToGalvanikAction,
    } = await import("@/app/actions/orders.actions");

    const agreement = await withSession(fixture, () => saveCustomerAgreementAction({
      clientKey: agreementClientKey,
      customerId: fixture.customerId,
      orderId: null,
      type: "sammelrechnung",
      targetDays: 30,
      validUntil: null,
      reason: "Synthetischer ABS-07-Sammelrechnungslauf",
      version: null,
    }));
    if (agreement.code !== "OK") throw new Error(`H18_COLLECTION_AGREEMENT_FAILED:${agreement.code}:${agreement.message}`);

    await sql`
      INSERT INTO private.extra_work_hourly_rates
        (id, tenant_id, hourly_rate_cents, version, created_by, effective_at)
      SELECT ${rateId}::uuid, ${KREILE_TENANT_SLUG}, 12000,
        coalesce(max(version), 0) + 1, ${fixture.actorId}::uuid, now()
      FROM private.extra_work_hourly_rates
      WHERE tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(await withSession(fixture, () => transitionWareneingangToGalvanikAction({
      orderId: order.orderId,
      expectedVersion: 1,
      clientEventId: stationClientEventId,
    }))).toMatchObject({ code: "OK" });
    expect(await withSession(fixture, () => setOrderItemFinishedAction({
      orderId: order.orderId,
      itemId,
      expectedVersion: 2,
      clientEventId: finishedClientEventId,
      finished: true,
    }))).toMatchObject({ code: "OK" });
    expect(await withSession(fixture, () => freezeOrderAction({
      orderId: order.orderId,
      freezeId,
      expectedVersion: 3,
      clientEventId: freezeClientEventId,
    }))).toMatchObject({ code: "OK" });

    const input = {
      orderId: order.orderId,
      mode: "abholung" as const,
      expectedVersion: 4,
      clientEventId: goodsOutClientEventId,
      agreement: {
        id: agreement.agreement.id,
        type: "sammelrechnung" as const,
        version: agreement.agreement.version,
      },
    };
    const booked = await withSession(fixture, () => recordGoodsOutAction(input));
    expect(booked).toMatchObject({
      code: "OK",
      replayed: false,
      receipt: {
        eventSchemaVersion: 3,
        settlement: "collection",
        agreement: input.agreement,
      },
    });
    expect(await sql<{
      customer_id: string;
      current_month: boolean;
      target_days: number;
      status: string;
      order_id: string;
      event_type: string;
      settlement: string;
      invoice_count: number;
    }[]>`
      SELECT collection.customer_id,
        collection.monat = date_trunc('month', timezone('Europe/Berlin', now()))::date AS current_month,
        collection.ziel_tage AS target_days,
        collection.status,
        link.order_id,
        event.event_type,
        event.payload->>'settlement' AS settlement,
        (SELECT count(*)::integer FROM public.invoices invoice
          WHERE invoice.tenant_id=collection.tenant_id AND invoice.order_id=link.order_id) AS invoice_count
      FROM public.invoice_collections collection
      JOIN public.invoice_collection_orders link
        ON link.tenant_id=collection.tenant_id AND link.collection_id=collection.id
      JOIN public.events event
        ON event.tenant_id=collection.tenant_id AND event.client_event_id=${goodsOutClientEventId}::uuid
      WHERE collection.tenant_id=${KREILE_TENANT_SLUG} AND link.order_id=${order.orderId}
    `).toEqual([{
      customer_id: fixture.customerId,
      current_month: true,
      target_days: 30,
      status: "offen",
      order_id: order.orderId,
      event_type: "ORDER_PICKED_UP_V3",
      settlement: "collection",
      invoice_count: 0,
    }]);
    expect(await withSession(fixture, () => recordGoodsOutAction(input))).toMatchObject({ code: "OK", replayed: true });
    expect(await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM public.invoice_collection_orders
      WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}
    `).toEqual([{ count: 1 }]);
    expect(await withSession(fixture, () => getLiveOrderCardAction({ orderId: order.orderId })))
      .toMatchObject({ code: "OK", data: { card: { id: order.orderId, station: "abgeholt", status: "abgeholt", version: 5 } } });
  });

  it("creates and closes rework through real actions with DB, event and order-card readback", async () => {
    const fixture = await createFixture();
    const source = await createOrder(fixture, "REWORK", "vorkasse");
    const complaint = await createReworkComplaint(fixture, source);
    const { nacharbeitAnlegenAction } = await import("@/app/actions/complaints.actions");
    const { saveGoodsReceiptAction } = await import("@/app/actions/eingang.actions");
    const {
      freezeOrderAction,
      getLiveOrderCardAction,
      setOrderItemFinishedAction,
      transitionWareneingangToGalvanikAction,
    } = await import("@/app/actions/orders.actions");
    const { recordGoodsOutAction } = await import("@/app/actions/goodsOut.actions");

    const created = await withSession(fixture, () => nacharbeitAnlegenAction({
      reklamationId: complaint.complaintId,
      bewertung: "berechtigt",
      massnahme: "nacharbeit",
      liefertermin: "2027-05-20",
      version: complaint.version,
    }));
    expect(created.code).toBe("OK");
    if (created.code !== "OK") throw new Error(`H18_REWORK_CREATE_FAILED:${created.code}:${created.message}`);

    const replay = await withSession(fixture, () => nacharbeitAnlegenAction({
      reklamationId: complaint.complaintId,
      bewertung: "berechtigt",
      massnahme: "nacharbeit",
      liefertermin: "2027-05-20",
      version: complaint.version,
    }));
    expect(replay).toMatchObject({ code: "OK", replayed: true, receipt: { orderId: created.receipt.orderId } });

    const [createdRow] = await sql<{
      payment_mode: string;
      nacharbeit_zu: string;
      ware: string;
      geprueft: boolean;
      handover_mode: string;
      complaint_stand: string;
      complaint_massnahme: string;
      complaint_legacy_reason: string;
      complaint_legacy_description: string;
      complaint_legacy_status: string;
      event_type: string;
    }[]>`
      SELECT
        orders.payment_mode, orders.nacharbeit_zu, orders.ware, orders.geprueft, orders.handover_mode,
        complaint.stand AS complaint_stand, complaint.massnahme AS complaint_massnahme,
        complaint.reason AS complaint_legacy_reason,
        complaint.description AS complaint_legacy_description,
        complaint.status AS complaint_legacy_status,
        event.event_type
      FROM public.orders orders
      JOIN public.complaints complaint
        ON complaint.tenant_id=orders.tenant_id AND complaint.id=orders.nacharbeit_zu
      JOIN public.events event
        ON event.tenant_id=orders.tenant_id AND event.order_id=orders.id
      WHERE orders.tenant_id=${KREILE_TENANT_SLUG}
        AND orders.id=${created.receipt.orderId}
        AND event.id=${created.receipt.eventId}
    `;
    expect(createdRow).toEqual({
      payment_mode: "keiner",
      nacharbeit_zu: complaint.complaintId,
      ware: "erwartet",
      geprueft: false,
      handover_mode: "pickup",
      complaint_stand: "massnahme_nacharbeit",
      complaint_massnahme: "nacharbeit",
      complaint_legacy_reason: "H18 Reklamation",
      complaint_legacy_description: "H18 Nacharbeit pruefen",
      complaint_legacy_status: "open",
      event_type: "ORDER_REWORK_CREATED_V1",
    });
    const createdView = await withSession(fixture, () => getLiveOrderCardAction({ orderId: created.receipt.orderId }));
    expect(createdView).toMatchObject({ code: "OK", data: { card: { id: created.receipt.orderId } } });

    const [receivedItem] = await sql<{ id: string; quantity: number | string; version: number }[]>`
      SELECT item.id, item.quantity, orders.version
      FROM public.items item
      JOIN public.orders orders ON orders.id=item.order_id AND orders.tenant_id=item.tenant_id
      WHERE item.tenant_id=${KREILE_TENANT_SLUG} AND item.order_id=${created.receipt.orderId}
    `;
    if (!receivedItem || !Number.isFinite(Number(receivedItem.quantity))) {
      throw new Error("H18_REWORK_CREATED_ITEM_MISSING");
    }
    const goodsReceipt = await withSession(fixture, () => saveGoodsReceiptAction({
      id: randomUUID(),
      clientKey: randomUUID(),
      clientEventId: randomUUID(),
      itemId: null,
      orderId: created.receipt.orderId,
      expectedOrderVersion: receivedItem.version,
      expectedVersion: 0,
      mode: "erwartet",
      command: "accept",
      card: 0,
      packagesReceived: 1,
      packagesTotal: 1,
      condition: "unauffaellig",
      deviations: [],
      foundUnattended: false,
      foundAt: null,
      procedure: null,
      procedureNote: null,
      photos: [],
      quantities: [{
        itemId: receivedItem.id,
        expected: Number(receivedItem.quantity),
        received: null,
        confirmed: true,
        note: null,
      }],
    }));
    expect(goodsReceipt.code).toBe("OK");
    if (goodsReceipt.code !== "OK") throw new Error(`H18_REWORK_GOODS_RECEIPT_FAILED:${goodsReceipt.code}:${goodsReceipt.message}`);
    const [receivedOrder] = await sql<{ version: number; ware: string }[]>`
      SELECT version, ware FROM public.orders
      WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${created.receipt.orderId}
    `;
    expect(receivedOrder?.ware).toBe("da");
    if (!receivedOrder) throw new Error("H18_REWORK_RECEIVED_ORDER_MISSING");
    const moved = await withSession(fixture, () => transitionWareneingangToGalvanikAction({
      orderId: created.receipt.orderId,
      expectedVersion: receivedOrder.version,
      clientEventId: randomUUID(),
    }));
    expect(moved.code).toBe("OK");
    if (moved.code !== "OK") throw new Error(`H18_REWORK_STATION_MOVE_FAILED:${moved.code}:${moved.message}`);
    const finished = await withSession(fixture, () => setOrderItemFinishedAction({
      orderId: created.receipt.orderId,
      itemId: receivedItem.id,
      expectedVersion: moved.receipt.aggregateVersion,
      clientEventId: randomUUID(),
      finished: true,
    }));
    expect(finished.code).toBe("OK");
    if (finished.code !== "OK") throw new Error(`H18_REWORK_ITEM_FINISHED_FAILED:${finished.code}:${finished.message}`);
    const rateId = randomUUID();
    await sql`
      INSERT INTO private.extra_work_hourly_rates
        (id, tenant_id, hourly_rate_cents, version, created_by, effective_at)
      SELECT ${rateId}::uuid, ${KREILE_TENANT_SLUG}, 12000,
        coalesce(max(version), 0) + 1, ${fixture.actorId}::uuid, now()
      FROM private.extra_work_hourly_rates
      WHERE tenant_id=${KREILE_TENANT_SLUG}
    `;
    const [ready] = await sql<{ version: number }[]>`
      SELECT version FROM public.orders
      WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${created.receipt.orderId}
    `;
    if (!ready) throw new Error("H18_REWORK_READY_ORDER_MISSING");
    const frozen = await withSession(fixture, () => freezeOrderAction({
      orderId: created.receipt.orderId,
      freezeId: randomUUID(),
      expectedVersion: ready.version,
      clientEventId: randomUUID(),
    }));
    expect(frozen.code).toBe("OK");
    if (frozen.code !== "OK") throw new Error(`H18_REWORK_FREEZE_FAILED:${frozen.code}:${frozen.message}`);
    const [frozenOrder] = await sql<{ version: number; ausgabe_frei: boolean }[]>`
      SELECT version, ausgabe_frei FROM public.orders
      WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${created.receipt.orderId}
    `;
    expect(frozenOrder?.ausgabe_frei).toBe(true);
    if (!frozenOrder) throw new Error("H18_REWORK_FROZEN_ORDER_MISSING");

    const goodsOut = await withSession(fixture, () => recordGoodsOutAction({
      orderId: created.receipt.orderId,
      mode: "abholung",
      expectedVersion: frozenOrder.version,
      clientEventId: randomUUID(),
    }));
    expect(goodsOut.code).toBe("OK");
    if (goodsOut.code !== "OK") throw new Error(`H18_REWORK_GOODS_OUT_FAILED:${goodsOut.code}:${goodsOut.message}`);
    const [closedRow] = await sql<{
      station: string;
      complaint_stand: string;
      abschluss_art: string;
      event_type: string;
    }[]>`
      SELECT orders.station, complaint.stand AS complaint_stand, complaint.abschluss_art, event.event_type
      FROM public.orders orders
      JOIN public.complaints complaint
        ON complaint.tenant_id=orders.tenant_id AND complaint.id=orders.nacharbeit_zu
      JOIN public.events event
        ON event.tenant_id=orders.tenant_id AND event.order_id=orders.id
      WHERE orders.tenant_id=${KREILE_TENANT_SLUG}
        AND orders.id=${created.receipt.orderId}
        AND event.client_event_id=${goodsOut.code === "OK" ? goodsOut.receipt.clientEventId : ""}::uuid
    `;
    expect(closedRow).toEqual({
      station: "abgeholt",
      complaint_stand: "abgeschlossen",
      abschluss_art: "nacharbeit_raus",
      event_type: "ORDER_PICKED_UP_V4",
    });
    const closedView = await withSession(fixture, () => getLiveOrderCardAction({ orderId: created.receipt.orderId }));
    expect(closedView).toMatchObject({ code: "OK", data: { card: { id: created.receipt.orderId, station: "abgeholt" } } });
    const [closedComplaint] = await sql`SELECT version FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${complaint.complaintId}`;
    const reopened=await complaintWrite(fixture,{action:'wieder_oeffnen',clientKey:randomUUID(),complaintId:complaint.complaintId,version:closedComplaint.version,reason:'TEST erneuter Mangel nach Nacharbeit'});
    const duplicate=await withSession(fixture,()=>nacharbeitAnlegenAction({reklamationId:complaint.complaintId,version:reopened.version,bewertung:'berechtigt',massnahme:'nacharbeit',liefertermin:'2027-05-20'}));
    expect(duplicate).toMatchObject({code:'VALIDATION_ERROR',message:expect.stringContaining('Neue Reklamation zum Nacharbeitsauftrag')});
    const [history]=await sql`SELECT count(*)::int AS n,min(id) AS id FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND nacharbeit_zu=${complaint.complaintId}`;
    expect(history).toEqual({n:1,id:created.receipt.orderId});
    const next=await complaintWrite(fixture,{action:'aufnehmen',clientKey:randomUUID(),orderId:created.receipt.orderId,intakeItemId:null,intakeVersion:null,parts:[{position_id:receivedItem.id,menge:1}],defect:'Blasen',description:'TEST neuer Kreislauf zur Nacharbeit',photoIds:[],goodsReturn:'offen'});
    const [nextRow]=await sql`SELECT order_id FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${next.complaintId}`;
    expect(nextRow).toEqual({order_id:created.receipt.orderId});
  });
});

it("4c reader exposes the persisted complaint lifecycle through the existing action and customer timeline", async () => {
  const fixture = await createFixture();
  const order = await createOrder(fixture, "4C-READ", "vorkasse");
  const complaint = await createReworkComplaint(fixture, order);
  const { getByOrder } = await import("@/app/actions/complaints.actions");
  const { getTimelineForCustomerDb } = await import("@/app/actions/timeline.actions");
  const result = await withSession(fixture, () => getByOrder(order.orderId));
  expect(result.code).toBe("OK");
  if (result.code !== "OK") throw Error(result.message);
  expect(result.complaints).toEqual([expect.objectContaining({
    id: complaint.complaintId, customerId: fixture.customerId, orderId: order.orderId,
    stand: "aufgenommen", version: 1, wareZurueck: "ja", nacharbeitAuftragId: null,
  })]);
  const [row] = await sql`SELECT nummer,stand,version FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${complaint.complaintId}`;
  expect(result.complaints[0]).toMatchObject({ nummer: row.nummer, stand: row.stand, version: row.version });
  const timeline = await withSession(fixture, () => getTimelineForCustomerDb(fixture.customerId));
  expect(timeline.ok).toBe(true);
  if (!timeline.ok) throw Error(timeline.message);
  expect(timeline.data).toContainEqual(expect.objectContaining({ id: complaint.complaintId, type: "complaint", orderId: order.orderId }));
});

async function deliveredComplaintSource(fixture:Fixture) {
  const order=await createOrder(fixture,'4C-TEST','rechnung');
  const {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,freezeOrderAction}=await import('@/app/actions/orders.actions');
  const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
  await sql`INSERT INTO private.extra_work_hourly_rates(id,tenant_id,hourly_rate_cents,version,created_by,effective_at)
    SELECT ${randomUUID()}::uuid,${KREILE_TENANT_SLUG},12000,coalesce(max(version),0)+1,${fixture.actorId}::uuid,now()
    FROM private.extra_work_hourly_rates WHERE tenant_id=${KREILE_TENANT_SLUG}`;
  expect(await withSession(fixture,()=>transitionWareneingangToGalvanikAction({orderId:order.orderId,expectedVersion:1,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  expect(await withSession(fixture,()=>setOrderItemFinishedAction({orderId:order.orderId,itemId:order.items[0].id,expectedVersion:2,clientEventId:randomUUID(),finished:true}))).toMatchObject({code:'OK'});
  expect(await withSession(fixture,()=>freezeOrderAction({orderId:order.orderId,freezeId:randomUUID(),expectedVersion:3,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  expect(await withSession(fixture,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:4,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  return order;
}

async function complaintWrite(fixture:Fixture,input:import('@/modules/complaints/public').ComplaintCommand) {
  const {reklamationAusfuehrenAction,getByOrder}=await import('@/app/actions/complaints.actions');
  const result=await withSession(fixture,()=>reklamationAusfuehrenAction(input));
  expect(result.code,result.code==='OK'?'OK':result.message).toBe('OK');
  if(result.code!=='OK')throw Error(result.message);
  const [row]=await sql`SELECT complaint.id,complaint.nummer,complaint.stand,complaint.version,event.id AS event_id,event.payload
    FROM public.complaints complaint JOIN public.events event ON event.tenant_id=complaint.tenant_id AND event.order_id=complaint.order_id
    WHERE complaint.tenant_id=${KREILE_TENANT_SLUG} AND complaint.id=${result.receipt.complaintId} AND event.client_event_id=${input.clientKey}::uuid`;
  expect(row).toMatchObject({id:result.receipt.complaintId,nummer:result.receipt.number,stand:result.receipt.state,version:result.receipt.version,event_id:result.receipt.eventId,payload:{action:input.action,after:{stand:result.receipt.state}}});
  const [source]=await sql`SELECT order_id FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${result.receipt.complaintId}`;
  const view=await withSession(fixture,()=>getByOrder(source.order_id));
  expect(view).toMatchObject({code:'OK',complaints:expect.arrayContaining([expect.objectContaining({id:result.receipt.complaintId,stand:result.receipt.state,version:result.receipt.version})])});
  return result.receipt;
}

it('4c writes recording, credit, closure, reopening and withdrawal through real UI actions with DB/event/view readback',async()=>{
  const fixture=await createFixture(),order=await deliveredComplaintSource(fixture);
  const {getComplaintOrderChoicesAction}=await import('@/app/actions/complaints.actions');
  expect(await withSession(fixture,()=>getComplaintOrderChoicesAction(fixture.customerId))).toMatchObject({code:'OK',orders:expect.arrayContaining([expect.objectContaining({id:order.orderId})])});
  const input:import('@/modules/complaints/public').ComplaintCommand={action:'aufnehmen',clientKey:randomUUID(),orderId:order.orderId,intakeItemId:null,intakeVersion:null,parts:[{position_id:order.items[0].id,menge:1}],defect:'Blasen',description:'TEST 4c lokale Replay-DB',photoIds:[],goodsReturn:'offen'};
  const {reklamationAusfuehrenAction}=await import('@/app/actions/complaints.actions');
  const missingPhotoKey=randomUUID();
  expect(await withSession(fixture,()=>reklamationAusfuehrenAction({...input,clientKey:missingPhotoKey,photoIds:[randomUUID()]}))).toMatchObject({code:'VALIDATION_ERROR'});
  const [missingPhotoRow]=await sql`SELECT count(*)::integer AS n FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${missingPhotoKey}::uuid`;
  expect(missingPhotoRow.n).toBe(0);
  const received=await complaintWrite(fixture,input);
  const repeated=await withSession(fixture,()=>reklamationAusfuehrenAction(input));
  expect(repeated).toMatchObject({code:'OK',replayed:true,receipt:received});
  const changed=await withSession(fixture,()=>reklamationAusfuehrenAction({...input,defect:'Abplatzung'}));
  expect(changed.code).toBe('CONFLICT');
  const decided=await complaintWrite(fixture,{action:'entscheiden',clientKey:randomUUID(),complaintId:received.complaintId,version:1,assessment:'kulanz',measure:'gutschrift',reason:null,creditCents:5000});
  expect(decided.state).toBe('massnahme_gutschrift');
  const credited=await complaintWrite(fixture,{action:'gutschrift',clientKey:randomUUID(),complaintId:received.complaintId,version:2,creditCents:5000,creditNumber:'GS-TEST-4C'});
  expect(credited.state).toBe('kunde_informieren');
  const closed=await complaintWrite(fixture,{action:'abschliessen',clientKey:randomUUID(),complaintId:received.complaintId,version:3,kind:'ohne_mail',note:'TEST telefonisch informiert',sentThreadId:null});
  expect(closed.state).toBe('abgeschlossen');
  const reopened=await complaintWrite(fixture,{action:'wieder_oeffnen',clientKey:randomUUID(),complaintId:received.complaintId,version:4,reason:'TEST neue Prüfung'});
  expect(reopened.state).toBe('aufgenommen');
  const rejected=await complaintWrite(fixture,{action:'entscheiden',clientKey:randomUUID(),complaintId:received.complaintId,version:5,assessment:'abgelehnt',measure:'ablehnen',reason:'TEST Schaden außerhalb der Leistung',creditCents:null});
  expect(rejected.state).toBe('kunde_informieren');
  const withdrawn=await complaintWrite(fixture,{action:'abschliessen',clientKey:randomUUID(),complaintId:received.complaintId,version:6,kind:'zurueckgezogen',note:'TEST Kunde zieht zurück',sentThreadId:null});
  expect(withdrawn.state).toBe('abgeschlossen');
  expect(await withSession(fixture,()=>reklamationAusfuehrenAction({action:'abschliessen',clientKey:randomUUID(),complaintId:received.complaintId,version:7,kind:'mail',note:null,sentThreadId:randomUUID()}))).toMatchObject({code:'CONFLICT'});
});

it('4c accepts still-open return goods for canonical rework and atomically cancels expected rework on withdrawal',async()=>{
  const fixture=await createFixture(),order=await deliveredComplaintSource(fixture);
  const received=await complaintWrite(fixture,{action:'aufnehmen',clientKey:randomUUID(),orderId:order.orderId,intakeItemId:null,intakeVersion:null,parts:[{position_id:order.items[0].id,menge:1}],defect:'Blasen',description:'TEST Nacharbeit noch offen',photoIds:[],goodsReturn:'offen'});
  const {nacharbeitAnlegenAction}=await import('@/app/actions/complaints.actions');
  const rework=await withSession(fixture,()=>nacharbeitAnlegenAction({reklamationId:received.complaintId,version:1,bewertung:'berechtigt',massnahme:'nacharbeit',liefertermin:'2027-05-18'}));
  expect(rework.code,rework.code==='OK'?'OK':rework.message).toBe('OK');
  if(rework.code!=='OK')throw Error(rework.message);
  await complaintWrite(fixture,{action:'abschliessen',clientKey:randomUUID(),complaintId:received.complaintId,version:2,kind:'zurueckgezogen',note:'TEST keine Teile zurückgesendet',sentThreadId:null});
  const [stopped]=await sql`SELECT ware,ohne_ware_grund FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${rework.receipt.orderId}`;
  expect(stopped).toEqual({ware:'storniert',ohne_ware_grund:'TEST keine Teile zurückgesendet'});
});

it('4c records the originating intake concern in the same transaction and rejects excessive quantities without a complaint',async()=>{
  const fixture=await createFixture(),order=await deliveredComplaintSource(fixture);
  const {saveIntakeNoteAction,selectIntakeConcernAction}=await import('@/app/actions/eingang.actions');
  const {reklamationAusfuehrenAction}=await import('@/app/actions/complaints.actions');
  let source=await withSession(fixture,()=>saveIntakeNoteAction({itemId:randomUUID(),textstand:randomUUID(),text:'TEST Bitte beachten: Blasen',context:{orderId:order.orderId,customerId:fixture.customerId},concerns:['hinweis']}));
  expect(source.code,source.code==='OK'?'OK':source.message).toBe('OK');
  if(source.code!=='OK')throw Error(source.message);
  const capture=source.capture;
  source=await withSession(fixture,()=>selectIntakeConcernAction({itemId:capture.id,version:capture.version,clientEventId:randomUUID(),concern:'reklamation'}));
  if(source.code!=='OK')throw Error(source.message);
  const input:import('@/modules/complaints/public').ComplaintCommand={action:'aufnehmen',clientKey:randomUUID(),orderId:order.orderId,intakeItemId:source.capture.id,intakeVersion:source.capture.version,parts:[{position_id:order.items[0].id,menge:2}],defect:'Blasen',description:'TEST Quellnachricht',photoIds:[],goodsReturn:'offen'};
  expect(await withSession(fixture,()=>reklamationAusfuehrenAction(input))).toMatchObject({code:'VALIDATION_ERROR'});
  const [count]=await sql`SELECT count(*)::integer AS n FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${input.clientKey}::uuid`;
  expect(count.n).toBe(0);
  const saved=await complaintWrite(fixture,{...input,parts:[{position_id:order.items[0].id,menge:1}]});
  const [row]=await sql`SELECT complaint.intake_item_id::text,source.einsatz,source.anliegen_offen,event.nachher FROM public.complaints complaint
    JOIN public.intake_item source ON source.id=complaint.intake_item_id AND source.tenant_id=complaint.tenant_id
    JOIN public.intake_event event ON event.tenant_id=source.tenant_id AND event.item_id=source.id AND event.befehl_id=${input.clientKey}::uuid AND event.art='anliegen'
    WHERE complaint.tenant_id=${KREILE_TENANT_SLUG} AND complaint.id=${saved.complaintId}`;
  expect(row).toMatchObject({intake_item_id:source.capture.id,einsatz:'offen',anliegen_offen:['hinweis'],nachher:{complaintId:saved.complaintId}});
});

it('4c closes only from the exact persisted result-mail receipt, with Kunden but without general mail access',async()=>{
  const fixture=await createFixture(),order=await deliveredComplaintSource(fixture),customerActor=await createFixture(['kunden']);
  const received=await complaintWrite(fixture,{action:'aufnehmen',clientKey:randomUUID(),orderId:order.orderId,intakeItemId:null,intakeVersion:null,parts:[{position_id:order.items[0].id,menge:1}],defect:'Blasen',description:'TEST Ergebnis-Mail',photoIds:[],goodsReturn:'nein'});
  await complaintWrite(fixture,{action:'entscheiden',clientKey:randomUUID(),complaintId:received.complaintId,version:1,assessment:'abgelehnt',measure:'ablehnen',reason:'TEST nicht durch Behandlung verursacht',creditCents:null});
  const {sendeReklamationErgebnisAction,getByOrder,getComplaintDialogAction,reklamationAusfuehrenAction}=await import('@/app/actions/complaints.actions');
  const dialog=await withSession(customerActor,()=>getComplaintDialogAction({complaintId:received.complaintId}));
  expect(dialog).toMatchObject({code:'OK',data:{complaint:{id:received.complaintId,stand:'kunde_informieren'},source:{id:order.orderId}}});
  expect(await withSession(customerActor,()=>reklamationAusfuehrenAction({action:'wieder_oeffnen',clientKey:randomUUID(),complaintId:received.complaintId,version:2,reason:'TEST unerlaubter Versuch'}))).toMatchObject({code:'FORBIDDEN'});
  const key=randomUUID(),threadId=randomUUID(),subject='TEST Reklamation Ergebnis',body='TEST Ergebnis Ihrer Reklamation';
  // Isolated provider-boundary fixture: a durable sent receipt, never a claim
  // that this test contacted Microsoft 365 or delivered an external message.
  await sql`INSERT INTO public.communication_threads(id,tenant_id,customer_id,order_id,source,subject,status,priority,category,created_by)
    VALUES(${threadId},${KREILE_TENANT_SLUG},${fixture.customerId},${order.orderId},${'MS_GRAPH_OUT:'+key},${subject},'sent','normal','email',${customerActor.actorId})`;
  await sql`INSERT INTO public.communication_messages(id,tenant_id,thread_id,direction,channel,body,summary,created_by)
    VALUES(${randomUUID()},${KREILE_TENANT_SLUG},${threadId},'outgoing','email',${body},${'Reklamation '+received.complaintId+' · Ergebnis'},${customerActor.actorId})`;
  const input={complaintId:received.complaintId,version:2,clientKey:key,subject,body};
  const sent=await withSession(customerActor,()=>sendeReklamationErgebnisAction(input));
  expect(sent.code,sent.code==='OK'?'OK':sent.message).toBe('OK');
  const [row]=await sql`SELECT complaint.stand,complaint.abschluss_art,event.user_id::text,event.payload FROM public.complaints complaint
    JOIN public.events event ON event.tenant_id=complaint.tenant_id AND event.client_event_id=${key}::uuid WHERE complaint.tenant_id=${KREILE_TENANT_SLUG} AND complaint.id=${received.complaintId}`;
  expect(row).toMatchObject({stand:'abgeschlossen',abschluss_art:'mail',user_id:customerActor.actorId,payload:{action:'abschliessen',after:{stand:'abgeschlossen'}}});
  const view=await withSession(customerActor,()=>getByOrder(order.orderId));
  expect(view).toMatchObject({code:'OK',complaints:[expect.objectContaining({id:received.complaintId,stand:'abgeschlossen',gutschriftBetrag:null})]});
  expect(await withSession(customerActor,()=>sendeReklamationErgebnisAction(input))).toMatchObject({code:'OK',replayed:true});
  expect(await withSession(customerActor,()=>sendeReklamationErgebnisAction({...input,body:'TEST geänderter Inhalt'}))).not.toMatchObject({code:'OK'});
});
