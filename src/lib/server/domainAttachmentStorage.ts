import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET_ID = "scans";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const PATH = /^domain-attachments\/v1\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp|pdf)$/;

type ObjectInfo = { id: string; version: string; path: string; createdAt: string; size: number; contentType: string };

export class DomainAttachmentStorageError extends Error {
  constructor(readonly kind: "NOT_READY" | "UNAVAILABLE" | "INVALID" | "MISMATCH") {
    super(`DOMAIN_ATTACHMENT_STORAGE_${kind}`);
  }
}

function assertPath(path: string) {
  if (!PATH.test(path)) throw new DomainAttachmentStorageError("INVALID");
}

function status(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const value = (error as Record<string, unknown>).status ?? (error as Record<string, unknown>).statusCode;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function fail(error: unknown, missingIsNotReady: boolean): never {
  if (missingIsNotReady && status(error) === 404) throw new DomainAttachmentStorageError("NOT_READY");
  throw new DomainAttachmentStorageError("UNAVAILABLE");
}

async function info(path: string): Promise<ObjectInfo> {
  assertPath(path);
  const result = await createAdminClient().storage.from(BUCKET_ID).info(path);
  if (result.error || !result.data) fail(result.error, true);
  const value = result.data as unknown as Record<string, unknown>;
  if (typeof value.id !== "string" || typeof value.version !== "string" || typeof value.createdAt !== "string"
    || value.bucketId !== BUCKET_ID || value.name !== path || typeof value.size !== "number"
    || !Number.isSafeInteger(value.size) || value.size < 1 || value.size > MAX_FILE_BYTES || typeof value.contentType !== "string") {
    throw new DomainAttachmentStorageError("INVALID");
  }
  return { id: value.id, version: value.version, path, createdAt: new Date(value.createdAt).toISOString(), size: value.size, contentType: value.contentType };
}

export async function createDomainAttachmentUploadGrant(path: string) {
  assertPath(path);
  const result = await createAdminClient().storage.from(BUCKET_ID).createSignedUploadUrl(path, { upsert: false });
  if (result.error || result.data?.path !== path || typeof result.data.token !== "string" || !result.data.token.trim()) fail(result.error, false);
  return { path, token: result.data.token };
}

export async function readStableDomainAttachment(path: string, expected: { fileBytes: number; mimeType: string }) {
  const before = await info(path);
  if (before.size !== expected.fileBytes || before.contentType !== expected.mimeType) throw new DomainAttachmentStorageError("MISMATCH");
  const download = await createAdminClient().storage.from(BUCKET_ID).download(path);
  if (download.error || !download.data) fail(download.error, true);
  const bytes = new Uint8Array(await download.data.arrayBuffer());
  if (bytes.byteLength !== expected.fileBytes || bytes.byteLength > MAX_FILE_BYTES) throw new DomainAttachmentStorageError("MISMATCH");
  const after = await info(path);
  if (before.id !== after.id || before.version !== after.version || before.createdAt !== after.createdAt
    || before.size !== after.size || before.contentType !== after.contentType) throw new DomainAttachmentStorageError("MISMATCH");
  return { info: before, bytes };
}

export async function createDomainAttachmentDownloadUrl(path: string, downloadName: string) {
  assertPath(path);
  if (!/^[a-zA-Z0-9._-]{1,120}$/.test(downloadName)) throw new DomainAttachmentStorageError("INVALID");
  const result = await createAdminClient().storage.from(BUCKET_ID).createSignedUrl(path, 60, { download: downloadName });
  if (result.error || typeof result.data?.signedUrl !== "string" || !result.data.signedUrl.trim()) fail(result.error, false);
  return { downloadUrl: result.data.signedUrl, expiresInSeconds: 60 as const };
}
