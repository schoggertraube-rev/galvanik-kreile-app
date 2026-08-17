import { createHash, randomUUID } from "node:crypto";
import { File as NodeFile } from "node:buffer";
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const BUCKET_ID = "item-photos";
const TENANT_A = "galvanik-kreile";
const RUN_SUFFIX = randomUUID().slice(0, 8);
const TENANT_B = `w4-attachment-tenant-b-${RUN_SUFFIX}`;
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);
const CHANGED_PNG_BYTES = new Uint8Array([...PNG_BYTES.slice(0, -1), 0x02]);
const PNG_SHA256 = createHash("sha256").update(PNG_BYTES).digest("hex");
const LEGACY_SCAN_ID = `w4-legacy-scan-${RUN_SUFFIX}`;
const LEGACY_CUSTOMER_SCAN_ID = `w4-legacy-customer-${RUN_SUFFIX}`;
const LEGACY_INVOICE_SCAN_ID = `w4-legacy-invoice-${RUN_SUFFIX}`;
const INVOICE_ID = randomUUID();

if (
  process.env.DATABASE_URL !== LOCAL_DATABASE_URL
  || process.env.W4_ATTACHMENT_LOCAL_DATABASE_URL !== LOCAL_DATABASE_URL
) {
  throw new Error(
    "W4_ATTACHMENT_LOCAL_REQUIRED: DATABASE_URL and W4_ATTACHMENT_LOCAL_DATABASE_URL must target 127.0.0.1:54322/postgres",
  );
}
if (
  process.env.NEXT_PUBLIC_SUPABASE_URL !== LOCAL_SUPABASE_URL
  || process.env.SUPABASE_URL !== LOCAL_SUPABASE_URL
) {
  throw new Error(
    "W4_ATTACHMENT_LOCAL_REQUIRED: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_URL must target 127.0.0.1:54321",
  );
}
if (
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || !process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error("W4_ATTACHMENT_LOCAL_REQUIRED: distinct local anon and service-role keys are required");
}

const readAppSessionSpy = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/appSession", () => ({ readAppSession: readAppSessionSpy }));
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const USERS = {
  werkstatt: randomUUID(),
  otherWerkstatt: randomUUID(),
  readonly: randomUUID(),
  buero: randomUUID(),
  foreign: randomUUID(),
} as const;
const CUSTOMER = `w4-attachment-customer-${RUN_SUFFIX}`;
const ORDERS = {
  bearer: `w4-attachment-order-bearer-${RUN_SUFFIX}`,
  ui: `w4-attachment-order-ui-${RUN_SUFFIX}`,
  late: `w4-attachment-order-late-${RUN_SUFFIX}`,
  grace: `w4-attachment-order-grace-${RUN_SUFFIX}`,
  concurrent: `w4-attachment-order-concurrent-${RUN_SUFFIX}`,
  mismatch: `w4-attachment-order-mismatch-${RUN_SUFFIX}`,
  corrupt: `w4-attachment-order-corrupt-${RUN_SUFFIX}`,
  ownership: `w4-attachment-order-ownership-${RUN_SUFFIX}`,
  grantFailure: `w4-attachment-order-grant-failure-${RUN_SUFFIX}`,
  legacyInvalid: `w4-attachment-order-legacy-invalid-${RUN_SUFFIX}`,
  lock: `w4-attachment-order-lock-${RUN_SUFFIX}`,
} as const;
const ITEMS = {
  bearer: `w4-attachment-item-bearer-${RUN_SUFFIX}`,
  ui: `w4-attachment-item-ui-${RUN_SUFFIX}`,
  late: `w4-attachment-item-late-${RUN_SUFFIX}`,
  grace: `w4-attachment-item-grace-${RUN_SUFFIX}`,
  concurrent: `w4-attachment-item-concurrent-${RUN_SUFFIX}`,
  mismatch: `w4-attachment-item-mismatch-${RUN_SUFFIX}`,
  corrupt: `w4-attachment-item-corrupt-${RUN_SUFFIX}`,
  ownership: `w4-attachment-item-ownership-${RUN_SUFFIX}`,
  grantFailure: `w4-attachment-item-grant-failure-${RUN_SUFFIX}`,
  legacyInvalid: `w4-attachment-item-legacy-invalid-${RUN_SUFFIX}`,
  lock: `w4-attachment-item-lock-${RUN_SUFFIX}`,
} as const;
const EVENTS = {
  bearer: randomUUID(),
  ui: randomUUID(),
  late: randomUUID(),
  grace: randomUUID(),
  concurrent: randomUUID(),
  mismatch: randomUUID(),
  corrupt: randomUUID(),
  ownership: randomUUID(),
  grantFailure: randomUUID(),
  legacyInvalid: randomUUID(),
  lock: randomUUID(),
} as const;
const CLIENT_REQUESTS = {
  bearer: randomUUID(),
  late: randomUUID(),
  grace: randomUUID(),
  concurrent: randomUUID(),
  ownership: randomUUID(),
  grantFailure: randomUUID(),
} as const;
const LATE_RESERVATION_ID = randomUUID();

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
let Panel: typeof import("@/components/orders/GalvanikHandoffAttachmentPanel").GalvanikHandoffAttachmentPanel;
let anonClient: SupabaseClient;
let serviceClient: SupabaseClient;

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

function decodeTokenClaims(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) throw new Error("W4_SIGNED_UPLOAD_TOKEN_NOT_JWT");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
}

function storageErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as Record<string, unknown>;
  const raw = candidate.status ?? candidate.statusCode;
  const status = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isInteger(status) ? status : null;
}

function stableInfo(value: Record<string, unknown>) {
  return {
    id: value.id,
    version: value.version,
    bucketId: value.bucketId,
    name: value.name,
    createdAt: value.createdAt,
    size: value.size,
    contentType: value.contentType,
  };
}

async function observeStorageRequests<T>(work: () => Promise<T>): Promise<{ value: T; storageRequests: number }> {
  const realFetch = globalThis.fetch;
  let storageRequests = 0;
  globalThis.fetch = async (inputValue, init) => {
    const url = typeof inputValue === "string"
      ? inputValue
      : inputValue instanceof URL
        ? inputValue.toString()
        : inputValue.url;
    if (url.includes("/storage/v1/")) storageRequests += 1;
    return realFetch(inputValue, init);
  };
  try {
    return { value: await work(), storageRequests };
  } finally {
    globalThis.fetch = realFetch;
  }
}

