// @vitest-environment node

import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.G04_TIMELINESS_EXPECTED_DATABASE_URL;

if (!DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error(
    "G04_TIMELINESS_LOCAL_DATABASE_REQUIRED: DATABASE_URL must equal G04_TIMELINESS_EXPECTED_DATABASE_URL",
  );
}
const parsedDatabaseUrl = new URL(DATABASE_URL);
if (
  parsedDatabaseUrl.protocol !== "postgresql:"
  || parsedDatabaseUrl.hostname !== "127.0.0.1"
  || parsedDatabaseUrl.port !== "54322"
  || parsedDatabaseUrl.pathname !== "/postgres"
  || parsedDatabaseUrl.username !== "postgres"
) {
  throw new Error("G04_TIMELINESS_LOCAL_DATABASE_REQUIRED: expected dedicated loopback Supabase Postgres");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("G04_TIMELINESS_LOCAL_DATABASE_REQUIRED: SUPABASE_SERVICE_ROLE_KEY must be unset");
}

const sql = postgres(DATABASE_URL, { max: 1, prepare: false });
const suffix = `${Date.now()}-${process.pid}`;
const OWN_TENANT = `g04-timeliness-own-${suffix}`;
const FOREIGN_TENANT = `g04-timeliness-foreign-${suffix}`;
const OWN_USER = randomUUID();
const FOREIGN_USER = randomUUID();
const OWN_CUSTOMER = `g04-timeliness-own-customer-${suffix}`;
const FOREIGN_CUSTOMER = `g04-timeliness-foreign-customer-${suffix}`;
const OWN_ORDERS = {
  dueOnlyV1: `g04-timeliness-due-v1-${suffix}`,
  berlinEqualV2: `g04-timeliness-berlin-v2-${suffix}`,
  bothMissing: `g04-timeliness-both-missing-${suffix}`,
  promisedOnly: `g04-timeliness-promised-only-${suffix}`,
  conflict: `g04-timeliness-conflict-${suffix}`,
} as const;
const FOREIGN_ORDER = `g04-timeliness-foreign-order-${suffix}`;
const V1_EVENT = randomUUID();
const V2_EVENT = randomUUID();
const FOREIGN_EVENT = randomUUID();

type Tx = postgres.ISql;

type OrderSeed = {
  id: string;
  tenantId: string;
  customerId: string;
  station: "wareneingang" | "fertig" | "abgeholt";
  status: "angenommen" | "fertig" | "abgeholt";
  version: number;
  dueDate: string | null;
  promisedDueDate: string | null;
  completedAt: string | null;
};

async function seedActorAndCustomer(
  transaction: Tx,
  tenantId: string,
  userId: string,
  customerId: string,
) {
  await transaction`
    INSERT INTO public.app_users
      (id, tenant_id, email, full_name, role, active, created_at, updated_at)
    VALUES (
      ${userId}::uuid, ${tenantId}, ${`g04-timeliness-${userId}@local.invalid`},
      'G04 Timeliness Synthetic Actor', 'admin', true, now(), now()
    )
  `;
  await transaction`
    INSERT INTO public.customers
      (id, tenant_id, customer_number, name, type, source, created_at, updated_at)
    VALUES (
      ${customerId}, ${tenantId}, ${`G04-${userId.slice(0, 8)}`},
      'G04 Timeliness Synthetic Customer', 'business', 'integration-test', now(), now()
    )
  `;
}

async function seedOrder(transaction: Tx, seed: OrderSeed) {
  await transaction`
    INSERT INTO public.orders (
      id, tenant_id, order_number, customer_id, title, station,
      current_station, current_station_id, status, version, source,
      intake_date, due_date, promised_due_date, completed_date
    ) VALUES (
      ${seed.id}, ${seed.tenantId}, ${`A-G04-${randomUUID()}`}, ${seed.customerId},
      'G04 Timeliness Synthetic Order', ${seed.station}, ${seed.station}, ${seed.station},
      ${seed.status}, ${seed.version}, 'integration-test', now(),
      ${seed.dueDate}::timestamp, ${seed.promisedDueDate}::timestamptz,
      ${seed.completedAt}::timestamptz
    )
  `;
}

