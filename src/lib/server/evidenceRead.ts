import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const MAX_ID_LENGTH = 128;
const MAX_STATION_ORIGINAL_BYTES = 12 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CURRENT_PATH_PATTERN = /^order-station-evidence\/v1\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

export type EvidenceTargetType = "ORDER" | "ORDER_ITEM" | "CUSTOMER" | "INVOICE";
export type EvidenceTargetLink = { targetType: EvidenceTargetType; targetId: string };
export type EvidenceReadRecord = {
  evidenceKey: string;
  source: "ORDER_STATION_ATTACHMENT" | "LEGACY_SCAN_UPLOAD";
  sourceId: string;
  original: {
    state: "VERIFIED" | "LEGACY_RECORDED" | "LEGACY_PARTIAL" | "NOT_RECORDED";
    hash: string | null;
    hashAlgorithm: "SHA256" | "LEGACY_UNSPECIFIED" | null;
    sizeBytes: number | null;
    securedAt: string | null;
    mimeType: string | null;
  };
  extraction: {
    state: "NOT_REQUESTED" | "LEGACY_RECORDED" | "NOT_RECORDED";
    provider: string | null;
    detectedType: string | null;
    detectionConfidence: number | null;
    extractedData: Record<string, unknown> | null;
    fieldConfidence: Record<string, number>;
  };
  targets: EvidenceTargetLink[];
  recordedAt: string;
};

export type EvidenceReadResult<T> =
  | { code: "OK"; data: T }
  | { code: "FORBIDDEN"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

export type ReadOrderEvidenceInput = { orderId: string; itemId: string };
export type ReadEvidenceTargetInput = { targetType: EvidenceTargetType; targetId: string };

type EvidenceViewRow = {
  evidence_key: string;
  source_kind: string;
  source_id: string;
  tenant_id: string;
  original_state: string;
  original_bucket_id: string | null;
  original_storage_path: string | null;
  original_hash: string | null;
  original_hash_algorithm: string | null;
  original_size_bytes: number | string | null;
  original_secured_at: Date | string | null;
  original_mime_type: string | null;
  extraction_state: string;
  extraction_provider: string | null;
  detected_type: string | null;
  detection_confidence: number | string | null;
  extracted_data: unknown;
  field_confidence: unknown;
  target_links: unknown;
  recorded_at: Date | string;
  integrity_ok: boolean;
};

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validId(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= MAX_ID_LENGTH
    && value === value.trim();
}

function validTargetType(value: unknown): value is EvidenceTargetType {
  return value === "ORDER" || value === "ORDER_ITEM" || value === "CUSTOMER" || value === "INVOICE";
}

function validNullableText(value: unknown): value is string | null {
  return value === null || validId(value);
}

function toIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(value as string);
  if (!Number.isFinite(date.getTime())) throw new Error("EVIDENCE_TIME_INVALID");
  return date.toISOString();
}

function toNullableNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error("EVIDENCE_NUMBER_INVALID");
  return parsed;
}

function mapFieldConfidence(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("EVIDENCE_FIELD_CONFIDENCE_INVALID");
  }
  const mapped: Record<string, number> = {};
  for (const [key, confidence] of Object.entries(value)) {
    if (!validId(key) || typeof confidence !== "number" || confidence < 0 || confidence > 1) {
      throw new Error("EVIDENCE_FIELD_CONFIDENCE_INVALID");
    }
    mapped[key] = confidence;
  }
  return mapped;
}

function mapTargets(value: unknown): EvidenceTargetLink[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("EVIDENCE_TARGETS_INVALID");
  const targets = value.map((entry) => {
    if (!hasExactKeys(entry, ["targetType", "targetId"])) throw new Error("EVIDENCE_TARGETS_INVALID");
    const targetType = entry.targetType;
    if (
      targetType !== "ORDER"
      && targetType !== "ORDER_ITEM"
      && targetType !== "CUSTOMER"
      && targetType !== "INVOICE"
    ) throw new Error("EVIDENCE_TARGETS_INVALID");
    if (!validId(entry.targetId)) throw new Error("EVIDENCE_TARGETS_INVALID");
    return { targetType: targetType as EvidenceTargetType, targetId: entry.targetId };
  });
  const keys = targets.map((target) => `${target.targetType}\u0000${target.targetId}`);
  if (new Set(keys).size !== keys.length || keys.some((key, index) => index > 0 && key <= keys[index - 1]!)) {
    throw new Error("EVIDENCE_TARGETS_INVALID");
  }
  return targets;
}

