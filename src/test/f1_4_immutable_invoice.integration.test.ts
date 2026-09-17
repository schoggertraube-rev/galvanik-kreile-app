// @vitest-environment node

import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.F1_4_EXPECTED_DATABASE_URL;

if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("F1_4_LOCAL_DATABASE_REQUIRED: DATABASE_URL must equal F1_4_EXPECTED_DATABASE_URL");
}

const parsedUrl = new URL(DATABASE_URL);
if (
  parsedUrl.protocol !== "postgresql:"
  || parsedUrl.hostname !== "127.0.0.1"
  || !/^\d{4,5}$/.test(parsedUrl.port)
  || parsedUrl.pathname !== "/postgres"
  || parsedUrl.username !== "postgres"
) {
  throw new Error("F1_4_LOCAL_DATABASE_REQUIRED: expected the dedicated local F1.4 Postgres database");
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("F1_4_LOCAL_DATABASE_REQUIRED: SUPABASE_SERVICE_ROLE_KEY must be unset");
}

// AUTH_ADAPTER_SYNTHETIC_NOT_ACCEPTANCE: only the cookie/session adapter is
// synthetic. Authorization, DB, views, transaction, command, PDF, hash,
// event, invoice and receipt readback remain the real production path.
const readAppSessionSpy = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/appSession", () => ({ readAppSession: readAppSessionSpy }));

const TENANT_ID = KREILE_TENANT_SLUG;
const FOREIGN_TENANT_ID = "f14-command-foreign";
const USER_ID = "14141414-1414-4141-8141-141414141401";
const FREEZE_ID = "14141414-1414-4141-8141-141414141402";
const RATE_ID = "14141414-1414-4141-8141-141414141403";
const FREEZE_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141404";
const FREEZE_CORRELATION_ID = "14141414-1414-4141-8141-141414141405";
const ISSUE_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141406";
const CANCEL_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141407";
const REISSUE_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141408";
const CANCEL_REISSUE_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141409";
const ISSUE_SEVEN_PERCENT_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141410";
const ISSUE_MISSING_TERM_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141412";
const ISSUE_UNFINISHED_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141414";
const ISSUE_PAYMENT_GUARD_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141415";
const CANCEL_CORRUPT_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141416";
const CANCEL_PARTIAL_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141417";
const CANCEL_PAID_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141418";
const PARTIAL_PAYMENT_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141419";
const FULL_PAYMENT_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141420";
const RACE_FREEZE_ID = "14141414-1414-4141-8141-141414141421";
const RACE_FREEZE_EVENT_ID = "14141414-1414-4141-8141-141414141422";
const RACE_FREEZE_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141423";
const RACE_FREEZE_CORRELATION_ID = "14141414-1414-4141-8141-141414141424";
const RACE_ISSUE_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141425";
const RACE_CANCEL_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141426";
const RACE_PAYMENT_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141427";
const CANCEL_EVIDENCE_ONLY_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141428";
const BROWSER_FREEZE_ID = "14141414-1414-4141-8141-141414141430";
const BROWSER_FREEZE_EVENT_ID = "14141414-1414-4141-8141-141414141431";
const BROWSER_FREEZE_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141432";
const BROWSER_FREEZE_CORRELATION_ID = "14141414-1414-4141-8141-141414141433";
const BROWSER_ITEM_ID = "14141414-1414-4141-8141-141414141434";
const BROWSER_INTAKE_EVENT_ID = "14141414-1414-4141-8141-141414141435";
const BROWSER_INTAKE_CLIENT_EVENT_ID = "14141414-1414-4141-8141-141414141436";
const BROWSER_INTAKE_CORRELATION_ID = "14141414-1414-4141-8141-141414141437";
const BROWSER_INTAKE_RECEIPT_ID = "14141414-1414-4141-8141-141414141438";
const BROWSER_INTAKE_INTENT_SHA256 = "b".repeat(64);
const CUSTOMER_ID = "f14-command-customer";
const ORDER_ID = "f14-command-order";
const UNFINISHED_ORDER_ID = "f14-command-unfinished-order";
const RACE_ORDER_ID = "f14-command-race-order";
const BROWSER_ORDER_ID = "f14-command-browser-order";
const ITEM_ID = "f14-command-item";
const RACE_ITEM_ID = "f14-command-race-item";
const SETTINGS_ID = "f14-command-settings";
const FREEZE_EVENT_ID = "14141414-1414-4141-8141-141414141413";
const ORDER_VERSION = 2;
const UNFINISHED_ORDER_VERSION = 1;
/**
 * The command's database session is deliberately neither UTC nor Europe/Berlin,
 * so a Berlin calendar value can never be a session-zone coincidence.
 */
const SESSION_ROLE = "postgres";
const SESSION_TIME_ZONE = "Pacific/Honolulu";
/** UTC 2026-08-21, Pacific/Honolulu 2026-08-21, Europe/Berlin 2026-08-22. */
const FREEZE_INSTANT = "2026-08-21T22:30:00.000Z";
const SERVICE_DATE = "2026-08-22";
const FREEZE_PAYLOAD = {
  freezeId: FREEZE_ID,
  rateId: RATE_ID,
  hourlyRateCents: 12000,
  totalAmountCents: 0,
  lineCount: 0,
};

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });

beforeAll(async () => {
  // Applied before the command module (and therefore the pooled client) is
  // imported, so every command session inherits the foreign zone.
  await sql.unsafe(`ALTER ROLE ${SESSION_ROLE} SET TimeZone = '${SESSION_TIME_ZONE}'`);
});

afterAll(async () => {
  try {
    await sql.unsafe(`ALTER ROLE ${SESSION_ROLE} RESET TimeZone`);
  } finally {
    await sql.end({ timeout: 1 });
  }
});

function setSyntheticSession() {
  readAppSessionSpy.mockResolvedValue({
    ok: true,
    session: {
      userId: USER_ID,
      tenantId: TENANT_ID,
      role: "meister",
      displayName: "F1.4 Synthetic Meister",
      issuedAt: 4_102_444_800_000,
      expiresAt: 4_102_488_000_000,
    },
  });
}

const foreignAuthorization: AuthorizationSnapshot = {
  userId: "14141414-1414-4141-8141-141414141499",
  tenantId: FOREIGN_TENANT_ID,
  displayName: "F1.4 Synthetic Foreign",
  role: "meister",
  permissions: ["perm_data_orders"],
  active: true,
};

async function assertFreshReset() {
  const [state] = await sql<{
    user_exists: boolean;
    settings_exists: boolean;
    customer_exists: boolean;
    order_exists: boolean;
    item_exists: boolean;
    rate_exists: boolean;
    freeze_exists: boolean;
    event_exists: boolean;
    invoice_exists: boolean;
    sequence_exists: boolean;
  }[]>`
    SELECT
      EXISTS (SELECT 1 FROM public.app_users WHERE id = ${USER_ID}::uuid) AS user_exists,
      EXISTS (SELECT 1 FROM public.company_settings WHERE id = ${SETTINGS_ID}) AS settings_exists,
      EXISTS (SELECT 1 FROM public.customers WHERE id = ${CUSTOMER_ID}) AS customer_exists,
      EXISTS (
        SELECT 1 FROM public.orders
        WHERE id IN (${ORDER_ID}, ${UNFINISHED_ORDER_ID}, ${RACE_ORDER_ID}, ${BROWSER_ORDER_ID})
      ) AS order_exists,
      EXISTS (
        SELECT 1 FROM public.items WHERE id IN (${ITEM_ID}, ${RACE_ITEM_ID}, ${BROWSER_ITEM_ID})
      ) AS item_exists,
      EXISTS (SELECT 1 FROM private.extra_work_hourly_rates WHERE id = ${RATE_ID}::uuid) AS rate_exists,
      EXISTS (
        SELECT 1 FROM private.order_freezes
        WHERE id IN (${FREEZE_ID}::uuid, ${RACE_FREEZE_ID}::uuid, ${BROWSER_FREEZE_ID}::uuid)
      ) AS freeze_exists,
      EXISTS (
        SELECT 1 FROM public.events
        WHERE id IN (
          ${FREEZE_EVENT_ID}, ${RACE_FREEZE_EVENT_ID}, ${BROWSER_FREEZE_EVENT_ID},
          ${BROWSER_INTAKE_EVENT_ID}
        )
           OR client_event_id IN (
             ${ISSUE_CLIENT_EVENT_ID}::uuid,
             ${ISSUE_PAYMENT_GUARD_CLIENT_EVENT_ID}::uuid,
             ${RACE_ISSUE_CLIENT_EVENT_ID}::uuid
           )
      ) AS event_exists,
      EXISTS (
        SELECT 1 FROM public.invoices WHERE order_id IN (${ORDER_ID}, ${RACE_ORDER_ID})
      ) AS invoice_exists,
      EXISTS (
        SELECT 1 FROM private.invoice_number_sequences WHERE tenant_id = ${TENANT_ID}
      ) AS sequence_exists
  `;
  if (!state || Object.values(state).some(Boolean)) {
    throw new Error("F1_4_FRESH_RESET_REQUIRED: fixed integration fixtures already exist");
  }
}

