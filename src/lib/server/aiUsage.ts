import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export type MeteredAiFeature =
  | "customer-enrich"
  | "freetext-extract"
  | "global-search"
  | "inquiry-extract"
  | "notes-extract"
  | "receipt-ocr";

export type AiIdentity = { tenantId: string; userId: string };
type JsonObject = Record<string, unknown>;

type ReservationRow = {
  allowed: boolean;
  reservation_id: string | null;
  replay: boolean;
  usage_status: string;
  replay_result: unknown;
  retry_after_seconds: number | string | null;
  decision_reason: string;
};

export type AiUsageAdmission =
  | { kind: "reserved"; reservationId: string }
  | { kind: "replay"; result: JsonObject }
  | {
      kind: "rejected";
      retryAfterSeconds: number;
      reason: AiUsageRejectionReason;
      usageStatus: string;
      reservationId: string | null;
    };

export type AiUsageRejectionReason =
  | "user_window"
  | "tenant_window"
  | "user_daily_units"
  | "tenant_daily_units"
  | "in_progress"
  | "prior_attempt_terminal"
  | "result_expired";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const AI_USAGE_REJECTION_REASONS = new Set<AiUsageRejectionReason>([
  "user_window",
  "tenant_window",
  "user_daily_units",
  "tenant_daily_units",
  "in_progress",
  "prior_attempt_terminal",
  "result_expired",
]);

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function integerSetting(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function configuration() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hmacSecret = process.env.AI_USAGE_HMAC_SECRET;
  if (!url || !serviceRoleKey || !hmacSecret || Buffer.byteLength(hmacSecret, "utf8") < 32) {
    throw new Error("AI_USAGE_MISCONFIGURED");
  }
  return {
    url,
    serviceRoleKey,
    hmacSecret,
    windowSeconds: integerSetting("AI_QUOTA_WINDOW_SECONDS", 60, 10, 3_600),
    userWindowLimit: integerSetting("AI_QUOTA_USER_REQUESTS_PER_WINDOW", 6, 1, 1_000),
    tenantWindowLimit: integerSetting("AI_QUOTA_TENANT_REQUESTS_PER_WINDOW", 30, 1, 10_000),
    // Covers the declared 14 MiB OCR maximum (57,344 conservative input
    // units + 4,096 output units) for a fresh user without a quota white wall.
    userDailyUnits: integerSetting("AI_QUOTA_USER_DAILY_UNITS", 65_536, 1, 100_000_000),
    tenantDailyUnits: integerSetting("AI_QUOTA_TENANT_DAILY_UNITS", 300_000, 1, 1_000_000_000),
    bucketSeconds: integerSetting("AI_IDEMPOTENCY_BUCKET_SECONDS", 300, 60, 3_600),
  };
}

function requestKeyHash(
  request: Request,
  identity: AiIdentity,
  feature: MeteredAiFeature,
  input: JsonObject,
  hmacSecret: string,
  bucketSeconds: number,
): string {
  const supplied = request.headers.get("x-idempotency-key");
  if (supplied !== null && !IDEMPOTENCY_PATTERN.test(supplied)) {
    throw new Error("INVALID_IDEMPOTENCY_KEY");
  }
  const idempotencyPart = supplied ?? `bucket:${Math.floor(Date.now() / (bucketSeconds * 1_000))}`;
  return createHmac("sha256", hmacSecret)
    .update(stableJson({
      tenantId: identity.tenantId,
      userId: identity.userId,
      feature,
      input,
      idempotencyPart,
    }), "utf8")
    .digest("hex");
}

function estimatedUnits(input: JsonObject, maxOutputTokens: number, minimumInputUnits = 0): number {
  if (
    !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 4_096
    || !Number.isSafeInteger(minimumInputUnits) || minimumInputUnits < 0 || minimumInputUnits > 100_000
  ) throw new Error("AI_USAGE_ESTIMATE_INVALID");
  const inputUnits = Math.ceil(Buffer.byteLength(stableJson(input), "utf8") / 3);
  const total = Math.max(inputUnits, minimumInputUnits) + maxOutputTokens;
  if (!Number.isSafeInteger(total) || total < 1 || total > 100_000) {
    throw new Error("AI_USAGE_ESTIMATE_INVALID");
  }
  return total;
}

