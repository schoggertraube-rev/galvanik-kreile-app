import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  withTransaction: vi.fn(),
  execute: vi.fn(),
  createAdminClient: vi.fn(),
  from: vi.fn(),
  info: vi.fn(),
  download: vi.fn(),
  createSignedUploadUrl: vi.fn(),
  createSignedUrl: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({
  sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }),
}));
vi.mock("@/lib/server/privilegedDb", () => ({
  withPrivilegedTenantTransaction: ports.withTransaction,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: ports.createAdminClient,
}));

import {
  finalizeOrderStationAttachment,
  getOrderStationAttachmentOriginal,
  readOrderStationAttachments,
  reserveOrderStationAttachment,
} from "@/lib/server/orderStationAttachment";
import {
  createOrderStationAttachmentOriginalUrl,
  createOrderStationAttachmentUploadGrant,
  readOrderStationAttachmentInfo,
  readStableOrderStationAttachment,
} from "@/lib/server/orderStationAttachmentStorage";

const TENANT = "galvanik-kreile";
const ACTOR = "11111111-1111-4111-8111-111111111111";
const RESERVATION_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_RESERVATION_ID = "33333333-3333-4333-8333-333333333333";
const CLIENT_REQUEST_ID = "44444444-4444-4444-8444-444444444444";
const EVENT_ID = "55555555-5555-4555-8555-555555555555";
const EVIDENCE_ID = "66666666-6666-4666-8666-666666666666";
const STORAGE_ID = "77777777-7777-4777-8777-777777777777";
const UUID_PATTERN_FOR_TEST = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const PNG_SHA = createHash("sha256").update(PNG_BYTES).digest("hex");
const OBJECT_PATH = `order-station-evidence/v1/${RESERVATION_ID}.png`;

const authorization = {
  userId: ACTOR,
  tenantId: TENANT,
  displayName: "Werkstatt",
  role: "werkstatt" as const,
  permissions: ["perm_view_leitstand", "perm_op_photos"] as const,
  active: true as const,
};

const reservation = {
  id: RESERVATION_ID,
  tenant_id: TENANT,
  customer_id: "customer-a",
  order_id: "order-a",
  item_id: "item-a",
  transition_event_id: EVENT_ID,
  order_version: 2,
  actor_id: ACTOR,
  client_request_id: CLIENT_REQUEST_ID,
  purpose: "GALVANIK_HANDOFF_ORIGINAL_V1",
  station: "galvanik",
  bucket_id: "item-photos",
  object_path: OBJECT_PATH,
  mime_type: "image/png",
  file_bytes: PNG_BYTES.byteLength,
  content_sha256: PNG_SHA,
  upload_expires_at: "2026-08-11T02:00:00.000Z",
  created_at: "2026-08-11T00:00:00.000Z",
};

const pendingReceipt = {
  reservation_id: RESERVATION_ID,
  receipt_id: null,
  tenant_id: TENANT,
  customer_id: reservation.customer_id,
  order_id: reservation.order_id,
  item_id: reservation.item_id,
  transition_event_id: EVENT_ID,
  order_version: 2,
  actor_id: ACTOR,
  actor_display_name: "Werkstatt",
  client_request_id: CLIENT_REQUEST_ID,
  purpose: reservation.purpose,
  station: reservation.station,
  mime_type: "image/png",
  file_bytes: PNG_BYTES.byteLength,
  content_sha256: PNG_SHA,
  upload_expires_at: reservation.upload_expires_at,
  reserved_at: reservation.created_at,
  verified_at: null,
  receipt_state: "PENDING",
  integrity_ok: true,
};

const evidence = {
  id: EVIDENCE_ID,
  reservation_id: RESERVATION_ID,
  tenant_id: TENANT,
  actor_id: ACTOR,
  storage_object_id: STORAGE_ID,
  storage_object_version: "storage-version-1",
  verified_mime_type: "image/png",
  verified_file_bytes: PNG_BYTES.byteLength,
  verified_content_sha256: PNG_SHA,
  storage_created_at: "2026-08-11T01:00:00.000Z",
  verified_at: "2026-08-11T01:01:00.000Z",
};

const finalizedReceipt = {
  ...pendingReceipt,
  receipt_id: EVIDENCE_ID,
  verified_at: evidence.verified_at,
  receipt_state: "FINALIZED",
};

const order = {
  id: reservation.order_id,
  tenant_id: TENANT,
  customer_id: reservation.customer_id,
  version: 2,
  station: "galvanik",
  current_station: "galvanik",
  current_station_id: "galvanik",
  status: "ready",
};
const customer = { id: reservation.customer_id, tenant_id: TENANT };
const item = {
  id: reservation.item_id,
  order_id: reservation.order_id,
  tenant_id: TENANT,
  customer_id: reservation.customer_id,
  current_station_id: "galvanik",
};
const event = {
  id: EVENT_ID,
  tenant_id: TENANT,
  order_id: reservation.order_id,
  item_id: null,
  event_type: "ORDER_STATION_MOVED_V1",
  client_event_id: "88888888-8888-4888-8888-888888888888",
  correlation_id: "99999999-9999-4999-8999-999999999999",
  event_schema_version: 1,
  aggregate_version: 2,
  from_station: "wareneingang",
  station: "galvanik",
  status: "success",
  actor_id: ACTOR,
  actor_tenant_id: TENANT,
};

