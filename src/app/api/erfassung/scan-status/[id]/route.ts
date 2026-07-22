import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { scanUploads } from "@/db/schema";
import { resolveAuthorization } from "@/lib/server/authorization";
import { readScanSchemaCapability } from "@/lib/server/scanCaptureCapability";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) {
    if (authorization.reason === "AUTHORIZATION_UNAVAILABLE" || authorization.reason === "TENANT_MAINTENANCE") {
      return response({ ok: false, code: authorization.reason }, 503);
    }
    if (authorization.reason === "TENANT_SUSPENDED") return response({ ok: false, code: authorization.reason }, 423);
    return response({ ok: false, code: "UNAUTHORIZED" }, 401);
  }
  if (
    authorization.data.tenantId !== "galvanik-kreile"
    || !authorization.data.permissions.includes("perm_data_orders")
  ) return response({ ok: false, code: "FORBIDDEN" }, 403);

  const { id } = await context.params;
  if (!UUID.test(id)) return response({ ok: false, code: "INVALID_REQUEST" }, 400);
  const capability = await readScanSchemaCapability();
  if (!capability.available) {
    return response({ ok: false, code: "CONFIGURATION_MISSING", reason: capability.reason }, 503);
  }

  try {
    const [record] = await db.select({
      id: scanUploads.id,
      status: scanUploads.status,
      fileType: scanUploads.fileType,
      contentSha256: scanUploads.contentSha256,
      fileSizeBytes: scanUploads.fileSizeBytes,
      processingAttemptCount: scanUploads.processingAttemptCount,
      lastProcessingError: scanUploads.lastProcessingError,
      uploadedAt: scanUploads.uploadedAt,
      detectedType: scanUploads.detectedType,
      detectionConfidence: scanUploads.detectionConfidence,
      extractedData: scanUploads.extractedData,
      linkedOrderId: scanUploads.linkedOrderId,
      linkedCustomerId: scanUploads.linkedCustomerId,
    }).from(scanUploads).where(and(
      eq(scanUploads.id, id),
      eq(scanUploads.tenantId, authorization.data.tenantId),
      eq(scanUploads.recordKind, "capture_scan"),
    )).limit(1);
    if (!record) return response({ ok: false, code: "NOT_FOUND" }, 404);
    return response({ ok: true, ...record });
  } catch (error) {
    console.error("Scan status unavailable", error);
    return response({ ok: false, code: "SCAN_STATUS_UNAVAILABLE" }, 503);
  }
}
