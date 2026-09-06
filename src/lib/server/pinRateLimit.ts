import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export type PinAttemptResult =
  | { status: "valid" }
  | { status: "invalid" }
  | {
      status: "blocked";
      retryAfterMinutes?: number;
      locked?: boolean;
    };

type PinRateLimitRow = {
  failed_attempts: number;
  last_failed_at: Date | string;
};

function blockedResult(row: PinRateLimitRow): PinAttemptResult | null {
  const lastFail = new Date(row.last_failed_at);
  const diffMinutes = (Date.now() - lastFail.getTime()) / 60_000;

  if (row.failed_attempts >= 20) {
    return { status: "blocked", locked: true };
  }
  if (row.failed_attempts >= 10 && diffMinutes < 60) {
    return {
      status: "blocked",
      retryAfterMinutes: Math.ceil(60 - diffMinutes),
    };
  }
  if (row.failed_attempts >= 5 && diffMinutes < 15) {
    return {
      status: "blocked",
      retryAfterMinutes: Math.ceil(15 - diffMinutes),
    };
  }

  return null;
}

/**
 * Serialisiert Prüfung, PIN-Vergleich und Zähleränderung je Operator.
 * Der Advisory-Lock deckt auch den Fall ab, in dem noch keine Zählerzeile
 * existiert; parallele Erstversuche können die Sperrprüfung daher nicht mehr
 * gleichzeitig passieren.
 */
export async function runPinAttempt(
  operatorId: string,
  verifyPin: () => Promise<boolean>,
): Promise<PinAttemptResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${operatorId}::text, 0))
    `);

    const [row] = await tx.execute<PinRateLimitRow>(sql`
      SELECT failed_attempts, last_failed_at
      FROM pin_rate_limits
      WHERE operator_id = ${operatorId}
    `);

    if (row) {
      const blocked = blockedResult(row);
      if (blocked) return blocked;
    }

    const pinValid = await verifyPin();

    if (pinValid) {
      await tx.execute(sql`
        DELETE FROM pin_rate_limits
        WHERE operator_id = ${operatorId}
      `);
      return { status: "valid" };
    }

    await tx.execute(sql`
      INSERT INTO pin_rate_limits (
        operator_id,
        failed_attempts,
        last_failed_at,
        tenant_id
      )
      VALUES (${operatorId}, 1, now(), ${KREILE_TENANT_SLUG})
      ON CONFLICT (operator_id)
      DO UPDATE SET
        failed_attempts = pin_rate_limits.failed_attempts + 1,
        last_failed_at = now()
    `);

    return { status: "invalid" };
  });
}
