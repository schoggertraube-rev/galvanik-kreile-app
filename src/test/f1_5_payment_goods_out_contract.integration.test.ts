// @vitest-environment node

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { AppSession } from "@/lib/server/appSession";
import type { PaymentMode } from "@/lib/server/paymentContract";

(globalThis as typeof globalThis & { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.F1_5_EXPECTED_DATABASE_URL;

if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("F1_5_LOCAL_DATABASE_REQUIRED: DATABASE_URL must equal F1_5_EXPECTED_DATABASE_URL");
}

const parsedDatabaseUrl = new URL(DATABASE_URL);
if (
  parsedDatabaseUrl.protocol !== "postgresql:"
  || parsedDatabaseUrl.hostname !== "127.0.0.1"
  || parsedDatabaseUrl.pathname !== "/postgres"
  || parsedDatabaseUrl.username !== "postgres"
) {
  throw new Error("F1_5_LOCAL_DATABASE_REQUIRED: expected the dedicated local Postgres database");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("F1_5_LOCAL_DATABASE_REQUIRED: SUPABASE_SERVICE_ROLE_KEY must be unset");
}

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const suffix = `${Date.now()}-${process.pid}`;
const PAID_AT = "2026-09-05T10:00:00.000Z";
const TEST_SESSION_SECRET = "f1-5-contract-real-session-local-only";
const ORIGINAL_SESSION_SECRET = process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET = TEST_SESSION_SECRET;
let commandSessionIssuedAt = 0;

type Tx = postgres.ISql;

type PaymentFixture = {
  tenantId: string;
  userId: string;
  customerId: string;
  orderId: string;
  orderNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  paymentEventId: string;
  paymentClientEventId: string;
  paymentCorrelationId: string;
  receiptId: string;
  goodsOutEventId: string;
  goodsOutClientEventId: string;
  goodsOutCorrelationId: string;
};

type PaymentViewRow = {
  invoice_id: string;
  tenant_id: string;
  order_id: string;
  order_number: string;
  invoice_number: string;
  total_amount_cents: number;
  payment_mode: string;
  payment_status: string;
  payment_open_amount_cents: number;
  payment_paid_amount_cents: number;
  payment_currency: string;
  payment_method: string;
  payment_paid_at: string;
  payment_receipt_id: string;
  payment_event_id: string;
  payment_correlation_id: string;
  payment_mode_version: number;
  payment_version: number;
  goods_out_allowed: boolean;
  integrity_ok: boolean;
};

function createFixture(label: "own" | "foreign", invoiceNumber: string): PaymentFixture {
  return {
    tenantId: `f15-${label}-${suffix}`,
    userId: randomUUID(),
    customerId: `f15-${label}-customer-${suffix}`,
    orderId: `f15-${label}-order-${suffix}`,
    orderNumber: `A-F15-${label}-${suffix}`,
    invoiceId: randomUUID(),
    invoiceNumber,
    paymentEventId: randomUUID(),
    paymentClientEventId: randomUUID(),
    paymentCorrelationId: randomUUID(),
    receiptId: `f15-${label}-receipt-${suffix}`,
    goodsOutEventId: randomUUID(),
    goodsOutClientEventId: randomUUID(),
    goodsOutCorrelationId: randomUUID(),
  };
}

const OWN = createFixture("own", "R-2026-9501");
const FOREIGN = createFixture("foreign", "R-2026-9502");
const EMPTY_TENANT = `f15-empty-${suffix}`;
const EMPTY_USER_ID = randomUUID();
const COMMAND_TENANT = KREILE_TENANT_SLUG;
const COMMAND_USERS = {
  werkstatt: randomUUID(),
  admin: randomUUID(),
  readonly: randomUUID(),
} as const;
const COMMAND_CUSTOMER = `f15-command-customer-${suffix}`;
const COMMAND_RATE = randomUUID();

async function withRealSession<T>(
  role: keyof typeof COMMAND_USERS,
  work: () => Promise<T>,
): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const {
    COOKIE_NAME,
    getSecretKey,
    readAppSession,
    signAppSession,
  } = await import("@/lib/server/appSession");
  process.env.APP_SESSION_SECRET = TEST_SESSION_SECRET;
  if (commandSessionIssuedAt < 1) throw new Error("COMMAND_SESSION_NOT_SEEDED");
  const now = Date.now();
  const session: AppSession = {
    userId: COMMAND_USERS[role],
    tenantId: COMMAND_TENANT,
    role,
    displayName: `F1.5 Contract ${role}`,
    issuedAt: commandSessionIssuedAt,
    expiresAt: now + 5 * 60_000,
  };
  const token = signAppSession(session, getSecretKey());
  const request = new NextRequest("http://127.0.0.1/test", {
    headers: { cookie: `${COOKIE_NAME}=${token}` },
  });
  const workStore = {
    isStaticGeneration: false,
    page: "/test",
    route: "/test",
    afterContext: {},
    previouslyRevalidatedTags: [],
    refreshTagsByCacheKind: new Map(),
    shouldTrackFetchMetrics: false,
    deploymentId: "test",
    buildId: "test",
    cacheComponentsEnabled: false,
    runInCleanSnapshot: (fn: (...args: never[]) => unknown, ...args: never[]) => fn(...args),
    reactServerErrorsByDigest: new Map(),
  } as unknown as import("next/dist/server/app-render/work-async-storage.external").WorkStore;
  const requestStore = createRequestStoreForAPI(
    request,
    { pathname: "/test", search: "" },
    { tags: [], expirationsByCacheKind: new Map() },
    undefined,
    undefined as never,
  );
  return workAsyncStorage.run(workStore, () => workUnitAsyncStorage.run(requestStore, async () => {
    const sessionReadback = await readAppSession();
    if (!sessionReadback.ok) {
      throw new Error(`REAL_SESSION_READBACK_FAILED:${sessionReadback.reason}`);
    }
    expect(sessionReadback.session).toMatchObject({
      userId: session.userId,
      tenantId: session.tenantId,
      role: session.role,
    });
    return work();
  }));
}

