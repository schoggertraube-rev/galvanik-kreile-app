import postgres from "postgres";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

if (
  process.env.DATABASE_URL !== LOCAL_DATABASE_URL ||
  process.env.W3_LOCAL_DATABASE_URL !== LOCAL_DATABASE_URL ||
  process.env.W4_LOCAL_DATABASE_URL !== LOCAL_DATABASE_URL
) {
  throw new Error(
    "W3_W4_LOCAL_DATABASE_REQUIRED: DATABASE_URL, W3_LOCAL_DATABASE_URL, and W4_LOCAL_DATABASE_URL must target 127.0.0.1:54322/postgres",
  );
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("W3_W4_LOCAL_DATABASE_REQUIRED: SUPABASE_SERVICE_ROLE_KEY must be unset");
}

const readAppSessionSpy = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/appSession", () => ({ readAppSession: readAppSessionSpy }));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));

const TENANT_A = "galvanik-kreile";
const TENANT_B = "tenant-b";

const USERS = {
  readonly: "11111111-1111-4111-8111-111111111111",
  buero: "22222222-2222-4222-8222-222222222222",
  werkstatt: "33333333-3333-4333-8333-333333333333",
  werkstattB: "44444444-4444-4444-8444-444444444444",
} as const;

const CUSTOMERS = {
  a: "w3-local-customer-a",
  aOther: "w3-local-customer-a-other",
  b: "w3-local-customer-b",
} as const;

const ORDERS = {
  visible: "w3-local-order-visible",
  happy: "w3-local-order-happy",
  concurrent: "w3-local-order-concurrent",
  race: "w3-local-order-race",
  rollback: "w3-local-order-rollback",
  foreign: "w3-local-order-foreign",
} as const;
const CLIENT_EVENTS = {
  visible: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  foreign: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  happy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
  stale: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
  concurrent: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
  raceA: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6",
  raceB: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7",
  tenantNamespace: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8",
  buero: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9",
  validationForeignChild: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  validationNullChild: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab",
  validationCustomerMismatch: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac",
  validationItemCustomerAOther: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad",
  validationItemCustomerB: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaae",
} as const;

const ALL_ORDER_IDS = Object.values(ORDERS);
const ALL_USER_IDS = Object.values(USERS);
const fixtureSql = postgres(LOCAL_DATABASE_URL, { max: 4, prepare: false });
type UnsafeParameters = NonNullable<Parameters<typeof fixtureSql.unsafe>[1]>;
const pool = {
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    query: string,
    parameters: UnsafeParameters = [],
  ): Promise<{ rows: T[] }> {
    const rows = await fixtureSql.unsafe<T[]>(query, parameters);
    return { rows };
  },
  async end() {
    await fixtureSql.end({ timeout: 1 });
  },
};

let transitionWareneingangToGalvanik: typeof import("@/lib/server/commands/orderStationCommand").transitionWareneingangToGalvanik;
let correctGalvanikToWareneingang: typeof import("@/lib/server/commands/orderStationCommand").correctGalvanikToWareneingang;
let readTenantStationOrders: typeof import("@/lib/server/orderStationRead").readTenantStationOrders;
let readTenantOrderStationReceipt: typeof import("@/lib/server/orderStationRead").readTenantOrderStationReceipt;
let readTenantOrderStationCorrectionReceipt: typeof import("@/lib/server/orderStationRead").readTenantOrderStationCorrectionReceipt;
let readTenantOperationalOrders: typeof import("@/lib/server/orderStationRead").readTenantOperationalOrders;
let readTenantOperationalOrderCount: typeof import("@/lib/server/orderStationRead").readTenantOperationalOrderCount;
let withPrivilegedTenantTransaction: typeof import("@/lib/server/privilegedDb").withPrivilegedTenantTransaction;
let getWareneingangOrdersAction: typeof import("@/app/warendurchlauf/actions").getWareneingangOrdersAction;
let getOrdersDb: typeof import("@/app/actions/orders.actions").getOrdersDb;
let getOrderCountDb: typeof import("@/app/actions/orders.actions").getOrderCountDb;

function setSession(userId: string, role: string, tenantId = TENANT_A) {
  readAppSessionSpy.mockResolvedValue({
    ok: true,
    session: {
      userId,
      tenantId,
      role,
      displayName: role,
      issuedAt: 4_102_444_800_000,
      expiresAt: 4_102_488_000_000,
    },
  });
}

async function clearFixtures() {
  await pool.query("DELETE FROM public.events WHERE order_id = ANY($1::text[])", [ALL_ORDER_IDS]);
  await pool.query("DELETE FROM public.items WHERE order_id = ANY($1::text[])", [ALL_ORDER_IDS]);
  await pool.query("DELETE FROM public.orders WHERE id = ANY($1::text[])", [ALL_ORDER_IDS]);
  await pool.query("DELETE FROM public.customers WHERE id = ANY($1::text[])", [Object.values(CUSTOMERS)]);
  await pool.query("DELETE FROM public.app_users WHERE id = ANY($1::uuid[])", [ALL_USER_IDS]);
}

async function seedFixtures() {
  await clearFixtures();

  await pool.query(
    `INSERT INTO public.app_users
       (id, tenant_id, email, full_name, role, active, created_at, updated_at)
     VALUES
       ($1, $5, 'w3-readonly@local.invalid', 'W3 Readonly', 'readonly', true, '2026-01-01', '2026-01-01'),
       ($2, $5, 'w3-buero@local.invalid', 'W3 Buero', 'buero', true, '2026-01-01', '2026-01-01'),
       ($3, $5, 'w3-werkstatt@local.invalid', 'W3 Werkstatt', 'werkstatt', true, '2026-01-01', '2026-01-01'),
       ($4, $6, 'w3-werkstatt-b@local.invalid', 'W3 Werkstatt B', 'werkstatt', true, '2026-01-01', '2026-01-01')`,
    [USERS.readonly, USERS.buero, USERS.werkstatt, USERS.werkstattB, TENANT_A, TENANT_B],
  );

  await pool.query(
    `INSERT INTO public.customers (id, tenant_id, customer_number, name, type, source)
     VALUES
       ($1, $4, 'W3-A', 'W3 Kunde A', 'business', 'manual'),
       ($2, $4, 'W3-A-OTHER', 'W3 Kunde A Other', 'business', 'manual'),
       ($3, $5, 'W3-B', 'W3 Kunde B', 'business', 'manual')`,
    [CUSTOMERS.a, CUSTOMERS.aOther, CUSTOMERS.b, TENANT_A, TENANT_B],
  );

  const orderRows = [
    [ORDERS.visible, TENANT_A, "W3-LOCAL-1001", CUSTOMERS.a, "W3 Visible"],
    [ORDERS.happy, TENANT_A, "W3-LOCAL-1002", CUSTOMERS.a, "W3 Happy"],
    [ORDERS.concurrent, TENANT_A, "W3-LOCAL-1003", CUSTOMERS.a, "W3 Concurrent"],
    [ORDERS.race, TENANT_A, "W3-LOCAL-1004", CUSTOMERS.a, "W3 Race"],
    [ORDERS.rollback, TENANT_A, "W3-LOCAL-1005", CUSTOMERS.a, "W3 Rollback"],
    [ORDERS.foreign, TENANT_B, "W3-LOCAL-2001", CUSTOMERS.b, "W3 Foreign"],
  ];
  for (const row of orderRows) {
    await pool.query(
      `INSERT INTO public.orders
         (id, tenant_id, order_number, customer_id, title, task, station,
          current_station, current_station_id, status, version, source, intake_date, due_date)
       VALUES ($1, $2, $3, $4, $5, 'W3 fixture', 'wareneingang',
               'wareneingang', 'wareneingang', 'angenommen', 1, 'manual',
               '2026-08-10T08:00:00Z', '2026-08-20T08:00:00Z')`,
      row,
    );
  }

  for (const [index, orderId] of ALL_ORDER_IDS.entries()) {
    const foreign = orderId === ORDERS.foreign;
    await pool.query(
      `INSERT INTO public.items
         (id, tenant_id, order_id, customer_id, name, quantity, current_station_id)
       VALUES ($1, $2, $3, $4, $5, 1, 'wareneingang')`,
      [
        `w3-local-item-${index + 1}`,
        foreign ? TENANT_B : TENANT_A,
        orderId,
        foreign ? CUSTOMERS.b : CUSTOMERS.a,
        `W3 Teil ${index + 1}`,
      ],
    );
  }

  await pool.query(
    `INSERT INTO public.events (id, tenant_id, order_id, event_type, status, station)
     VALUES
       ('w3-local-event-a', $1, $2, 'W3_BASELINE', 'success', 'wareneingang'),
       ('w3-local-event-b', $3, $4, 'W3_BASELINE', 'success', 'wareneingang')`,
    [TENANT_A, ORDERS.happy, TENANT_B, ORDERS.foreign],
  );
}

