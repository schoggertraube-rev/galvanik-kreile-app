import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { scanUploads } from "@/db/schema";
import { resolveAuthorization } from "@/lib/server/authorization";
import { readScanCaptureCapability } from "@/lib/server/scanCaptureCapability";
import {
  hasDeclaredScanSignature,
  isSupportedScanMimeType,
  MAX_SCAN_FILE_BYTES,
  SCAN_SHA256,
  SCAN_UUID,
  scanStoragePath,
} from "@/lib/server/scanOriginalContract";

export const runtime = "nodejs";

const MAX_METADATA_BYTES = 4_096;
const USER_UPLOADS_PER_HOUR = 12;
const TENANT_UPLOADS_PER_HOUR = 60;
const USER_UPLOAD_BYTES_PER_DAY = 256 * 1024 * 1024;
const TENANT_UPLOAD_BYTES_PER_DAY = 2 * 1024 * 1024 * 1024;
const CONFIRMED_STATUSES = new Set(["secured", "processing", "processed", "review_required"]);
const UPLOADABLE_STATUSES = new Set(["uploading", "storage_unconfirmed", "storage_error"]);

type PrepareRequest = {
  action: "prepare";
  clientRequestId: string;
  contentSha256: string;
  fileSizeBytes: number;
  fileType: string;
};

type ConfirmRequest = { action: "confirm"; clientRequestId: string };
type ScanUploadRequest = PrepareRequest | ConfirmRequest;
type ScanRow = typeof scanUploads.$inferSelect;
type OriginalConfirmation = "confirmed" | "unconfirmed" | "integrity_mismatch";

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function authorizationFailure(reason: string) {
  if (reason === "AUTHORIZATION_UNAVAILABLE" || reason === "TENANT_MAINTENANCE") {
    return response({ ok: false, code: reason }, 503);
  }
  if (reason === "TENANT_SUSPENDED") return response({ ok: false, code: reason }, 423);
  return response({ ok: false, code: "UNAUTHORIZED" }, 401);
}

