// @vitest-environment node

import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.F1_5_EXPECTED_DATABASE_URL;

if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("F1_5_LOCAL_DATABASE_REQUIRED: DATABASE_URL must equal F1_5_EXPECTED_DATABASE_URL");
}

const parsedUrl = new URL(DATABASE_URL);
if (
  parsedUrl.protocol !== "postgresql:"
  || parsedUrl.hostname !== "127.0.0.1"
  || !/^\d{4,5}$/.test(parsedUrl.port)
  || parsedUrl.pathname !== "/postgres"
  || parsedUrl.username !== "postgres"
) {
  throw new Error("F1_5_LOCAL_DATABASE_REQUIRED: expected the dedicated local F1.5 Postgres database");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("F1_5_LOCAL_DATABASE_REQUIRED: SUPABASE_SERVICE_ROLE_KEY must be unset");
}

// AUTH_ADAPTER_SYNTHETIC_NOT_ACCEPTANCE: only the cookie/session adapter is
// synthetic. Authorization, tenant lookup, command, transaction, invoice,
// event and receipt readback use the real production code and fresh database.
const readAppSessionSpy = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/appSession", () => ({ readAppSession: readAppSessionSpy }));

const TENANT = "galvanik-kreile";
const FOREIGN_TENANT = "f15-b-foreign";
const USERS = {
  buero: "15151515-1515-4151-8151-151515151501",
  meister: "15151515-1515-4151-8151-151515151502",
  admin: "15151515-1515-4151-8151-151515151503",
  werkstatt: "15151515-1515-4151-8151-151515151504",
} as const;
const CUSTOMER = "f15-b-customer";
const FOREIGN_CUSTOMER = "f15-b-foreign-customer";
const ORDERS = {
  happy: "f15-b-happy-order",
  cancelled: "f15-b-cancelled-order",
  uninitialized: "f15-b-uninitialized-order",
  foreign: "f15-b-foreign-order",
} as const;
const INVOICES = {
  happy: "15151515-1515-4151-8151-151515151510",
  foreign: "15151515-1515-4151-8151-151515151511",
  cancelled: "15151515-1515-4151-8151-151515151512",
  uninitialized: "15151515-1515-4151-8151-151515151513",
} as const;
const CLIENT_EVENTS = {
  partial: "15151515-1515-4151-8151-151515151520",
  full: "15151515-1515-4151-8151-151515151521",
  stale: "15151515-1515-4151-8151-151515151522",
  overpay: "15151515-1515-4151-8151-151515151523",
  foreign: "15151515-1515-4151-8151-151515151524",
  cancelled: "15151515-1515-4151-8151-151515151525",
  uninitialized: "15151515-1515-4151-8151-151515151526",
  forbidden: "15151515-1515-4151-8151-151515151527",
  paidOverpay: "15151515-1515-4151-8151-151515151528",
} as const;

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });

type PaymentState = {
  invoice_id: string;
  tenant_id: string;
  status: string;
  gross_amount_cents: number;
  payment_contract_version: number | null;
  payment_mode: string | null;
  payment_status: string | null;
  payment_open_amount_cents: number | null;
  payment_paid_amount_cents: number | null;
  payment_currency: string | null;
  payment_method: string | null;
  payment_paid_at: string | null;
  payment_receipt_id: string | null;
  payment_event_id: string | null;
  payment_correlation_id: string | null;
  payment_version: number;
};

function setSession(userId: string, role: keyof typeof USERS, tenantId = TENANT) {
  readAppSessionSpy.mockResolvedValue({
    ok: true,
    session: {
      userId,
      tenantId,
      role,
      displayName: "F1.5 Synthetic " + role,
      issuedAt: 4_102_444_800_000,
      expiresAt: 4_102_488_000_000,
    },
  });
}