async function aggregateSnapshot(orderId: string) {
  const [order, items, events] = await Promise.all([
    pool.query(
      `SELECT id, tenant_id, customer_id, station, current_station, current_station_id, status, version
       FROM public.orders WHERE id = $1`,
      [orderId],
    ),
    pool.query(
      `SELECT id, tenant_id, order_id, customer_id, current_station_id
       FROM public.items WHERE order_id = $1 ORDER BY id`,
      [orderId],
    ),
    pool.query(
      `SELECT id, tenant_id, order_id, event_type, status, station
       FROM public.events WHERE order_id = $1 ORDER BY id`,
      [orderId],
    ),
  ]);
  return { order: order.rows, items: items.rows, events: events.rows };
}

beforeAll(async () => {
  const version = await pool.query<{ server_version_num: string }>(
    "SELECT current_setting('server_version_num') AS server_version_num",
  );
  if (!version.rows[0]?.server_version_num.startsWith("17")) {
    throw new Error(`W3_LOCAL_DATABASE_REQUIRED: PostgreSQL 17 required, got ${version.rows[0]?.server_version_num}`);
  }

  ({ transitionWareneingangToGalvanik, correctGalvanikToWareneingang } = await import("@/lib/server/commands/orderStationCommand"));
  ({
    readTenantStationOrders,
    readTenantOrderStationReceipt,
    readTenantOrderStationCorrectionReceipt,
    readTenantOperationalOrders,
    readTenantOperationalOrderCount,
  } = await import("@/lib/server/orderStationRead"));
  ({ withPrivilegedTenantTransaction } = await import("@/lib/server/privilegedDb"));
  ({ getWareneingangOrdersAction } = await import("@/app/warendurchlauf/actions"));
  ({ getOrdersDb, getOrderCountDb } = await import("@/app/actions/orders.actions"));
  await seedFixtures();
});

beforeEach(async () => {
  vi.clearAllMocks();
});

afterAll(async () => {
  // W4 receipts are deliberately immutable. This suite runs only after a fresh
  // disposable replay and leaves its deterministic fixture rows for inspection.
  await pool.end();
  const shared = (globalThis as unknown as {
    conn?: { end: (options?: { timeout?: number }) => Promise<void> };
  }).conn;
  await shared?.end({ timeout: 1 });
});