type FakeQuery = { text: string; values: unknown[] };

function evidenceContractInsertRows(query: FakeQuery): Record<string, unknown>[] | null {
  if (query.text.includes("INSERT INTO private.evidence_extraction_metadata")) {
    return [{
      id: query.values[0],
      evidence_id: query.values[1],
      tenant_id: query.values[2],
      extraction_state: "NOT_REQUESTED",
      provider: null,
      detected_type: null,
      detection_confidence: null,
      extracted_data: null,
      field_confidence: {},
      created_at: evidence.verified_at,
    }];
  }
  if (query.text.includes("INSERT INTO private.evidence_domain_links")) {
    return [
      {
        id: query.values[0],
        evidence_id: query.values[1],
        tenant_id: query.values[2],
        target_type: "ORDER",
        target_id: query.values[3],
        created_at: evidence.verified_at,
      },
      {
        id: query.values[4],
        evidence_id: query.values[5],
        tenant_id: query.values[6],
        target_type: "ORDER_ITEM",
        target_id: query.values[7],
        created_at: evidence.verified_at,
      },
    ];
  }
  return null;
}

function adminInfo(overrides: Record<string, unknown> = {}) {
  return {
    id: STORAGE_ID,
    version: "storage-version-1",
    bucketId: "item-photos",
    name: OBJECT_PATH,
    createdAt: evidence.storage_created_at,
    size: PNG_BYTES.byteLength,
    contentType: "image/png",
    ...overrides,
  };
}

