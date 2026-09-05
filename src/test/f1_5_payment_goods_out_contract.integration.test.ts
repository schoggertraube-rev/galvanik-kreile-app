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
const TENANT = "galvanik-kreile";
const FOREIGN_TENANT = "f1-5-foreign-tenant";

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

  it("binds reads to app.tenant_id and never returns another tenant", async () => {
    const readForTenant = async (tenantId: string) => sql.begin(async (transaction) => {
      await transaction`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return transaction<{ tenant_id: string }[]>`
        SELECT tenant_id
        FROM private.v_payment_summary_v1
        ORDER BY invoice_id
        LIMIT 251
      `;
    });

    const ownRows = await readForTenant(TENANT);
    const foreignRows = await readForTenant(FOREIGN_TENANT);
    expect(ownRows.every((row) => row.tenant_id === TENANT)).toBe(true);
    expect(foreignRows.every((row) => row.tenant_id === FOREIGN_TENANT)).toBe(true);
    expect(ownRows.some((row) => row.tenant_id === FOREIGN_TENANT)).toBe(false);
    expect(foreignRows.some((row) => row.tenant_id === TENANT)).toBe(false);
  });
});