function mapRecord(
  row: EvidenceViewRow,
  authorization: AuthorizationSnapshot,
  requestedTarget: ReadEvidenceTargetInput,
): EvidenceReadRecord {
  if (
    row.integrity_ok !== true
    || row.tenant_id !== authorization.tenantId
    || !validId(row.source_id)
    || !validId(row.evidence_key)
    || (row.source_kind !== "ORDER_STATION_ATTACHMENT" && row.source_kind !== "LEGACY_SCAN_UPLOAD")
    || row.evidence_key !== `${row.source_kind === "ORDER_STATION_ATTACHMENT" ? "order-station-attachment" : "legacy-scan-upload"}:${row.source_id}`
    || !validNullableText(row.original_storage_path)
    || !validNullableText(row.original_hash)
    || !validNullableText(row.original_mime_type)
    || !validNullableText(row.extraction_provider)
    || !validNullableText(row.detected_type)
  ) throw new Error("EVIDENCE_RECORD_INVALID");

  const sizeBytes = toNullableNumber(row.original_size_bytes);
  const detectionConfidence = toNullableNumber(row.detection_confidence);
  const securedAt = row.original_secured_at === null ? null : toIso(row.original_secured_at);
  const recordedAt = toIso(row.recorded_at);
  const targets = mapTargets(row.target_links);
  const fieldConfidence = mapFieldConfidence(row.field_confidence);
  const extractedData = row.extracted_data === null
    ? null
    : row.extracted_data && typeof row.extracted_data === "object" && !Array.isArray(row.extracted_data)
      ? row.extracted_data as Record<string, unknown>
      : (() => { throw new Error("EVIDENCE_EXTRACTION_INVALID"); })();

  if (!targets.some((target) => (
    target.targetType === requestedTarget.targetType && target.targetId === requestedTarget.targetId
  ))) {
    throw new Error("EVIDENCE_TARGET_BINDING_INVALID");
  }
  if (detectionConfidence !== null && (detectionConfidence < 0 || detectionConfidence > 1)) {
    throw new Error("EVIDENCE_EXTRACTION_INVALID");
  }

  if (row.source_kind === "ORDER_STATION_ATTACHMENT") {
    if (
      !UUID_PATTERN.test(row.source_id)
      || row.original_state !== "VERIFIED"
      || row.original_bucket_id !== "item-photos"
      || row.original_storage_path === null
      || !CURRENT_PATH_PATTERN.test(row.original_storage_path)
      || row.original_hash === null
      || !SHA256_PATTERN.test(row.original_hash)
      || row.original_hash_algorithm !== "SHA256"
      || sizeBytes === null
      || !Number.isInteger(sizeBytes)
      || sizeBytes < 1
      || sizeBytes > MAX_STATION_ORIGINAL_BYTES
      || securedAt === null
      || !["image/jpeg", "image/png", "image/webp"].includes(row.original_mime_type ?? "")
      || row.extraction_state !== "NOT_REQUESTED"
      || row.extraction_provider !== null
      || row.detected_type !== null
      || detectionConfidence !== null
      || extractedData !== null
      || Object.keys(fieldConfidence).length !== 0
      || targets.length !== 2
      || targets.filter((target) => target.targetType === "ORDER").length !== 1
      || targets.filter((target) => target.targetType === "ORDER_ITEM").length !== 1
    ) throw new Error("EVIDENCE_STATION_RECORD_INVALID");
  } else if (
    !["LEGACY_RECORDED", "LEGACY_PARTIAL", "NOT_RECORDED"].includes(row.original_state)
    || row.original_bucket_id !== null
    || !["LEGACY_RECORDED", "NOT_RECORDED"].includes(row.extraction_state)
    || !["SHA256", "LEGACY_UNSPECIFIED", null].includes(row.original_hash_algorithm)
    || (sizeBytes !== null && (!Number.isInteger(sizeBytes) || sizeBytes < 1))
  ) throw new Error("EVIDENCE_LEGACY_RECORD_INVALID");

  return {
    evidenceKey: row.evidence_key,
    source: row.source_kind,
    sourceId: row.source_id,
    original: {
      state: row.original_state as EvidenceReadRecord["original"]["state"],
      hash: row.original_hash,
      hashAlgorithm: row.original_hash_algorithm as EvidenceReadRecord["original"]["hashAlgorithm"],
      sizeBytes,
      securedAt,
      mimeType: row.original_mime_type,
    },
    extraction: {
      state: row.extraction_state as EvidenceReadRecord["extraction"]["state"],
      provider: row.extraction_provider,
      detectedType: row.detected_type,
      detectionConfidence,
      extractedData,
      fieldConfidence,
    },
    targets,
    recordedAt,
  };
}