async function assertFreshReset() {
  const [state] = await sql<{
    users: number;
    customers: number;
    orders: number;
    invoices: number;
    events: number;
  }[]>`
    SELECT
      (SELECT count(*)::integer FROM public.app_users WHERE id IN (
        ${USERS.buero}::uuid, ${USERS.meister}::uuid, ${USERS.admin}::uuid, ${USERS.werkstatt}::uuid
      )) AS users,
      (SELECT count(*)::integer FROM public.customers WHERE id IN (${CUSTOMER}, ${FOREIGN_CUSTOMER})) AS customers,
      (SELECT count(*)::integer FROM public.orders WHERE id IN (
        ${ORDERS.happy}, ${ORDERS.cancelled}, ${ORDERS.uninitialized}, ${ORDERS.foreign}
      )) AS orders,
      (SELECT count(*)::integer FROM public.invoices WHERE id IN (
        ${INVOICES.happy}::uuid, ${INVOICES.foreign}::uuid,
        ${INVOICES.cancelled}::uuid, ${INVOICES.uninitialized}::uuid
      )) AS invoices,
      (SELECT count(*)::integer FROM public.events WHERE client_event_id IN (
        ${CLIENT_EVENTS.partial}::uuid, ${CLIENT_EVENTS.full}::uuid,
        ${CLIENT_EVENTS.stale}::uuid, ${CLIENT_EVENTS.overpay}::uuid,
        ${CLIENT_EVENTS.foreign}::uuid, ${CLIENT_EVENTS.cancelled}::uuid,
        ${CLIENT_EVENTS.uninitialized}::uuid, ${CLIENT_EVENTS.forbidden}::uuid,
        ${CLIENT_EVENTS.paidOverpay}::uuid
      )) AS events
  `;
  expect(state).toEqual({ users: 0, customers: 0, orders: 0, invoices: 0, events: 0 });
}

async function seedFixtures() {
  await sql.begin(async (transaction) => {
    for (const [role, userId] of Object.entries(USERS)) {
      await transaction`
        INSERT INTO public.app_users
          (id, tenant_id, email, full_name, role, active, created_at, updated_at)
        VALUES (
          ${userId}::uuid, ${TENANT}, ${"f15-b-" + role + "@local.invalid"},
          ${"F1.5 Synthetic " + role}, ${role}, true, now(), now()
        )
      `;
    }
    await transaction`
      INSERT INTO public.customers
        (id, tenant_id, customer_number, name, type, created_at, updated_at)
      VALUES
        (${CUSTOMER}, ${TENANT}, 'F15-B-001', 'F1.5 Synthetic Customer', 'business', now(), now()),
        (${FOREIGN_CUSTOMER}, ${FOREIGN_TENANT}, 'F15-B-FOREIGN', 'F1.5 Foreign Customer', 'business', now(), now())
    `;
    await transaction`
      INSERT INTO public.orders (
        id, tenant_id, order_number, customer_id, title, station,
        current_station, current_station_id, version, status, created_at
      ) VALUES
        (${ORDERS.happy}, ${TENANT}, 'A-F15-B-001', ${CUSTOMER}, 'F1.5 Payment Order',
         'fertig', 'fertig', 'fertig', 2, 'fertig', now()),
        (${ORDERS.cancelled}, ${TENANT}, 'A-F15-B-002', ${CUSTOMER}, 'F1.5 Cancelled Invoice Order',
         'fertig', 'fertig', 'fertig', 2, 'fertig', now()),
        (${ORDERS.uninitialized}, ${TENANT}, 'A-F15-B-003', ${CUSTOMER}, 'F1.5 Uninitialized Invoice Order',
         'fertig', 'fertig', 'fertig', 2, 'fertig', now()),
        (${ORDERS.foreign}, ${FOREIGN_TENANT}, 'A-F15-B-F', ${FOREIGN_CUSTOMER}, 'F1.5 Foreign Payment Order',
         'fertig', 'fertig', 'fertig', 2, 'fertig', now())
    `;
    await transaction`
      INSERT INTO public.invoices (
        id, tenant_id, customer_id, order_id, invoice_number, amount_total,
        status, due_date, gross_amount_cents, payment_contract_version,
        payment_mode, payment_status, payment_open_amount_cents,
        payment_paid_amount_cents, payment_currency, payment_version
      ) VALUES
        (${INVOICES.happy}::uuid, ${TENANT}, ${CUSTOMER}, ${ORDERS.happy},
         'R-2026-9601', 100.00, 'issued', '2026-09-19'::date, 10000, 1,
         'vorkasse', 'offen', 10000, 0, 'EUR', 0),
        (${INVOICES.foreign}::uuid, ${FOREIGN_TENANT}, ${FOREIGN_CUSTOMER}, ${ORDERS.foreign},
         'R-2026-9602', 80.00, 'issued', '2026-09-19'::date, 8000, 1,
         'vorkasse', 'offen', 8000, 0, 'EUR', 0),
        (${INVOICES.cancelled}::uuid, ${TENANT}, ${CUSTOMER}, ${ORDERS.cancelled},
         'R-2026-9603', 60.00, 'cancelled', '2026-09-19'::date, 6000, 1,
         'rechnung', 'offen', 6000, 0, 'EUR', 0),
        (${INVOICES.uninitialized}::uuid, ${TENANT}, ${CUSTOMER}, ${ORDERS.uninitialized},
         'R-2026-9604', 40.00, 'issued', '2026-09-19'::date, 4000, NULL,
         NULL, NULL, NULL, NULL, NULL, 0)
    `;
  });
}

