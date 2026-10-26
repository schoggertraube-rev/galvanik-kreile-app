import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MIME_EXTENSION = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" } as const;
type AttachmentMime = keyof typeof MIME_EXTENSION;
type AttachmentTarget = "CUSTOMER" | "ORDER";

type ScanRow = {
  id: string; tenant_id: string; file_url: string; file_type: string | null; uploaded_by: string | null; uploaded_at: Date | string;
  status: string; linked_order_id: string | null; linked_customer_id: string | null; original_hash: string | null;
  original_storage_path: string | null; original_size_bytes: number | string | null; original_secured_at: Date | string | null;
  client_idempotency_key: string | null;
};

export type DomainAttachmentReceipt = {
  attachmentId: string; targetType: AttachmentTarget; targetId: string; customerId: string; orderId: string | null;
  mimeType: AttachmentMime; fileBytes: number | null; contentSha256: string | null; state: "PENDING" | "FINALIZED"; recordedAt: string;
};
export type ReserveDomainAttachmentInput = {
  targetType: AttachmentTarget; targetId: string; clientRequestId: string; mimeType: AttachmentMime; fileBytes: number; contentSha256: string;
};
export type FinalizeDomainAttachmentInput = { attachmentId: string; fileBytes: number; contentSha256: string };
export type DomainAttachmentResult<T> = { code: "OK"; data: T } | { code: "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "CONFLICT" | "UNAVAILABLE"; message: string };

function canWrite(authorization: AuthorizationSnapshot) {
  return authorization.permissions.includes("perm_op_photos");
}

function validTargetId(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length >= 1 && value.length <= 128;
}

function validMime(value: unknown): value is AttachmentMime {
  return typeof value === "string" && value in MIME_EXTENSION;
}

function path(id: string, mime: AttachmentMime) {
  return `domain-attachments/v1/${id}.${MIME_EXTENSION[mime]}`;
}

function toIso(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("DOMAIN_ATTACHMENT_TIME_INVALID");
  return date.toISOString();
}

function receipt(row: ScanRow, targetType: AttachmentTarget, targetId: string): DomainAttachmentReceipt {
  if (!UUID.test(row.id) || !validMime(row.file_type) || row.tenant_id.length === 0 || !row.linked_customer_id) throw new Error("DOMAIN_ATTACHMENT_ROW_INVALID");
  const finalized = row.status === "secured";
  if (!finalized && row.status !== "upload_reserved") throw new Error("DOMAIN_ATTACHMENT_STATE_INVALID");
  const fileBytes = row.original_size_bytes === null ? null : Number(row.original_size_bytes);
  if (finalized && (!Number.isSafeInteger(fileBytes) || (fileBytes ?? 0) < 1 || !row.original_hash || !SHA256.test(row.original_hash) || !row.original_storage_path || !row.original_secured_at)) {
    throw new Error("DOMAIN_ATTACHMENT_FINAL_INVALID");
  }
  return {
    attachmentId: row.id, targetType, targetId, customerId: row.linked_customer_id, orderId: row.linked_order_id,
    mimeType: row.file_type, fileBytes, contentSha256: row.original_hash, state: finalized ? "FINALIZED" : "PENDING",
    recordedAt: toIso(row.original_secured_at ?? row.uploaded_at),
  };
}

function validReserve(input: unknown): input is ReserveDomainAttachmentInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  return Object.keys(value).sort().join(",") === "clientRequestId,contentSha256,fileBytes,mimeType,targetId,targetType"
    && (value.targetType === "CUSTOMER" || value.targetType === "ORDER") && validTargetId(value.targetId) && typeof value.clientRequestId === "string" && UUID.test(value.clientRequestId)
    && validMime(value.mimeType) && Number.isSafeInteger(value.fileBytes) && (value.fileBytes as number) >= 1 && (value.fileBytes as number) <= MAX_FILE_BYTES
    && typeof value.contentSha256 === "string" && SHA256.test(value.contentSha256);
}

