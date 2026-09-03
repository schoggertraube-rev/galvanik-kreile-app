import { createHash, randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

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

const sql = postgres(DATABASE_URL, { max: 4, prepare: false });
const suffix = `${Date.now()}-${process.pid}`;

afterAll(async () => {
  await sql.end({ timeout: 1 });
});

const CANONICAL_NUMBER_PATTERN = "R-[0-9]{4}-[0-9]{4,}";

/**
 * A JSON object exactly as postgres.js accepts it for `sql.json(...)`. The
 * matrix below stores deliberately wrong JSON *types*, which is why the values
 * stay `JSONValue` and are never narrowed to the valid snapshot shape.
 */
type SnapshotJson = { [key: string]: postgres.JSONValue };

type SnapshotParams = {
  orderId: string;
  orderNumber: string;
  freezeId: string;
  itemId: string;
  serviceDate: string;
  issuedAt: string;
  vatRateBasisPoints: 700 | 1900;
};

/** A fully contract-valid F1.4 snapshot; every mandatory path is present. */
function buildSnapshot(params: SnapshotParams): SnapshotJson {
  const netAmountCents = 10000;
  const vatAmountCents = Math.round((netAmountCents * params.vatRateBasisPoints) / 10000);
  return {
    schemaVersion: 1,
    seller: {
      companyName: "F1.4 Synthetic Galvanik GmbH",
      street: "Testweg 1",
      zip: "70173",
      city: "Stuttgart",
      country: "Deutschland",
      taxId: "DE-SYNTHETIC-TAX",
      iban: "DE02120300000000202051",
      bic: "BYLADEM1001",
      bankName: "F1.4 Testbank",
    },
    customer: {
      name: "F1.4 Synthetic Customer",
      companyName: "F1.4 Synthetic Customer GmbH",
      contactPerson: null,
      street: "Kundenweg 2",
      zip: "70174",
      city: "Stuttgart",
      country: "Deutschland",
    },
    order: {
      orderId: params.orderId,
      orderVersion: 2,
      orderNumber: params.orderNumber,
      title: "F1.4 Synthetic Order",
      freezeId: params.freezeId,
    },
    lines: [{
      type: "BASE",
      itemId: params.itemId,
      name: "F1.4 Synthetic Position",
      quantity: 1,
      unitNetAmountCents: netAmountCents,
      lineNetAmountCents: netAmountCents,
    }],
    totals: {
      netAmountCents,
      vatRateBasisPoints: params.vatRateBasisPoints,
      vatAmountCents,
      grossAmountCents: netAmountCents + vatAmountCents,
    },
    serviceDate: params.serviceDate,
    issuedAt: params.issuedAt,
    paymentTermDays: 14,
  };
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolveFn) => {
    resolve = resolveFn;
  });
  return { promise, resolve };
}

const REMOVE_PATH = Symbol("REMOVE_PATH");

/** Returns a deep copy of `base` with exactly one JSON path mutated or removed. */
function mutateSnapshot(
  base: SnapshotJson,
  path: readonly string[],
  value: postgres.JSONValue | typeof REMOVE_PATH,
): SnapshotJson {
  const clone = structuredClone(base);
  let node: SnapshotJson = clone;
  for (const key of path.slice(0, -1)) {
    const next = node[key];
    if (next === null || typeof next !== "object" || Array.isArray(next)) {
      throw new Error(`F1_4_SNAPSHOT_PATH_INVALID:${path.join(".")}`);
    }
    node = next as SnapshotJson;
  }
  const leaf = path[path.length - 1];
  if (leaf === undefined) throw new Error("F1_4_SNAPSHOT_PATH_EMPTY");
  if (value === REMOVE_PATH) delete node[leaf];
  else node[leaf] = value;
  return clone;
}

/**
 * The tagged-template surface shared by the pooled client and a transaction.
 * `TransactionSql` is not a `Sql`, but both extend `ISql`.
 */
type Tx = postgres.ISql;

/** Seeds the tenant-wide master data an F1.4 invoice command depends on. */
async function seedTenant(transaction: Tx, params: {
  tenantId: string;
  userId: string;
  label: string;
  rateId: string;
  paymentTermDays?: number;
}): Promise<void> {
  await transaction`
    INSERT INTO public.app_users
      (id, tenant_id, email, full_name, role, active, created_at, updated_at)
    VALUES (
      ${params.userId}::uuid, ${params.tenantId},
      ${`${params.label}@local.invalid`}, 'F1.4 Synthetic Admin', 'admin', true,
      now(), now()
    )
  `;
  await transaction`
    INSERT INTO public.company_settings (
      id, tenant_id, company_name, street, zip, city, country,
      iban, bic, bank_name, tax_id, invoice_vat_rate_basis_points,
      invoice_payment_term_days
    ) VALUES (
      ${`settings-${params.label}`}, ${params.tenantId}, 'F1.4 Synthetic Galvanik GmbH',
      'Testweg 1', '70173', 'Stuttgart', 'Deutschland',
      'DE02120300000000202051', 'BYLADEM1001', 'F1.4 Testbank',
      'DE-SYNTHETIC-TAX', 1900, ${params.paymentTermDays ?? 14}
    )
  `;
  await transaction`
    INSERT INTO private.extra_work_hourly_rates (
      id, tenant_id, hourly_rate_cents, version, created_by, effective_at
    ) VALUES (${params.rateId}::uuid, ${params.tenantId}, 12000, 1, ${params.userId}::uuid, now())
  `;
}

/**
 * Seeds one customer, one priced order and its final F1.3 freeze. `frozenAt` is
 * the UTC instant of the freeze; the Berlin calendar day derived from it is the
 * service date the read port must expose.
 */
async function seedFrozenOrder(transaction: Tx, params: {
  tenantId: string;
  userId: string;
  rateId: string;
  customerId: string;
  customerNumber: string;
  orderId: string;
  orderNumber: string;
  itemId: string;
  freezeId: string;
  freezeEventId: string;
  freezeClientEventId: string;
  freezeCorrelationId: string;
  frozenAt: string;
}): Promise<void> {
  await transaction`
    INSERT INTO public.customers (
      id, tenant_id, customer_number, name, company_name, type,
      street, zip_code, city, country, created_at, updated_at
    ) VALUES (
      ${params.customerId}, ${params.tenantId}, ${params.customerNumber},
      'F1.4 Synthetic Customer', 'F1.4 Synthetic Customer GmbH', 'business',
      'Kundenweg 2', '70174', 'Stuttgart', 'Deutschland', now(), now()
    )
  `;
  await transaction`
    INSERT INTO public.orders (
      id, tenant_id, order_number, customer_id, title, station,
      current_station, current_station_id, version, status, created_at
    ) VALUES (
      ${params.orderId}, ${params.tenantId}, ${params.orderNumber}, ${params.customerId},
      'F1.4 Synthetic Order', 'fertig', 'fertig', 'fertig', 2, 'fertig', now()
    )
  `;
  await transaction`
    INSERT INTO public.items (
      id, tenant_id, order_id, customer_id, name, quantity,
      current_station_id, preis_netto, created_at
    ) VALUES (
      ${params.itemId}, ${params.tenantId}, ${params.orderId}, ${params.customerId},
      'F1.4 Synthetic Position', 1, 'fertig', 100.00, now()
    )
  `;
  await transaction`
    INSERT INTO public.events (
      id, tenant_id, order_id, item_id, event_type, description, user_id,
      payload, status, station, created_at, client_event_id,
      event_schema_version, correlation_id, aggregate_version, from_station
    ) VALUES (
      ${params.freezeEventId}, ${params.tenantId}, ${params.orderId}, NULL,
      'ORDER_FROZEN_V1', 'Order frozen from galvanik to fertig', ${params.userId}::uuid,
      ${transaction.json({
        freezeId: params.freezeId,
        rateId: params.rateId,
        hourlyRateCents: 12000,
        totalAmountCents: 0,
        lineCount: 0,
      })},
      'success', 'fertig', ${params.frozenAt}::timestamptz AT TIME ZONE 'UTC',
      ${params.freezeClientEventId}::uuid, 1, ${params.freezeCorrelationId}::uuid, 2, 'galvanik'
    )
  `;
  await transaction`
    INSERT INTO private.order_freezes (
      id, tenant_id, order_id, event_id, hourly_rate_id,
      hourly_rate_cents, total_amount_cents, line_count, order_version,
      frozen_by, frozen_at
    ) VALUES (
      ${params.freezeId}::uuid, ${params.tenantId}, ${params.orderId}, ${params.freezeEventId},
      ${params.rateId}::uuid, 12000, 0, 0, 2, ${params.userId}::uuid,
      ${params.frozenAt}::timestamptz
    )
  `;
}

