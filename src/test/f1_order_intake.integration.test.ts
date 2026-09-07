import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";

const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const TENANT_A = KREILE_TENANT_SLUG;
const RUN_SUFFIX = randomUUID().slice(0, 8);

if (process.env.NODE_ENV !== "test" || process.env.DATABASE_URL !== LOCAL_DATABASE_URL) {
  throw new Error(
    "F1_ORDER_INTAKE_LOCAL_REQUIRED: NODE_ENV=test, DATABASE_URL must equal local loopback postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  );
}
if (
  process.env.NEXT_PUBLIC_SUPABASE_URL !== LOCAL_SUPABASE_URL
  || process.env.SUPABASE_URL !== LOCAL_SUPABASE_URL
) {
  throw new Error("F1_ORDER_INTAKE_LOCAL_REQUIRED: Supabase URLs must be local 127.0.0.1:54321");
}
if (
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || !process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error("F1_ORDER_INTAKE_LOCAL_REQUIRED: distinct anon and service-role keys required");
}

// readAppSession is replaced by a spy: supplemental server integration test, NOT true Auth/browser E2E.
// Session cookies, real Supabase Auth and JWTs are not exercised here.
const readAppSessionSpy = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/appSession", () => ({ readAppSession: readAppSessionSpy }));
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const USERS = {
  buero: randomUUID(),
  readonly: randomUUID(),
} as const;

const CUSTOMER_PREFIX = `f1-intake-customer-${RUN_SUFFIX}`;

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
};

let actions: typeof import("@/app/warendurchlauf/actions");

function setSession(userId: string, role: string, tenantId = TENANT_A) {
  readAppSessionSpy.mockResolvedValue({
    ok: true,
    session: {
      userId,
      tenantId,
      role: role as AppRole,
      displayName: role,
      issuedAt: 4_102_444_800_000,
      expiresAt: 4_102_488_000_000,
    },
  });
}

type AppRole = "developer" | "admin" | "meister" | "buero" | "werkstatt" | "readonly";

async function seedFixtures() {
  // Seed buero user (Kreile tenant, has perm_data_orders + perm_data_customers)
  await pool.query(
    `INSERT INTO public.app_users
       (id, tenant_id, email, full_name, role, active, created_at, updated_at)
     VALUES
       ($1, $2, $3, 'Büro User', 'buero', true, '2026-01-01', '2026-01-01')`,
    [USERS.buero, TENANT_A, `buero-${RUN_SUFFIX}@test.local`],
  );

  // Seed readonly user (Kreile tenant, read-only permissions)
  await pool.query(
    `INSERT INTO public.app_users
       (id, tenant_id, email, full_name, role, active, created_at, updated_at)
     VALUES
       ($1, $2, $3, 'Readonly User', 'readonly', true, '2026-01-01', '2026-01-01')`,
    [USERS.readonly, TENANT_A, `readonly-${RUN_SUFFIX}@test.local`],
  );
  // Foreign-tenant user is NOT seeded: authorization.ts rejects tenantId !== KREILE_TENANT_SLUG
  // before any DB access, so no app_users row is required for the invalid-tenant isolation test.
}

beforeAll(async () => {
  // Verify PG17 exactly: >=170000 and <180000; advisory locks and hash functions required
  const version = await pool.query<{ server_version_num: number }>(
    "SELECT setting::int as server_version_num FROM pg_settings WHERE name = 'server_version_num'",
  );
  const versionNum = version.rows[0]?.server_version_num;
  if (!versionNum || versionNum < 170000 || versionNum >= 180000) {
    throw new Error(
      `F1_ORDER_INTAKE_PG17_REQUIRED: got ${versionNum}, need >=170000 and <180000 (PG17 exactly)`,
    );
  }

  actions = await import("@/app/warendurchlauf/actions");
  await seedFixtures();
}, 30_000);

afterAll(async () => {
  await fixtureSql.end();
});

beforeEach(() => {
  setSession(USERS.buero, "buero", TENANT_A);
});

