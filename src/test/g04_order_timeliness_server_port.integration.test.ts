// @vitest-environment node

import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const resolveAuthorization = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization }));

import {
  getOrderTimelinessFacts,
  type OrderTimelinessFacts,
} from "@/modules/orders/server-public";

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
  throw new Error("G04_TIMELINESS_LOCAL_DATABASE_REQUIRED: expected loopback Supabase Postgres");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("G04_TIMELINESS_LOCAL_DATABASE_REQUIRED: SUPABASE_SERVICE_ROLE_KEY must be unset");
}

const fixtureSql = postgres(DATABASE_URL, { max: 1, prepare: false });
const suffix = `${Date.now().toString(36)}-${process.pid}`;
const TENANT_A = `kr3b2-a-${suffix}`;
const TENANT_B = `kr3b2-b-${suffix}`;
const USER_A = randomUUID();
const USER_B = randomUUID();
const CUSTOMER_A = `kr3b2-ca-${suffix}`;
const CUSTOMER_B = `kr3b2-cb-${suffix}`;
const RANGE = { from: "2026-07-10", to: "2026-07-20" };
const ORDERS = {
  before: `kr3b2-before-${suffix}`,
  v1: `kr3b2-v1-${suffix}`,
  ambiguous: `kr3b2-amb-${suffix}`,
  v2: `kr3b2-v2-${suffix}`,
  after: `kr3b2-after-${suffix}`,
  foreign: `kr3b2-foreign-${suffix}`,
} as const;
const EVENTS = {
  v1: randomUUID(),
  ambiguousV1: randomUUID(),
  ambiguousV2: randomUUID(),
  v2: randomUUID(),
  foreign: randomUUID(),
} as const;

type Tx = postgres.ISql;

type OrderSeed = {
  id: string;
  tenantId: string;
  customerId: string;
  dueDate: string;
  completedAt: string | null;
  version: number;
  v2Ready?: boolean;
};

async function seedActorAndCustomer(
  tx: Tx,
  tenantId: string,
  userId: string,
  customerId: string,
): Promise<void> {
  await tx`
    INSERT INTO public.app_users
      (id, tenant_id, email, full_name, role, active, created_at, updated_at)
    VALUES (
      ${userId}::uuid, ${tenantId}, ${`kr3b2-${userId}@local.invalid`},
      'KR-03B2 Synthetic Actor', 'admin', true, now(), now()
    )
  `;
  await tx`
    INSERT INTO public.customers
      (id, tenant_id, customer_number, name, type, source, created_at, updated_at)
    VALUES (
      ${customerId}, ${tenantId}, ${`K-${userId.slice(0, 8)}`},
      'KR-03B2 Synthetic Customer', 'business', 'integration-test', now(), now()
    )
  `;
}

async function seedOrder(tx: Tx, seed: OrderSeed): Promise<void> {
  const initialStation = seed.v2Ready ? "fertig" : "abgeholt";
  await tx`
    INSERT INTO public.orders (
      id, tenant_id, order_number, customer_id, title, station,
      current_station, current_station_id, status, version, source,
      intake_date, due_date, completed_date
    ) VALUES (
      ${seed.id}, ${seed.tenantId}, ${`A-${randomUUID()}`}, ${seed.customerId},
      'KR-03B2 Synthetic Order', ${initialStation}, ${initialStation},
      ${initialStation}, ${initialStation}, ${seed.version}, 'integration-test',
      now(), ${seed.dueDate}::text::timestamp, ${seed.completedAt}::text::timestamptz
    )
  `;
  if (!seed.v2Ready) return;

  await tx`SELECT set_config('app.payment_mode_command', 'v1', true)`;
  await tx`
    UPDATE public.orders
    SET payment_mode = 'rechnung', payment_mode_version = payment_mode_version + 1
    WHERE tenant_id = ${seed.tenantId} AND id = ${seed.id}
  `;
  await tx`
    UPDATE public.orders
    SET station = 'abgeholt', current_station = 'abgeholt',
        current_station_id = 'abgeholt', status = 'abgeholt'
    WHERE tenant_id = ${seed.tenantId} AND id = ${seed.id}
  `;
}

