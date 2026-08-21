import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type {
  ExtraWorkCatalogReceipt,
  ExtraWorkHourlyRateReceipt,
} from "@/lib/server/commands/extraWorkAdminCommand";
import type { OrderItemExtraWorkReceipt } from "@/lib/server/commands/orderExtraWorkCommand";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type F13ReceiptReadResult<T> =
  | { code: "OK"; data: T | null }
  | { code: "FORBIDDEN"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

type CommonRow = {
  event_id: string;
  tenant_id: string;
  client_event_id: string;
  correlation_id: string;
  event_schema_version: number;
  aggregate_version: number;
  actor_id: string;
  occurred_at: Date | string;
  integrity_ok: boolean;
};

type CatalogRow = CommonRow & {
  position_id: string;
  name: string;
  standard_minutes: number;
  active: boolean;
};

type RateRow = CommonRow & {
  rate_id: string;
  hourly_rate_cents: number;
};

type LineRow = CommonRow & {
  order_id: string;
  item_id: string;
  line_id: string;
  catalog_position_id: string;
  minutes: number;
  active: boolean;
  line_version: number;
};

function validPair(input: unknown, idKey: string, uuidId: boolean): input is Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  if (
    keys.length !== 2
    || keys[0] !== "clientEventId"
    || keys[1] !== idKey
    || typeof value.clientEventId !== "string"
    || !UUID_PATTERN.test(value.clientEventId)
    || typeof value[idKey] !== "string"
  ) return false;
  const id = value[idKey] as string;
  return uuidId ? UUID_PATTERN.test(id) : id.trim() === id && id.length >= 1 && id.length <= 128;
}

function toIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(value as string);
  if (!Number.isFinite(date.getTime())) throw new Error("F13_RECEIPT_TIME_INVALID");
  return date.toISOString();
}

function validCommon(row: CommonRow, authorization: AuthorizationSnapshot): boolean {
  return row.integrity_ok === true
    && row.tenant_id === authorization.tenantId
    && row.event_schema_version === 1
    && UUID_PATTERN.test(row.event_id)
    && UUID_PATTERN.test(row.client_event_id)
    && UUID_PATTERN.test(row.correlation_id)
    && Number.isSafeInteger(row.aggregate_version)
    && row.aggregate_version > 0
    && row.actor_id === authorization.userId;
}

function canRead(authorization: AuthorizationSnapshot): boolean {
  return authorization.permissions.includes("perm_view_leitstand");
}

export async function readOrderItemExtraWorkReceipt(
  authorization: AuthorizationSnapshot,
  input: { orderId: string; clientEventId: string },
): Promise<F13ReceiptReadResult<OrderItemExtraWorkReceipt>> {
  if (!validPair(input, "orderId", false)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Mehrarbeitsbeleg-Abfrage." };
  }
  if (!canRead(authorization)) return { code: "FORBIDDEN", message: "Mehrarbeitsbeleg ist nicht erlaubt." };
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<LineRow>(sql`
        SELECT * FROM private.v_order_item_extra_work_receipts_v1
        WHERE order_id = ${input.orderId}
          AND client_event_id = ${input.clientEventId}
        LIMIT 2
      `);
      if (rows.length > 1) throw new Error("F13_LINE_RECEIPT_AMBIGUOUS");
      const row = rows[0];
      if (!row) return null;
      if (
        !validCommon(row, authorization)
        || row.order_id !== input.orderId
        || !UUID_PATTERN.test(row.line_id)
        || !UUID_PATTERN.test(row.catalog_position_id)
        || !Number.isSafeInteger(row.minutes)
        || row.minutes < 1
        || row.minutes > 1440
        || !Number.isSafeInteger(row.line_version)
        || row.line_version < 1
      ) throw new Error("F13_LINE_RECEIPT_INVALID");
      return {
        eventId: row.event_id,
        clientEventId: row.client_event_id,
        correlationId: row.correlation_id,
        eventSchemaVersion: 1,
        orderId: row.order_id,
        itemId: row.item_id,
        lineId: row.line_id,
        catalogPositionId: row.catalog_position_id,
        minutes: row.minutes,
        active: row.active,
        lineVersion: row.line_version,
        aggregateVersion: row.aggregate_version,
        actorId: row.actor_id,
        occurredAt: toIso(row.occurred_at),
      } satisfies OrderItemExtraWorkReceipt;
    });
    return { code: "OK", data };
  } catch {
    return { code: "UNAVAILABLE", message: "Mehrarbeitsbeleg konnte nicht sicher geladen werden." };
  }
}