describe("F1.1: Digital Order Intake", () => {
  it("should create new customer + 2 items with unique order number", async () => {
    const clientEventId = randomUUID();
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const result = await actions.createOrderIntakeAction({
      clientEventId,
      customer: {
        mode: "NEW",
        name: `${CUSTOMER_PREFIX}-customer-new`,
        customerType: "business",
        companyName: `${CUSTOMER_PREFIX} GmbH`,
        contactPerson: "Max Meister",
        email: `max-${RUN_SUFFIX}@example.local`,
        phone: "+49 123 456789",
        city: "Berlin",
      },
      dueDate,
      note: "Eilauftrag",
      items: [
        {
          name: "Stahlblech 10mm",
          quantity: 5,
          material: "Stahl",
          surfaceRequested: "Galvanisieren",
        },
        {
          name: "Aluminiumprofile",
          quantity: 20,
          material: "Aluminium",
          surfaceRequested: "Polieren",
        },
      ],
    });

    expect(result.code).toBe("OK");
    if (result.code === "OK") {
      expect(result.replayed).toBe(false);
      const receipt = result.receipt;
      expect(receipt.orderNumber).toMatch(/^A-\d{4}-\d{4,}$/);
      expect(receipt.customerId).toBeTruthy();
      expect(receipt.orderId).toBeTruthy();
      expect(receipt.items).toHaveLength(2);
      expect(receipt.items[0]).toMatchObject({
        name: "Stahlblech 10mm",
        quantity: 5,
        material: "Stahl",
        surfaceRequested: "Galvanisieren",
        position: 1,
      });
      expect(receipt.items[1]).toMatchObject({
        name: "Aluminiumprofile",
        quantity: 20,
        material: "Aluminium",
        surfaceRequested: "Polieren",
        position: 2,
      });
    }
  });

  it("should replay lost response: NEW customer + 2 items, retry exact clientEventId", async () => {
    const clientEventId = randomUUID();
    const replayCustomerName = `${CUSTOMER_PREFIX}-replay-${RUN_SUFFIX}`;
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const input = {
      clientEventId,
      customer: {
        mode: "NEW" as const,
        name: replayCustomerName,
        customerType: "privat" as const,
        companyName: null,
        contactPerson: null,
        email: null,
        phone: null,
        city: null,
      },
      dueDate,
      note: null,
      items: [
        {
          name: "Testteile A",
          quantity: 3,
          material: null,
          surfaceRequested: "Galvanisieren",
        },
        {
          name: "Testteile B",
          quantity: 5,
          material: null,
          surfaceRequested: "Polieren",
        },
      ],
    };

    const firstResult = await actions.createOrderIntakeAction(input);
    expect(firstResult.code).toBe("OK");
    if (firstResult.code !== "OK") throw new Error("First create failed");
    expect(firstResult.replayed).toBe(false);

    const firstReceipt = firstResult.receipt;
    const orderId = firstReceipt.orderId;
    expect(firstReceipt.items).toHaveLength(2);

    const secondResult = await actions.createOrderIntakeAction(input);
    expect(secondResult.code).toBe("OK");
    if (secondResult.code !== "OK") throw new Error("Second call (replay) failed");
    expect(secondResult.replayed).toBe(true);

    const secondReceipt = secondResult.receipt;
    expect(secondReceipt).toEqual(firstReceipt);

    // Verify exact counts — exactly 1 customer, 1 order, 1 event, 1 receipt
    const customerRows = await pool.query<{ id: string }>(
      `SELECT id FROM public.customers WHERE name = $1 AND tenant_id = $2`,
      [replayCustomerName, TENANT_A],
    );
    expect(customerRows.rows).toHaveLength(1);
    expect(customerRows.rows[0]?.id).toBe(firstReceipt.customerId);

    const orderRows = await pool.query<{ id: string }>(
      `SELECT id FROM public.orders WHERE id = $1 AND tenant_id = $2`,
      [orderId, TENANT_A],
    );
    expect(orderRows.rows).toHaveLength(1);

    const eventRows = await pool.query<{ id: string }>(
      `SELECT id FROM public.events WHERE order_id = $1 AND event_type = 'ORDER_INTAKE_CREATED_V1'`,
      [orderId],
    );
    expect(eventRows.rows).toHaveLength(1);
    expect(eventRows.rows[0]?.id).toBe(firstReceipt.eventId);

    const receiptRows = await pool.query<{ id: string }>(
      `SELECT id FROM private.order_intake_receipts WHERE order_id = $1`,
      [orderId],
    );
    expect(receiptRows.rows).toHaveLength(1);
    expect(receiptRows.rows[0]?.id).toBe(firstReceipt.receiptId);

    // Bind item ids to receipt items via sorted-set comparison.
    // public.items has no position column; sorting by id gives a deterministic stable set.
    const itemRows = await pool.query<{ id: string }>(
      `SELECT id FROM public.items WHERE order_id = $1`,
      [orderId],
    );
    expect(itemRows.rows).toHaveLength(2);
    const dbItemIdsSorted = itemRows.rows.map((r) => r.id).sort();
    const receiptItemIdsSorted = firstReceipt.items.map((item) => item.id).sort();
    expect(dbItemIdsSorted).toEqual(receiptItemIdsSorted);
  });

  it("should query exactly 1 customer, 1 order, 1 create event, 1 receipt, 2 items by orderId", async () => {
    const clientEventId = randomUUID();
    const customerName = `${CUSTOMER_PREFIX}-query-${RUN_SUFFIX}`;
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const result = await actions.createOrderIntakeAction({
      clientEventId,
      customer: {
        mode: "NEW" as const,
        name: customerName,
        customerType: "business" as const,
        companyName: null,
        contactPerson: null,
        email: null,
        phone: null,
        city: null,
      },
      dueDate,
      note: null,
      items: [
        { name: "Query Item 1", quantity: 1, material: null, surfaceRequested: "Galvanisieren" },
        { name: "Query Item 2", quantity: 2, material: null, surfaceRequested: "Polieren" },
      ],
    });

    expect(result.code).toBe("OK");
    if (result.code !== "OK") throw new Error("Creation failed");

    const receipt = result.receipt;
    const orderId = receipt.orderId;
    expect(receipt.items).toHaveLength(2);

    const customers = await pool.query<{ id: string; name: string; tenant_id: string }>(
      `SELECT id, name, tenant_id FROM public.customers WHERE name = $1 AND tenant_id = $2`,
      [customerName, TENANT_A],
    );
    expect(customers.rows).toHaveLength(1);
    expect(customers.rows[0]?.id).toBe(receipt.customerId);

    const orders = await pool.query<{ id: string; customer_id: string; tenant_id: string }>(
      `SELECT id, customer_id, tenant_id FROM public.orders WHERE id = $1 AND tenant_id = $2`,
      [orderId, TENANT_A],
    );
    expect(orders.rows).toHaveLength(1);

    const events = await pool.query<{ id: string; order_id: string; event_type: string }>(
      `SELECT id, order_id, event_type FROM public.events
       WHERE order_id = $1 AND event_type = 'ORDER_INTAKE_CREATED_V1'`,
      [orderId],
    );
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0]?.id).toBe(receipt.eventId);

    const receipts = await pool.query<{ id: string }>(
      `SELECT id FROM private.order_intake_receipts WHERE order_id = $1`,
      [orderId],
    );
    expect(receipts.rows).toHaveLength(1);
    expect(receipts.rows[0]?.id).toBe(receipt.receiptId);

    const items = await pool.query<{ id: string; order_id: string }>(
      `SELECT id, order_id FROM public.items WHERE order_id = $1`,
      [orderId],
    );
    expect(items.rows).toHaveLength(2);
  });

  it("should read receipt via production read action with deep equality", async () => {
    const clientEventId = randomUUID();
    const readbackCustomerName = `${CUSTOMER_PREFIX}-readback-${RUN_SUFFIX}`;
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const createResult = await actions.createOrderIntakeAction({
      clientEventId,
      customer: {
        mode: "NEW" as const,
        name: readbackCustomerName,
        customerType: "business" as const,
        companyName: null,
        contactPerson: null,
        email: null,
        phone: null,
        city: null,
      },
      dueDate,
      note: null,
      items: [
        { name: "Readback Test Item", quantity: 1, material: null, surfaceRequested: "Galvanisieren" },
      ],
    });

    expect(createResult.code).toBe("OK");
    if (createResult.code !== "OK") throw new Error("Creation failed");

    const createReceipt = createResult.receipt;
    const orderId = createReceipt.orderId;

    const readResult = await actions.getOrderIntakeReceiptAction({
      orderId,
      clientEventId,
    });

    expect(readResult.ok).toBe(true);
    if (!readResult.ok) throw new Error("Read action failed");

    // Exact full fresh receipt must equal the command receipt
    const readReceipt = readResult.data;
    expect(readReceipt).toEqual(createReceipt);

    // Call getWareneingangOrdersAction and verify exact worklist entry
    const stationOrdersResult = await actions.getWareneingangOrdersAction();
    expect(stationOrdersResult.ok).toBe(true);
    if (!stationOrdersResult.ok) throw new Error("Station orders read failed");

    const stationOrders = stationOrdersResult.data;

    // Filter by orderId — require exactly one matching row; duplicate or missing both fail
    const matchingOrders = stationOrders.filter((o) => o.id === orderId);
    expect(matchingOrders).toHaveLength(1);
    const matchingOrder = matchingOrders[0];
    if (!matchingOrder) throw new Error("Order not found in station list");

    // Bind required worklist scalar fields
    expect(matchingOrder.id).toBe(orderId);
    expect(matchingOrder.orderNumber).toBe(createReceipt.orderNumber);
    expect(matchingOrder.version).toBe(1);
    expect(matchingOrder.customerId).toBe(createReceipt.customerId);
    expect(matchingOrder.customerName).toBe(createReceipt.customerDisplayName);
    // dueDate in OperationalOrder is a full ISO string; compare only the date portion
    expect(matchingOrder.dueDate.slice(0, 10)).toBe(createReceipt.dueDate);
    // OperationalOrder has station and currentStationId, not currentStation
    expect(matchingOrder.station).toBe("wareneingang");
    expect(matchingOrder.currentStationId).toBe("wareneingang");
    expect(matchingOrder.status).toBe("angenommen");

    // Parts: exact length and exact ordered mapping.
    // Sort both sides by id (stable, deterministic); reject missing/extra/duplicate implicitly
    // through exact length check followed by positional equality on the sorted arrays.
    const sortedReceiptItems = [...createReceipt.items].sort((a, b) => a.id.localeCompare(b.id));
    const sortedParts = [...matchingOrder.parts].sort((a, b) => a.id.localeCompare(b.id));
    expect(sortedParts).toHaveLength(sortedReceiptItems.length);
    for (let i = 0; i < sortedReceiptItems.length; i++) {
      const ri = sortedReceiptItems[i]!;
      const part = sortedParts[i]!;
      expect(part.id).toBe(ri.id);
      expect(part.name).toBe(ri.name);
      expect(part.quantity).toBe(ri.quantity);
      expect(part.material).toBe(ri.material);
      expect(part.surfaceRequested).toBe(ri.surfaceRequested);
      expect(part.currentStationId).toBe("wareneingang");
    }
  });

  it("should reject conflict: same clientEventId with different material, no new rows", async () => {
    const clientEventId = randomUUID();
    const conflictCustomerName = `${CUSTOMER_PREFIX}-conflict-${RUN_SUFFIX}`;
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const firstInput = {
      clientEventId,
      customer: {
        mode: "NEW" as const,
        name: conflictCustomerName,
        customerType: "business" as const,
        companyName: null,
        contactPerson: null,
        email: null,
        phone: null,
        city: null,
      },
      dueDate,
      note: null,
      items: [
        { name: "Original Material Steel", quantity: 1, material: "Stahl", surfaceRequested: "Galvanisieren" },
      ],
    };

    const firstResult = await actions.createOrderIntakeAction(firstInput);
    expect(firstResult.code).toBe("OK");
    if (firstResult.code !== "OK") throw new Error("First create failed");

    const firstOrderId = firstResult.receipt.orderId;

    // Snapshot counts before conflict attempt
    const beforeCustomers = await pool.query<{ count: number }>(
      `SELECT count(*)::int as count FROM public.customers WHERE name = $1 AND tenant_id = $2`,
      [conflictCustomerName, TENANT_A],
    );
    const beforeOrders = await pool.query<{ count: number }>(
      `SELECT count(*)::int as count FROM public.orders WHERE id = $1 AND tenant_id = $2`,
      [firstOrderId, TENANT_A],
    );
    const beforeEvents = await pool.query<{ count: number }>(
      `SELECT count(*)::int as count FROM public.events WHERE order_id = $1`,
      [firstOrderId],
    );
    const beforeReceipts = await pool.query<{ count: number }>(
      `SELECT count(*)::int as count FROM private.order_intake_receipts WHERE order_id = $1`,
      [firstOrderId],
    );
    const beforeItems = await pool.query<{ count: number }>(
      `SELECT count(*)::int as count FROM public.items WHERE order_id = $1`,
      [firstOrderId],
    );

    expect(beforeCustomers.rows[0]?.count).toBe(1);
    expect(beforeOrders.rows[0]?.count).toBe(1);
    expect(beforeEvents.rows[0]?.count).toBe(1);
    expect(beforeReceipts.rows[0]?.count).toBe(1);
    expect(beforeItems.rows[0]?.count).toBe(1);

    // Attempt conflict with different material
    const conflictInput = {
      ...firstInput,
      items: [
        { name: "Original Material Steel", quantity: 1, material: "Aluminium", surfaceRequested: "Galvanisieren" },
      ],
    };

    const conflictResult = await actions.createOrderIntakeAction(conflictInput);
    expect(conflictResult.code).toBe("CONFLICT");

    // Verify no new rows were created
    const afterCustomers = await pool.query<{ count: number }>(
      `SELECT count(*)::int as count FROM public.customers WHERE name = $1 AND tenant_id = $2`,
      [conflictCustomerName, TENANT_A],
    );
    expect(afterCustomers.rows[0]?.count).toBe(1);

    const afterOrders = await pool.query<{ count: number }>(
      `SELECT count(*)::int as count FROM public.orders WHERE id = $1 AND tenant_id = $2`,
      [firstOrderId, TENANT_A],
    );
    expect(afterOrders.rows[0]?.count).toBe(1);

    const afterEvents = await pool.query<{ count: number }>(
      `SELECT count(*)::int as count FROM public.events WHERE order_id = $1`,
      [firstOrderId],
    );
    expect(afterEvents.rows[0]?.count).toBe(1);

    const afterReceipts = await pool.query<{ count: number }>(
      `SELECT count(*)::int as count FROM private.order_intake_receipts WHERE order_id = $1`,
      [firstOrderId],
    );
    expect(afterReceipts.rows[0]?.count).toBe(1);

    const afterItems = await pool.query<{ count: number }>(
      `SELECT count(*)::int as count FROM public.items WHERE order_id = $1`,
      [firstOrderId],
    );
    expect(afterItems.rows[0]?.count).toBe(1);
  });

  it("should deny insufficient permissions (readonly role), no data mutation", async () => {
    setSession(USERS.readonly, "readonly", TENANT_A);

    const clientEventId = randomUUID();
    const deniedCustomerName = `${CUSTOMER_PREFIX}-denied-readonly-${RUN_SUFFIX}`;
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const result = await actions.createOrderIntakeAction({
      clientEventId,
      customer: {
        mode: "NEW" as const,
        name: deniedCustomerName,
        customerType: "business" as const,
        companyName: null,
        contactPerson: null,
        email: null,
        phone: null,
        city: null,
      },
      dueDate,
      note: null,
      items: [
        { name: "Denied Readonly Item", quantity: 1, material: null, surfaceRequested: "Galvanisieren" },
      ],
    });

    expect(result.code).toBe("FORBIDDEN");

    // Verify no customer created
    const customerCount = await pool.query<{ count: number }>(
      `SELECT count(*)::int as count FROM public.customers WHERE name = $1 AND tenant_id = $2`,
      [deniedCustomerName, TENANT_A],
    );
    expect(customerCount.rows[0]?.count).toBe(0);

    // Verify no order created with this clientEventId
    const orderCount = await pool.query<{ count: number }>(
      `SELECT count(*)::int as count FROM public.orders WHERE source_ref = $1 AND tenant_id = $2`,
      [clientEventId, TENANT_A],
    );
    expect(orderCount.rows[0]?.count).toBe(0);

    // Verify no event created with this clientEventId
    const eventCount = await pool.query<{ count: number }>(
      `SELECT count(*)::int as count FROM public.events WHERE client_event_id = $1 AND tenant_id = $2`,
      [clientEventId, TENANT_A],
    );
    expect(eventCount.rows[0]?.count).toBe(0);

    // Verify no receipt created with this clientEventId
    const receiptCount = await pool.query<{ count: number }>(
      `SELECT count(*)::int as count FROM private.order_intake_receipts WHERE client_event_id = $1 AND tenant_id = $2`,
      [clientEventId, TENANT_A],
    );
    expect(receiptCount.rows[0]?.count).toBe(0);
  });

  it("should isolate wrong tenant (foreign user), rejects UNAUTHENTICATED", async () => {
    // Uses a fresh random userId; no app_users row is seeded for the foreign tenant.
    // authorization.ts rejects tenantId !== KREILE_TENANT_SLUG before any DB access.
    const foreignUserId = randomUUID();
    const foreignTenant = `f1-intake-foreign-${RUN_SUFFIX}`;
    setSession(foreignUserId, "buero", foreignTenant);

    const clientEventId = randomUUID();
    const foreignCustomerName = `${CUSTOMER_PREFIX}-foreign-deny-${RUN_SUFFIX}`;
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const result = await actions.createOrderIntakeAction({
      clientEventId,
      customer: {
        mode: "NEW" as const,
        name: foreignCustomerName,
        customerType: "business" as const,
        companyName: null,
        contactPerson: null,
        email: null,
        phone: null,
        city: null,
      },
      dueDate,
      note: null,
      items: [
        { name: "Foreign Denied Item", quantity: 1, material: null, surfaceRequested: "Galvanisieren" },
      ],
    });

    expect(result.code).toBe("UNAUTHENTICATED");

    // Verify no Kreile customer created with this name
    const customerCount = await pool.query<{ count: number }>(
      `SELECT count(*)::int as count FROM public.customers WHERE name = $1 AND tenant_id = $2`,
      [foreignCustomerName, TENANT_A],
    );
    expect(customerCount.rows[0]?.count).toBe(0);

    // Verify no Kreile order created with this clientEventId
    const orderCount = await pool.query<{ count: number }>(
      `SELECT count(*)::int as count FROM public.orders WHERE source_ref = $1 AND tenant_id = $2`,
      [clientEventId, TENANT_A],
    );
    expect(orderCount.rows[0]?.count).toBe(0);

    // Verify no Kreile event created with this clientEventId
    const eventCount = await pool.query<{ count: number }>(
      `SELECT count(*)::int as count FROM public.events WHERE client_event_id = $1 AND tenant_id = $2`,
      [clientEventId, TENANT_A],
    );
    expect(eventCount.rows[0]?.count).toBe(0);

    // Verify no Kreile receipt created with this clientEventId
    const receiptCount = await pool.query<{ count: number }>(
      `SELECT count(*)::int as count FROM private.order_intake_receipts WHERE client_event_id = $1 AND tenant_id = $2`,
      [clientEventId, TENANT_A],
    );
    expect(receiptCount.rows[0]?.count).toBe(0);
  });
});