function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("SCAN_STORAGE_MISCONFIGURED");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function digest(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function parseRequest(request: Request): Promise<ScanUploadRequest | null> {
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    return null;
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && (declaredLength < 1 || declaredLength > MAX_METADATA_BYTES)) return null;
  const raw = await request.text();
  if (!raw || Buffer.byteLength(raw, "utf8") > MAX_METADATA_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (body.action === "confirm") {
    if (
      Object.keys(body).length !== 2
      || typeof body.clientRequestId !== "string"
      || !SCAN_UUID.test(body.clientRequestId)
    ) return null;
    return { action: "confirm", clientRequestId: body.clientRequestId };
  }
  if (body.action !== "prepare" || Object.keys(body).length !== 5) return null;
  if (
    typeof body.clientRequestId !== "string"
    || !SCAN_UUID.test(body.clientRequestId)
    || typeof body.contentSha256 !== "string"
    || !SCAN_SHA256.test(body.contentSha256)
    || typeof body.fileType !== "string"
    || !isSupportedScanMimeType(body.fileType)
    || typeof body.fileSizeBytes !== "number"
    || !Number.isSafeInteger(body.fileSizeBytes)
    || body.fileSizeBytes < 1
    || body.fileSizeBytes > MAX_SCAN_FILE_BYTES
  ) return null;
  return {
    action: "prepare",
    clientRequestId: body.clientRequestId,
    contentSha256: body.contentSha256,
    fileSizeBytes: body.fileSizeBytes,
    fileType: body.fileType,
  };
}

async function confirmStoredOriginal(scan: ScanRow): Promise<OriginalConfirmation> {
  try {
    const { data, error } = await storageClient().storage.from("scans").download(scan.fileUrl);
    if (error || !data) return "unconfirmed";
    const stored = Buffer.from(await data.arrayBuffer());
    if (
      stored.length !== scan.fileSizeBytes
      || digest(stored) !== scan.contentSha256
      || !scan.fileType
      || !hasDeclaredScanSignature(stored, scan.fileType)
    ) return "integrity_mismatch";
    return "confirmed";
  } catch {
    return "unconfirmed";
  }
}

function receiptResponse(scan: ScanRow, replayed: boolean, status = 200) {
  return response({
    ok: true,
    id: scan.id,
    status: scan.status,
    contentSha256: scan.contentSha256,
    fileSizeBytes: scan.fileSizeBytes,
    replayed,
  }, status);
}

async function currentReceipt(id: string, tenantId: string, userId: string): Promise<ScanRow | null> {
  const [scan] = await db.select().from(scanUploads).where(and(
    eq(scanUploads.id, id),
    eq(scanUploads.tenantId, tenantId),
    eq(scanUploads.uploadedBy, userId),
    eq(scanUploads.recordKind, "capture_scan"),
  )).limit(1);
  return scan || null;
}

async function confirmReceipt(scan: ScanRow, tenantId: string, userId: string) {
  // Confirmation is a durable receipt. Re-confirming it must not trigger an
  // unbounded service-role download; OCR performs the integrity check again
  // immediately before the provider call.
  if (CONFIRMED_STATUSES.has(scan.status)) return receiptResponse(scan, true);
  const confirmation = await confirmStoredOriginal(scan);
  if (confirmation === "integrity_mismatch") {
    const [persisted] = await db.update(scanUploads).set({
      status: "integrity_error",
      processingClaimedAt: null,
      lastProcessingError: "ORIGINAL_DIGEST_OR_SIGNATURE_MISMATCH",
    }).where(and(
      eq(scanUploads.id, scan.id),
      eq(scanUploads.tenantId, tenantId),
      eq(scanUploads.uploadedBy, userId),
      eq(scanUploads.recordKind, "capture_scan"),
      inArray(scanUploads.status, [
        "uploading", "storage_unconfirmed", "storage_error", "secured", "processing", "processed",
      ]),
    )).returning();
    const actual = persisted || await currentReceipt(scan.id, tenantId, userId);
    return response({
      ok: false,
      code: "ORIGINAL_DIGEST_OR_SIGNATURE_MISMATCH",
      id: scan.id,
      status: actual?.status || "status_unknown",
    }, 409);
  }

  if (confirmation === "unconfirmed") {
    const [persisted] = await db.update(scanUploads).set({
      status: "storage_unconfirmed",
      lastProcessingError: "STORAGE_RECEIPT_UNCONFIRMED",
    }).where(and(
      eq(scanUploads.id, scan.id),
      eq(scanUploads.tenantId, tenantId),
      eq(scanUploads.uploadedBy, userId),
      eq(scanUploads.recordKind, "capture_scan"),
      inArray(scanUploads.status, ["uploading", "storage_unconfirmed", "storage_error"]),
    )).returning();
    const actual = persisted || await currentReceipt(scan.id, tenantId, userId);
    return response({
      ok: false,
      code: "STORAGE_RECEIPT_UNCONFIRMED",
      id: scan.id,
      status: actual?.status || "status_unknown",
    }, 503);
  }

  const [secured] = await db.update(scanUploads).set({
    status: "secured",
    lastProcessingError: null,
  }).where(and(
    eq(scanUploads.id, scan.id),
    eq(scanUploads.tenantId, tenantId),
    eq(scanUploads.uploadedBy, userId),
    eq(scanUploads.recordKind, "capture_scan"),
    inArray(scanUploads.status, ["uploading", "storage_unconfirmed", "storage_error"]),
  )).returning();
  if (secured) return receiptResponse(secured, false, 201);
  const actual = await currentReceipt(scan.id, tenantId, userId);
  if (actual && CONFIRMED_STATUSES.has(actual.status)) return receiptResponse(actual, true);
  return response({
    ok: false,
    code: "SECURED_RECEIPT_MISSING",
    id: scan.id,
    status: actual?.status || "status_unknown",
  }, 409);
}

async function prepareReceipt(input: PrepareRequest, tenantId: string, userId: string) {
  const storagePath = scanStoragePath(tenantId, input.clientRequestId, input.fileType);
  if (!storagePath) return response({ ok: false, code: "UNSUPPORTED_OR_INVALID_FILE" }, 415);

  let admission: { scan: ScanRow; replayed: boolean };
  try {
    admission = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${tenantId}:scan-upload-admission`}, 0))`);
      const [existing] = await tx.select().from(scanUploads).where(and(
        eq(scanUploads.id, input.clientRequestId),
        eq(scanUploads.tenantId, tenantId),
      )).limit(1).for("update");
      if (existing) {
        if (
          existing.uploadedBy !== userId
          || existing.recordKind !== "capture_scan"
          || existing.fileUrl !== storagePath
          || existing.fileType !== input.fileType
          || existing.contentSha256 !== input.contentSha256
          || existing.fileSizeBytes !== input.fileSizeBytes
        ) throw new Error("REQUEST_CONFLICT");
        return { scan: existing, replayed: true };
      }

      const quotaRows = await tx.execute(sql<{
        tenant_day_bytes: number | string;
        tenant_hour_count: number | string;
        user_day_bytes: number | string;
        user_hour_count: number | string;
      }>`
        select
          count(*) filter (where uploaded_by = ${userId} and uploaded_at >= now() - interval '1 hour')::int as user_hour_count,
          count(*) filter (where uploaded_at >= now() - interval '1 hour')::int as tenant_hour_count,
          coalesce(sum(file_size_bytes) filter (where uploaded_by = ${userId} and uploaded_at >= now() - interval '1 day'), 0)::bigint as user_day_bytes,
          coalesce(sum(file_size_bytes) filter (where uploaded_at >= now() - interval '1 day'), 0)::bigint as tenant_day_bytes
        from public.scan_uploads
        where tenant_id = ${tenantId} and record_kind = 'capture_scan'
      `);
      const quota = quotaRows[0];
      const userHourCount = Number(quota?.user_hour_count);
      const tenantHourCount = Number(quota?.tenant_hour_count);
      const userDayBytes = Number(quota?.user_day_bytes);
      const tenantDayBytes = Number(quota?.tenant_day_bytes);
      if (![userHourCount, tenantHourCount, userDayBytes, tenantDayBytes].every(Number.isSafeInteger)) {
        throw new Error("UPLOAD_QUOTA_UNAVAILABLE");
      }
      if (
        userHourCount >= USER_UPLOADS_PER_HOUR
        || tenantHourCount >= TENANT_UPLOADS_PER_HOUR
        || userDayBytes + input.fileSizeBytes > USER_UPLOAD_BYTES_PER_DAY
        || tenantDayBytes + input.fileSizeBytes > TENANT_UPLOAD_BYTES_PER_DAY
      ) throw new Error("UPLOAD_QUOTA_EXCEEDED");

      const [created] = await tx.insert(scanUploads).values({
        id: input.clientRequestId,
        tenantId,
        uploadedBy: userId,
        fileUrl: storagePath,
        recordKind: "capture_scan",
        fileType: input.fileType,
        contentSha256: input.contentSha256,
        fileSizeBytes: input.fileSizeBytes,
        status: "uploading",
        uploadedAt: new Date(),
      }).returning();
      if (!created) throw new Error("SCAN_RECEIPT_UNAVAILABLE");
      return { scan: created, replayed: false };
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "SCAN_RECEIPT_UNAVAILABLE";
    if (code === "REQUEST_CONFLICT") return response({ ok: false, code }, 409);
    if (code === "UPLOAD_QUOTA_EXCEEDED") {
      return response({ ok: false, code, retryAfterSeconds: 3_600 }, 429);
    }
    console.error("Scan upload admission failed", error);
    return response({ ok: false, code: "SCAN_RECEIPT_UNAVAILABLE" }, 503);
  }

  if (admission.scan.status === "integrity_error") {
    return response({ ok: false, code: "ORIGINAL_INTEGRITY_ERROR", id: admission.scan.id, status: admission.scan.status }, 409);
  }
  if (CONFIRMED_STATUSES.has(admission.scan.status)) {
    return response({
      ok: true,
      id: admission.scan.id,
      status: admission.scan.status,
      contentSha256: admission.scan.contentSha256,
      fileSizeBytes: admission.scan.fileSizeBytes,
      needsUpload: false,
      replayed: true,
    });
  }
  if (!UPLOADABLE_STATUSES.has(admission.scan.status)) {
    return response({ ok: false, code: "SCAN_STATE_CONFLICT", id: admission.scan.id, status: admission.scan.status }, 409);
  }

  const signed = await storageClient().storage.from("scans").createSignedUploadUrl(storagePath, { upsert: false });
  if (signed.error || !signed.data?.token) {
    console.error("Scan signed upload preparation failed", signed.error);
    const [persisted] = await db.update(scanUploads).set({
      status: "storage_error",
      lastProcessingError: "SIGNED_UPLOAD_UNAVAILABLE",
    }).where(and(
      eq(scanUploads.id, admission.scan.id),
      eq(scanUploads.tenantId, tenantId),
      eq(scanUploads.uploadedBy, userId),
      eq(scanUploads.recordKind, "capture_scan"),
      inArray(scanUploads.status, ["uploading", "storage_unconfirmed", "storage_error"]),
    )).returning({ status: scanUploads.status });
    return response({
      ok: false,
      code: "SIGNED_UPLOAD_UNAVAILABLE",
      id: admission.scan.id,
      status: persisted?.status || admission.scan.status,
    }, 503);
  }
  return response({
    ok: true,
    id: admission.scan.id,
    status: admission.scan.status,
    contentSha256: admission.scan.contentSha256,
    fileSizeBytes: admission.scan.fileSizeBytes,
    needsUpload: true,
    signedUploadUrl: signed.data.signedUrl,
    replayed: admission.replayed,
  }, admission.replayed ? 200 : 201);
}

export async function POST(request: Request) {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return authorizationFailure(authorization.reason);
  if (
    authorization.data.tenantId !== "galvanik-kreile"
    || !authorization.data.permissions.includes("perm_data_orders")
  ) return response({ ok: false, code: "FORBIDDEN" }, 403);

  const capability = await readScanCaptureCapability();
  if (!capability.available) {
    return response({ ok: false, code: "CONFIGURATION_MISSING", reason: capability.reason }, 503);
  }

  try {
    const body = await parseRequest(request);
    if (!body) return response({ ok: false, code: "INVALID_REQUEST" }, 400);
    if (body.action === "prepare") {
      return await prepareReceipt(body, authorization.data.tenantId, authorization.data.userId);
    }
    const scan = await currentReceipt(
      body.clientRequestId,
      authorization.data.tenantId,
      authorization.data.userId,
    );
    if (!scan) return response({ ok: false, code: "NOT_FOUND" }, 404);
    return await confirmReceipt(scan, authorization.data.tenantId, authorization.data.userId);
  } catch (error) {
    console.error("Scan original upload coordination failed", error);
    return response({ ok: false, code: "SCAN_UPLOAD_UNAVAILABLE" }, 503);
  }
}
