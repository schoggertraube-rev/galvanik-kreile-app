import "server-only";

import { sql } from "drizzle-orm";
import { ORDER_LIFECYCLE_STATUS, ORDER_STATION_FORWARD_ROLES } from "@/lib/orders/orderLifecycleContract";
import { resolveAuthorization } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const EVENT_TYPE = "ORDER_FROZEN_V1";
const EVENT_SCHEMA_VERSION = 1 as const;
const SOURCE_STATION = ORDER_LIFECYCLE_STATUS.GALVANIK;
const TARGET_STATION = ORDER_LIFECYCLE_STATUS.FERTIG;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type FreezeOrderInput = {
  orderId: string;
  freezeId: string;
  expectedVersion: number;
  clientEventId: string;
};

export type FrozenExtraWorkLine = {
  itemId: string;
  catalogPositionId: string;
  catalogPositionName: string;
  minutes: number;
  hourlyRateCents: number;
  amountCents: number;
};

export type OrderFrozenReceipt = {
  eventId: string;
  clientEventId: string;
  correlationId: string;
  eventSchemaVersion: 1;
  orderId: string;
  aggregateVersion: number;
  fromStation: "galvanik";
  toStation: "fertig";
  actorId: string;
  occurredAt: string;
  freezeId: string;
  rateId: string;
  hourlyRateCents: number;
  totalAmountCents: number;
  lineCount: number;
  frozenAt: string;
  lines: FrozenExtraWorkLine[];
};

export type FreezeOrderResult =
  | { code: "OK"; receipt: OrderFrozenReceipt; replayed: boolean }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

type LockedOrder = {
  id: string;
  tenant_id: string;
  customer_id: string;
  station: string;
  current_station: string | null;
  current_station_id: string | null;
  status: string;
  version: number;
};

type LockedItem = {
  id: string;
  tenant_id: string;
  customer_id: string;
  current_station_id: string | null;
};

type ActiveLine = {
  id: string;
  item_id: string;
  catalog_position_id: string;
  catalog_position_name: string;
  minutes: number;
};

type RateRow = {
  id: string;
  tenant_id: string;
  hourly_rate_cents: number;
  version: number;
};

type WriteSummary = {
  line_count: number;
  total_amount_cents: number | string;
};

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

function isValidInput(input: unknown): input is FreezeOrderInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  const expected = ["clientEventId", "expectedVersion", "freezeId", "orderId"];
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index])
    && typeof value.orderId === "string"
    && value.orderId.trim() === value.orderId
    && value.orderId.length > 0
    && value.orderId.length <= 128
    && typeof value.freezeId === "string"
    && UUID_PATTERN.test(value.freezeId)
    && typeof value.clientEventId === "string"
    && UUID_PATTERN.test(value.clientEventId)
    && typeof value.expectedVersion === "number"
    && Number.isSafeInteger(value.expectedVersion)
    && value.expectedVersion > 0;
}

function toIso(value: unknown): string {
  const parsed = value instanceof Date ? value : new Date(value as string);
  if (!Number.isFinite(parsed.getTime())) throw new Error("ORDER_FROZEN_TIME_INVALID");
  return parsed.toISOString();
}

function toSafeInteger(value: unknown, error: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(error);
  return parsed;
}