async function reserve(
  request: Request,
  identity: AiIdentity,
  feature: MeteredAiFeature,
  input: JsonObject,
  maxOutputTokens: number,
  minimumInputUnits = 0,
): Promise<{ admission: AiUsageAdmission; url: string; serviceRoleKey: string }> {
  const config = configuration();
  if (identity.tenantId !== "galvanik-kreile" || !identity.userId || identity.userId.length > 128) {
    throw new Error("INVALID_AI_IDENTITY");
  }
  const client = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("reserve_ai_usage", {
    p_tenant_id: identity.tenantId,
    p_user_id: identity.userId,
    p_feature: feature,
    p_request_key_hash: requestKeyHash(
      request,
      identity,
      feature,
      input,
      config.hmacSecret,
      config.bucketSeconds,
    ),
    p_estimated_units: estimatedUnits(input, maxOutputTokens, minimumInputUnits),
    p_window_seconds: config.windowSeconds,
    p_user_window_limit: config.userWindowLimit,
    p_tenant_window_limit: config.tenantWindowLimit,
    p_user_daily_unit_limit: config.userDailyUnits,
    p_tenant_daily_unit_limit: config.tenantDailyUnits,
  });
  if (error || !Array.isArray(data) || data.length !== 1 || !isObject(data[0])) {
    throw new Error("AI_USAGE_RESERVATION_UNAVAILABLE");
  }
  const row = data[0] as ReservationRow;
  if (row.allowed === true && row.replay === true && isObject(row.replay_result)) {
    return { admission: { kind: "replay", result: row.replay_result }, ...config };
  }
  if (row.allowed === true && row.replay === false && typeof row.reservation_id === "string" && UUID_PATTERN.test(row.reservation_id)) {
    return { admission: { kind: "reserved", reservationId: row.reservation_id }, ...config };
  }
  if (row.allowed === false) {
    if (!AI_USAGE_REJECTION_REASONS.has(row.decision_reason as AiUsageRejectionReason)) {
      throw new Error("AI_USAGE_RESERVATION_INVALID");
    }
    const parsedRetry = Number(row.retry_after_seconds);
    return {
      admission: {
        kind: "rejected",
        retryAfterSeconds: Number.isSafeInteger(parsedRetry) && parsedRetry >= 0
          ? Math.min(parsedRetry, 86_400)
          : config.windowSeconds,
        reason: row.decision_reason as AiUsageRejectionReason,
        usageStatus: typeof row.usage_status === "string" ? row.usage_status : "unknown",
        reservationId: typeof row.reservation_id === "string" && UUID_PATTERN.test(row.reservation_id)
          ? row.reservation_id
          : null,
      },
      ...config,
    };
  }
  throw new Error("AI_USAGE_RESERVATION_INVALID");
}

export async function reserveDirectAiUsage(input: {
  identity: AiIdentity;
  feature: MeteredAiFeature;
  payload: JsonObject;
  maxOutputTokens: number;
  idempotencyKey?: string;
  minimumInputUnits?: number;
}): Promise<AiUsageAdmission> {
  if (
    input.minimumInputUnits !== undefined
    && (!Number.isSafeInteger(input.minimumInputUnits) || input.minimumInputUnits < 0 || input.minimumInputUnits > 100_000)
  ) throw new Error("AI_USAGE_ESTIMATE_INVALID");
  const request = new Request("http://localhost/internal-ai-usage", {
    method: "POST",
    headers: {
      "Cache-Control": "no-store",
      ...(input.idempotencyKey ? { "x-idempotency-key": input.idempotencyKey } : {}),
    },
  });
  const result = await reserve(
    request,
    input.identity,
    input.feature,
    input.payload,
    input.maxOutputTokens,
    input.minimumInputUnits,
  );
  return result.admission;
}

export async function claimDirectAiUsage(input: {
  reservationId: string;
  identity: AiIdentity;
  feature: MeteredAiFeature;
}): Promise<void> {
  if (!UUID_PATTERN.test(input.reservationId)) throw new Error("AI_USAGE_CLAIM_INVALID");
  const config = configuration();
  const client = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("claim_ai_usage_reservation", {
    p_reservation_id: input.reservationId,
    p_tenant_id: input.identity.tenantId,
    p_user_id: input.identity.userId,
    p_feature: input.feature,
  });
  if (error || data !== true) throw new Error("AI_USAGE_CLAIM_UNAVAILABLE");
}

