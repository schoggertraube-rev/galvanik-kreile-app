import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { OrderFreezeCorrectionReceipt } from "@/lib/server/commands/orderFreezeCorrectionCommand";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type OrderFreezeCorrectionReadResult =
  | { code: "OK"; data: OrderFreezeCorrectionReceipt | null }
  | { code: "FORBIDDEN"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

type ReceiptRow = {
  event_id: string;
  tenant_id: string;
  order_id: string;
  client_event_id: string;
  correlation_id: string;
  event_schema_version: number;
  aggregate_version: number;
  from_station: string;
  to_station: string;
  actor_id: string;
  occurred_at: Date | string;
  correction_id: string;
  freeze_id: string;
  corrected_freeze_version: number;
  reason: string;
  corrected_at: Date | string;
  integrity_ok: boolean;
};

function exactInput(value: unknown): value is { orderId: string; clientEventId: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort();
  return keys.length === 2
    && keys[0] === "clientEventId"
    && keys[1] === "orderId"
    && typeof input.orderId === "string"
    && input.orderId === input.orderId.trim()
    && input.orderId.length >= 1
    && input.orderId.length <= 128
    && typeof input.clientEventId === "string"
    && UUID_PATTERN.test(input.clientEventId);
}

function toIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(value as string);
  if (!Number.isFinite(date.getTime())) throw new Error("ORDER_FREEZE_CORRECTION_READ_TIME_INVALID");
  return date.toISOString();
}

function mapReceipt(row: ReceiptRow, tenantId: string): OrderFreezeCorrectionReceipt {
  if (
    row.integrity_ok !== true
    || row.tenant_id !== tenantId
    || row.event_schema_version !== 1
    || row.from_station !== "fertig"
    || row.to_station !== "galvanik"
    || !UUID_PATTERN.test(row.event_id)
    || !UUID_PATTERN.test(row.client_event_id)
    || !UUID_PATTERN.test(row.correlation_id)
    || !UUID_PATTERN.test(row.actor_id)
    || !UUID_PATTERN.test(row.correction_id)
    || !UUID_PATTERN.test(row.freeze_id)
    || !Number.isSafeInteger(row.aggregate_version)
    || !Number.isSafeInteger(row.corrected_freeze_version)
    || row.aggregate_version < 1
    || row.corrected_freeze_version < 1
    || row.reason !== row.reason.trim()
    || row.reason.length < 5
    || row.reason.length > 500
  ) throw new Error("ORDER_FREEZE_CORRECTION_READ_INVALID");
  return {
    eventId: row.event_id,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    eventSchemaVersion: 1,
    orderId: row.order_id,
    aggregateVersion: row.aggregate_version,
    fromStation: "fertig",
    toStation: "galvanik",
    actorId: row.actor_id,
    occurredAt: toIso(row.occurred_at),
    correctionId: row.correction_id,
    freezeId: row.freeze_id,
    correctedFreezeVersion: row.corrected_freeze_version,
    reason: row.reason,
    correctedAt: toIso(row.corrected_at),
  };
}

export async function readOrderFreezeCorrectionReceipt(
  authorization: AuthorizationSnapshot,
  input: { orderId: string; clientEventId: string },
): Promise<OrderFreezeCorrectionReadResult> {
  if (!exactInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Belegabfrage." };
  }
  if (!authorization.permissions.includes("perm_view_leitstand")) {
    return { code: "FORBIDDEN", message: "Korrekturbeleg ist nicht erlaubt." };
  }
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<ReceiptRow>(sql`
        SELECT *
        FROM private.v_order_freeze_correction_receipts_v1
        WHERE order_id = ${input.orderId}
          AND client_event_id = ${input.clientEventId}
        LIMIT 2
      `);
      if (rows.length > 1) throw new Error("ORDER_FREEZE_CORRECTION_READ_AMBIGUOUS");
      return rows[0] ? mapReceipt(rows[0], authorization.tenantId) : null;
    });
    return { code: "OK", data };
  } catch {
    return { code: "UNAVAILABLE", message: "Korrekturbeleg konnte nicht sicher geladen werden." };
  }
}