describe.sequential("W3 order station local replay integration", () => {
  it("proves the exact migration, schema delta, PostgreSQL role, and local-only evidence boundary", async () => {
    const ledger = await pool.query<{ version: string }>(
      "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version",
    );
    expect(ledger.rows.map((row) => row.version)).toEqual([
      "20260805180624",
      "20260805180801",
      "20260806120000",
      "20260806120100",
      "20260806120200",
      "20260806120300",
      "20260807090000",
      "20260807090100",
      "20260810100000",
      "20260811150000",
      "20260811154732",
      "20260811184850",
      "20260812103446",
      "20260812133649",
      "20260817120000",
    ]);

    const eventColumns = await pool.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name='events'
         AND column_name IN ('client_event_id','event_schema_version','correlation_id','aggregate_version','from_station')
       ORDER BY column_name`,
    );
    expect(eventColumns.rows.map((row) => row.column_name)).toEqual([
      "aggregate_version",
      "client_event_id",
      "correlation_id",
      "event_schema_version",
      "from_station",
    ]);

    const views = await pool.query<{ relname: string; reloptions: string[]; public_select: boolean }>(
      `SELECT c.relname, c.reloptions,
              EXISTS (
                SELECT 1
                FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) privilege
                WHERE privilege.grantee=0 AND privilege.privilege_type='SELECT'
              ) AS public_select
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='private'
         AND c.relname IN ('v_operational_station_queue_v1','v_order_station_receipts_v1')
       ORDER BY c.relname`,
    );
    expect(views.rows).toHaveLength(2);
    expect(views.rows.every((row) => row.reloptions?.includes("security_invoker=true"))).toBe(true);
    expect(views.rows.every((row) => row.public_select === false)).toBe(true);

    const triggers = await pool.query<{
      trigger_name: string;
      enabled: string;
      internal: boolean;
      row_level: boolean;
      has_qualification: boolean;
      definition: string;
      function_schema: string;
      function_name: string;
    }>(
      `SELECT t.tgname AS trigger_name,
              t.tgenabled AS enabled,
              t.tgisinternal AS internal,
              (t.tgtype & 1) = 1 AS row_level,
              t.tgqual IS NOT NULL AS has_qualification,
              pg_get_triggerdef(t.oid) AS definition,
              pn.nspname AS function_schema,
              p.proname AS function_name
       FROM pg_trigger t
       JOIN pg_class c ON c.oid=t.tgrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       JOIN pg_proc p ON p.oid=t.tgfoid
       JOIN pg_namespace pn ON pn.oid=p.pronamespace
       WHERE n.nspname='public' AND c.relname='events'
         AND t.tgname IN (
           'events_order_station_moved_v1_update_immutable',
           'events_order_station_moved_v1_delete_immutable',
           'events_order_station_moved_v1_truncate_immutable'
         )
       ORDER BY t.tgname`,
    );
    expect(triggers.rows).toHaveLength(3);
    expect(triggers.rows.every((trigger) => (
      trigger.enabled === "O"
      && trigger.internal === false
      && trigger.function_schema === "public"
      && trigger.function_name === "prevent_audit_mutation"
    ))).toBe(true);
    const deleteTrigger = triggers.rows.find((trigger) => trigger.trigger_name.endsWith("delete_immutable"));
    const truncateTrigger = triggers.rows.find((trigger) => trigger.trigger_name.endsWith("truncate_immutable"));
    const updateTrigger = triggers.rows.find((trigger) => trigger.trigger_name.endsWith("update_immutable"));
    const normalizeTriggerDefinition = (definition: string | undefined) => (definition ?? "")
      .replace(/"/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const deleteDefinition = normalizeTriggerDefinition(deleteTrigger?.definition);
    const truncateDefinition = normalizeTriggerDefinition(truncateTrigger?.definition);
    const updateDefinition = normalizeTriggerDefinition(updateTrigger?.definition);
    const guardFunctionDefinition = /execute function (?:public\.)?prevent_audit_mutation\(\)/;
    expect(deleteTrigger).toMatchObject({ row_level: true, has_qualification: true });
    expect(deleteDefinition).toContain("before delete");
    expect(deleteDefinition).toContain("when");
    expect(deleteDefinition).toContain("old.event_type");
    expect(deleteDefinition).not.toContain("new.event_type");
    expect(deleteDefinition.match(/'order_station_moved_v1'/g)).toHaveLength(1);
    expect(deleteDefinition).toMatch(guardFunctionDefinition);
    expect(truncateTrigger).toMatchObject({ row_level: false, has_qualification: false });
    expect(truncateDefinition).toContain("before truncate");
    expect(truncateDefinition).not.toContain("when");
    expect(truncateDefinition).toMatch(guardFunctionDefinition);
    expect(updateTrigger).toMatchObject({ row_level: true, has_qualification: true });
    expect(updateDefinition).toContain("before update");
    expect(updateDefinition).toContain("when");
    expect(updateDefinition).toContain("old.event_type");
    expect(updateDefinition).toMatch(/\sor\s/);
    expect(updateDefinition).toContain("new.event_type");
    expect(updateDefinition.match(/'order_station_moved_v1'/g)).toHaveLength(2);
    expect(updateDefinition).toMatch(guardFunctionDefinition);

    const privateGuard = await pool.query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='private' AND p.proname='reject_order_station_event_mutation_v1'`,
    );
    expect(privateGuard.rows[0]?.count).toBe(0);

    const column = await pool.query<{
      data_type: string;
      is_nullable: string;
      column_default: string;
    }>(
      `SELECT data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name='orders' AND column_name='version'`,
    );
    expect(column.rows).toHaveLength(1);
    expect(column.rows[0]).toMatchObject({ data_type: "integer", is_nullable: "NO" });
    expect(column.rows[0]?.column_default).toContain("1");

    const constraint = await pool.query<{ definition: string; validated: boolean }>(
      `SELECT pg_get_constraintdef(oid) AS definition, convalidated AS validated
       FROM pg_constraint
       WHERE conname='orders_version_positive'`,
    );
    expect(constraint.rows).toHaveLength(1);
    expect(constraint.rows[0]?.validated).toBe(true);
    expect(constraint.rows[0]?.definition).toMatch(/version\s*>\s*0/);

    const role = await pool.query<{
      current_user: string;
      session_user: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
      row_security: string;
    }>(
      `SELECT current_user, session_user, r.rolsuper, r.rolbypassrls,
              current_setting('row_security') AS row_security
       FROM pg_roles r WHERE r.rolname=current_user`,
    );
    expect(role.rows[0]).toMatchObject({
      current_user: "postgres",
      session_user: "postgres",
      rolsuper: false,
      rolbypassrls: true,
      row_security: "on",
    });
    // This proves application predicates and transactionality, not RLS or least privilege.
  });

  it("keeps both private views empty without an exact tenant GUC and enforces the intended ACL boundary", async () => {
    const noTenant = await pool.query<{ queue_count: number; receipt_count: number }>(
      `SELECT
         (SELECT count(*)::int FROM private.v_operational_station_queue_v1) AS queue_count,
         (SELECT count(*)::int FROM private.v_order_station_receipts_v1) AS receipt_count`,
    );
    expect(noTenant.rows[0]).toEqual({ queue_count: 0, receipt_count: 0 });

    const emptyTenant = await withPrivilegedTenantTransaction({ tenantId: "" }, async (tx) => tx.execute<{
      queue_count: number;
      receipt_count: number;
    }>(sql`
      SELECT
        (SELECT count(*)::int FROM private.v_operational_station_queue_v1) AS queue_count,
        (SELECT count(*)::int FROM private.v_order_station_receipts_v1) AS receipt_count
    `));
    expect(emptyTenant[0]).toEqual({ queue_count: 0, receipt_count: 0 });

    const acl = await pool.query<{
      role_name: string;
      schema_usage: boolean;
      queue_select: boolean;
      receipt_select: boolean;
      append_guard_execute: boolean;
    }>(
      `SELECT role_name,
              has_schema_privilege(role_name, 'private', 'USAGE') AS schema_usage,
              has_table_privilege(role_name, 'private.v_operational_station_queue_v1', 'SELECT') AS queue_select,
              has_table_privilege(role_name, 'private.v_order_station_receipts_v1', 'SELECT') AS receipt_select,
              has_function_privilege(role_name, 'public.prevent_audit_mutation()', 'EXECUTE') AS append_guard_execute
       FROM unnest(ARRAY['anon','authenticated','service_role']) AS role_name
       ORDER BY role_name`,
    );
    expect(acl.rows).toEqual([
      { role_name: "anon", schema_usage: false, queue_select: false, receipt_select: false, append_guard_execute: false },
      { role_name: "authenticated", schema_usage: true, queue_select: false, receipt_select: false, append_guard_execute: false },
      { role_name: "service_role", schema_usage: false, queue_select: false, receipt_select: false, append_guard_execute: true },
    ]);

    const guardAcl = await pool.query<{
      public_execute: boolean;
      postgres_execute: boolean;
      service_role_execute: boolean;
      security_definer: boolean;
      return_type: string;
      owner_name: string;
    }>(
      `SELECT
         EXISTS (
           SELECT 1
           FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) privilege
           WHERE privilege.grantee=0 AND privilege.privilege_type='EXECUTE'
         ) AS public_execute,
         has_function_privilege('postgres', p.oid, 'EXECUTE') AS postgres_execute,
         has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
         p.prosecdef AS security_definer,
         p.prorettype::regtype::text AS return_type,
         owner.rolname AS owner_name
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid=p.pronamespace
       JOIN pg_roles owner ON owner.oid=p.proowner
       WHERE n.nspname='public' AND p.proname='prevent_audit_mutation'
         AND oidvectortypes(p.proargtypes)=''`,
    );
    expect(guardAcl.rows).toEqual([{
      public_execute: false,
      postgres_execute: true,
      service_role_execute: true,
      security_definer: false,
      return_type: "trigger",
      owner_name: "postgres",
    }]);
  });

  it("rejects every nullable W4 contract breach and accepts one valid rollback control", async () => {
    const validContract = {
      tenantId: TENANT_A as string | null,
      orderId: ORDERS.visible as string | null,
      itemId: null as string | null,
      userId: USERS.werkstatt as string | null,
      clientEventId: "10000000-0000-4000-8000-000000000001" as string | null,
      eventSchemaVersion: 1 as number | null,
      correlationId: "20000000-0000-4000-8000-000000000001" as string | null,
      aggregateVersion: 500 as number | null,
      fromStation: "wareneingang" as string | null,
      station: "galvanik" as string | null,
      status: "success" as string | null,
    };
    const invalidContracts = [
      ["tenant_id", { ...validContract, tenantId: null }],
      ["order_id", { ...validContract, orderId: null }],
      ["item_id", { ...validContract, itemId: "w3-local-item-1" }],
      ["user_id", { ...validContract, userId: null }],
      ["client_event_id", { ...validContract, clientEventId: null }],
      ["event_schema_version", { ...validContract, eventSchemaVersion: null }],
      ["correlation_id", { ...validContract, correlationId: null }],
      ["aggregate_version", { ...validContract, aggregateVersion: null }],
      ["from_station", { ...validContract, fromStation: null }],
      ["station", { ...validContract, station: null }],
      ["status", { ...validContract, status: null }],
    ] as const;

    for (const [field, contract] of invalidContracts) {
      const eventId = `w4-local-contract-null-${field}`;
      await expect(
        fixtureSql.begin(async (tx) => {
          await tx.unsafe(
            `INSERT INTO public.events (
               id, tenant_id, order_id, item_id, event_type, status, user_id, station,
               client_event_id, event_schema_version, correlation_id, aggregate_version, from_station
             ) VALUES ($1, $2, $3, $4, 'ORDER_STATION_MOVED_V1', $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              eventId,
              contract.tenantId,
              contract.orderId,
              contract.itemId,
              contract.status,
              contract.userId,
              contract.station,
              contract.clientEventId,
              contract.eventSchemaVersion,
              contract.correlationId,
              contract.aggregateVersion,
              contract.fromStation,
            ],
          );
          throw new Error("W4_EXPECTED_CHECK_FAILURE");
        }),
      ).rejects.toMatchObject({ code: "23514" });
      const absent = await pool.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM public.events WHERE id=$1",
        [eventId],
      );
      expect(absent.rows[0]?.count).toBe(0);
    }

    await expect(
      fixtureSql.begin(async (tx) => {
        const inserted = await tx.unsafe<{ id: string }[]>(
          `INSERT INTO public.events (
             id, tenant_id, order_id, item_id, event_type, status, user_id, station,
             client_event_id, event_schema_version, correlation_id, aggregate_version, from_station
           ) VALUES (
             'w4-local-contract-valid-control', $1, $2, NULL, 'ORDER_STATION_MOVED_V1',
             'success', $3, 'galvanik', '30000000-0000-4000-8000-000000000001', 1,
             '40000000-0000-4000-8000-000000000001', 501, 'wareneingang'
           ) RETURNING id`,
          [TENANT_A, ORDERS.visible, USERS.werkstatt],
        );
        expect(inserted).toEqual([{ id: "w4-local-contract-valid-control" }]);
        throw new Error("W4_ROLLBACK_VALID_CONTRACT_CONTROL");
      }),
    ).rejects.toThrow("W4_ROLLBACK_VALID_CONTRACT_CONTROL");
    const validControl = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM public.events WHERE id='w4-local-contract-valid-control'",
    );
    expect(validControl.rows[0]?.count).toBe(0);
  });

  it("filters a historical incomplete same-type event out of the v1 receipt port", async () => {
    await expect(
      fixtureSql.begin(async (tx) => {
        await tx.unsafe(
          "ALTER TABLE public.events DROP CONSTRAINT events_order_station_moved_v1_contract_chk",
        );
        await tx.unsafe(
          `INSERT INTO public.events (
             id, tenant_id, order_id, event_type, status, user_id, station, item_id,
             client_event_id, event_schema_version, correlation_id, aggregate_version, from_station
           ) VALUES (
             'w4-local-historical-incomplete', $1, $2, 'ORDER_STATION_MOVED_V1', 'success', $3,
             'galvanik', NULL, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', NULL,
             'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 99, 'wareneingang'
           )`,
          [TENANT_A, ORDERS.visible, USERS.werkstatt],
        );
        await tx.unsafe("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);
        const rows = await tx.unsafe<{ event_id: string }[]>(
          "SELECT event_id FROM private.v_order_station_receipts_v1 WHERE event_id=$1",
          ["w4-local-historical-incomplete"],
        );
        expect(rows).toHaveLength(0);
        throw new Error("W4_ROLLBACK_HISTORICAL_FIXTURE");
      }),
    ).rejects.toThrow("W4_ROLLBACK_HISTORICAL_FIXTURE");
  });

  it("uses the real resolver for readonly and buero reads identically", async () => {
    for (const [role, userId] of [
      ["readonly", USERS.readonly],
      ["buero", USERS.buero],
    ] as const) {
      setSession(userId, role);
      const read = await getWareneingangOrdersAction();
      expect(read.ok).toBe(true);
      if (read.ok) {
        const ids = read.data.map((order) => order.id);
        expect(ids).toContain(ORDERS.visible);
        expect(ids).not.toContain(ORDERS.foreign);
      }
      const fullRead = await getOrdersDb();
      expect(fullRead.ok).toBe(true);
      if (fullRead.ok) {
        expect(new Set(fullRead.data.map((order) => order.id))).toEqual(
          new Set([ORDERS.visible, ORDERS.happy, ORDERS.concurrent, ORDERS.race, ORDERS.rollback]),
        );
      }
      await expect(getOrderCountDb()).resolves.toEqual({ ok: true, data: { count: 5 } });
    }
  });

  it("rejects a readonly station-transition command without changing the shared order snapshot", async () => {
    setSession(USERS.readonly, "readonly");
    const before = await aggregateSnapshot(ORDERS.visible);
    await expect(
      transitionWareneingangToGalvanik({ orderId: ORDERS.visible, expectedVersion: 1, clientEventId: CLIENT_EVENTS.visible }),
    ).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(await aggregateSnapshot(ORDERS.visible)).toEqual(before);
  });

  it("alternates exact tenant sets and counts without cache bleed through the real v1 read port", async () => {
    const expectedA = new Set([
      ORDERS.visible,
      ORDERS.happy,
      ORDERS.concurrent,
      ORDERS.race,
      ORDERS.rollback,
    ]);
    const expectedB = new Set([ORDERS.foreign]);

    const tenantAFirst = await readTenantOperationalOrders({ tenantId: TENANT_A });
    const tenantB = await readTenantOperationalOrders({ tenantId: TENANT_B });
    const tenantASecond = await readTenantOperationalOrders({ tenantId: TENANT_A });

    expect(new Set(tenantAFirst.map((order) => order.id))).toEqual(expectedA);
    expect(new Set(tenantB.map((order) => order.id))).toEqual(expectedB);
    expect(new Set(tenantASecond.map((order) => order.id))).toEqual(expectedA);
    expect(tenantAFirst.flatMap((order) => order.parts.map((item) => item.id))).not.toContain(
      "w3-local-item-6",
    );
    expect(tenantB.flatMap((order) => order.parts.map((item) => item.id))).toEqual([
      "w3-local-item-6",
    ]);
    await expect(readTenantOperationalOrderCount({ tenantId: TENANT_A })).resolves.toBe(5);
    await expect(readTenantOperationalOrderCount({ tenantId: TENANT_B })).resolves.toBe(1);
  });

  it("rejects a persisted blank station alias in both the full read and same-port count", async () => {
    await pool.query("UPDATE public.orders SET current_station_id='' WHERE id=$1", [ORDERS.visible]);
    try {
      await expect(
        readTenantOperationalOrders({ tenantId: TENANT_A }),
      ).rejects.toThrow("ORDER_READMODEL_INVALID");
      await expect(
        readTenantOperationalOrderCount({ tenantId: TENANT_A }),
      ).rejects.toThrow("ORDER_OWNERSHIP_INVALID");
    } finally {
      await pool.query(
        "UPDATE public.orders SET current_station_id='wareneingang' WHERE id=$1",
        [ORDERS.visible],
      );
    }
  });

  it("uses exact tenant sets, ignores injected tenant input, and hides foreign orders", async () => {
    setSession(USERS.readonly, "readonly");
    const adversarialRead = getWareneingangOrdersAction as unknown as (
      input: { tenantId: string },
    ) => ReturnType<typeof getWareneingangOrdersAction>;
    const result = await adversarialRead({ tenantId: TENANT_B });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(new Set(result.data.map((order) => order.id))).toEqual(
        new Set([ORDERS.visible, ORDERS.happy, ORDERS.concurrent, ORDERS.race, ORDERS.rollback]),
      );
      expect(result.data.flatMap((order) => order.parts.map((item) => item.id))).not.toContain(
        "w3-local-item-6",
      );
    }

    setSession(USERS.werkstatt, "werkstatt");
    const foreignBefore = await aggregateSnapshot(ORDERS.foreign);
    await expect(
      transitionWareneingangToGalvanik({ orderId: ORDERS.foreign, expectedVersion: 1, clientEventId: CLIENT_EVENTS.foreign }),
    ).resolves.toMatchObject({ code: "NOT_FOUND" });
    expect(await aggregateSnapshot(ORDERS.foreign)).toEqual(foreignBefore);
  });

  it("rejects foreign and null tenant children without partial reads or writes", async () => {
    setSession(USERS.werkstatt, "werkstatt");

    for (const [itemId, tenantId, clientEventId] of [
      ["w3-local-item-foreign-child", TENANT_B, CLIENT_EVENTS.validationForeignChild],
      ["w3-local-item-null-child", null, CLIENT_EVENTS.validationNullChild],
    ] as const) {
      await pool.query(
        `INSERT INTO public.items
           (id, tenant_id, order_id, customer_id, name, current_station_id)
         VALUES ($1, $2, $3, $4, 'Corrupt child', 'wareneingang')`,
        [itemId, tenantId, ORDERS.visible, tenantId === TENANT_B ? CUSTOMERS.b : CUSTOMERS.a],
      );
      const before = await aggregateSnapshot(ORDERS.visible);
      await expect(
        transitionWareneingangToGalvanik({ orderId: ORDERS.visible, expectedVersion: 1, clientEventId }),
      ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
      expect(await aggregateSnapshot(ORDERS.visible)).toEqual(before);
      await expect(
        readTenantStationOrders({ tenantId: TENANT_A }, "wareneingang"),
      ).rejects.toThrow("ORDER_OWNERSHIP_INVALID");
      await expect(
        readTenantOperationalOrders({ tenantId: TENANT_A }),
      ).rejects.toThrow("ORDER_OWNERSHIP_INVALID");
      await expect(
        readTenantOperationalOrderCount({ tenantId: TENANT_A }),
      ).rejects.toThrow("ORDER_OWNERSHIP_INVALID");
      await pool.query("DELETE FROM public.items WHERE id=$1", [itemId]);
    }
  });

  it("rejects a tenant-A order assigned to a tenant-B customer without changing its snapshot", async () => {
    setSession(USERS.werkstatt, "werkstatt");

    await expect(
      pool.query("UPDATE public.orders SET customer_id=NULL WHERE id=$1", [ORDERS.visible]),
    ).rejects.toMatchObject({ code: "23502" });
    await expect(
      pool.query("UPDATE public.orders SET customer_id=$1 WHERE id=$2", [
        "w3-local-customer-missing",
        ORDERS.visible,
      ]),
    ).rejects.toMatchObject({ code: "23503" });

    await pool.query("UPDATE public.orders SET customer_id=$1 WHERE id=$2", [
      CUSTOMERS.b,
      ORDERS.visible,
    ]);
    const before = await aggregateSnapshot(ORDERS.visible);
    await expect(
      transitionWareneingangToGalvanik({ orderId: ORDERS.visible, expectedVersion: 1, clientEventId: CLIENT_EVENTS.validationCustomerMismatch }),
    ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await aggregateSnapshot(ORDERS.visible)).toEqual(before);
    await expect(
      readTenantStationOrders({ tenantId: TENANT_A }, "wareneingang"),
    ).rejects.toThrow("ORDER_OWNERSHIP_INVALID");
    await expect(
      readTenantOperationalOrders({ tenantId: TENANT_A }),
    ).rejects.toThrow("ORDER_OWNERSHIP_INVALID");
    await expect(
      readTenantOperationalOrderCount({ tenantId: TENANT_A }),
    ).rejects.toThrow("ORDER_OWNERSHIP_INVALID");
    await pool.query("UPDATE public.orders SET customer_id=$1 WHERE id=$2", [
      CUSTOMERS.a,
      ORDERS.visible,
    ]);
  });

  it("rejects tenant-A items assigned to another tenant-A or tenant-B customer without changing the snapshot", async () => {
    setSession(USERS.werkstatt, "werkstatt");

    for (const [customerId, clientEventId] of [
      [CUSTOMERS.aOther, CLIENT_EVENTS.validationItemCustomerAOther],
      [CUSTOMERS.b, CLIENT_EVENTS.validationItemCustomerB],
    ] as const) {
      await pool.query("UPDATE public.items SET customer_id=$1 WHERE id=$2", [
        customerId,
        "w3-local-item-1",
      ]);
      const before = await aggregateSnapshot(ORDERS.visible);
      await expect(
        transitionWareneingangToGalvanik({ orderId: ORDERS.visible, expectedVersion: 1, clientEventId }),
      ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
      expect(await aggregateSnapshot(ORDERS.visible)).toEqual(before);
      await expect(
        readTenantStationOrders({ tenantId: TENANT_A }, "wareneingang"),
      ).rejects.toThrow("ORDER_OWNERSHIP_INVALID");
      await expect(
        readTenantOperationalOrders({ tenantId: TENANT_A }),
      ).rejects.toThrow("ORDER_OWNERSHIP_INVALID");
      await expect(
        readTenantOperationalOrderCount({ tenantId: TENANT_A }),
      ).rejects.toThrow("ORDER_OWNERSHIP_INVALID");
      await pool.query("UPDATE public.items SET customer_id=$1 WHERE id=$2", [
        CUSTOMERS.a,
        "w3-local-item-1",
      ]);
    }
  });

  it("commits the complete aggregate once, reads it back fresh, and rejects a stale retry", async () => {
    setSession(USERS.werkstatt, "werkstatt");
    const beforeEvents = await pool.query(
      "SELECT id, tenant_id, order_id, event_type, status, station FROM public.events WHERE order_id=$1 ORDER BY id",
      [ORDERS.happy],
    );
    const beforeRead = await readTenantStationOrders({ tenantId: TENANT_A }, "wareneingang");
    expect(beforeRead.map((order) => order.id)).toContain(ORDERS.happy);

    const firstResult = await transitionWareneingangToGalvanik({
      orderId: ORDERS.happy,
      expectedVersion: 1,
      clientEventId: CLIENT_EVENTS.happy,
    });
    expect(firstResult).toMatchObject({
      code: "OK",
      replayed: false,
      receipt: {
        clientEventId: CLIENT_EVENTS.happy,
        orderId: ORDERS.happy,
        aggregateVersion: 2,
        fromStation: "wareneingang",
        toStation: "galvanik",
        actorId: USERS.werkstatt,
      },
    });
    if (firstResult.code !== "OK") throw new Error("W4_EXPECTED_OK");

    const committed = await aggregateSnapshot(ORDERS.happy);
    expect(committed.order).toEqual([
      expect.objectContaining({
        station: "galvanik",
        current_station: "galvanik",
        current_station_id: "galvanik",
        status: "galvanik",
        version: 2,
      }),
    ]);
    expect(committed.items.every((item) => item.current_station_id === "galvanik")).toBe(true);
    expect(committed.events).toHaveLength(beforeEvents.rows.length + 1);
    expect(committed.events.filter((event) => event.event_type === "ORDER_STATION_MOVED_V1")).toHaveLength(1);

    const persistedReceipt = await readTenantOrderStationReceipt(
      { tenantId: TENANT_A },
      { orderId: ORDERS.happy, clientEventId: CLIENT_EVENTS.happy },
    );
    expect(persistedReceipt).toEqual(firstResult.receipt);
    await expect(
      readTenantOrderStationReceipt(
        { tenantId: TENANT_B },
        { orderId: ORDERS.happy, clientEventId: CLIENT_EVENTS.happy },
      ),
    ).resolves.toBeNull();

    await expect(
      transitionWareneingangToGalvanik({
        orderId: ORDERS.happy,
        expectedVersion: 1,
        clientEventId: CLIENT_EVENTS.happy,
      }),
    ).resolves.toEqual({ code: "OK", receipt: firstResult.receipt, replayed: true });

    const [wareneingang, galvanik] = await Promise.all([
      readTenantStationOrders({ tenantId: TENANT_A }, "wareneingang"),
      readTenantStationOrders({ tenantId: TENANT_A }, "galvanik"),
    ]);
    expect(wareneingang.map((order) => order.id)).not.toContain(ORDERS.happy);
    expect(galvanik).toContainEqual(
      expect.objectContaining({ id: ORDERS.happy, status: "galvanik", version: 2 }),
    );

    const stateBeforeStale = await aggregateSnapshot(ORDERS.happy);
    await expect(
      transitionWareneingangToGalvanik({ orderId: ORDERS.happy, expectedVersion: 1, clientEventId: CLIENT_EVENTS.stale }),
    ).resolves.toMatchObject({ code: "CONFLICT" });
    expect(await aggregateSnapshot(ORDERS.happy)).toEqual(stateBeforeStale);
  });

  it("serializes the same client event into one write and one exact replay", async () => {
    setSession(USERS.werkstatt, "werkstatt");
    const results = await Promise.all([
      transitionWareneingangToGalvanik({ orderId: ORDERS.concurrent, expectedVersion: 1, clientEventId: CLIENT_EVENTS.concurrent }),
      transitionWareneingangToGalvanik({ orderId: ORDERS.concurrent, expectedVersion: 1, clientEventId: CLIENT_EVENTS.concurrent }),
    ]);
    expect(results.map((result) => result.code)).toEqual(["OK", "OK"]);
    expect(results.map((result) => result.code === "OK" && result.replayed).sort()).toEqual([false, true]);
    const finalState = await aggregateSnapshot(ORDERS.concurrent);
    expect(finalState.order[0]).toMatchObject({
      station: "galvanik",
      current_station: "galvanik",
      current_station_id: "galvanik",
      version: 2,
    });
    expect(finalState.items.every((item) => item.current_station_id === "galvanik")).toBe(true);
    expect(finalState.events.filter((event) => event.event_type === "ORDER_STATION_MOVED_V1")).toHaveLength(1);
  });

  it("serializes different client events for one expected version into one write and one conflict", async () => {
    setSession(USERS.werkstatt, "werkstatt");
    const results = await Promise.all([
      transitionWareneingangToGalvanik({ orderId: ORDERS.race, expectedVersion: 1, clientEventId: CLIENT_EVENTS.raceA }),
      transitionWareneingangToGalvanik({ orderId: ORDERS.race, expectedVersion: 1, clientEventId: CLIENT_EVENTS.raceB }),
    ]);
    expect(results.map((result) => result.code).sort()).toEqual(["CONFLICT", "OK"]);
    const finalState = await aggregateSnapshot(ORDERS.race);
    expect(finalState.order[0]).toMatchObject({
      station: "galvanik",
      current_station: "galvanik",
      current_station_id: "galvanik",
      version: 2,
    });
    expect(finalState.items.every((item) => item.current_station_id === "galvanik")).toBe(true);
    expect(finalState.events.filter((event) => event.event_type === "ORDER_STATION_MOVED_V1")).toHaveLength(1);
  });

  it("isolates one client event id across tenant-bound persisted receipt ports", async () => {
    await expect(
      fixtureSql.begin(async (tx) => {
        await tx.unsafe(
          `INSERT INTO public.events (
             id, tenant_id, order_id, item_id, event_type, status, user_id, station,
             client_event_id, event_schema_version, correlation_id, aggregate_version, from_station
           ) VALUES
             ('w4-local-namespace-a', $1, $2, NULL, 'ORDER_STATION_MOVED_V1', 'success', $3,
              'galvanik', $4, 1, '50000000-0000-4000-8000-000000000001', 2, 'wareneingang'),
             ('w4-local-namespace-b', $5, $6, NULL, 'ORDER_STATION_MOVED_V1', 'success', $7,
              'galvanik', $4, 1, '60000000-0000-4000-8000-000000000001', 2, 'wareneingang')`,
          [
            TENANT_A,
            ORDERS.visible,
            USERS.werkstatt,
            CLIENT_EVENTS.tenantNamespace,
            TENANT_B,
            ORDERS.foreign,
            USERS.werkstattB,
          ],
        );
        const groups = await tx.unsafe<{ tenant_id: string; order_id: string; count: number }[]>(
          `SELECT tenant_id, order_id, count(*)::int AS count
           FROM public.events
           WHERE client_event_id=$1 AND event_type='ORDER_STATION_MOVED_V1'
           GROUP BY tenant_id, order_id
           ORDER BY tenant_id, order_id`,
          [CLIENT_EVENTS.tenantNamespace],
        );
        expect(groups).toEqual([
          { tenant_id: TENANT_A, order_id: ORDERS.visible, count: 1 },
          { tenant_id: TENANT_B, order_id: ORDERS.foreign, count: 1 },
        ]);

        await tx.unsafe("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);
        const tenantAOwn = await tx.unsafe<{ event_id: string; tenant_id: string; order_id: string }[]>(
          `SELECT event_id, tenant_id, order_id
           FROM private.v_order_station_receipts_v1
           WHERE order_id=$1 AND client_event_id=$2`,
          [ORDERS.visible, CLIENT_EVENTS.tenantNamespace],
        );
        const tenantACross = await tx.unsafe<{ event_id: string }[]>(
          `SELECT event_id FROM private.v_order_station_receipts_v1
           WHERE order_id=$1 AND client_event_id=$2`,
          [ORDERS.foreign, CLIENT_EVENTS.tenantNamespace],
        );
        expect(tenantAOwn).toEqual([{
          event_id: "w4-local-namespace-a",
          tenant_id: TENANT_A,
          order_id: ORDERS.visible,
        }]);
        expect(tenantACross).toHaveLength(0);

        await tx.unsafe("SELECT set_config('app.tenant_id', $1, true)", [TENANT_B]);
        const tenantBOwn = await tx.unsafe<{ event_id: string; tenant_id: string; order_id: string }[]>(
          `SELECT event_id, tenant_id, order_id
           FROM private.v_order_station_receipts_v1
           WHERE order_id=$1 AND client_event_id=$2`,
          [ORDERS.foreign, CLIENT_EVENTS.tenantNamespace],
        );
        const tenantBCross = await tx.unsafe<{ event_id: string }[]>(
          `SELECT event_id FROM private.v_order_station_receipts_v1
           WHERE order_id=$1 AND client_event_id=$2`,
          [ORDERS.visible, CLIENT_EVENTS.tenantNamespace],
        );
        expect(tenantBOwn).toEqual([{
          event_id: "w4-local-namespace-b",
          tenant_id: TENANT_B,
          order_id: ORDERS.foreign,
        }]);
        expect(tenantBCross).toHaveLength(0);
        throw new Error("W4_ROLLBACK_TENANT_NAMESPACE_FIXTURE");
      }),
    ).rejects.toThrow("W4_ROLLBACK_TENANT_NAMESPACE_FIXTURE");
    const rolledBack = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM public.events WHERE id IN ('w4-local-namespace-a','w4-local-namespace-b')",
    );
    expect(rolledBack.rows[0]?.count).toBe(0);
  });

  it("rejects a tenant-B app session without changing its order or events", async () => {
    setSession(USERS.werkstattB, "werkstatt", TENANT_B);
    const before = await aggregateSnapshot(ORDERS.foreign);
    await expect(
      transitionWareneingangToGalvanik({
        orderId: ORDERS.foreign,
        expectedVersion: 1,
        clientEventId: CLIENT_EVENTS.tenantNamespace,
      }),
    ).resolves.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(await aggregateSnapshot(ORDERS.foreign)).toEqual(before);
  });

  it("rolls back order and items when the mandatory event receipt cannot be inserted", async () => {
    await pool.query(
      `INSERT INTO public.events (
         id, tenant_id, order_id, event_type, status, user_id, station,
         client_event_id, event_schema_version, correlation_id, aggregate_version, from_station
       ) VALUES (
         'w4-local-event-insert-guard', $1, $2, 'ORDER_STATION_MOVED_V1', 'success', $3, 'galvanik',
         'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 1,
         'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 2, 'wareneingang'
       )`,
      [TENANT_A, ORDERS.rollback, USERS.werkstatt],
    );
    setSession(USERS.werkstatt, "werkstatt");
    const before = await aggregateSnapshot(ORDERS.rollback);

    await expect(
      transitionWareneingangToGalvanik({
        orderId: ORDERS.rollback,
        expectedVersion: 1,
        clientEventId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      }),
    ).resolves.toMatchObject({ code: "UNAVAILABLE" });
    expect(await aggregateSnapshot(ORDERS.rollback)).toEqual(before);
  });

  it("keeps W4 receipts immutable across OLD/NEW updates, delete, and truncate", async () => {
    const receiptBefore = await aggregateSnapshot(ORDERS.rollback);
    const legacyBefore = await aggregateSnapshot(ORDERS.happy);
    await expect(
      pool.query("UPDATE public.events SET notes='changed' WHERE id='w4-local-event-insert-guard'"),
    ).rejects.toMatchObject({ code: "P0001" });
    await expect(
      pool.query("UPDATE public.events SET event_type='W3_BASELINE' WHERE id='w4-local-event-insert-guard'"),
    ).rejects.toMatchObject({ code: "P0001" });
    await expect(
      pool.query("UPDATE public.events SET event_type='ORDER_STATION_MOVED_V1' WHERE id='w3-local-event-a'"),
    ).rejects.toMatchObject({ code: "P0001" });
    await expect(
      pool.query("DELETE FROM public.events WHERE id='w4-local-event-insert-guard'"),
    ).rejects.toMatchObject({ code: "P0001" });
    // Either the audit-mutation trigger (P0001) or Postgres itself blocking the
    // TRUNCATE first because another table's foreign key references public.events
    // (0A000) is an acceptable rejection; both leave the table fully intact.
    await expect(pool.query("TRUNCATE public.events")).rejects.toMatchObject({
      code: expect.stringMatching(/^(P0001|0A000)$/),
    });
    await expect(
      fixtureSql.begin(async (tx) => {
        await tx.unsafe("SET LOCAL ROLE service_role");
        await tx.unsafe("DELETE FROM public.events WHERE id=$1", ["w4-local-event-insert-guard"]);
      }),
    ).rejects.toMatchObject({ code: "P0001" });
    expect(await aggregateSnapshot(ORDERS.rollback)).toEqual(receiptBefore);
    expect(await aggregateSnapshot(ORDERS.happy)).toEqual(legacyBefore);

    await pool.query(
      `INSERT INTO public.events (id, tenant_id, order_id, event_type, status, station)
       VALUES ('w4-local-legacy-control', $1, $2, 'W4_LEGACY_CONTROL', 'success', 'wareneingang')`,
      [TENANT_A, ORDERS.visible],
    );
    await pool.query(
      "UPDATE public.events SET status='legacy-updated' WHERE id='w4-local-legacy-control'",
    );
    await pool.query("DELETE FROM public.events WHERE id='w4-local-legacy-control'");
    const legacyControl = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM public.events WHERE id='w4-local-legacy-control'",
    );
    expect(legacyControl.rows[0]?.count).toBe(0);
  });

  it("sets transaction-local tenant context and rolls back order and item updates after a real error", async () => {
    const before = await aggregateSnapshot(ORDERS.rollback);
    await expect(
      withPrivilegedTenantTransaction({ tenantId: TENANT_A }, async (tx) => {
        const context = await tx.execute<{ tenant_id: string }>(sql`
          SELECT current_setting('app.tenant_id', true) AS tenant_id
        `);
        expect(context[0]?.tenant_id).toBe(TENANT_A);
        await tx.execute(sql`
          UPDATE public.orders SET version=version+1 WHERE id=${ORDERS.rollback} AND tenant_id=${TENANT_A}
        `);
        await tx.execute(sql`
          UPDATE public.items SET current_station_id='galvanik'
          WHERE order_id=${ORDERS.rollback} AND tenant_id=${TENANT_A}
        `);
        throw new Error("W3_FORCE_ROLLBACK");
      }),
    ).rejects.toThrow("W3_FORCE_ROLLBACK");
    expect(await aggregateSnapshot(ORDERS.rollback)).toEqual(before);

    await withPrivilegedTenantTransaction({ tenantId: TENANT_B }, async (tx) => {
      const context = await tx.execute<{ tenant_id: string }>(sql`
        SELECT current_setting('app.tenant_id', true) AS tenant_id
      `);
      expect(context[0]?.tenant_id).toBe(TENANT_B);
    });
  });

  it("D-F12-003: allows buero to execute a real station transition on an isolated order with a readable receipt", async () => {
    const BUERO_ORDER_ID = "w3-local-order-buero";
    const BUERO_ITEM_ID = "w3-local-item-buero";
    await pool.query(
      `INSERT INTO public.orders
         (id, tenant_id, order_number, customer_id, title, task, station,
          current_station, current_station_id, status, version, source, intake_date, due_date)
       VALUES ($1, $2, 'W3-LOCAL-BUERO', $3, 'W3 Buero Isolated', 'W3 fixture', 'wareneingang',
               'wareneingang', 'wareneingang', 'angenommen', 1, 'manual',
               '2026-08-10T08:00:00Z', '2026-08-20T08:00:00Z')`,
      [BUERO_ORDER_ID, TENANT_A, CUSTOMERS.a],
    );
    await pool.query(
      `INSERT INTO public.items
         (id, tenant_id, order_id, customer_id, name, quantity, current_station_id)
       VALUES ($1, $2, $3, $4, 'W3 Buero Teil', 1, 'wareneingang')`,
      [BUERO_ITEM_ID, TENANT_A, BUERO_ORDER_ID, CUSTOMERS.a],
    );

    setSession(USERS.buero, "buero");
    const result = await transitionWareneingangToGalvanik({
      orderId: BUERO_ORDER_ID,
      expectedVersion: 1,
      clientEventId: CLIENT_EVENTS.buero,
    });
    expect(result).toMatchObject({
      code: "OK",
      replayed: false,
      receipt: {
        clientEventId: CLIENT_EVENTS.buero,
        orderId: BUERO_ORDER_ID,
        aggregateVersion: 2,
        fromStation: "wareneingang",
        toStation: "galvanik",
        actorId: USERS.buero,
      },
    });
    if (result.code !== "OK") throw new Error("W3_BUERO_EXPECTED_OK");

    const committed = await aggregateSnapshot(BUERO_ORDER_ID);
    expect(committed.order).toEqual([
      expect.objectContaining({
        station: "galvanik",
        current_station: "galvanik",
        current_station_id: "galvanik",
        status: "galvanik",
        version: 2,
      }),
    ]);
    expect(committed.items.every((item) => item.current_station_id === "galvanik")).toBe(true);

    const persistedReceipt = await readTenantOrderStationReceipt(
      { tenantId: TENANT_A },
      { orderId: BUERO_ORDER_ID, clientEventId: CLIENT_EVENTS.buero },
    );
    expect(persistedReceipt).toEqual(result.receipt);
  });

  it("D-F12-004: enforces the correction DB contract shape — CHECK, immutability triggers, combined indexes, and the private readback view", async () => {
    const correctionConstraint = await pool.query<{ definition: string; validated: boolean }>(
      `SELECT pg_get_constraintdef(oid) AS definition, convalidated AS validated
       FROM pg_constraint
       WHERE conname='events_order_station_corrected_v1_contract_chk'`,
    );
    expect(correctionConstraint.rows).toHaveLength(1);
    expect(correctionConstraint.rows[0]?.validated).toBe(false);
    expect(correctionConstraint.rows[0]?.definition).toContain("ORDER_STATION_CORRECTED_V1");
    expect(correctionConstraint.rows[0]?.definition).toMatch(/description/);

    const correctionTriggers = await pool.query<{
      trigger_name: string;
      enabled: string;
      internal: boolean;
      row_level: boolean;
      has_qualification: boolean;
      definition: string;
      function_schema: string;
      function_name: string;
    }>(
      `SELECT t.tgname AS trigger_name,
              t.tgenabled AS enabled,
              t.tgisinternal AS internal,
              (t.tgtype & 1) = 1 AS row_level,
              t.tgqual IS NOT NULL AS has_qualification,
              pg_get_triggerdef(t.oid) AS definition,
              pn.nspname AS function_schema,
              p.proname AS function_name
       FROM pg_trigger t
       JOIN pg_class c ON c.oid=t.tgrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       JOIN pg_proc p ON p.oid=t.tgfoid
       JOIN pg_namespace pn ON pn.oid=p.pronamespace
       WHERE n.nspname='public' AND c.relname='events'
         AND t.tgname IN (
           'events_order_station_corrected_v1_update_immutable',
           'events_order_station_corrected_v1_delete_immutable'
         )
       ORDER BY t.tgname`,
    );
    expect(correctionTriggers.rows).toHaveLength(2);
    expect(correctionTriggers.rows.every((trigger) => (
      trigger.enabled === "O"
      && trigger.internal === false
      && trigger.row_level === true
      && trigger.has_qualification === true
      && trigger.function_schema === "public"
      && trigger.function_name === "prevent_audit_mutation"
    ))).toBe(true);

    // No redundant per-type TRUNCATE trigger: the existing statement-level
    // guard on public.events already covers TRUNCATE fail-closed.
    const correctionTruncateTrigger = await pool.query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='events'
         AND t.tgname='events_order_station_corrected_v1_truncate_immutable'`,
    );
    expect(correctionTruncateTrigger.rows[0]?.count).toBe(0);

    const indexDefs = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname='public' AND tablename='events'
         AND indexname IN ('events_order_station_aggregate_version_uidx', 'events_order_station_correlation_uidx')
       ORDER BY indexname`,
    );
    expect(indexDefs.rows).toHaveLength(2);
    for (const row of indexDefs.rows) {
      expect(row.indexdef).toContain("ORDER_STATION_MOVED_V1");
      expect(row.indexdef).toContain("ORDER_STATION_CORRECTED_V1");
    }

    const correctionView = await pool.query<{ relname: string; reloptions: string[]; public_select: boolean }>(
      `SELECT c.relname, c.reloptions,
              EXISTS (
                SELECT 1
                FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) privilege
                WHERE privilege.grantee=0 AND privilege.privilege_type='SELECT'
              ) AS public_select
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='private' AND c.relname='v_order_station_correction_receipts_v1'`,
    );
    expect(correctionView.rows).toHaveLength(1);
    expect(correctionView.rows[0]?.reloptions).toContain("security_invoker=true");
    expect(correctionView.rows[0]?.public_select).toBe(false);
  });

  it("D-F12-004: runs an isolated forward/correction cycle with DB and read-port readback, replay, cross-intent CONFLICT, tenant/role guard, and immutability", async () => {
    const W4C_CUSTOMER = "w4c-local-customer-cycle";
    const W4C_ORDER = "w4c-local-order-cycle";
    const W4C_ITEM = "w4c-local-item-cycle";
    const W4C_EVENTS = {
      forward1: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
      correction1: "dddddddd-dddd-4ddd-8ddd-ddddddddddd2",
      forward2: "dddddddd-dddd-4ddd-8ddd-ddddddddddd3",
      correction2: "dddddddd-dddd-4ddd-8ddd-ddddddddddd4",
    } as const;
    const REASON_1 = "  Falsche Station im isolierten Testzyklus versehentlich gewählt  ";
    const TRIMMED_REASON_1 = REASON_1.trim();
    const REASON_2 = "Zweite Rücknahme im isolierten Testzyklus";

    await pool.query(
      `INSERT INTO public.customers (id, tenant_id, customer_number, name, type, source)
       VALUES ($1, $2, 'W4C-A', 'W4C Kunde', 'business', 'manual')`,
      [W4C_CUSTOMER, TENANT_A],
    );
    await pool.query(
      `INSERT INTO public.orders
         (id, tenant_id, order_number, customer_id, title, task, station,
          current_station, current_station_id, status, version, source, intake_date, due_date)
       VALUES ($1, $2, 'W4C-LOCAL-1', $3, 'W4C Zyklus', 'W4C fixture', 'wareneingang',
               'wareneingang', 'wareneingang', 'angenommen', 1, 'manual',
               '2026-08-17T08:00:00Z', '2026-08-27T08:00:00Z')`,
      [W4C_ORDER, TENANT_A, W4C_CUSTOMER],
    );
    await pool.query(
      `INSERT INTO public.items
         (id, tenant_id, order_id, customer_id, name, quantity, current_station_id)
       VALUES ($1, $2, $3, $4, 'W4C Teil', 1, 'wareneingang')`,
      [W4C_ITEM, TENANT_A, W4C_ORDER, W4C_CUSTOMER],
    );

    setSession(USERS.werkstatt, "werkstatt");

    // V1 -> V2: forward transition.
    const forward1 = await transitionWareneingangToGalvanik({
      orderId: W4C_ORDER,
      expectedVersion: 1,
      clientEventId: W4C_EVENTS.forward1,
    });
    expect(forward1).toMatchObject({ code: "OK", replayed: false, receipt: { aggregateVersion: 2 } });
    if (forward1.code !== "OK") throw new Error("W4C_EXPECTED_FORWARD1_OK");

    // V2 -> V3: correction with a mandatory, trimmed reason.
    const correction1 = await correctGalvanikToWareneingang({
      orderId: W4C_ORDER,
      expectedVersion: 2,
      clientEventId: W4C_EVENTS.correction1,
      reason: REASON_1,
    });
    expect(correction1).toMatchObject({
      code: "OK",
      replayed: false,
      receipt: {
        orderId: W4C_ORDER,
        aggregateVersion: 3,
        fromStation: "galvanik",
        toStation: "wareneingang",
        actorId: USERS.werkstatt,
        reason: TRIMMED_REASON_1,
      },
    });
    if (correction1.code !== "OK") throw new Error("W4C_EXPECTED_CORRECTION1_OK");

    const afterCorrection1 = await aggregateSnapshot(W4C_ORDER);
    expect(afterCorrection1.order).toEqual([
      expect.objectContaining({
        station: "wareneingang",
        current_station: "wareneingang",
        current_station_id: "wareneingang",
        status: "angenommen",
        version: 3,
      }),
    ]);
    expect(afterCorrection1.items.every((item) => item.current_station_id === "wareneingang")).toBe(true);

    const correctionRow = await pool.query<{
      id: string; tenant_id: string; order_id: string; item_id: string | null; event_type: string;
      description: string; status: string; user_id: string; station: string; client_event_id: string;
      event_schema_version: number; correlation_id: string; aggregate_version: number; from_station: string;
    }>(
      `SELECT id, tenant_id, order_id, item_id, event_type, description, status, user_id, station,
              client_event_id, event_schema_version, correlation_id, aggregate_version, from_station
       FROM public.events WHERE id=$1`,
      [correction1.receipt.eventId],
    );
    expect(correctionRow.rows).toEqual([{
      id: correction1.receipt.eventId,
      tenant_id: TENANT_A,
      order_id: W4C_ORDER,
      item_id: null,
      event_type: "ORDER_STATION_CORRECTED_V1",
      description: TRIMMED_REASON_1,
      status: "success",
      user_id: USERS.werkstatt,
      station: "wareneingang",
      client_event_id: W4C_EVENTS.correction1,
      event_schema_version: 1,
      correlation_id: correction1.receipt.correlationId,
      aggregate_version: 3,
      from_station: "galvanik",
    }]);

    // Full DB row and the new tenant-bound read port must agree exactly.
    const correctionReadPort = await readTenantOrderStationCorrectionReceipt(
      { tenantId: TENANT_A },
      { orderId: W4C_ORDER, clientEventId: W4C_EVENTS.correction1 },
    );
    expect(correctionReadPort).toEqual(correction1.receipt);
    await expect(
      readTenantOrderStationCorrectionReceipt(
        { tenantId: TENANT_B },
        { orderId: W4C_ORDER, clientEventId: W4C_EVENTS.correction1 },
      ),
    ).resolves.toBeNull();

    // Identical retry replays the same receipt without a second event.
    await expect(
      correctGalvanikToWareneingang({
        orderId: W4C_ORDER,
        expectedVersion: 2,
        clientEventId: W4C_EVENTS.correction1,
        reason: REASON_1,
      }),
    ).resolves.toEqual({ code: "OK", receipt: correction1.receipt, replayed: true });
    const correctedCountAfterReplay = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM public.events WHERE order_id=$1 AND event_type='ORDER_STATION_CORRECTED_V1'",
      [W4C_ORDER],
    );
    expect(correctedCountAfterReplay.rows[0]?.count).toBe(1);

    // Reusing the same clientEventId for a different intent is a clean
    // CONFLICT; the snapshot stays exactly as it was.
    const beforeConflict = await aggregateSnapshot(W4C_ORDER);
    await expect(
      correctGalvanikToWareneingang({
        orderId: W4C_ORDER,
        expectedVersion: 2,
        clientEventId: W4C_EVENTS.correction1,
        reason: "Eine völlig andere Begründung als zuvor",
      }),
    ).resolves.toEqual({ code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." });
    expect(await aggregateSnapshot(W4C_ORDER)).toEqual(beforeConflict);

    // V3 -> V4 -> V5: a second full forward/correction round on the same order.
    const forward2 = await transitionWareneingangToGalvanik({
      orderId: W4C_ORDER,
      expectedVersion: 3,
      clientEventId: W4C_EVENTS.forward2,
    });
    expect(forward2).toMatchObject({ code: "OK", replayed: false, receipt: { aggregateVersion: 4 } });

    const correction2 = await correctGalvanikToWareneingang({
      orderId: W4C_ORDER,
      expectedVersion: 4,
      clientEventId: W4C_EVENTS.correction2,
      reason: REASON_2,
    });
    expect(correction2).toMatchObject({
      code: "OK",
      replayed: false,
      receipt: { orderId: W4C_ORDER, aggregateVersion: 5, reason: REASON_2 },
    });
    if (correction2.code !== "OK") throw new Error("W4C_EXPECTED_CORRECTION2_OK");
    const correctionReadPort2 = await readTenantOrderStationCorrectionReceipt(
      { tenantId: TENANT_A },
      { orderId: W4C_ORDER, clientEventId: W4C_EVENTS.correction2 },
    );
    expect(correctionReadPort2).toEqual(correction2.receipt);
    const finalSnapshot = await aggregateSnapshot(W4C_ORDER);
    expect(finalSnapshot.order).toEqual([
      expect.objectContaining({ station: "wareneingang", status: "angenommen", version: 5 }),
    ]);
    expect(finalSnapshot.events.filter((event) => event.event_type === "ORDER_STATION_CORRECTED_V1")).toHaveLength(2);
    expect(finalSnapshot.events.filter((event) => event.event_type === "ORDER_STATION_MOVED_V1")).toHaveLength(2);

    // readonly is rejected by the role gate before any write.
    setSession(USERS.readonly, "readonly");
    const beforeReadonly = await aggregateSnapshot(W4C_ORDER);
    await expect(
      correctGalvanikToWareneingang({
        orderId: W4C_ORDER,
        expectedVersion: 5,
        clientEventId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd5",
        reason: "Sollte niemals geschrieben werden",
      }),
    ).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(await aggregateSnapshot(W4C_ORDER)).toEqual(beforeReadonly);

    // A foreign-tenant session is rejected as an invalid app session before order lookup.
    // The resolver checks sessionTenantId and rejects non-galvanik-kreile sessions as UNAUTHENTICATED.
    setSession(USERS.werkstattB, "werkstatt", TENANT_B);
    const beforeForeign = await aggregateSnapshot(W4C_ORDER);
    await expect(
      correctGalvanikToWareneingang({
        orderId: W4C_ORDER,
        expectedVersion: 5,
        clientEventId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd6",
        reason: "Sollte niemals geschrieben werden",
      }),
    ).resolves.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(await aggregateSnapshot(W4C_ORDER)).toEqual(beforeForeign);

    // Direct UPDATE, type-flip, and DELETE attempts on the CORRECTED event
    // are all blocked by the immutability triggers (P0001).
    const receiptBeforeMutationAttempts = await aggregateSnapshot(W4C_ORDER);
    await expect(
      pool.query("UPDATE public.events SET description='changed' WHERE id=$1", [correction1.receipt.eventId]),
    ).rejects.toMatchObject({ code: "P0001" });
    await expect(
      pool.query("UPDATE public.events SET event_type='W3_BASELINE' WHERE id=$1", [correction1.receipt.eventId]),
    ).rejects.toMatchObject({ code: "P0001" });
    await expect(
      pool.query("UPDATE public.events SET event_type='ORDER_STATION_CORRECTED_V1' WHERE id=$1", [forward1.receipt.eventId]),
    ).rejects.toMatchObject({ code: "P0001" });
    await expect(
      pool.query("DELETE FROM public.events WHERE id=$1", [correction1.receipt.eventId]),
    ).rejects.toMatchObject({ code: "P0001" });
    expect(await aggregateSnapshot(W4C_ORDER)).toEqual(receiptBeforeMutationAttempts);

    // Invalid direct CORRECTED inserts are rejected by the CHECK contract.
    const validCorrectedControl = {
      tenantId: TENANT_A as string | null,
      orderId: W4C_ORDER as string | null,
      itemId: null as string | null,
      userId: USERS.werkstatt as string | null,
      clientEventId: "70000000-0000-4000-8000-000000000001" as string | null,
      eventSchemaVersion: 1 as number | null,
      correlationId: "80000000-0000-4000-8000-000000000001" as string | null,
      aggregateVersion: 900 as number | null,
      fromStation: "galvanik" as string | null,
      station: "wareneingang" as string | null,
      status: "success" as string | null,
      description: "Gültige Kontrollbegründung" as string | null,
    };
    const invalidCorrectedContracts = [
      ["tenant_id", { ...validCorrectedControl, tenantId: null }],
      ["order_id", { ...validCorrectedControl, orderId: null }],
      ["item_id", { ...validCorrectedControl, itemId: W4C_ITEM }],
      ["user_id", { ...validCorrectedControl, userId: null }],
      ["client_event_id", { ...validCorrectedControl, clientEventId: null }],
      ["event_schema_version", { ...validCorrectedControl, eventSchemaVersion: null }],
      ["correlation_id", { ...validCorrectedControl, correlationId: null }],
      ["aggregate_version", { ...validCorrectedControl, aggregateVersion: null }],
      ["from_station", { ...validCorrectedControl, fromStation: "wareneingang" }],
      ["station", { ...validCorrectedControl, station: "galvanik" }],
      ["status", { ...validCorrectedControl, status: null }],
      ["description_null", { ...validCorrectedControl, description: null }],
      ["description_short", { ...validCorrectedControl, description: "kurz" }],
      ["description_untrimmed", { ...validCorrectedControl, description: " Begründung mit Leerzeichen " }],
    ] as const;
    for (const [field, contract] of invalidCorrectedContracts) {
      const eventId = `w4c-local-contract-invalid-${field}`;
      await expect(
        fixtureSql.begin(async (tx) => {
          await tx.unsafe(
            `INSERT INTO public.events (
               id, tenant_id, order_id, item_id, event_type, description, status, user_id, station,
               client_event_id, event_schema_version, correlation_id, aggregate_version, from_station
             ) VALUES ($1, $2, $3, $4, 'ORDER_STATION_CORRECTED_V1', $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              eventId,
              contract.tenantId,
              contract.orderId,
              contract.itemId,
              contract.description,
              contract.status,
              contract.userId,
              contract.station,
              contract.clientEventId,
              contract.eventSchemaVersion,
              contract.correlationId,
              contract.aggregateVersion,
              contract.fromStation,
            ],
          );
          throw new Error("W4C_EXPECTED_CHECK_FAILURE");
        }),
      ).rejects.toMatchObject({ code: "23514" });
      const absent = await pool.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM public.events WHERE id=$1",
        [eventId],
      );
      expect(absent.rows[0]?.count).toBe(0);
    }

    // Duplicate aggregate_version or correlation_id across the forward and
    // correction event types are rejected by the widened unique indexes.
    await expect(
      fixtureSql.begin(async (tx) => {
        await tx.unsafe(
          `INSERT INTO public.events (
             id, tenant_id, order_id, item_id, event_type, description, status, user_id, station,
             client_event_id, event_schema_version, correlation_id, aggregate_version, from_station
           ) VALUES (
             'w4c-local-duplicate-aggregate-version', $1, $2, NULL, 'ORDER_STATION_CORRECTED_V1',
             'Duplikat Aggregate-Version', 'success', $3, 'wareneingang',
             '90000000-0000-4000-8000-000000000001', 1, '90000000-0000-4000-8000-000000000002',
             2, 'galvanik'
           )`,
          [TENANT_A, W4C_ORDER, USERS.werkstatt],
        );
        throw new Error("W4C_EXPECTED_UNIQUE_AGGREGATE_VERSION_FAILURE");
      }),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      fixtureSql.begin(async (tx) => {
        await tx.unsafe(
          `INSERT INTO public.events (
             id, tenant_id, order_id, item_id, event_type, description, status, user_id, station,
             client_event_id, event_schema_version, correlation_id, aggregate_version, from_station
           ) VALUES (
             'w4c-local-duplicate-correlation', $1, $2, NULL, 'ORDER_STATION_CORRECTED_V1',
             'Duplikat Correlation', 'success', $3, 'wareneingang',
             '90000000-0000-4000-8000-000000000003', 1, $4,
             901, 'galvanik'
           )`,
          [TENANT_A, W4C_ORDER, USERS.werkstatt, forward1.receipt.correlationId],
        );
        throw new Error("W4C_EXPECTED_UNIQUE_CORRELATION_FAILURE");
      }),
    ).rejects.toMatchObject({ code: "23505" });
    const duplicateAttempts = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM public.events WHERE id IN ('w4c-local-duplicate-aggregate-version', 'w4c-local-duplicate-correlation')",
    );
    expect(duplicateAttempts.rows[0]?.count).toBe(0);

    expect(await aggregateSnapshot(W4C_ORDER)).toEqual(finalSnapshot);
  });
});
