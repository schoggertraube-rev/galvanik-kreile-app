import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { analyzeWithAzureDocumentIntelligence, readAzureDocumentIntelligenceStatus } from "@/lib/server/azureDocumentIntelligence";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type ScanRow = { id: string; tenant_id: string; uploaded_by: string | null; file_type: string | null; original_storage_path: string | null; original_size_bytes: number | string | null; original_hash: string | null; status: string; linked_customer_id: string | null; linked_order_id: string | null };

function logDocumentIntelligenceFailure(code: string, error: unknown) {
  console.error(`[${code}]`, error instanceof Error ? error.message : "UNKNOWN_ERROR");
}

export async function analyzeDomainAttachment(auth: AuthorizationSnapshot, input: { attachmentId: string; targetType: "CUSTOMER" | "ORDER" | "INTAKE_DRAFT"; targetId: string }) {
  if (!input || !UUID.test(input.attachmentId) || !["CUSTOMER", "ORDER", "INTAKE_DRAFT"].includes(input.targetType) || typeof input.targetId !== "string" || input.targetId.length < 1 || input.targetId.length > 128) {
    return { code: "VALIDATION_ERROR" as const, message: "Dokument oder Zuordnung ist ungültig." };
  }
  if (!auth.permissions.includes("perm_op_photos")) return { code: "FORBIDDEN" as const, message: "Dokumentanalyse ist für diese Rolle nicht freigegeben." };
  if (readAzureDocumentIntelligenceStatus().code !== "READY") return { code: "IN_KLAERUNG" as const, message: "Azure Document Intelligence · In Klärung. Die Preview-Zugangsdaten sind noch nicht vollständig verbunden." };
  try {
    const row = await withPrivilegedTenantTransaction(auth, async (tx) => {
      const rows = await tx.execute<ScanRow>(sql`SELECT id, tenant_id, uploaded_by, file_type, original_storage_path, original_size_bytes, original_hash, status, linked_customer_id, linked_order_id FROM public.scan_uploads WHERE tenant_id=${auth.tenantId} AND id=${input.attachmentId} LIMIT 2`);
      return rows.length === 1 ? rows[0] ?? null : null;
    });
    const targetMatches = row && (input.targetType === "CUSTOMER" ? row.linked_customer_id === input.targetId
      : input.targetType === "ORDER" ? row.linked_order_id === input.targetId
        : row.uploaded_by === auth.userId && row.linked_customer_id === null && row.linked_order_id === null && input.targetId === row.id);
    const fileBytes = row?.original_size_bytes === null || row?.original_size_bytes === undefined ? 0 : Number(row.original_size_bytes);
    if (!row || !targetMatches || row.status !== "secured" || !row.original_storage_path || !row.file_type || !row.original_hash || !Number.isSafeInteger(fileBytes) || fileBytes < 1) {
      return { code: "NOT_FOUND" as const, message: "Das private Original ist nicht sicher verfügbar." };
    }
    const storage = await import("@/lib/server/domainAttachmentStorage");
    const stable = await storage.readStableDomainAttachment(row.original_storage_path, { fileBytes, mimeType: row.file_type });
    const analyzed = await analyzeWithAzureDocumentIntelligence(stable.bytes, row.file_type);
    if (analyzed.code !== "OK") return analyzed;
    const confidence = Object.fromEntries(analyzed.data.suggestions.map((item, index) => [`${index}:${item.field}`, item.confidence]));
    const payload = { version: 1, provider: "azure_document_intelligence", suggestions: analyzed.data.suggestions };
    const updated = await withPrivilegedTenantTransaction(auth, (tx) => tx.execute<{ id: string }>(sql`
      UPDATE public.scan_uploads SET detected_type='document', detection_confidence=${analyzed.data.suggestions.length ? Math.max(...analyzed.data.suggestions.map((item) => item.confidence)) : 0},
        extracted_data=${JSON.stringify(payload)}::jsonb, field_confidence=${JSON.stringify(confidence)}::jsonb,
        ocr_provider='azure_document_intelligence', review_required=true, status='ocr_review'
      WHERE tenant_id=${auth.tenantId} AND id=${row.id} AND status='secured' AND original_hash=${row.original_hash}
      RETURNING id
    `));
    if (updated.length !== 1) return { code: "CONFLICT" as const, message: "Das Dokument hat sich während der Analyse geändert. Bitte neu laden." };
    if (input.targetType === "INTAKE_DRAFT") return { code: "OK" as const, data: { ...analyzed.data, customerId: null, customerName: null } };
    const customer = await withPrivilegedTenantTransaction(auth, (tx) => tx.execute<{ id: string; name: string }>(sql`
      SELECT id, name FROM public.customers WHERE tenant_id=${auth.tenantId} AND id=${row.linked_customer_id} LIMIT 2
    `));
    if (customer.length !== 1 || !customer[0]) return { code: "UNAVAILABLE" as const, message: "Der zugehörige Kunde ist nicht sicher lesbar." };
    return { code: "OK" as const, data: { ...analyzed.data, customerId: customer[0].id, customerName: customer[0].name } };
  } catch (error) {
    logDocumentIntelligenceFailure("DOCUMENT_INTELLIGENCE_ANALYSIS_FAILED", error);
    return { code: "UNAVAILABLE" as const, message: "Das Dokument konnte nicht sicher analysiert und gespeichert werden." };
  }
}
