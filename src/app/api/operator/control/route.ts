import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { operatorControlEvents, tenantOperatorControls } from "@/db/schema_operator";
import {
  canonicalizeOperatorControlPolicy,
  parseOperatorControlEnvelope,
  verifyOperatorControlSignature,
} from "@/lib/operator/controlContract";
import { consumeDurableRateLimit } from "@/lib/server/durableRateLimit";
import { readUtf8BodyWithinLimit } from "@/lib/server/boundedRequestBody";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 16 * 1024;

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function authenticateIngress(request: Request): "ready" | "configuration_missing" | "unauthorized" {
  const expected = process.env.OPERATOR_CONTROL_INGEST_SECRET?.trim();
  if (!expected || expected.length < 32) return "configuration_missing";
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ") || header.length > 520) return "unauthorized";
  const provided = header.slice("Bearer ".length);
  if (!provided || !timingSafeEqual(sha256(provided), sha256(expected))) return "unauthorized";
  return "ready";
}

export async function POST(request: Request) {
  const ingress = authenticateIngress(request);
  if (ingress === "configuration_missing") return response({ ok: false, code: "CONFIGURATION_MISSING" }, 503);
  if (ingress !== "ready") return response({ ok: false, code: "UNAUTHORIZED" }, 401);

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return response({ ok: false, code: "INVALID_REQUEST" }, 415);
  }
  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > MAX_BODY_BYTES) {
    return response({ ok: false, code: "INVALID_REQUEST" }, 400);
  }

  try {
    const rateLimit = await consumeDurableRateLimit({
      namespace: "operator-control",
      subject: "galvanik-kreile-ingress",
      limit: 60,
      windowSeconds: 60,
    });
    if (!rateLimit.allowed) {
      return response({ ok: false, code: "RATE_LIMITED", retryAfterSeconds: rateLimit.retryAfterSeconds }, 429);
    }
  } catch {
    return response({ ok: false, code: "RATE_LIMIT_UNAVAILABLE" }, 503);
  }

  let rawBody: string;
  let envelope: ReturnType<typeof parseOperatorControlEnvelope>;
  try {
    rawBody = await readUtf8BodyWithinLimit(request, MAX_BODY_BYTES);
    envelope = parseOperatorControlEnvelope(JSON.parse(rawBody));
  } catch {
    return response({ ok: false, code: "INVALID_REQUEST" }, 400);
  }

  const publicKey = process.env.OPERATOR_CONTROL_PUBLIC_KEY_PEM?.trim();
  if (!publicKey) return response({ ok: false, code: "CONFIGURATION_MISSING" }, 503);
  try {
    if (!verifyOperatorControlSignature(envelope.policy, envelope.signature, publicKey)) {
      return response({ ok: false, code: "INVALID_SIGNATURE" }, 401);
    }
  } catch {
    return response({ ok: false, code: "CONFIGURATION_INVALID" }, 503);
  }

  const canonicalPayload = canonicalizeOperatorControlPolicy(envelope.policy);
  const requestDigest = createHash("sha256")
    .update(canonicalPayload, "utf8")
    .update("\0", "utf8")
    .update(envelope.signature, "utf8")
    .digest("hex");
  const policy = envelope.policy;
  const timestamps = {
    effectiveAt: new Date(policy.effectiveAt),
    expiresAt: policy.expiresAt ? new Date(policy.expiresAt) : null,
    issuedAt: new Date(policy.issuedAt),
  };

  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${policy.tenantId}, 0))`);
      const currentRows = await tx
        .select()
        .from(tenantOperatorControls)
        .where(eq(tenantOperatorControls.tenantId, policy.tenantId))
        .for("update");
      const current = currentRows[0];

      if (current && Number(current.policyVersion) > policy.policyVersion) return { kind: "stale" as const };
      if (current && Number(current.policyVersion) === policy.policyVersion) {
        const replayed =
          current.canonicalPayload === canonicalPayload &&
          current.signature === envelope.signature &&
          current.requestDigest === requestDigest;
        return { kind: replayed ? "replayed" as const : "conflict" as const };
      }

      const auditRows = await tx.insert(operatorControlEvents).values({
        tenantId: policy.tenantId,
        policyVersion: policy.policyVersion,
        plan: policy.plan,
        mode: policy.mode,
        reason: policy.reason,
        notice: policy.notice,
        ...timestamps,
        canonicalPayload,
        signature: envelope.signature,
        requestDigest,
      }).returning({ id: operatorControlEvents.id });
      if (auditRows.length !== 1) throw new Error("OPERATOR_CONTROL_AUDIT_RECEIPT_MISSING");

      const controlValues = {
        plan: policy.plan,
        mode: policy.mode,
        reason: policy.reason,
        notice: policy.notice,
        ...timestamps,
        policyVersion: policy.policyVersion,
        canonicalPayload,
        signature: envelope.signature,
        requestDigest,
        receivedAt: new Date(),
        updatedAt: new Date(),
      };
      if (current) {
        const updatedRows = await tx.update(tenantOperatorControls)
          .set(controlValues)
          .where(and(
            eq(tenantOperatorControls.tenantId, policy.tenantId),
            eq(tenantOperatorControls.policyVersion, Number(current.policyVersion)),
          ))
          .returning({ tenantId: tenantOperatorControls.tenantId });
        if (updatedRows.length !== 1) throw new Error("OPERATOR_CONTROL_UPDATE_RECEIPT_MISSING");
      } else {
        const insertedRows = await tx.insert(tenantOperatorControls)
          .values({ tenantId: policy.tenantId, ...controlValues })
          .returning({ tenantId: tenantOperatorControls.tenantId });
        if (insertedRows.length !== 1) throw new Error("OPERATOR_CONTROL_INSERT_RECEIPT_MISSING");
      }
      return { kind: "accepted" as const };
    });

    if (result.kind === "stale") return response({ ok: false, code: "STALE_POLICY_VERSION" }, 409);
    if (result.kind === "conflict") return response({ ok: false, code: "POLICY_VERSION_CONFLICT" }, 409);
    return response({
      ok: true,
      status: result.kind,
      policyVersion: policy.policyVersion,
    });
  } catch {
    return response({ ok: false, code: "OPERATOR_CONTROL_STORAGE_UNAVAILABLE" }, 503);
  }
}