function resetStorage() {
  ports.from.mockReturnValue({
    info: ports.info,
    download: ports.download,
    createSignedUploadUrl: ports.createSignedUploadUrl,
    createSignedUrl: ports.createSignedUrl,
  });
  ports.createAdminClient.mockReturnValue({ storage: { from: ports.from } });
  ports.info.mockResolvedValue({ data: adminInfo(), error: null });
  ports.download.mockResolvedValue({
    data: {
      size: PNG_BYTES.byteLength,
      arrayBuffer: vi.fn().mockResolvedValue(PNG_BYTES.buffer.slice(0)),
    },
    error: null,
  });
  ports.createSignedUploadUrl.mockResolvedValue({
    data: { path: OBJECT_PATH, token: "signed-upload-token" },
    error: null,
  });
  ports.createSignedUrl.mockResolvedValue({
    data: {
      signedUrl: `http://127.0.0.1:54321/storage/v1/object/sign/item-photos/${OBJECT_PATH}?token=download-token&download=galvanik-uebergabe-original.png`,
    },
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStorage();
  ports.withTransaction.mockImplementation(async (_authorization, work) => work({ execute: ports.execute }));
});

describe("W4 order-station attachment storage adapter", () => {
  it("rejects foreign and legacy paths before creating the admin client", async () => {
    await expect(readOrderStationAttachmentInfo("legacy/item.png")).rejects.toMatchObject({ kind: "INVALID" });
    await expect(createOrderStationAttachmentUploadGrant("../escape.png")).rejects.toMatchObject({ kind: "INVALID" });
    expect(ports.createAdminClient).not.toHaveBeenCalled();
  });

  it("validates canonical storage identity and time before any download", async () => {
    for (const override of [
      { id: "not-a-uuid" },
      { createdAt: "not-a-time" },
      { version: " padded " },
    ]) {
      ports.info.mockResolvedValueOnce({ data: adminInfo(override), error: null });
      await expect(readStableOrderStationAttachment(OBJECT_PATH, {
        fileBytes: PNG_BYTES.byteLength,
        mimeType: "image/png",
      })).rejects.toMatchObject({ kind: "INVALID" });
    }
    expect(ports.download).not.toHaveBeenCalled();
  });

  it("distinguishes not-ready, unavailable, and declared-object mismatch without leaking provider details", async () => {
    ports.info.mockResolvedValueOnce({ data: null, error: { statusCode: "404", message: "secret path token" } });
    await expect(readOrderStationAttachmentInfo(OBJECT_PATH)).rejects.toMatchObject({ kind: "NOT_READY" });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    ports.info.mockResolvedValueOnce({ data: null, error: { statusCode: "429", message: "secret path token" } });
    await expect(readOrderStationAttachmentInfo(OBJECT_PATH)).rejects.toMatchObject({ kind: "UNAVAILABLE" });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("secret");
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(OBJECT_PATH);
    errorSpy.mockRestore();

    ports.info.mockResolvedValueOnce({ data: adminInfo({ size: PNG_BYTES.byteLength + 1 }), error: null });
    await expect(readStableOrderStationAttachment(OBJECT_PATH, {
      fileBytes: PNG_BYTES.byteLength,
      mimeType: "image/png",
    })).rejects.toMatchObject({ kind: "MISMATCH" });
    expect(ports.download).not.toHaveBeenCalled();
  });

  it("checks Blob.size before arrayBuffer and rejects padded bearer outputs", async () => {
    const arrayBuffer = vi.fn();
    ports.download.mockResolvedValueOnce({
      data: { size: PNG_BYTES.byteLength + 1, arrayBuffer },
      error: null,
    });
    await expect(readStableOrderStationAttachment(OBJECT_PATH, {
      fileBytes: PNG_BYTES.byteLength,
      mimeType: "image/png",
    })).rejects.toMatchObject({ kind: "MISMATCH" });
    expect(arrayBuffer).not.toHaveBeenCalled();

    ports.info.mockResolvedValueOnce({
      data: adminInfo({ size: 12 * 1024 * 1024 + 1 }),
      error: null,
    });
    await expect(readStableOrderStationAttachment(OBJECT_PATH, {
      fileBytes: PNG_BYTES.byteLength,
      mimeType: "image/png",
    })).rejects.toMatchObject({ kind: "INVALID" });
    expect(ports.download).toHaveBeenCalledTimes(1);

    const oversizedArrayBuffer = vi.fn();
    ports.download.mockResolvedValueOnce({
      data: { size: 12 * 1024 * 1024 + 1, arrayBuffer: oversizedArrayBuffer },
      error: null,
    });
    await expect(readStableOrderStationAttachment(OBJECT_PATH, {
      fileBytes: PNG_BYTES.byteLength,
      mimeType: "image/png",
    })).rejects.toMatchObject({ kind: "INVALID" });
    expect(oversizedArrayBuffer).not.toHaveBeenCalled();

    ports.createSignedUploadUrl.mockResolvedValueOnce({
      data: { path: OBJECT_PATH, token: " padded-token " },
      error: null,
    });
    await expect(createOrderStationAttachmentUploadGrant(OBJECT_PATH)).rejects.toMatchObject({ kind: "UNAVAILABLE" });
    ports.createSignedUrl.mockResolvedValueOnce({ data: { signedUrl: "   " }, error: null });
    await expect(createOrderStationAttachmentOriginalUrl(OBJECT_PATH, "png")).rejects.toMatchObject({ kind: "UNAVAILABLE" });
  });
});

describe("W4 order-station attachment domain", () => {
  it("rejects padded IDs, extra authority fields, and missing capabilities before DB or Storage", async () => {
    await expect(readOrderStationAttachments(authorization, {
      orderId: " order-a",
      itemId: "item-a",
    })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(reserveOrderStationAttachment(authorization, {
      orderId: reservation.order_id,
      itemId: reservation.item_id,
      expectedVersion: 2,
      clientRequestId: CLIENT_REQUEST_ID,
      mimeType: "image/png",
      fileBytes: PNG_BYTES.byteLength,
      contentSha256: PNG_SHA,
      tenantId: TENANT,
    } as never)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(finalizeOrderStationAttachment({
      ...authorization,
      permissions: ["perm_view_leitstand"],
    }, { reservationId: RESERVATION_ID })).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(ports.withTransaction).not.toHaveBeenCalled();
    expect(ports.createAdminClient).not.toHaveBeenCalled();
  });

  it("creates one exactly bound reservation and only then mints its canonical upload grant", async () => {
    let createdReservation = reservation;
    ports.execute.mockImplementation(async (query: FakeQuery) => {
      if (query.text.includes("pg_advisory_xact_lock")) return [];
      if (query.text.includes("statement_timestamp()")) return [];
      if (query.text.includes("FROM public.orders")) return [order];
      if (query.text.includes("FROM public.customers")) return [customer];
      if (query.text.includes("FROM public.items")) return [item];
      if (query.text.includes("FROM public.events")) return [event];
      if (query.text.includes("INSERT INTO private.order_station_evidence_reservations")) {
        const id = query.values[0] as string;
        createdReservation = {
          ...reservation,
          id,
          object_path: `order-station-evidence/v1/${id}.png`,
        };
        return [createdReservation];
      }
      if (query.text.includes("v_order_evidence_attachment_receipts_v1")) {
        return [{
          ...pendingReceipt,
          reservation_id: createdReservation.id,
        }];
      }
      throw new Error(`unexpected query: ${query.text}`);
    });
    ports.createSignedUploadUrl.mockImplementation(async (objectPath: string) => ({
      data: { path: objectPath, token: "signed-upload-token" },
      error: null,
    }));

    const result = await reserveOrderStationAttachment(authorization, {
      orderId: reservation.order_id,
      itemId: reservation.item_id,
      expectedVersion: 2,
      clientRequestId: CLIENT_REQUEST_ID,
      mimeType: "image/png",
      fileBytes: PNG_BYTES.byteLength,
      contentSha256: PNG_SHA,
    });
    expect(result).toMatchObject({
      code: "OK",
      data: {
        receipt: { state: "PENDING" },
        upload: { token: "signed-upload-token" },
        replayed: false,
      },
    });
    expect(result.code === "OK" && result.data.receipt.reservationId).toMatch(UUID_PATTERN_FOR_TEST);
    expect(result.code === "OK" && result.data.upload?.path).toBe(createdReservation.object_path);
    expect(ports.createSignedUploadUrl).toHaveBeenCalledWith(createdReservation.object_path, { upsert: false });
    const texts = ports.execute.mock.calls.map(([query]) => (query as FakeQuery).text);
    expect(texts.find((text) => text.includes("FROM public.orders"))).toContain("FOR UPDATE");
    expect(texts.find((text) => text.includes("FROM public.customers"))).toContain("FOR SHARE");
    expect(texts.find((text) => text.includes("FROM public.items"))).not.toContain("AND tenant_id");
  });

  it("fails closed on wrong RETURNING bindings and legacy event IDs without touching Storage", async () => {
    ports.execute.mockImplementation(async (query: FakeQuery) => {
      if (query.text.includes("pg_advisory_xact_lock")) return [];
      if (query.text.includes("statement_timestamp()")) return [];
      if (query.text.includes("FROM public.orders")) return [order];
      if (query.text.includes("FROM public.customers")) return [customer];
      if (query.text.includes("FROM public.items")) return [item];
      if (query.text.includes("FROM public.events")) return [{ ...event, id: "legacy-event" }];
      return [];
    });
    await expect(reserveOrderStationAttachment(authorization, {
      orderId: reservation.order_id,
      itemId: reservation.item_id,
      expectedVersion: 2,
      clientRequestId: CLIENT_REQUEST_ID,
      mimeType: "image/png",
      fileBytes: PNG_BYTES.byteLength,
      contentSha256: PNG_SHA,
    })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(ports.createAdminClient).not.toHaveBeenCalled();

    ports.execute.mockImplementation(async (query: FakeQuery) => {
      if (query.text.includes("pg_advisory_xact_lock")) return [];
      if (query.text.includes("statement_timestamp()")) return [];
      if (query.text.includes("FROM public.orders")) return [order];
      if (query.text.includes("FROM public.customers")) return [customer];
      if (query.text.includes("FROM public.items")) return [item];
      if (query.text.includes("FROM public.events")) return [event];
      if (query.text.includes("INSERT INTO private.order_station_evidence_reservations")) {
        return [{
          ...reservation,
          id: OTHER_RESERVATION_ID,
          object_path: `order-station-evidence/v1/${OTHER_RESERVATION_ID}.png`,
        }];
      }
      return [];
    });
    await expect(reserveOrderStationAttachment(authorization, {
      orderId: reservation.order_id,
      itemId: reservation.item_id,
      expectedVersion: 2,
      clientRequestId: CLIENT_REQUEST_ID,
      mimeType: "image/png",
      fileBytes: PNG_BYTES.byteLength,
      contentSha256: PNG_SHA,
    })).resolves.toMatchObject({ code: "UNAVAILABLE" });
    expect(ports.createAdminClient).not.toHaveBeenCalled();
  });

  it("replays the exact pending intent on one immutable path, rejects mismatch/expiry, and returns finalized without a grant", async () => {
    const input = {
      orderId: reservation.order_id,
      itemId: reservation.item_id,
      expectedVersion: 2,
      clientRequestId: CLIENT_REQUEST_ID,
      mimeType: "image/png" as const,
      fileBytes: PNG_BYTES.byteLength,
      contentSha256: PNG_SHA,
    };
    let uploadGrantable = true;
    let finalized = false;
    ports.execute.mockImplementation(async (query: FakeQuery) => {
      if (query.text.includes("pg_advisory_xact_lock")) return [];
      if (query.text.includes("statement_timestamp()")) {
        return [{ ...reservation, upload_grantable: uploadGrantable }];
      }
      if (query.text.includes("FROM private.order_station_evidence")) return finalized ? [evidence] : [];
      if (query.text.includes("SELECT (")) return [{ integrity_ok: true }];
      if (query.text.includes("v_order_evidence_attachment_receipts_v1")) {
        return [finalized ? finalizedReceipt : pendingReceipt];
      }
      throw new Error(`unexpected query: ${query.text}`);
    });
    ports.createSignedUploadUrl
      .mockResolvedValueOnce({ data: { path: OBJECT_PATH, token: "replay-token-1" }, error: null })
      .mockResolvedValueOnce({ data: { path: OBJECT_PATH, token: "replay-token-2" }, error: null });

    const firstReplay = await reserveOrderStationAttachment(authorization, input);
    const secondReplay = await reserveOrderStationAttachment(authorization, input);
    expect(firstReplay).toMatchObject({
      code: "OK",
      data: { receipt: { reservationId: RESERVATION_ID }, upload: { path: OBJECT_PATH, token: "replay-token-1" }, replayed: true },
    });
    expect(secondReplay).toMatchObject({
      code: "OK",
      data: { receipt: { reservationId: RESERVATION_ID }, upload: { path: OBJECT_PATH, token: "replay-token-2" }, replayed: true },
    });
    expect(ports.execute.mock.calls.map(([query]) => (query as FakeQuery).text).join("\n")).not.toContain(
      "INSERT INTO private.order_station_evidence_reservations",
    );

    const callsBeforeMismatch = ports.createSignedUploadUrl.mock.calls.length;
    await expect(reserveOrderStationAttachment(authorization, {
      ...input,
      contentSha256: "b".repeat(64),
    })).resolves.toMatchObject({ code: "CONFLICT", reason: "IDEMPOTENCY_MISMATCH" });
    expect(ports.createSignedUploadUrl).toHaveBeenCalledTimes(callsBeforeMismatch);

    uploadGrantable = false;
    await expect(reserveOrderStationAttachment(authorization, input)).resolves.toMatchObject({
      code: "CONFLICT",
      reason: "UPLOAD_GRANT_EXPIRED",
    });
    expect(ports.createSignedUploadUrl).toHaveBeenCalledTimes(callsBeforeMismatch);

    finalized = true;
    await expect(reserveOrderStationAttachment(authorization, input)).resolves.toMatchObject({
      code: "OK",
      data: {
        receipt: { reservationId: RESERVATION_ID, receiptId: EVIDENCE_ID, state: "FINALIZED" },
        upload: null,
        replayed: true,
      },
    });
    expect(ports.createSignedUploadUrl).toHaveBeenCalledTimes(callsBeforeMismatch);
  });

  it("replays a finalized receipt without graph or Storage even after later aggregate movement", async () => {
    ports.execute.mockImplementation(async (query: FakeQuery) => {
      if (query.text.includes("pg_advisory_xact_lock")) return [];
      if (query.text.includes("FROM private.order_station_evidence_reservations")) return [reservation];
      if (query.text.includes("FROM private.order_station_evidence")) return [evidence];
      if (query.text.includes("v_order_evidence_attachment_receipts_v1")) return [finalizedReceipt];
      throw new Error(`unexpected query: ${query.text}`);
    });
    await expect(finalizeOrderStationAttachment(authorization, {
      reservationId: RESERVATION_ID,
    })).resolves.toMatchObject({
      code: "OK",
      data: { receipt: { receiptId: EVIDENCE_ID }, replayed: true },
    });
    expect(ports.createAdminClient).not.toHaveBeenCalled();
    expect(ports.execute.mock.calls.map(([query]) => (query as FakeQuery).text).join("\n")).not.toContain("FROM public.orders");
  });

  it("rejects wrong-but-valid Evidence and view bindings in replay paths before Storage", async () => {
    ports.execute.mockImplementation(async (query: FakeQuery) => {
      if (query.text.includes("pg_advisory_xact_lock")) return [];
      if (query.text.includes("statement_timestamp()")) return [{ ...reservation, upload_grantable: true }];
      if (query.text.includes("FROM private.order_station_evidence")) return [evidence];
      if (query.text.includes("v_order_evidence_attachment_receipts_v1")) {
        return [{ ...finalizedReceipt, verified_at: "2026-08-11T01:01:01.000Z" }];
      }
      return [];
    });
    await expect(reserveOrderStationAttachment(authorization, {
      orderId: reservation.order_id,
      itemId: reservation.item_id,
      expectedVersion: 2,
      clientRequestId: CLIENT_REQUEST_ID,
      mimeType: "image/png",
      fileBytes: PNG_BYTES.byteLength,
      contentSha256: PNG_SHA,
    })).resolves.toMatchObject({ code: "UNAVAILABLE" });
    expect(ports.createAdminClient).not.toHaveBeenCalled();

    ports.execute.mockReset();
    ports.execute.mockImplementation(async (query: FakeQuery) => {
      if (query.text.includes("pg_advisory_xact_lock")) return [];
      if (query.text.includes("FROM private.order_station_evidence_reservations")) return [reservation];
      if (query.text.includes("FROM private.order_station_evidence")) {
        return [{ ...evidence, tenant_id: "foreign-tenant" }];
      }
      return [];
    });
    await expect(finalizeOrderStationAttachment(authorization, {
      reservationId: RESERVATION_ID,
    })).resolves.toMatchObject({ code: "UNAVAILABLE" });
    expect(ports.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a wrong verifiedAt in the reserve post-decision FINALIZED race before granting Storage", async () => {
    let evidenceReads = 0;
    ports.execute.mockImplementation(async (query: FakeQuery) => {
      if (query.text.includes("pg_advisory_xact_lock")) return [];
      if (query.text.includes("statement_timestamp()")) return [{ ...reservation, upload_grantable: true }];
      if (query.text.includes("FROM private.order_station_evidence")) {
        evidenceReads += 1;
        return evidenceReads === 1 ? [] : [evidence];
      }
      if (query.text.includes("SELECT (")) return [{ integrity_ok: true }];
      if (query.text.includes("v_order_evidence_attachment_receipts_v1")) {
        return [{ ...finalizedReceipt, verified_at: "2026-08-11T01:01:01.000Z" }];
      }
      throw new Error(`unexpected query: ${query.text}`);
    });
    await expect(reserveOrderStationAttachment(authorization, {
      orderId: reservation.order_id,
      itemId: reservation.item_id,
      expectedVersion: 2,
      clientRequestId: CLIENT_REQUEST_ID,
      mimeType: "image/png",
      fileBytes: PNG_BYTES.byteLength,
      contentSha256: PNG_SHA,
    })).resolves.toMatchObject({ code: "UNAVAILABLE" });
    expect(ports.createAdminClient).not.toHaveBeenCalled();
  });

  it("closes info-download-info, lock order, exact Evidence ID, and fresh receipt readback", async () => {
    let storedEvidence: typeof evidence | null = null;
    ports.execute.mockImplementation(async (query: FakeQuery) => {
      if (query.text.includes("pg_advisory_xact_lock")) return [];
      if (query.text.includes("FROM private.order_station_evidence_reservations")) return [reservation];
      if (query.text.includes("FROM private.order_station_evidence")) return storedEvidence ? [storedEvidence] : [];
      if (query.text.includes("SELECT (")) return [{ integrity_ok: true }];
      if (query.text.includes("FROM public.orders")) return [order];
      if (query.text.includes("FROM public.customers")) return [customer];
      if (query.text.includes("FROM public.items")) return [item];
      if (query.text.includes("INSERT INTO private.order_station_evidence")) {
        storedEvidence = {
          ...evidence,
          id: query.values[0] as string,
        };
        return [storedEvidence];
      }
      const contractRows = evidenceContractInsertRows(query);
      if (contractRows) return contractRows;
      if (query.text.includes("v_order_evidence_attachment_receipts_v1")) {
        return [{
          ...finalizedReceipt,
          receipt_id: storedEvidence?.id,
          verified_at: storedEvidence?.verified_at,
        }];
      }
      throw new Error(`unexpected query: ${query.text}`);
    });

    const result = await finalizeOrderStationAttachment(authorization, {
      reservationId: RESERVATION_ID,
    });
    expect(result).toMatchObject({
      code: "OK",
      data: { receipt: { state: "FINALIZED" }, replayed: false },
    });
    expect(ports.info).toHaveBeenCalledTimes(2);
    expect(ports.download).toHaveBeenCalledTimes(1);
    const texts = ports.execute.mock.calls.map(([query]) => (query as FakeQuery).text);
    const orderLock = texts.find((text) => text.includes("FROM public.orders") && text.includes("FOR UPDATE"));
    const itemLock = texts.find((text) => text.includes("FROM public.items") && text.includes("FOR SHARE"));
    expect(orderLock).toBeTruthy();
    expect(itemLock).not.toContain("AND tenant_id");
    expect(storedEvidence).not.toBeNull();
    expect((storedEvidence as unknown as typeof evidence).id)
      .toBe((result as { code: "OK"; data: { receipt: { receiptId: string } } }).data.receipt.receiptId);
  });

  it("never inserts Evidence for not-ready, mismatched, late, or phase-drifted objects", async () => {
    const run = async (kind: "not-ready" | "mismatch" | "late" | "phase-drift") => {
      ports.execute.mockReset();
      ports.info.mockReset();
      resetStorage();
      let reservationReads = 0;
      ports.execute.mockImplementation(async (query: FakeQuery) => {
        if (query.text.includes("pg_advisory_xact_lock")) return [];
        if (query.text.includes("FROM private.order_station_evidence_reservations")) {
          reservationReads += 1;
          return [kind === "phase-drift" && reservationReads > 1
            ? { ...reservation, content_sha256: "a".repeat(64) }
            : reservation];
        }
        if (query.text.includes("FROM private.order_station_evidence")) return [];
        if (query.text.includes("SELECT (")) return [{ integrity_ok: true }];
        if (query.text.includes("FROM public.orders")) return [order];
        if (query.text.includes("FROM public.customers")) return [customer];
        if (query.text.includes("FROM public.items")) return [item];
        if (query.text.includes("INSERT INTO private.order_station_evidence")) throw new Error("must not insert");
        return [];
      });
      if (kind === "not-ready") {
        ports.info.mockResolvedValueOnce({ data: null, error: { statusCode: "404" } });
      } else if (kind === "mismatch") {
        ports.info.mockResolvedValue({ data: adminInfo({ size: PNG_BYTES.byteLength + 1 }), error: null });
      } else if (kind === "late") {
        ports.info.mockResolvedValue({
          data: adminInfo({ createdAt: "2026-08-11T02:00:00.001Z" }),
          error: null,
        });
      }
      return finalizeOrderStationAttachment(authorization, { reservationId: RESERVATION_ID });
    };

    await expect(run("not-ready")).resolves.toMatchObject({ code: "CONFLICT", reason: "UPLOAD_NOT_READY" });
    await expect(run("mismatch")).resolves.toMatchObject({ code: "CONFLICT", reason: "UPLOAD_MISMATCH" });
    await expect(run("late")).resolves.toMatchObject({ code: "CONFLICT", reason: "UPLOAD_OUTSIDE_WINDOW" });
    await expect(run("phase-drift")).resolves.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("rejects a wrong-but-valid Evidence INSERT id and provider 429/5xx without returning success", async () => {
    const configureFinalize = (wrongEvidenceId: boolean) => {
      let storedEvidence: typeof evidence | null = null;
      ports.execute.mockReset();
      ports.execute.mockImplementation(async (query: FakeQuery) => {
        if (query.text.includes("pg_advisory_xact_lock")) return [];
        if (query.text.includes("FROM private.order_station_evidence_reservations")) return [reservation];
        if (query.text.includes("FROM private.order_station_evidence")) return storedEvidence ? [storedEvidence] : [];
        if (query.text.includes("SELECT (")) return [{ integrity_ok: true }];
        if (query.text.includes("FROM public.orders")) return [order];
        if (query.text.includes("FROM public.customers")) return [customer];
        if (query.text.includes("FROM public.items")) return [item];
        if (query.text.includes("INSERT INTO private.order_station_evidence")) {
          storedEvidence = {
            ...evidence,
            id: wrongEvidenceId ? OTHER_RESERVATION_ID : query.values[0] as string,
          };
          return [storedEvidence];
        }
        const contractRows = evidenceContractInsertRows(query);
        if (contractRows) return contractRows;
        if (query.text.includes("v_order_evidence_attachment_receipts_v1")) {
          return [{ ...finalizedReceipt, receipt_id: storedEvidence?.id }];
        }
        return [];
      });
    };

    configureFinalize(true);
    await expect(finalizeOrderStationAttachment(authorization, {
      reservationId: RESERVATION_ID,
    })).resolves.toMatchObject({ code: "UNAVAILABLE" });
    expect(ports.execute.mock.calls.map(([query]) => (query as FakeQuery).text).join("\n")).not.toContain(
      "v_order_evidence_attachment_receipts_v1",
    );

    for (const statusCode of ["429", "500"]) {
      configureFinalize(false);
      resetStorage();
      ports.info.mockResolvedValueOnce({ data: null, error: { statusCode } });
      await expect(finalizeOrderStationAttachment(authorization, {
        reservationId: RESERVATION_ID,
      })).resolves.toMatchObject({ code: "UNAVAILABLE" });
      expect(ports.execute.mock.calls.map(([query]) => (query as FakeQuery).text).join("\n")).not.toContain(
        "INSERT INTO private.order_station_evidence",
      );
    }
  });

  it("rejects collision-prone Original rows before any signed URL", async () => {
    const originalRow = {
      reservation_id_value: RESERVATION_ID,
      reservation_tenant_id: TENANT,
      reservation_customer_id: reservation.customer_id,
      reservation_order_id: reservation.order_id,
      reservation_item_id: reservation.item_id,
      reservation_transition_event_id: EVENT_ID,
      reservation_order_version: 2,
      reservation_actor_id: ACTOR,
      reservation_client_request_id: CLIENT_REQUEST_ID,
      reservation_purpose: reservation.purpose,
      reservation_station: reservation.station,
      reservation_bucket_id: reservation.bucket_id,
      reservation_object_path: OBJECT_PATH,
      reservation_mime_type: reservation.mime_type,
      reservation_file_bytes: reservation.file_bytes,
      reservation_content_sha256: reservation.content_sha256,
      reservation_upload_expires_at: reservation.upload_expires_at,
      reservation_created_at: reservation.created_at,
      evidence_id: EVIDENCE_ID,
      evidence_reservation_id: RESERVATION_ID,
      evidence_tenant_id: "foreign-tenant",
      evidence_actor_id: ACTOR,
      evidence_storage_object_id: STORAGE_ID,
      evidence_storage_object_version: evidence.storage_object_version,
      evidence_verified_mime_type: evidence.verified_mime_type,
      evidence_verified_file_bytes: evidence.verified_file_bytes,
      evidence_verified_content_sha256: evidence.verified_content_sha256,
      evidence_storage_created_at: evidence.storage_created_at,
      evidence_verified_at: evidence.verified_at,
    };
    ports.execute
      .mockResolvedValueOnce([finalizedReceipt])
      .mockResolvedValueOnce([originalRow]);
    await expect(getOrderStationAttachmentOriginal(authorization, {
      receiptId: EVIDENCE_ID,
    })).resolves.toMatchObject({ code: "UNAVAILABLE" });
    expect(ports.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects an otherwise-valid Original graph when the view receipt binds another order", async () => {
    const validOriginalRow = {
      reservation_id_value: RESERVATION_ID,
      reservation_tenant_id: TENANT,
      reservation_customer_id: reservation.customer_id,
      reservation_order_id: reservation.order_id,
      reservation_item_id: reservation.item_id,
      reservation_transition_event_id: EVENT_ID,
      reservation_order_version: 2,
      reservation_actor_id: ACTOR,
      reservation_client_request_id: CLIENT_REQUEST_ID,
      reservation_purpose: reservation.purpose,
      reservation_station: reservation.station,
      reservation_bucket_id: reservation.bucket_id,
      reservation_object_path: OBJECT_PATH,
      reservation_mime_type: reservation.mime_type,
      reservation_file_bytes: reservation.file_bytes,
      reservation_content_sha256: reservation.content_sha256,
      reservation_upload_expires_at: reservation.upload_expires_at,
      reservation_created_at: reservation.created_at,
      evidence_id: EVIDENCE_ID,
      evidence_reservation_id: RESERVATION_ID,
      evidence_tenant_id: TENANT,
      evidence_actor_id: ACTOR,
      evidence_storage_object_id: STORAGE_ID,
      evidence_storage_object_version: evidence.storage_object_version,
      evidence_verified_mime_type: evidence.verified_mime_type,
      evidence_verified_file_bytes: evidence.verified_file_bytes,
      evidence_verified_content_sha256: evidence.verified_content_sha256,
      evidence_storage_created_at: evidence.storage_created_at,
      evidence_verified_at: evidence.verified_at,
    };
    ports.execute
      .mockResolvedValueOnce([{ ...finalizedReceipt, order_id: "other-order" }])
      .mockResolvedValueOnce([validOriginalRow]);
    await expect(getOrderStationAttachmentOriginal(authorization, {
      receiptId: EVIDENCE_ID,
    })).resolves.toMatchObject({ code: "UNAVAILABLE" });
    expect(ports.createAdminClient).not.toHaveBeenCalled();
  });

  it("source-locks private-only schema, immutable tables, and guard ordering", async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
    const [domain, storage, actions, migration, evidenceMigration, f1Migration] = await Promise.all([
      readFile(path.join(root, "src/lib/server/orderStationAttachment.ts"), "utf8"),
      readFile(path.join(root, "src/lib/server/orderStationAttachmentStorage.ts"), "utf8"),
      readFile(path.join(root, "src/app/warendurchlauf/actions.ts"), "utf8"),
      readFile(path.join(root, "supabase/migrations/20260811184850_w4_order_station_attachment.sql"), "utf8"),
      readFile(path.join(root, "supabase/migrations/20260812103446_w4_evidence_read_contract.sql"), "utf8"),
      readFile(path.join(root, "supabase/migrations/20260812133649_f1_order_intake_contract.sql"), "utf8"),
    ]);
    expect(domain).toContain("statement_timestamp() < reservation.upload_expires_at");
    expect(domain).toContain("sameReservation(reservation, first.reservation)");
    expect(domain).toContain("readStableOrderStationAttachment");
    expect(storage.match(/createAdminClient/g)).toHaveLength(5);
    expect(storage).not.toMatch(/\.remove\(|\.upload\(|getPublicUrl/);
    for (const actionName of [
      "reserveGalvanikHandoffAttachmentAction",
      "finalizeGalvanikHandoffAttachmentAction",
      "getGalvanikHandoffAttachmentOriginalAction",
    ]) {
      const actionStart = actions.indexOf(`export async function ${actionName}`);
      const actionEnd = actions.indexOf("\n}\n", actionStart);
      const actionSource = actions.slice(actionStart, actionEnd);
      expect(actionStart).toBeGreaterThanOrEqual(0);
      expect(actionSource.indexOf('authorizeOrderStationAttachment("perm_op_photos")')).toBeLessThan(
        actionSource.indexOf('import("@/lib/server/orderStationAttachment")'),
      );
    }
    expect(migration).toContain("CREATE TABLE private.order_station_evidence_reservations");
    expect(migration).toContain("CREATE TABLE private.order_station_evidence");
    expect(migration).toContain("LEFT JOIN");
    expect(migration).toContain("'INVALID'");
    expect(migration).not.toMatch(/\b(?:GRANT|REVOKE|CREATE POLICY|ALTER POLICY|ENABLE ROW LEVEL SECURITY)\b/i);
    expect(evidenceMigration).toContain("CREATE TABLE private.evidence_extraction_metadata");
    expect(evidenceMigration).toContain("CREATE TABLE private.evidence_domain_links");
    expect(evidenceMigration).toContain("CREATE VIEW private.v_order_station_evidence_receipts_v2");
    expect(evidenceMigration).toContain("CREATE VIEW private.v_evidence_records_v1");
    expect(evidenceMigration).toContain("FROM public.scan_uploads scan");
    expect(evidenceMigration).not.toMatch(/\b(?:GRANT|CREATE POLICY|ALTER POLICY|ENABLE ROW LEVEL SECURITY)\b/i);

    // F1.1 anti-duplicate guards: receipt cardinality repair
    expect(f1Migration).toContain("CREATE VIEW private.v_order_evidence_attachment_receipts_v1");
    expect(f1Migration).toContain("SELECT * FROM private.v_order_station_evidence_receipts_v2");
    expect(f1Migration).toContain("WHERE purpose = 'GALVANIK_HANDOFF_ORIGINAL_V1'");
    expect(f1Migration).toContain("UNION ALL");
    expect(f1Migration).toContain("SELECT * FROM private.v_order_intake_evidence_receipts_v1");
    expect(f1Migration).toContain("CREATE VIEW private.v_evidence_records_v2");
    expect(f1Migration).toContain("source_kind = 'ORDER_STATION_ATTACHMENT'");
    expect(f1Migration).toContain("EXISTS (");
    expect(f1Migration).toContain("FROM private.v_order_intake_evidence_receipts_v1 intake");
    expect(f1Migration).toContain("WHERE intake.receipt_id::text = source_id");
  });
});
