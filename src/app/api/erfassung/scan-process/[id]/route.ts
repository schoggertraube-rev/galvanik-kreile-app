import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { scanUploads } from "@/db/schema";
import { extractDocumentDataWithUsage, OcrResponseError, parseOcrResponse } from "@/lib/ocr/geminiOcr";
import {
  claimDirectAiUsage,
  reserveDirectAiUsage,
  settleDirectAiUsage,
} from "@/lib/server/aiUsage";
import { resolveAuthorization } from "@/lib/server/authorization";
import { readScanCaptureCapability } from "@/lib/server/scanCaptureCapability";
import {
  hasDeclaredScanSignature,
  isConfirmedCaptureReceipt,
  MAX_SCAN_PROCESSING_ATTEMPTS,
  SCAN_UUID,
} from "@/lib/server/scanOriginalContract";

export const runtime = "nodejs";

const STALE_PROCESSING_MS = 5 * 60 * 1_000;

type ClaimResult =
  | { kind: "claimed"; id: string; path: string; mimeType: string; digest: string; bytes: number; attempt: number; uploadedBy: string }
  | { kind: "processed"; id: string; digest: string; bytes: number }
  | { kind: "blocked"; code: string; status: number };

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

async function settleClaim(
  id: string,
  tenantId: string,
  attempt: number,
  status: "secured" | "integrity_error" | "review_required",
  code: string,
  restoreAttempt = false,
): Promise<boolean> {
  try {
    const [settled] = await db.update(scanUploads).set({
      status,
      processingClaimedAt: null,
      lastProcessingError: code.slice(0, 120),
      ...(restoreAttempt ? {
        processingAttemptCount: sql`greatest(${scanUploads.processingAttemptCount} - 1, 0)`,
      } : {}),
    }).where(and(
      eq(scanUploads.id, id),
      eq(scanUploads.tenantId, tenantId),
      eq(scanUploads.recordKind, "capture_scan"),
      eq(scanUploads.status, "processing"),
      eq(scanUploads.processingAttemptCount, attempt),
    )).returning({ id: scanUploads.id });
    return Boolean(settled);
  } catch (error) {
    console.error("Scan processing settlement failed", error);
    return false;
  }
}