async function seedV1Pickup(
  transaction: Tx,
  eventId: string,
  tenantId: string,
  orderId: string,
  userId: string,
  aggregateVersion: number,
) {
  await transaction`
    INSERT INTO public.events (
      id, tenant_id, order_id, item_id, event_type, description, user_id,
      payload, status, station, created_at, client_event_id,
      event_schema_version, correlation_id, aggregate_version, from_station
    ) VALUES (
      ${eventId}, ${tenantId}, ${orderId}, NULL, 'ORDER_PICKED_UP_V1',
      'G04 synthetic V1 pickup', ${userId}::uuid,
      ${transaction.json({
        orderId,
        mode: "versand",
        orderVersion: aggregateVersion,
        paymentMode: "vorkasse",
        paymentStatus: "bezahlt",
        openAmountCents: 0,
        gateAllowed: true,
      })},
      'success', 'abgeholt',
      '2026-07-15T08:00:00.000Z'::timestamptz AT TIME ZONE 'UTC',
      ${randomUUID()}::uuid, 1, ${randomUUID()}::uuid, ${aggregateVersion}, 'fertig'
    )
  `;
}

async function seedV2Pickup(transaction: Tx) {
  await transaction`SELECT set_config('app.payment_mode_command', 'v1', true)`;
  await transaction`
    UPDATE public.orders
    SET payment_mode = 'rechnung', payment_mode_version = payment_mode_version + 1
    WHERE tenant_id = ${OWN_TENANT} AND id = ${OWN_ORDERS.berlinEqualV2}
  `;
  await transaction`SELECT set_config('app.payment_mode_command', '', true)`;
  await transaction`
    UPDATE public.orders
    SET station = 'abgeholt', current_station = 'abgeholt',
        current_station_id = 'abgeholt', status = 'abgeholt'
    WHERE tenant_id = ${OWN_TENANT} AND id = ${OWN_ORDERS.berlinEqualV2}
  `;
  await transaction`
    INSERT INTO public.events (
      id, tenant_id, order_id, item_id, event_type, description, user_id,
      payload, status, station, created_at, client_event_id,
      event_schema_version, correlation_id, aggregate_version, from_station
    ) VALUES (
      ${V2_EVENT}, ${OWN_TENANT}, ${OWN_ORDERS.berlinEqualV2}, NULL,
      'ORDER_PICKED_UP_V2', 'G04 synthetic V2 pickup', ${OWN_USER}::uuid,
      ${transaction.json({
        orderId: OWN_ORDERS.berlinEqualV2,
        mode: "abholung",
        orderVersion: 4,
        paymentMode: "rechnung",
        invoiceState: "not_issued",
        gateAllowed: true,
      })},
      'success', 'abgeholt',
      '2026-07-15T09:00:00.000Z'::timestamptz AT TIME ZONE 'UTC',
      ${randomUUID()}::uuid, 2, ${randomUUID()}::uuid, 4, 'fertig'
    )
  `;
}

beforeAll(async () => {
  const [{ server_version_num: version }] = await sql<{ server_version_num: string }[]>`
    SELECT current_setting('server_version_num') AS server_version_num
  `;
  if (!version?.startsWith("17")) {
    throw new Error(`G04_TIMELINESS_LOCAL_DATABASE_REQUIRED: PostgreSQL 17 required, got ${version}`);
  }
});

afterAll(async () => {
  await sql.end({ timeout: 1 });
});

