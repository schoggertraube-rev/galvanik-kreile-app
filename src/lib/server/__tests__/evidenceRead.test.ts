import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  withTransaction: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({
  sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }),
}));
vi.mock("@/lib/server/privilegedDb", () => ({
  withPrivilegedTenantTransaction: ports.withTransaction,
}));

import { readEvidenceRecordsByTarget, readOrderEvidenceRecords } from "@/lib/server/evidenceRead";

const TENANT = "galvanik-kreile";
const ORDER = "order-a";
const ITEM = "item-a";
const RECEIPT = "11111111-1111-4111-8111-111111111111";
const authorization = {
  userId: "22222222-2222-4222-8222-222222222222",
  tenantId: TENANT,
  displayName: "Werkstatt",
  role: "werkstatt" as const,
  permissions: ["perm_view_leitstand", "perm_op_photos"] as const,
  active: true as const,
};

const currentRow = {
  evidence_key: `order-station-attachment:${RECEIPT}`,
  source_kind: "ORDER_STATION_ATTACHMENT",
  source_id: RECEIPT,
  tenant_id: TENANT,
  original_state: "VERIFIED",
  original_bucket_id: "item-photos",
  original_storage_path: "order-station-evidence/v1/33333333-3333-4333-8333-333333333333.png",
  original_hash: "a".repeat(64),
  original_hash_algorithm: "SHA256",
  original_size_bytes: "12",
  original_secured_at: "2026-08-12T00:01:00.000Z",
  original_mime_type: "image/png",
  extraction_state: "NOT_REQUESTED",
  extraction_provider: null,
  detected_type: null,
  detection_confidence: null,
  extracted_data: null,
  field_confidence: {},
  target_links: [
    { targetType: "ORDER", targetId: ORDER },
    { targetType: "ORDER_ITEM", targetId: ITEM },
  ],
  recorded_at: "2026-08-12T00:02:00.000Z",
  integrity_ok: true,
};

const legacyRow = {
  evidence_key: "legacy-scan-upload:legacy-scan-1",
  source_kind: "LEGACY_SCAN_UPLOAD",
  source_id: "legacy-scan-1",
  tenant_id: TENANT,
  original_state: "LEGACY_RECORDED",
  original_bucket_id: null,
  original_storage_path: "legacy/private/scan-1.pdf",
  original_hash: "b".repeat(64),
  original_hash_algorithm: "SHA256",
  original_size_bytes: 321,
  original_secured_at: "2026-08-12T00:01:00.000Z",
  original_mime_type: "application/pdf",
  extraction_state: "LEGACY_RECORDED",
  extraction_provider: "legacy-ocr",
  detected_type: "Lieferschein",
  detection_confidence: "0.91",
  extracted_data: { documentNumber: "LS-1" },
  field_confidence: { documentNumber: 0.89 },
  target_links: [
    { targetType: "CUSTOMER", targetId: "customer-a" },
    { targetType: "ORDER", targetId: ORDER },
  ],
  recorded_at: "2026-08-12T00:02:00.000Z",
  integrity_ok: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  ports.withTransaction.mockImplementation(async (_authorization, work) => work({ execute: ports.execute }));
  ports.execute.mockResolvedValue([currentRow, legacyRow]);
});

