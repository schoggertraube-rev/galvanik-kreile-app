import postgres from "postgres";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

if (
  process.env.DATABASE_URL !== LOCAL_DATABASE_URL ||
  process.env.W3_LOCAL_DATABASE_URL !== LOCAL_DATABASE_URL
) {
  throw new Error(
    "W3_LOCAL_DATABASE_REQUIRED: DATABASE_URL and W3_LOCAL_DATABASE_URL must both target 127.0.0.1:54322/postgres",
  );
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("W3_LOCAL_DATABASE_REQUIRED: SUPABASE_SERVICE_ROLE_KEY must be unset");
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
} as const;

const CUSTOMERS = {
  a: "w3-local-customer-a",
  b: "w3-local-customer-b",
} as const;

const ORDERS = {
  visible: "w3-local-order-visible",
  happy: "w3-local-order-happy",
  concurrent: "w3-local-order-concurrent",
  rollback: "w3-local-order-rollback",
  foreign: "w3-local-order-foreign",
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
let readTenantStationOrders: typeof import("@/lib/server/orderStationRead").readTenantStationOrders;
let withPrivilegedTenantTransaction: typeof import("@/lib/server/privilegedDb").withPrivilegedTenantTransaction;
let getWareneingangOrdersAction: typeof import("@/app/warendurchlauf/actions").getWareneingangOrdersAction;

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
       ($1, $4, 'w3-readonly@local.invalid', 'W3 Readonly', 'readonly', true, '2026-01-01', '2026-01-01'),
       ($2, $4, 'w3-buero@local.invalid', 'W3 Buero', 'buero', true, '2026-01-01', '2026-01-01'),
       ($3, $4, 'w3-werkstatt@local.invalid', 'W3 Werkstatt', 'werkstatt', true, '2026-01-01', '2026-01-01')`,
    [USERS.readonly, USERS.buero, USERS.werkstatt, TENANT_A],
  );

  await pool.query(
    `INSERT INTO public.customers (id, tenant_id, customer_number, name, type, source)
     VALUES
       ($1, $3, 'W3-A', 'W3 Kunde A', 'business', 'manual'),
       ($2, $4, 'W3-B', 'W3 Kunde B', 'business', 'manual')`,
    [CUSTOMERS.a, CUSTOMERS.b, TENANT_A, TENANT_B],
  );

  const orderRows = [
    [ORDERS.visible, TENANT_A, "W3-LOCAL-1001", CUSTOMERS.a, "W3 Visible"],
    [ORDERS.happy, TENANT_A, "W3-LOCAL-1002", CUSTOMERS.a, "W3 Happy"],
    [ORDERS.concurrent, TENANT_A, "W3-LOCAL-1003", CUSTOMERS.a, "W3 Concurrent"],
    [ORDERS.rollback, TENANT_A, "W3-LOCAL-1004", CUSTOMERS.a, "W3 Rollback"],
    [ORDERS.foreign, TENANT_B, "W3-LOCAL-2001", CUSTOMERS.b, "W3 Foreign"],
  ];
  for (const row of orderRows) {
    await pool.query(
      `INSERT INTO public.orders
         (id, tenant_id, order_number, customer_id, title, task, station,
          current_station, current_station_id, status, version, source, intake_date, due_date)
       VALUES ($1, $2, $3, $4, $5, 'W3 fixture', 'wareneingang',
               'wareneingang', 'wareneingang', 'in_progress', 1, 'manual',
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
      `SELECT id, tenant_id, station, current_station, current_station_id, status, version
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

  ({ transitionWareneingangToGalvanik } = await import("@/lib/server/commands/orderStationCommand"));
  ({ readTenantStationOrders } = await import("@/lib/server/orderStationRead"));
  ({ withPrivilegedTenantTransaction } = await import("@/lib/server/privilegedDb"));
  ({ getWareneingangOrdersAction } = await import("@/app/warendurchlauf/actions"));
});

beforeEach(async () => {
  vi.clearAllMocks();
  await seedFixtures();
});

afterAll(async () => {
  await clearFixtures();
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
    ]);

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

  it("uses the real resolver for readonly and buero reads while denying commands before writes", async () => {
    for (const [role, userId] of [
      ["readonly", USERS.readonly],
      ["buero", USERS.buero],
    ] as const) {
      setSession(userId, role);
      const before = await aggregateSnapshot(ORDERS.visible);
      const read = await getWareneingangOrdersAction();
      expect(read.ok).toBe(true);
      if (read.ok) {
        const ids = read.data.map((order) => order.id);
        expect(ids).toContain(ORDERS.visible);
        expect(ids).not.toContain(ORDERS.foreign);
      }
      await expect(
        transitionWareneingangToGalvanik({ orderId: ORDERS.visible, expectedVersion: 1 }),
      ).resolves.toMatchObject({ code: "FORBIDDEN" });
      expect(await aggregateSnapshot(ORDERS.visible)).toEqual(before);
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
        new Set([ORDERS.visible, ORDERS.happy, ORDERS.concurrent, ORDERS.rollback]),
      );
      expect(result.data.flatMap((order) => order.parts.map((item) => item.id))).not.toContain(
        "w3-local-item-5",
      );
    }

    setSession(USERS.werkstatt, "werkstatt");
    const foreignBefore = await aggregateSnapshot(ORDERS.foreign);
    await expect(
      transitionWareneingangToGalvanik({ orderId: ORDERS.foreign, expectedVersion: 1 }),
    ).resolves.toMatchObject({ code: "NOT_FOUND" });
    expect(await aggregateSnapshot(ORDERS.foreign)).toEqual(foreignBefore);
  });

  it("rejects foreign and null tenant children and corrupt customer ownership without partial reads or writes", async () => {
    setSession(USERS.werkstatt, "werkstatt");

    for (const [itemId, tenantId] of [
      ["w3-local-item-foreign-child", TENANT_B],
      ["w3-local-item-null-child", null],
    ] as const) {
      await pool.query(
        `INSERT INTO public.items
           (id, tenant_id, order_id, customer_id, name, current_station_id)
         VALUES ($1, $2, $3, $4, 'Corrupt child', 'wareneingang')`,
        [itemId, tenantId, ORDERS.visible, tenantId === TENANT_B ? CUSTOMERS.b : CUSTOMERS.a],
      );
      const before = await aggregateSnapshot(ORDERS.visible);
      await expect(
        transitionWareneingangToGalvanik({ orderId: ORDERS.visible, expectedVersion: 1 }),
      ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
      expect(await aggregateSnapshot(ORDERS.visible)).toEqual(before);
      await expect(
        readTenantStationOrders({ tenantId: TENANT_A }, "wareneingang"),
      ).rejects.toThrow("ORDER_ITEM_OWNERSHIP_INVALID");
      await pool.query("DELETE FROM public.items WHERE id=$1", [itemId]);
    }

    await pool.query("UPDATE public.orders SET customer_id=$1 WHERE id=$2", [
      CUSTOMERS.b,
      ORDERS.visible,
    ]);
    await expect(
      readTenantStationOrders({ tenantId: TENANT_A }, "wareneingang"),
    ).rejects.toThrow("ORDER_OWNERSHIP_INVALID");
  });

  it("commits the complete aggregate once, reads it back fresh, and rejects a stale retry", async () => {
    setSession(USERS.werkstatt, "werkstatt");
    const beforeEvents = await pool.query(
      "SELECT id, tenant_id, order_id, event_type, status, station FROM public.events WHERE order_id=$1 ORDER BY id",
      [ORDERS.happy],
    );
    const beforeRead = await readTenantStationOrders({ tenantId: TENANT_A }, "wareneingang");
    expect(beforeRead.map((order) => order.id)).toContain(ORDERS.happy);

    await expect(
      transitionWareneingangToGalvanik({ orderId: ORDERS.happy, expectedVersion: 1 }),
    ).resolves.toEqual({ code: "OK", orderId: ORDERS.happy, version: 2 });

    const committed = await aggregateSnapshot(ORDERS.happy);
    expect(committed.order).toEqual([
      expect.objectContaining({
        station: "galvanik",
        current_station: "galvanik",
        current_station_id: "galvanik",
        status: "ready",
        version: 2,
      }),
    ]);
    expect(committed.items.every((item) => item.current_station_id === "galvanik")).toBe(true);
    expect(committed.events).toEqual(beforeEvents.rows);

    const [wareneingang, galvanik] = await Promise.all([
      readTenantStationOrders({ tenantId: TENANT_A }, "wareneingang"),
      readTenantStationOrders({ tenantId: TENANT_A }, "galvanik"),
    ]);
    expect(wareneingang.map((order) => order.id)).not.toContain(ORDERS.happy);
    expect(galvanik).toContainEqual(
      expect.objectContaining({ id: ORDERS.happy, status: "ready", version: 2 }),
    );

    const stateBeforeStale = await aggregateSnapshot(ORDERS.happy);
    await expect(
      transitionWareneingangToGalvanik({ orderId: ORDERS.happy, expectedVersion: 1 }),
    ).resolves.toMatchObject({ code: "CONFLICT" });
    expect(await aggregateSnapshot(ORDERS.happy)).toEqual(stateBeforeStale);
  });

  it("serializes two version-one commands into exactly one OK and one CONFLICT", async () => {
    setSession(USERS.werkstatt, "werkstatt");
    const results = await Promise.all([
      transitionWareneingangToGalvanik({ orderId: ORDERS.concurrent, expectedVersion: 1 }),
      transitionWareneingangToGalvanik({ orderId: ORDERS.concurrent, expectedVersion: 1 }),
    ]);
    expect(results.map((result) => result.code).sort()).toEqual(["CONFLICT", "OK"]);
    const finalState = await aggregateSnapshot(ORDERS.concurrent);
    expect(finalState.order[0]).toMatchObject({
      station: "galvanik",
      current_station: "galvanik",
      current_station_id: "galvanik",
      version: 2,
    });
    expect(finalState.items.every((item) => item.current_station_id === "galvanik")).toBe(true);
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
});