async function seedCommandPrerequisites() {
  const persistedUserUpdatedAt = new Date(Date.now() - 5_000).toISOString();
  const proposedSessionIssuedAt = Date.now();
  await sql.begin(async (transaction) => {
    for (const [role, userId] of Object.entries(COMMAND_USERS)) {
      await transaction`
        INSERT INTO public.app_users
          (id, tenant_id, email, full_name, role, active, created_at, updated_at)
        VALUES (
          ${userId}::uuid, ${COMMAND_TENANT}, ${`f15-contract-${role}-${suffix}@local.invalid`},
          ${`F1.5 Contract ${role}`}, ${role}, true,
          ${persistedUserUpdatedAt}::timestamptz, ${persistedUserUpdatedAt}::timestamptz
        ) ON CONFLICT (id) DO UPDATE SET
          active = true,
          role = EXCLUDED.role,
          updated_at = EXCLUDED.updated_at
      `;
    }
    await transaction`
      INSERT INTO public.company_settings (
        id, tenant_id, company_name, street, zip, city, country,
        iban, bic, bank_name, tax_id, invoice_vat_rate_basis_points,
        invoice_payment_term_days
      ) VALUES (
        'f14-command-settings', ${COMMAND_TENANT}, 'F1.5 Contract GmbH',
        'Testweg 1', '70173', 'Stuttgart', 'Deutschland',
        'DE02120300000000202051', 'BYLADEM1001', 'Testbank',
        'DE-SYNTHETIC-TAX', 1900, 14
      ) ON CONFLICT (id) DO UPDATE SET
        invoice_vat_rate_basis_points = EXCLUDED.invoice_vat_rate_basis_points,
        invoice_payment_term_days = EXCLUDED.invoice_payment_term_days
    `;
    await transaction`
      INSERT INTO public.customers (
        id, tenant_id, customer_number, name, company_name, type,
        street, zip_code, city, country, created_at, updated_at
      ) VALUES (
        ${COMMAND_CUSTOMER}, ${COMMAND_TENANT}, ${`F15-${suffix}`}, 'F1.5 Contract Customer',
        'F1.5 Contract Customer GmbH', 'business', 'Kundenweg 2',
        '70174', 'Stuttgart', 'Deutschland', now(), now()
      ) ON CONFLICT (id) DO NOTHING
    `;
    await transaction`
      INSERT INTO private.extra_work_hourly_rates
        (id, tenant_id, hourly_rate_cents, version, created_by, effective_at)
      VALUES (${COMMAND_RATE}::uuid, ${COMMAND_TENANT}, 12000, 2900, ${COMMAND_USERS.admin}::uuid, now())
      ON CONFLICT (tenant_id, version) DO NOTHING
    `;
  });
  const [persistedUserClock] = await sql<{ latest_updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM max(updated_at)) * 1000)::bigint::text AS latest_updated_at_ms
    FROM public.app_users
    WHERE tenant_id = ${COMMAND_TENANT}
      AND id IN (
        ${COMMAND_USERS.werkstatt}::uuid,
        ${COMMAND_USERS.admin}::uuid,
        ${COMMAND_USERS.readonly}::uuid
      )
  `;
  const latestUpdatedAtMs = Number(persistedUserClock?.latest_updated_at_ms);
  if (!Number.isSafeInteger(latestUpdatedAtMs) || latestUpdatedAtMs >= proposedSessionIssuedAt) {
    throw new Error("COMMAND_SESSION_REVOCATION_ORDER_INVALID");
  }
  commandSessionIssuedAt = proposedSessionIssuedAt;
}

type CommandReadyOrder = {
  orderId: string;
  version: number;
  invoiceId: string | null;
  grossAmountCents: number | null;
};

async function createCommandReadyOrder(
  label: string,
  paymentMode: PaymentMode,
  issueInvoice: boolean,
): Promise<CommandReadyOrder> {
  const { createOrderIntake } = await import("@/lib/server/commands/orderIntakeCommand");
  const intake = await withRealSession("admin", () => createOrderIntake({
    clientEventId: randomUUID(),
    customer: { mode: "EXISTING", customerId: COMMAND_CUSTOMER },
    dueDate: "2026-09-30",
    note: `F1.5 contract ${label}`,
    items: [{ name: label, quantity: 1, material: "Stahl", surfaceRequested: "Galvanik" }],
  }));
  expect(intake.code).toBe("OK");
  if (intake.code !== "OK") throw new Error(`INTAKE_FAILED:${intake.code}`);
  const itemId = intake.receipt.items[0]?.id;
  if (!itemId) throw new Error("ITEM_MISSING");

  if (paymentMode !== "vorkasse") {
    const { setPaymentMode } = await import("@/lib/server/commands/setPaymentModeCommand");
    const mode = await withRealSession("admin", () => setPaymentMode({
      orderId: intake.receipt.orderId,
      paymentMode,
      expectedVersion: 0,
      clientEventId: randomUUID(),
    }));
    expect(mode.code).toBe("OK");
  }

  const { transitionWareneingangToGalvanik } = await import("@/lib/server/commands/orderStationCommand");
  const station = await withRealSession("admin", () => transitionWareneingangToGalvanik({
    orderId: intake.receipt.orderId,
    expectedVersion: intake.receipt.orderVersion,
    clientEventId: randomUUID(),
  }));
  expect(station.code).toBe("OK");
  if (station.code !== "OK") throw new Error(`STATION_FAILED:${station.code}`);

  await sql`
    UPDATE public.items SET preis_netto = 100.00
    WHERE id = ${itemId} AND order_id = ${intake.receipt.orderId} AND tenant_id = ${COMMAND_TENANT}
  `;
  const { freezeOrder } = await import("@/lib/server/commands/orderFreezeCommand");
  const frozen = await withRealSession("admin", () => freezeOrder({
    orderId: intake.receipt.orderId,
    freezeId: randomUUID(),
    expectedVersion: station.receipt.aggregateVersion,
    clientEventId: randomUUID(),
  }));
  expect(frozen.code).toBe("OK");
  if (frozen.code !== "OK") throw new Error(`FREEZE_FAILED:${frozen.code}`);

  if (!issueInvoice) {
    return { orderId: intake.receipt.orderId, version: frozen.receipt.aggregateVersion, invoiceId: null, grossAmountCents: null };
  }
  const { createInvoice } = await import("@/lib/server/commands/immutableInvoiceCommand");
  const issued = await withRealSession("admin", () => createInvoice({
    orderId: intake.receipt.orderId,
    expectedVersion: frozen.receipt.aggregateVersion,
    clientEventId: randomUUID(),
  }));
  expect(issued.code).toBe("OK");
  if (issued.code !== "OK") throw new Error(`INVOICE_FAILED:${issued.code}`);
  return {
    orderId: intake.receipt.orderId,
    version: frozen.receipt.aggregateVersion,
    invoiceId: issued.receipt.invoiceId,
    grossAmountCents: issued.receipt.grossAmountCents,
  };
}

async function readCommandSnapshot(orderId: string) {
  const [row] = await sql<{
    station: string;
    version: number;
    v1_events: number;
    v2_events: number;
    invoices: number;
  }[]>`
    SELECT orders.station, orders.version,
      (SELECT count(*)::integer FROM public.events event
       WHERE event.tenant_id = orders.tenant_id AND event.order_id = orders.id
         AND event.event_type = 'ORDER_PICKED_UP_V1') AS v1_events,
      (SELECT count(*)::integer FROM public.events event
       WHERE event.tenant_id = orders.tenant_id AND event.order_id = orders.id
         AND event.event_type = 'ORDER_PICKED_UP_V2') AS v2_events,
      (SELECT count(*)::integer FROM public.invoices invoice
       WHERE invoice.tenant_id = orders.tenant_id AND invoice.order_id = orders.id
         AND invoice.contract_version = 1 AND invoice.status = 'issued') AS invoices
    FROM public.orders orders
    WHERE orders.tenant_id = ${COMMAND_TENANT} AND orders.id = ${orderId}
  `;
  if (!row) throw new Error("COMMAND_ORDER_READBACK_MISSING");
  return row;
}

async function confirmCommandPayment(invoiceId: string, amount: number) {
  const { confirmPayment } = await import("@/lib/server/commands/confirmPaymentCommand");
  return withRealSession("admin", () => confirmPayment({
    invoiceId,
    amount,
    method: "ueberweisung",
    expectedVersion: 0,
    clientEventId: randomUUID(),
  }));
}

async function seedUser(transaction: Tx, tenantId: string, userId: string, label: string) {
  await transaction`
    INSERT INTO public.app_users
      (id, tenant_id, email, full_name, role, active, created_at, updated_at)
    VALUES (
      ${userId}::uuid, ${tenantId}, ${`f15-${label}-${suffix}@local.invalid`},
      ${`F1.5 Synthetic ${label}`}, 'admin', true, now(), now()
    )
  `;
}

async function seedPaidFixture(transaction: Tx, fixture: PaymentFixture) {
  await seedUser(transaction, fixture.tenantId, fixture.userId, fixture.invoiceNumber);
  await transaction`
    INSERT INTO public.customers (id, tenant_id, customer_number, name, type, created_at, updated_at)
    VALUES (
      ${fixture.customerId}, ${fixture.tenantId}, ${`F15-${fixture.invoiceNumber}`},
      'F1.5 Synthetic Customer', 'business', now(), now()
    )
  `;
  await transaction`
    INSERT INTO public.orders (
      id, tenant_id, order_number, customer_id, title, station,
      current_station, current_station_id, version, status, created_at
    ) VALUES (
      ${fixture.orderId}, ${fixture.tenantId}, ${fixture.orderNumber}, ${fixture.customerId},
      'F1.5 Synthetic Paid Order', 'abgeholt', 'abgeholt', 'abgeholt', 3, 'abgeholt', now()
    )
  `;
  await transaction`
    INSERT INTO public.events (
      id, tenant_id, order_id, item_id, event_type, description, user_id,
      payload, status, station, created_at, client_event_id,
      event_schema_version, correlation_id, aggregate_version, from_station
    ) VALUES (
      ${fixture.paymentEventId}, ${fixture.tenantId}, ${fixture.orderId}, NULL,
      'PAYMENT_CONFIRMED_V1', 'F1.5 synthetic payment confirmation', ${fixture.userId}::uuid,
      ${transaction.json({
        invoiceId: fixture.invoiceId,
        orderId: fixture.orderId,
        receiptId: fixture.receiptId,
        amountCents: 11900,
        grossAmountCents: 11900,
        paidAmountCents: 11900,
        openAmountCents: 0,
        currency: "EUR",
        paymentMode: "vorkasse",
        paymentStatus: "bezahlt",
        method: "ueberweisung",
        occurredAt: PAID_AT,
        paymentVersion: 1,
        source: "manual",
      })},
      'success', NULL, ${PAID_AT}::timestamptz AT TIME ZONE 'UTC',
      ${fixture.paymentClientEventId}::uuid, 1, ${fixture.paymentCorrelationId}::uuid, 1, NULL
    )
  `;
  await transaction`
    INSERT INTO public.events (
      id, tenant_id, order_id, item_id, event_type, description, user_id,
      payload, status, station, created_at, client_event_id,
      event_schema_version, correlation_id, aggregate_version, from_station
    ) VALUES (
      ${fixture.goodsOutEventId}, ${fixture.tenantId}, ${fixture.orderId}, NULL,
      'ORDER_PICKED_UP_V1', 'F1.5 synthetic goods out', ${fixture.userId}::uuid,
      ${transaction.json({
        orderId: fixture.orderId,
        mode: "versand",
        orderVersion: 3,
        paymentMode: "vorkasse",
        paymentStatus: "bezahlt",
        openAmountCents: 0,
        gateAllowed: true,
      })},
      'success', 'abgeholt', ${PAID_AT}::timestamptz AT TIME ZONE 'UTC',
      ${fixture.goodsOutClientEventId}::uuid, 1, ${fixture.goodsOutCorrelationId}::uuid, 3, 'fertig'
    )
  `;
  await transaction`
    INSERT INTO public.invoices (
      id, tenant_id, customer_id, order_id, invoice_number, amount_total,
      status, due_date, gross_amount_cents, payment_contract_version,
      payment_mode, payment_status, payment_open_amount_cents,
      payment_paid_amount_cents, payment_currency, payment_method,
      payment_paid_at, payment_receipt_id, payment_event_id,
      payment_correlation_id, payment_version
    ) VALUES (
      ${fixture.invoiceId}::uuid, ${fixture.tenantId}, ${fixture.customerId}, ${fixture.orderId},
      ${fixture.invoiceNumber}, 119.00, 'issued', '2026-09-19'::date, 11900, 1,
      'vorkasse', 'bezahlt', 0, 11900, 'EUR', 'ueberweisung',
      ${PAID_AT}::timestamptz, ${fixture.receiptId}, ${fixture.paymentEventId},
      ${fixture.paymentCorrelationId}::uuid, 1
    )
  `;
}

async function readForTenant(transaction: Tx, tenantId: string): Promise<PaymentViewRow[]> {
  await transaction`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
  return transaction<PaymentViewRow[]>`
    SELECT
      invoice_id::text,
      tenant_id,
      order_id,
      order_number,
      invoice_number,
      total_amount_cents,
      payment_mode,
      payment_status,
      payment_open_amount_cents,
      payment_paid_amount_cents,
      payment_currency,
      payment_method,
      to_char(payment_paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS payment_paid_at,
      payment_receipt_id,
      payment_event_id,
      payment_correlation_id::text,
      payment_mode_version,
      payment_version,
      goods_out_allowed,
      integrity_ok
    FROM private.v_payment_summary_v1
    ORDER BY invoice_id
    LIMIT 251
  `;
}

