import { sql } from "drizzle-orm";
import { db } from "@/db";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMinutes?: number;
  locked?: boolean;
}

type PinRateLimitRow = {
  failed_attempts: number;
  last_failed_at: Date | string;
};

export async function checkPinRateLimit(
  operatorId: string,
): Promise<RateLimitResult> {
  const [row] = await db.execute<PinRateLimitRow>(sql`
    SELECT failed_attempts, last_failed_at
    FROM pin_rate_limits
    WHERE operator_id = ${operatorId}
  `);

  if (!row) return { allowed: true };

  const lastFail = new Date(row.last_failed_at);
  const diffMinutes = (Date.now() - lastFail.getTime()) / 60_000;

  if (row.failed_attempts >= 20) return { allowed: false, locked: true };
  if (row.failed_attempts >= 10 && diffMinutes < 60) {
    return {
      allowed: false,
      retryAfterMinutes: Math.ceil(60 - diffMinutes),
    };
  }
  if (row.failed_attempts >= 5 && diffMinutes < 15) {
    return {
      allowed: false,
      retryAfterMinutes: Math.ceil(15 - diffMinutes),
    };
  }

  return { allowed: true };
}

export async function recordFailedPinAttempt(operatorId: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO pin_rate_limits (operator_id, failed_attempts, last_failed_at)
    VALUES (${operatorId}, 1, now())
    ON CONFLICT (operator_id)
    DO UPDATE SET
      failed_attempts = pin_rate_limits.failed_attempts + 1,
      last_failed_at = now()
  `);
}

export async function resetPinRateLimit(operatorId: string): Promise<void> {
  await db.execute(sql`
    DELETE FROM pin_rate_limits
    WHERE operator_id = ${operatorId}
  `);
}
