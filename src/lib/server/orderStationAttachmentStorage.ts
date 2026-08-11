import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET_ID = "item-photos";
const ORIGINAL_DOWNLOAD_SECONDS = 60;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const OBJECT_PATH_PATTERN = /^order-station-evidence\/v1\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

export type StoredObjectInfo = {
  id: string;
  version: string;
  bucketId: typeof BUCKET_ID;
  path: string;
  createdAt: string;
  size: number;
  contentType: string;
};

export type StableStoredObject = {
  before: StoredObjectInfo;
  after: StoredObjectInfo;
  bytes: Uint8Array;
};

export class OrderStationAttachmentStorageError extends Error {
  constructor(readonly kind: "NOT_READY" | "UNAVAILABLE" | "INVALID" | "MISMATCH") {
    super(`ORDER_STATION_ATTACHMENT_STORAGE_${kind}`);
    this.name = "OrderStationAttachmentStorageError";
  }
}

function assertObjectPath(path: string): void {
  if (!OBJECT_PATH_PATTERN.test(path)) {
    throw new OrderStationAttachmentStorageError("INVALID");
  }
}

function logStorageFailure(operation: string, error: unknown): void {
  const candidate = error && typeof error === "object" ? error as Record<string, unknown> : {};
  console.error("order station attachment storage failure", {
    operation,
    statusCode: typeof candidate.statusCode === "string" && /^\d{3}$/.test(candidate.statusCode)
      ? candidate.statusCode
      : undefined,
  });
}

function storageStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as Record<string, unknown>;
  const raw = candidate.status ?? candidate.statusCode;
  const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isInteger(parsed) && parsed >= 100 && parsed <= 599 ? parsed : null;
}

function throwStorageFailure(operation: string, error: unknown, missingIsNotReady: boolean): never {
  logStorageFailure(operation, error);
  if (missingIsNotReady && storageStatus(error) === 404) {
    throw new OrderStationAttachmentStorageError("NOT_READY");
  }
  throw new OrderStationAttachmentStorageError("UNAVAILABLE");
}

function mapInfo(path: string, value: Record<string, unknown>): StoredObjectInfo {
  const size = value.size;
  const createdAt = value.createdAt;
  if (
    typeof value.id !== "string" ||
    !UUID_PATTERN.test(value.id) ||
    typeof value.version !== "string" ||
    value.version !== value.version.trim() ||
    value.version.trim().length === 0 ||
    value.bucketId !== BUCKET_ID ||
    value.name !== path ||
    typeof createdAt !== "string" ||
    createdAt !== createdAt.trim() ||
    createdAt.length === 0 ||
    Number.isNaN(new Date(createdAt).getTime()) ||
    typeof size !== "number" ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > MAX_FILE_BYTES ||
    typeof value.contentType !== "string"
  ) {
    throw new OrderStationAttachmentStorageError("INVALID");
  }

  return {
    id: value.id,
    version: value.version,
    bucketId: BUCKET_ID,
    path,
    createdAt: new Date(createdAt).toISOString(),
    size,
    contentType: value.contentType,
  };
}

export async function readOrderStationAttachmentInfo(path: string): Promise<StoredObjectInfo> {
  assertObjectPath(path);
  const result = await createAdminClient().storage.from(BUCKET_ID).info(path);
  if (result.error || !result.data) {
    throwStorageFailure("info", result.error, true);
  }
  return mapInfo(path, result.data as unknown as Record<string, unknown>);
}

export async function createOrderStationAttachmentUploadGrant(
  path: string,
): Promise<{ path: string; token: string }> {
  assertObjectPath(path);
  const result = await createAdminClient()
    .storage
    .from(BUCKET_ID)
    .createSignedUploadUrl(path, { upsert: false });
  if (
    result.error ||
    !result.data ||
    result.data.path !== path ||
    typeof result.data.token !== "string" ||
    result.data.token !== result.data.token.trim() ||
    result.data.token.length === 0
  ) {
    throwStorageFailure("create-signed-upload", result.error, false);
  }
  return { path, token: result.data.token };
}

export async function readStableOrderStationAttachment(
  path: string,
  expected: { fileBytes: number; mimeType: "image/jpeg" | "image/png" | "image/webp" },
): Promise<StableStoredObject> {
  assertObjectPath(path);
  const before = await readOrderStationAttachmentInfo(path);
  if (before.size !== expected.fileBytes || before.contentType !== expected.mimeType) {
    throw new OrderStationAttachmentStorageError("MISMATCH");
  }
  const download = await createAdminClient().storage.from(BUCKET_ID).download(path);
  if (download.error || !download.data) {
    throwStorageFailure("download", download.error, true);
  }
  if (!Number.isSafeInteger(download.data.size) || download.data.size < 1 || download.data.size > MAX_FILE_BYTES) {
    throw new OrderStationAttachmentStorageError("INVALID");
  }
  if (download.data.size !== expected.fileBytes) {
    throw new OrderStationAttachmentStorageError("MISMATCH");
  }
  const bytes = new Uint8Array(await download.data.arrayBuffer());
  if (bytes.byteLength > MAX_FILE_BYTES) {
    throw new OrderStationAttachmentStorageError("INVALID");
  }
  if (bytes.byteLength !== expected.fileBytes) {
    throw new OrderStationAttachmentStorageError("MISMATCH");
  }
  const after = await readOrderStationAttachmentInfo(path);
  return { before, bytes, after };
}

export async function createOrderStationAttachmentOriginalUrl(
  path: string,
  extension: "jpg" | "png" | "webp",
): Promise<{ downloadUrl: string; expiresInSeconds: typeof ORIGINAL_DOWNLOAD_SECONDS }> {
  assertObjectPath(path);
  const result = await createAdminClient()
    .storage
    .from(BUCKET_ID)
    .createSignedUrl(path, ORIGINAL_DOWNLOAD_SECONDS, {
      download: `galvanik-uebergabe-original.${extension}`,
    });
  if (
    result.error
    || typeof result.data?.signedUrl !== "string"
    || result.data.signedUrl !== result.data.signedUrl.trim()
    || result.data.signedUrl.length === 0
  ) {
    throwStorageFailure("create-signed-download", result.error, false);
  }
  return { downloadUrl: result.data.signedUrl, expiresInSeconds: ORIGINAL_DOWNLOAD_SECONDS };
}