export async function reserveDomainAttachment(authorization: AuthorizationSnapshot, input: unknown): Promise<DomainAttachmentResult<{ receipt: DomainAttachmentReceipt; upload: { path: string; token: string } | null; replayed: boolean }>> {
  if (!validReserve(input)) return { code: "VALIDATION_ERROR", message: "Datei oder Zuordnung ist ungültig." };
  if (!canWrite(authorization)) return { code: "FORBIDDEN", message: "Dokumente und Fotos sind nicht erlaubt." };
  try {
    const decision = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const existing = await tx.execute<ScanRow>(sql`SELECT * FROM public.scan_uploads WHERE tenant_id=${authorization.tenantId} AND client_idempotency_key=${input.clientRequestId} LIMIT 2 FOR UPDATE`);
      if (existing.length > 1) throw new Error("DOMAIN_ATTACHMENT_IDEMPOTENCY_AMBIGUOUS");
      if (existing[0]) {
        const row = existing[0];
        const intendedTarget = input.targetType === "ORDER" ? row.linked_order_id : row.linked_customer_id;
        if (intendedTarget !== input.targetId || row.file_type !== input.mimeType || row.file_url !== `storage://scans/${path(row.id, input.mimeType)}`) {
          return { terminal: { code: "CONFLICT" as const, message: "Die Anfragekennung gehört zu einer anderen Datei." } };
        }
        return { row, replayed: true };
      }

      let customerId: string;
      let orderId: string | null = null;
      if (input.targetType === "ORDER") {
        const rows = await tx.execute<{ id: string; customer_id: string | null }>(sql`SELECT id, customer_id FROM public.orders WHERE tenant_id=${authorization.tenantId} AND id=${input.targetId} LIMIT 2 FOR SHARE`);
        if (rows.length !== 1 || !rows[0]?.customer_id) return { terminal: { code: "NOT_FOUND" as const, message: "Auftrag nicht verfügbar." } };
        orderId = rows[0].id;
        customerId = rows[0].customer_id;
      } else {
        const rows = await tx.execute<{ id: string }>(sql`SELECT id FROM public.customers WHERE tenant_id=${authorization.tenantId} AND id=${input.targetId} LIMIT 2 FOR SHARE`);
        if (rows.length !== 1 || !rows[0]) return { terminal: { code: "NOT_FOUND" as const, message: "Kunde nicht verfügbar." } };
        customerId = rows[0].id;
      }
      const id = randomUUID();
      const objectPath = path(id, input.mimeType);
      const rows = await tx.execute<ScanRow>(sql`
        INSERT INTO public.scan_uploads (id, tenant_id, file_url, file_type, uploaded_by, status, linked_order_id, linked_customer_id, client_idempotency_key, review_required)
        VALUES (${id}, ${authorization.tenantId}, ${`storage://scans/${objectPath}`}, ${input.mimeType}, ${authorization.userId}, 'upload_reserved', ${orderId}, ${customerId}, ${input.clientRequestId}, false)
        RETURNING *
      `);
      if (rows.length !== 1 || !rows[0]) throw new Error("DOMAIN_ATTACHMENT_INSERT_FAILED");
      return { row: rows[0], replayed: false };
    });
    if ("terminal" in decision) return decision.terminal!;
    const resultReceipt = receipt(decision.row, input.targetType, input.targetId);
    if (resultReceipt.state === "FINALIZED") return { code: "OK", data: { receipt: resultReceipt, upload: null, replayed: true } };
    const storage = await import("@/lib/server/domainAttachmentStorage");
    const upload = await storage.createDomainAttachmentUploadGrant(path(decision.row.id, input.mimeType));
    return { code: "OK", data: { receipt: resultReceipt, upload, replayed: decision.replayed } };
  } catch {
    return { code: "UNAVAILABLE", message: "Uploadfreigabe konnte nicht sicher erstellt werden." };
  }
}

function validFinalize(input: unknown): input is FinalizeDomainAttachmentInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  return Object.keys(value).sort().join(",") === "attachmentId,contentSha256,fileBytes" && typeof value.attachmentId === "string" && UUID.test(value.attachmentId)
    && Number.isSafeInteger(value.fileBytes) && (value.fileBytes as number) >= 1 && (value.fileBytes as number) <= MAX_FILE_BYTES
    && typeof value.contentSha256 === "string" && SHA256.test(value.contentSha256);
}

function signature(bytes: Uint8Array, mime: AttachmentMime): boolean {
  if (mime === "application/pdf") return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export async function finalizeDomainAttachment(authorization: AuthorizationSnapshot, input: unknown): Promise<DomainAttachmentResult<{ receipt: DomainAttachmentReceipt; replayed: boolean }>> {
  if (!validFinalize(input)) return { code: "VALIDATION_ERROR", message: "Dateibestätigung ist ungültig." };
  if (!canWrite(authorization)) return { code: "FORBIDDEN", message: "Dokumente und Fotos sind nicht erlaubt." };
  try {
    const row = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<ScanRow>(sql`SELECT * FROM public.scan_uploads WHERE tenant_id=${authorization.tenantId} AND id=${input.attachmentId} LIMIT 2 FOR UPDATE`);
      if (rows.length > 1) throw new Error("DOMAIN_ATTACHMENT_AMBIGUOUS");
      return rows[0] ?? null;
    });
    if (!row) return { code: "NOT_FOUND", message: "Datei nicht verfügbar." };
    const targetType: AttachmentTarget = row.linked_order_id ? "ORDER" : "CUSTOMER";
    const targetId = row.linked_order_id ?? row.linked_customer_id;
    if (!targetId || !validMime(row.file_type)) return { code: "UNAVAILABLE", message: "Dateizuordnung ist nicht lesbar." };
    if (row.status === "secured") {
      const current = receipt(row, targetType, targetId);
      return current.fileBytes === input.fileBytes && current.contentSha256 === input.contentSha256
        ? { code: "OK", data: { receipt: current, replayed: true } }
        : { code: "CONFLICT", message: "Die Datei ist bereits mit anderem Inhalt bestätigt." };
    }
    if (row.status !== "upload_reserved") return { code: "CONFLICT", message: "Die Uploadfreigabe ist nicht mehr offen." };
    const objectPath = path(row.id, row.file_type);
    const storage = await import("@/lib/server/domainAttachmentStorage");
    const stable = await storage.readStableDomainAttachment(objectPath, { fileBytes: input.fileBytes, mimeType: row.file_type });
    if (!signature(stable.bytes, row.file_type) || createHash("sha256").update(stable.bytes).digest("hex") !== input.contentSha256) {
      return { code: "CONFLICT", message: "Upload stimmt nicht mit der ausgewählten Datei überein." };
    }
    const updated = await withPrivilegedTenantTransaction(authorization, async (tx) => tx.execute<ScanRow>(sql`
      UPDATE public.scan_uploads SET status='secured', original_storage_path=${objectPath}, original_hash=${input.contentSha256},
        original_size_bytes=${input.fileBytes}, original_secured_at=${stable.info.createdAt}, reviewed_by=${authorization.userId}, reviewed_at=statement_timestamp()
      WHERE tenant_id=${authorization.tenantId} AND id=${row.id} AND status='upload_reserved'
      RETURNING *
    `));
    if (updated.length !== 1 || !updated[0]) throw new Error("DOMAIN_ATTACHMENT_FINALIZE_FAILED");
    return { code: "OK", data: { receipt: receipt(updated[0], targetType, targetId), replayed: false } };
  } catch (error) {
    const storage = await import("@/lib/server/domainAttachmentStorage");
    if (error instanceof storage.DomainAttachmentStorageError && error.kind === "NOT_READY") return { code: "CONFLICT", message: "Upload ist noch nicht vollständig verfügbar." };
    if (error instanceof storage.DomainAttachmentStorageError && error.kind === "MISMATCH") return { code: "CONFLICT", message: "Upload stimmt nicht mit der ausgewählten Datei überein." };
    return { code: "UNAVAILABLE", message: "Datei konnte nicht sicher bestätigt werden." };
  }
}

export async function getDomainAttachmentOriginal(authorization: AuthorizationSnapshot, input: { attachmentId: string }) {
  if (!input || Object.keys(input).join(",") !== "attachmentId" || !UUID.test(input.attachmentId)) return { code: "VALIDATION_ERROR" as const, message: "Dateikennung ist ungültig." };
  if (!authorization.permissions.includes("perm_view_leitstand")) return { code: "FORBIDDEN" as const, message: "Dokumente und Fotos sind nicht erlaubt." };
  try {
    const row = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<ScanRow>(sql`SELECT * FROM public.scan_uploads WHERE tenant_id=${authorization.tenantId} AND id=${input.attachmentId} AND status='secured' LIMIT 2`);
      if (rows.length > 1) throw new Error("DOMAIN_ATTACHMENT_AMBIGUOUS");
      return rows[0] ?? null;
    });
    if (!row || !row.original_storage_path || !validMime(row.file_type)) return { code: "NOT_FOUND" as const, message: "Datei nicht verfügbar." };
    const storage = await import("@/lib/server/domainAttachmentStorage");
    const download = await storage.createDomainAttachmentDownloadUrl(row.original_storage_path, `Kreile-Dokument-${row.id}.${MIME_EXTENSION[row.file_type]}`);
    return { code: "OK" as const, data: { ...download, mimeType: row.file_type } };
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Datei konnte nicht sicher geöffnet werden." };
  }
}

export async function importDomainAttachmentBytes(authorization: AuthorizationSnapshot, input: {
  targetType: AttachmentTarget; targetId: string; sourceKey: string; mimeType: AttachmentMime; bytes: Uint8Array;
}): Promise<DomainAttachmentResult<{ receipt: DomainAttachmentReceipt; replayed: boolean }>> {
  if (typeof input.sourceKey !== "string" || input.sourceKey.length < 1 || input.sourceKey.length > 4096 || !validMime(input.mimeType)
    || !(input.bytes instanceof Uint8Array) || input.bytes.byteLength < 1 || input.bytes.byteLength > MAX_FILE_BYTES) {
    return { code: "VALIDATION_ERROR", message: "Importierte Datei ist ungültig." };
  }
  const digest = createHash("sha256").update(input.bytes).digest("hex");
  const key = createHash("sha256").update(`${authorization.tenantId}:${input.sourceKey}`).digest("hex");
  const clientRequestId = `${key.slice(0,8)}-${key.slice(8,12)}-5${key.slice(13,16)}-a${key.slice(17,20)}-${key.slice(20,32)}`;
  const reserved = await reserveDomainAttachment(authorization, {
    targetType: input.targetType, targetId: input.targetId, clientRequestId, mimeType: input.mimeType,
    fileBytes: input.bytes.byteLength, contentSha256: digest,
  });
  if (reserved.code !== "OK") return reserved;
  if (reserved.data.receipt.state === "FINALIZED") return { code: "OK", data: { receipt: reserved.data.receipt, replayed: true } };
  if (!reserved.data.upload) return { code: "UNAVAILABLE", message: "Private Ablage konnte nicht vorbereitet werden." };
  try {
    const storage = await import("@/lib/server/domainAttachmentStorage");
    await storage.storeDomainAttachmentBytes(reserved.data.upload.path, input.bytes, input.mimeType);
  } catch {
    return { code: "UNAVAILABLE", message: "Mailanhang konnte nicht privat gespeichert werden." };
  }
  return finalizeDomainAttachment(authorization, { attachmentId: reserved.data.receipt.attachmentId, fileBytes: input.bytes.byteLength, contentSha256: digest });
}