export async function readExtraWorkCatalogReceipt(
  authorization: AuthorizationSnapshot,
  input: { positionId: string; clientEventId: string },
): Promise<F13ReceiptReadResult<ExtraWorkCatalogReceipt>> {
  if (!validPair(input, "positionId", true)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Katalogbeleg-Abfrage." };
  }
  if (!canRead(authorization)) return { code: "FORBIDDEN", message: "Katalogbeleg ist nicht erlaubt." };
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<CatalogRow>(sql`
        SELECT * FROM private.v_extra_work_catalog_receipts_v1
        WHERE position_id = ${input.positionId}
          AND client_event_id = ${input.clientEventId}
        LIMIT 2
      `);
      if (rows.length > 1) throw new Error("F13_CATALOG_RECEIPT_AMBIGUOUS");
      const row = rows[0];
      if (!row) return null;
      if (
        !validCommon(row, authorization)
        || row.position_id !== input.positionId
        || row.name.trim() !== row.name
        || row.name.length < 2
        || row.name.length > 100
        || !Number.isSafeInteger(row.standard_minutes)
        || row.standard_minutes < 1
        || row.standard_minutes > 1440
      ) throw new Error("F13_CATALOG_RECEIPT_INVALID");
      return {
        eventId: row.event_id,
        clientEventId: row.client_event_id,
        correlationId: row.correlation_id,
        eventSchemaVersion: 1,
        positionId: row.position_id,
        aggregateVersion: row.aggregate_version,
        name: row.name,
        standardMinutes: row.standard_minutes,
        active: row.active,
        actorId: row.actor_id,
        occurredAt: toIso(row.occurred_at),
      } satisfies ExtraWorkCatalogReceipt;
    });
    return { code: "OK", data };
  } catch {
    return { code: "UNAVAILABLE", message: "Katalogbeleg konnte nicht sicher geladen werden." };
  }
}

export async function readExtraWorkRateReceipt(
  authorization: AuthorizationSnapshot,
  input: { rateId: string; clientEventId: string },
): Promise<F13ReceiptReadResult<ExtraWorkHourlyRateReceipt>> {
  if (!validPair(input, "rateId", true)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Stundensatzbeleg-Abfrage." };
  }
  if (!canRead(authorization)) return { code: "FORBIDDEN", message: "Stundensatzbeleg ist nicht erlaubt." };
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<RateRow>(sql`
        SELECT * FROM private.v_extra_work_rate_receipts_v1
        WHERE rate_id = ${input.rateId}
          AND client_event_id = ${input.clientEventId}
        LIMIT 2
      `);
      if (rows.length > 1) throw new Error("F13_RATE_RECEIPT_AMBIGUOUS");
      const row = rows[0];
      if (!row) return null;
      if (
        !validCommon(row, authorization)
        || row.rate_id !== input.rateId
        || !Number.isSafeInteger(row.hourly_rate_cents)
        || row.hourly_rate_cents < 1
      ) throw new Error("F13_RATE_RECEIPT_INVALID");
      return {
        eventId: row.event_id,
        clientEventId: row.client_event_id,
        correlationId: row.correlation_id,
        eventSchemaVersion: 1,
        rateId: row.rate_id,
        aggregateVersion: row.aggregate_version,
        hourlyRateCents: row.hourly_rate_cents,
        actorId: row.actor_id,
        occurredAt: toIso(row.occurred_at),
      } satisfies ExtraWorkHourlyRateReceipt;
    });
    return { code: "OK", data };
  } catch {
    return { code: "UNAVAILABLE", message: "Stundensatzbeleg konnte nicht sicher geladen werden." };
  }
}