async function seedV1(
  tx: Tx,
  input: { eventId: string; tenantId: string; orderId: string; userId: string; version: number; createdAt: string },
): Promise<void> {
  await tx`
    INSERT INTO public.events (
      id, tenant_id, order_id, item_id, event_type, description, user_id,
      payload, status, station, created_at, client_event_id,
      event_schema_version, correlation_id, aggregate_version, from_station
    ) VALUES (
      ${input.eventId}, ${input.tenantId}, ${input.orderId}, NULL,
      'ORDER_PICKED_UP_V1', 'KR-03B2 synthetic V1 pickup', ${input.userId}::uuid,
      ${tx.json({
        orderId: input.orderId,
        mode: "abholung",
        orderVersion: input.version,
        paymentMode: "rechnung",
        paymentStatus: "offen",
        openAmountCents: 100,
        gateAllowed: true,
      })},
      'success', 'abgeholt', ${input.createdAt}::text::timestamp,
      ${randomUUID()}::uuid, 1, ${randomUUID()}::uuid, ${input.version}, 'fertig'
    )
  `;
}

async function seedV2(
  tx: Tx,
  input: { eventId: string; tenantId: string; orderId: string; userId: string; version: number; createdAt: string },
): Promise<void> {
  await tx`
    INSERT INTO public.events (
      id, tenant_id, order_id, item_id, event_type, description, user_id,
      payload, status, station, created_at, client_event_id,
      event_schema_version, correlation_id, aggregate_version, from_station
    ) VALUES (
      ${input.eventId}, ${input.tenantId}, ${input.orderId}, NULL,
      'ORDER_PICKED_UP_V2', 'KR-03B2 synthetic V2 pickup', ${input.userId}::uuid,
      ${tx.json({
        orderId: input.orderId,
        mode: "abholung",
        orderVersion: input.version,
        paymentMode: "rechnung",
        invoiceState: "not_issued",
        gateAllowed: true,
      })},
      'success', 'abgeholt', ${input.createdAt}::text::timestamp,
      ${randomUUID()}::uuid, 2, ${randomUUID()}::uuid, ${input.version}, 'fertig'
    )
  `;
}

function authorize(tenantId: string, permissions: readonly string[] = ["perm_view_leitstand"]): void {
  resolveAuthorization.mockResolvedValue({
    ok: true,
    data: {
      userId: tenantId === TENANT_A ? USER_A : USER_B,
      tenantId,
      displayName: "KR-03B2 Test",
      role: "admin",
      permissions,
      active: true,
    },
  });
}

async function readFacts(tenantId: string): Promise<OrderTimelinessFacts> {
  authorize(tenantId);
  const result = await getOrderTimelinessFacts(RANGE);
  if (result.code !== "OK") throw new Error(`unexpected result ${result.code}`);
  return result.data;
}

beforeAll(async () => {
  const [{ server_version_num: version }] = await fixtureSql<{ server_version_num: string }[]>`
    SELECT current_setting('server_version_num') AS server_version_num
  `;
  if (!version?.startsWith("17")) {
    throw new Error(`G04_TIMELINESS_LOCAL_DATABASE_REQUIRED: PostgreSQL 17 required, got ${version}`);
  }

  await fixtureSql.begin(async (tx) => {
    await seedActorAndCustomer(tx, TENANT_A, USER_A, CUSTOMER_A);
    await seedActorAndCustomer(tx, TENANT_B, USER_B, CUSTOMER_B);
    await seedOrder(tx, {
      id: ORDERS.before, tenantId: TENANT_A, customerId: CUSTOMER_A,
      dueDate: "2026-07-09 12:00:00", completedAt: null, version: 1,
    });
    await seedOrder(tx, {
      id: ORDERS.v1, tenantId: TENANT_A, customerId: CUSTOMER_A,
      dueDate: "2026-07-10 23:45:00", completedAt: "2026-03-29T01:30:00+01:00", version: 2,
    });
    await seedOrder(tx, {
      id: ORDERS.ambiguous, tenantId: TENANT_A, customerId: CUSTOMER_A,
      dueDate: "2026-07-15 12:00:00", completedAt: "2026-07-15T08:00:00Z", version: 3,
      v2Ready: true,
    });
    await seedOrder(tx, {
      id: ORDERS.v2, tenantId: TENANT_A, customerId: CUSTOMER_A,
      dueDate: "2026-07-20 23:59:59", completedAt: "2026-10-25T02:30:00+01:00", version: 4,
      v2Ready: true,
    });
    await seedOrder(tx, {
      id: ORDERS.after, tenantId: TENANT_A, customerId: CUSTOMER_A,
      dueDate: "2026-07-21 00:00:00", completedAt: null, version: 1,
    });
    await seedOrder(tx, {
      id: ORDERS.foreign, tenantId: TENANT_B, customerId: CUSTOMER_B,
      dueDate: "2026-07-15 12:00:00", completedAt: "2026-07-15T10:00:00Z", version: 5,
    });

    await seedV1(tx, {
      eventId: EVENTS.v1, tenantId: TENANT_A, orderId: ORDERS.v1,
      userId: USER_A, version: 2, createdAt: "2026-10-25 00:30:00",
    });
    await seedV1(tx, {
      eventId: EVENTS.ambiguousV1, tenantId: TENANT_A, orderId: ORDERS.ambiguous,
      userId: USER_A, version: 3, createdAt: "2026-07-15 09:00:00",
    });
    await seedV2(tx, {
      eventId: EVENTS.ambiguousV2, tenantId: TENANT_A, orderId: ORDERS.ambiguous,
      userId: USER_A, version: 3, createdAt: "2026-07-15 09:01:00",
    });
    await seedV2(tx, {
      eventId: EVENTS.v2, tenantId: TENANT_A, orderId: ORDERS.v2,
      userId: USER_A, version: 4, createdAt: "2026-10-25 01:30:00",
    });
    await seedV1(tx, {
      eventId: EVENTS.foreign, tenantId: TENANT_B, orderId: ORDERS.foreign,
      userId: USER_B, version: 5, createdAt: "2026-07-15 11:00:00",
    });
  });
});

