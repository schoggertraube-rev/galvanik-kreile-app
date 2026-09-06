import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const LOCAL_DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_LOCAL_DATABASE_URL = process.env.F1_3_EXPECTED_DATABASE_URL;

if (!LOCAL_DATABASE_URL || !EXPECTED_LOCAL_DATABASE_URL || LOCAL_DATABASE_URL !== EXPECTED_LOCAL_DATABASE_URL) {
  throw new Error("F1_3_LOCAL_DATABASE_REQUIRED: DATABASE_URL must equal F1_3_EXPECTED_DATABASE_URL");
}
const parsedDatabaseUrl = new URL(LOCAL_DATABASE_URL);
if (
  parsedDatabaseUrl.protocol !== "postgresql:" ||
  parsedDatabaseUrl.hostname !== "127.0.0.1" ||
  parsedDatabaseUrl.pathname !== "/postgres" ||
  parsedDatabaseUrl.username !== "postgres"
) {
  throw new Error("F1_3_LOCAL_DATABASE_REQUIRED: expected the dedicated local Postgres database");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("F1_3_LOCAL_DATABASE_REQUIRED: SUPABASE_SERVICE_ROLE_KEY must be unset");
}

const readAppSessionSpy = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/appSession", () => ({ readAppSession: readAppSessionSpy }));

const TENANT_A = KREILE_TENANT_SLUG;
const TENANT_B = "f1-3-foreign-tenant";
const EMPTY_TENANT = "f1-3-empty-tenant";
const USER_A = "13131313-1313-4313-8313-131313131313";
const USER_B = "23232323-2323-4232-8232-232323232323";
const suffix = `${Date.now()}-${process.pid}`;
const CUSTOMER_A = `f1-3-customer-a-${suffix}`;
const CUSTOMER_B = `f1-3-customer-b-${suffix}`;
const ORDER_A = `f1-3-order-a-${suffix}`;
const ORDER_B = `f1-3-order-b-${suffix}`;
const ITEM_A = `f1-3-item-a-${suffix}`;
const ITEM_B = `f1-3-item-b-${suffix}`;
const sql = postgres(LOCAL_DATABASE_URL, { max: 2, prepare: false });

const authorizationA = {
  userId: USER_A,
  tenantId: TENANT_A,
  displayName: "F1.3 Meister",
  role: "meister" as const,
  permissions: ["perm_view_leitstand"] as const,
  active: true as const,
};
const authorizationB = {
  ...authorizationA,
  userId: USER_B,
  tenantId: TENANT_B,
};
const authorizationEmpty = {
  ...authorizationA,
  tenantId: EMPTY_TENANT,
};

let readCardSearchDocuments: typeof import("@/lib/server/cardSearchRead").readCardSearchDocuments;
let readUserLastSeen: typeof import("@/lib/server/userLastSeen").readUserLastSeen;
let readUserLastSeenReceipt: typeof import("@/lib/server/userLastSeen").readUserLastSeenReceipt;
let markUserLastSeen: typeof import("@/lib/server/userLastSeen").markUserLastSeen;