async function settleUnusedAiAdmission(
  admission: Awaited<ReturnType<typeof reserveDirectAiUsage>>,
  identity: { tenantId: string; userId: string },
  providerStatus: string,
): Promise<boolean> {
  if (admission.kind !== "reserved") return admission.kind === "replay";
  try {
    await claimDirectAiUsage({
      reservationId: admission.reservationId,
      identity,
      feature: "receipt-ocr",
    });
    await settleDirectAiUsage({
      reservationId: admission.reservationId,
      identity,
      feature: "receipt-ocr",
      outcome: "failed",
      actualUnits: 0,
      providerStatus,
    });
    return true;
  } catch (error) {
    console.error("Unused scan OCR admission could not be settled", error);
    return false;
  }
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return authorizationFailure(authorization.reason);
  if (
    authorization.data.tenantId !== "galvanik-kreile"
    || !authorization.data.permissions.includes("perm_data_orders")
  ) return response({ ok: false, code: "FORBIDDEN" }, 403);

  const { id } = await context.params;
  if (!SCAN_UUID.test(id)) return response({ ok: false, code: "INVALID_REQUEST" }, 400);
  const capability = await readScanCaptureCapability();
  if (!capability.available) {
    return response({ ok: false, code: "CONFIGURATION_MISSING", reason: capability.reason }, 503);
  }

  let claim: ClaimResult;
  try {
    claim = await db.transaction(async (tx): Promise<ClaimResult> => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
      const [scan] = await tx.select().from(scanUploads).where(and(
        eq(scanUploads.id, id),
        eq(scanUploads.tenantId, authorization.data.tenantId),
        eq(scanUploads.recordKind, "capture_scan"),
      )).limit(1).for("update");
      if (!scan) return { kind: "blocked", code: "NOT_FOUND", status: 404 };
      if (!isConfirmedCaptureReceipt(scan, authorization.data.tenantId)) {
        return { kind: "blocked", code: "ORIGINAL_RECEIPT_INVALID", status: 409 };
      }
      if (scan.status === "processed") {
        return {
          kind: "processed",
          id: scan.id,
          digest: scan.contentSha256!,
          bytes: scan.fileSizeBytes!,
        };
      }

      if (scan.status === "processing") {
        const stale = scan.processingClaimedAt
          && scan.processingClaimedAt.getTime() < Date.now() - STALE_PROCESSING_MS;
        if (!stale) return { kind: "blocked", code: "IN_PROGRESS", status: 409 };
        if (scan.processingAttemptCount < 1 || scan.processingAttemptCount > MAX_SCAN_PROCESSING_ATTEMPTS) {
          return { kind: "blocked", code: "OCR_REVIEW_REQUIRED", status: 409 };
        }
        const [reclaimed] = await tx.update(scanUploads).set({
          processingClaimedAt: new Date(),
          lastProcessingError: "STALE_PROCESSING_CLAIM",
        }).where(and(
          eq(scanUploads.id, scan.id),
          eq(scanUploads.tenantId, authorization.data.tenantId),
          eq(scanUploads.recordKind, "capture_scan"),
          eq(scanUploads.status, "processing"),
          eq(scanUploads.processingAttemptCount, scan.processingAttemptCount),
        )).returning({ id: scanUploads.id });
        if (!reclaimed) return { kind: "blocked", code: "IN_PROGRESS", status: 409 };
        return {
          kind: "claimed",
          id: scan.id,
          path: scan.fileUrl,
          mimeType: scan.fileType!,
          digest: scan.contentSha256!,
          bytes: scan.fileSizeBytes!,
          attempt: scan.processingAttemptCount,
          uploadedBy: scan.uploadedBy!,
        };
      }

      if (scan.status !== "secured") {
        const code = scan.status === "storage_unconfirmed"
          ? "ORIGINAL_CONFIRMATION_PENDING"
          : scan.status === "integrity_error"
            ? "ORIGINAL_INTEGRITY_ERROR"
            : scan.status === "review_required"
              ? "OCR_REVIEW_REQUIRED"
            : "SCAN_STATE_CONFLICT";
        return { kind: "blocked", code, status: 409 };
      }
      if (scan.processingAttemptCount >= MAX_SCAN_PROCESSING_ATTEMPTS) {
        return { kind: "blocked", code: "OCR_REVIEW_REQUIRED", status: 409 };
      }

      const attempt = scan.processingAttemptCount + 1;
      const [claimed] = await tx.update(scanUploads).set({
        status: "processing",
        processingAttemptCount: attempt,
        processingClaimedAt: new Date(),
        lastProcessingError: null,
      }).where(and(
        eq(scanUploads.id, scan.id),
        eq(scanUploads.tenantId, authorization.data.tenantId),
        eq(scanUploads.recordKind, "capture_scan"),
        eq(scanUploads.status, "secured"),
        eq(scanUploads.processingAttemptCount, scan.processingAttemptCount),
      )).returning({ id: scanUploads.id });
      if (!claimed) return { kind: "blocked", code: "IN_PROGRESS", status: 409 };
      return {
        kind: "claimed",
        id: scan.id,
        path: scan.fileUrl,
        mimeType: scan.fileType!,
        digest: scan.contentSha256!,
        bytes: scan.fileSizeBytes!,
        attempt,
        uploadedBy: scan.uploadedBy!,
      };
    });
  } catch (error) {
    console.error("Scan OCR claim failed", error);
    return response({ ok: false, code: "SCAN_PROCESS_UNAVAILABLE" }, 503);
  }

  if (claim.kind === "processed") {
    return response({
      ok: true,
      id: claim.id,
      status: "processed",
      contentSha256: claim.digest,
      fileSizeBytes: claim.bytes,
      replayed: true,
    });
  }
  if (claim.kind === "blocked") return response({ ok: false, code: claim.code }, claim.status);

  const identity = {
    tenantId: authorization.data.tenantId,
    // The durable request belongs to the original uploader. Using that actor
    // keeps the ledger identity stable when another authorized colleague
    // recovers the same scan after a lost response.
    userId: claim.uploadedBy,
  };
  let admission: Awaited<ReturnType<typeof reserveDirectAiUsage>>;
  try {
    admission = await reserveDirectAiUsage({
      identity,
      feature: "receipt-ocr",
      payload: {
        scanId: claim.id,
        attempt: claim.attempt,
        digest: claim.digest,
        mimeType: claim.mimeType,
        byteLength: claim.bytes,
      },
      maxOutputTokens: 4_096,
      // A byte-derived floor accounts conservatively for image tiles and PDF
      // pages instead of pricing only the tiny metadata envelope.
      minimumInputUnits: Math.ceil(claim.bytes / 256),
      idempotencyKey: `scan-ocr:${claim.id}:${claim.attempt}`,
    });
  } catch (error) {
    console.error("Scan OCR usage reservation failed", error);
    const settled = await settleClaim(
      claim.id,
      authorization.data.tenantId,
      claim.attempt,
      "secured",
      "OCR_USAGE_RESERVATION_UNAVAILABLE",
      true,
    );
    if (!settled) return response({ ok: false, code: "OCR_SETTLEMENT_UNCERTAIN" }, 409);
    return response({ ok: false, code: "OCR_USAGE_RESERVATION_UNAVAILABLE" }, 503);
  }

  if (admission.kind === "rejected") {
    const quotaRejected = [
      "user_window",
      "tenant_window",
      "user_daily_units",
      "tenant_daily_units",
    ].includes(admission.reason);
    if (admission.reason === "in_progress") {
      return response({
        ok: false,
        code: "OCR_IN_PROGRESS",
        retryAfterSeconds: Math.max(
          admission.retryAfterSeconds,
          Math.ceil(STALE_PROCESSING_MS / 1_000),
        ),
      }, 409);
    }
    const settled = await settleClaim(
      claim.id,
      authorization.data.tenantId,
      claim.attempt,
      quotaRejected ? "secured" : "review_required",
      quotaRejected ? "OCR_USAGE_LIMIT_REACHED" : "OCR_PROVIDER_OUTCOME_REQUIRES_REVIEW",
      quotaRejected,
    );
    if (!settled) return response({ ok: false, code: "OCR_SETTLEMENT_UNCERTAIN" }, 409);
    if (quotaRejected) {
      return response({
        ok: false,
        code: "OCR_USAGE_LIMIT_REACHED",
        retryAfterSeconds: admission.retryAfterSeconds,
      }, 429);
    }
    return response({
      ok: false,
      code: "OCR_REVIEW_REQUIRED",
    }, 409);
  }

  let buffer: Buffer;
  try {
    const { data, error } = await storageClient().storage.from("scans").download(claim.path);
    if (error || !data) throw new Error("ORIGINAL_READ_UNCONFIRMED");
    buffer = Buffer.from(await data.arrayBuffer());
  } catch (error) {
    console.error("Scan original read could not be confirmed", error);
    if (!await settleUnusedAiAdmission(admission, identity, "preflight-storage-unavailable")) {
      return response({ ok: false, code: "OCR_SETTLEMENT_UNCERTAIN" }, 409);
    }
    const settled = await settleClaim(
      claim.id,
      authorization.data.tenantId,
      claim.attempt,
      "secured",
      "ORIGINAL_READ_UNCONFIRMED",
      admission.kind === "replay",
    );
    if (!settled) return response({ ok: false, code: "OCR_SETTLEMENT_UNCERTAIN" }, 409);
    return response({ ok: false, code: "ORIGINAL_READ_UNCONFIRMED" }, 503);
  }

  const digestMatches = buffer.length === claim.bytes
    && createHash("sha256").update(buffer).digest("hex") === claim.digest;
  if (!digestMatches || !hasDeclaredScanSignature(buffer, claim.mimeType)) {
    if (!await settleUnusedAiAdmission(admission, identity, "preflight-integrity-mismatch")) {
      return response({ ok: false, code: "OCR_SETTLEMENT_UNCERTAIN" }, 409);
    }
    const settled = await settleClaim(
      claim.id,
      authorization.data.tenantId,
      claim.attempt,
      "integrity_error",
      "ORIGINAL_DIGEST_OR_SIGNATURE_MISMATCH",
      false,
    );
    if (!settled) return response({ ok: false, code: "OCR_SETTLEMENT_UNCERTAIN" }, 409);
    return response({ ok: false, code: "ORIGINAL_DIGEST_OR_SIGNATURE_MISMATCH" }, 409);
  }

  let extractedData: Awaited<ReturnType<typeof extractDocumentDataWithUsage>>["result"];
  const usageReplay = admission.kind === "replay";
  if (admission.kind === "replay") {
    try {
      extractedData = parseOcrResponse(JSON.stringify(admission.result));
    } catch (error) {
      console.error("Scan OCR usage replay was invalid", error);
      const settled = await settleClaim(
        claim.id,
        authorization.data.tenantId,
        claim.attempt,
        "secured",
        "OCR_USAGE_REPLAY_INVALID",
        false,
      );
      if (!settled) return response({ ok: false, code: "OCR_SETTLEMENT_UNCERTAIN" }, 409);
      return response({ ok: false, code: "OCR_RETRY_AVAILABLE" }, 409);
    }
  } else {
    try {
      await claimDirectAiUsage({
        reservationId: admission.reservationId,
        identity,
        feature: "receipt-ocr",
      });
    } catch (error) {
      console.error("Scan OCR usage claim failed", error);
      const settled = await settleClaim(
        claim.id,
        authorization.data.tenantId,
        claim.attempt,
        "secured",
        "OCR_USAGE_CLAIM_UNAVAILABLE",
        true,
      );
      if (!settled) return response({ ok: false, code: "OCR_SETTLEMENT_UNCERTAIN" }, 409);
      return response({ ok: false, code: "OCR_USAGE_CLAIM_UNAVAILABLE" }, 503);
    }

    let extraction: Awaited<ReturnType<typeof extractDocumentDataWithUsage>>;
    try {
      extraction = await extractDocumentDataWithUsage(buffer.toString("base64"), claim.mimeType);
      extractedData = extraction.result;
    } catch (error) {
      console.error("Scan OCR processing failed", error);
      if (error instanceof OcrResponseError) {
        try {
          await settleDirectAiUsage({
            reservationId: admission.reservationId,
            identity,
            feature: "receipt-ocr",
            outcome: "failed",
            actualUnits: error.actualUnits,
            providerStatus: error.providerStatus,
          });
        } catch (settlementError) {
          console.error("Invalid OCR response usage settlement was uncertain", settlementError);
          return response({ ok: false, code: "OCR_SETTLEMENT_UNCERTAIN" }, 409);
        }
        const settled = await settleClaim(
          claim.id,
          authorization.data.tenantId,
          claim.attempt,
          claim.attempt >= MAX_SCAN_PROCESSING_ATTEMPTS ? "review_required" : "secured",
          "OCR_INVALID_PROVIDER_RESPONSE",
        );
        if (!settled) return response({ ok: false, code: "OCR_SETTLEMENT_UNCERTAIN" }, 409);
        return response({
          ok: false,
          code: claim.attempt >= MAX_SCAN_PROCESSING_ATTEMPTS
            ? "OCR_REVIEW_REQUIRED"
            : "OCR_RETRY_AVAILABLE",
        }, 422);
      }
      try {
        await settleDirectAiUsage({
          reservationId: admission.reservationId,
          identity,
          feature: "receipt-ocr",
          outcome: "uncertain",
          actualUnits: null,
          providerStatus: "gemini-error",
        });
      } catch (settlementError) {
        console.error("Scan OCR failure usage settlement was uncertain", settlementError);
        return response({ ok: false, code: "OCR_SETTLEMENT_UNCERTAIN" }, 409);
      }
      const settled = await settleClaim(
        claim.id,
        authorization.data.tenantId,
        claim.attempt,
        "review_required",
        "OCR_PROVIDER_OUTCOME_REQUIRES_REVIEW",
      );
      if (!settled) return response({ ok: false, code: "OCR_SETTLEMENT_UNCERTAIN" }, 409);
      return response({ ok: false, code: "OCR_REVIEW_REQUIRED" }, 409);
    }

    try {
      await settleDirectAiUsage({
        reservationId: admission.reservationId,
        identity,
        feature: "receipt-ocr",
        outcome: "succeeded",
        actualUnits: extraction.actualUnits,
        providerStatus: extraction.providerStatus,
        result: { ...extractedData },
      });
    } catch (error) {
      console.error("Scan OCR success usage settlement failed", error);
      // Keep the scan claim on the same logical attempt. A retry can only
      // replay or reclaim this ledger key; it must not start a second provider
      // call while settlement is unknown.
      return response({ ok: false, code: "OCR_USAGE_SETTLEMENT_UNCERTAIN" }, 409);
    }
  }

  try {
    const [settled] = await db.update(scanUploads).set({
      status: "processed",
      extractedData,
      processingClaimedAt: null,
      lastProcessingError: null,
    }).where(and(
      eq(scanUploads.id, claim.id),
      eq(scanUploads.tenantId, authorization.data.tenantId),
      eq(scanUploads.recordKind, "capture_scan"),
      eq(scanUploads.status, "processing"),
      eq(scanUploads.processingAttemptCount, claim.attempt),
    )).returning({ id: scanUploads.id, status: scanUploads.status });
    if (!settled || settled.status !== "processed") {
      return response({ ok: false, code: "OCR_SETTLEMENT_UNCERTAIN" }, 409);
    }
    return response({
      ok: true,
      id: settled.id,
      status: settled.status,
      contentSha256: claim.digest,
      fileSizeBytes: claim.bytes,
      replayed: usageReplay,
    });
  } catch (error) {
    console.error("Scan OCR success settlement failed", error);
    return response({ ok: false, code: "OCR_SETTLEMENT_UNCERTAIN" }, 409);
  }
}