beforeEach(() => vi.clearAllMocks());
afterAll(async () => fixtureSql.end({ timeout: 1 }));

describe("KR-03B2 authorized G04 timeliness server port", () => {
  it("keeps both views empty without a tenant GUC and rejects missing permission", async () => {
    const [counts] = await fixtureSql<{ orders: number; events: number }[]>`
      SELECT
        (SELECT count(*)::integer FROM public.v_order_timeliness_orders_v1) AS orders,
        (SELECT count(*)::integer FROM public.v_order_timeliness_pickup_events_v1) AS events
    `;
    expect(counts).toEqual({ orders: 0, events: 0 });

    authorize(TENANT_A, []);
    await expect(getOrderTimelinessFacts(RANGE)).resolves.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reads inclusive range boundaries and maps V1/V2 dates and instants explicitly", async () => {
    const data = await readFacts(TENANT_A);
    expect(data.range).toEqual(RANGE);
    expect(Number.isFinite(new Date(data.generatedAt).getTime())).toBe(true);
    expect(data.facts.map((fact) => fact.orderId)).toEqual([
      ORDERS.v1,
      ORDERS.ambiguous,
      ORDERS.v2,
    ]);

    const v1 = data.facts.find((fact) => fact.orderId === ORDERS.v1);
    expect(v1).toMatchObject({
      promisedDate: { value: "2026-07-10", source: "orders.due_date" },
      finishedAt: { value: "2026-03-29T00:30:00.000Z" },
      pickedUpAt: {
        value: "2026-10-25T00:30:00.000Z",
        provenance: { eventId: EVENTS.v1, eventType: "ORDER_PICKED_UP_V1" },
      },
    });

    const v2 = data.facts.find((fact) => fact.orderId === ORDERS.v2);
    expect(v2).toMatchObject({
      promisedDate: { value: "2026-07-20", source: "orders.due_date" },
      finishedAt: { value: "2026-10-25T01:30:00.000Z" },
      pickedUpAt: {
        value: "2026-10-25T01:30:00.000Z",
        provenance: { eventId: EVENTS.v2, eventType: "ORDER_PICKED_UP_V2" },
      },
    });
  });

  it("keeps multiple valid pickup rows visible so the domain fails closed", async () => {
    const data = await readFacts(TENANT_A);
    const ambiguous = data.facts.find((fact) => fact.orderId === ORDERS.ambiguous);
    expect(ambiguous?.pickedUpAt).toEqual({
      value: null,
      source: null,
      provenance: null,
      missingReason: "pickup_event_ambiguous",
    });
  });

  it("never crosses tenant boundaries in either direction", async () => {
    const own = await readFacts(TENANT_A);
    expect(own.facts.map((fact) => fact.orderId)).not.toContain(ORDERS.foreign);

    const foreign = await readFacts(TENANT_B);
    expect(foreign.facts.map((fact) => fact.orderId)).toEqual([ORDERS.foreign]);
    expect(foreign.facts[0]?.pickedUpAt).toMatchObject({
      provenance: { eventId: EVENTS.foreign },
    });
    expect(foreign.facts.map((fact) => fact.orderId)).not.toContain(ORDERS.v1);
  });
});