async function insertPrerequisites() {
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO public.app_users
        (id, tenant_id, email, full_name, role, active, created_at, updated_at)
      VALUES (
        ${USER_ID}::uuid, ${TENANT_ID}, 'f14-command-meister@local.invalid',
        'F1.4 Synthetic Meister', 'meister', true, now(), now()
      )
    `;
    await transaction`
      INSERT INTO public.company_settings (
        id, tenant_id, company_name, street, zip, city, country,
        iban, bic, bank_name, tax_id, invoice_vat_rate_basis_points,
        invoice_payment_term_days
      ) VALUES (
        ${SETTINGS_ID}, ${TENANT_ID}, 'F1.4 Synthetic Galvanik GmbH',
        'Testweg 1', '70173', 'Stuttgart', 'Deutschland',
        'DE02120300000000202051', 'BYLADEM1001', 'F1.4 Testbank',
        'DE-SYNTHETIC-TAX', 1900, 14
      )
    `;
    await transaction`
      INSERT INTO public.customers (
        id, tenant_id, customer_number, name, company_name, type,
        street, zip_code, city, country, created_at, updated_at
      ) VALUES (
        ${CUSTOMER_ID}, ${TENANT_ID}, 'F14-COMMAND-001', 'F1.4 Synthetic Customer',
        'F1.4 Synthetic Customer GmbH', 'business', 'Kundenweg 2',
        '70174', 'Stuttgart', 'Deutschland', now(), now()
      )
    `;
    await transaction`
      INSERT INTO public.orders (
        id, tenant_id, order_number, customer_id, title, station,
        current_station, current_station_id, version, status, created_at
      ) VALUES (
        ${ORDER_ID}, ${TENANT_ID}, 'A-F14-COMMAND-001', ${CUSTOMER_ID},
        'F1.4 Synthetic Command Order', 'fertig', 'fertig', 'fertig',
        ${ORDER_VERSION}, 'fertig', now()
      )
    `;
    // This isolated local fixture remains deliberately untouched by the
    // integration assertions. The production-browser contract must issue and
    // pay its invoice through the real UI commands before proving that a paid
    // invoice cannot be cancelled.
    await transaction`
      INSERT INTO public.orders (
        id, tenant_id, order_number, customer_id, title, station,
        current_station, current_station_id, version, status, created_at
      ) VALUES (
        ${BROWSER_ORDER_ID}, ${TENANT_ID}, 'A-2026-1404', ${CUSTOMER_ID},
        'F1.4 Synthetic Browser Order', 'fertig', 'fertig', 'fertig',
        ${ORDER_VERSION}, 'fertig', now()
      )
    `;
    // A separate, deliberately unfinished order. It never reaches the freeze,
    // the source view or the number allocation.
    await transaction`
      INSERT INTO public.orders (
        id, tenant_id, order_number, customer_id, title, station,
        current_station, current_station_id, version, status, created_at
      ) VALUES (
        ${UNFINISHED_ORDER_ID}, ${TENANT_ID}, 'A-F14-COMMAND-002', ${CUSTOMER_ID},
        'F1.4 Synthetic Unfinished Order', 'galvanik', 'galvanik', 'galvanik',
        ${UNFINISHED_ORDER_VERSION}, 'galvanik', now()
      )
    `;
    await transaction`
      INSERT INTO public.orders (
        id, tenant_id, order_number, customer_id, title, station,
        current_station, current_station_id, version, status, created_at
      ) VALUES (
        ${RACE_ORDER_ID}, ${TENANT_ID}, 'A-F14-COMMAND-003', ${CUSTOMER_ID},
        'F1.4 Synthetic Cancellation Race Order', 'fertig', 'fertig', 'fertig',
        ${ORDER_VERSION}, 'fertig', now()
      )
    `;
    await transaction`
      INSERT INTO public.items (
        id, tenant_id, order_id, customer_id, name, quantity,
        current_station_id, preis_netto, created_at
      ) VALUES (
        ${ITEM_ID}, ${TENANT_ID}, ${ORDER_ID}, ${CUSTOMER_ID},
        'F1.4 Synthetic Position', 1, 'fertig', 100.00, now()
      )
    `;
    await transaction`
      INSERT INTO public.items (
        id, tenant_id, order_id, customer_id, name, quantity,
        current_station_id, preis_netto, material, surface_requested, created_at
      ) VALUES (
        ${BROWSER_ITEM_ID}, ${TENANT_ID}, ${BROWSER_ORDER_ID}, ${CUSTOMER_ID},
        'F1.4 Synthetic Browser Position', 1, 'fertig', 75.00, 'Stahl', 'Verzinken', now()
      )
    `;
    await transaction`
      INSERT INTO public.items (
        id, tenant_id, order_id, customer_id, name, quantity,
        current_station_id, preis_netto, created_at
      ) VALUES (
        ${RACE_ITEM_ID}, ${TENANT_ID}, ${RACE_ORDER_ID}, ${CUSTOMER_ID},
        'F1.4 Synthetic Race Position', 1, 'fertig', 50.00, now()
      )
    `;
    await transaction`
      INSERT INTO private.extra_work_hourly_rates (
        id, tenant_id, hourly_rate_cents, version, created_by, effective_at
      ) VALUES (${RATE_ID}::uuid, ${TENANT_ID}, 12000, 1, ${USER_ID}::uuid, now())
    `;
    const browserItemsSnapshot = [{
      id: BROWSER_ITEM_ID,
      position: 1,
      name: "F1.4 Synthetic Browser Position",
      quantity: 1,
      material: "Stahl",
      surfaceRequested: "Verzinken",
    }];
    await transaction`
      INSERT INTO public.events (
        id, tenant_id, order_id, item_id, event_type, description, notes, payload,
        status, user_id, station, client_event_id, event_schema_version,
        correlation_id, aggregate_version, from_station, created_at
      ) VALUES (
        ${BROWSER_INTAKE_EVENT_ID}, ${TENANT_ID}, ${BROWSER_ORDER_ID}, NULL,
        'ORDER_INTAKE_CREATED_V1', 'Synthetischer lokaler Browser-Auftrag angelegt', NULL,
        ${transaction.json({ intentSha256: BROWSER_INTAKE_INTENT_SHA256 })},
        'success', ${USER_ID}::uuid, 'wareneingang', ${BROWSER_INTAKE_CLIENT_EVENT_ID}::uuid, 1,
        ${BROWSER_INTAKE_CORRELATION_ID}::uuid, 1, NULL, statement_timestamp() AT TIME ZONE 'UTC'
      )
    `;
    await transaction`
      INSERT INTO private.order_intake_receipts (
        id, event_id, tenant_id, order_id, customer_id, actor_id, client_event_id,
        correlation_id, intent_sha256, customer_mode, order_number, customer_display_name,
        due_date, note, items_snapshot, created_at
      ) VALUES (
        ${BROWSER_INTAKE_RECEIPT_ID}::uuid, ${BROWSER_INTAKE_EVENT_ID}, ${TENANT_ID},
        ${BROWSER_ORDER_ID}, ${CUSTOMER_ID}, ${USER_ID}::uuid,
        ${BROWSER_INTAKE_CLIENT_EVENT_ID}::uuid, ${BROWSER_INTAKE_CORRELATION_ID}::uuid,
        ${BROWSER_INTAKE_INTENT_SHA256}, 'EXISTING', 'A-2026-1404',
        'F1.4 Synthetic Customer GmbH', '2026-10-31'::date, NULL,
        ${transaction.json(browserItemsSnapshot)}, statement_timestamp()
      )
    `;
    await transaction`
      INSERT INTO public.events (
        id, tenant_id, order_id, item_id, event_type, description, user_id,
        payload, status, station, created_at, client_event_id,
        event_schema_version, correlation_id, aggregate_version, from_station
      ) VALUES (
        ${FREEZE_EVENT_ID}, ${TENANT_ID}, ${ORDER_ID}, NULL, 'ORDER_FROZEN_V1',
        'Order frozen from galvanik to fertig', ${USER_ID}::uuid,
        ${transaction.json(FREEZE_PAYLOAD)},
        'success', 'fertig', ${FREEZE_INSTANT}::timestamptz AT TIME ZONE 'UTC',
        ${FREEZE_CLIENT_EVENT_ID}::uuid, 1, ${FREEZE_CORRELATION_ID}::uuid,
        ${ORDER_VERSION}, 'galvanik'
      )
    `;
    await transaction`
      INSERT INTO public.events (
        id, tenant_id, order_id, item_id, event_type, description, user_id,
        payload, status, station, created_at, client_event_id,
        event_schema_version, correlation_id, aggregate_version, from_station
      ) VALUES (
        ${BROWSER_FREEZE_EVENT_ID}, ${TENANT_ID}, ${BROWSER_ORDER_ID}, NULL, 'ORDER_FROZEN_V1',
        'Browser order frozen from galvanik to fertig', ${USER_ID}::uuid,
        ${transaction.json({ ...FREEZE_PAYLOAD, freezeId: BROWSER_FREEZE_ID })},
        'success', 'fertig', ${FREEZE_INSTANT}::timestamptz AT TIME ZONE 'UTC',
        ${BROWSER_FREEZE_CLIENT_EVENT_ID}::uuid, 1, ${BROWSER_FREEZE_CORRELATION_ID}::uuid,
        ${ORDER_VERSION}, 'galvanik'
      )
    `;
    await transaction`
      INSERT INTO public.events (
        id, tenant_id, order_id, item_id, event_type, description, user_id,
        payload, status, station, created_at, client_event_id,
        event_schema_version, correlation_id, aggregate_version, from_station
      ) VALUES (
        ${RACE_FREEZE_EVENT_ID}, ${TENANT_ID}, ${RACE_ORDER_ID}, NULL, 'ORDER_FROZEN_V1',
        'Race order frozen from galvanik to fertig', ${USER_ID}::uuid,
        ${transaction.json({ ...FREEZE_PAYLOAD, freezeId: RACE_FREEZE_ID })},
        'success', 'fertig', ${FREEZE_INSTANT}::timestamptz AT TIME ZONE 'UTC',
        ${RACE_FREEZE_CLIENT_EVENT_ID}::uuid, 1, ${RACE_FREEZE_CORRELATION_ID}::uuid,
        ${ORDER_VERSION}, 'galvanik'
      )
    `;
    await transaction`
      INSERT INTO private.order_freezes (
        id, tenant_id, order_id, event_id, hourly_rate_id,
        hourly_rate_cents, total_amount_cents, line_count, order_version,
        frozen_by, frozen_at
      ) VALUES (
        ${FREEZE_ID}::uuid, ${TENANT_ID}, ${ORDER_ID}, ${FREEZE_EVENT_ID},
        ${RATE_ID}::uuid, 12000, 0, 0, ${ORDER_VERSION}, ${USER_ID}::uuid,
        ${FREEZE_INSTANT}::timestamptz
      )
    `;
    await transaction`
      INSERT INTO private.order_freezes (
        id, tenant_id, order_id, event_id, hourly_rate_id,
        hourly_rate_cents, total_amount_cents, line_count, order_version,
        frozen_by, frozen_at
      ) VALUES (
        ${BROWSER_FREEZE_ID}::uuid, ${TENANT_ID}, ${BROWSER_ORDER_ID}, ${BROWSER_FREEZE_EVENT_ID},
        ${RATE_ID}::uuid, 12000, 0, 0, ${ORDER_VERSION}, ${USER_ID}::uuid,
        ${FREEZE_INSTANT}::timestamptz
      )
    `;
    await transaction`
      INSERT INTO private.order_freezes (
        id, tenant_id, order_id, event_id, hourly_rate_id,
        hourly_rate_cents, total_amount_cents, line_count, order_version,
        frozen_by, frozen_at
      ) VALUES (
        ${RACE_FREEZE_ID}::uuid, ${TENANT_ID}, ${RACE_ORDER_ID}, ${RACE_FREEZE_EVENT_ID},
        ${RATE_ID}::uuid, 12000, 0, 0, ${ORDER_VERSION}, ${USER_ID}::uuid,
        ${FREEZE_INSTANT}::timestamptz
      )
    `;
  });
}

async function mutationCounts() {
  const [counts] = await sql<{
    invoice_count: number;
    created_event_count: number;
    cancelled_event_count: number;
  }[]>`
    SELECT
      (SELECT count(*)::integer FROM public.invoices
       WHERE tenant_id = ${TENANT_ID} AND order_id = ${ORDER_ID}) AS invoice_count,
      (SELECT count(*)::integer FROM public.events
       WHERE tenant_id = ${TENANT_ID}
         AND event_type = 'INVOICE_CREATED_V1'
         AND order_id = ${ORDER_ID}) AS created_event_count,
      (SELECT count(*)::integer FROM public.events
       WHERE tenant_id = ${TENANT_ID}
         AND event_type = 'INVOICE_CANCELLED_V1'
         AND order_id = ${ORDER_ID}) AS cancelled_event_count
  `;
  if (!counts) throw new Error("F1_4_COUNT_READBACK_MISSING");
  return counts;
}

/** Tenant-wide invoice, lifecycle-event and number-counter state. */
async function tenantState() {
  const [state] = await sql<{
    invoice_count: number;
    created_event_count: number;
    cancelled_event_count: number;
    last_number: number;
  }[]>`
    SELECT
      (SELECT count(*)::integer FROM public.invoices
       WHERE tenant_id = ${TENANT_ID}) AS invoice_count,
      (SELECT count(*)::integer FROM public.events
       WHERE tenant_id = ${TENANT_ID} AND event_type = 'INVOICE_CREATED_V1') AS created_event_count,
      (SELECT count(*)::integer FROM public.events
       WHERE tenant_id = ${TENANT_ID} AND event_type = 'INVOICE_CANCELLED_V1') AS cancelled_event_count,
      (SELECT coalesce(max(last_number), 0)::integer FROM private.invoice_number_sequences
       WHERE tenant_id = ${TENANT_ID}) AS last_number
  `;
  if (!state) throw new Error("F1_4_STATE_READBACK_MISSING");
  return state;
}

describe("F1.4 real DB/command/PDF integration — AUTH_ADAPTER_SYNTHETIC_NOT_ACCEPTANCE", () => {
  it("issues, cancels and reissues with exact PDF/receipt readback and no mutable original", async () => {
    await assertFreshReset();
    await insertPrerequisites();
    setSyntheticSession();

    const { cancelInvoice, createInvoice } = await import("@/lib/server/commands/immutableInvoiceCommand");
    const { confirmPayment } = await import("@/lib/server/commands/confirmPaymentCommand");
    const {
      readInvoiceCancellationReceipt,
      readInvoicePdf,
      readInvoiceReceipt,
      readInvoiceSummaries,
    } = await import("@/lib/server/invoiceRead");
    const {
      recoverInvoiceCancellationCommand,
      recoverInvoiceIssueCommand,
    } = await import("@/modules/accounting/server-public");
    const authorization: AuthorizationSnapshot = {
      userId: USER_ID,
      tenantId: TENANT_ID,
      displayName: "F1.4 Synthetic Meister",
      role: "meister",
      permissions: ["perm_data_orders"],
      active: true,
    };
    const input = {
      orderId: ORDER_ID,
      expectedVersion: ORDER_VERSION,
      clientEventId: ISSUE_CLIENT_EVENT_ID,
    };

    // -----------------------------------------------------------------------
    // No-write evidence. Everything below happens *before* the first successful
    // issuance, so a rejected command can be held against a pristine tenant.
    // -----------------------------------------------------------------------
    const pristineState = await tenantState();
    expect(pristineState).toEqual({
      invoice_count: 0,
      created_event_count: 0,
      cancelled_event_count: 0,
      last_number: 0,
    });

    /**
     * Runs one command that must be rejected and proves that neither an
     * invoice, nor a lifecycle event, nor the number counter moved. The state
     * is compared as an object and byte-wise, so a changed counter cannot hide
     * behind a structurally equal shape.
     */
    const expectNoWrite = async (
      label: string,
      expected: { code: string; message: string },
      run: () => Promise<{ code: string; message?: string }>,
    ): Promise<void> => {
      const before = await tenantState();
      setSyntheticSession();
      const result = await run();
      const after = await tenantState();
      expect({ label, result }).toEqual({ label, result: expected });
      expect({ label, after }).toEqual({ label, after: before });
      expect({ label, after: JSON.stringify(after) })
        .toEqual({ label, after: JSON.stringify(before) });
    };

    // The already existing, deliberately unfinished order never becomes an
    // invoice and never consumes a number.
    await expectNoWrite(
      "unfinished-order",
      {
        code: "VALIDATION_ERROR",
        message: "Nur ein fertiggestellter Auftrag kann in Rechnung gestellt werden.",
      },
      () => createInvoice({
        orderId: UNFINISHED_ORDER_ID,
        expectedVersion: UNFINISHED_ORDER_VERSION,
        clientEventId: ISSUE_UNFINISHED_CLIENT_EVENT_ID,
      }),
    );

    // The real read port, read directly under the deliberately foreign session
    // zone: the service date is Berlin truth, not the UTC and not the session day.
    const berlinSourceRows = await sql.begin(async (transaction) => {
      await transaction.unsafe(`SET LOCAL TIME ZONE '${SESSION_TIME_ZONE}'`);
      await transaction`SELECT set_config('app.tenant_id', ${TENANT_ID}, true)`;
      return transaction<{
        service_date: string;
        utc_date: string;
        session_date: string;
        session_zone: string;
      }[]>`
        SELECT
          to_char(service_date, 'YYYY-MM-DD') AS service_date,
          to_char((frozen_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS utc_date,
          to_char(frozen_at::date, 'YYYY-MM-DD') AS session_date,
          current_setting('TimeZone') AS session_zone
        FROM private.v_invoice_issue_source_v1
        WHERE order_id = ${ORDER_ID}
      `;
    });
    expect(berlinSourceRows).toEqual([{
      service_date: SERVICE_DATE,
      utc_date: "2026-08-21",
      session_date: "2026-08-21",
      session_zone: SESSION_TIME_ZONE,
    }]);

    // An invalid VAT configuration is unreachable in the database itself, so
    // the command is never forced into an artificially impossible state.
    const vatConfigGuard = async (value: number | null): Promise<string> => {
      try {
        await sql.unsafe(
          `UPDATE public.company_settings SET invoice_vat_rate_basis_points = $1
             WHERE id = $2 AND tenant_id = $3`,
          [value, SETTINGS_ID, TENANT_ID],
        );
        return "ACCEPTED";
      } catch (error) {
        return (error as { code?: string }).code ?? "UNKNOWN";
      }
    };
    expect(await vatConfigGuard(0)).toBe("23514");
    expect(await vatConfigGuard(1000)).toBe("23514");
    expect(await vatConfigGuard(null)).toBe("23502");
    const [vatUnchanged] = await sql<{ invoice_vat_rate_basis_points: number }[]>`
      SELECT invoice_vat_rate_basis_points
      FROM public.company_settings
      WHERE id = ${SETTINGS_ID} AND tenant_id = ${TENANT_ID}
    `;
    expect(vatUnchanged?.invoice_vat_rate_basis_points).toBe(1900);

    // -----------------------------------------------------------------------
    // Mandatory master-data matrix. Each field is broken on its own, in every
    // way the schema can actually store, and must fail closed without a write.
    // The matrix runs serially and never reaches the PDF path, because the
    // command validates master data before any number or document exists.
    // -----------------------------------------------------------------------
    const MASTER_DATA_REJECTION = {
      code: "VALIDATION_ERROR",
      message: "Stammdaten für die Rechnungsausgabe sind unvollständig.",
    } as const;
    /** Variants for a text column the schema allows to be NULL. */
    const NULLABLE_TEXT_VARIANTS = [
      { label: "blank", value: "   " as string | number | null },
      { label: "empty", value: "" as string | number | null },
      { label: "null", value: null as string | number | null },
    ] as const;
    /** Variants for a NOT NULL text column: NULL is not storable at all. */
    const REQUIRED_TEXT_VARIANTS = NULLABLE_TEXT_VARIANTS.filter(
      (variant) => variant.value !== null,
    );

    const masterFields = [
      { table: "company_settings", id: SETTINGS_ID, column: "company_name", variants: REQUIRED_TEXT_VARIANTS },
      { table: "company_settings", id: SETTINGS_ID, column: "street", variants: NULLABLE_TEXT_VARIANTS },
      { table: "company_settings", id: SETTINGS_ID, column: "zip", variants: NULLABLE_TEXT_VARIANTS },
      { table: "company_settings", id: SETTINGS_ID, column: "city", variants: NULLABLE_TEXT_VARIANTS },
      { table: "company_settings", id: SETTINGS_ID, column: "country", variants: NULLABLE_TEXT_VARIANTS },
      { table: "company_settings", id: SETTINGS_ID, column: "tax_id", variants: NULLABLE_TEXT_VARIANTS },
      { table: "company_settings", id: SETTINGS_ID, column: "iban", variants: NULLABLE_TEXT_VARIANTS },
      { table: "company_settings", id: SETTINGS_ID, column: "bic", variants: NULLABLE_TEXT_VARIANTS },
      { table: "company_settings", id: SETTINGS_ID, column: "bank_name", variants: NULLABLE_TEXT_VARIANTS },
      { table: "customers", id: CUSTOMER_ID, column: "name", variants: REQUIRED_TEXT_VARIANTS },
      { table: "customers", id: CUSTOMER_ID, column: "street", variants: NULLABLE_TEXT_VARIANTS },
      { table: "customers", id: CUSTOMER_ID, column: "zip_code", variants: NULLABLE_TEXT_VARIANTS },
      { table: "customers", id: CUSTOMER_ID, column: "city", variants: NULLABLE_TEXT_VARIANTS },
      { table: "customers", id: CUSTOMER_ID, column: "country", variants: NULLABLE_TEXT_VARIANTS },
      { table: "orders", id: ORDER_ID, column: "order_number", variants: REQUIRED_TEXT_VARIANTS },
      { table: "orders", id: ORDER_ID, column: "title", variants: REQUIRED_TEXT_VARIANTS },
      { table: "items", id: ITEM_ID, column: "name", variants: REQUIRED_TEXT_VARIANTS },
      {
        table: "items", id: ITEM_ID, column: "quantity",
        // NOT NULL with an integer default: only an unusable amount is storable.
        variants: [
          { label: "zero", value: 0 as string | number | null },
          { label: "negative", value: -1 as string | number | null },
        ],
      },
      {
        table: "items", id: ITEM_ID, column: "preis_netto",
        variants: [
          { label: "negative", value: -1 as string | number | null },
          { label: "null", value: null as string | number | null },
        ],
      },
    ] as const;

    for (const field of masterFields) {
      const [originalRow] = await sql.unsafe<{ value: string | number | null }[]>(
        `SELECT ${field.column} AS value FROM public.${field.table}
           WHERE id = $1 AND tenant_id = $2`,
        [field.id, TENANT_ID],
      );
      if (!originalRow) {
        throw new Error(`F1_4_MASTER_FIXTURE_MISSING:${field.table}.${field.column}`);
      }
      const originalValue = originalRow.value;

      for (const variant of field.variants) {
        const label = `${field.table}.${field.column}/${variant.label}`;
        try {
          await sql.unsafe(
            `UPDATE public.${field.table} SET ${field.column} = $1
               WHERE id = $2 AND tenant_id = $3`,
            [variant.value, field.id, TENANT_ID],
          );
          await expectNoWrite(label, MASTER_DATA_REJECTION, () => createInvoice({
            orderId: ORDER_ID,
            expectedVersion: ORDER_VERSION,
            clientEventId: randomUUID(),
          }));
        } finally {
          // The fixture is restored even when the assertion above failed, so a
          // single broken case can never cascade into the rest of the suite.
          await sql.unsafe(
            `UPDATE public.${field.table} SET ${field.column} = $1
               WHERE id = $2 AND tenant_id = $3`,
            [originalValue, field.id, TENANT_ID],
          );
        }
      }
    }

    // The restored fixture is proven by the very next issuance succeeding.
    await expect(tenantState()).resolves.toEqual(pristineState);

    setSyntheticSession();
    const issued = await createInvoice(input);
    expect(issued.code).toBe("OK");
    if (issued.code !== "OK") throw new Error(`F1_4_ISSUE_FAILED:${issued.code}`);
    expect(issued.replayed).toBe(false);
    expect(issued.receipt).toMatchObject({
      orderId: ORDER_ID,
      orderVersion: ORDER_VERSION,
      clientEventId: ISSUE_CLIENT_EVENT_ID,
      issuedBy: USER_ID,
      aggregateVersion: 1,
      eventSchemaVersion: 1,
      status: "issued",
    });
    expect(issued.receipt.invoiceNumber).toMatch(/^R-[0-9]{4}-0001$/);

    // Berlin is the service-date truth: the freeze instant is 2026-08-21 in UTC
    // and in the deliberately foreign Pacific/Honolulu session zone, but
    // 2026-08-22 in Berlin. The zone itself, the instant expressions and the
    // real read port are evaluated in exactly one session, because the ALTER
    // ROLE above only reaches sessions opened after it and never retroactively
    // changes an already established pooled connection.
    const [zones] = await sql.begin(async (transaction) => {
      await transaction.unsafe(`SET LOCAL TIME ZONE '${SESSION_TIME_ZONE}'`);
      await transaction`SELECT set_config('app.tenant_id', ${TENANT_ID}, true)`;
      return transaction<{
        session_zone: string;
        utc_date: string;
        session_date: string;
        view_service_date: string;
      }[]>`
        SELECT
          current_setting('TimeZone') AS session_zone,
          to_char((${FREEZE_INSTANT}::timestamptz AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS utc_date,
          to_char(${FREEZE_INSTANT}::timestamptz::date, 'YYYY-MM-DD') AS session_date,
          (
            SELECT to_char(source.service_date, 'YYYY-MM-DD')
            FROM private.v_invoice_issue_source_v1 source
            WHERE source.order_id = ${ORDER_ID}
          ) AS view_service_date
      `;
    });
    expect(zones?.session_zone).toBe(SESSION_TIME_ZONE);
    expect(zones?.session_zone).not.toBe("Europe/Berlin");
    expect(zones?.utc_date).toBe("2026-08-21");
    expect(zones?.session_date).toBe("2026-08-21");
    expect(zones?.view_service_date).toBe(SERVICE_DATE);
    expect(issued.receipt.serviceDate).toBe(SERVICE_DATE);

    const [stored] = await sql<{
      id: string;
      order_version: number;
      snapshot: {
        order: { orderId: string; orderVersion: number; freezeId: string };
        totals: { grossAmountCents: number };
      };
      gross_amount_cents: number;
      payment_contract_version: number;
      payment_mode: string;
      payment_status: string;
      payment_open_amount_cents: number;
      payment_paid_amount_cents: number;
      payment_currency: string;
      payment_method: string | null;
      payment_paid_at: Date | null;
      payment_receipt_id: string | null;
      payment_event_id: string | null;
      payment_correlation_id: string | null;
      payment_version: number;
      pdf_content: Buffer;
      pdf_sha256: string;
      calculated_pdf_sha256: string;
      pdf_bytes: number;
    }[]>`
      SELECT
        id::text,
        order_version,
        snapshot,
        gross_amount_cents,
        payment_contract_version,
        payment_mode,
        payment_status,
        payment_open_amount_cents,
        payment_paid_amount_cents,
        payment_currency,
        payment_method,
        payment_paid_at,
        payment_receipt_id,
        payment_event_id,
        payment_correlation_id::text,
        payment_version,
        pdf_content,
        pdf_sha256,
        encode(sha256(pdf_content), 'hex') AS calculated_pdf_sha256,
        octet_length(pdf_content)::integer AS pdf_bytes
      FROM public.invoices
      WHERE tenant_id = ${TENANT_ID}
        AND order_id = ${ORDER_ID}
    `;
    expect(stored).toBeDefined();
    expect(stored?.order_version).toBe(ORDER_VERSION);
    expect(stored?.snapshot.order).toMatchObject({
      orderId: ORDER_ID,
      orderVersion: ORDER_VERSION,
      freezeId: FREEZE_ID,
    });
    expect(stored).toMatchObject({
      payment_contract_version: 1,
      payment_mode: "vorkasse",
      payment_status: "offen",
      payment_open_amount_cents: stored?.gross_amount_cents,
      payment_paid_amount_cents: 0,
      payment_currency: "EUR",
      payment_method: null,
      payment_paid_at: null,
      payment_receipt_id: null,
      payment_event_id: null,
      payment_correlation_id: null,
      payment_version: 0,
    });
    expect(stored?.pdf_bytes).toBeGreaterThan(0);
    expect(stored?.calculated_pdf_sha256).toBe(stored?.pdf_sha256);
    expect(stored?.pdf_sha256).toBe(issued.receipt.pdfSha256);

    const receiptRows = await sql.begin(async (transaction) => {
      await transaction`SELECT set_config('app.tenant_id', ${TENANT_ID}, true)`;
      return transaction<{
        invoice_id: string;
        order_version: number;
        pdf_sha256: string;
        integrity_ok: boolean;
      }[]>`
        SELECT invoice_id::text, order_version, pdf_sha256, integrity_ok
        FROM private.v_invoice_receipt_v1
        WHERE client_event_id = ${ISSUE_CLIENT_EVENT_ID}::uuid
          AND event_type = 'INVOICE_CREATED_V1'
      `;
    });
    expect(receiptRows).toEqual([{
      invoice_id: issued.receipt.invoiceId,
      order_version: ORDER_VERSION,
      pdf_sha256: issued.receipt.pdfSha256,
      integrity_ok: true,
    }]);
    await expect(mutationCounts()).resolves.toEqual({
      invoice_count: 1,
      created_event_count: 1,
      cancelled_event_count: 0,
    });

    // Exactly one issue instant on invoice, snapshot, lifecycle event and receipt.
    const [issueInstants] = await sql<{
      invoice_issued_at: string;
      snapshot_issued_at: string;
      event_created_at: string;
      berlin_due_date: string;
    }[]>`
      SELECT
        to_char(invoice.issued_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          AS invoice_issued_at,
        invoice.snapshot->>'issuedAt' AS snapshot_issued_at,
        to_char(event.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS event_created_at,
        to_char(
          (invoice.issued_at AT TIME ZONE 'Europe/Berlin')::date + invoice.payment_term_days,
          'YYYY-MM-DD'
        ) AS berlin_due_date
      FROM public.invoices invoice
      JOIN public.events event ON event.id = invoice.issue_event_id
      WHERE invoice.id = ${issued.receipt.invoiceId}::uuid
    `;
    expect(issueInstants).toEqual({
      invoice_issued_at: issued.receipt.issuedAt,
      snapshot_issued_at: issued.receipt.issuedAt,
      event_created_at: issued.receipt.issuedAt,
      berlin_due_date: issued.receipt.dueDate,
    });

    const receiptRead = await readInvoiceReceipt(
      authorization,
      { orderId: ORDER_ID, clientEventId: ISSUE_CLIENT_EVENT_ID },
    );
    expect(receiptRead).toMatchObject({ code: "OK", data: issued.receipt });
    if (receiptRead.code !== "OK") throw new Error("F1_4_RECEIPT_READ_FAILED");
    expect(receiptRead.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    setSyntheticSession();
    const recoveredIssue = await recoverInvoiceIssueCommand({
      kind: "invoice_issued",
      intentId: ISSUE_CLIENT_EVENT_ID,
      idempotencyKey: ISSUE_CLIENT_EVENT_ID,
      aggregateId: ORDER_ID,
      expectedVersion: ORDER_VERSION,
      expectedAmount: null,
      expectedMethod: null,
      expectedReason: null,
    });
    expect(recoveredIssue).toMatchObject({
      state: "resolved",
      receipt: {
        invoiceId: issued.receipt.invoiceId,
        intentId: ISSUE_CLIENT_EVENT_ID,
        idempotencyKey: ISSUE_CLIENT_EVENT_ID,
      },
    });

    const absentIssueId = randomUUID();
    setSyntheticSession();
    await expect(recoverInvoiceIssueCommand({
      kind: "invoice_issued",
      intentId: absentIssueId,
      idempotencyKey: absentIssueId,
      aggregateId: ORDER_ID,
      expectedVersion: ORDER_VERSION,
      expectedAmount: null,
      expectedMethod: null,
      expectedReason: null,
    })).resolves.toMatchObject({
      state: "not_committed",
      retry: "same_idempotency_key_only",
    });

    const pdfRead = await readInvoicePdf(
      authorization,
      issued.receipt.invoiceId,
    );
    expect(pdfRead.code).toBe("OK");
    if (pdfRead.code !== "OK" || !stored) throw new Error("F1_4_PDF_READBACK_FAILED");
    expect(pdfRead.data.pdf.equals(Buffer.from(stored.pdf_content))).toBe(true);
    expect(pdfRead.data.pdfSha256).toBe(stored.pdf_sha256);

    setSyntheticSession();
    const exactReplay = await createInvoice(input);
    expect(exactReplay).toEqual({ code: "OK", receipt: issued.receipt, replayed: true });
    await expect(mutationCounts()).resolves.toEqual({
      invoice_count: 1,
      created_event_count: 1,
      cancelled_event_count: 0,
    });

    setSyntheticSession();
    await expect(createInvoice({ ...input, expectedVersion: ORDER_VERSION + 1 }))
      .resolves.toEqual({
        code: "CONFLICT",
        message: "Anfragekennung wurde bereits anders verwendet.",
      });
    await expect(mutationCounts()).resolves.toEqual({
      invoice_count: 1,
      created_event_count: 1,
      cancelled_event_count: 0,
    });

    const cancelInput = {
      invoiceId: issued.receipt.invoiceId,
      expectedVersion: 1,
      reason: "Doppelte Berechnung vollständig storniert",
      clientEventId: CANCEL_CLIENT_EVENT_ID,
    };
    setSyntheticSession();
    const cancelled = await cancelInvoice(cancelInput);
    expect(cancelled.code).toBe("OK");
    if (cancelled.code !== "OK") throw new Error(`F1_4_CANCEL_FAILED:${cancelled.code}`);
    expect(cancelled.replayed).toBe(false);
    expect(cancelled.receipt).toMatchObject({
      invoiceId: issued.receipt.invoiceId,
      invoiceNumber: issued.receipt.invoiceNumber,
      orderId: ORDER_ID,
      orderVersion: ORDER_VERSION,
      reason: cancelInput.reason,
      expectedVersion: 1,
      aggregateVersion: 2,
      status: "cancelled",
      originalPdfSha256: issued.receipt.pdfSha256,
    });
    await expect(mutationCounts()).resolves.toEqual({
      invoice_count: 1,
      created_event_count: 1,
      cancelled_event_count: 1,
    });

    const [storedCancelled] = await sql<{
      status: string;
      aggregate_version: number;
      pdf_content: Buffer;
      pdf_sha256: string;
      cancellation_pdf_content: Buffer;
      cancellation_pdf_sha256: string;
      calculated_cancellation_sha256: string;
      cancel_reason: string;
    }[]>`
      SELECT
        status,
        aggregate_version,
        pdf_content,
        pdf_sha256,
        cancellation_pdf_content,
        cancellation_pdf_sha256,
        encode(sha256(cancellation_pdf_content), 'hex') AS calculated_cancellation_sha256,
        cancel_reason
      FROM public.invoices
      WHERE id = ${issued.receipt.invoiceId}::uuid
    `;
    expect(storedCancelled).toBeDefined();
    expect(storedCancelled).toMatchObject({
      status: "cancelled",
      aggregate_version: 2,
      pdf_sha256: issued.receipt.pdfSha256,
      cancellation_pdf_sha256: cancelled.receipt.cancellationPdfSha256,
      calculated_cancellation_sha256: cancelled.receipt.cancellationPdfSha256,
      cancel_reason: cancelInput.reason,
    });
    expect(Buffer.from(storedCancelled?.pdf_content ?? []).equals(Buffer.from(stored.pdf_content))).toBe(true);

    // Exactly one cancellation instant on invoice, lifecycle event and receipt.
    const [cancelInstants] = await sql<{
      invoice_cancelled_at: string;
      event_created_at: string;
    }[]>`
      SELECT
        to_char(invoice.cancelled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          AS invoice_cancelled_at,
        to_char(event.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS event_created_at
      FROM public.invoices invoice
      JOIN public.events event ON event.id = invoice.cancel_event_id
      WHERE invoice.id = ${issued.receipt.invoiceId}::uuid
    `;
    expect(cancelInstants).toEqual({
      invoice_cancelled_at: cancelled.receipt.cancelledAt,
      event_created_at: cancelled.receipt.cancelledAt,
    });

    const cancellationReceiptRead = await readInvoiceCancellationReceipt(authorization, {
      invoiceId: issued.receipt.invoiceId,
      clientEventId: CANCEL_CLIENT_EVENT_ID,
    });
    expect(cancellationReceiptRead).toMatchObject({ code: "OK", data: cancelled.receipt });
    if (cancellationReceiptRead.code !== "OK") throw new Error("F1_4_CANCEL_RECEIPT_READ_FAILED");
    expect(cancellationReceiptRead.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    setSyntheticSession();
    await expect(recoverInvoiceCancellationCommand({
      kind: "invoice_cancelled",
      intentId: CANCEL_CLIENT_EVENT_ID,
      idempotencyKey: CANCEL_CLIENT_EVENT_ID,
      aggregateId: issued.receipt.invoiceId,
      expectedVersion: 1,
      expectedAmount: null,
      expectedMethod: null,
      expectedReason: cancelInput.reason,
    })).resolves.toMatchObject({
      state: "resolved",
      receipt: {
        invoiceId: issued.receipt.invoiceId,
        intentId: CANCEL_CLIENT_EVENT_ID,
        idempotencyKey: CANCEL_CLIENT_EVENT_ID,
      },
    });

    const cancellationPdfRead = await readInvoicePdf(
      authorization,
      issued.receipt.invoiceId,
      "cancellation",
    );
    expect(cancellationPdfRead.code).toBe("OK");
    if (cancellationPdfRead.code !== "OK" || !storedCancelled) {
      throw new Error("F1_4_CANCELLATION_PDF_READBACK_FAILED");
    }
    expect(cancellationPdfRead.data.pdf.equals(Buffer.from(storedCancelled.cancellation_pdf_content))).toBe(true);
    expect(cancellationPdfRead.data.pdfSha256).toBe(cancelled.receipt.cancellationPdfSha256);

    const originalAfterCancellation = await readInvoicePdf(
      authorization,
      issued.receipt.invoiceId,
      "original",
    );
    expect(originalAfterCancellation.code).toBe("OK");
    if (originalAfterCancellation.code !== "OK") throw new Error("F1_4_ORIGINAL_AFTER_CANCEL_MISSING");
    expect(originalAfterCancellation.data.pdf.equals(Buffer.from(stored.pdf_content))).toBe(true);
    expect(originalAfterCancellation.data.pdfSha256).toBe(issued.receipt.pdfSha256);
    await expect(readInvoiceReceipt(authorization, {
      orderId: ORDER_ID,
      clientEventId: ISSUE_CLIENT_EVENT_ID,
    })).resolves.toMatchObject({ code: "OK", data: issued.receipt });

    setSyntheticSession();
    await expect(cancelInvoice(cancelInput)).resolves.toEqual({
      code: "OK",
      receipt: cancelled.receipt,
      replayed: true,
    });
    setSyntheticSession();
    await expect(cancelInvoice({ ...cancelInput, reason: "Anderer zulässiger Stornogrund" }))
      .resolves.toMatchObject({ code: "CONFLICT" });
    setSyntheticSession();
    await expect(cancelInvoice({ ...cancelInput, expectedVersion: 2 }))
      .resolves.toMatchObject({ code: "CONFLICT" });
    await expect(mutationCounts()).resolves.toEqual({
      invoice_count: 1,
      created_event_count: 1,
      cancelled_event_count: 1,
    });

    setSyntheticSession();
    const reissued = await createInvoice({
      orderId: ORDER_ID,
      expectedVersion: ORDER_VERSION,
      clientEventId: REISSUE_CLIENT_EVENT_ID,
    });
    expect(reissued.code).toBe("OK");
    if (reissued.code !== "OK") throw new Error(`F1_4_REISSUE_FAILED:${reissued.code}`);
    expect(reissued.replayed).toBe(false);
    expect(reissued.receipt.invoiceId).not.toBe(issued.receipt.invoiceId);
    expect(reissued.receipt.invoiceNumber).toMatch(/^R-[0-9]{4}-0002$/);
    await expect(mutationCounts()).resolves.toEqual({
      invoice_count: 2,
      created_event_count: 2,
      cancelled_event_count: 1,
    });

    const summaries = await readInvoiceSummaries(authorization);
    expect(summaries.code).toBe("OK");
    if (summaries.code !== "OK") throw new Error("F1_4_SUMMARY_READ_FAILED");
    expect(summaries.data).toHaveLength(2);
    expect(summaries.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        invoiceId: issued.receipt.invoiceId,
        status: "cancelled",
        aggregateVersion: 2,
        originalPdfSha256: issued.receipt.pdfSha256,
        cancellationPdfSha256: cancelled.receipt.cancellationPdfSha256,
      }),
      expect.objectContaining({
        invoiceId: reissued.receipt.invoiceId,
        invoiceNumber: reissued.receipt.invoiceNumber,
        status: "issued",
        aggregateVersion: 1,
      }),
    ]));

    setSyntheticSession();
    const cancelledReissue = await cancelInvoice({
      invoiceId: reissued.receipt.invoiceId,
      expectedVersion: 1,
      reason: "Neuausstellung mit konfiguriertem Steuersatz",
      clientEventId: CANCEL_REISSUE_CLIENT_EVENT_ID,
    });
    expect(cancelledReissue.code).toBe("OK");
    if (cancelledReissue.code !== "OK") {
      throw new Error(`F1_4_REISSUE_CANCEL_FAILED:${cancelledReissue.code}`);
    }
    await expect(mutationCounts()).resolves.toEqual({
      invoice_count: 2,
      created_event_count: 2,
      cancelled_event_count: 2,
    });

    try {
      await sql`
        UPDATE public.company_settings
        SET invoice_vat_rate_basis_points = 700
        WHERE tenant_id = ${TENANT_ID} AND id = ${SETTINGS_ID}
      `;
      await expectNoWrite(
        "company_settings.invoice_vat_rate_basis_points/700",
        MASTER_DATA_REJECTION,
        () => createInvoice({
          orderId: ORDER_ID,
          expectedVersion: ORDER_VERSION,
          clientEventId: ISSUE_SEVEN_PERCENT_CLIENT_EVENT_ID,
        }),
      );
    } finally {
      await sql`
        UPDATE public.company_settings
        SET invoice_vat_rate_basis_points = 1900
        WHERE tenant_id = ${TENANT_ID} AND id = ${SETTINGS_ID}
      `;
    }
    await expect(mutationCounts()).resolves.toEqual({
      invoice_count: 2,
      created_event_count: 2,
      cancelled_event_count: 2,
    });

    // The original payment term is captured before it is broken, so the finally
    // below restores exactly the configured value instead of a hardcoded one.
    const [termFixture] = await sql<{ invoice_payment_term_days: number | null }[]>`
      SELECT invoice_payment_term_days
      FROM public.company_settings
      WHERE tenant_id = ${TENANT_ID} AND id = ${SETTINGS_ID}
    `;
    const originalPaymentTermDays = termFixture?.invoice_payment_term_days ?? null;
    expect(originalPaymentTermDays).toBe(14);
    try {
      await sql`
        UPDATE public.company_settings
        SET invoice_payment_term_days = NULL
        WHERE tenant_id = ${TENANT_ID} AND id = ${SETTINGS_ID}
      `;
      // The missing payment term is held to the same no-write standard as the
      // master-data matrix above: invoice, event and counter state stay identical.
      await expectNoWrite(
        "company_settings.invoice_payment_term_days/null",
        MASTER_DATA_REJECTION,
        () => createInvoice({
          orderId: ORDER_ID,
          expectedVersion: ORDER_VERSION,
          clientEventId: ISSUE_MISSING_TERM_CLIENT_EVENT_ID,
        }),
      );
      await expect(mutationCounts()).resolves.toEqual({
        invoice_count: 2,
        created_event_count: 2,
        cancelled_event_count: 2,
      });
      const [sequence] = await sql<{ last_number: number }[]>`
        SELECT last_number
        FROM private.invoice_number_sequences
        WHERE tenant_id = ${TENANT_ID}
      `;
      expect(sequence?.last_number).toBe(2);
    } finally {
      // The fixture is restored even when an assertion above failed, so the
      // tenant is never left behind with a fail-closed payment term.
      await sql`
        UPDATE public.company_settings
        SET invoice_payment_term_days = ${originalPaymentTermDays}
        WHERE tenant_id = ${TENANT_ID} AND id = ${SETTINGS_ID}
      `;
    }
    const [restoredTerm] = await sql<{ invoice_payment_term_days: number | null }[]>`
      SELECT invoice_payment_term_days
      FROM public.company_settings
      WHERE tenant_id = ${TENANT_ID} AND id = ${SETTINGS_ID}
    `;
    expect(restoredTerm?.invoice_payment_term_days).toBe(originalPaymentTermDays);

    // Payment truth and cancellation share the same locked invoice row. A
    // missing payment contract, a one-cent partial payment and a full payment
    // must all leave invoice, PDF and payment facts untouched by cancellation.
    setSyntheticSession();
    const paymentGuardInvoice = await createInvoice({
      orderId: ORDER_ID,
      expectedVersion: ORDER_VERSION,
      clientEventId: ISSUE_PAYMENT_GUARD_CLIENT_EVENT_ID,
    });
    expect(paymentGuardInvoice.code).toBe("OK");
    if (paymentGuardInvoice.code !== "OK") {
      throw new Error(`F1_4_PAYMENT_GUARD_ISSUE_FAILED:${paymentGuardInvoice.code}`);
    }

    const readGuardState = async () => {
      const [state] = await sql<{
        status: string;
        aggregate_version: number;
        payment_contract_version: number | null;
        payment_status: string | null;
        payment_open_amount_cents: number | null;
        payment_paid_amount_cents: number | null;
        payment_version: number;
        pdf_sha256: string;
        cancel_event_id: string | null;
        payment_event_id: string | null;
        cancellation_event_count: number;
        payment_event_count: number;
      }[]>`
        SELECT
          invoice.status,
          invoice.aggregate_version,
          invoice.payment_contract_version,
          invoice.payment_status,
          invoice.payment_open_amount_cents,
          invoice.payment_paid_amount_cents,
          invoice.payment_version,
          invoice.pdf_sha256,
          invoice.cancel_event_id,
          invoice.payment_event_id,
          (
            SELECT count(*)::integer
            FROM public.events event
            WHERE event.tenant_id = ${TENANT_ID}
              AND event.event_type = 'INVOICE_CANCELLED_V1'
              AND event.payload ->> 'invoiceId' = ${paymentGuardInvoice.receipt.invoiceId}
          ) AS cancellation_event_count
          ,(
            SELECT count(*)::integer
            FROM public.events event
            WHERE event.tenant_id = ${TENANT_ID}
              AND event.event_type = 'PAYMENT_CONFIRMED_V1'
              AND event.payload ->> 'invoiceId' = ${paymentGuardInvoice.receipt.invoiceId}
          ) AS payment_event_count
        FROM public.invoices invoice
        WHERE invoice.id = ${paymentGuardInvoice.receipt.invoiceId}::uuid
      `;
      if (!state) throw new Error("F1_4_PAYMENT_GUARD_STATE_MISSING");
      return state;
    };

    // Deliberately inject a local-only damaged legacy payment marker. The
    // immutable trigger is disabled only for this fixture write and restored
    // in the same finally block; production code and migrations are untouched.
    await sql.unsafe("ALTER TABLE public.invoices DISABLE TRIGGER invoices_f14_update_guard");
    try {
      await sql`
        UPDATE public.invoices
        SET payment_contract_version = NULL
        WHERE id = ${paymentGuardInvoice.receipt.invoiceId}::uuid
          AND tenant_id = ${TENANT_ID}
      `;
    } finally {
      await sql.unsafe("ALTER TABLE public.invoices ENABLE TRIGGER invoices_f14_update_guard");
    }
    const corruptState = await readGuardState();
    setSyntheticSession();
    await expect(cancelInvoice({
      invoiceId: paymentGuardInvoice.receipt.invoiceId,
      expectedVersion: 1,
      reason: "Beschädigter Zahlungsstand darf nicht storniert werden",
      clientEventId: CANCEL_CORRUPT_CLIENT_EVENT_ID,
    })).resolves.toMatchObject({ code: "CONFLICT" });
    expect(await readGuardState()).toEqual(corruptState);

    await sql.unsafe("ALTER TABLE public.invoices DISABLE TRIGGER invoices_f14_update_guard");
    try {
      await sql`
        UPDATE public.invoices
        SET payment_contract_version = 1
        WHERE id = ${paymentGuardInvoice.receipt.invoiceId}::uuid
          AND tenant_id = ${TENANT_ID}
      `;
    } finally {
      await sql.unsafe("ALTER TABLE public.invoices ENABLE TRIGGER invoices_f14_update_guard");
    }

    setSyntheticSession();
    const oneCentPayment = await confirmPayment({
      invoiceId: paymentGuardInvoice.receipt.invoiceId,
      amount: 1,
      method: "ueberweisung",
      expectedVersion: 0,
      clientEventId: PARTIAL_PAYMENT_CLIENT_EVENT_ID,
    });
    expect(oneCentPayment.code).toBe("OK");
    if (oneCentPayment.code !== "OK") {
      throw new Error(`F1_4_ONE_CENT_PAYMENT_FAILED:${oneCentPayment.code}`);
    }
    expect(oneCentPayment.receipt).toMatchObject({
      amountCents: 1,
      paidAmountCents: 1,
      openAmountCents: paymentGuardInvoice.receipt.grossAmountCents - 1,
      paymentStatus: "teilbezahlt",
      paymentVersion: 1,
    });
    const partialState = await readGuardState();
    setSyntheticSession();
    await expect(cancelInvoice({
      invoiceId: paymentGuardInvoice.receipt.invoiceId,
      expectedVersion: 1,
      reason: "Teilbezahlte Rechnung darf nicht storniert werden",
      clientEventId: CANCEL_PARTIAL_CLIENT_EVENT_ID,
    })).resolves.toMatchObject({ code: "CONFLICT" });
    expect(await readGuardState()).toEqual(partialState);

    setSyntheticSession();
    const fullPayment = await confirmPayment({
      invoiceId: paymentGuardInvoice.receipt.invoiceId,
      amount: paymentGuardInvoice.receipt.grossAmountCents - 1,
      method: "bar",
      expectedVersion: 1,
      clientEventId: FULL_PAYMENT_CLIENT_EVENT_ID,
    });
    expect(fullPayment.code).toBe("OK");
    if (fullPayment.code !== "OK") {
      throw new Error(`F1_4_FULL_PAYMENT_FAILED:${fullPayment.code}`);
    }
    expect(fullPayment.receipt).toMatchObject({
      paidAmountCents: paymentGuardInvoice.receipt.grossAmountCents,
      openAmountCents: 0,
      paymentStatus: "bezahlt",
      paymentVersion: 2,
    });
    const paidState = await readGuardState();
    setSyntheticSession();
    await expect(cancelInvoice({
      invoiceId: paymentGuardInvoice.receipt.invoiceId,
      expectedVersion: 1,
      reason: "Bezahlte Rechnung darf nicht storniert werden",
      clientEventId: CANCEL_PAID_CLIENT_EVENT_ID,
    })).resolves.toMatchObject({ code: "CONFLICT" });
    expect(await readGuardState()).toEqual(paidState);

    // Durable PAYMENT_CONFIRMED_V1 evidence remains authoritative even if a
    // locally injected damaged aggregate is made to look unpaid again.
    await sql.unsafe("ALTER TABLE public.invoices DISABLE TRIGGER invoices_f14_update_guard");
    try {
      await sql`
        UPDATE public.invoices
        SET payment_status = 'offen',
            payment_open_amount_cents = gross_amount_cents,
            payment_paid_amount_cents = 0,
            payment_method = NULL,
            payment_paid_at = NULL,
            payment_receipt_id = NULL,
            payment_event_id = NULL,
            payment_correlation_id = NULL,
            payment_version = 0
        WHERE id = ${paymentGuardInvoice.receipt.invoiceId}::uuid
          AND tenant_id = ${TENANT_ID}
      `;
    } finally {
      await sql.unsafe("ALTER TABLE public.invoices ENABLE TRIGGER invoices_f14_update_guard");
    }
    const evidenceOnlyState = await readGuardState();
    expect(evidenceOnlyState).toMatchObject({
      payment_status: "offen",
      payment_paid_amount_cents: 0,
      payment_version: 0,
      payment_event_count: 2,
    });
    setSyntheticSession();
    await expect(cancelInvoice({
      invoiceId: paymentGuardInvoice.receipt.invoiceId,
      expectedVersion: 1,
      reason: "Bestätigte Zahlung bleibt trotz beschädigtem Aggregat bindend",
      clientEventId: CANCEL_EVIDENCE_ONLY_CLIENT_EVENT_ID,
    })).resolves.toMatchObject({ code: "CONFLICT" });
    expect(await readGuardState()).toEqual(evidenceOnlyState);

    // A separate unpaid invoice proves real row-lock serialization. Exactly
    // one command wins; the final row can never be cancelled and paid.
    setSyntheticSession();
    const raceInvoice = await createInvoice({
      orderId: RACE_ORDER_ID,
      expectedVersion: ORDER_VERSION,
      clientEventId: RACE_ISSUE_CLIENT_EVENT_ID,
    });
    expect(raceInvoice.code).toBe("OK");
    if (raceInvoice.code !== "OK") {
      throw new Error(`F1_4_RACE_ISSUE_FAILED:${raceInvoice.code}`);
    }
    setSyntheticSession();
    const [raceCancellation, racePayment] = await Promise.all([
      cancelInvoice({
        invoiceId: raceInvoice.receipt.invoiceId,
        expectedVersion: 1,
        reason: "Paralleltest für Storno und Zahlung",
        clientEventId: RACE_CANCEL_CLIENT_EVENT_ID,
      }),
      confirmPayment({
        invoiceId: raceInvoice.receipt.invoiceId,
        amount: 1,
        method: "bar",
        expectedVersion: 0,
        clientEventId: RACE_PAYMENT_CLIENT_EVENT_ID,
      }),
    ]);
    expect([raceCancellation.code, racePayment.code].sort()).toEqual(["CONFLICT", "OK"]);
    const [raceState] = await sql<{
      status: string;
      payment_status: string;
      payment_open_amount_cents: number;
      payment_paid_amount_cents: number;
      payment_version: number;
      cancel_event_id: string | null;
      payment_event_id: string | null;
      cancellation_event_count: number;
      payment_event_count: number;
    }[]>`
      SELECT
        invoice.status,
        invoice.payment_status,
        invoice.payment_open_amount_cents,
        invoice.payment_paid_amount_cents,
        invoice.payment_version,
        invoice.cancel_event_id,
        invoice.payment_event_id,
        count(*) FILTER (WHERE event.event_type = 'INVOICE_CANCELLED_V1')::integer
          AS cancellation_event_count,
        count(*) FILTER (WHERE event.event_type = 'PAYMENT_CONFIRMED_V1')::integer
          AS payment_event_count
      FROM public.invoices invoice
      LEFT JOIN public.events event
        ON event.tenant_id = invoice.tenant_id
       AND event.payload ->> 'invoiceId' = invoice.id::text
       AND event.event_type IN ('INVOICE_CANCELLED_V1', 'PAYMENT_CONFIRMED_V1')
      WHERE invoice.id = ${raceInvoice.receipt.invoiceId}::uuid
      GROUP BY invoice.id
    `;
    expect(raceState).toBeDefined();
    if (raceCancellation.code === "OK") {
      expect(raceState).toMatchObject({
        status: "cancelled",
        payment_status: "offen",
        payment_open_amount_cents: raceInvoice.receipt.grossAmountCents,
        payment_paid_amount_cents: 0,
        payment_version: 0,
        cancellation_event_count: 1,
        payment_event_count: 0,
      });
      expect(raceState?.cancel_event_id).not.toBeNull();
      expect(raceState?.payment_event_id).toBeNull();
    } else {
      expect(racePayment.code).toBe("OK");
      expect(raceState).toMatchObject({
        status: "issued",
        payment_status: "teilbezahlt",
        payment_open_amount_cents: raceInvoice.receipt.grossAmountCents - 1,
        payment_paid_amount_cents: 1,
        payment_version: 1,
        cancellation_event_count: 0,
        payment_event_count: 1,
      });
      expect(raceState?.cancel_event_id).toBeNull();
      expect(raceState?.payment_event_id).not.toBeNull();
    }
    expect(!(raceState?.status === "cancelled" && raceState.payment_paid_amount_cents > 0)).toBe(true);

    await expect(readInvoiceReceipt(foreignAuthorization, {
      orderId: ORDER_ID,
      clientEventId: ISSUE_CLIENT_EVENT_ID,
    })).resolves.toMatchObject({ code: "OK", data: null });
    await expect(readInvoiceCancellationReceipt(foreignAuthorization, {
      invoiceId: issued.receipt.invoiceId,
      clientEventId: CANCEL_CLIENT_EVENT_ID,
    })).resolves.toMatchObject({ code: "OK", data: null });
    await expect(readInvoicePdf(foreignAuthorization, issued.receipt.invoiceId))
      .resolves.toMatchObject({ code: "NOT_FOUND" });
  }, 60_000);
});