describe("W4 canonical Evidence read port", () => {
  it("rejects untrusted input and missing read capability before DB access", async () => {
    await expect(readOrderEvidenceRecords(authorization, {
      orderId: ` ${ORDER}`,
      itemId: ITEM,
    })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(readOrderEvidenceRecords({
      ...authorization,
      permissions: ["perm_op_photos"],
    }, { orderId: ORDER, itemId: ITEM })).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(ports.withTransaction).not.toHaveBeenCalled();
  });

  it("maps verified and legacy extraction truth through only the versioned tenant view", async () => {
    const result = await readOrderEvidenceRecords(authorization, { orderId: ORDER, itemId: ITEM });
    expect(result).toEqual({
      code: "OK",
      data: [
        expect.objectContaining({
          source: "ORDER_STATION_ATTACHMENT",
          extraction: expect.objectContaining({ state: "NOT_REQUESTED", detectionConfidence: null }),
          targets: currentRow.target_links,
        }),
        expect.objectContaining({
          source: "LEGACY_SCAN_UPLOAD",
          extraction: expect.objectContaining({
            state: "LEGACY_RECORDED",
            detectedType: "Lieferschein",
            detectionConfidence: 0.91,
          }),
          targets: legacyRow.target_links,
        }),
      ],
    });
    expect(ports.withTransaction).toHaveBeenCalledWith(authorization, expect.any(Function));
    const query = ports.execute.mock.calls[0]?.[0] as { text: string; values: unknown[] };
    expect(query.text).toContain("FROM private.v_evidence_records_v2");
    expect(query.text).not.toContain("public.scan_uploads");
    expect(query.values).toEqual([ORDER, ITEM]);
  });

  it.each([
    ["CUSTOMER", "customer-a"],
    ["INVOICE", "55555555-5555-4555-8555-555555555555"],
  ] as const)("reads a legacy-only %s target through the polymorphic port", async (targetType, targetId) => {
    const row = {
      ...legacyRow,
      source_id: `legacy-${targetType.toLowerCase()}`,
      evidence_key: `legacy-scan-upload:legacy-${targetType.toLowerCase()}`,
      target_links: [{ targetType, targetId }],
    };
    ports.execute.mockResolvedValueOnce([row]);
    await expect(readEvidenceRecordsByTarget(authorization, { targetType, targetId })).resolves.toEqual({
      code: "OK",
      data: [expect.objectContaining({ source: "LEGACY_SCAN_UPLOAD", targets: row.target_links })],
    });
    const query = ports.execute.mock.calls.at(-1)?.[0] as { text: string; values: unknown[] };
    expect(query.text).toContain("FROM private.v_evidence_records_v2");
    expect(query.values).toEqual([targetType, targetId]);
  });

  it("rejects malformed target input before DB and fails a mismatched returned target closed", async () => {
    await expect(readEvidenceRecordsByTarget(authorization, {
      targetType: "CUSTOMER",
      targetId: " customer-a",
    })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(ports.withTransaction).not.toHaveBeenCalled();

    ports.execute.mockResolvedValueOnce([legacyRow]);
    await expect(readEvidenceRecordsByTarget(authorization, {
      targetType: "INVOICE",
      targetId: "55555555-5555-4555-8555-555555555555",
    })).resolves.toEqual({ code: "UNAVAILABLE", message: "Nachweise konnten nicht sicher geladen werden." });
  });

  it.each([
    ["view integrity", { integrity_ok: false }],
    ["tenant", { tenant_id: "foreign" }],
    ["order target", { target_links: [{ targetType: "ORDER", targetId: "other" }] }],
    ["item target", { target_links: [{ targetType: "ORDER", targetId: ORDER }] }],
    ["confidence", { detection_confidence: "1.01" }],
    ["duplicate target", { target_links: [...currentRow.target_links, currentRow.target_links[1]] }],
  ])("fails the whole read closed for a wrong %s binding", async (_name, override) => {
    ports.execute.mockResolvedValueOnce([{ ...currentRow, ...override }]);
    await expect(readOrderEvidenceRecords(authorization, { orderId: ORDER, itemId: ITEM }))
      .resolves.toEqual({ code: "UNAVAILABLE", message: "Nachweise konnten nicht sicher geladen werden." });
  });

  it("source-locks cross-module reads to the versioned view and never exposes legacy object URLs", async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
    const source = await readFile(path.join(root, "src/lib/server/evidenceRead.ts"), "utf8");
    expect(source).toContain("private.v_evidence_records_v2");
    expect(source).not.toContain("public.scan_uploads");
    expect(source).not.toContain("file_url");
    expect(source).not.toContain("createAdminClient");
  });
});
