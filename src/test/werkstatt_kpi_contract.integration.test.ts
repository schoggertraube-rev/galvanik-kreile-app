import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

if (
  process.env.DATABASE_URL !== LOCAL_DATABASE_URL ||
  process.env.WERKSTATT_KPI_EXPECTED_DATABASE_URL !== LOCAL_DATABASE_URL
) {
  throw new Error(
    "WERKSTATT_KPI_LOCAL_DATABASE_REQUIRED: DATABASE_URL and WERKSTATT_KPI_EXPECTED_DATABASE_URL must target 127.0.0.1:54322/postgres",
  );
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("WERKSTATT_KPI_LOCAL_DATABASE_REQUIRED: SUPABASE_SERVICE_ROLE_KEY must be unset");
}

const resolveAuthorization = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization }));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));

const TENANT_A = KREILE_TENANT_SLUG;
const TENANT_B = "werkstatt-kpi-tenant-b";
const TENANT_EMPTY = "werkstatt-kpi-empty";
const CUSTOMER_IDS = ["werkstatt-kpi-customer-a", "werkstatt-kpi-customer-b"];
const ORDER_IDS = [
  "werkstatt-kpi-a-inbox",
  "werkstatt-kpi-a-wip",
  "werkstatt-kpi-a-future",
  "werkstatt-kpi-a-seed",
  "werkstatt-kpi-b-wip",
];

const fixtureSql = postgres(LOCAL_DATABASE_URL, { max: 1, prepare: false });
let getWarendurchlaufKPIs: typeof import("@/app/warendurchlauf/actions").getWarendurchlaufKPIs;

function authorize(tenantId: string, permissions: readonly string[] = ["perm_view_leitstand"]) {
  resolveAuthorization.mockResolvedValue({
    ok: true,
    data: {
      userId: "11111111-1111-4111-8111-111111111111",
      tenantId,
      displayName: "KPI Test",
      role: "werkstatt",
      permissions,
      active: true,
    },
  });
}

async function clearFixtures() {
  await fixtureSql`DELETE FROM public.orders WHERE id = ANY(${ORDER_IDS})`;
  await fixtureSql`DELETE FROM public.customers WHERE id = ANY(${CUSTOMER_IDS})`;
}

beforeAll(async () => {
  ({ getWarendurchlaufKPIs } = await import("@/app/warendurchlauf/actions"));
});

beforeEach(async () => {
  vi.clearAllMocks();
  await clearFixtures();
  await fixtureSql`
    INSERT INTO public.customers (id, tenant_id, customer_number, name, type, source)
    VALUES
      (${CUSTOMER_IDS[0]}, ${TENANT_A}, 'KPI-A', 'KPI Kunde A', 'business', 'manual'),
      (${CUSTOMER_IDS[1]}, ${TENANT_B}, 'KPI-B', 'KPI Kunde B', 'business', 'manual')
  `;
  await fixtureSql`
    INSERT INTO public.orders
      (id, tenant_id, order_number, customer_id, title, station, current_station,
       current_station_id, status, version, source, intake_date, due_date)
    VALUES
      (${ORDER_IDS[0]}, ${TENANT_A}, 'KPI-A-1001', ${CUSTOMER_IDS[0]}, 'A Eingang',
       'wareneingang', 'wareneingang', 'wareneingang', 'angenommen', 1, 'manual', now(),
       (now() AT TIME ZONE 'Europe/Berlin')::date),
      (${ORDER_IDS[1]}, ${TENANT_A}, 'KPI-A-1002', ${CUSTOMER_IDS[0]}, 'A Galvanik',
       'galvanik', 'galvanik', 'galvanik', 'galvanik', 1, 'manual', now(),
       (date_trunc('week', now() AT TIME ZONE 'Europe/Berlin') + interval '6 days')::date),
      (${ORDER_IDS[2]}, ${TENANT_A}, 'KPI-A-1003', ${CUSTOMER_IDS[0]}, 'A Naechste Woche',
       'wareneingang', 'wareneingang', 'wareneingang', 'angenommen', 1, 'manual', now(),
       (date_trunc('week', now() AT TIME ZONE 'Europe/Berlin') + interval '7 days')::date),
      (${ORDER_IDS[3]}, ${TENANT_A}, 'KPI-A-SEED', ${CUSTOMER_IDS[0]}, 'A Seed ausgeschlossen',
       'galvanik', 'galvanik', 'galvanik', 'galvanik', 1, 'seed', now(),
       (now() AT TIME ZONE 'Europe/Berlin')::date),
      (${ORDER_IDS[4]}, ${TENANT_B}, 'KPI-B-1001', ${CUSTOMER_IDS[1]}, 'B Galvanik',
       'galvanik', 'galvanik', 'galvanik', 'galvanik', 1, 'manual', now(),
       (now() AT TIME ZONE 'Europe/Berlin')::date)
  `;
});

afterAll(async () => {
  await clearFixtures();
  await fixtureSql.end({ timeout: 1 });
});

describe("public.v_werkstatt_kpis_v1", () => {
  it("returns only the authenticated tenant snapshot through the real server action", async () => {
    authorize(TENANT_A);
    await expect(getWarendurchlaufKPIs()).resolves.toEqual({
      ok: true,
      data: { wipCount: 1, dueThisWeekCount: 2 },
    });

    authorize(TENANT_B);
    await expect(getWarendurchlaufKPIs()).resolves.toEqual({
      ok: true,
      data: { wipCount: 1, dueThisWeekCount: 1 },
    });
  });

  it("returns a validated zero snapshot for an empty tenant", async () => {
    authorize(TENANT_EMPTY);
    await expect(getWarendurchlaufKPIs()).resolves.toEqual({
      ok: true,
      data: { wipCount: 0, dueThisWeekCount: 0 },
    });
  });

  it("fails closed without tenant context and denies a role without view permission", async () => {
    const rows = await fixtureSql`SELECT * FROM public.v_werkstatt_kpis_v1`;
    expect(rows).toEqual([]);

    authorize(TENANT_A, []);
    await expect(getWarendurchlaufKPIs()).resolves.toMatchObject({ ok: false, error: "FORBIDDEN" });
  });

  it("keeps the view invoker-safe and unavailable to browser roles", async () => {
    const [security] = await fixtureSql<{
      security_invoker: boolean;
      service_select: boolean;
      anon_select: boolean;
      authenticated_select: boolean;
    }[]>`
      SELECT
        coalesce('security_invoker=true' = ANY(coalesce(cls.reloptions, ARRAY[]::text[])), false) AS security_invoker,
        has_table_privilege('service_role', 'public.v_werkstatt_kpis_v1', 'SELECT') AS service_select,
        has_table_privilege('anon', 'public.v_werkstatt_kpis_v1', 'SELECT') AS anon_select,
        has_table_privilege('authenticated', 'public.v_werkstatt_kpis_v1', 'SELECT') AS authenticated_select
      FROM pg_class cls
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      WHERE ns.nspname = 'public' AND cls.relname = 'v_werkstatt_kpis_v1'
    `;
    expect(security).toEqual({
      security_invoker: true,
      service_select: true,
      anon_select: false,
      authenticated_select: false,
    });
  });
});