async function captureRejectedTransaction(
  work: (transaction: Tx) => Promise<void>,
): Promise<unknown> {
  try {
    await sql.begin(async (transaction) => work(transaction));
  } catch (error) {
    return error;
  }
  return undefined;
}

beforeAll(async () => {
  const [{ server_version_num: version }] = await sql<{ server_version_num: string }[]>`
    SELECT current_setting('server_version_num') AS server_version_num
  `;
  if (!version?.startsWith("17")) {
    throw new Error(`F1_5_LOCAL_DATABASE_REQUIRED: PostgreSQL 17 required, got ${version}`);
  }
});

afterAll(async () => {
  await sql.end({ timeout: 1 });
  if (ORIGINAL_SESSION_SECRET === undefined) delete process.env.APP_SESSION_SECRET;
  else process.env.APP_SESSION_SECRET = ORIGINAL_SESSION_SECRET;
});

describe("F1.5 payment and goods-out contract", () => {
  it("exposes additive invoice fields, event contracts, and the secure private view", async () => {
    const columns = await sql<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'invoices'
        AND column_name LIKE 'payment_%'
      ORDER BY column_name
    `;
    expect(columns.map((row) => row.column_name)).toEqual(expect.arrayContaining([
      "payment_contract_version",
      "payment_mode",
      "payment_status",
      "payment_open_amount_cents",
      "payment_paid_amount_cents",
      "payment_currency",
      "payment_method",
      "payment_paid_at",
      "payment_receipt_id",
      "payment_event_id",
      "payment_correlation_id",
      "payment_version",
    ]));

    const [view] = await sql<{ view_name: string | null }[]>`
      SELECT to_regclass('private.v_payment_summary_v1')::text AS view_name
    `;
    expect(view?.view_name).toBe("private.v_payment_summary_v1");
    const [v2Views] = await sql<{ goods_out: string | null; invoice_source: string | null; invoice_receipt: string | null }[]>`
      SELECT
        to_regclass('private.v_goods_out_receipt_v2')::text AS goods_out,
        to_regclass('private.v_invoice_issue_source_v2')::text AS invoice_source,
        to_regclass('private.v_invoice_created_receipt_v2')::text AS invoice_receipt
    `;
    expect(v2Views).toEqual({
      goods_out: "private.v_goods_out_receipt_v2",
      invoice_source: "private.v_invoice_issue_source_v2",
      invoice_receipt: "private.v_invoice_created_receipt_v2",
    });

    const constraints = await sql<{ conname: string }[]>`
      SELECT conname
      FROM pg_constraint
      WHERE conname IN (
        'invoices_f15_contract_version_chk',
        'invoices_f15_amounts_chk',
        'events_payment_confirmed_v1_contract_chk',
        'events_order_picked_up_v1_contract_chk',
        'events_order_picked_up_v2_contract_chk',
        'events_invoice_created_v2_contract_chk'
      )
      ORDER BY conname
    `;
    expect(constraints.map((row) => row.conname)).toEqual([
      "events_invoice_created_v2_contract_chk",
      "events_order_picked_up_v1_contract_chk",
      "events_order_picked_up_v2_contract_chk",
      "events_payment_confirmed_v1_contract_chk",
      "invoices_f15_amounts_chk",
      "invoices_f15_contract_version_chk",
    ]);

    const [security] = await sql<{ security_invoker: boolean; service_select: boolean; anon_select: boolean; authenticated_select: boolean }[]>`
      SELECT
        coalesce('security_invoker=true' = ANY(coalesce(cls.reloptions, ARRAY[]::text[])), false) AS security_invoker,
        has_table_privilege('service_role', 'private.v_payment_summary_v1', 'SELECT') AS service_select,
        has_table_privilege('anon', 'private.v_payment_summary_v1', 'SELECT') AS anon_select,
        has_table_privilege('authenticated', 'private.v_payment_summary_v1', 'SELECT') AS authenticated_select
      FROM pg_class cls
      JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
      WHERE nsp.nspname = 'private' AND cls.relname = 'v_payment_summary_v1'
    `;
    expect(security).toMatchObject({ security_invoker: true, service_select: true, anon_select: false, authenticated_select: false });
  });

  it("proves non-vacuous filled, empty and foreign tenant reads plus the abgeholt event contract", async () => {
    const rollbackSignal = new Error("F1_5_FIXTURE_ROLLBACK");

    await expect(sql.begin(async (transaction) => {
      await seedUser(transaction, EMPTY_TENANT, EMPTY_USER_ID, "empty");
      await seedPaidFixture(transaction, OWN);
      await seedPaidFixture(transaction, FOREIGN);

      const [fixtureCounts] = await transaction<{
        own_invoice_count: number;
        foreign_invoice_count: number;
        empty_user_count: number;
        empty_invoice_count: number;
        payment_event_count: number;
        goods_out_event_count: number;
      }[]>`
        SELECT
          count(*) FILTER (WHERE invoice.tenant_id = ${OWN.tenantId})::integer AS own_invoice_count,
          count(*) FILTER (WHERE invoice.tenant_id = ${FOREIGN.tenantId})::integer AS foreign_invoice_count,
          (
            SELECT count(*)::integer
            FROM public.app_users app_user
            WHERE app_user.id = ${EMPTY_USER_ID}::uuid
              AND app_user.tenant_id = ${EMPTY_TENANT}
          ) AS empty_user_count,
          count(*) FILTER (WHERE invoice.tenant_id = ${EMPTY_TENANT})::integer AS empty_invoice_count,
          (
            SELECT count(*)::integer
            FROM public.events event
            WHERE event.id IN (${OWN.paymentEventId}, ${FOREIGN.paymentEventId})
              AND event.event_type = 'PAYMENT_CONFIRMED_V1'
          ) AS payment_event_count,
          (
            SELECT count(*)::integer
            FROM public.events event
            WHERE event.id IN (${OWN.goodsOutEventId}, ${FOREIGN.goodsOutEventId})
              AND event.event_type = 'ORDER_PICKED_UP_V1'
              AND event.from_station = 'fertig'
              AND event.station = 'abgeholt'
          ) AS goods_out_event_count
        FROM public.invoices invoice
        WHERE invoice.id IN (${OWN.invoiceId}::uuid, ${FOREIGN.invoiceId}::uuid)
      `;
      expect(fixtureCounts).toEqual({
        own_invoice_count: 1,
        foreign_invoice_count: 1,
        empty_user_count: 1,
        empty_invoice_count: 0,
        payment_event_count: 2,
        goods_out_event_count: 2,
      });

      const ownRows = await readForTenant(transaction, OWN.tenantId);
      expect(ownRows).toEqual([{
        invoice_id: OWN.invoiceId,
        tenant_id: OWN.tenantId,
        order_id: OWN.orderId,
        order_number: OWN.orderNumber,
        invoice_number: OWN.invoiceNumber,
        total_amount_cents: 11900,
        payment_mode: "vorkasse",
        payment_status: "bezahlt",
        payment_open_amount_cents: 0,
        payment_paid_amount_cents: 11900,
        payment_currency: "EUR",
        payment_method: "ueberweisung",
        payment_paid_at: PAID_AT,
        payment_receipt_id: OWN.receiptId,
        payment_event_id: OWN.paymentEventId,
        payment_correlation_id: OWN.paymentCorrelationId,
        payment_mode_version: 0,
        payment_version: 1,
        goods_out_allowed: true,
        integrity_ok: true,
      }]);
      expect(ownRows.filter((row) => row.tenant_id === FOREIGN.tenantId)).toHaveLength(0);

      const emptyRows = await readForTenant(transaction, EMPTY_TENANT);
      expect(emptyRows).toEqual([]);

      const foreignRows = await readForTenant(transaction, FOREIGN.tenantId);
      expect(foreignRows).toHaveLength(1);
      expect(foreignRows[0]).toMatchObject({
        invoice_id: FOREIGN.invoiceId,
        tenant_id: FOREIGN.tenantId,
        payment_event_id: FOREIGN.paymentEventId,
        integrity_ok: true,
      });
      expect(foreignRows.filter((row) => row.tenant_id === OWN.tenantId)).toHaveLength(0);

      const obsoleteEventId = randomUUID();
      await transaction.unsafe("SAVEPOINT f15_obsolete_station");
      let obsoleteStationError: unknown;
      try {
        await transaction`
          INSERT INTO public.events (
            id, tenant_id, order_id, item_id, event_type, description, user_id,
            payload, status, station, created_at, client_event_id,
            event_schema_version, correlation_id, aggregate_version, from_station
          ) VALUES (
            ${obsoleteEventId}, ${OWN.tenantId}, ${OWN.orderId}, NULL,
            'ORDER_PICKED_UP_V1', 'F1.5 obsolete station rejection', ${OWN.userId}::uuid,
            ${transaction.json({
              orderId: OWN.orderId,
              mode: "versand",
              orderVersion: 4,
              paymentMode: "vorkasse",
              paymentStatus: "bezahlt",
              openAmountCents: 0,
              gateAllowed: true,
            })},
            'success', 'warenausgang', ${PAID_AT}::timestamptz AT TIME ZONE 'UTC',
            ${randomUUID()}::uuid, 1, ${randomUUID()}::uuid, 4, 'fertig'
          )
        `;
      } catch (error) {
        obsoleteStationError = error;
      }
      await transaction.unsafe("ROLLBACK TO SAVEPOINT f15_obsolete_station");
      expect(obsoleteStationError).toMatchObject({
        code: "23514",
        constraint_name: "events_order_picked_up_v1_contract_chk",
      });
      const [obsoleteCount] = await transaction<{ count: number }[]>`
        SELECT count(*)::integer AS count
        FROM public.events
        WHERE id = ${obsoleteEventId}
      `;
      expect(obsoleteCount?.count).toBe(0);

      throw rollbackSignal;
    })).rejects.toBe(rollbackSignal);
  });

  it("runs the blocking real command path through payment gates and invoice-less Rechnung V2", async () => {
    await seedCommandPrerequisites();
    const { recordGoodsOut } = await import("@/lib/server/commands/recordGoodsOutCommand");
    const { createInvoice } = await import("@/lib/server/commands/immutableInvoiceCommand");

    for (const paymentMode of ["vorkasse", "abholung"] as const) {
      const ready = await createCommandReadyOrder(`${paymentMode}-${suffix}`, paymentMode, true);
      if (!ready.invoiceId || ready.grossAmountCents === null) throw new Error("ISSUED_INVOICE_MISSING");
      const input = {
        orderId: ready.orderId,
        mode: paymentMode === "vorkasse" ? "versand" as const : "abholung" as const,
        expectedVersion: ready.version,
        clientEventId: randomUUID(),
      };
      const before = await readCommandSnapshot(ready.orderId);
      await expect(withRealSession("werkstatt", () => recordGoodsOut(input)))
        .resolves.toMatchObject({ code: "CONFLICT" });
      expect(await readCommandSnapshot(ready.orderId)).toEqual(before);

      const payment = await confirmCommandPayment(ready.invoiceId, ready.grossAmountCents);
      expect(payment).toMatchObject({ code: "OK", receipt: { paymentStatus: "bezahlt", openAmountCents: 0 } });
      const goodsOut = await withRealSession("werkstatt", () => recordGoodsOut(input));
      expect(goodsOut).toMatchObject({
        code: "OK",
        replayed: false,
        receipt: { eventSchemaVersion: 1, paymentMode, paymentStatus: "bezahlt", openAmountCents: 0 },
      });
    }

    const issuedRechnung = await createCommandReadyOrder(`rechnung-issued-${suffix}`, "rechnung", true);
    const issuedRechnungGoodsOut = await withRealSession("werkstatt", () => recordGoodsOut({
      orderId: issuedRechnung.orderId,
      mode: "versand",
      expectedVersion: issuedRechnung.version,
      clientEventId: randomUUID(),
    }));
    expect(issuedRechnungGoodsOut).toMatchObject({
      code: "OK",
      receipt: { eventSchemaVersion: 1, paymentMode: "rechnung" },
    });
    if (issuedRechnungGoodsOut.code !== "OK") {
      throw new Error(`ISSUED_RECHNUNG_GOODS_OUT_FAILED:${issuedRechnungGoodsOut.code}`);
    }
    const priorInvoiceV2Error = await captureRejectedTransaction(async (transaction) => {
      await transaction`
          INSERT INTO public.events (
            id, tenant_id, order_id, item_id, event_type, description, user_id,
            payload, status, station, client_event_id, event_schema_version,
            correlation_id, aggregate_version, from_station, created_at
          ) VALUES (
            ${randomUUID()}, ${COMMAND_TENANT}, ${issuedRechnung.orderId}, NULL,
            'ORDER_PICKED_UP_V2', 'F1.5 invalid V2 after issued invoice',
            ${COMMAND_USERS.werkstatt}::uuid,
            ${transaction.json({
              orderId: issuedRechnung.orderId,
              mode: "versand",
              orderVersion: issuedRechnungGoodsOut.receipt.orderVersion,
              paymentMode: "rechnung",
              invoiceState: "not_issued",
              gateAllowed: true,
            })},
            'success', 'abgeholt', ${randomUUID()}::uuid, 2, ${randomUUID()}::uuid,
            ${issuedRechnungGoodsOut.receipt.orderVersion}, 'fertig',
            clock_timestamp() AT TIME ZONE 'UTC'
          )
      `;
    });
    expect(priorInvoiceV2Error).toMatchObject({
      code: "23514",
      message: expect.stringContaining("F15_GOODS_OUT_V2_SOURCE_INVALID"),
    });

    const noGoodsOut = await createCommandReadyOrder(`rechnung-no-goods-out-${suffix}`, "rechnung", false);
    const missingGoodsOutInvoiceV2Error = await captureRejectedTransaction(async (transaction) => {
      await transaction`
          INSERT INTO public.events (
            id, tenant_id, order_id, item_id, event_type, description, user_id,
            payload, status, station, client_event_id, event_schema_version,
            correlation_id, aggregate_version, from_station, created_at
          ) VALUES (
            ${randomUUID()}, ${COMMAND_TENANT}, ${noGoodsOut.orderId}, NULL,
            'INVOICE_CREATED_V2', 'F1.5 invalid invoice V2 without goods out',
            ${COMMAND_USERS.admin}::uuid,
            ${transaction.json({
              invoiceId: randomUUID(),
              freezeId: randomUUID(),
              invoiceNumber: "R-2026-9999",
              orderVersion: noGoodsOut.version,
              netAmountCents: 10000,
              vatRateBasisPoints: 1900,
              vatAmountCents: 1900,
              grossAmountCents: 11900,
              pdfSha256: "a".repeat(64),
              invoiceVersion: 1,
              invoiceSourceState: "after_goods_out",
            })},
            'success', 'abgeholt', ${randomUUID()}::uuid, 2, ${randomUUID()}::uuid,
            1, 'abgeholt', clock_timestamp() AT TIME ZONE 'UTC'
          )
      `;
    });
    expect(missingGoodsOutInvoiceV2Error).toMatchObject({
      code: "23514",
      message: expect.stringContaining("F15_INVOICE_CREATED_V2_SOURCE_INVALID"),
    });

    const rechnung = await createCommandReadyOrder(`rechnung-${suffix}`, "rechnung", false);
    const rechnungInput = {
      orderId: rechnung.orderId,
      mode: "versand" as const,
      expectedVersion: rechnung.version,
      clientEventId: randomUUID(),
    };
    const goodsOut = await withRealSession("werkstatt", () => recordGoodsOut(rechnungInput));
    expect(goodsOut).toMatchObject({
      code: "OK",
      replayed: false,
      receipt: {
        eventSchemaVersion: 2,
        paymentMode: "rechnung",
        invoiceState: "not_issued",
      },
    });
    if (goodsOut.code !== "OK") throw new Error(`GOODS_OUT_V2_FAILED:${goodsOut.code}`);
    expect(goodsOut.receipt).not.toHaveProperty("paymentStatus");
    expect(goodsOut.receipt).not.toHaveProperty("openAmountCents");
    expect(await readCommandSnapshot(rechnung.orderId)).toMatchObject({
      station: "abgeholt",
      version: rechnung.version + 1,
      v1_events: 0,
      v2_events: 1,
      invoices: 0,
    });

    await expect(withRealSession("werkstatt", () => recordGoodsOut(rechnungInput)))
      .resolves.toMatchObject({ code: "OK", replayed: true, receipt: { eventSchemaVersion: 2 } });
    await expect(withRealSession("werkstatt", () => recordGoodsOut({ ...rechnungInput, mode: "abholung" })))
      .resolves.toMatchObject({ code: "CONFLICT" });
    await expect(withRealSession("werkstatt", () => recordGoodsOut({
      ...rechnungInput,
      clientEventId: randomUUID(),
    }))).resolves.toMatchObject({ code: "CONFLICT" });

    const issued = await withRealSession("admin", () => createInvoice({
      orderId: rechnung.orderId,
      expectedVersion: goodsOut.receipt.orderVersion,
      clientEventId: randomUUID(),
    }));
    expect(issued).toMatchObject({
      code: "OK",
      replayed: false,
      receipt: { eventSchemaVersion: 2, invoiceSourceState: "after_goods_out" },
    });
    if (issued.code !== "OK") throw new Error(`INVOICE_V2_FAILED:${issued.code}`);
    const paid = await confirmCommandPayment(issued.receipt.invoiceId, issued.receipt.grossAmountCents);
    expect(paid).toMatchObject({
      code: "OK",
      receipt: { paymentMode: "rechnung", paymentStatus: "bezahlt", openAmountCents: 0 },
    });

    const persisted = await sql.begin(async (transaction) => {
      await transaction`SELECT set_config('app.tenant_id', ${COMMAND_TENANT}, true)`;
      const [row] = await transaction<{
        invoice_events: number;
        payment_status: string;
        payment_open_amount_cents: number;
        integrity_ok: boolean;
        goods_out_v2_integrity_ok: boolean;
        invoice_v2_integrity_ok: boolean;
      }[]>`
        SELECT
          (SELECT count(*)::integer FROM public.events event
           WHERE event.tenant_id = invoice.tenant_id AND event.order_id = invoice.order_id
             AND event.event_type = 'INVOICE_CREATED_V2') AS invoice_events,
          summary.payment_status,
          summary.payment_open_amount_cents,
          summary.integrity_ok,
          (
            SELECT receipt.integrity_ok
            FROM private.v_goods_out_receipt_v2 receipt
            WHERE receipt.event_id = ${goodsOut.receipt.eventId}
          ) AS goods_out_v2_integrity_ok,
          (
            SELECT receipt.integrity_ok
            FROM private.v_invoice_created_receipt_v2 receipt
            WHERE receipt.event_id = ${issued.receipt.eventId}
          ) AS invoice_v2_integrity_ok
        FROM public.invoices invoice
        JOIN private.v_payment_summary_v1 summary ON summary.invoice_id = invoice.id
        WHERE invoice.id = ${issued.receipt.invoiceId}::uuid
          AND invoice.tenant_id = ${COMMAND_TENANT}
      `;
      return row;
    });
    expect(persisted).toEqual({
      invoice_events: 1,
      payment_status: "bezahlt",
      payment_open_amount_cents: 0,
      integrity_ok: true,
      goods_out_v2_integrity_ok: true,
      invoice_v2_integrity_ok: true,
    });

    await expect(withRealSession("readonly", () => recordGoodsOut({
      ...rechnungInput,
      orderId: FOREIGN.orderId,
      expectedVersion: 3,
      clientEventId: randomUUID(),
    }))).resolves.toMatchObject({ code: "FORBIDDEN" });
    await expect(withRealSession("werkstatt", () => recordGoodsOut({
      ...rechnungInput,
      orderId: FOREIGN.orderId,
      expectedVersion: 3,
      clientEventId: randomUUID(),
    }))).resolves.toMatchObject({ code: "NOT_FOUND" });
  }, 15_000);
});