function setSession(userId: string, role: string, tenantId: string) {
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

beforeAll(async () => {
  const [{ server_version_num: version }] = await sql<{ server_version_num: string }[]>`
    SELECT current_setting('server_version_num') AS server_version_num
  `;
  if (!version?.startsWith("17")) {
    throw new Error(`F1_3_LOCAL_DATABASE_REQUIRED: PostgreSQL 17 required, got ${version}`);
  }

  await sql`
    INSERT INTO public.app_users
      (id, tenant_id, email, full_name, role, active, created_at, updated_at)
    VALUES
      (${USER_A}::uuid, ${TENANT_A}, ${`f1-3-a-${suffix}@local.invalid`}, 'F1.3 Meister', 'meister', true, now(), now()),
      (${USER_B}::uuid, ${TENANT_B}, ${`f1-3-b-${suffix}@local.invalid`}, 'F1.3 Foreign', 'meister', true, now(), now())
    ON CONFLICT (id) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      active = true,
      updated_at = now()
  `;
  await sql`
    INSERT INTO public.customers
      (id, tenant_id, customer_number, name, type, notes, source, created_at, updated_at)
    VALUES
      (${CUSTOMER_A}, ${TENANT_A}, ${`F13-A-${suffix}`}, 'F1.3 Kunde Alpha', 'business', 'Alpha Kundennotiz', 'manual', now(), now()),
      (${CUSTOMER_B}, ${TENANT_B}, ${`F13-B-${suffix}`}, 'F1.3 Kunde Fremd', 'business', 'Fremde Kundennotiz', 'manual', now(), now())
  `;
  await sql`
    INSERT INTO public.orders
      (id, tenant_id, order_number, customer_id, title, task, station,
       current_station, current_station_id, version, status, source, intake_date, due_date, created_at)
    VALUES
      (${ORDER_A}, ${TENANT_A}, ${`F13-A-${suffix}`}, ${CUSTOMER_A}, 'Auftrag Alpha', 'Spezialnotiz Alpha',
       'wareneingang', 'wareneingang', 'wareneingang', 1, 'angenommen', 'manual', now(), '2026-08-31', now()),
      (${ORDER_B}, ${TENANT_B}, ${`F13-B-${suffix}`}, ${CUSTOMER_B}, 'Auftrag Fremd', 'Fremde Spezialnotiz',
       'wareneingang', 'wareneingang', 'wareneingang', 1, 'angenommen', 'manual', now(), '2026-09-01', now())
  `;
  await sql`
    INSERT INTO public.items
      (id, tenant_id, order_id, customer_id, name, quantity, current_station_id,
       material, surface_requested, internal_notes, created_at)
    VALUES
      (${ITEM_A}, ${TENANT_A}, ${ORDER_A}, ${CUSTOMER_A}, 'Alpha Position', 2, 'wareneingang',
       'Stahl', 'Verzinken', 'Alpha Positionsnotiz', now()),
      (${ITEM_B}, ${TENANT_B}, ${ORDER_B}, ${CUSTOMER_B}, 'Fremde Position', 1, 'wareneingang',
       'Kupfer', 'Polieren', 'Fremde Positionsnotiz', now())
  `;

  ({ readCardSearchDocuments } = await import("@/lib/server/cardSearchRead"));
  ({ readUserLastSeen, readUserLastSeenReceipt, markUserLastSeen } = await import("@/lib/server/userLastSeen"));
});

afterAll(async () => {
  await sql.end({ timeout: 1 });
});

describe("F1.3 Part A real local database contracts", () => {
  it("proves empty, filled, and foreign-tenant isolation for the derived L4 port", async () => {
    await expect(readCardSearchDocuments(authorizationEmpty)).resolves.toEqual({ code: "OK", data: [] });

    const ownResult = await readCardSearchDocuments(authorizationA);
    expect(ownResult.code).toBe("OK");
    if (ownResult.code !== "OK") throw new Error("L4 own-tenant read failed");
    expect(ownResult.data.some((entry) => entry.type === "ORDER" && entry.id === ORDER_A
      && entry.searchDocument.includes("alpha positionsnotiz"))).toBe(true);
    expect(ownResult.data.some((entry) => entry.type === "CUSTOMER" && entry.id === CUSTOMER_A
      && entry.searchDocument.includes("alpha kundennotiz"))).toBe(true);
    expect(ownResult.data.some((entry) => entry.id === ORDER_B || entry.id === CUSTOMER_B)).toBe(false);

    const foreignResult = await readCardSearchDocuments(authorizationB);
    expect(foreignResult.code).toBe("OK");
    if (foreignResult.code !== "OK") throw new Error("L4 foreign-tenant control read failed");
    expect(foreignResult.data.some((entry) => entry.id === ORDER_B)).toBe(true);
    expect(foreignResult.data.some((entry) => entry.id === ORDER_A || entry.id === CUSTOMER_A)).toBe(false);
  });

  it("persists L2 state, immutable receipt, replay, and confirmed readback", async () => {
    setSession(USER_A, "meister", TENANT_A);
    const clientEventId = randomUUID();
    const initial = await readUserLastSeen(authorizationA);
    expect(initial).toEqual({ code: "OK", data: { userId: USER_A, lastSeenAt: null, version: 0 } });

    const written = await markUserLastSeen({ expectedVersion: 0, clientEventId });
    expect(written.code).toBe("OK");
    if (written.code !== "OK") throw new Error("L2 write failed");
    expect(written.replayed).toBe(false);
    expect(written.receipt.aggregateVersion).toBe(1);

    const receiptReadback = await readUserLastSeenReceipt(authorizationA, clientEventId);
    expect(receiptReadback).toEqual({ code: "OK", data: written.receipt });
    const stateReadback = await readUserLastSeen(authorizationA);
    expect(stateReadback).toEqual({
      code: "OK",
      data: { userId: USER_A, lastSeenAt: written.receipt.lastSeenAt, version: 1 },
    });

    await expect(markUserLastSeen({ expectedVersion: 0, clientEventId })).resolves.toEqual({
      code: "OK",
      receipt: written.receipt,
      replayed: true,
    });

    const [eventCount] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM public.events
      WHERE tenant_id = ${TENANT_A}
        AND user_id = ${USER_A}::uuid
        AND client_event_id = ${clientEventId}::uuid
        AND event_type = 'USER_LAST_SEEN_RECORDED_V1'
    `;
    expect(eventCount?.count).toBe(1);
  });

  it("rejects a foreign session before any L2 mutation", async () => {
    setSession(USER_B, "meister", TENANT_B);
    const clientEventId = randomUUID();
    await expect(markUserLastSeen({ expectedVersion: 0, clientEventId })).resolves.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    const [stateCount] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM private.user_last_seen
      WHERE tenant_id = ${TENANT_B} AND user_id = ${USER_B}::uuid
    `;
    const [eventCount] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM public.events
      WHERE tenant_id = ${TENANT_B} AND client_event_id = ${clientEventId}::uuid
    `;
    expect(stateCount?.count).toBe(0);
    expect(eventCount?.count).toBe(0);
  });
});