describe("KR-03B1 final G04 DB read contract", () => {
  it("exposes only the exact hardened order and event projections", async () => {
    const columns = await sql<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (
          'v_order_timeliness_orders_v1',
          'v_order_timeliness_pickup_events_v1'
        )
      ORDER BY table_name, ordinal_position
    `;
    const orderColumns = columns
      .filter((column) => column.table_name === "v_order_timeliness_orders_v1")
      .map((column) => column.column_name);
    const eventColumns = columns
      .filter((column) => column.table_name === "v_order_timeliness_pickup_events_v1")
      .map((column) => column.column_name);

    expect(orderColumns).toEqual([
      "id",
      "tenant_id",
      "order_number",
      "status",
      "version",
      "due_date",
      "completed_date",
      "promised_date_legacy_class",
    ]);
    expect(eventColumns).toEqual([
      "event_id",
      "order_id",
      "tenant_id",
      "event_type",
      "status",
      "station",
      "from_station",
      "event_schema_version",
      "aggregate_version",
      "payload_order_id",
      "payload_mode",
      "payload_payment_mode",
      "payload_invoice_state",
      "payload_gate_allowed",
      "created_at",
    ]);
    for (const forbidden of ["payload", "payment_status", "open_amount_cents", "promised_due_date"]) {
      expect(eventColumns).not.toContain(forbidden);
      expect(orderColumns).not.toContain(forbidden);
    }

    const security = await sql<{
      relname: string;
      security_invoker: boolean;
      service_select: boolean;
      anon_select: boolean;
      authenticated_select: boolean;
      public_select: boolean;
    }[]>`
      SELECT
        cls.relname,
        coalesce('security_invoker=true' = ANY(coalesce(cls.reloptions, ARRAY[]::text[])), false)
          AS security_invoker,
        has_table_privilege('service_role', cls.oid, 'SELECT') AS service_select,
        has_table_privilege('anon', cls.oid, 'SELECT') AS anon_select,
        has_table_privilege('authenticated', cls.oid, 'SELECT') AS authenticated_select,
        EXISTS (
          SELECT 1
          FROM aclexplode(coalesce(cls.relacl, acldefault('r', cls.relowner))) acl
          WHERE acl.grantee = 0 AND acl.privilege_type = 'SELECT'
        ) AS public_select
      FROM pg_class cls
      JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
      WHERE nsp.nspname = 'public'
        AND cls.relname IN (
          'v_order_timeliness_orders_v1',
          'v_order_timeliness_pickup_events_v1'
        )
      ORDER BY cls.relname
    `;
    expect(security).toEqual([
      {
        relname: "v_order_timeliness_orders_v1",
        security_invoker: true,
        service_select: true,
        anon_select: false,
        authenticated_select: false,
        public_select: false,
      },
      {
        relname: "v_order_timeliness_pickup_events_v1",
        security_invoker: true,
        service_select: true,
        anon_select: false,
        authenticated_select: false,
        public_select: false,
      },
    ]);

    const definitions = await sql<{ relname: string; definition: string }[]>`
      SELECT cls.relname, pg_get_viewdef(cls.oid, true) AS definition
      FROM pg_class cls
      JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
      WHERE nsp.nspname = 'public'
        AND cls.relname IN (
          'v_order_timeliness_orders_v1',
          'v_order_timeliness_pickup_events_v1'
        )
    `;
    const orderDefinition = definitions
      .find((view) => view.relname === "v_order_timeliness_orders_v1")?.definition ?? "";
    const eventDefinition = definitions
      .find((view) => view.relname === "v_order_timeliness_pickup_events_v1")?.definition ?? "";
    expect(orderDefinition).toContain("Europe/Berlin");
    expect(eventDefinition.toLowerCase()).toContain("from events events");
    expect(eventDefinition.toLowerCase()).not.toMatch(/\bjoin\b|\bdistinct\b|\bgroup\s+by\b/);
  });

  it("proves fail-closed tenancy, Berlin legacy classes and one-row V1/V2 provenance", async () => {
    const rollbackSignal = new Error("G04_TIMELINESS_FIXTURE_ROLLBACK");
    await expect(sql.begin(async (transaction) => {
      await seedActorAndCustomer(transaction, OWN_TENANT, OWN_USER, OWN_CUSTOMER);
      await seedActorAndCustomer(transaction, FOREIGN_TENANT, FOREIGN_USER, FOREIGN_CUSTOMER);

      await seedOrder(transaction, {
        id: OWN_ORDERS.dueOnlyV1,
        tenantId: OWN_TENANT,
        customerId: OWN_CUSTOMER,
        station: "abgeholt",
        status: "abgeholt",
        version: 3,
        dueDate: "2026-07-15 12:00:00",
        promisedDueDate: null,
        completedAt: "2026-07-15T07:00:00.000Z",
      });
      await seedOrder(transaction, {
        id: OWN_ORDERS.berlinEqualV2,
        tenantId: OWN_TENANT,
        customerId: OWN_CUSTOMER,
        station: "fertig",
        status: "fertig",
        version: 4,
        dueDate: "2026-07-15 12:00:00",
        promisedDueDate: "2026-07-14T22:30:00.000Z",
        completedAt: "2026-07-15T08:00:00.000Z",
      });
      await seedOrder(transaction, {
        id: OWN_ORDERS.bothMissing,
        tenantId: OWN_TENANT,
        customerId: OWN_CUSTOMER,
        station: "wareneingang",
        status: "angenommen",
        version: 1,
        dueDate: null,
        promisedDueDate: null,
        completedAt: null,
      });
      await seedOrder(transaction, {
        id: OWN_ORDERS.promisedOnly,
        tenantId: OWN_TENANT,
        customerId: OWN_CUSTOMER,
        station: "wareneingang",
        status: "angenommen",
        version: 1,
        dueDate: null,
        promisedDueDate: "2026-07-16T10:00:00.000Z",
        completedAt: null,
      });
      await seedOrder(transaction, {
        id: OWN_ORDERS.conflict,
        tenantId: OWN_TENANT,
        customerId: OWN_CUSTOMER,
        station: "fertig",
        status: "fertig",
        version: 2,
        dueDate: "2026-07-15 12:00:00",
        promisedDueDate: "2026-07-16T10:00:00.000Z",
        completedAt: "2026-07-15T07:30:00.000Z",
      });
      await seedOrder(transaction, {
        id: FOREIGN_ORDER,
        tenantId: FOREIGN_TENANT,
        customerId: FOREIGN_CUSTOMER,
        station: "abgeholt",
        status: "abgeholt",
        version: 3,
        dueDate: "2026-07-15 12:00:00",
        promisedDueDate: null,
        completedAt: "2026-07-15T07:00:00.000Z",
      });

      await seedV1Pickup(transaction, V1_EVENT, OWN_TENANT, OWN_ORDERS.dueOnlyV1, OWN_USER, 3);
      await seedV2Pickup(transaction);
      await seedV1Pickup(transaction, FOREIGN_EVENT, FOREIGN_TENANT, FOREIGN_ORDER, FOREIGN_USER, 3);

      const [missingTenant] = await transaction<{ orders: number; events: number }[]>`
        SELECT
          (SELECT count(*)::integer FROM public.v_order_timeliness_orders_v1) AS orders,
          (SELECT count(*)::integer FROM public.v_order_timeliness_pickup_events_v1) AS events
      `;
      expect(missingTenant).toEqual({ orders: 0, events: 0 });

      await transaction`SELECT set_config('app.tenant_id', '', true)`;
      const [emptyTenant] = await transaction<{ orders: number; events: number }[]>`
        SELECT
          (SELECT count(*)::integer FROM public.v_order_timeliness_orders_v1) AS orders,
          (SELECT count(*)::integer FROM public.v_order_timeliness_pickup_events_v1) AS events
      `;
      expect(emptyTenant).toEqual({ orders: 0, events: 0 });

      await transaction`SELECT set_config('app.tenant_id', ${OWN_TENANT}, true)`;
      const ownOrderIds = Object.values(OWN_ORDERS);
      const orderRows = await transaction<{
        id: string;
        due_day: string | null;
        promised_day: string | null;
        promised_date_legacy_class: string;
      }[]>`
        SELECT projected.id, projected.due_date::date::text AS due_day,
               (
                 SELECT (source.promised_due_date AT TIME ZONE 'Europe/Berlin')::date::text
                 FROM public.orders source
                 WHERE source.id = projected.id AND source.tenant_id = projected.tenant_id
               ) AS promised_day,
               projected.promised_date_legacy_class
        FROM public.v_order_timeliness_orders_v1 projected
        WHERE projected.id = ANY(${ownOrderIds})
      `;
      const legacyClasses = Object.fromEntries(
        orderRows.map((row) => [row.id, row.promised_date_legacy_class]),
      );
      expect(orderRows.find((row) => row.id === OWN_ORDERS.berlinEqualV2)).toMatchObject({
        due_day: "2026-07-15",
        promised_day: "2026-07-15",
        promised_date_legacy_class: "gleich",
      });
      expect(legacyClasses).toEqual({
        [OWN_ORDERS.dueOnlyV1]: "nur_due_date",
        [OWN_ORDERS.berlinEqualV2]: "gleich",
        [OWN_ORDERS.bothMissing]: "gleich",
        [OWN_ORDERS.promisedOnly]: "nur_promised",
        [OWN_ORDERS.conflict]: "widerspruechlich",
      });
      const [foreignHiddenFromOwnTenant] = await transaction<{ orders: number; events: number }[]>`
        SELECT
          (SELECT count(*)::integer FROM public.v_order_timeliness_orders_v1
           WHERE id = ${FOREIGN_ORDER}) AS orders,
          (SELECT count(*)::integer FROM public.v_order_timeliness_pickup_events_v1
           WHERE event_id = ${FOREIGN_EVENT}) AS events
      `;
      expect(foreignHiddenFromOwnTenant).toEqual({ orders: 0, events: 0 });

      const eventRows = await transaction<{
        event_id: string;
        event_type: string;
        event_schema_version: number;
        aggregate_version: number;
        payload_order_id: string;
        payload_mode: string;
        payload_payment_mode: string;
        payload_invoice_state: string | null;
        payload_gate_allowed: boolean;
      }[]>`
        SELECT event_id, event_type, event_schema_version, aggregate_version,
               payload_order_id, payload_mode, payload_payment_mode,
               payload_invoice_state, payload_gate_allowed
        FROM public.v_order_timeliness_pickup_events_v1
        WHERE event_id = ANY(${[V1_EVENT, V2_EVENT]})
        ORDER BY event_type
      `;
      expect(eventRows).toEqual([
        {
          event_id: V1_EVENT,
          event_type: "ORDER_PICKED_UP_V1",
          event_schema_version: 1,
          aggregate_version: 3,
          payload_order_id: OWN_ORDERS.dueOnlyV1,
          payload_mode: "versand",
          payload_payment_mode: "vorkasse",
          payload_invoice_state: null,
          payload_gate_allowed: true,
        },
        {
          event_id: V2_EVENT,
          event_type: "ORDER_PICKED_UP_V2",
          event_schema_version: 2,
          aggregate_version: 4,
          payload_order_id: OWN_ORDERS.berlinEqualV2,
          payload_mode: "abholung",
          payload_payment_mode: "rechnung",
          payload_invoice_state: "not_issued",
          payload_gate_allowed: true,
        },
      ]);

      const eventCounts = await transaction<{ event_id: string; count: number }[]>`
        SELECT event_id, count(*)::integer AS count
        FROM public.v_order_timeliness_pickup_events_v1
        WHERE event_id = ANY(${[V1_EVENT, V2_EVENT]})
        GROUP BY event_id
        ORDER BY event_id
      `;
      expect(eventCounts).toHaveLength(2);
      expect(eventCounts.every((row) => row.count === 1)).toBe(true);

      await transaction`SELECT set_config('app.tenant_id', ${FOREIGN_TENANT}, true)`;
      const [foreignCounts] = await transaction<{ orders: number; events: number }[]>`
        SELECT
          (SELECT count(*)::integer FROM public.v_order_timeliness_orders_v1
           WHERE id = ${FOREIGN_ORDER}) AS orders,
          (SELECT count(*)::integer FROM public.v_order_timeliness_pickup_events_v1
           WHERE event_id = ${FOREIGN_EVENT}) AS events
      `;
      expect(foreignCounts).toEqual({ orders: 1, events: 1 });

      throw rollbackSignal;
    })).rejects.toBe(rollbackSignal);
  });
});
