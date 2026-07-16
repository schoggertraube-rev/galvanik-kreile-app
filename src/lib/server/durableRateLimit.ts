import { createHmac } from "node:crypto";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getSessionSecret } from "@/lib/server/appSessionToken";

const MAX_LIMIT = 100_000;
const MAX_WINDOW_SECONDS = 30 * 24 * 60 * 60;

type ConsumeRateLimitInput = {
  namespace: string;
  subject: string;
  limit: number;
  windowSeconds: number;
  actorId?: string;
  metadata?: Record<string, string | number | boolean>;
};

type ResetRateLimitInput = Pick<
  ConsumeRateLimitInput,
  "namespace" | "subject" | "actorId" | "metadata"
>;

export type DurableRateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; remaining: 0; retryAfterSeconds: number };

type AttemptState = {
  allowed: boolean;
  remaining: number | string;
  retry_after_seconds: number | string | null;
};

function validateIdentifier(value: string, label: string): void {
  if (!/^[a-z0-9._-]{1,80}$/.test(value)) {
    throw new Error(`${label} must match [a-z0-9._-] and contain at most 80 characters`);
  }
}

function validatePolicy(input: ConsumeRateLimitInput): void {
  validateIdentifier(input.namespace, "namespace");
  if (!input.subject || input.subject.length > 500) {
    throw new Error("subject must contain between 1 and 500 characters");
  }
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > MAX_LIMIT) {
    throw new Error(`limit must be an integer between 1 and ${MAX_LIMIT}`);
  }
  if (
    !Number.isInteger(input.windowSeconds) ||
    input.windowSeconds < 1 ||
    input.windowSeconds > MAX_WINDOW_SECONDS
  ) {
    throw new Error(`windowSeconds must be an integer between 1 and ${MAX_WINDOW_SECONDS}`);
  }
}

function recordIdFor(namespace: string, subject: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(`${namespace}\u0000${subject}`, "utf8")
    .digest("hex");
}

/**
 * Consumes one durable attempt before the protected operation runs.
 *
 * The database function locks one counter row, evaluates the window and
 * consumes the attempt in a single transaction. The subject is HMACed so a
 * selector, user ID or source address is never stored as rate-limit state.
 */
export async function consumeDurableRateLimit(
  input: ConsumeRateLimitInput,
): Promise<DurableRateLimitResult> {
  validatePolicy(input);
  const recordId = recordIdFor(input.namespace, input.subject);
  const rows = await db.execute(sql<AttemptState>`
    select allowed, remaining, retry_after_seconds
    from public.consume_security_rate_limit(
      ${input.namespace},
      ${recordId},
      ${input.limit},
      ${input.windowSeconds}
    )
  `);
  const state = rows[0];
  if (!state || typeof state.allowed !== "boolean") {
    throw new Error("durable rate-limit state is missing or invalid");
  }

  const remaining = Number(state.remaining);
  if (!Number.isSafeInteger(remaining) || remaining < 0 || remaining > input.limit) {
    throw new Error("durable rate-limit remaining count is invalid");
  }
  if (state.allowed) return { allowed: true, remaining };

  const parsedRetry = Number(state.retry_after_seconds);
  const retryAfterSeconds = Number.isSafeInteger(parsedRetry) && parsedRetry > 0
    ? parsedRetry
    : input.windowSeconds;
  return { allowed: false, remaining: 0, retryAfterSeconds };
}

/** Atomically resets the counter after a successful protected operation. */
export async function resetDurableRateLimit(input: ResetRateLimitInput): Promise<void> {
  validateIdentifier(input.namespace, "namespace");
  if (!input.subject || input.subject.length > 500) {
    throw new Error("subject must contain between 1 and 500 characters");
  }

  const recordId = recordIdFor(input.namespace, input.subject);
  const rows = await db.execute(sql<{ reset: boolean }>`
    select public.reset_security_rate_limit(${input.namespace}, ${recordId}) as reset
  `);
  if (rows[0]?.reset !== true) {
    throw new Error("durable rate-limit reset failed");
  }
}

export function readRateLimitInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}