async function readPrivateReceipts(orderId: string, itemId: string) {
  return fixtureSql.begin(async (tx) => {
    await tx.unsafe("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);
    return tx.unsafe<Record<string, unknown>[]>(
      `SELECT * FROM private.v_order_station_evidence_receipts_v2
       WHERE order_id=$1 AND item_id=$2 ORDER BY reserved_at, reservation_id`,
      [orderId, itemId],
    );
  });
}

async function readPrivateEvidenceRecords(orderId: string) {
  return fixtureSql.begin(async (tx) => {
    await tx.unsafe("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);
    return tx.unsafe<Record<string, unknown>[]>(
      `SELECT * FROM private.v_evidence_records_v1
       WHERE target_links @> jsonb_build_array(
         jsonb_build_object('targetType', 'ORDER', 'targetId', $1::text)
       )
       ORDER BY evidence_key`,
      [orderId],
    );
  });
}

async function seedFixtures() {
  await pool.query(
    `INSERT INTO public.app_users
       (id, tenant_id, email, full_name, role, active, created_at, updated_at)
     VALUES
       ($1, $6, $8, 'W4 Werkstatt', 'werkstatt', true, '2026-01-01', '2026-01-01'),
       ($2, $6, $9, 'W4 Other Werkstatt', 'werkstatt', true, '2026-01-01', '2026-01-01'),
       ($3, $6, $10, 'W4 Readonly', 'readonly', true, '2026-01-01', '2026-01-01'),
       ($4, $6, $11, 'W4 Buero', 'buero', true, '2026-01-01', '2026-01-01'),
       ($5, $7, $12, 'W4 Foreign', 'werkstatt', true, '2026-01-01', '2026-01-01')`,
    [
      USERS.werkstatt,
      USERS.otherWerkstatt,
      USERS.readonly,
      USERS.buero,
      USERS.foreign,
      TENANT_A,
      TENANT_B,
      `w4-attachment-werkstatt-${RUN_SUFFIX}@local.invalid`,
      `w4-attachment-other-${RUN_SUFFIX}@local.invalid`,
      `w4-attachment-readonly-${RUN_SUFFIX}@local.invalid`,
      `w4-attachment-buero-${RUN_SUFFIX}@local.invalid`,
      `w4-attachment-foreign-${RUN_SUFFIX}@local.invalid`,
    ],
  );
  await pool.query(
    `INSERT INTO public.customers (id, tenant_id, customer_number, name, type, source)
     VALUES ($1, $2, $3, 'W4 Attachment Kunde', 'business', 'manual')`,
    [CUSTOMER, TENANT_A, `W4-ATTACHMENT-${RUN_SUFFIX}`],
  );

  for (const [index, orderId] of Object.values(ORDERS).entries()) {
    await pool.query(
      `INSERT INTO public.orders
         (id, tenant_id, order_number, customer_id, title, task, station,
          current_station, current_station_id, status, version, source, intake_date, due_date)
       VALUES ($1, $2, $3, $4, 'W4 Attachment', 'Galvanik Übergabe', 'galvanik',
               'galvanik', 'galvanik', 'ready', 2, 'manual',
               '2026-08-11T08:00:00Z', '2026-08-20T08:00:00Z')`,
      [orderId, TENANT_A, `W4-ATT-${RUN_SUFFIX}-${index + 1}`, CUSTOMER],
    );
  }

  await pool.query(
    `INSERT INTO public.invoices
       (id, tenant_id, customer_id, order_id, invoice_number, amount_total, status)
     VALUES ($1, $2, $3, $4, $5, 12.34, 'draft')`,
    [INVOICE_ID, TENANT_A, CUSTOMER, ORDERS.ui, `W4-INVOICE-${RUN_SUFFIX}`],
  );

  const itemIds = Object.values(ITEMS);
  const orderIds = Object.values(ORDERS);
  for (const [index, itemId] of itemIds.entries()) {
    await pool.query(
      `INSERT INTO public.items
         (id, tenant_id, order_id, customer_id, name, quantity, current_station_id)
       VALUES ($1, $2, $3, $4, $5, 1, 'galvanik')`,
      [itemId, TENANT_A, orderIds[index], CUSTOMER, `W4 Übergabeteil ${index + 1}`],
    );
  }

  const eventIds = Object.values(EVENTS);
  for (const [index, eventId] of eventIds.entries()) {
    await pool.query(
      `INSERT INTO public.events (
         id, tenant_id, order_id, item_id, event_type, status, user_id, station,
         client_event_id, event_schema_version, correlation_id, aggregate_version, from_station
       ) VALUES ($1, $2, $3, NULL, 'ORDER_STATION_MOVED_V1', 'success', $4, 'galvanik',
                 $5, 1, $6, 2, 'wareneingang')`,
      [
        eventId,
        TENANT_A,
        orderIds[index],
        USERS.werkstatt,
        randomUUID(),
        randomUUID(),
      ],
    );
  }

  await pool.query(
    `INSERT INTO public.scan_uploads (
       id, tenant_id, file_url, file_type, uploaded_by, uploaded_at,
       detected_type, detection_confidence, extracted_data, status,
       linked_order_id, linked_customer_id, ocr_provider, original_hash,
       original_storage_path, original_size_bytes, original_secured_at,
       client_idempotency_key, field_confidence
     ) VALUES (
       $1, $2, $3, 'application/pdf', $4, '2026-08-11T07:00:00Z',
       'Lieferschein', 0.91, '{"documentNumber":"LS-W4"}'::jsonb, 'processed',
       $5, $6, 'legacy-ocr', $7, $8, 321, '2026-08-11T07:01:00Z',
       $9, '{"documentNumber":0.89}'::jsonb
     )`,
    [
      LEGACY_SCAN_ID,
      TENANT_A,
      `legacy://w4/${RUN_SUFFIX}/scan.pdf`,
      USERS.werkstatt,
      ORDERS.ui,
      CUSTOMER,
      "b".repeat(64),
      `legacy/private/${RUN_SUFFIX}/scan.pdf`,
      `w4-legacy-${RUN_SUFFIX}`,
    ],
  );

  await pool.query(
    `INSERT INTO public.scan_uploads (
       id, tenant_id, file_url, file_type, uploaded_by, uploaded_at,
       detected_type, detection_confidence, status, linked_customer_id, linked_invoice_id,
       client_idempotency_key, field_confidence
     ) VALUES
       ($1, $4, $5, 'application/pdf', $6, '2026-08-11T07:02:00Z',
        'Kundenakte', 0.88, 'processed', $7, NULL, $8, '{}'::jsonb),
       ($2, $4, $9, 'application/pdf', $6, '2026-08-11T07:03:00Z',
        'Rechnung', 0.93, 'processed', NULL, $3, $10, '{}'::jsonb)`,
    [
      LEGACY_CUSTOMER_SCAN_ID,
      LEGACY_INVOICE_SCAN_ID,
      INVOICE_ID,
      TENANT_A,
      `legacy://w4/${RUN_SUFFIX}/customer.pdf`,
      USERS.werkstatt,
      CUSTOMER,
      `w4-legacy-customer-${RUN_SUFFIX}`,
      `legacy://w4/${RUN_SUFFIX}/invoice.pdf`,
      `w4-legacy-invoice-${RUN_SUFFIX}`,
    ],
  );
}

async function insertReservation(input: {
  id: string;
  orderId: string;
  itemId: string;
  eventId: string;
  actorId?: string;
  clientRequestId?: string;
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  fileBytes?: number;
  contentSha256?: string;
  timing?: "current" | "expired" | "grace";
}) {
  const mimeType = input.mimeType ?? "image/png";
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
  const timing = input.timing ?? "current";
  const createdExpression = timing === "expired"
    ? "statement_timestamp() - interval '3 hours'"
    : timing === "grace"
      ? "statement_timestamp() - interval '119 minutes 45 seconds'"
      : "statement_timestamp()";
  await pool.query(
    `WITH reservation_clock AS (SELECT ${createdExpression} AS created_at)
     INSERT INTO private.order_station_evidence_reservations (
       id, tenant_id, customer_id, order_id, item_id, transition_event_id,
       order_version, actor_id, client_request_id, purpose, station, bucket_id,
       object_path, mime_type, file_bytes, content_sha256, created_at, upload_expires_at
     ) SELECT
       $1, $2, $3, $4, $5, $6, 2, $7, $8,
       'GALVANIK_HANDOFF_ORIGINAL_V1', 'galvanik', 'item-photos', $9,
       $10, $11, $12, reservation_clock.created_at,
       reservation_clock.created_at + interval '2 hours'
     FROM reservation_clock`,
    [
      input.id,
      TENANT_A,
      CUSTOMER,
      input.orderId,
      input.itemId,
      input.eventId,
      input.actorId ?? USERS.werkstatt,
      input.clientRequestId ?? randomUUID(),
      `order-station-evidence/v1/${input.id}.${extension}`,
      mimeType,
      input.fileBytes ?? PNG_BYTES.byteLength,
      input.contentSha256 ?? PNG_SHA256,
    ],
  );
}

beforeAll(async () => {
  const version = await pool.query<{ server_version_num: string }>(
    "SELECT current_setting('server_version_num') AS server_version_num",
  );
  if (!version.rows[0]?.server_version_num.startsWith("17")) {
    throw new Error(`W4_ATTACHMENT_LOCAL_REQUIRED: PostgreSQL 17 required, got ${version.rows[0]?.server_version_num}`);
  }
  await seedFixtures();
  actions = await import("@/app/warendurchlauf/actions");
  ({ GalvanikHandoffAttachmentPanel: Panel } = await import(
    "@/components/orders/GalvanikHandoffAttachmentPanel"
  ));
  anonClient = (await import("@/lib/supabase/client")).createClient();
  serviceClient = (await import("@/lib/supabase/admin")).createAdminClient();
});

beforeEach(() => {
  cleanup();
  readAppSessionSpy.mockReset();
  setSession(USERS.werkstatt, "werkstatt");
});

afterAll(async () => {
  cleanup();
  await fixtureSql.end({ timeout: 1 });
  const shared = (globalThis as unknown as {
    conn?: { end: (options?: { timeout?: number }) => Promise<void> };
  }).conn;
  await shared?.end({ timeout: 1 });
});

describe("W4 order-station attachment local acceptance", () => {
  it("replays the exact private schema, immutable catalog, and 12 MiB private bucket contract", async () => {
    const ledger = await pool.query<{ version: string }>(
      `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version`,
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
    ]);

    const columns = await pool.query<{ table_name: string; count: number; names: string[] }>(
      `SELECT table_name, count(*)::int AS count,
              array_agg(column_name ORDER BY ordinal_position) AS names
       FROM information_schema.columns
       WHERE table_schema='private'
         AND table_name IN ('order_station_evidence_reservations', 'order_station_evidence')
       GROUP BY table_name ORDER BY table_name`,
    );
    expect(columns.rows).toEqual([
      {
        table_name: "order_station_evidence",
        count: 11,
        names: [
          "id",
          "reservation_id",
          "tenant_id",
          "actor_id",
          "storage_object_id",
          "storage_object_version",
          "verified_mime_type",
          "verified_file_bytes",
          "verified_content_sha256",
          "storage_created_at",
          "verified_at",
        ],
      },
      {
        table_name: "order_station_evidence_reservations",
        count: 18,
        names: [
          "id",
          "tenant_id",
          "customer_id",
          "order_id",
          "item_id",
          "transition_event_id",
          "order_version",
          "actor_id",
          "client_request_id",
          "purpose",
          "station",
          "bucket_id",
          "object_path",
          "mime_type",
          "file_bytes",
          "content_sha256",
          "upload_expires_at",
          "created_at",
        ],
      },
    ]);

    const constraints = await pool.query<{ relname: string; count: number }>(
      `SELECT c.relname, count(*)::int AS count
       FROM pg_constraint constraint_row
       JOIN pg_class c ON c.oid=constraint_row.conrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='private'
         AND c.relname IN ('order_station_evidence_reservations', 'order_station_evidence')
       GROUP BY c.relname ORDER BY c.relname`,
    );
    expect(constraints.rows).toEqual([
      { relname: "order_station_evidence", count: 11 },
      { relname: "order_station_evidence_reservations", count: 16 },
    ]);
    const constraintManifest = await pool.query<{ relname: string; names: string[] }>(
      `SELECT c.relname, array_agg(constraint_row.conname ORDER BY constraint_row.conname) AS names
       FROM pg_constraint constraint_row
       JOIN pg_class c ON c.oid=constraint_row.conrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='private'
         AND c.relname IN ('order_station_evidence_reservations', 'order_station_evidence')
       GROUP BY c.relname ORDER BY c.relname`,
    );
    expect(constraintManifest.rows).toEqual([
      {
        relname: "order_station_evidence",
        names: [
          "order_station_evidence_actor_fkey",
          "order_station_evidence_bytes_chk",
          "order_station_evidence_id_tenant_key",
          "order_station_evidence_mime_chk",
          "order_station_evidence_pkey",
          "order_station_evidence_reservation_fkey",
          "order_station_evidence_reservation_key",
          "order_station_evidence_sha256_chk",
          "order_station_evidence_storage_object_key",
          "order_station_evidence_storage_version_chk",
          "order_station_evidence_time_chk",
        ],
      },
      {
        relname: "order_station_evidence_reservations",
        names: [
          "order_station_evidence_reservations_actor_fkey",
          "order_station_evidence_reservations_actor_request_key",
          "order_station_evidence_reservations_binding_key",
          "order_station_evidence_reservations_bucket_path_key",
          "order_station_evidence_reservations_bytes_chk",
          "order_station_evidence_reservations_customer_fkey",
          "order_station_evidence_reservations_domain_chk",
          "order_station_evidence_reservations_expiry_chk",
          "order_station_evidence_reservations_item_fkey",
          "order_station_evidence_reservations_mime_chk",
          "order_station_evidence_reservations_order_fkey",
          "order_station_evidence_reservations_order_version_chk",
          "order_station_evidence_reservations_path_chk",
          "order_station_evidence_reservations_pkey",
          "order_station_evidence_reservations_sha256_chk",
          "order_station_evidence_reservations_transition_event_fkey",
        ],
      },
    ]);

    const indexCount = await pool.query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM pg_index i
       JOIN pg_class c ON c.oid=i.indrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='private'
         AND c.relname IN ('order_station_evidence_reservations', 'order_station_evidence')
         AND (i.indisprimary OR i.indisunique)`,
    );
    expect(indexCount.rows[0]?.count).toBe(8);
    const indexManifest = await pool.query<{ names: string[] }>(
      `SELECT array_agg(index_class.relname ORDER BY index_class.relname) AS names
       FROM pg_index i
       JOIN pg_class table_class ON table_class.oid=i.indrelid
       JOIN pg_class index_class ON index_class.oid=i.indexrelid
       JOIN pg_namespace n ON n.oid=table_class.relnamespace
       WHERE n.nspname='private'
         AND table_class.relname IN ('order_station_evidence_reservations', 'order_station_evidence')
         AND (i.indisprimary OR i.indisunique)`,
    );
    expect(indexManifest.rows[0]?.names).toEqual([
      "order_station_evidence_id_tenant_key",
      "order_station_evidence_pkey",
      "order_station_evidence_reservation_key",
      "order_station_evidence_reservations_actor_request_key",
      "order_station_evidence_reservations_binding_key",
      "order_station_evidence_reservations_bucket_path_key",
      "order_station_evidence_reservations_pkey",
      "order_station_evidence_storage_object_key",
    ]);

    const triggerCount = await pool.query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM pg_trigger trigger_row
       JOIN pg_class c ON c.oid=trigger_row.tgrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='private'
         AND c.relname IN ('order_station_evidence_reservations', 'order_station_evidence')
         AND NOT trigger_row.tgisinternal`,
    );
    expect(triggerCount.rows[0]?.count).toBe(6);
    const triggerManifest = await pool.query<{ names: string[] }>(
      `SELECT array_agg(trigger_row.tgname ORDER BY trigger_row.tgname) AS names
       FROM pg_trigger trigger_row
       JOIN pg_class c ON c.oid=trigger_row.tgrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='private'
         AND c.relname IN ('order_station_evidence_reservations', 'order_station_evidence')
         AND NOT trigger_row.tgisinternal`,
    );
    expect(triggerManifest.rows[0]?.names).toEqual([
      "order_station_evidence_delete_immutable",
      "order_station_evidence_reservations_delete_immutable",
      "order_station_evidence_reservations_truncate_immutable",
      "order_station_evidence_reservations_update_immutable",
      "order_station_evidence_truncate_immutable",
      "order_station_evidence_update_immutable",
    ]);

    const evidenceContractColumns = await pool.query<{
      table_name: string;
      names: string[];
    }>(
      `SELECT table_name, array_agg(column_name ORDER BY ordinal_position) AS names
       FROM information_schema.columns
       WHERE table_schema='private'
         AND table_name IN ('evidence_domain_links', 'evidence_extraction_metadata')
       GROUP BY table_name ORDER BY table_name`,
    );
    expect(evidenceContractColumns.rows).toEqual([
      {
        table_name: "evidence_domain_links",
        names: ["id", "evidence_id", "tenant_id", "target_type", "target_id", "created_at"],
      },
      {
        table_name: "evidence_extraction_metadata",
        names: [
          "id",
          "evidence_id",
          "tenant_id",
          "extraction_state",
          "provider",
          "detected_type",
          "detection_confidence",
          "extracted_data",
          "field_confidence",
          "created_at",
        ],
      },
    ]);
    const evidenceContractConstraints = await pool.query<{ relname: string; names: string[] }>(
      `SELECT c.relname, array_agg(constraint_row.conname ORDER BY constraint_row.conname) AS names
       FROM pg_constraint constraint_row
       JOIN pg_class c ON c.oid=constraint_row.conrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='private'
         AND c.relname IN ('evidence_domain_links', 'evidence_extraction_metadata')
       GROUP BY c.relname ORDER BY c.relname`,
    );
    expect(evidenceContractConstraints.rows).toEqual([
      {
        relname: "evidence_domain_links",
        names: [
          "evidence_domain_links_evidence_fkey",
          "evidence_domain_links_pkey",
          "evidence_domain_links_target_id_chk",
          "evidence_domain_links_target_key",
          "evidence_domain_links_type_chk",
        ],
      },
      {
        relname: "evidence_extraction_metadata",
        names: [
          "evidence_extraction_metadata_evidence_fkey",
          "evidence_extraction_metadata_evidence_key",
          "evidence_extraction_metadata_payload_chk",
          "evidence_extraction_metadata_pkey",
          "evidence_extraction_metadata_state_chk",
        ],
      },
    ]);
    const evidenceContractTriggers = await pool.query<{ names: string[] }>(
      `SELECT array_agg(trigger_row.tgname ORDER BY trigger_row.tgname) AS names
       FROM pg_trigger trigger_row
       JOIN pg_class c ON c.oid=trigger_row.tgrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='private'
         AND c.relname IN ('evidence_domain_links', 'evidence_extraction_metadata')
         AND NOT trigger_row.tgisinternal`,
    );
    expect(evidenceContractTriggers.rows[0]?.names).toEqual([
      "evidence_domain_links_delete_immutable",
      "evidence_domain_links_truncate_immutable",
      "evidence_domain_links_update_immutable",
      "evidence_extraction_metadata_delete_immutable",
      "evidence_extraction_metadata_truncate_immutable",
      "evidence_extraction_metadata_update_immutable",
    ]);

    const catalog = await pool.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
      relacl: string[] | null;
      reloptions: string[] | null;
    }>(
      `SELECT relname, relrowsecurity, relforcerowsecurity, relacl, reloptions
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='private'
         AND relname IN (
           'evidence_domain_links',
           'evidence_extraction_metadata',
           'order_station_evidence_reservations',
           'order_station_evidence',
           'v_order_station_evidence_receipts_v1',
           'v_order_station_evidence_receipts_v2',
           'v_evidence_records_v1'
         ) ORDER BY relname`,
    );
    expect(catalog.rows).toHaveLength(7);
    expect(catalog.rows.every((row) => !row.relrowsecurity && !row.relforcerowsecurity && row.relacl === null)).toBe(true);
    expect(catalog.rows.find((row) => row.relname === "v_order_station_evidence_receipts_v1")?.reloptions)
      .toContain("security_invoker=true");
    expect(catalog.rows.find((row) => row.relname === "v_order_station_evidence_receipts_v2")?.reloptions)
      .toContain("security_invoker=true");
    expect(catalog.rows.find((row) => row.relname === "v_evidence_records_v1")?.reloptions)
      .toContain("security_invoker=true");

    const policyCount = await pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM pg_policies
       WHERE schemaname='private'
         AND tablename IN (
           'order_station_evidence_reservations',
           'order_station_evidence',
           'evidence_extraction_metadata',
           'evidence_domain_links'
         )`,
    );
    expect(policyCount.rows[0]?.count).toBe(0);
    const privileges = await pool.query<{
      role_name: string;
      relname: string;
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(
      `SELECT role_name, relname,
              has_table_privilege(role_name, 'private.' || quote_ident(relname), 'SELECT') AS can_select,
              has_table_privilege(role_name, 'private.' || quote_ident(relname), 'INSERT') AS can_insert,
              has_table_privilege(role_name, 'private.' || quote_ident(relname), 'UPDATE') AS can_update,
              has_table_privilege(role_name, 'private.' || quote_ident(relname), 'DELETE') AS can_delete
       FROM unnest(ARRAY['anon','authenticated','service_role']) role_name
       CROSS JOIN unnest(ARRAY[
         'evidence_domain_links',
         'evidence_extraction_metadata',
         'order_station_evidence_reservations',
         'order_station_evidence',
         'v_order_station_evidence_receipts_v1',
         'v_order_station_evidence_receipts_v2',
         'v_evidence_records_v1'
       ]) relname
       ORDER BY role_name, relname`,
    );
    expect(privileges.rows).toHaveLength(21);
    expect(privileges.rows.every((row) =>
      !row.can_select && !row.can_insert && !row.can_update && !row.can_delete)).toBe(true);
    const defaultAcl = await pool.query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM pg_default_acl defaults
       JOIN pg_namespace n ON n.oid=defaults.defaclnamespace
       CROSS JOIN LATERAL aclexplode(defaults.defaclacl) acl
       LEFT JOIN pg_roles granted_role ON granted_role.oid=acl.grantee
       WHERE n.nspname='private'
         AND (
           acl.grantee=0
           OR granted_role.rolname IN ('anon', 'authenticated', 'service_role')
         )`,
    );
    expect(defaultAcl.rows[0]?.count).toBe(0);
    const prefixPolicyCount = await pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM pg_policies
       WHERE schemaname='storage' AND tablename='objects'
         AND (coalesce(qual, '') ILIKE '%order-station-evidence%'
           OR coalesce(with_check, '') ILIKE '%order-station-evidence%')`,
    );
    expect(prefixPolicyCount.rows[0]?.count).toBe(0);

    const bucket = await pool.query<{
      public: boolean;
      file_size_limit: number;
      allowed_mime_types: string[];
    }>(
      `SELECT public, file_size_limit::int AS file_size_limit, allowed_mime_types
       FROM storage.buckets WHERE id='item-photos'`,
    );
    expect(bucket.rows).toEqual([{
      public: false,
      file_size_limit: 12_582_912,
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
    }]);
  });

  it("denies ordinary anon writes and never exposes a real private object through anon list", async () => {
    const hiddenName = `${randomUUID()}.png`;
    const hiddenPath = `order-station-evidence/v1/${hiddenName}`;
    const seeded = await serviceClient.storage.from(BUCKET_ID).upload(hiddenPath, PNG_BYTES, {
      contentType: "image/png",
      upsert: false,
    });
    expect(seeded.error).toBeNull();
    const listed = await anonClient.storage.from(BUCKET_ID).list("order-station-evidence/v1", {
      limit: 100,
      search: hiddenName,
    });
    expect(listed.data?.some((entry) => entry.name === hiddenName) ?? false).toBe(false);

    const unsignedPath = `order-station-evidence/v1/${randomUUID()}.png`;
    const unsigned = await anonClient.storage.from(BUCKET_ID).upload(unsignedPath, PNG_BYTES, {
      contentType: "image/png",
      upsert: false,
    });
    expect(unsigned.data).toBeNull();
    expect(storageErrorStatus(unsigned.error)).toBeGreaterThanOrEqual(400);
    expect(storageErrorStatus(unsigned.error)).toBeLessThan(500);
    const absent = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM storage.objects WHERE bucket_id=$1 AND name=$2",
      [BUCKET_ID, unsignedPath],
    );
    expect(absent.rows[0]?.count).toBe(0);
  });

  it("commits one PENDING reservation before a real signed-grant network failure and exposes no token", async () => {
    const input = {
      orderId: ORDERS.grantFailure,
      itemId: ITEMS.grantFailure,
      expectedVersion: 2,
      clientRequestId: CLIENT_REQUESTS.grantFailure,
      mimeType: "image/png" as const,
      fileBytes: PNG_BYTES.byteLength,
      contentSha256: PNG_SHA256,
    };
    const localUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const realFetch = globalThis.fetch;
    let truthAtGrantRequest: { reservations: number; evidence: number; objects: number } | null = null;
    globalThis.fetch = async (inputValue, init) => {
      const url = typeof inputValue === "string"
        ? inputValue
        : inputValue instanceof URL
          ? inputValue.toString()
          : inputValue.url;
      if (url.includes("/storage/v1/object/upload/sign/")) {
        const snapshot = await pool.query<{ reservations: number; evidence: number; objects: number }>(
          `SELECT
             (SELECT count(*)::int FROM private.order_station_evidence_reservations WHERE order_id=$1) AS reservations,
             (SELECT count(*)::int FROM private.order_station_evidence evidence
              JOIN private.order_station_evidence_reservations reservation ON reservation.id=evidence.reservation_id
              WHERE reservation.order_id=$1) AS evidence,
             (SELECT count(*)::int FROM storage.objects object_row
              WHERE object_row.bucket_id='item-photos'
                AND object_row.name IN (
                  SELECT object_path FROM private.order_station_evidence_reservations WHERE order_id=$1
                )) AS objects`,
          [ORDERS.grantFailure],
        );
        truthAtGrantRequest = snapshot.rows[0] ?? null;
      }
      return realFetch(inputValue, init);
    };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:1";
    let result: Awaited<ReturnType<typeof actions.reserveGalvanikHandoffAttachmentAction>> | undefined;
    try {
      result = await actions.reserveGalvanikHandoffAttachmentAction(input);
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = localUrl;
      globalThis.fetch = realFetch;
    }
    expect(result).toEqual({
      code: "UNAVAILABLE",
      message: "Uploadfreigabe konnte nicht sicher erstellt werden.",
    });
    expect(truthAtGrantRequest).toEqual({ reservations: 1, evidence: 0, objects: 0 });
    const truth = await pool.query<{ reservations: number; evidence: number; objects: number }>(
      `SELECT
         (SELECT count(*)::int FROM private.order_station_evidence_reservations WHERE order_id=$1) AS reservations,
         (SELECT count(*)::int FROM private.order_station_evidence evidence
          JOIN private.order_station_evidence_reservations reservation ON reservation.id=evidence.reservation_id
          WHERE reservation.order_id=$1) AS evidence,
         (SELECT count(*)::int FROM storage.objects object_row
          WHERE object_row.bucket_id='item-photos'
            AND object_row.name IN (
              SELECT object_path FROM private.order_station_evidence_reservations WHERE order_id=$1
            )) AS objects`,
      [ORDERS.grantFailure],
    );
    expect(truth.rows[0]).toMatchObject({ reservations: 1, evidence: 0, objects: 0 });
    const readback = await actions.getGalvanikHandoffAttachmentsAction({
      orderId: ORDERS.grantFailure,
      itemId: ITEMS.grantFailure,
    });
    if (readback.code !== "OK") throw new Error("W4_GRANT_FAILURE_READBACK_NOT_OK");
    expect(readback.data.receipts).toHaveLength(1);
    expect(readback.data.receipts[0]).toMatchObject({ state: "PENDING" });
  });

  it("survives a lost reserve response and proves one upsert:false token cannot overwrite via client upsert:true", async () => {
    const input = {
      orderId: ORDERS.bearer,
      itemId: ITEMS.bearer,
      expectedVersion: 2,
      clientRequestId: CLIENT_REQUESTS.bearer,
      mimeType: "image/png" as const,
      fileBytes: PNG_BYTES.byteLength,
      contentSha256: PNG_SHA256,
    };
    const first = await actions.reserveGalvanikHandoffAttachmentAction(input);
    if (first.code !== "OK" || !first.data.upload) throw new Error("W4_FIRST_RESERVE_NOT_OK");
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const replay = await actions.reserveGalvanikHandoffAttachmentAction(input);
    if (replay.code !== "OK" || !replay.data.upload) throw new Error("W4_REPLAY_RESERVE_NOT_OK");
    expect(replay.data.replayed).toBe(true);
    expect(replay.data.receipt.reservationId).toBe(first.data.receipt.reservationId);
    expect(replay.data.upload.path).toBe(first.data.upload.path);
    expect(replay.data.upload.token).not.toBe(first.data.upload.token);
    const preUploadRows = await pool.query<{ reservations: number; evidence: number }>(
      `SELECT
         (SELECT count(*)::int FROM private.order_station_evidence_reservations WHERE order_id=$1) AS reservations,
         (SELECT count(*)::int FROM private.order_station_evidence evidence
          JOIN private.order_station_evidence_reservations reservation ON reservation.id=evidence.reservation_id
          WHERE reservation.order_id=$1) AS evidence`,
      [ORDERS.bearer],
    );
    expect(preUploadRows.rows).toEqual([{ reservations: 1, evidence: 0 }]);

    const claims = decodeTokenClaims(replay.data.upload.token);
    expect(typeof claims.iat).toBe("number");
    expect(typeof claims.exp).toBe("number");
    expect((claims.exp as number) - (claims.iat as number)).toBe(7_200);
    if ("bucketId" in claims) expect(claims.bucketId).toBe(BUCKET_ID);
    if ("objectName" in claims) expect(claims.objectName).toBe(replay.data.upload.path);
    if ("upsert" in claims) expect(claims.upsert).toBe(false);

    const substitutedPath = `order-station-evidence/v1/${randomUUID()}.png`;
    const substituted = await anonClient.storage.from(BUCKET_ID).uploadToSignedUrl(
      substitutedPath,
      replay.data.upload.token,
      PNG_BYTES,
      { contentType: "image/png", upsert: false },
    );
    expect(substituted.data).toBeNull();
    expect(storageErrorStatus(substituted.error)).toBeGreaterThanOrEqual(400);
    expect(storageErrorStatus(substituted.error)).toBeLessThan(500);
    const substitutedObject = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM storage.objects WHERE bucket_id=$1 AND name=$2",
      [BUCKET_ID, substitutedPath],
    );
    expect(substitutedObject.rows[0]?.count).toBe(0);

    const firstUpload = await anonClient.storage.from(BUCKET_ID).uploadToSignedUrl(
      replay.data.upload.path,
      replay.data.upload.token,
      PNG_BYTES,
      { contentType: "image/png", upsert: false },
    );
    expect(firstUpload.error).toBeNull();
    expect(firstUpload.data?.path).toBe(replay.data.upload.path);
    const infoBeforeAttack = await serviceClient.storage.from(BUCKET_ID).info(replay.data.upload.path);
    expect(infoBeforeAttack.error).toBeNull();
    expect(infoBeforeAttack.data).not.toBeNull();

    const overwriteAttempt = await anonClient.storage.from(BUCKET_ID).uploadToSignedUrl(
      replay.data.upload.path,
      replay.data.upload.token,
      CHANGED_PNG_BYTES,
      { contentType: "image/png", upsert: true },
    );
    expect(overwriteAttempt.data).toBeNull();
    expect(overwriteAttempt.error).not.toBeNull();
    expect(storageErrorStatus(overwriteAttempt.error)).toBeGreaterThanOrEqual(400);
    expect(storageErrorStatus(overwriteAttempt.error)).toBeLessThan(500);
    const infoAfterAttack = await serviceClient.storage.from(BUCKET_ID).info(replay.data.upload.path);
    expect(infoAfterAttack.error).toBeNull();
    expect(stableInfo(infoAfterAttack.data as unknown as Record<string, unknown>))
      .toEqual(stableInfo(infoBeforeAttack.data as unknown as Record<string, unknown>));

    const anonymousDownload = await anonClient.storage.from(BUCKET_ID).download(replay.data.upload.path);
    expect(anonymousDownload.data).toBeNull();
    expect(anonymousDownload.error).not.toBeNull();
    expect(storageErrorStatus(anonymousDownload.error)).toBeGreaterThanOrEqual(400);
    expect(storageErrorStatus(anonymousDownload.error)).toBeLessThan(500);

    const stored = await serviceClient.storage.from(BUCKET_ID).download(replay.data.upload.path);
    expect(stored.error).toBeNull();
    expect(stored.data).not.toBeNull();
    const storedBytes = new Uint8Array(await stored.data!.arrayBuffer());
    expect(createHash("sha256").update(storedBytes).digest("hex")).toBe(PNG_SHA256);
    expect(Array.from(storedBytes.slice(0, 8))).toEqual(Array.from(PNG_BYTES.slice(0, 8)));

    const finalized = await actions.finalizeGalvanikHandoffAttachmentAction({
      reservationId: replay.data.receipt.reservationId,
    });
    if (finalized.code !== "OK") throw new Error("W4_P0_FINALIZE_NOT_OK");
    expect(finalized.data.receipt.state).toBe("FINALIZED");
    const finalizedReplayObserved = await observeStorageRequests(() =>
      actions.reserveGalvanikHandoffAttachmentAction(input));
    expect(finalizedReplayObserved.storageRequests).toBe(0);
    expect(finalizedReplayObserved.value).toEqual({
      code: "OK",
      data: {
        receipt: finalized.data.receipt,
        upload: null,
        replayed: true,
      },
    });
    const mismatchReplayObserved = await observeStorageRequests(() =>
      actions.reserveGalvanikHandoffAttachmentAction({
        ...input,
        contentSha256: "f".repeat(64),
      }));
    expect(mismatchReplayObserved.storageRequests).toBe(0);
    expect(mismatchReplayObserved.value).toEqual({
      code: "CONFLICT",
      reason: "IDEMPOTENCY_MISMATCH",
      message: "Anfragekennung wurde bereits anders verwendet.",
    });

    const readback = await actions.getGalvanikHandoffAttachmentsAction({
      orderId: ORDERS.bearer,
      itemId: ITEMS.bearer,
    });
    if (readback.code !== "OK") throw new Error("W4_P0_READBACK_NOT_OK");
    expect(readback.data.receipts).toEqual([finalized.data.receipt]);

    const original = await actions.getGalvanikHandoffAttachmentOriginalAction({
      receiptId: finalized.data.receipt.receiptId!,
    });
    if (original.code !== "OK") throw new Error("W4_P0_ORIGINAL_NOT_OK");
    expect(original.data.expiresInSeconds).toBe(60);
    const originalToken = new URL(original.data.downloadUrl).searchParams.get("token");
    if (!originalToken) throw new Error("W4_ORIGINAL_TOKEN_MISSING");
    const originalClaims = decodeTokenClaims(originalToken);
    expect((originalClaims.exp as number) - (originalClaims.iat as number)).toBe(60);
    const originalResponse = await fetch(original.data.downloadUrl);
    expect(originalResponse.ok).toBe(true);
    const originalBytes = new Uint8Array(await originalResponse.arrayBuffer());
    expect(createHash("sha256").update(originalBytes).digest("hex")).toBe(PNG_SHA256);
    setSession(USERS.otherWerkstatt, "werkstatt");
    const teamOriginal = await actions.getGalvanikHandoffAttachmentOriginalAction({
      receiptId: finalized.data.receipt.receiptId!,
    });
    if (teamOriginal.code !== "OK") throw new Error("W4_TEAM_ORIGINAL_NOT_OK");
    expect(teamOriginal.data.expiresInSeconds).toBe(60);
    const teamResponse = await fetch(teamOriginal.data.downloadUrl);
    expect(teamResponse.ok).toBe(true);
    expect(createHash("sha256").update(new Uint8Array(await teamResponse.arrayBuffer())).digest("hex"))
      .toBe(PNG_SHA256);
    setSession(USERS.werkstatt, "werkstatt");

    const rows = await pool.query<{ reservations: number; evidence: number }>(
      `SELECT
         (SELECT count(*)::int FROM private.order_station_evidence_reservations WHERE order_id=$1) AS reservations,
         (SELECT count(*)::int FROM private.order_station_evidence evidence
          JOIN private.order_station_evidence_reservations reservation ON reservation.id=evidence.reservation_id
          WHERE reservation.order_id=$1) AS evidence`,
      [ORDERS.bearer],
    );
    expect(rows.rows).toEqual([{ reservations: 1, evidence: 1 }]);
    const receipts = await readPrivateReceipts(ORDERS.bearer, ITEMS.bearer);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ receipt_state: "FINALIZED", integrity_ok: true });

    const immutableBefore = await pool.query<{
      reservation: unknown;
      evidence: unknown;
      extraction: unknown;
      links: unknown;
    }>(
      `SELECT
         (SELECT row_to_json(reservation) FROM private.order_station_evidence_reservations reservation WHERE id=$1) AS reservation,
         (SELECT row_to_json(evidence) FROM private.order_station_evidence evidence WHERE reservation_id=$1) AS evidence,
         (SELECT jsonb_agg(to_jsonb(extraction) ORDER BY extraction.id)
          FROM private.evidence_extraction_metadata extraction
          JOIN private.order_station_evidence evidence ON evidence.id=extraction.evidence_id
          WHERE evidence.reservation_id=$1) AS extraction,
         (SELECT jsonb_agg(to_jsonb(link) ORDER BY link.target_type, link.target_id)
          FROM private.evidence_domain_links link
          JOIN private.order_station_evidence evidence ON evidence.id=link.evidence_id
          WHERE evidence.reservation_id=$1) AS links`,
      [replay.data.receipt.reservationId],
    );
    for (const mutation of [
      `UPDATE private.order_station_evidence_reservations SET purpose=purpose
       WHERE id='${replay.data.receipt.reservationId}'`,
      `DELETE FROM private.order_station_evidence_reservations
       WHERE id='${replay.data.receipt.reservationId}'`,
      "TRUNCATE private.order_station_evidence_reservations CASCADE",
      `UPDATE private.order_station_evidence SET verified_at=verified_at
       WHERE reservation_id='${replay.data.receipt.reservationId}'`,
      `DELETE FROM private.order_station_evidence WHERE reservation_id='${replay.data.receipt.reservationId}'`,
      "TRUNCATE private.order_station_evidence CASCADE",
      `UPDATE private.evidence_extraction_metadata SET extraction_state=extraction_state
       WHERE evidence_id='${finalized.data.receipt.receiptId}'`,
      `DELETE FROM private.evidence_extraction_metadata
       WHERE evidence_id='${finalized.data.receipt.receiptId}'`,
      "TRUNCATE private.evidence_extraction_metadata",
      `UPDATE private.evidence_domain_links SET target_id=target_id
       WHERE evidence_id='${finalized.data.receipt.receiptId}'`,
      `DELETE FROM private.evidence_domain_links
       WHERE evidence_id='${finalized.data.receipt.receiptId}'`,
      "TRUNCATE private.evidence_domain_links",
    ]) {
      await expect(fixtureSql.begin(async (tx) => tx.unsafe(mutation)))
        .rejects.toMatchObject({ code: "P0001" });
    }
    const immutableAfter = await pool.query<{
      reservation: unknown;
      evidence: unknown;
      extraction: unknown;
      links: unknown;
    }>(
      `SELECT
         (SELECT row_to_json(reservation) FROM private.order_station_evidence_reservations reservation WHERE id=$1) AS reservation,
         (SELECT row_to_json(evidence) FROM private.order_station_evidence evidence WHERE reservation_id=$1) AS evidence,
         (SELECT jsonb_agg(to_jsonb(extraction) ORDER BY extraction.id)
          FROM private.evidence_extraction_metadata extraction
          JOIN private.order_station_evidence evidence ON evidence.id=extraction.evidence_id
          WHERE evidence.reservation_id=$1) AS extraction,
         (SELECT jsonb_agg(to_jsonb(link) ORDER BY link.target_type, link.target_id)
          FROM private.evidence_domain_links link
          JOIN private.order_station_evidence evidence ON evidence.id=link.evidence_id
          WHERE evidence.reservation_id=$1) AS links`,
      [replay.data.receipt.reservationId],
    );
    expect(immutableAfter.rows).toEqual(immutableBefore.rows);

    const drift = await serviceClient.storage.from(BUCKET_ID).update(
      replay.data.upload.path,
      CHANGED_PNG_BYTES,
      { contentType: "image/png", upsert: true },
    );
    expect(drift.error).toBeNull();
    const driftedOriginal = await actions.getGalvanikHandoffAttachmentOriginalAction({
      receiptId: finalized.data.receipt.receiptId!,
    });
    expect(driftedOriginal).toMatchObject({ code: "CONFLICT", reason: "STORAGE_CHANGED" });
  });

  it("keeps readonly and buero metadata-only and isolates a foreign tenant", async () => {
    const bearerBinding = await pool.query<{ reservation_id: string; receipt_id: string }>(
      `SELECT reservation.id AS reservation_id, evidence.id AS receipt_id
       FROM private.order_station_evidence_reservations reservation
       JOIN private.order_station_evidence evidence ON evidence.reservation_id=reservation.id
       WHERE reservation.order_id=$1`,
      [ORDERS.bearer],
    );
    const before = await pool.query<{ reservations: number; evidence: number; objects: number }>(
      `SELECT
         (SELECT count(*)::int FROM private.order_station_evidence_reservations) AS reservations,
         (SELECT count(*)::int FROM private.order_station_evidence) AS evidence,
         (SELECT count(*)::int FROM storage.objects WHERE bucket_id='item-photos') AS objects`,
    );
    for (const [userId, role] of [[USERS.readonly, "readonly"], [USERS.buero, "buero"]] as const) {
      setSession(userId, role);
      const read = await actions.getGalvanikHandoffAttachmentsAction({
        orderId: ORDERS.bearer,
        itemId: ITEMS.bearer,
      });
      if (read.code !== "OK") throw new Error(`W4_${role.toUpperCase()}_READ_NOT_OK`);
      expect(read.data.canOperate).toBe(false);
      expect(read.data.receipts).toHaveLength(1);
      const denied = await observeStorageRequests(async () => ({
        reserve: await actions.reserveGalvanikHandoffAttachmentAction({
          orderId: ORDERS.bearer,
          itemId: ITEMS.bearer,
          expectedVersion: 2,
          clientRequestId: randomUUID(),
          mimeType: "image/png",
          fileBytes: PNG_BYTES.byteLength,
          contentSha256: PNG_SHA256,
        }),
        finalize: await actions.finalizeGalvanikHandoffAttachmentAction({
          reservationId: bearerBinding.rows[0]!.reservation_id,
        }),
        original: await actions.getGalvanikHandoffAttachmentOriginalAction({
          receiptId: bearerBinding.rows[0]!.receipt_id,
        }),
      }));
      expect(denied.value.reserve.code).toBe("FORBIDDEN");
      expect(denied.value.finalize.code).toBe("FORBIDDEN");
      expect(denied.value.original.code).toBe("FORBIDDEN");
      expect(denied.storageRequests).toBe(0);
    }

    setSession(USERS.otherWerkstatt, "werkstatt");
    const wrongActor = await observeStorageRequests(() =>
      actions.finalizeGalvanikHandoffAttachmentAction({
        reservationId: bearerBinding.rows[0]!.reservation_id,
      }));
    expect(wrongActor.value.code).toBe("NOT_FOUND");
    expect(wrongActor.storageRequests).toBe(0);

    setSession(USERS.foreign, "werkstatt", TENANT_B);
    const foreign = await observeStorageRequests(async () => ({
      read: await actions.getGalvanikHandoffAttachmentsAction({
        orderId: ORDERS.bearer,
        itemId: ITEMS.bearer,
      }),
      reserve: await actions.reserveGalvanikHandoffAttachmentAction({
        orderId: ORDERS.bearer,
        itemId: ITEMS.bearer,
        expectedVersion: 2,
        clientRequestId: randomUUID(),
        mimeType: "image/png",
        fileBytes: PNG_BYTES.byteLength,
        contentSha256: PNG_SHA256,
      }),
      finalize: await actions.finalizeGalvanikHandoffAttachmentAction({
        reservationId: bearerBinding.rows[0]!.reservation_id,
      }),
      original: await actions.getGalvanikHandoffAttachmentOriginalAction({
        receiptId: bearerBinding.rows[0]!.receipt_id,
      }),
    }));
    expect(foreign.value.read.code).toBe("UNAUTHENTICATED");
    expect(foreign.value.reserve.code).toBe("UNAUTHENTICATED");
    expect(foreign.value.finalize.code).toBe("UNAUTHENTICATED");
    expect(foreign.value.original.code).toBe("UNAUTHENTICATED");
    expect(foreign.storageRequests).toBe(0);
    const tenantBView = await fixtureSql.begin(async (tx) => {
      await tx.unsafe("SELECT set_config('app.tenant_id', $1, true)", [TENANT_B]);
      return tx.unsafe<{ count: number }[]>(
        `SELECT count(*)::int AS count FROM private.v_order_station_evidence_receipts_v1
         WHERE order_id=$1 AND item_id=$2`,
        [ORDERS.bearer, ITEMS.bearer],
      );
    });
    expect(tenantBView[0]?.count).toBe(0);
    const after = await pool.query<{ reservations: number; evidence: number; objects: number }>(
      `SELECT
         (SELECT count(*)::int FROM private.order_station_evidence_reservations) AS reservations,
         (SELECT count(*)::int FROM private.order_station_evidence) AS evidence,
         (SELECT count(*)::int FROM storage.objects WHERE bucket_id='item-photos') AS objects`,
    );
    expect(after.rows).toEqual(before.rows);
  });

  it("serializes two real concurrent finalize calls into one Evidence row and one replay", async () => {
    const input = {
      orderId: ORDERS.concurrent,
      itemId: ITEMS.concurrent,
      expectedVersion: 2,
      clientRequestId: CLIENT_REQUESTS.concurrent,
      mimeType: "image/png" as const,
      fileBytes: PNG_BYTES.byteLength,
      contentSha256: PNG_SHA256,
    };
    const reserve = await actions.reserveGalvanikHandoffAttachmentAction(input);
    if (reserve.code !== "OK" || !reserve.data.upload) throw new Error("W4_CONCURRENT_RESERVE_NOT_OK");
    const uploaded = await anonClient.storage.from(BUCKET_ID).uploadToSignedUrl(
      reserve.data.upload.path,
      reserve.data.upload.token,
      PNG_BYTES,
      { contentType: "image/png", upsert: false },
    );
    expect(uploaded.error).toBeNull();
    const realFetch = globalThis.fetch;
    let infoArrivals = 0;
    let releaseInfo!: () => void;
    const bothAtFirstInfo = new Promise<void>((resolve) => { releaseInfo = resolve; });
    globalThis.fetch = async (inputValue, init) => {
      const url = typeof inputValue === "string"
        ? inputValue
        : inputValue instanceof URL
          ? inputValue.toString()
          : inputValue.url;
      if (
        url.includes("/storage/v1/object/info/")
        && decodeURIComponent(url).includes(reserve.data.upload!.path)
        && infoArrivals < 2
      ) {
        infoArrivals += 1;
        if (infoArrivals === 2) releaseInfo();
        await bothAtFirstInfo;
      }
      return realFetch(inputValue, init);
    };
    let left!: Awaited<ReturnType<typeof actions.finalizeGalvanikHandoffAttachmentAction>>;
    let right!: Awaited<ReturnType<typeof actions.finalizeGalvanikHandoffAttachmentAction>>;
    try {
      [left, right] = await Promise.all([
        actions.finalizeGalvanikHandoffAttachmentAction({ reservationId: reserve.data.receipt.reservationId }),
        actions.finalizeGalvanikHandoffAttachmentAction({ reservationId: reserve.data.receipt.reservationId }),
      ]);
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(infoArrivals).toBe(2);
    if (left.code !== "OK" || right.code !== "OK") throw new Error("W4_CONCURRENT_FINALIZE_NOT_OK");
    expect([left.data.replayed, right.data.replayed].sort()).toEqual([false, true]);
    expect(left.data.receipt).toEqual(right.data.receipt);
    const evidence = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM private.order_station_evidence WHERE reservation_id=$1",
      [reserve.data.receipt.reservationId],
    );
    expect(evidence.rows[0]?.count).toBe(1);
  });

  it("never finalizes a private object created after the immutable DB upload deadline", async () => {
    const path = `order-station-evidence/v1/${LATE_RESERVATION_ID}.png`;
    await insertReservation({
      id: LATE_RESERVATION_ID,
      orderId: ORDERS.late,
      itemId: ITEMS.late,
      eventId: EVENTS.late,
      clientRequestId: CLIENT_REQUESTS.late,
      timing: "expired",
    });
    const objectCountBeforeGrant = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM storage.objects WHERE bucket_id=$1 AND name=$2",
      [BUCKET_ID, path],
    );
    const expiredReplay = await observeStorageRequests(() =>
      actions.reserveGalvanikHandoffAttachmentAction({
        orderId: ORDERS.late,
        itemId: ITEMS.late,
        expectedVersion: 2,
        clientRequestId: CLIENT_REQUESTS.late,
        mimeType: "image/png",
        fileBytes: PNG_BYTES.byteLength,
        contentSha256: PNG_SHA256,
      }));
    expect(expiredReplay.value).toEqual({
      code: "CONFLICT",
      reason: "UPLOAD_GRANT_EXPIRED",
      message: "Uploadfreigabe ist abgelaufen.",
    });
    expect(expiredReplay.storageRequests).toBe(0);
    const objectCountAfterGrant = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM storage.objects WHERE bucket_id=$1 AND name=$2",
      [BUCKET_ID, path],
    );
    expect(objectCountAfterGrant.rows).toEqual(objectCountBeforeGrant.rows);
    const lateUpload = await serviceClient.storage.from(BUCKET_ID).upload(path, PNG_BYTES, {
      contentType: "image/png",
      upsert: false,
    });
    expect(lateUpload.error).toBeNull();
    const result = await actions.finalizeGalvanikHandoffAttachmentAction({
      reservationId: LATE_RESERVATION_ID,
    });
    expect(result).toMatchObject({ code: "CONFLICT", reason: "UPLOAD_OUTSIDE_WINDOW" });
    const evidence = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM private.order_station_evidence WHERE reservation_id=$1",
      [LATE_RESERVATION_ID],
    );
    expect(evidence.rows[0]?.count).toBe(0);
    const receipts = await readPrivateReceipts(ORDERS.late, ITEMS.late);
    expect(receipts[0]).toMatchObject({ receipt_state: "PENDING", integrity_ok: true });
  });

  it("finalizes after expiry when the signed upload was created inside the DB window", async () => {
    const reservationId = randomUUID();
    await insertReservation({
      id: reservationId,
      orderId: ORDERS.grace,
      itemId: ITEMS.grace,
      eventId: EVENTS.grace,
      clientRequestId: CLIENT_REQUESTS.grace,
      timing: "grace",
    });
    const reserve = await actions.reserveGalvanikHandoffAttachmentAction({
      orderId: ORDERS.grace,
      itemId: ITEMS.grace,
      expectedVersion: 2,
      clientRequestId: CLIENT_REQUESTS.grace,
      mimeType: "image/png",
      fileBytes: PNG_BYTES.byteLength,
      contentSha256: PNG_SHA256,
    });
    if (reserve.code !== "OK" || !reserve.data.upload) throw new Error("W4_GRACE_RESERVE_NOT_OK");
    const upload = await anonClient.storage.from(BUCKET_ID).uploadToSignedUrl(
      reserve.data.upload.path,
      reserve.data.upload.token,
      PNG_BYTES,
      { contentType: "image/png", upsert: false },
    );
    expect(upload.error).toBeNull();
    const objectInfo = await serviceClient.storage.from(BUCKET_ID).info(reserve.data.upload.path);
    expect(objectInfo.error).toBeNull();
    const deadline = await pool.query<{ upload_expires_at: string; remaining_ms: number }>(
      `SELECT upload_expires_at::text,
              greatest(0, ceil(extract(epoch FROM (upload_expires_at - statement_timestamp())) * 1000))::int AS remaining_ms
       FROM private.order_station_evidence_reservations WHERE id=$1`,
      [reservationId],
    );
    expect(new Date(objectInfo.data!.createdAt).getTime())
      .toBeLessThanOrEqual(new Date(deadline.rows[0]!.upload_expires_at).getTime());
    await new Promise((resolve) => setTimeout(resolve, deadline.rows[0]!.remaining_ms + 250));
    const afterDeadline = await pool.query<{ expired: boolean }>(
      "SELECT statement_timestamp() > upload_expires_at AS expired FROM private.order_station_evidence_reservations WHERE id=$1",
      [reservationId],
    );
    expect(afterDeadline.rows[0]?.expired).toBe(true);
    const finalized = await actions.finalizeGalvanikHandoffAttachmentAction({ reservationId });
    if (finalized.code !== "OK") throw new Error("W4_GRACE_FINALIZE_NOT_OK");
    expect(finalized.data.receipt.state).toBe("FINALIZED");
    const evidence = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM private.order_station_evidence WHERE reservation_id=$1",
      [reservationId],
    );
    expect(evidence.rows[0]?.count).toBe(1);
  }, 30_000);

  it("rejects real MIME, byte-count, magic, SHA, and pre-reservation object drift with zero Evidence", async () => {
    const largerPng = new Uint8Array([...PNG_BYTES, 0x03]);
    const invalidMagic = new Uint8Array(PNG_BYTES);
    invalidMagic[0] = 0x00;
    const cases = [
      {
        label: "byte count",
        objectBytes: largerPng,
        objectMime: "image/png",
        reservedBytes: PNG_BYTES.byteLength,
        reservedSha: PNG_SHA256,
      },
      {
        label: "MIME",
        objectBytes: PNG_BYTES,
        objectMime: "image/webp",
        reservedBytes: PNG_BYTES.byteLength,
        reservedSha: PNG_SHA256,
      },
      {
        label: "magic",
        objectBytes: invalidMagic,
        objectMime: "image/png",
        reservedBytes: invalidMagic.byteLength,
        reservedSha: createHash("sha256").update(invalidMagic).digest("hex"),
      },
      {
        label: "SHA",
        objectBytes: PNG_BYTES,
        objectMime: "image/png",
        reservedBytes: PNG_BYTES.byteLength,
        reservedSha: "0".repeat(64),
      },
    ] as const;
    for (const drift of cases) {
      const reservationId = randomUUID();
      await insertReservation({
        id: reservationId,
        orderId: ORDERS.mismatch,
        itemId: ITEMS.mismatch,
        eventId: EVENTS.mismatch,
        fileBytes: drift.reservedBytes,
        contentSha256: drift.reservedSha,
      });
      const path = `order-station-evidence/v1/${reservationId}.png`;
      const upload = await serviceClient.storage.from(BUCKET_ID).upload(path, drift.objectBytes, {
        contentType: drift.objectMime,
        upsert: false,
      });
      expect(upload.error, drift.label).toBeNull();
      const result = await actions.finalizeGalvanikHandoffAttachmentAction({ reservationId });
      expect(result, drift.label).toMatchObject({ code: "CONFLICT", reason: "UPLOAD_MISMATCH" });
      const evidence = await pool.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM private.order_station_evidence WHERE reservation_id=$1",
        [reservationId],
      );
      expect(evidence.rows[0]?.count, drift.label).toBe(0);
      const retained = (await readPrivateReceipts(ORDERS.mismatch, ITEMS.mismatch))
        .find((row) => row.reservation_id === reservationId);
      expect(retained, drift.label).toMatchObject({ receipt_state: "PENDING", integrity_ok: true });
    }

    const beforeReservationId = randomUUID();
    const beforePath = `order-station-evidence/v1/${beforeReservationId}.png`;
    const beforeUpload = await serviceClient.storage.from(BUCKET_ID).upload(beforePath, PNG_BYTES, {
      contentType: "image/png",
      upsert: false,
    });
    expect(beforeUpload.error).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    await insertReservation({
      id: beforeReservationId,
      orderId: ORDERS.mismatch,
      itemId: ITEMS.mismatch,
      eventId: EVENTS.mismatch,
    });
    const beforeResult = await actions.finalizeGalvanikHandoffAttachmentAction({
      reservationId: beforeReservationId,
    });
    expect(beforeResult).toMatchObject({ code: "CONFLICT", reason: "UPLOAD_OUTSIDE_WINDOW" });
    const totalEvidence = await pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM private.order_station_evidence evidence
       JOIN private.order_station_evidence_reservations reservation ON reservation.id=evidence.reservation_id
       WHERE reservation.order_id=$1`,
      [ORDERS.mismatch],
    );
    expect(totalEvidence.rows[0]?.count).toBe(0);
    const beforeRetained = (await readPrivateReceipts(ORDERS.mismatch, ITEMS.mismatch))
      .find((row) => row.reservation_id === beforeReservationId);
    expect(beforeRetained).toMatchObject({ receipt_state: "PENDING", integrity_ok: true });
  });

  it("retains an INVALID LEFT-JOIN receipt row and makes the real read action fail closed", async () => {
    const reservationId = randomUUID();
    await insertReservation({
      id: reservationId,
      orderId: ORDERS.corrupt,
      itemId: ITEMS.corrupt,
      eventId: EVENTS.corrupt,
      actorId: USERS.foreign,
    });
    const rows = await readPrivateReceipts(ORDERS.corrupt, ITEMS.corrupt);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      reservation_id: reservationId,
      actor_display_name: null,
      receipt_state: "INVALID",
      integrity_ok: false,
    });
    const action = await actions.getGalvanikHandoffAttachmentsAction({
      orderId: ORDERS.corrupt,
      itemId: ITEMS.corrupt,
    });
    expect(action.code).toBe("UNAVAILABLE");
    const evidence = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM private.order_station_evidence WHERE reservation_id=$1",
      [reservationId],
    );
    expect(evidence.rows[0]?.count).toBe(0);
  });

  it("retains malformed legacy extraction truth but the read-only adapter fails closed without mutation", async () => {
    const malformedId = `w4-legacy-invalid-${RUN_SUFFIX}`;
    await pool.query(
      `INSERT INTO public.scan_uploads (
         id, tenant_id, file_url, file_type, uploaded_by, uploaded_at,
         detected_type, detection_confidence, status, linked_order_id,
         client_idempotency_key, field_confidence
       ) VALUES (
         $1, $2, $3, 'application/pdf', $4, '2026-08-11T07:00:00Z',
          'Rechnung', 1.50, 'processed', $5, $6, '{}'::jsonb
       )`,
      [
        malformedId,
        TENANT_A,
        `legacy://w4/${RUN_SUFFIX}/invalid.pdf`,
        USERS.werkstatt,
        ORDERS.legacyInvalid,
        `w4-legacy-invalid-${RUN_SUFFIX}`,
      ],
    );
    const before = await pool.query<{ snapshot: Record<string, unknown> }>(
      "SELECT row_to_json(scan)::jsonb AS snapshot FROM public.scan_uploads scan WHERE id=$1",
      [malformedId],
    );
    const viewRows = await readPrivateEvidenceRecords(ORDERS.legacyInvalid);
    expect(viewRows).toHaveLength(1);
    expect(viewRows[0]).toMatchObject({
      source_kind: "LEGACY_SCAN_UPLOAD",
      source_id: malformedId,
      integrity_ok: false,
    });
    const action = await actions.getGalvanikHandoffAttachmentsAction({
      orderId: ORDERS.legacyInvalid,
      itemId: ITEMS.legacyInvalid,
    });
    expect(action).toEqual({
      code: "UNAVAILABLE",
      message: "Nachweise konnten nicht sicher geladen werden.",
    });
    const after = await pool.query<{ snapshot: Record<string, unknown> }>(
      "SELECT row_to_json(scan)::jsonb AS snapshot FROM public.scan_uploads scan WHERE id=$1",
      [malformedId],
    );
    expect(after.rows).toEqual(before.rows);
  });

  it("reads customer-only and invoice-only legacy Evidence through the polymorphic target action without mutation", async () => {
    const ids = [LEGACY_CUSTOMER_SCAN_ID, LEGACY_INVOICE_SCAN_ID];
    const before = await pool.query<{ id: string; snapshot: Record<string, unknown> }>(
      `SELECT id, row_to_json(scan)::jsonb AS snapshot
       FROM public.scan_uploads scan WHERE id = ANY($1::text[]) ORDER BY id`,
      [ids],
    );

    const customer = await actions.getGalvanikEvidenceByTargetAction({
      targetType: "CUSTOMER",
      targetId: CUSTOMER,
    });
    expect(customer.code).toBe("OK");
    if (customer.code !== "OK") throw new Error("W4_CUSTOMER_EVIDENCE_NOT_OK");
    expect(customer.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: "LEGACY_SCAN_UPLOAD",
        sourceId: LEGACY_CUSTOMER_SCAN_ID,
        targets: [{ targetType: "CUSTOMER", targetId: CUSTOMER }],
      }),
    ]));

    const invoice = await actions.getGalvanikEvidenceByTargetAction({
      targetType: "INVOICE",
      targetId: INVOICE_ID,
    });
    expect(invoice).toEqual({
      code: "OK",
      data: [expect.objectContaining({
        source: "LEGACY_SCAN_UPLOAD",
        sourceId: LEGACY_INVOICE_SCAN_ID,
        targets: [{ targetType: "INVOICE", targetId: INVOICE_ID }],
      })],
    });

    await expect(actions.getGalvanikEvidenceByTargetAction({
      targetType: "INVOICE",
      targetId: ` ${INVOICE_ID}`,
    })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    setSession(USERS.foreign, "werkstatt", TENANT_B);
    await expect(actions.getGalvanikEvidenceByTargetAction({
      targetType: "INVOICE",
      targetId: INVOICE_ID,
    })).resolves.toMatchObject({ code: "UNAUTHENTICATED" });

    const after = await pool.query<{ id: string; snapshot: Record<string, unknown> }>(
      `SELECT id, row_to_json(scan)::jsonb AS snapshot
       FROM public.scan_uploads scan WHERE id = ANY($1::text[]) ORDER BY id`,
      [ids],
    );
    expect(after.rows).toEqual(before.rows);
  });

  it("proves the order FOR UPDATE lock serializes a concurrent child-item phantom", async () => {
    const locker = postgres(LOCAL_DATABASE_URL, { max: 1, prepare: false });
    const contender = postgres(LOCAL_DATABASE_URL, { max: 1, prepare: false });
    let signalLocked!: () => void;
    let releaseLock!: () => void;
    const locked = new Promise<void>((resolve) => { signalLocked = resolve; });
    const release = new Promise<void>((resolve) => { releaseLock = resolve; });
    const lockTransaction = locker.begin(async (tx) => {
      await tx.unsafe("SELECT id FROM public.orders WHERE id=$1 FOR UPDATE", [ORDERS.lock]);
      signalLocked();
      await release;
    });
    await locked;
    await expect(contender.begin(async (tx) => {
      await tx.unsafe("SET LOCAL lock_timeout='200ms'");
      await tx.unsafe(
        `INSERT INTO public.items
           (id, tenant_id, order_id, customer_id, name, quantity, current_station_id)
         VALUES ('w4-attachment-item-lock-phantom', $1, $2, $3, 'Phantom', 1, 'galvanik')`,
        [TENANT_A, ORDERS.lock, CUSTOMER],
      );
    })).rejects.toMatchObject({ code: "55P03" });
    releaseLock();
    await lockTransaction;
    const phantom = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM public.items WHERE id='w4-attachment-item-lock-phantom'",
    );
    expect(phantom.rows[0]?.count).toBe(0);
    await Promise.all([
      locker.end({ timeout: 1 }),
      contender.end({ timeout: 1 }),
    ]);
  });

  it("closes DB to private view to real actions to real Panel to local Storage HTTP and remount readback", async () => {
    setSession(USERS.werkstatt, "werkstatt");
    const legacyBefore = await pool.query<{ snapshot: Record<string, unknown> }>(
      "SELECT row_to_json(scan)::jsonb AS snapshot FROM public.scan_uploads scan WHERE id=$1",
      [LEGACY_SCAN_ID],
    );
    const props = {
      orderId: ORDERS.ui,
      expectedVersion: 2,
      items: [{ id: ITEMS.ui, name: "W4 Übergabeteil UI" }],
    };
    const view = render(createElement(Panel, props));
    expect(await screen.findByText("Noch kein Übergabeoriginal erfasst.", {}, { timeout: 15_000 }))
      .toBeInTheDocument();
    expect(screen.getByText("Bestehender Legacy-Nachweis (nur lesen)")).toBeInTheDocument();
    expect(screen.getByText(/Konfidenz 91 %/)).toBeInTheDocument();
    const realPng = new NodeFile([PNG_BYTES], "galvanik-handoff.png", {
      type: "image/png",
    }) as unknown as File;
    fireEvent.change(screen.getByLabelText(/Neues Original/i, { selector: "input" }), {
      target: { files: [realPng] },
    });
    expect(await screen.findByText("Bestätigt", {}, { timeout: 20_000 })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Original sicher gespeichert und separat aus der Datenbank bestätigt.",
    );

    const persisted = await pool.query<{
      reservation_id: string;
      object_path: string;
      content_sha256: string;
      reservations: number;
      evidence: number;
      extraction_rows: number;
      target_links: number;
    }>(
      `SELECT reservation.id AS reservation_id, reservation.object_path,
              reservation.content_sha256,
              (SELECT count(*)::int FROM private.order_station_evidence_reservations r WHERE r.order_id=$1) AS reservations,
              (SELECT count(*)::int FROM private.order_station_evidence e
               JOIN private.order_station_evidence_reservations r ON r.id=e.reservation_id
               WHERE r.order_id=$1) AS evidence,
              (SELECT count(*)::int FROM private.evidence_extraction_metadata extraction
               JOIN private.order_station_evidence e ON e.id=extraction.evidence_id
               JOIN private.order_station_evidence_reservations r ON r.id=e.reservation_id
               WHERE r.order_id=$1) AS extraction_rows,
              (SELECT count(*)::int FROM private.evidence_domain_links link
               JOIN private.order_station_evidence e ON e.id=link.evidence_id
               JOIN private.order_station_evidence_reservations r ON r.id=e.reservation_id
               WHERE r.order_id=$1) AS target_links
       FROM private.order_station_evidence_reservations reservation
       WHERE reservation.order_id=$1`,
      [ORDERS.ui],
    );
    expect(persisted.rows).toHaveLength(1);
    expect(persisted.rows[0]).toMatchObject({
      content_sha256: PNG_SHA256,
      reservations: 1,
      evidence: 1,
      extraction_rows: 1,
      target_links: 2,
    });
    const objectPath = persisted.rows[0]!.object_path;
    const info = await serviceClient.storage.from(BUCKET_ID).info(objectPath);
    expect(info.error).toBeNull();
    expect(info.data).toMatchObject({
      bucketId: BUCKET_ID,
      name: objectPath,
      size: PNG_BYTES.byteLength,
      contentType: "image/png",
    });
    const downloaded = await serviceClient.storage.from(BUCKET_ID).download(objectPath);
    expect(downloaded.error).toBeNull();
    const downloadedBytes = new Uint8Array(await downloaded.data!.arrayBuffer());
    expect(createHash("sha256").update(downloadedBytes).digest("hex")).toBe(PNG_SHA256);
    const receipts = await readPrivateReceipts(ORDERS.ui, ITEMS.ui);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ receipt_state: "FINALIZED", integrity_ok: true });
    const evidenceRecords = await readPrivateEvidenceRecords(ORDERS.ui);
    expect(evidenceRecords).toHaveLength(2);
    expect(evidenceRecords).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source_kind: "ORDER_STATION_ATTACHMENT",
        extraction_state: "NOT_REQUESTED",
        original_state: "VERIFIED",
        integrity_ok: true,
      }),
      expect.objectContaining({
        source_kind: "LEGACY_SCAN_UPLOAD",
        extraction_state: "LEGACY_RECORDED",
        detection_confidence: "0.91",
        integrity_ok: true,
      }),
    ]));
    const legacyAfter = await pool.query<{ snapshot: Record<string, unknown> }>(
      "SELECT row_to_json(scan)::jsonb AS snapshot FROM public.scan_uploads scan WHERE id=$1",
      [LEGACY_SCAN_ID],
    );
    expect(legacyAfter.rows).toEqual(legacyBefore.rows);

    view.unmount();
    render(createElement(Panel, props));
    expect(await screen.findByText("Bestätigt", {}, { timeout: 15_000 })).toBeInTheDocument();
    expect(screen.getByText("Keine Extraktion angefordert.")).toBeInTheDocument();
    expect(screen.getByText("Bestehender Legacy-Nachweis (nur lesen)")).toBeInTheDocument();
    expect(screen.queryByText("Noch kein Übergabeoriginal erfasst.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Original freigeben" }));
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Privates Original jetzt öffnen" })).toBeInTheDocument();
    }, { timeout: 15_000 });
    await act(async () => { await Promise.resolve(); });
  });
});