async function readInvoiceState(invoiceId: string): Promise<PaymentState> {
  const [state] = await sql<PaymentState[]>`
    SELECT
      id::text AS invoice_id,
      tenant_id,
      status,
      gross_amount_cents,
      payment_contract_version,
      payment_mode,
      payment_status,
      payment_open_amount_cents,
      payment_paid_amount_cents,
      payment_currency,
      payment_method,
      CASE WHEN payment_paid_at IS NULL THEN NULL
        ELSE to_char(payment_paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      END AS payment_paid_at,
      payment_receipt_id,
      payment_event_id,
      payment_correlation_id::text,
      payment_version
    FROM public.invoices
    WHERE id = ${invoiceId}::uuid
  `;
  if (!state) throw new Error("F1_5_PAYMENT_STATE_MISSING");
  return state;
}

async function paymentEvents() {
  return sql<{
    event_id: string;
    tenant_id: string;
    order_id: string;
    client_event_id: string;
    correlation_id: string;
    aggregate_version: number;
    occurred_at: string;
    actor_id: string;
    payload: Record<string, unknown>;
  }[]>`
    SELECT
      id AS event_id,
      tenant_id,
      order_id,
      client_event_id::text,
      correlation_id::text,
      aggregate_version,
      to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS occurred_at,
      user_id::text AS actor_id,
      payload
    FROM public.events
    WHERE event_type = 'PAYMENT_CONFIRMED_V1'
      AND tenant_id IN (${TENANT}, ${FOREIGN_TENANT})
    ORDER BY aggregate_version, client_event_id
  `;
}

async function snapshot(invoiceId: string) {
  return {
    invoice: await readInvoiceState(invoiceId),
    events: await paymentEvents(),
  };
}

beforeAll(async () => {
  const [{ server_version_num: version }] = await sql<{ server_version_num: string }[]>`
    SELECT current_setting('server_version_num') AS server_version_num
  `;
  if (!version?.startsWith("17")) {
    throw new Error("F1_5_LOCAL_DATABASE_REQUIRED: PostgreSQL 17 required, got " + version);
  }
});

afterAll(async () => {
  await sql.end({ timeout: 1 });
});