export async function settleDirectAiUsage(input: {
  reservationId: string;
  identity: AiIdentity;
  feature: MeteredAiFeature;
  outcome: "succeeded" | "failed" | "uncertain";
  actualUnits: number | null;
  providerStatus: string;
  result?: JsonObject;
}): Promise<void> {
  if (
    !UUID_PATTERN.test(input.reservationId)
    || (input.actualUnits !== null && (!Number.isSafeInteger(input.actualUnits) || input.actualUnits < 0))
    || !input.providerStatus
    || input.providerStatus.length > 80
    || (input.outcome === "succeeded" && !input.result)
    || (input.outcome !== "succeeded" && input.result !== undefined)
  ) {
    throw new Error("AI_USAGE_SETTLEMENT_INVALID");
  }
  const config = configuration();
  const client = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("settle_ai_usage_reservation", {
    p_reservation_id: input.reservationId,
    p_tenant_id: input.identity.tenantId,
    p_user_id: input.identity.userId,
    p_feature: input.feature,
    p_outcome: input.outcome,
    p_actual_units: input.actualUnits,
    p_provider_status: input.providerStatus,
    p_result: input.result ?? null,
  });
  if (error || !Array.isArray(data) || data.length !== 1 || !isObject(data[0])) {
    throw new Error("AI_USAGE_SETTLEMENT_UNAVAILABLE");
  }
  const row = data[0];
  if (row.changed !== true && row.usage_status !== input.outcome) {
    throw new Error("AI_USAGE_SETTLEMENT_REJECTED");
  }
}

export async function proxyMeteredAiRequest(input: {
  request: Request;
  identity: AiIdentity;
  feature: MeteredAiFeature;
  payload: JsonObject;
  maxOutputTokens: number;
  parseResult?: (value: unknown) => JsonObject;
}): Promise<NextResponse> {
  try {
    const reserved = await reserve(
      input.request,
      input.identity,
      input.feature,
      input.payload,
      input.maxOutputTokens,
    );
    if (reserved.admission.kind === "replay") {
      let replayResult = reserved.admission.result;
      try {
        replayResult = input.parseResult ? input.parseResult(replayResult) : replayResult;
      } catch {
        throw new Error("AI_REPLAY_RESULT_INVALID");
      }
      return NextResponse.json(replayResult, {
        headers: { "Cache-Control": "no-store", "X-AI-Replay": "1" },
      });
    }
    if (reserved.admission.kind === "rejected") {
      const quotaRejected = [
        "user_window",
        "tenant_window",
        "user_daily_units",
        "tenant_daily_units",
      ].includes(reserved.admission.reason);
      return NextResponse.json({
        error: quotaRejected ? "AI usage limit reached" : "AI request state conflict",
        code: reserved.admission.reason,
      }, {
        status: quotaRejected ? 429 : 409,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(reserved.admission.retryAfterSeconds),
        },
      });
    }

    const response = await fetch(`${reserved.url}/functions/v1/${input.feature}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${reserved.serviceRoleKey}`,
      },
      body: JSON.stringify({
        input: input.payload,
        usage: {
          reservationId: reserved.admission.reservationId,
          tenantId: input.identity.tenantId,
          userId: input.identity.userId,
          feature: input.feature,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    const text = await response.text();
    if (text.length > 262_144) throw new Error("AI_RESPONSE_TOO_LARGE");
    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error("AI_RESPONSE_INVALID");
    }
    if (!response.ok || !isObject(result)) {
      return NextResponse.json({ error: "AI service temporarily unavailable" }, {
        status: response.status === 429 ? 429 : 503,
        headers: { "Cache-Control": "no-store" },
      });
    }
    try {
      result = input.parseResult ? input.parseResult(result) : result;
    } catch {
      throw new Error("AI_RESULT_INVALID");
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "AI_PROXY_ERROR";
    if (code === "INVALID_IDEMPOTENCY_KEY") {
      return NextResponse.json({ error: "Invalid idempotency key" }, { status: 400 });
    }
    console.error("Metered AI proxy unavailable", code);
    return NextResponse.json({ error: "AI service temporarily unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
