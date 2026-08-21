import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { FrozenExtraWorkLine, OrderFrozenReceipt } from "@/lib/server/commands/orderFreezeCommand";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type OrderFrozenReceiptReadResult =
  | { code: "OK"; data: OrderFrozenReceipt | null }
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
  freeze_id: string;
  rate_id: string;
  hourly_rate_cents: number;
  total_amount_cents: number | string;
  line_count: number;
  frozen_at: Date | string;
  lines: unknown;
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
    && input.orderId.trim() === input.orderId
    && input.orderId.length >= 1
    && input.orderId.length <= 128
    && typeof input.clientEventId === "string"
    && UUID_PATTERN.test(input.clientEventId);
}

function toIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(value as string);
  if (!Number.isFinite(date.getTime())) throw new Error("ORDER_FROZEN_READ_TIME_INVALID");
  return date.toISOString();
}

function integer(value: unknown, error: string): number {
  const result = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(result)) throw new Error(error);
  return result;
}

function mapLines(value: unknown, expectedRate: number): FrozenExtraWorkLine[] {
  if (!Array.isArray(value)) throw new Error("ORDER_FROZEN_READ_LINES_INVALID");
  return value.map((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error("ORDER_FROZEN_READ_LINE_INVALID");
    }
    const line = candidate as Record<string, unknown>;
    const keys = Object.keys(line).sort();
    const expected = [
      "amountCents", "catalogPositionId", "catalogPositionName",
      "hourlyRateCents", "itemId", "minutes",
    ];
    const minutes = integer(line.minutes, "ORDER_FROZEN_READ_LINE_MINUTES_INVALID");
    const rate = integer(line.hourlyRateCents, "ORDER_FROZEN_READ_LINE_RATE_INVALID");
    const amount = integer(line.amountCents, "ORDER_FROZEN_READ_LINE_AMOUNT_INVALID");
    if (
      keys.length !== expected.length
      || !keys.every((key, index) => key === expected[index])
      || typeof line.itemId !== "string"
      || line.itemId.length < 1
      || typeof line.catalogPositionId !== "string"
      || !UUID_PATTERN.test(line.catalogPositionId)
      || typeof line.catalogPositionName !== "string"
      || line.catalogPositionName.trim() !== line.catalogPositionName
      || minutes < 1
      || minutes > 1440
      || rate !== expectedRate
      || amount !== Math.floor((minutes * rate + 30) / 60)
    ) throw new Error("ORDER_FROZEN_READ_LINE_INVALID");
    return {
      itemId: line.itemId,
      catalogPositionId: line.catalogPositionId,
      catalogPositionName: line.catalogPositionName,
      minutes,
      hourlyRateCents: rate,
      amountCents: amount,
    };
  });
}

function mapReceipt(row: ReceiptRow, authorization: AuthorizationSnapshot): OrderFrozenReceipt {
  const rate = integer(row.hourly_rate_cents, "ORDER_FROZEN_READ_RATE_INVALID");
  const aggregateVersion = integer(row.aggregate_version, "ORDER_FROZEN_READ_VERSION_INVALID");
  const total = integer(row.total_amount_cents, "ORDER_FROZEN_READ_TOTAL_INVALID");
  const lineCount = integer(row.line_count, "ORDER_FROZEN_READ_COUNT_INVALID");
  const lines = mapLines(row.lines, rate);
  if (
    row.integrity_ok !== true
    || row.tenant_id !== authorization.tenantId
    || row.event_schema_version !== 1
    || row.from_station !== "galvanik"
    || row.to_station !== "fertig"
    || !UUID_PATTERN.test(row.event_id)
    || !UUID_PATTERN.test(row.client_event_id)
    || !UUID_PATTERN.test(row.correlation_id)
    || !UUID_PATTERN.test(row.freeze_id)
    || !UUID_PATTERN.test(row.rate_id)
    || aggregateVersion < 1
    || rate < 1
    || total < 0
    || lineCount !== lines.length
    || total !== lines.reduce((sum, line) => sum + line.amountCents, 0)
  ) throw new Error("ORDER_FROZEN_READ_RECEIPT_INVALID");
  return {
    eventId: row.event_id,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    eventSchemaVersion: 1,
    orderId: row.order_id,
    aggregateVersion,
    fromStation: "galvanik",
    toStation: "fertig",
    actorId: row.actor_id,
    occurredAt: toIso(row.occurred_at),
    freezeId: row.freeze_id,
    rateId: row.rate_id,
    hourlyRateCents: rate,
    totalAmountCents: total,
    lineCount,
    frozenAt: toIso(row.frozen_at),
    lines,
  };
}

export async function readOrderFrozenReceipt(
  authorization: AuthorizationSnapshot,
  input: { orderId: string; clientEventId: string },
): Promise<OrderFrozenReceiptReadResult> {
  if (!exactInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Belegabfrage." };
  }
  if (!authorization.permissions.includes("perm_view_leitstand")) {
    return { code: "FORBIDDEN", message: "Fertig-Beleg ist nicht erlaubt." };
  }
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<ReceiptRow>(sql`
        SELECT *
        FROM private.v_order_frozen_receipts_v1
        WHERE order_id = ${input.orderId}
          AND client_event_id = ${input.clientEventId}
        LIMIT 2
      `);
      if (rows.length > 1) throw new Error("ORDER_FROZEN_READ_AMBIGUOUS");
      return rows[0] ? mapReceipt(rows[0], authorization) : null;
    });
    return { code: "OK", data };
  } catch {
    return { code: "UNAVAILABLE", message: "Fertig-Beleg konnte nicht sicher geladen werden." };
  }
}