export async function readEvidenceRecordsByTarget(
  authorization: AuthorizationSnapshot,
  input: ReadEvidenceTargetInput,
): Promise<EvidenceReadResult<EvidenceReadRecord[]>> {
  if (
    !hasExactKeys(input, ["targetType", "targetId"])
    || !validTargetType(input.targetType)
    || !validId(input.targetId)
  ) {
    return { code: "VALIDATION_ERROR", message: "Ungültiges Nachweisziel." };
  }
  if (!authorization.permissions.includes("perm_view_leitstand")) {
    return { code: "FORBIDDEN", message: "Nachweise sind nicht erlaubt." };
  }
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<EvidenceViewRow>(sql`
        SELECT *
        FROM private.v_evidence_records_v1
        WHERE target_links @> jsonb_build_array(
          jsonb_build_object(
            'targetType', ${input.targetType}::text,
            'targetId', ${input.targetId}::text
          )
        )
        ORDER BY recorded_at DESC, evidence_key
      `);
      return rows.map((row) => mapRecord(row, authorization, input));
    });
    return { code: "OK", data };
  } catch {
    return { code: "UNAVAILABLE", message: "Nachweise konnten nicht sicher geladen werden." };
  }
}

export async function readOrderEvidenceRecords(
  authorization: AuthorizationSnapshot,
  input: ReadOrderEvidenceInput,
): Promise<EvidenceReadResult<EvidenceReadRecord[]>> {
  if (!hasExactKeys(input, ["orderId", "itemId"]) || !validId(input.orderId) || !validId(input.itemId)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Auftrags- oder Teilekennung." };
  }
  if (!authorization.permissions.includes("perm_view_leitstand")) {
    return { code: "FORBIDDEN", message: "Nachweise sind nicht erlaubt." };
  }
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<EvidenceViewRow>(sql`
        SELECT *
        FROM private.v_evidence_records_v1
        WHERE target_links @> jsonb_build_array(
          jsonb_build_object('targetType', 'ORDER', 'targetId', ${input.orderId}::text)
        )
          AND (
            source_kind = 'LEGACY_SCAN_UPLOAD'
            OR target_links @> jsonb_build_array(
              jsonb_build_object('targetType', 'ORDER_ITEM', 'targetId', ${input.itemId}::text)
            )
          )
        ORDER BY recorded_at DESC, evidence_key
      `);
      return rows.map((row) => {
        const record = mapRecord(row, authorization, { targetType: "ORDER", targetId: input.orderId });
        if (
          record.source === "ORDER_STATION_ATTACHMENT"
          && !record.targets.some((target) => target.targetType === "ORDER_ITEM" && target.targetId === input.itemId)
        ) throw new Error("EVIDENCE_ITEM_BINDING_INVALID");
        return record;
      });
    });
    return { code: "OK", data };
  } catch {
    return { code: "UNAVAILABLE", message: "Nachweise konnten nicht sicher geladen werden." };
  }
}
