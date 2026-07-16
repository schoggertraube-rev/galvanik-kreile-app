import { createHash, createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type ItemPhotoSupabaseClient = SupabaseClient;

export type ValidatedItemPhoto = {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
  contentSha256: string;
};

export type ItemPhotoAdmission =
  | {
      kind: "accepted";
      jobId: string;
      storagePath: string;
      uploadRequired: boolean;
    }
  | {
      kind: "replay";
      jobId: string;
      storagePath: string;
      result: Record<string, unknown>;
    }
  | { kind: "rejected"; retryAfterSeconds: number; terminal: boolean };

type ReservationRow = {
  allowed: boolean;
  job_id: string | null;
  replay: boolean;
  upload_required: boolean;
  job_status: string;
  reserved_storage_path: string | null;
  replay_result: unknown;
  retry_after_seconds: number | string | null;
  decision_reason: string;
};

const MAX_BYTES = 12 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function setting(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function bytesStartWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}

export async function validateItemPhoto(file: File): Promise<ValidatedItemPhoto> {
  if (file.size < 12 || file.size > MAX_BYTES) throw new Error("INVALID_ITEM_PHOTO");
  const mimeType = file.type.toLowerCase();
  if (mimeType !== "image/jpeg" && mimeType !== "image/png" && mimeType !== "image/webp") {
    throw new Error("INVALID_ITEM_PHOTO");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length !== file.size || bytes.length > MAX_BYTES) throw new Error("INVALID_ITEM_PHOTO");

  let extension: ValidatedItemPhoto["extension"];
  if (mimeType === "image/jpeg" && bytesStartWith(bytes, [0xff, 0xd8, 0xff])) {
    extension = "jpg";
  } else if (mimeType === "image/png" && bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    extension = "png";
  } else if (
    mimeType === "image/webp" &&
    bytesStartWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytesStartWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
  ) {
    extension = "webp";
  } else {
    throw new Error("INVALID_ITEM_PHOTO");
  }
  return {
    bytes,
    mimeType: mimeType as ValidatedItemPhoto["mimeType"],
    extension,
    contentSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function requestHash(input: {
  request: Request;
  tenantId: string;
  userId: string;
  itemId: string;
  contentSha256: string;
}): string {
  const secret = process.env.CAPTURE_USAGE_HMAC_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("CAPTURE_USAGE_MISCONFIGURED");
  }
  const supplied = input.request.headers.get("x-idempotency-key");
  if (supplied !== null && !IDEMPOTENCY_PATTERN.test(supplied)) {
    throw new Error("INVALID_IDEMPOTENCY_KEY");
  }
  const bucketSeconds = setting("CAPTURE_IDEMPOTENCY_BUCKET_SECONDS", 600, 60, 3_600);
  const idempotencyPart = supplied ?? `bucket:${Math.floor(Date.now() / (bucketSeconds * 1_000))}`;
  return createHmac("sha256", secret)
    .update(`${input.tenantId}\u0000${input.userId}\u0000${input.itemId}\u0000${input.contentSha256}\u0000${idempotencyPart}`, "utf8")
    .digest("hex");
}

export async function reserveItemPhotoJob(input: {
  client: ItemPhotoSupabaseClient;
  request: Request;
  proposedJobId: string;
  tenantId: string;
  userId: string;
  orderId: string;
  itemId: string;
  photo: ValidatedItemPhoto;
  proposedStoragePath: string;
}): Promise<ItemPhotoAdmission> {
  const { data, error } = await input.client.rpc("reserve_item_photo_job", {
    p_job_id: input.proposedJobId,
    p_tenant_id: input.tenantId,
    p_user_id: input.userId,
    p_order_id: input.orderId,
    p_item_id: input.itemId,
    p_request_key_hash: requestHash({
      request: input.request,
      tenantId: input.tenantId,
      userId: input.userId,
      itemId: input.itemId,
      contentSha256: input.photo.contentSha256,
    }),
    p_content_sha256: input.photo.contentSha256,
    p_storage_path: input.proposedStoragePath,
    p_mime_type: input.photo.mimeType,
    p_file_bytes: input.photo.bytes.byteLength,
    p_window_seconds: setting("ITEM_PHOTO_WINDOW_SECONDS", 60, 10, 3_600),
    p_user_window_limit: setting("ITEM_PHOTO_USER_REQUESTS_PER_WINDOW", 10, 1, 1_000),
    p_item_limit: setting("ITEM_PHOTO_ITEM_LIMIT", 6, 1, 100),
    p_tenant_daily_bytes_limit: setting("ITEM_PHOTO_TENANT_DAILY_BYTES", 512 * 1024 * 1024, 1_048_576, 1_099_511_627_776),
    p_user_daily_analysis_limit: setting("ITEM_PHOTO_USER_DAILY_ANALYSES", 100, 1, 100_000),
    p_tenant_daily_analysis_limit: setting("ITEM_PHOTO_TENANT_DAILY_ANALYSES", 500, 1, 1_000_000),
    p_user_concurrent_limit: setting("ITEM_PHOTO_USER_CONCURRENT", 3, 1, 100),
    p_tenant_concurrent_limit: setting("ITEM_PHOTO_TENANT_CONCURRENT", 10, 1, 1_000),
  });
  if (error || !Array.isArray(data) || data.length !== 1 || !isObject(data[0])) {
    throw new Error("ITEM_PHOTO_RESERVATION_UNAVAILABLE");
  }
  const row = data[0] as ReservationRow;
  if (
    row.allowed === true && row.replay === true &&
    typeof row.job_id === "string" && UUID_PATTERN.test(row.job_id) &&
    typeof row.reserved_storage_path === "string" && isObject(row.replay_result)
  ) {
    return {
      kind: "replay",
      jobId: row.job_id,
      storagePath: row.reserved_storage_path,
      result: row.replay_result,
    };
  }
  if (
    row.allowed === true && typeof row.job_id === "string" && UUID_PATTERN.test(row.job_id) &&
    typeof row.reserved_storage_path === "string" && typeof row.upload_required === "boolean"
  ) {
    return {
      kind: "accepted",
      jobId: row.job_id,
      storagePath: row.reserved_storage_path,
      uploadRequired: row.upload_required,
    };
  }
  if (row.allowed === false) {
    const retry = Number(row.retry_after_seconds);
    return {
      kind: "rejected",
      retryAfterSeconds: Number.isSafeInteger(retry) && retry > 0 ? Math.min(retry, 86_400) : 0,
      terminal: row.decision_reason === "prior_attempt_terminal" || row.decision_reason === "duplicate_content" || row.decision_reason === "item_limit",
    };
  }
  throw new Error("ITEM_PHOTO_RESERVATION_INVALID");
}

export async function bindItemPhotoUpload(
  client: ItemPhotoSupabaseClient,
  jobId: string,
  tenantId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await client.rpc("bind_item_photo_upload", {
    p_job_id: jobId,
    p_tenant_id: tenantId,
    p_user_id: userId,
  });
  if (error || data !== true) throw new Error("ITEM_PHOTO_BIND_FAILED");
}

export async function markItemPhotoUncertain(
  client: ItemPhotoSupabaseClient,
  jobId: string,
  tenantId: string,
  userId: string,
  reason: string,
): Promise<void> {
  await client.rpc("mark_item_photo_uncertain", {
    p_job_id: jobId,
    p_tenant_id: tenantId,
    p_user_id: userId,
    p_reason: reason.slice(0, 80),
  });
}
