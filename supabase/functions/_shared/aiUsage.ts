import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import type { EdgeIdentity } from "./security.ts";

export type AiUsageEnvelope = {
  reservationId: string;
  tenantId: string;
  userId: string;
  feature: string;
};

export type DirectAiAdmission =
  | { kind: "reserved"; reservationId: string }
  | { kind: "replay"; result: Record<string, unknown> }
  | { kind: "rejected"; retryAfterSeconds: number };

type ReservationRow = {
  allowed: boolean;
  reservation_id: string | null;
  replay: boolean;
  replay_result: unknown;
  retry_after_seconds: number | string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FEATURE_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
export function exactObject(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> {
  if (!isObject(value) || Object.keys(value).some((key) => !allowedKeys.includes(key))) {
    throw new Error("INVALID_AI_REQUEST");
  }
  return value;
}

export function requiredText(value: unknown, maximum: number): string {
  if (typeof value !== "string") throw new Error("INVALID_AI_REQUEST");
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) throw new Error("INVALID_AI_REQUEST");
  return normalized;
}

export function optionalText(value: unknown, maximum: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  return requiredText(value, maximum);
}

export function parseInternalAiBody<T>(
  value: unknown,
  expectedFeature: string,
  parseInput: (value: unknown) => T,
): { input: T; usage: AiUsageEnvelope } {
  const body = exactObject(value, ["input", "usage"]);
  const usage = exactObject(body.usage, ["reservationId", "tenantId", "userId", "feature"]);
  if (
    typeof usage.reservationId !== "string" || !UUID_PATTERN.test(usage.reservationId) ||
    usage.tenantId !== "galvanik-kreile" ||
    typeof usage.userId !== "string" || usage.userId.length < 1 || usage.userId.length > 128 ||
    usage.feature !== expectedFeature
  ) {
    throw new Error("INVALID_AI_REQUEST");
  }
  return {
    input: parseInput(body.input),
    usage: {
      reservationId: usage.reservationId,
      tenantId: usage.tenantId,
      userId: usage.userId,
      feature: usage.feature,
    } as AiUsageEnvelope,
  };
}

function client() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) throw new Error("AI_USAGE_MISCONFIGURED");
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function claimAiUsage(usage: AiUsageEnvelope): Promise<boolean> {
  const { data, error } = await client().rpc("claim_ai_usage_reservation", {
    p_reservation_id: usage.reservationId,
    p_tenant_id: usage.tenantId,
    p_user_id: usage.userId,
    p_feature: usage.feature,
  });
  if (error || typeof data !== "boolean") throw new Error("AI_USAGE_CLAIM_UNAVAILABLE");
  return data;
}

export async function settleAiUsage(input: {
  usage: AiUsageEnvelope;
  outcome: "succeeded" | "failed" | "uncertain";
  actualUnits: number | null;
  providerStatus: string;
  result?: Record<string, unknown>;
}): Promise<void> {
  const { data, error } = await client().rpc("settle_ai_usage_reservation", {
    p_reservation_id: input.usage.reservationId,
    p_tenant_id: input.usage.tenantId,
    p_user_id: input.usage.userId,
    p_feature: input.usage.feature,
    p_outcome: input.outcome,
    p_actual_units: input.actualUnits,
    p_provider_status: input.providerStatus.slice(0, 80),
    p_result: input.outcome === "succeeded" ? input.result : null,
  });
  if (error || !Array.isArray(data) || data.length !== 1) {
    throw new Error("AI_USAGE_SETTLEMENT_UNAVAILABLE");
  }
}

function integerSetting(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = Deno.env.get(name);
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

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function reserveDirectAiUsage(input: {
  request: Request;
  identity: EdgeIdentity;
  feature: string;
  payload: Record<string, unknown>;
  maxOutputTokens: number;
}): Promise<DirectAiAdmission> {
  if (!FEATURE_PATTERN.test(input.feature) || input.identity.tenantId !== "galvanik-kreile") {
    throw new Error("INVALID_AI_IDENTITY");
  }
  if (!Number.isSafeInteger(input.maxOutputTokens) || input.maxOutputTokens < 1 || input.maxOutputTokens > 4_096) {
    throw new Error("AI_USAGE_ESTIMATE_INVALID");
  }
  const secret = Deno.env.get("AI_USAGE_HMAC_SECRET");
  if (!secret || new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error("AI_USAGE_MISCONFIGURED");
  }
  const bucketSeconds = integerSetting("AI_IDEMPOTENCY_BUCKET_SECONDS", 300, 60, 3_600);
  const suppliedKey = input.request.headers.get("x-idempotency-key");
  if (suppliedKey !== null && !IDEMPOTENCY_PATTERN.test(suppliedKey)) {
    throw new Error("INVALID_IDEMPOTENCY_KEY");
  }
  const idempotencyPart = suppliedKey ?? `bucket:${Math.floor(Date.now() / (bucketSeconds * 1_000))}`;
  const requestHash = await hmacHex(secret, stableJson({
    tenantId: input.identity.tenantId,
    userId: input.identity.userId,
    feature: input.feature,
    payload: input.payload,
    idempotencyPart,
  }));
  const estimatedUnits = Math.ceil(new TextEncoder().encode(stableJson(input.payload)).byteLength / 3)
    + input.maxOutputTokens;
  if (!Number.isSafeInteger(estimatedUnits) || estimatedUnits < 1 || estimatedUnits > 100_000) {
    throw new Error("AI_USAGE_ESTIMATE_INVALID");
  }
  const { data, error } = await client().rpc("reserve_ai_usage", {
    p_tenant_id: input.identity.tenantId,
    p_user_id: input.identity.userId,
    p_feature: input.feature,
    p_request_key_hash: requestHash,
    p_estimated_units: estimatedUnits,
    p_window_seconds: integerSetting("AI_QUOTA_WINDOW_SECONDS", 60, 10, 3_600),
    p_user_window_limit: integerSetting("AI_QUOTA_USER_REQUESTS_PER_WINDOW", 6, 1, 1_000),
    p_tenant_window_limit: integerSetting("AI_QUOTA_TENANT_REQUESTS_PER_WINDOW", 30, 1, 10_000),
    p_user_daily_unit_limit: integerSetting("AI_QUOTA_USER_DAILY_UNITS", 65_536, 1, 100_000_000),
    p_tenant_daily_unit_limit: integerSetting("AI_QUOTA_TENANT_DAILY_UNITS", 300_000, 1, 1_000_000_000),
  });
  if (error || !Array.isArray(data) || data.length !== 1 || !isObject(data[0])) {
    throw new Error("AI_USAGE_RESERVATION_UNAVAILABLE");
  }
  const row = data[0] as ReservationRow;
  if (row.allowed === true && row.replay === true && isObject(row.replay_result)) {
    return { kind: "replay", result: row.replay_result };
  }
  if (row.allowed === true && row.replay === false && typeof row.reservation_id === "string" && UUID_PATTERN.test(row.reservation_id)) {
    return { kind: "reserved", reservationId: row.reservation_id };
  }
  if (row.allowed === false) {
    const retry = Number(row.retry_after_seconds);
    return {
      kind: "rejected",
      retryAfterSeconds: Number.isSafeInteger(retry) && retry > 0 ? Math.min(retry, 86_400) : 60,
    };
  }
  throw new Error("AI_USAGE_RESERVATION_INVALID");
}