describe("F1.4 immutable invoice database contract", () => {
  it("keeps legacy invoice rows writable while exposing the additive bytea contract", async () => {
    const legacyInvoiceId = randomUUID();
    const legacyTenant = `f14-legacy-${suffix}`;

    const columns = await sql<{ column_name: string; data_type: string }[]>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'invoices'
        AND column_name IN ('contract_version', 'invoice_number', 'pdf_content')
      ORDER BY column_name
    `;
    expect(columns).toEqual([
      { column_name: "contract_version", data_type: "integer" },
      { column_name: "invoice_number", data_type: "text" },
      { column_name: "pdf_content", data_type: "bytea" },
    ]);

    await sql`
      INSERT INTO public.invoices (id, tenant_id, invoice_number, amount_total, status)
      VALUES (${legacyInvoiceId}::uuid, ${legacyTenant}, 'LEGACY-1', 10.00, 'draft')
    `;
    await sql`
      UPDATE public.invoices
      SET amount_total = 12.00, status = 'sent'
      WHERE id = ${legacyInvoiceId}::uuid
    `;
    const [legacy] = await sql<{ amount_total: string; status: string }[]>`
      SELECT amount_total::text AS amount_total, status
      FROM public.invoices
      WHERE id = ${legacyInvoiceId}::uuid
    `;
    expect(legacy).toEqual({ amount_total: "12.00", status: "sent" });
    await sql`DELETE FROM public.invoices WHERE id = ${legacyInvoiceId}::uuid`;
  });

  it("allocates gaplessly across rollback and concurrent committed transactions", async () => {
    const tenantId = `f14-seq-${suffix}`;
    const rollbackSignal = new Error("ROLLBACK_SEQUENCE_TEST");

    await expect(
      sql.begin(async (transaction) => {
        const [allocated] = await transaction<{ invoice_number: string }[]>`
          SELECT private.allocate_invoice_number(${tenantId}, 2026) AS invoice_number
        `;
        expect(allocated?.invoice_number).toBe("R-2026-0001");
        throw rollbackSignal;
      }),
    ).rejects.toBe(rollbackSignal);

    const first = await sql.begin(async (transaction) => {
      const [allocated] = await transaction<{ invoice_number: string }[]>`
        SELECT private.allocate_invoice_number(${tenantId}, 2026) AS invoice_number
      `;
      return allocated?.invoice_number;
    });
    expect(first).toBe("R-2026-0001");

    /**
     * Real concurrency, proven instead of assumed: two distinct backends, the
     * first one holding the allocated sequence row open while the second one is
     * demonstrably waiting on exactly that row lock. The holder is only
     * released after `pg_blocking_pids` names it as the blocker, so the
     * consecutive result is a consequence of the lock, not of scheduling luck.
     */
    const releaseHolder = createDeferred<void>();
    const holderStarted = createDeferred<number>();
    const waiterStarted = createDeferred<number>();

    const holderDone = sql.begin(async (transaction) => {
      const [backend] = await transaction<{ pid: number }[]>`
        SELECT pg_backend_pid()::integer AS pid
      `;
      const [allocated] = await transaction<{ invoice_number: string }[]>`
        SELECT private.allocate_invoice_number(${tenantId}, 2026) AS invoice_number
      `;
      holderStarted.resolve(backend?.pid ?? -1);
      // The row lock is held until the blocking proof below succeeded.
      await releaseHolder.promise;
      return allocated?.invoice_number;
    });
    const holderPid = await holderStarted.promise;

    const waiterDone = sql.begin(async (transaction) => {
      const [backend] = await transaction<{ pid: number }[]>`
        SELECT pg_backend_pid()::integer AS pid
      `;
      waiterStarted.resolve(backend?.pid ?? -1);
      const [allocated] = await transaction<{ invoice_number: string }[]>`
        SELECT private.allocate_invoice_number(${tenantId}, 2026) AS invoice_number
      `;
      return allocated?.invoice_number;
    });
    const waiterPid = await waiterStarted.promise;

    let blockedByHolder = false;
    let holderNumber: string | undefined;
    let waiterNumber: string | undefined;
    try {
      // Bounded, condition-based lock-wait proof. Every attempt is a real
      // round trip against the server, so there is no fixed sleep and no
      // unbounded spin: the loop ends as soon as the wait edge exists, and
      // fails closed after a finite number of attempts.
      for (let attempt = 0; attempt < 500 && !blockedByHolder; attempt += 1) {
        const [probe] = await sql<{ blocked: boolean }[]>`
          SELECT pg_blocking_pids(${waiterPid}::integer) @> ARRAY[${holderPid}::integer]
            AS blocked
        `;
        blockedByHolder = probe?.blocked === true;
      }
    } finally {
      releaseHolder.resolve();
      const [holderResult, waiterResult] = await Promise.allSettled([holderDone, waiterDone]);
      if (holderResult.status === "fulfilled") holderNumber = holderResult.value;
      if (waiterResult.status === "fulfilled") waiterNumber = waiterResult.value;
    }

    // Two different backends really contended for the same sequence row.
    expect(holderPid).toBeGreaterThan(0);
    expect(waiterPid).toBeGreaterThan(0);
    expect(waiterPid).not.toBe(holderPid);
    expect(blockedByHolder).toBe(true);
    // Exactly consecutive and unique, in the order the lock enforced.
    expect(holderNumber).toBe("R-2026-0002");
    expect(waiterNumber).toBe("R-2026-0003");
    expect(new Set([first, holderNumber, waiterNumber]).size).toBe(3);

    await sql`
      DELETE FROM private.invoice_number_sequences
      WHERE tenant_id = ${tenantId} AND invoice_year = 2026
    `;
  });

  it("proves tenant-bound source, immutable issue, marked cancellation, receipts, and denial", async () => {
    const tenantId = `f14-${process.pid}-${Date.now()}`;
    const foreignTenantId = `${tenantId}-foreign`;
    const userId = randomUUID();
    const customerId = `customer-${suffix}`;
    const orderId = `order-${suffix}`;
    const itemId = `item-${suffix}`;
    const rateId = randomUUID();
    const freezeId = randomUUID();
    const freezeEventId = randomUUID();
    const freezeClientEventId = randomUUID();
    const freezeCorrelationId = randomUUID();
    const invoiceId = randomUUID();
    const issueEventId = randomUUID();
    const issueClientEventId = randomUUID();
    const issueCorrelationId = randomUUID();
    const cancelEventId = randomUUID();
    const cancelClientEventId = randomUUID();
    const cancelCorrelationId = randomUUID();
    const issuedAt = "2026-08-21T12:00:00.000Z";
    const cancelledAt = "2026-08-25T09:30:00.000Z";
    const serviceDate = "2026-08-21";
    const dueDate = "2026-09-04";
    const originalPdf = Buffer.from("%PDF-1.4\nF1.4 synthetic original\n%%EOF", "utf8");
    const originalPdfSha256 = createHash("sha256").update(originalPdf).digest("hex");
    const cancellationPdf = Buffer.from("%PDF-1.4\nF1.4 synthetic cancellation\n%%EOF", "utf8");
    const cancellationPdfSha256 = createHash("sha256").update(cancellationPdf).digest("hex");
    const freezePayload = {
      freezeId,
      rateId,
      hourlyRateCents: 12000,
      totalAmountCents: 0,
      lineCount: 0,
    };
    const rollbackSignal = new Error("ROLLBACK_F1_4_CONTRACT_TEST");

    try {
      await sql.begin(async (transaction) => {
        // The session zone is deliberately neither UTC nor Europe/Berlin. Every
        // F1.4 calendar value below must still be Berlin truth.
        await transaction.unsafe("SET LOCAL TIME ZONE 'Pacific/Kiritimati'");
        await transaction`
          INSERT INTO public.app_users
            (id, tenant_id, email, full_name, role, active, created_at, updated_at)
          VALUES (
            ${userId}::uuid,
            ${tenantId},
            ${`f14-${suffix}@local.invalid`},
            'F1.4 Synthetic Admin',
            'admin',
            true,
            now(),
            now()
          )
        `;
        await transaction`
          INSERT INTO public.company_settings (
            id, tenant_id, company_name, street, zip, city, country,
            iban, bic, bank_name, tax_id, invoice_vat_rate_basis_points,
            invoice_payment_term_days
          ) VALUES (
            ${`settings-${suffix}`}, ${tenantId}, 'F1.4 Synthetic Galvanik GmbH',
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
            ${customerId}, ${tenantId}, ${`F14-${suffix}`}, 'F1.4 Synthetic Customer',
            'F1.4 Synthetic Customer GmbH', 'business', 'Kundenweg 2',
            '70174', 'Stuttgart', 'Deutschland', now(), now()
          )
        `;
        await transaction`
          INSERT INTO public.orders (
            id, tenant_id, order_number, customer_id, title, station,
            current_station, current_station_id, version, status, created_at
          ) VALUES (
            ${orderId}, ${tenantId}, ${`A-F14-${suffix}`}, ${customerId},
            'F1.4 Synthetic Order', 'fertig', 'fertig', 'fertig', 2, 'fertig', now()
          )
        `;
        await transaction`
          INSERT INTO public.items (
            id, tenant_id, order_id, customer_id, name, quantity,
            current_station_id, preis_netto, created_at
          ) VALUES (
            ${itemId}, ${tenantId}, ${orderId}, ${customerId},
            'F1.4 Synthetic Position', 1, 'fertig', 100.00, now()
          )
        `;
        await transaction`
          INSERT INTO private.extra_work_hourly_rates (
            id, tenant_id, hourly_rate_cents, version, created_by, effective_at
          ) VALUES (${rateId}::uuid, ${tenantId}, 12000, 1, ${userId}::uuid, now())
        `;
        const [freezePayloadContract] = await transaction<{
          payload_type: string;
          payload_exact: boolean;
          freeze_id_valid: boolean;
          rate_id_valid: boolean;
          hourly_rate_valid: boolean;
          total_valid: boolean;
          line_count_valid: boolean;
        }[]>`
          SELECT
            jsonb_typeof(${transaction.json(freezePayload)}) AS payload_type,
            ${transaction.json(freezePayload)} = jsonb_build_object(
              'freezeId', ${transaction.json(freezePayload)}->'freezeId',
              'rateId', ${transaction.json(freezePayload)}->'rateId',
              'hourlyRateCents', ${transaction.json(freezePayload)}->'hourlyRateCents',
              'totalAmountCents', ${transaction.json(freezePayload)}->'totalAmountCents',
              'lineCount', ${transaction.json(freezePayload)}->'lineCount'
            ) AS payload_exact,
            (${transaction.json(freezePayload)}->>'freezeId') ~
              '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' AS freeze_id_valid,
            (${transaction.json(freezePayload)}->>'rateId') ~
              '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' AS rate_id_valid,
            jsonb_typeof(${transaction.json(freezePayload)}->'hourlyRateCents') = 'number'
              AND (${transaction.json(freezePayload)}->>'hourlyRateCents')::integer BETWEEN 1 AND 1000000 AS hourly_rate_valid,
            jsonb_typeof(${transaction.json(freezePayload)}->'totalAmountCents') = 'number'
              AND (${transaction.json(freezePayload)}->>'totalAmountCents')::bigint >= 0 AS total_valid,
            jsonb_typeof(${transaction.json(freezePayload)}->'lineCount') = 'number'
              AND (${transaction.json(freezePayload)}->>'lineCount')::integer >= 0 AS line_count_valid
        `;
        expect(freezePayloadContract).toEqual({
          payload_type: "object",
          payload_exact: true,
          freeze_id_valid: true,
          rate_id_valid: true,
          hourly_rate_valid: true,
          total_valid: true,
          line_count_valid: true,
        });
        await transaction`
          INSERT INTO public.events (
            id, tenant_id, order_id, item_id, event_type, description, user_id,
            payload, status, station, created_at, client_event_id,
            event_schema_version, correlation_id, aggregate_version, from_station
          ) VALUES (
            ${freezeEventId}, ${tenantId}, ${orderId}, NULL, 'ORDER_FROZEN_V1',
            'Order frozen from galvanik to fertig', ${userId}::uuid,
            ${transaction.json(freezePayload)},
            'success', 'fertig',
            ${`${serviceDate}T10:00:00.000Z`}::timestamptz AT TIME ZONE 'UTC',
            ${freezeClientEventId}::uuid, 1, ${freezeCorrelationId}::uuid, 2, 'galvanik'
          )
        `;
        await transaction`
          INSERT INTO private.order_freezes (
            id, tenant_id, order_id, event_id, hourly_rate_id,
            hourly_rate_cents, total_amount_cents, line_count, order_version,
            frozen_by, frozen_at
          ) VALUES (
            ${freezeId}::uuid, ${tenantId}, ${orderId}, ${freezeEventId},
            ${rateId}::uuid, 12000, 0, 0, 2, ${userId}::uuid,
            ${`${serviceDate}T10:00:00.000Z`}::timestamptz
          )
        `;

        await transaction`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        const [source] = await transaction<{
          base_line_count: number;
          base_net_amount_cents: string;
          service_date: string;
          session_date: string;
          seller_config_complete: boolean;
          customer_config_complete: boolean;
          base_prices_complete: boolean;
          no_active_invoice: boolean;
          integrity_ok: boolean;
        }[]>`
          SELECT
            base_line_count,
            base_net_amount_cents::text AS base_net_amount_cents,
            to_char(service_date, 'YYYY-MM-DD') AS service_date,
            to_char(frozen_at::date, 'YYYY-MM-DD') AS session_date,
            seller_config_complete,
            customer_config_complete,
            base_prices_complete,
            no_active_invoice,
            integrity_ok
          FROM private.v_invoice_issue_source_v1
          WHERE order_id = ${orderId}
        `;
        // The freeze happened 2026-08-21T10:00Z. Berlin says 2026-08-21, the
        // Pacific/Kiritimati session zone would say 2026-08-22.
        expect(source).toEqual({
          base_line_count: 1,
          base_net_amount_cents: "10000",
          service_date: serviceDate,
          session_date: "2026-08-22",
          seller_config_complete: true,
          customer_config_complete: true,
          base_prices_complete: true,
          no_active_invoice: true,
          integrity_ok: true,
        });

        const [numberRow] = await transaction<{ invoice_number: string }[]>`
          SELECT private.allocate_invoice_number(${tenantId}, 2026) AS invoice_number
        `;
        expect(numberRow?.invoice_number).toBe("R-2026-0001");

        const snapshot = buildSnapshot({
          orderId,
          orderNumber: `A-F14-${suffix}`,
          freezeId,
          itemId,
          serviceDate,
          issuedAt,
          vatRateBasisPoints: 1900,
        });
        const issuePayload = {
          invoiceId,
          freezeId,
          invoiceNumber: numberRow?.invoice_number,
          orderVersion: 2,
          netAmountCents: 10000,
          vatRateBasisPoints: 1900,
          vatAmountCents: 1900,
          grossAmountCents: 11900,
          pdfSha256: originalPdfSha256,
          invoiceVersion: 1,
        };
        const [issueEventContract] = await transaction<{
          tenant_id_valid: boolean;
          order_id_valid: boolean;
          item_id_valid: boolean;
          user_id_valid: boolean;
          client_event_id_valid: boolean;
          event_schema_version_valid: boolean;
          correlation_id_valid: boolean;
          aggregate_version_valid: boolean;
          from_station_valid: boolean;
          station_valid: boolean;
          status_valid: boolean;
          payload_type_valid: boolean;
          payload_exact: boolean;
          invoice_id_valid: boolean;
          freeze_id_valid: boolean;
          invoice_number_valid: boolean;
          pdf_sha256_valid: boolean;
          net_amount_type_valid: boolean;
          order_version_type_valid: boolean;
          vat_rate_type_valid: boolean;
          vat_amount_type_valid: boolean;
          gross_amount_type_valid: boolean;
          invoice_version_type_valid: boolean;
          net_amount_valid: boolean;
          order_version_integral: boolean;
          order_version_valid: boolean;
          vat_rate_valid: boolean;
          vat_amount_valid: boolean;
          gross_amount_valid: boolean;
          invoice_version_valid: boolean;
        }[]>`
          WITH candidate AS (
            SELECT
              ${tenantId}::text AS tenant_id,
              ${orderId}::text AS order_id,
              NULL::text AS item_id,
              ${userId}::uuid AS user_id,
              ${issueClientEventId}::uuid AS client_event_id,
              1::integer AS event_schema_version,
              ${issueCorrelationId}::uuid AS correlation_id,
              1::integer AS aggregate_version,
              'fertig'::text AS from_station,
              'fertig'::text AS station,
              'success'::text AS status,
              ${transaction.json(issuePayload)}::jsonb AS payload
          )
          SELECT
            tenant_id IS NOT NULL AS tenant_id_valid,
            order_id IS NOT NULL AS order_id_valid,
            item_id IS NULL AS item_id_valid,
            user_id IS NOT NULL AS user_id_valid,
            client_event_id IS NOT NULL AS client_event_id_valid,
            event_schema_version = 1 AS event_schema_version_valid,
            correlation_id IS NOT NULL AS correlation_id_valid,
            aggregate_version = 1 AS aggregate_version_valid,
            from_station = 'fertig' AS from_station_valid,
            station = 'fertig' AS station_valid,
            status = 'success' AS status_valid,
            jsonb_typeof(payload) = 'object' AS payload_type_valid,
            payload = jsonb_build_object(
              'invoiceId', payload->'invoiceId',
              'freezeId', payload->'freezeId',
              'invoiceNumber', payload->'invoiceNumber',
              'orderVersion', payload->'orderVersion',
              'netAmountCents', payload->'netAmountCents',
              'vatRateBasisPoints', payload->'vatRateBasisPoints',
              'vatAmountCents', payload->'vatAmountCents',
              'grossAmountCents', payload->'grossAmountCents',
              'pdfSha256', payload->'pdfSha256',
              'invoiceVersion', payload->'invoiceVersion'
            ) AS payload_exact,
            coalesce(payload->>'invoiceId', '') ~
              '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' AS invoice_id_valid,
            coalesce(payload->>'freezeId', '') ~
              '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' AS freeze_id_valid,
            coalesce(payload->>'invoiceNumber', '') ~ '^R-[0-9]{4}-[0-9]{4,}$' AS invoice_number_valid,
            coalesce(payload->>'pdfSha256', '') ~ '^[a-f0-9]{64}$' AS pdf_sha256_valid,
            jsonb_typeof(payload->'netAmountCents') = 'number' AS net_amount_type_valid,
            jsonb_typeof(payload->'orderVersion') = 'number' AS order_version_type_valid,
            jsonb_typeof(payload->'vatRateBasisPoints') = 'number' AS vat_rate_type_valid,
            jsonb_typeof(payload->'vatAmountCents') = 'number' AS vat_amount_type_valid,
            jsonb_typeof(payload->'grossAmountCents') = 'number' AS gross_amount_type_valid,
            jsonb_typeof(payload->'invoiceVersion') = 'number' AS invoice_version_type_valid,
            (payload->>'netAmountCents')::integer >= 0 AS net_amount_valid,
            (payload->>'orderVersion')::numeric = trunc((payload->>'orderVersion')::numeric)
              AS order_version_integral,
            (payload->>'orderVersion')::integer > 0 AS order_version_valid,
            (payload->>'vatRateBasisPoints')::integer IN (700, 1900) AS vat_rate_valid,
            (payload->>'vatAmountCents')::integer = round(
              (payload->>'netAmountCents')::numeric
              * (payload->>'vatRateBasisPoints')::numeric / 10000
            )::integer AS vat_amount_valid,
            (payload->>'grossAmountCents')::integer
              = (payload->>'netAmountCents')::integer + (payload->>'vatAmountCents')::integer
              AS gross_amount_valid,
            (payload->>'invoiceVersion')::integer = 1 AS invoice_version_valid
          FROM candidate
        `;
        expect(issueEventContract).toEqual({
          tenant_id_valid: true,
          order_id_valid: true,
          item_id_valid: true,
          user_id_valid: true,
          client_event_id_valid: true,
          event_schema_version_valid: true,
          correlation_id_valid: true,
          aggregate_version_valid: true,
          from_station_valid: true,
          station_valid: true,
          status_valid: true,
          payload_type_valid: true,
          payload_exact: true,
          invoice_id_valid: true,
          freeze_id_valid: true,
          invoice_number_valid: true,
          pdf_sha256_valid: true,
          net_amount_type_valid: true,
          order_version_type_valid: true,
          vat_rate_type_valid: true,
          vat_amount_type_valid: true,
          gross_amount_type_valid: true,
          invoice_version_type_valid: true,
          net_amount_valid: true,
          order_version_integral: true,
          order_version_valid: true,
          vat_rate_valid: true,
          vat_amount_valid: true,
          gross_amount_valid: true,
          invoice_version_valid: true,
        });
        await transaction`
          INSERT INTO public.events (
            id, tenant_id, order_id, item_id, event_type, description, user_id,
            payload, status, station, client_event_id, event_schema_version,
            correlation_id, aggregate_version, from_station, created_at
          ) VALUES (
            ${issueEventId}, ${tenantId}, ${orderId}, NULL, 'INVOICE_CREATED_V1',
            'Unveraenderliche Rechnung erstellt', ${userId}::uuid,
            ${transaction.json(issuePayload)}::jsonb,
            'success', 'fertig', ${issueClientEventId}::uuid, 1,
            ${issueCorrelationId}::uuid, 1, 'fertig',
            ${issuedAt}::timestamptz AT TIME ZONE 'UTC'
          )
        `;
        const invoiceSnapshot = transaction.json(snapshot);
        const [invoiceIssueFieldsContract] = await transaction<{
          order_id_valid: boolean;
          customer_id_valid: boolean;
          freeze_id_valid: boolean;
          invoice_number_valid: boolean;
          snapshot_present: boolean;
          snapshot_type_valid: boolean;
          net_amount_valid: boolean;
          vat_rate_valid: boolean;
          vat_amount_valid: boolean;
          gross_amount_valid: boolean;
          amount_total_valid: boolean;
          service_date_valid: boolean;
          order_version_valid: boolean;
          payment_term_days_valid: boolean;
          due_date_valid: boolean;
          aggregate_version_valid: boolean;
          client_event_id_valid: boolean;
          correlation_id_valid: boolean;
          issue_event_id_valid: boolean;
          issued_at_valid: boolean;
          issued_by_valid: boolean;
          pdf_ref_valid: boolean;
          pdf_sha256_valid: boolean;
          pdf_content_valid: boolean;
        }[]>`
          WITH candidate AS (
            SELECT
              ${orderId}::text AS order_id,
              ${customerId}::text AS customer_id,
              ${freezeId}::uuid AS freeze_id,
              ${numberRow?.invoice_number}::text AS invoice_number,
              ${invoiceSnapshot}::jsonb AS snapshot,
              10000::integer AS net_amount_cents,
              1900::integer AS vat_rate_basis_points,
              1900::integer AS vat_amount_cents,
              11900::integer AS gross_amount_cents,
              119.00::numeric AS amount_total,
              ${serviceDate}::date AS service_date,
              2::integer AS order_version,
              14::integer AS payment_term_days,
              ${dueDate}::date AS due_date,
              1::integer AS aggregate_version,
              ${issueClientEventId}::uuid AS client_event_id,
              ${issueCorrelationId}::uuid AS correlation_id,
              ${issueEventId}::text AS issue_event_id,
              ${issuedAt}::timestamptz AS issued_at,
              ${userId}::uuid AS issued_by,
              ${`invoice://${invoiceId}/original`}::text AS pdf_ref,
              ${originalPdfSha256}::text AS pdf_sha256,
              ${originalPdf}::bytea AS pdf_content
          )
          SELECT
            order_id IS NOT NULL AS order_id_valid,
            customer_id IS NOT NULL AS customer_id_valid,
            freeze_id IS NOT NULL AS freeze_id_valid,
            invoice_number IS NOT NULL AS invoice_number_valid,
            snapshot IS NOT NULL AS snapshot_present,
            jsonb_typeof(snapshot) = 'object' AS snapshot_type_valid,
            net_amount_cents IS NOT NULL AS net_amount_valid,
            vat_rate_basis_points IS NOT NULL AS vat_rate_valid,
            vat_amount_cents IS NOT NULL AS vat_amount_valid,
            gross_amount_cents IS NOT NULL AS gross_amount_valid,
            amount_total IS NOT NULL AS amount_total_valid,
            service_date IS NOT NULL AS service_date_valid,
            order_version IS NOT NULL AS order_version_valid,
            payment_term_days IS NOT NULL AS payment_term_days_valid,
            due_date IS NOT NULL AS due_date_valid,
            aggregate_version IS NOT NULL AS aggregate_version_valid,
            client_event_id IS NOT NULL AS client_event_id_valid,
            correlation_id IS NOT NULL AS correlation_id_valid,
            issue_event_id IS NOT NULL AS issue_event_id_valid,
            issued_at IS NOT NULL AS issued_at_valid,
            issued_by IS NOT NULL AS issued_by_valid,
            pdf_ref IS NOT NULL AS pdf_ref_valid,
            pdf_sha256 IS NOT NULL AS pdf_sha256_valid,
            pdf_content IS NOT NULL AS pdf_content_valid
          FROM candidate
        `;
        expect(invoiceIssueFieldsContract).toEqual({
          order_id_valid: true,
          customer_id_valid: true,
          freeze_id_valid: true,
          invoice_number_valid: true,
          snapshot_present: true,
          snapshot_type_valid: true,
          net_amount_valid: true,
          vat_rate_valid: true,
          vat_amount_valid: true,
          gross_amount_valid: true,
          amount_total_valid: true,
          service_date_valid: true,
          order_version_valid: true,
          payment_term_days_valid: true,
          due_date_valid: true,
          aggregate_version_valid: true,
          client_event_id_valid: true,
          correlation_id_valid: true,
          issue_event_id_valid: true,
          issued_at_valid: true,
          issued_by_valid: true,
          pdf_ref_valid: true,
          pdf_sha256_valid: true,
          pdf_content_valid: true,
        });
        await transaction`
          INSERT INTO public.invoices (
            id, tenant_id, customer_id, order_id, invoice_number, amount_total,
            status, due_date, contract_version, freeze_id, snapshot,
            net_amount_cents, vat_rate_basis_points, vat_amount_cents,
            gross_amount_cents, service_date, payment_term_days,
            order_version, aggregate_version, client_event_id, correlation_id, issue_event_id,
            issued_at, issued_by, pdf_ref, pdf_sha256, pdf_content
          ) VALUES (
            ${invoiceId}::uuid, ${tenantId}, ${customerId}, ${orderId},
            ${numberRow?.invoice_number}, 119.00, 'issued', ${dueDate}::date,
            1, ${freezeId}::uuid, ${invoiceSnapshot}::jsonb,
            10000, 1900, 1900, 11900, ${serviceDate}::date, 14,
            2, 1, ${issueClientEventId}::uuid, ${issueCorrelationId}::uuid,
            ${issueEventId}, ${issuedAt}::timestamptz, ${userId}::uuid,
            ${`invoice://${invoiceId}/original`}, ${originalPdfSha256}, ${originalPdf}
          )
        `;

        const [summary] = await transaction<{
          invoice_number: string;
          order_version: number;
          status: string;
          pdf_sha256: string;
          integrity_ok: boolean;
        }[]>`
          SELECT invoice_number, order_version, status, pdf_sha256, integrity_ok
          FROM private.v_invoice_summary_v1
          WHERE id = ${invoiceId}::uuid
        `;
        expect(summary).toEqual({
          invoice_number: "R-2026-0001",
          order_version: 2,
          status: "issued",
          pdf_sha256: originalPdfSha256,
          integrity_ok: true,
        });

        await transaction.unsafe("SAVEPOINT immutable_update");
        let updateError: unknown;
        try {
          await transaction`
            UPDATE public.invoices SET gross_amount_cents = 11901
            WHERE id = ${invoiceId}::uuid
          `;
        } catch (error) {
          updateError = error;
        }
        await transaction.unsafe("ROLLBACK TO SAVEPOINT immutable_update");
        expect(updateError).toMatchObject({ code: "23514" });

        await transaction.unsafe("SAVEPOINT immutable_delete");
        let deleteError: unknown;
        try {
          await transaction`DELETE FROM public.invoices WHERE id = ${invoiceId}::uuid`;
        } catch (error) {
          deleteError = error;
        }
        await transaction.unsafe("ROLLBACK TO SAVEPOINT immutable_delete");
        expect(deleteError).toMatchObject({ code: "23514" });

        const cancelReason = "F1.4 synthetic cancellation reason";
        const cancelPayload = {
          invoiceId,
          invoiceNumber: "R-2026-0001",
          expectedVersion: 1,
          cancelReason,
          cancellationPdfSha256,
          invoiceVersion: 2,
        };
        await transaction`
          INSERT INTO public.events (
            id, tenant_id, order_id, item_id, event_type, description, user_id,
            payload, status, station, client_event_id, event_schema_version,
            correlation_id, aggregate_version, from_station, created_at
          ) VALUES (
            ${cancelEventId}, ${tenantId}, ${orderId}, NULL, 'INVOICE_CANCELLED_V1',
            ${cancelReason}, ${userId}::uuid,
            ${transaction.json(cancelPayload)}::jsonb,
            'success', 'fertig', ${cancelClientEventId}::uuid, 1,
            ${cancelCorrelationId}::uuid, 2, 'fertig',
            ${cancelledAt}::timestamptz AT TIME ZONE 'UTC'
          )
        `;
        await transaction`SELECT set_config('app.invoice_cancel_command', 'v1', true)`;
        await transaction`
          UPDATE public.invoices
          SET
            status = 'cancelled',
            aggregate_version = 2,
            cancel_client_event_id = ${cancelClientEventId}::uuid,
            cancel_correlation_id = ${cancelCorrelationId}::uuid,
            cancelled_by = ${userId}::uuid,
            cancel_reason = ${cancelReason},
            cancelled_at = ${cancelledAt}::timestamptz,
            cancel_event_id = ${cancelEventId},
            cancellation_pdf_ref = ${`invoice://${invoiceId}/cancellation`},
            cancellation_pdf_sha256 = ${cancellationPdfSha256},
            cancellation_pdf_content = ${cancellationPdf}
          WHERE id = ${invoiceId}::uuid
        `;

        const receipts = await transaction<{
          event_type: string;
          integrity_ok: boolean;
        }[]>`
          SELECT event_type, integrity_ok
          FROM private.v_invoice_receipt_v1
          WHERE invoice_id = ${invoiceId}::uuid
          ORDER BY aggregate_version
        `;
        expect(receipts).toEqual([
          { event_type: "INVOICE_CREATED_V1", integrity_ok: true },
          { event_type: "INVOICE_CANCELLED_V1", integrity_ok: true },
        ]);

        await transaction.unsafe("SAVEPOINT second_cancel");
        let secondCancelError: unknown;
        try {
          await transaction`
            UPDATE public.invoices SET cancel_reason = 'Andere Begruendung'
            WHERE id = ${invoiceId}::uuid
          `;
        } catch (error) {
          secondCancelError = error;
        }
        await transaction.unsafe("ROLLBACK TO SAVEPOINT second_cancel");
        expect(secondCancelError).toMatchObject({ code: "23514" });

        await transaction`SELECT set_config('app.tenant_id', ${foreignTenantId}, true)`;
        const foreignRows = await transaction`
          SELECT id FROM private.v_invoice_summary_v1 WHERE id = ${invoiceId}::uuid
        `;
        expect(foreignRows).toHaveLength(0);

        throw rollbackSignal;
      });
    } catch (error) {
      if (error !== rollbackSignal) throw error;
    }
  });

  it("indexes every canonical number per tenant without a contract_version predicate", async () => {
    const [index] = await sql<{ indexdef: string }[]>`
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'invoices_f14_tenant_number_uidx'
    `;
    expect(index?.indexdef).toBeDefined();
    expect(index?.indexdef).toContain("CREATE UNIQUE INDEX");
    expect(index?.indexdef).toContain("(tenant_id, invoice_number)");
    // Canonical numbers are one truth per tenant across every contract
    // generation; a contract_version predicate would silently split them.
    expect(index?.indexdef).toContain(CANONICAL_NUMBER_PATTERN);
    expect(index?.indexdef).not.toContain("contract_version");
  });

  it("continues the canonical sequence from existing legacy numbers, including late inserts", async () => {
    const tenantId = `f14-cutover-${suffix}`;
    const rollbackSignal = new Error("ROLLBACK_F1_4_CUTOVER");

    try {
      await sql.begin(async (transaction) => {
        const insertLegacy = (invoiceNumber: string) => transaction`
          INSERT INTO public.invoices (id, tenant_id, invoice_number, amount_total, status)
          VALUES (gen_random_uuid(), ${tenantId}, ${invoiceNumber}, 10.00, 'sent')
        `;
        const allocate = async (year: number): Promise<string | undefined> => {
          const [allocated] = await transaction<{ invoice_number: string }[]>`
            SELECT private.allocate_invoice_number(${tenantId}, ${year}) AS invoice_number
          `;
          return allocated?.invoice_number;
        };

        // A canonical number written long before F1.4 (contract_version NULL).
        await insertLegacy("R-2026-0042");

        // A rolled back allocation releases the number again.
        await transaction.unsafe("SAVEPOINT released_allocation");
        expect(await allocate(2026)).toBe("R-2026-0043");
        await transaction.unsafe("ROLLBACK TO SAVEPOINT released_allocation");
        expect(await allocate(2026)).toBe("R-2026-0043");

        // A canonical number that appears after the counter already exists.
        await insertLegacy("R-2026-0100");
        expect(await allocate(2026)).toBe("R-2026-0101");

        // Non-canonical legacy numbers never influence the sequence.
        await insertLegacy("LEGACY-9999");
        expect(await allocate(2026)).toBe("R-2026-0102");

        // Years are independent.
        expect(await allocate(2027)).toBe("R-2027-0001");

        await transaction.unsafe("SAVEPOINT year_range");
        let rangeError: unknown;
        try {
          await allocate(1999);
        } catch (error) {
          rangeError = error;
        }
        await transaction.unsafe("ROLLBACK TO SAVEPOINT year_range");
        expect(rangeError).toMatchObject({ code: "23514" });

        throw rollbackSignal;
      });
    } catch (error) {
      if (error !== rollbackSignal) throw error;
    }
  });

  it("keeps canonical numbers unique per tenant, allows them per other tenant and tolerates legacy duplicates", async () => {
    const tenantA = `f14-dup-a-${suffix}`;
    const tenantB = `f14-dup-b-${suffix}`;
    const canonical = "R-2026-9001";
    const rollbackSignal = new Error("ROLLBACK_F1_4_DUPLICATES");

    try {
      await sql.begin(async (transaction) => {
        const insertInvoice = (tenantId: string, invoiceNumber: string) => transaction`
          INSERT INTO public.invoices (id, tenant_id, invoice_number, amount_total, status)
          VALUES (gen_random_uuid(), ${tenantId}, ${invoiceNumber}, 10.00, 'sent')
        `;

        await insertInvoice(tenantA, canonical);

        await transaction.unsafe("SAVEPOINT canonical_duplicate");
        let duplicateError: unknown;
        try {
          await insertInvoice(tenantA, canonical);
        } catch (error) {
          duplicateError = error;
        }
        await transaction.unsafe("ROLLBACK TO SAVEPOINT canonical_duplicate");
        expect(duplicateError).toMatchObject({ code: "23505" });

        // Another tenant may legitimately hold the very same number.
        await insertInvoice(tenantB, canonical);

        // Non-canonical legacy numbers stay outside the index and stay usable.
        await insertInvoice(tenantA, "LEGACY-77");
        await insertInvoice(tenantA, "LEGACY-77");
        const updated = await transaction`
          UPDATE public.invoices
          SET amount_total = 11.00
          WHERE tenant_id = ${tenantA} AND invoice_number = 'LEGACY-77'
          RETURNING id
        `;
        expect(updated).toHaveLength(2);

        const [counts] = await transaction<{ canonical_rows: number; legacy_rows: number }[]>`
          SELECT
            (SELECT count(*)::integer FROM public.invoices
              WHERE invoice_number = ${canonical}) AS canonical_rows,
            (SELECT count(*)::integer FROM public.invoices
              WHERE tenant_id = ${tenantA} AND invoice_number = 'LEGACY-77') AS legacy_rows
        `;
        expect(counts).toEqual({ canonical_rows: 2, legacy_rows: 2 });

        throw rollbackSignal;
      });
    } catch (error) {
      if (error !== rollbackSignal) throw error;
    }
  });

  it("derives Berlin calendar truth at year and DST boundaries even when the session zone differs", async () => {
    const rows = await sql.begin(async (transaction) => {
      // Deliberately neither UTC nor Europe/Berlin.
      await transaction.unsafe("SET LOCAL TIME ZONE 'Pacific/Kiritimati'");
      return transaction<{
        instant: string;
        berlin_local: string;
        berlin_date: string;
        berlin_year: number;
        berlin_due_date: string;
        session_date: string;
        session_zone: string;
      }[]>`
        SELECT
          to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS instant,
          to_char(ts AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD HH24:MI:SS') AS berlin_local,
          to_char((ts AT TIME ZONE 'Europe/Berlin')::date, 'YYYY-MM-DD') AS berlin_date,
          extract(year FROM (ts AT TIME ZONE 'Europe/Berlin'))::integer AS berlin_year,
          to_char((ts AT TIME ZONE 'Europe/Berlin')::date + 14, 'YYYY-MM-DD') AS berlin_due_date,
          to_char(ts::date, 'YYYY-MM-DD') AS session_date,
          current_setting('TimeZone') AS session_zone
        FROM (VALUES
          ('2025-12-31T22:59:59.000Z'::timestamptz),
          ('2025-12-31T23:00:00.000Z'::timestamptz),
          ('2026-03-29T00:59:59.000Z'::timestamptz),
          ('2026-03-29T01:00:00.000Z'::timestamptz),
          ('2026-06-30T21:59:59.000Z'::timestamptz),
          ('2026-06-30T22:00:00.000Z'::timestamptz),
          ('2026-10-25T00:59:59.000Z'::timestamptz),
          ('2026-10-25T01:00:00.000Z'::timestamptz)
        ) AS boundary(ts)
        ORDER BY ts
      `;
    });

    expect(rows).toEqual([
      {
        instant: "2025-12-31T22:59:59.000Z",
        berlin_local: "2025-12-31 23:59:59",
        berlin_date: "2025-12-31",
        berlin_year: 2025,
        berlin_due_date: "2026-01-14",
        session_date: "2026-01-01",
        session_zone: "Pacific/Kiritimati",
      },
      {
        instant: "2025-12-31T23:00:00.000Z",
        berlin_local: "2026-01-01 00:00:00",
        berlin_date: "2026-01-01",
        berlin_year: 2026,
        berlin_due_date: "2026-01-15",
        session_date: "2026-01-01",
        session_zone: "Pacific/Kiritimati",
      },
      {
        instant: "2026-03-29T00:59:59.000Z",
        berlin_local: "2026-03-29 01:59:59",
        berlin_date: "2026-03-29",
        berlin_year: 2026,
        berlin_due_date: "2026-04-12",
        session_date: "2026-03-29",
        session_zone: "Pacific/Kiritimati",
      },
      {
        instant: "2026-03-29T01:00:00.000Z",
        berlin_local: "2026-03-29 03:00:00",
        berlin_date: "2026-03-29",
        berlin_year: 2026,
        berlin_due_date: "2026-04-12",
        session_date: "2026-03-29",
        session_zone: "Pacific/Kiritimati",
      },
      {
        instant: "2026-06-30T21:59:59.000Z",
        berlin_local: "2026-06-30 23:59:59",
        berlin_date: "2026-06-30",
        berlin_year: 2026,
        berlin_due_date: "2026-07-14",
        session_date: "2026-07-01",
        session_zone: "Pacific/Kiritimati",
      },
      {
        instant: "2026-06-30T22:00:00.000Z",
        berlin_local: "2026-07-01 00:00:00",
        berlin_date: "2026-07-01",
        berlin_year: 2026,
        berlin_due_date: "2026-07-15",
        session_date: "2026-07-01",
        session_zone: "Pacific/Kiritimati",
      },
      {
        instant: "2026-10-25T00:59:59.000Z",
        berlin_local: "2026-10-25 02:59:59",
        berlin_date: "2026-10-25",
        berlin_year: 2026,
        berlin_due_date: "2026-11-08",
        session_date: "2026-10-25",
        session_zone: "Pacific/Kiritimati",
      },
      {
        instant: "2026-10-25T01:00:00.000Z",
        berlin_local: "2026-10-25 02:00:00",
        berlin_date: "2026-10-25",
        berlin_year: 2026,
        berlin_due_date: "2026-11-08",
        session_date: "2026-10-25",
        session_zone: "Pacific/Kiritimati",
      },
    ]);
  });

  it("reports a broken receipt when the lifecycle event instant differs by exactly 1 ms", async () => {
    const tenantId = `f14-receipt-${suffix}`;
    const userId = randomUUID();
    const rateId = randomUUID();
    const serviceDate = "2026-08-21";
    const dueDate = "2026-09-04";
    // 12:00Z is 14:00 Berlin on 2026-08-21; +14 days is the due date above.
    const issuedAt = "2026-08-21T12:00:00.000Z";
    const skewedIssuedAt = "2026-08-21T12:00:00.001Z";
    const cancelledAt = "2026-08-25T09:30:00.000Z";
    const skewedCancelledAt = "2026-08-25T09:30:00.001Z";
    const cancelReason = "F1.4 synthetic cancellation reason";
    const rollbackSignal = new Error("ROLLBACK_F1_4_RECEIPT_INSTANT");

    const buildCase = (key: string, invoiceNumber: string) => ({
      key,
      invoiceNumber,
      customerId: `${key}-customer-${suffix}`,
      customerNumber: `${key}-${suffix}`,
      orderId: `${key}-order-${suffix}`,
      orderNumber: `A-${key}-${suffix}`,
      itemId: `${key}-item-${suffix}`,
      freezeId: randomUUID(),
      freezeEventId: randomUUID(),
      freezeClientEventId: randomUUID(),
      freezeCorrelationId: randomUUID(),
      invoiceId: randomUUID(),
      issueEventId: randomUUID(),
      issueClientEventId: randomUUID(),
      issueCorrelationId: randomUUID(),
      cancelEventId: randomUUID(),
      cancelClientEventId: randomUUID(),
      cancelCorrelationId: randomUUID(),
      pdf: Buffer.from(`%PDF-1.4\nF1.4 ${key} original\n%%EOF`, "utf8"),
      cancellationPdf: Buffer.from(`%PDF-1.4\nF1.4 ${key} cancellation\n%%EOF`, "utf8"),
    });
    type ReceiptCase = ReturnType<typeof buildCase>;

    // The issue case is skewed on its own issue instant; the cancel case keeps
    // a correct issue instant and is skewed only on the cancellation instant.
    const issueCase = buildCase("issueskew", "R-2026-8001");
    const cancelCase = buildCase("cancelskew", "R-2026-8002");

    try {
      await sql.begin(async (transaction) => {
        await seedTenant(transaction, {
          tenantId,
          userId,
          label: `f14-receipt-${suffix}`,
          rateId,
        });

        const issueInvoice = async (
          receiptCase: ReceiptCase,
          eventCreatedAt: string,
        ): Promise<string> => {
          await seedFrozenOrder(transaction, {
            tenantId,
            userId,
            rateId,
            customerId: receiptCase.customerId,
            customerNumber: receiptCase.customerNumber,
            orderId: receiptCase.orderId,
            orderNumber: receiptCase.orderNumber,
            itemId: receiptCase.itemId,
            freezeId: receiptCase.freezeId,
            freezeEventId: receiptCase.freezeEventId,
            freezeClientEventId: receiptCase.freezeClientEventId,
            freezeCorrelationId: receiptCase.freezeCorrelationId,
            frozenAt: `${serviceDate}T10:00:00.000Z`,
          });

          const pdfSha256 = createHash("sha256").update(receiptCase.pdf).digest("hex");
          const snapshot = buildSnapshot({
            orderId: receiptCase.orderId,
            orderNumber: receiptCase.orderNumber,
            freezeId: receiptCase.freezeId,
            itemId: receiptCase.itemId,
            serviceDate,
            issuedAt,
            vatRateBasisPoints: 1900,
          });

          await transaction`
            INSERT INTO public.events (
              id, tenant_id, order_id, item_id, event_type, description, user_id,
              payload, status, station, client_event_id, event_schema_version,
              correlation_id, aggregate_version, from_station, created_at
            ) VALUES (
              ${receiptCase.issueEventId}, ${tenantId}, ${receiptCase.orderId}, NULL,
              'INVOICE_CREATED_V1', 'Unveraenderliche Rechnung erstellt', ${userId}::uuid,
              ${transaction.json({
                invoiceId: receiptCase.invoiceId,
                freezeId: receiptCase.freezeId,
                invoiceNumber: receiptCase.invoiceNumber,
                orderVersion: 2,
                netAmountCents: 10000,
                vatRateBasisPoints: 1900,
                vatAmountCents: 1900,
                grossAmountCents: 11900,
                pdfSha256,
                invoiceVersion: 1,
              })}::jsonb,
              'success', 'fertig', ${receiptCase.issueClientEventId}::uuid, 1,
              ${receiptCase.issueCorrelationId}::uuid, 1, 'fertig',
              ${eventCreatedAt}::timestamptz AT TIME ZONE 'UTC'
            )
          `;
          await transaction`
            INSERT INTO public.invoices (
              id, tenant_id, customer_id, order_id, invoice_number, amount_total,
              status, due_date, contract_version, freeze_id, snapshot,
              net_amount_cents, vat_rate_basis_points, vat_amount_cents,
              gross_amount_cents, service_date, payment_term_days,
              order_version, aggregate_version, client_event_id, correlation_id,
              issue_event_id, issued_at, issued_by, pdf_ref, pdf_sha256, pdf_content
            ) VALUES (
              ${receiptCase.invoiceId}::uuid, ${tenantId}, ${receiptCase.customerId},
              ${receiptCase.orderId}, ${receiptCase.invoiceNumber}, 119.00, 'issued',
              ${dueDate}::date, 1, ${receiptCase.freezeId}::uuid,
              ${transaction.json(snapshot)}::jsonb,
              10000, 1900, 1900, 11900, ${serviceDate}::date, 14, 2, 1,
              ${receiptCase.issueClientEventId}::uuid, ${receiptCase.issueCorrelationId}::uuid,
              ${receiptCase.issueEventId}, ${issuedAt}::timestamptz, ${userId}::uuid,
              ${`invoice://${receiptCase.invoiceId}/original`}, ${pdfSha256}, ${receiptCase.pdf}
            )
          `;
          return pdfSha256;
        };

        // Only the issue instant differs; every other value stays correct.
        await issueInvoice(issueCase, skewedIssuedAt);
        await issueInvoice(cancelCase, issuedAt);

        const cancellationPdfSha256 = createHash("sha256")
          .update(cancelCase.cancellationPdf)
          .digest("hex");
        await transaction`
          INSERT INTO public.events (
            id, tenant_id, order_id, item_id, event_type, description, user_id,
            payload, status, station, client_event_id, event_schema_version,
            correlation_id, aggregate_version, from_station, created_at
          ) VALUES (
            ${cancelCase.cancelEventId}, ${tenantId}, ${cancelCase.orderId}, NULL,
            'INVOICE_CANCELLED_V1', ${cancelReason}, ${userId}::uuid,
            ${transaction.json({
              invoiceId: cancelCase.invoiceId,
              invoiceNumber: cancelCase.invoiceNumber,
              expectedVersion: 1,
              cancelReason,
              cancellationPdfSha256,
              invoiceVersion: 2,
            })}::jsonb,
            'success', 'fertig', ${cancelCase.cancelClientEventId}::uuid, 1,
            ${cancelCase.cancelCorrelationId}::uuid, 2, 'fertig',
            ${skewedCancelledAt}::timestamptz AT TIME ZONE 'UTC'
          )
        `;
        await transaction`SELECT set_config('app.invoice_cancel_command', 'v1', true)`;
        await transaction`
          UPDATE public.invoices
          SET
            status = 'cancelled',
            aggregate_version = 2,
            cancel_client_event_id = ${cancelCase.cancelClientEventId}::uuid,
            cancel_correlation_id = ${cancelCase.cancelCorrelationId}::uuid,
            cancelled_by = ${userId}::uuid,
            cancel_reason = ${cancelReason},
            cancelled_at = ${cancelledAt}::timestamptz,
            cancel_event_id = ${cancelCase.cancelEventId},
            cancellation_pdf_ref = ${`invoice://${cancelCase.invoiceId}/cancellation`},
            cancellation_pdf_sha256 = ${cancellationPdfSha256},
            cancellation_pdf_content = ${cancelCase.cancellationPdf}
          WHERE id = ${cancelCase.invoiceId}::uuid
        `;

        await transaction`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        const readReceipts = (invoiceId: string) => transaction<{
          event_type: string;
          integrity_ok: boolean;
        }[]>`
          SELECT event_type, integrity_ok
          FROM private.v_invoice_receipt_v1
          WHERE invoice_id = ${invoiceId}::uuid
          ORDER BY aggregate_version
        `;

        // A 1 ms skew on the issue instant alone breaks the issue receipt.
        expect(await readReceipts(issueCase.invoiceId)).toEqual([
          { event_type: "INVOICE_CREATED_V1", integrity_ok: false },
        ]);
        // The identically built issue receipt with the exact instant stays
        // true, and only the separately skewed cancellation is false.
        expect(await readReceipts(cancelCase.invoiceId)).toEqual([
          { event_type: "INVOICE_CREATED_V1", integrity_ok: true },
          { event_type: "INVOICE_CANCELLED_V1", integrity_ok: false },
        ]);

        throw rollbackSignal;
      });
    } catch (error) {
      if (error !== rollbackSignal) throw error;
    }
  }, 120_000);

  it("binds Berlin truth to the real issue source view and the real invoice due-date CHECK", async () => {
    const tenantId = `f14-berlin-${suffix}`;
    const userId = randomUUID();
    const rateId = randomUUID();
    const rollbackSignal = new Error("ROLLBACK_F1_4_BERLIN_REAL");

    /**
     * Two instants on the same year boundary, both read under Pacific/Kiritimati
     * (UTC+14). `nightly` separates Berlin from the UTC day, `midday` separates
     * Berlin from the session day; together they leave Berlin as the only
     * possible source of both calendar values. The wrong due date of one
     * fixture is deliberately the correct due date of the other.
     */
    const fixtures = [
      {
        key: "nightly",
        instant: "2025-12-31T23:30:00.000Z",
        berlinDate: "2026-01-01",
        utcDate: "2025-12-31",
        sessionDate: "2026-01-01",
        berlinDueDate: "2026-01-15",
        wrongDueDate: "2026-01-14",
        wrongDueSource: "utc-day",
      },
      {
        key: "midday",
        instant: "2025-12-31T13:30:00.000Z",
        berlinDate: "2025-12-31",
        utcDate: "2025-12-31",
        sessionDate: "2026-01-01",
        berlinDueDate: "2026-01-14",
        wrongDueDate: "2026-01-15",
        wrongDueSource: "session-day",
      },
    ] as const;

    const ids = fixtures.map((fixture) => ({
      fixture,
      customerId: `berlin-${fixture.key}-customer-${suffix}`,
      customerNumber: `berlin-${fixture.key}-${suffix}`,
      orderId: `berlin-${fixture.key}-order-${suffix}`,
      orderNumber: `A-BERLIN-${fixture.key}-${suffix}`,
      itemId: `berlin-${fixture.key}-item-${suffix}`,
      freezeId: randomUUID(),
      freezeEventId: randomUUID(),
      freezeClientEventId: randomUUID(),
      freezeCorrelationId: randomUUID(),
      invoiceId: randomUUID(),
      // The canonical year is the Berlin year of the issue instant. `nightly` is
      // Berlin 2026 while UTC still says 2025; `midday` is Berlin 2025 while the
      // Pacific/Kiritimati session already says 2026. The wrong number of one
      // fixture is therefore exactly the year the other fixture must carry.
      invoiceNumber: fixture.key === "nightly" ? "R-2026-8101" : "R-2025-8102",
      wrongYearNumber: fixture.key === "nightly" ? "R-2025-8101" : "R-2026-8102",
      issueEventId: randomUUID(),
      issueClientEventId: randomUUID(),
      issueCorrelationId: randomUUID(),
      pdf: Buffer.from(`%PDF-1.4\nF1.4 berlin ${fixture.key}\n%%EOF`, "utf8"),
    }));

    try {
      await sql.begin(async (transaction) => {
        // Deliberately neither UTC nor Europe/Berlin, for the whole transaction.
        await transaction.unsafe("SET LOCAL TIME ZONE 'Pacific/Kiritimati'");
        await seedTenant(transaction, {
          tenantId,
          userId,
          label: `f14-berlin-${suffix}`,
          rateId,
        });

        for (const entry of ids) {
          await seedFrozenOrder(transaction, {
            tenantId,
            userId,
            rateId,
            customerId: entry.customerId,
            customerNumber: entry.customerNumber,
            orderId: entry.orderId,
            orderNumber: entry.orderNumber,
            itemId: entry.itemId,
            freezeId: entry.freezeId,
            freezeEventId: entry.freezeEventId,
            freezeClientEventId: entry.freezeClientEventId,
            freezeCorrelationId: entry.freezeCorrelationId,
            frozenAt: entry.fixture.instant,
          });
        }

        await transaction`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

        // 1. The real read port, not a free SQL expression.
        const observedSourceDays: unknown[] = [];
        for (const entry of ids) {
          const [row] = await transaction<{
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
            WHERE order_id = ${entry.orderId}
          `;
          observedSourceDays.push(row);
        }
        expect(observedSourceDays).toEqual(ids.map((entry) => ({
          service_date: entry.fixture.berlinDate,
          utc_date: entry.fixture.utcDate,
          session_date: entry.fixture.sessionDate,
          session_zone: "Pacific/Kiritimati",
        })));

        // 2. The real invoice CHECK, not a recomputed expectation.
        const tryInvoice = async (
          entry: (typeof ids)[number],
          dueDate: string,
          invoiceNumber: string = entry.invoiceNumber,
        ): Promise<{ code: string | null; persisted: boolean }> => {
          const pdfSha256 = createHash("sha256").update(entry.pdf).digest("hex");
          const snapshot = buildSnapshot({
            orderId: entry.orderId,
            orderNumber: entry.orderNumber,
            freezeId: entry.freezeId,
            itemId: entry.itemId,
            serviceDate: entry.fixture.berlinDate,
            issuedAt: entry.fixture.instant,
            vatRateBasisPoints: 1900,
          });
          await transaction.unsafe("SAVEPOINT due_candidate");
          let code: string | null = null;
          let persisted = false;
          try {
            await transaction`
              INSERT INTO public.invoices (
                id, tenant_id, customer_id, order_id, invoice_number, amount_total,
                status, due_date, contract_version, freeze_id, snapshot,
                net_amount_cents, vat_rate_basis_points, vat_amount_cents,
                gross_amount_cents, service_date, payment_term_days,
                order_version, aggregate_version, client_event_id, correlation_id,
                issue_event_id, issued_at, issued_by, pdf_ref, pdf_sha256, pdf_content
              ) VALUES (
                ${entry.invoiceId}::uuid, ${tenantId}, ${entry.customerId},
                ${entry.orderId}, ${invoiceNumber}, 119.00, 'issued',
                ${dueDate}::date, 1, ${entry.freezeId}::uuid,
                ${transaction.json(snapshot)}::jsonb,
                10000, 1900, 1900, 11900, ${entry.fixture.berlinDate}::date, 14, 2, 1,
                ${entry.issueClientEventId}::uuid, ${entry.issueCorrelationId}::uuid,
                ${entry.issueEventId}, ${entry.fixture.instant}::timestamptz, ${userId}::uuid,
                ${`invoice://${entry.invoiceId}/original`}, ${pdfSha256}, ${entry.pdf}
              )
            `;
            const [inserted] = await transaction<{ found: boolean }[]>`
              SELECT EXISTS (
                SELECT 1 FROM public.invoices WHERE id = ${entry.invoiceId}::uuid
              ) AS found
            `;
            persisted = inserted?.found === true;
          } catch (error) {
            code = (error as { code?: string }).code ?? "UNKNOWN";
          }
          await transaction.unsafe("ROLLBACK TO SAVEPOINT due_candidate");
          const [afterRollback] = await transaction<{ found: boolean }[]>`
            SELECT EXISTS (
              SELECT 1 FROM public.invoices WHERE id = ${entry.invoiceId}::uuid
            ) AS found
          `;
          if (afterRollback?.found !== false) throw new Error("F1_4_DUE_CANDIDATE_PERSISTED");
          return { code, persisted };
        };

        for (const entry of ids) {
          // The issue event the invoice references must exist for both attempts.
          await transaction`
            INSERT INTO public.events (
              id, tenant_id, order_id, item_id, event_type, description, user_id,
              payload, status, station, client_event_id, event_schema_version,
              correlation_id, aggregate_version, from_station, created_at
            ) VALUES (
              ${entry.issueEventId}, ${tenantId}, ${entry.orderId}, NULL,
              'INVOICE_CREATED_V1', 'Unveraenderliche Rechnung erstellt', ${userId}::uuid,
              ${transaction.json({
                invoiceId: entry.invoiceId,
                freezeId: entry.freezeId,
                invoiceNumber: entry.invoiceNumber,
                orderVersion: 2,
                netAmountCents: 10000,
                vatRateBasisPoints: 1900,
                vatAmountCents: 1900,
                grossAmountCents: 11900,
                pdfSha256: createHash("sha256").update(entry.pdf).digest("hex"),
                invoiceVersion: 1,
              })}::jsonb,
              'success', 'fertig', ${entry.issueClientEventId}::uuid, 1,
              ${entry.issueCorrelationId}::uuid, 1, 'fertig',
              ${entry.fixture.instant}::timestamptz AT TIME ZONE 'UTC'
            )
          `;
        }

        const dueResults: Record<string, { code: string | null; persisted: boolean }> = {};
        for (const entry of ids) {
          dueResults[`${entry.fixture.key}/${entry.fixture.wrongDueSource}`] =
            await tryInvoice(entry, entry.fixture.wrongDueDate);
          dueResults[`${entry.fixture.key}/berlin`] =
            await tryInvoice(entry, entry.fixture.berlinDueDate);
        }
        expect(dueResults).toEqual({
          "nightly/utc-day": { code: "23514", persisted: false },
          "nightly/berlin": { code: null, persisted: true },
          "midday/session-day": { code: "23514", persisted: false },
          "midday/berlin": { code: null, persisted: true },
        });

        // 3. The real invoice-year CHECK. Every attempt below keeps the Berlin
        // due date, the canonical number shape and every other contract value
        // valid, so a rejection can only come from the year the invoice number
        // itself carries. `nightly` proves the UTC year is not the truth,
        // `midday` proves the Pacific/Kiritimati session year is not either.
        const yearResults: Record<string, { code: string | null; persisted: boolean }> = {};
        for (const entry of ids) {
          yearResults[`${entry.fixture.key}/berlin-year`] =
            await tryInvoice(entry, entry.fixture.berlinDueDate, entry.invoiceNumber);
          yearResults[`${entry.fixture.key}/foreign-year`] =
            await tryInvoice(entry, entry.fixture.berlinDueDate, entry.wrongYearNumber);
        }

        // A legacy row keeps contract_version NULL and a non-canonical number,
        // even when its issue instant contradicts the year in that number.
        const legacyInvoiceId = randomUUID();
        await transaction.unsafe("SAVEPOINT legacy_year_candidate");
        let legacyCode: string | null = null;
        let legacyPersisted = false;
        try {
          await transaction`
            INSERT INTO public.invoices (
              id, tenant_id, invoice_number, amount_total, status, issued_at
            ) VALUES (
              ${legacyInvoiceId}::uuid, ${tenantId}, ${`LEGACY/2026-${suffix}`}, 10.00,
              'sent', ${fixtures[1].instant}::timestamptz
            )
          `;
          const [insertedLegacy] = await transaction<{ found: boolean }[]>`
            SELECT EXISTS (
              SELECT 1 FROM public.invoices
              WHERE id = ${legacyInvoiceId}::uuid AND contract_version IS NULL
            ) AS found
          `;
          legacyPersisted = insertedLegacy?.found === true;
        } catch (error) {
          legacyCode = (error as { code?: string }).code ?? "UNKNOWN";
        }
        await transaction.unsafe("ROLLBACK TO SAVEPOINT legacy_year_candidate");
        yearResults["legacy/non-canonical"] = { code: legacyCode, persisted: legacyPersisted };

        expect(yearResults).toEqual({
          "nightly/berlin-year": { code: null, persisted: true },
          "nightly/foreign-year": { code: "23514", persisted: false },
          "midday/berlin-year": { code: null, persisted: true },
          "midday/foreign-year": { code: "23514", persisted: false },
          "legacy/non-canonical": { code: null, persisted: true },
        });

        throw rollbackSignal;
      });
    } catch (error) {
      if (error !== rollbackSignal) throw error;
    }
  }, 120_000);

  it("rejects status NULL and every missing, null, wrongly typed or empty mandatory path with 23514", async () => {
    const tenantId = `f14-matrix-${suffix}`;
    const userId = randomUUID();
    const customerId = `matrix-customer-${suffix}`;
    const orderId = `matrix-order-${suffix}`;
    const itemId = `matrix-item-${suffix}`;
    const orderNumber = `A-MATRIX-${suffix}`;
    const rateId = randomUUID();
    const freezeId = randomUUID();
    const freezeEventId = randomUUID();
    const freezeClientEventId = randomUUID();
    const freezeCorrelationId = randomUUID();
    const invoiceId = randomUUID();
    const issueEventId = randomUUID();
    const issueClientEventId = randomUUID();
    const issueCorrelationId = randomUUID();
    const issuedAt = "2026-08-21T12:00:00.000Z";
    const serviceDate = "2026-08-21";
    const dueDate = "2026-09-04";
    const invoiceNumber = "R-2026-7001";
    const candidatePdf = Buffer.from("%PDF-1.4\nF1.4 matrix candidate\n%%EOF", "utf8");
    const candidatePdfSha256 = createHash("sha256").update(candidatePdf).digest("hex");
    const rollbackSignal = new Error("ROLLBACK_F1_4_MATRIX");

    /**
     * Every field asserted by invoices_f14_required_issue_fields_chk. Each one
     * gets its own candidate below in which exactly this column is SQL NULL
     * while every other value stays contract-valid.
     */
    const REQUIRED_ISSUE_FIELDS = [
      "status", "order_id", "customer_id", "freeze_id", "invoice_number",
      "snapshot", "net_amount_cents", "vat_rate_basis_points", "vat_amount_cents",
      "gross_amount_cents", "amount_total", "service_date", "order_version",
      "payment_term_days", "due_date", "aggregate_version", "client_event_id",
      "correlation_id", "issue_event_id", "issued_at", "issued_by",
      "pdf_ref", "pdf_sha256", "pdf_content",
    ] as const;
    type RequiredIssueField = (typeof REQUIRED_ISSUE_FIELDS)[number];

    type Candidate = {
      status: string | null;
      /**
       * The jsonb value written into `snapshot`. `null` here is a JSON root null
       * inside the column, never the absent column: SQL NULL is requested with
       * `snapshotSqlNull` instead, so the two rejections stay distinguishable.
       */
      snapshot: postgres.JSONValue;
      /** Writes SQL NULL into the `snapshot` column instead of any jsonb value. */
      snapshotSqlNull?: boolean;
      netAmountCents: number;
      vatRateBasisPoints: number;
      vatAmountCents: number;
      grossAmountCents: number;
      /** Exactly one mandatory issue column forced to SQL NULL. */
      nullIssueField?: RequiredIssueField;
    };

    const baseSnapshot = buildSnapshot({
      orderId,
      orderNumber,
      freezeId,
      itemId,
      serviceDate,
      issuedAt,
      vatRateBasisPoints: 1900,
    });

    const validCandidate = (vatRateBasisPoints: 700 | 1900): Candidate => {
      const netAmountCents = 10000;
      const vatAmountCents = Math.round((netAmountCents * vatRateBasisPoints) / 10000);
      return {
        status: "issued",
        snapshot: buildSnapshot({
          orderId,
          orderNumber,
          freezeId,
          itemId,
          serviceDate,
          issuedAt,
          vatRateBasisPoints,
        }),
        netAmountCents,
        vatRateBasisPoints,
        vatAmountCents,
        grossAmountCents: netAmountCents + vatAmountCents,
      };
    };

    try {
      await sql.begin(async (transaction) => {
        await transaction`
          INSERT INTO public.app_users
            (id, tenant_id, email, full_name, role, active, created_at, updated_at)
          VALUES (
            ${userId}::uuid, ${tenantId}, ${`f14-matrix-${suffix}@local.invalid`},
            'F1.4 Matrix Admin', 'admin', true, now(), now()
          )
        `;
        await transaction`
          INSERT INTO public.company_settings (
            id, tenant_id, company_name, street, zip, city, country,
            iban, bic, bank_name, tax_id, invoice_vat_rate_basis_points,
            invoice_payment_term_days
          ) VALUES (
            ${`matrix-settings-${suffix}`}, ${tenantId}, 'F1.4 Synthetic Galvanik GmbH',
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
            ${customerId}, ${tenantId}, ${`MATRIX-${suffix}`}, 'F1.4 Synthetic Customer',
            'F1.4 Synthetic Customer GmbH', 'business', 'Kundenweg 2',
            '70174', 'Stuttgart', 'Deutschland', now(), now()
          )
        `;
        await transaction`
          INSERT INTO public.orders (
            id, tenant_id, order_number, customer_id, title, station,
            current_station, current_station_id, version, status, created_at
          ) VALUES (
            ${orderId}, ${tenantId}, ${orderNumber}, ${customerId},
            'F1.4 Synthetic Order', 'fertig', 'fertig', 'fertig', 2, 'fertig', now()
          )
        `;
        await transaction`
          INSERT INTO public.items (
            id, tenant_id, order_id, customer_id, name, quantity,
            current_station_id, preis_netto, created_at
          ) VALUES (
            ${itemId}, ${tenantId}, ${orderId}, ${customerId},
            'F1.4 Synthetic Position', 1, 'fertig', 100.00, now()
          )
        `;
        await transaction`
          INSERT INTO private.extra_work_hourly_rates (
            id, tenant_id, hourly_rate_cents, version, created_by, effective_at
          ) VALUES (${rateId}::uuid, ${tenantId}, 12000, 1, ${userId}::uuid, now())
        `;
        await transaction`
          INSERT INTO public.events (
            id, tenant_id, order_id, item_id, event_type, description, user_id,
            payload, status, station, created_at, client_event_id,
            event_schema_version, correlation_id, aggregate_version, from_station
          ) VALUES (
            ${freezeEventId}, ${tenantId}, ${orderId}, NULL, 'ORDER_FROZEN_V1',
            'Order frozen from galvanik to fertig', ${userId}::uuid,
            ${transaction.json({
              freezeId,
              rateId,
              hourlyRateCents: 12000,
              totalAmountCents: 0,
              lineCount: 0,
            })},
            'success', 'fertig',
            ${`${serviceDate}T10:00:00.000Z`}::timestamptz AT TIME ZONE 'UTC',
            ${freezeClientEventId}::uuid, 1, ${freezeCorrelationId}::uuid, 2, 'galvanik'
          )
        `;
        await transaction`
          INSERT INTO private.order_freezes (
            id, tenant_id, order_id, event_id, hourly_rate_id,
            hourly_rate_cents, total_amount_cents, line_count, order_version,
            frozen_by, frozen_at
          ) VALUES (
            ${freezeId}::uuid, ${tenantId}, ${orderId}, ${freezeEventId},
            ${rateId}::uuid, 12000, 0, 0, 2, ${userId}::uuid,
            ${`${serviceDate}T10:00:00.000Z`}::timestamptz
          )
        `;
        await transaction`
          INSERT INTO public.events (
            id, tenant_id, order_id, item_id, event_type, description, user_id,
            payload, status, station, client_event_id, event_schema_version,
            correlation_id, aggregate_version, from_station, created_at
          ) VALUES (
            ${issueEventId}, ${tenantId}, ${orderId}, NULL, 'INVOICE_CREATED_V1',
            'Unveraenderliche Rechnung erstellt', ${userId}::uuid,
            ${transaction.json({
              invoiceId,
              freezeId,
              invoiceNumber,
              orderVersion: 2,
              netAmountCents: 10000,
              vatRateBasisPoints: 1900,
              vatAmountCents: 1900,
              grossAmountCents: 11900,
              pdfSha256: candidatePdfSha256,
              invoiceVersion: 1,
            })}::jsonb,
            'success', 'fertig', ${issueClientEventId}::uuid, 1,
            ${issueCorrelationId}::uuid, 1, 'fertig',
            ${issuedAt}::timestamptz AT TIME ZONE 'UTC'
          )
        `;

        /**
         * Inserts one candidate row inside its own savepoint and reports the
         * SQLSTATE. The savepoint is always released, and the absence of the
         * candidate row is verified afterwards.
         */
        const insertCandidate = async (candidate: Candidate): Promise<string | null> => {
          await transaction.unsafe("SAVEPOINT candidate");
          let code: string | null = null;
          // Forces exactly the named mandatory column to SQL NULL and leaves
          // every other value untouched, so a rejection can only come from the
          // nulled field.
          const nullable = <T>(field: RequiredIssueField, value: T): T | null =>
            (candidate.nullIssueField === field ? null : value);
          // The snapshot reaches the column through its own fragment, never as a
          // serialised string parameter: a text parameter would store the valid
          // object as a jsonb *string*. `sql.json(null)` is bound as SQL NULL,
          // which would silently merge a JSON root null into the absent-column
          // case, so the root null is written as a literal jsonb null instead.
          // Object, scalar and array are bound as their real jsonb type.
          const snapshotSql: postgres.Fragment =
            candidate.snapshotSqlNull || candidate.nullIssueField === "snapshot"
              ? transaction`NULL::jsonb`
              : candidate.snapshot === null
                ? transaction`'null'::jsonb`
                : transaction`${transaction.json(candidate.snapshot)}::jsonb`;
          const amountTotal = (candidate.grossAmountCents / 100).toFixed(2);
          try {
            await transaction`
              INSERT INTO public.invoices (
                id, tenant_id, customer_id, order_id, invoice_number, amount_total,
                status, due_date, contract_version, freeze_id, snapshot,
                net_amount_cents, vat_rate_basis_points, vat_amount_cents,
                gross_amount_cents, service_date, payment_term_days,
                order_version, aggregate_version, client_event_id, correlation_id,
                issue_event_id, issued_at, issued_by, pdf_ref, pdf_sha256, pdf_content
              ) VALUES (
                ${invoiceId}::uuid, ${tenantId},
                ${nullable("customer_id", customerId)}, ${nullable("order_id", orderId)},
                ${nullable("invoice_number", invoiceNumber)},
                ${nullable("amount_total", amountTotal)}::numeric,
                ${nullable("status", candidate.status)},
                ${nullable("due_date", dueDate)}::date, 1,
                ${nullable("freeze_id", freezeId)}::uuid,
                ${snapshotSql},
                ${nullable("net_amount_cents", candidate.netAmountCents)},
                ${nullable("vat_rate_basis_points", candidate.vatRateBasisPoints)},
                ${nullable("vat_amount_cents", candidate.vatAmountCents)},
                ${nullable("gross_amount_cents", candidate.grossAmountCents)},
                ${nullable("service_date", serviceDate)}::date,
                ${nullable("payment_term_days", 14)},
                ${nullable("order_version", 2)},
                ${nullable("aggregate_version", 1)},
                ${nullable("client_event_id", issueClientEventId)}::uuid,
                ${nullable("correlation_id", issueCorrelationId)}::uuid,
                ${nullable("issue_event_id", issueEventId)},
                ${nullable("issued_at", issuedAt)}::timestamptz,
                ${nullable("issued_by", userId)}::uuid,
                ${nullable("pdf_ref", `invoice://${invoiceId}/original`)},
                ${nullable("pdf_sha256", candidatePdfSha256)},
                ${nullable("pdf_content", candidatePdf)}
              )
            `;
          } catch (error) {
            code = (error as { code?: string }).code ?? "UNKNOWN";
          }
          await transaction.unsafe("ROLLBACK TO SAVEPOINT candidate");
          const [persisted] = await transaction<{ found: boolean }[]>`
            SELECT EXISTS (
              SELECT 1 FROM public.invoices WHERE id = ${invoiceId}::uuid
            ) AS found
          `;
          if (persisted?.found !== false) throw new Error("F1_4_CANDIDATE_PERSISTED");
          return code;
        };

        // A contract-valid candidate is accepted at both ratified VAT rates.
        expect(await insertCandidate(validCandidate(1900))).toBeNull();
        expect(await insertCandidate(validCandidate(700))).toBeNull();

        // Column-level SQL NULL for the mandatory lifecycle columns.
        expect(await insertCandidate({ ...validCandidate(1900), status: null })).toBe("23514");
        expect(await insertCandidate({ ...validCandidate(1900), snapshotSqlNull: true }))
          .toBe("23514");

        // A stored jsonb value that is not an object is a different rejection
        // than the absent column above. Root null, root scalar and root array
        // are each held to the same fail-closed 23514 on their own.
        expect(await insertCandidate({ ...validCandidate(1900), snapshot: null })).toBe("23514");
        expect(await insertCandidate({ ...validCandidate(1900), snapshot: 42 })).toBe("23514");
        expect(await insertCandidate({ ...validCandidate(1900), snapshot: [] })).toBe("23514");

        const unexpected: string[] = [];

        // Every single field of invoices_f14_required_issue_fields_chk, one at
        // a time, as SQL NULL in an otherwise fully valid row.
        for (const field of REQUIRED_ISSUE_FIELDS) {
          const code = await insertCandidate({
            ...validCandidate(1900),
            nullIssueField: field,
          });
          if (code !== "23514") unexpected.push(`column:${field}=${code}`);
        }

        // schemaVersion: presence, JSON type and the ratified value itself.
        const schemaVersionMutations: readonly [string, postgres.JSONValue | typeof REMOVE_PATH][] = [
          ["missing", REMOVE_PATH],
          ["json-null", null],
          ["wrong-type", "1"],
          ["mismatch", 2],
        ];
        for (const [variant, value] of schemaVersionMutations) {
          const code = await insertCandidate({
            ...validCandidate(1900),
            snapshot: mutateSnapshot(baseSnapshot, ["schemaVersion"], value),
          });
          if (code !== "23514") unexpected.push(`schemaVersion/${variant}=${code}`);
        }

        // The mandatory snapshot objects themselves, not only their children.
        const containerMutations: readonly [string, postgres.JSONValue | typeof REMOVE_PATH][] = [
          ["missing", REMOVE_PATH],
          ["json-null", null],
          ["wrong-type-scalar", 42],
          ["wrong-type-array", []],
        ];
        for (const container of ["seller", "customer", "order", "totals"] as const) {
          for (const [variant, value] of containerMutations) {
            const code = await insertCandidate({
              ...validCandidate(1900),
              snapshot: mutateSnapshot(baseSnapshot, [container], value),
            });
            if (code !== "23514") unexpected.push(`${container}/${variant}=${code}`);
          }
        }

        // lines must be a non-empty array. A wrongly typed value must stay a
        // fail-closed CHECK violation and must never escape as 22023 from an
        // unguarded jsonb_array_length.
        const lineMutations: readonly [string, postgres.JSONValue | typeof REMOVE_PATH][] = [
          ["missing", REMOVE_PATH],
          ["json-null", null],
          ["wrong-type-object", {}],
          ["wrong-type-scalar", 42],
          ["empty-array", []],
        ];
        for (const [variant, value] of lineMutations) {
          const code = await insertCandidate({
            ...validCandidate(1900),
            snapshot: mutateSnapshot(baseSnapshot, ["lines"], value),
          });
          if (code !== "23514") unexpected.push(`lines/${variant}=${code}`);
        }

        // The optional customer fields are optional in value, never in key:
        // missing or wrongly typed is rejected, JSON null and string accepted.
        const optionalRejected: readonly [string, postgres.JSONValue | typeof REMOVE_PATH][] = [
          ["missing", REMOVE_PATH],
          ["wrong-type", 42],
        ];
        for (const optional of ["companyName", "contactPerson"] as const) {
          for (const [variant, value] of optionalRejected) {
            const code = await insertCandidate({
              ...validCandidate(1900),
              snapshot: mutateSnapshot(baseSnapshot, ["customer", optional], value),
            });
            if (code !== "23514") unexpected.push(`customer.${optional}/${variant}=${code}`);
          }
          const optionalAccepted: readonly [string, postgres.JSONValue | typeof REMOVE_PATH][] = [
            ["json-null", null],
            ["string", `F1.4 Optional ${optional}`],
          ];
          for (const [variant, value] of optionalAccepted) {
            const code = await insertCandidate({
              ...validCandidate(1900),
              snapshot: mutateSnapshot(baseSnapshot, ["customer", optional], value),
            });
            if (code !== null) unexpected.push(`customer.${optional}/${variant}=${code}`);
          }
        }

        const stringPaths: readonly (readonly string[])[] = [
          ["seller", "companyName"], ["seller", "street"], ["seller", "zip"],
          ["seller", "city"], ["seller", "country"], ["seller", "taxId"],
          ["seller", "iban"], ["seller", "bic"], ["seller", "bankName"],
          ["customer", "name"], ["customer", "street"], ["customer", "zip"],
          ["customer", "city"], ["customer", "country"],
          ["order", "orderId"], ["order", "orderNumber"], ["order", "title"],
          ["order", "freezeId"],
          ["serviceDate"], ["issuedAt"],
        ];
        const numberPaths: readonly { path: readonly string[]; mismatch: number }[] = [
          { path: ["order", "orderVersion"], mismatch: 99 },
          { path: ["paymentTermDays"], mismatch: 13 },
          { path: ["totals", "netAmountCents"], mismatch: 9999 },
          { path: ["totals", "vatRateBasisPoints"], mismatch: 700 },
          { path: ["totals", "vatAmountCents"], mismatch: 1901 },
          { path: ["totals", "grossAmountCents"], mismatch: 11901 },
        ];

        for (const path of stringPaths) {
          const mutations: readonly [string, postgres.JSONValue | typeof REMOVE_PATH][] = [
            ["missing", REMOVE_PATH],
            ["json-null", null],
            ["wrong-type", 42],
            ["empty", "   "],
          ];
          for (const [variant, value] of mutations) {
            const code = await insertCandidate({
              ...validCandidate(1900),
              snapshot: mutateSnapshot(baseSnapshot, path, value),
            });
            if (code !== "23514") unexpected.push(`${path.join(".")}/${variant}=${code}`);
          }
        }
        for (const { path, mismatch } of numberPaths) {
          const mutations: readonly [string, postgres.JSONValue | typeof REMOVE_PATH][] = [
            ["missing", REMOVE_PATH],
            ["json-null", null],
            ["wrong-type", "1"],
            ["mismatch", mismatch],
          ];
          for (const [variant, value] of mutations) {
            const code = await insertCandidate({
              ...validCandidate(1900),
              snapshot: mutateSnapshot(baseSnapshot, path, value),
            });
            if (code !== "23514") unexpected.push(`${path.join(".")}/${variant}=${code}`);
          }
        }
        expect(unexpected).toEqual([]);

        throw rollbackSignal;
      });
    } catch (error) {
      if (error !== rollbackSignal) throw error;
    }
  }, 120_000);
});