function parseFrozenLines(value: unknown, expectedRate: number): FrozenExtraWorkLine[] {
  if (!Array.isArray(value)) throw new Error("ORDER_FROZEN_LINES_INVALID");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("ORDER_FROZEN_LINE_INVALID");
    }
    const line = entry as Record<string, unknown>;
    const expected = [
      "amountCents", "catalogPositionId", "catalogPositionName",
      "hourlyRateCents", "itemId", "minutes",
    ];
    const actual = Object.keys(line).sort();
    if (actual.length !== expected.length || !actual.every((key, index) => key === expected[index])) {
      throw new Error("ORDER_FROZEN_LINE_SHAPE_INVALID");
    }
    const minutes = toSafeInteger(line.minutes, "ORDER_FROZEN_LINE_MINUTES_INVALID");
    const hourlyRateCents = toSafeInteger(line.hourlyRateCents, "ORDER_FROZEN_LINE_RATE_INVALID");
    const amountCents = toSafeInteger(line.amountCents, "ORDER_FROZEN_LINE_AMOUNT_INVALID");
    if (
      typeof line.itemId !== "string"
      || line.itemId.length === 0
      || typeof line.catalogPositionId !== "string"
      || !UUID_PATTERN.test(line.catalogPositionId)
      || typeof line.catalogPositionName !== "string"
      || line.catalogPositionName.trim() !== line.catalogPositionName
      || line.catalogPositionName.length < 2
      || line.catalogPositionName.length > 100
      || minutes < 1
      || minutes > 1440
      || hourlyRateCents !== expectedRate
      || amountCents !== Math.floor((minutes * hourlyRateCents + 30) / 60)
    ) throw new Error("ORDER_FROZEN_LINE_INTEGRITY_INVALID");

    return {
      itemId: line.itemId,
      catalogPositionId: line.catalogPositionId,
      catalogPositionName: line.catalogPositionName,
      minutes,
      hourlyRateCents,
      amountCents,
    };
  });
}

function mapReceipt(row: ReceiptRow, tenantId: string, actorId: string): OrderFrozenReceipt {
  const hourlyRateCents = toSafeInteger(row.hourly_rate_cents, "ORDER_FROZEN_RATE_INVALID");
  const aggregateVersion = toSafeInteger(row.aggregate_version, "ORDER_FROZEN_VERSION_INVALID");
  const totalAmountCents = toSafeInteger(row.total_amount_cents, "ORDER_FROZEN_TOTAL_INVALID");
  const lineCount = toSafeInteger(row.line_count, "ORDER_FROZEN_COUNT_INVALID");
  const lines = parseFrozenLines(row.lines, hourlyRateCents);
  if (
    row.integrity_ok !== true
    || row.tenant_id !== tenantId
    || row.actor_id !== actorId
    || row.event_schema_version !== EVENT_SCHEMA_VERSION
    || row.from_station !== SOURCE_STATION
    || row.to_station !== TARGET_STATION
    || !UUID_PATTERN.test(row.event_id)
    || !UUID_PATTERN.test(row.client_event_id)
    || !UUID_PATTERN.test(row.correlation_id)
    || !UUID_PATTERN.test(row.freeze_id)
    || !UUID_PATTERN.test(row.rate_id)
    || aggregateVersion <= 0
    || hourlyRateCents < 1
    || lineCount < 0
    || lines.length !== lineCount
    || lines.reduce((sum, line) => sum + line.amountCents, 0) !== totalAmountCents
  ) throw new Error("ORDER_FROZEN_RECEIPT_INVALID");

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
    hourlyRateCents,
    totalAmountCents,
    lineCount,
    frozenAt: toIso(row.frozen_at),
    lines,
  };
}

function receiptMatchesIntent(receipt: OrderFrozenReceipt, input: FreezeOrderInput): boolean {
  return receipt.orderId === input.orderId
    && receipt.freezeId === input.freezeId
    && receipt.aggregateVersion === input.expectedVersion + 1;
}