describe("F1.5 confirmPayment real command integration — AUTH_ADAPTER_SYNTHETIC_NOT_ACCEPTANCE", () => {
  it("proves authorization, tenant isolation, partial-to-full payment, replay, conflicts and null mutation", async () => {
    await assertFreshReset();
    await seedFixtures();
    const { confirmPayment } = await import("@/lib/server/commands/confirmPaymentCommand");

    const happyPristine = await snapshot(INVOICES.happy);
    const foreignPristine = await snapshot(INVOICES.foreign);
    expect(happyPristine.invoice).toMatchObject({
      invoice_id: INVOICES.happy,
      tenant_id: TENANT,
      payment_status: "offen",
      payment_open_amount_cents: 10_000,
      payment_paid_amount_cents: 0,
      payment_version: 0,
    });
    expect(happyPristine.events).toEqual([]);

    readAppSessionSpy.mockResolvedValueOnce({ ok: false, reason: "NO_COOKIE" });
    await expect(confirmPayment({
      invoiceId: INVOICES.happy,
      amount: 1_000,
      method: "bar",
      expectedVersion: 0,
      clientEventId: CLIENT_EVENTS.forbidden,
    })).resolves.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(await snapshot(INVOICES.happy)).toEqual(happyPristine);

    setSession(USERS.werkstatt, "werkstatt");
    await expect(confirmPayment({
      invoiceId: INVOICES.happy,
      amount: 1_000,
      method: "bar",
      expectedVersion: 0,
      clientEventId: CLIENT_EVENTS.forbidden,
    })).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(await snapshot(INVOICES.happy)).toEqual(happyPristine);

    setSession(USERS.buero, "buero");
    await expect(confirmPayment({
      invoiceId: INVOICES.foreign,
      amount: 1_000,
      method: "ueberweisung",
      expectedVersion: 0,
      clientEventId: CLIENT_EVENTS.foreign,
    })).resolves.toEqual({ code: "NOT_FOUND", message: "Rechnung nicht verfügbar." });
    expect(await snapshot(INVOICES.foreign)).toEqual(foreignPristine);
    expect(await snapshot(INVOICES.happy)).toEqual(happyPristine);

    const cancelledPristine = await snapshot(INVOICES.cancelled);
    setSession(USERS.meister, "meister");
    await expect(confirmPayment({
      invoiceId: INVOICES.cancelled,
      amount: 1_000,
      method: "bar",
      expectedVersion: 0,
      clientEventId: CLIENT_EVENTS.cancelled,
    })).resolves.toMatchObject({ code: "CONFLICT" });
    expect(await snapshot(INVOICES.cancelled)).toEqual(cancelledPristine);

    const uninitializedPristine = await snapshot(INVOICES.uninitialized);
    setSession(USERS.admin, "admin");
    await expect(confirmPayment({
      invoiceId: INVOICES.uninitialized,
      amount: 1_000,
      method: "karte",
      expectedVersion: 0,
      clientEventId: CLIENT_EVENTS.uninitialized,
    })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await snapshot(INVOICES.uninitialized)).toEqual(uninitializedPristine);

    const partialInput = {
      invoiceId: INVOICES.happy,
      amount: 4_000,
      method: "ueberweisung" as const,
      expectedVersion: 0,
      clientEventId: CLIENT_EVENTS.partial,
    };
    setSession(USERS.buero, "buero");
    const partial = await confirmPayment(partialInput);
    expect(partial.code).toBe("OK");
    if (partial.code !== "OK") throw new Error("F1_5_PARTIAL_PAYMENT_FAILED:" + partial.code);
    expect(partial.replayed).toBe(false);
    expect(partial.receipt).toMatchObject({
      invoiceId: INVOICES.happy,
      invoiceNumber: "R-2026-9601",
      orderId: ORDERS.happy,
      clientEventId: CLIENT_EVENTS.partial,
      expectedVersion: 0,
      paymentVersion: 1,
      amountCents: 4_000,
      grossAmountCents: 10_000,
      paidAmountCents: 4_000,
      openAmountCents: 6_000,
      currency: "EUR",
      paymentMode: "vorkasse",
      paymentStatus: "teilbezahlt",
      method: "ueberweisung",
      confirmedBy: USERS.buero,
      source: "manual",
    });
    expect(partial.receipt.confirmedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const partialState = await snapshot(INVOICES.happy);
    expect(partialState.invoice).toMatchObject({
      payment_status: "teilbezahlt",
      payment_open_amount_cents: 6_000,
      payment_paid_amount_cents: 4_000,
      payment_currency: "EUR",
      payment_method: "ueberweisung",
      payment_paid_at: partial.receipt.confirmedAt,
      payment_receipt_id: partial.receipt.receiptId,
      payment_event_id: partial.receipt.eventId,
      payment_correlation_id: partial.receipt.correlationId,
      payment_version: 1,
    });
    expect(partialState.events).toHaveLength(1);
    expect(partialState.events[0]).toEqual({
      event_id: partial.receipt.eventId,
      tenant_id: TENANT,
      order_id: ORDERS.happy,
      client_event_id: CLIENT_EVENTS.partial,
      correlation_id: partial.receipt.correlationId,
      aggregate_version: 1,
      occurred_at: partial.receipt.confirmedAt,
      actor_id: USERS.buero,
      payload: {
        invoiceId: INVOICES.happy,
        orderId: ORDERS.happy,
        receiptId: partial.receipt.receiptId,
        amountCents: 4_000,
        grossAmountCents: 10_000,
        paidAmountCents: 4_000,
        openAmountCents: 6_000,
        currency: "EUR",
        paymentMode: "vorkasse",
        paymentStatus: "teilbezahlt",
        method: "ueberweisung",
        occurredAt: partial.receipt.confirmedAt,
        paymentVersion: 1,
        source: "manual",
      },
    });

    setSession(USERS.buero, "buero");
    await expect(confirmPayment(partialInput)).resolves.toEqual({
      code: "OK",
      receipt: partial.receipt,
      replayed: true,
    });
    expect(await snapshot(INVOICES.happy)).toEqual(partialState);

    for (const changedIntent of [
      { amount: 4_001 },
      { method: "bar" as const },
      { expectedVersion: 1 },
    ]) {
      setSession(USERS.buero, "buero");
      await expect(confirmPayment({ ...partialInput, ...changedIntent })).resolves.toEqual({
        code: "CONFLICT",
        message: "Anfragekennung wurde bereits anders verwendet.",
      });
      expect(await snapshot(INVOICES.happy)).toEqual(partialState);
    }

    setSession(USERS.meister, "meister");
    await expect(confirmPayment({
      invoiceId: INVOICES.happy,
      amount: 6_000,
      method: "bar",
      expectedVersion: 0,
      clientEventId: CLIENT_EVENTS.stale,
    })).resolves.toMatchObject({ code: "CONFLICT" });
    expect(await snapshot(INVOICES.happy)).toEqual(partialState);

    setSession(USERS.admin, "admin");
    await expect(confirmPayment({
      invoiceId: INVOICES.happy,
      amount: 6_001,
      method: "karte",
      expectedVersion: 1,
      clientEventId: CLIENT_EVENTS.overpay,
    })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await snapshot(INVOICES.happy)).toEqual(partialState);

    const fullInput = {
      invoiceId: INVOICES.happy,
      amount: 6_000,
      method: "bar" as const,
      expectedVersion: 1,
      clientEventId: CLIENT_EVENTS.full,
    };
    setSession(USERS.admin, "admin");
    const full = await confirmPayment(fullInput);
    expect(full.code).toBe("OK");
    if (full.code !== "OK") throw new Error("F1_5_FULL_PAYMENT_FAILED:" + full.code);
    expect(full.replayed).toBe(false);
    expect(full.receipt).toMatchObject({
      expectedVersion: 1,
      paymentVersion: 2,
      amountCents: 6_000,
      paidAmountCents: 10_000,
      openAmountCents: 0,
      paymentStatus: "bezahlt",
      method: "bar",
      confirmedBy: USERS.admin,
    });

    const paidState = await snapshot(INVOICES.happy);
    expect(paidState.invoice).toMatchObject({
      payment_status: "bezahlt",
      payment_open_amount_cents: 0,
      payment_paid_amount_cents: 10_000,
      payment_method: "bar",
      payment_paid_at: full.receipt.confirmedAt,
      payment_receipt_id: full.receipt.receiptId,
      payment_event_id: full.receipt.eventId,
      payment_correlation_id: full.receipt.correlationId,
      payment_version: 2,
    });
    expect(paidState.events).toHaveLength(2);
    expect(paidState.events.map((event) => event.aggregate_version)).toEqual([1, 2]);

    setSession(USERS.admin, "admin");
    await expect(confirmPayment(fullInput)).resolves.toEqual({
      code: "OK",
      receipt: full.receipt,
      replayed: true,
    });
    expect(await snapshot(INVOICES.happy)).toEqual(paidState);

    setSession(USERS.admin, "admin");
    await expect(confirmPayment({
      invoiceId: INVOICES.happy,
      amount: 1,
      method: "bar",
      expectedVersion: 2,
      clientEventId: CLIENT_EVENTS.paidOverpay,
    })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await snapshot(INVOICES.happy)).toEqual(paidState);
    expect((await paymentEvents()).filter((event) => event.tenant_id === FOREIGN_TENANT)).toEqual([]);
  });
});
