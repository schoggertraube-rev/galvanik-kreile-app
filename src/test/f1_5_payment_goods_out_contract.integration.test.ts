import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

    const constraints = await sql<{ conname: string }[]>`
      SELECT conname
      FROM pg_constraint
      WHERE conname IN (
        'invoices_f15_contract_version_chk',
        'invoices_f15_amounts_chk',
        'events_payment_confirmed_v1_contract_chk',
        'events_order_picked_up_v1_contract_chk'
      )
      ORDER BY conname
    `;
    expect(constraints.map((row) => row.conname)).toEqual([
      "events_order_picked_up_v1_contract_chk",
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
});