export async function freezeOrder(input: FreezeOrderInput): Promise<FreezeOrderResult> {
  if (!isValidInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültiger Fertig-Abschluss." };
  }

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: "Auftrag konnte nicht sicher abgeschlossen werden." };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: "Auftrag konnte nicht sicher abgeschlossen werden." }
      : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }
  if (!ORDER_STATION_FORWARD_ROLES.includes(
    authorization.data.role as (typeof ORDER_STATION_FORWARD_ROLES)[number],
  )) {
    return { code: "FORBIDDEN", message: "Fertig-Abschluss ist mit dieser Rolle nicht erlaubt." };
  }

  try {
    return await withPrivilegedTenantTransaction(authorization.data, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(
            'f1:client-event:' || ${authorization.data.tenantId} || ':' || ${input.clientEventId},
            0
          )
        )
      `);

      const replayRows = await tx.execute<ReceiptRow>(sql`
        SELECT *
        FROM private.v_order_frozen_receipts_v1
        WHERE client_event_id = ${input.clientEventId}
        LIMIT 2
      `);
      if (replayRows.length > 0) {
        if (replayRows.length !== 1 || !replayRows[0]) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const receipt = mapReceipt(replayRows[0], authorization.data.tenantId, authorization.data.userId);
        return receiptMatchesIntent(receipt, input)
          ? { code: "OK", receipt, replayed: true }
          : { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const reusedEvents = await tx.execute<{ id: string }>(sql`
        SELECT id
        FROM public.events
        WHERE tenant_id = ${authorization.data.tenantId}
          AND client_event_id = ${input.clientEventId}
        LIMIT 1
      `);
      if (reusedEvents.length > 0) {
        return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const orderRows = await tx.execute<LockedOrder>(sql`
        SELECT id, tenant_id, customer_id, station, current_station,
               current_station_id, status, version
        FROM public.orders
        WHERE id = ${input.orderId}
          AND tenant_id = ${authorization.data.tenantId}
        FOR UPDATE
      `);
      const order = orderRows[0];
      if (orderRows.length !== 1 || !order) {
        return { code: "NOT_FOUND", message: "Auftrag nicht verfügbar." };
      }
      if (order.version !== input.expectedVersion) {
        return { code: "CONFLICT", message: "Auftrag wurde bereits geändert." };
      }
      if (
        order.station !== SOURCE_STATION
        || order.current_station !== SOURCE_STATION
        || order.current_station_id !== SOURCE_STATION
        || order.status !== SOURCE_STATION
      ) {
        return { code: "VALIDATION_ERROR", message: "Nur ein Auftrag in Galvanik kann fertiggesetzt werden." };
      }

      const customerRows = await tx.execute<{ id: string; tenant_id: string }>(sql`
        SELECT id, tenant_id
        FROM public.customers
        WHERE id = ${order.customer_id}
          AND tenant_id = ${authorization.data.tenantId}
        FOR SHARE
      `);
      if (customerRows.length !== 1 || customerRows[0]?.tenant_id !== authorization.data.tenantId) {
        return { code: "VALIDATION_ERROR", message: "Auftragszuordnung ist ungültig." };
      }

      const existingFreezeRows = await tx.execute<{ id: string }>(sql`
        SELECT freeze_id::text AS id
        FROM private.v_order_freeze_state_v1
        WHERE tenant_id = ${authorization.data.tenantId}
          AND order_id = ${order.id}
          AND active = true
        LIMIT 1
      `);
      if (existingFreezeRows.length > 0) {
        return { code: "CONFLICT", message: "Auftrag wurde bereits eingefroren." };
      }

      const itemRows = await tx.execute<LockedItem>(sql`
        SELECT id, tenant_id, customer_id, current_station_id
        FROM public.items
        WHERE order_id = ${order.id}
        FOR UPDATE
      `);
      if (itemRows.some((item) =>
        item.tenant_id !== authorization.data.tenantId
        || item.customer_id !== order.customer_id
        || item.current_station_id !== SOURCE_STATION
      )) {
        return { code: "VALIDATION_ERROR", message: "Auftragsteile sind nicht fertigsetzbar." };
      }

      const rateRows = await tx.execute<RateRow>(sql`
        SELECT id::text AS id, tenant_id, hourly_rate_cents, version
        FROM private.extra_work_hourly_rates
        WHERE tenant_id = ${authorization.data.tenantId}
        ORDER BY version DESC
        LIMIT 2
        FOR SHARE
      `);
      const rate = rateRows[0];
      if (
        rateRows.length < 1
        || !rate
        || rate.tenant_id !== authorization.data.tenantId
        || !Number.isSafeInteger(rate.hourly_rate_cents)
        || rate.hourly_rate_cents < 1
      ) {
        return { code: "VALIDATION_ERROR", message: "Stundensatz muss vor dem Fertig-Abschluss konfiguriert sein." };
      }

      const activeLines = await tx.execute<ActiveLine>(sql`
        SELECT
          line.id::text AS id,
          line.item_id,
          line.catalog_position_id::text AS catalog_position_id,
          position.name AS catalog_position_name,
          line.minutes
        FROM private.order_item_extra_work line
        JOIN private.extra_work_catalog_positions position
          ON position.id = line.catalog_position_id
         AND position.tenant_id = line.tenant_id
        JOIN public.items item
          ON item.id = line.item_id
         AND item.tenant_id = line.tenant_id
         AND item.order_id = line.order_id
        WHERE line.tenant_id = ${authorization.data.tenantId}
          AND line.order_id = ${order.id}
          AND line.active = true
        ORDER BY line.item_id, position.name, line.catalog_position_id
        FOR SHARE OF line, position
      `);
      if (activeLines.some((line) =>
        !UUID_PATTERN.test(line.id)
        || !UUID_PATTERN.test(line.catalog_position_id)
        || line.catalog_position_name.trim() !== line.catalog_position_name
        || !Number.isSafeInteger(line.minutes)
        || line.minutes < 1
        || line.minutes > 1440
      )) {
        return { code: "VALIDATION_ERROR", message: "Mehrarbeitsdaten sind nicht einfrierbar." };
      }

      const totalAmountCents = activeLines.reduce(
        (sum, line) => sum + Math.floor((line.minutes * rate.hourly_rate_cents + 30) / 60),
        0,
      );
      if (!Number.isSafeInteger(totalAmountCents)) {
        return { code: "VALIDATION_ERROR", message: "Mehrarbeitsbetrag ist nicht einfrierbar." };
      }
      const nextVersion = input.expectedVersion + 1;

      const updatedOrders = await tx.execute<{ id: string; version: number }>(sql`
        UPDATE public.orders
        SET station = ${TARGET_STATION},
            current_station = ${TARGET_STATION},
            current_station_id = ${TARGET_STATION},
            status = ${TARGET_STATION},
            completed_date = clock_timestamp(),
            version = version + 1
        WHERE id = ${order.id}
          AND tenant_id = ${authorization.data.tenantId}
          AND version = ${input.expectedVersion}
          AND station = ${SOURCE_STATION}
          AND current_station = ${SOURCE_STATION}
          AND current_station_id = ${SOURCE_STATION}
          AND status = ${SOURCE_STATION}
        RETURNING id, version
      `);
      if (updatedOrders.length !== 1 || updatedOrders[0]?.version !== nextVersion) {
        return { code: "CONFLICT", message: "Auftrag wurde bereits geändert." };
      }

      if (itemRows.length > 0) {
        const updatedItems = await tx.execute<{ id: string }>(sql`
          UPDATE public.items
          SET current_station_id = ${TARGET_STATION}
          WHERE tenant_id = ${authorization.data.tenantId}
            AND order_id = ${order.id}
            AND current_station_id = ${SOURCE_STATION}
          RETURNING id
        `);
        if (updatedItems.length !== itemRows.length) throw new Error("ORDER_FROZEN_ITEM_UPDATE_MISMATCH");
      }

      const eventRows = await tx.execute<{ event_id: string; occurred_at: Date | string }>(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, item_id, event_type, description, payload,
          status, user_id, station, created_at, client_event_id,
          event_schema_version, correlation_id, aggregate_version, from_station
        ) VALUES (
          gen_random_uuid()::text, ${authorization.data.tenantId}, ${order.id}, NULL,
          ${EVENT_TYPE}, 'Order frozen from galvanik to fertig',
          ${JSON.stringify({
            freezeId: input.freezeId,
            rateId: rate.id,
            hourlyRateCents: rate.hourly_rate_cents,
            totalAmountCents,
            lineCount: activeLines.length,
          })}::jsonb,
          'success', ${authorization.data.userId}::uuid, ${TARGET_STATION},
          clock_timestamp() AT TIME ZONE 'UTC', ${input.clientEventId}::uuid,
          ${EVENT_SCHEMA_VERSION}, gen_random_uuid(), ${nextVersion}, ${SOURCE_STATION}
        )
        RETURNING id AS event_id, created_at AS occurred_at
      `);
      const event = eventRows[0];
      if (eventRows.length !== 1 || !event || !UUID_PATTERN.test(event.event_id)) {
        throw new Error("ORDER_FROZEN_EVENT_INSERT_FAILED");
      }

      const freezeRows = await tx.execute<{ id: string; frozen_at: Date | string }>(sql`
        INSERT INTO private.order_freezes (
          id, tenant_id, order_id, event_id, hourly_rate_id, hourly_rate_cents,
          total_amount_cents, line_count, order_version, frozen_by, frozen_at
        ) VALUES (
          ${input.freezeId}::uuid, ${authorization.data.tenantId}, ${order.id}, ${event.event_id},
          ${rate.id}::uuid, ${rate.hourly_rate_cents}, ${totalAmountCents}, ${activeLines.length},
          ${nextVersion}, ${authorization.data.userId}::uuid, clock_timestamp()
        )
        RETURNING id::text AS id, frozen_at
      `);
      const freeze = freezeRows[0];
      if (freezeRows.length !== 1 || freeze?.id !== input.freezeId) {
        throw new Error("ORDER_FROZEN_HEADER_INSERT_FAILED");
      }

      const lineSummaryRows = await tx.execute<WriteSummary>(sql`
        WITH inserted AS (
          INSERT INTO private.order_frozen_extra_work_lines (
            id, freeze_id, tenant_id, order_id, item_id, source_line_id,
            source_line_version,
            catalog_position_id, catalog_position_name, minutes,
            hourly_rate_cents, amount_cents, frozen_at
          )
          SELECT
            gen_random_uuid(), ${input.freezeId}::uuid, line.tenant_id, line.order_id,
            line.item_id, line.id, line.version, line.catalog_position_id, position.name, line.minutes,
            ${rate.hourly_rate_cents},
            ((line.minutes::bigint * ${rate.hourly_rate_cents}::bigint + 30) / 60)::integer,
            ${freeze?.frozen_at}::timestamptz
          FROM private.order_item_extra_work line
          JOIN private.extra_work_catalog_positions position
            ON position.id = line.catalog_position_id
           AND position.tenant_id = line.tenant_id
          WHERE line.tenant_id = ${authorization.data.tenantId}
            AND line.order_id = ${order.id}
            AND line.active = true
          RETURNING amount_cents
        )
        SELECT count(*)::integer AS line_count,
               coalesce(sum(amount_cents), 0)::bigint AS total_amount_cents
        FROM inserted
      `);
      const summary = lineSummaryRows[0];
      if (
        lineSummaryRows.length !== 1
        || !summary
        || summary.line_count !== activeLines.length
        || toSafeInteger(summary.total_amount_cents, "ORDER_FROZEN_WRITE_TOTAL_INVALID") !== totalAmountCents
      ) throw new Error("ORDER_FROZEN_LINE_INSERT_MISMATCH");

      const receiptRows = await tx.execute<ReceiptRow>(sql`
        SELECT *
        FROM private.v_order_frozen_receipts_v1
        WHERE client_event_id = ${input.clientEventId}
        LIMIT 2
      `);
      if (receiptRows.length !== 1 || !receiptRows[0]) throw new Error("ORDER_FROZEN_RECEIPT_MISSING");
      const receipt = mapReceipt(receiptRows[0], authorization.data.tenantId, authorization.data.userId);
      if (!receiptMatchesIntent(receipt, input)) throw new Error("ORDER_FROZEN_RECEIPT_MISMATCH");
      return { code: "OK", receipt, replayed: false };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Auftrag konnte nicht sicher abgeschlossen werden." };
  }
}
