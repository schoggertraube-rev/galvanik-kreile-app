import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ALLOWED_ROLES = ["buero", "meister", "admin", "developer"] as const;

export type SetInvoiceItemPricesInput = {
  orderId: string;
  expectedVersion: number;
  clientEventId: string;
  prices: Array<{ itemId: string; unitPriceCents: number }>;
};

export type SetInvoiceItemPricesResult =
  | {
      code: "OK";
      receipt: {
        eventId: string;
        aggregateVersion: number;
        actorId: string;
        occurredAt: string;
      };
      replayed: boolean;
    }
  | {
      code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR" | "UNAVAILABLE";
      message: string;
    };

type EventRow = {
  id: string;
  order_id: string;
  user_id: string;
  aggregate_version: number;
  created_at: Date | string;
  payload: unknown;
};

function normalizeInput(value: unknown): SetInvoiceItemPricesInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).sort().join(",") !== "clientEventId,expectedVersion,orderId,prices"
    || typeof input.orderId !== "string"
    || input.orderId.trim() !== input.orderId
    || input.orderId.length < 1
    || input.orderId.length > 128
    || typeof input.expectedVersion !== "number"
    || !Number.isSafeInteger(input.expectedVersion)
    || input.expectedVersion < 1
    || typeof input.clientEventId !== "string"
    || !UUID_PATTERN.test(input.clientEventId)
    || !Array.isArray(input.prices)
    || input.prices.length < 1
    || input.prices.length > 20
  ) return null;

  const prices: Array<{ itemId: string; unitPriceCents: number }> = [];
  for (const raw of input.prices) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const price = raw as Record<string, unknown>;
    if (
      Object.keys(price).sort().join(",") !== "itemId,unitPriceCents"
      || typeof price.itemId !== "string"
      || !UUID_PATTERN.test(price.itemId)
      || typeof price.unitPriceCents !== "number"
      || !Number.isSafeInteger(price.unitPriceCents)
      || price.unitPriceCents < 1
      || price.unitPriceCents > 999_999_999
    ) return null;
    prices.push({ itemId: price.itemId, unitPriceCents: price.unitPriceCents });
  }
  if (new Set(prices.map((price) => price.itemId)).size !== prices.length) return null;
  return {
    orderId: input.orderId,
    expectedVersion: input.expectedVersion,
    clientEventId: input.clientEventId,
    prices,
  };
}

function requestHash(input: SetInvoiceItemPricesInput): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function occurredAt(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("INVOICE_PRICE_EVENT_TIME_INVALID");
  return parsed.toISOString();
}

function mapReceipt(row: EventRow) {
  return {
    eventId: row.id,
    aggregateVersion: row.aggregate_version,
    actorId: row.user_id,
    occurredAt: occurredAt(row.created_at),
  };
}

export async function setInvoiceItemPrices(inputValue: unknown): Promise<SetInvoiceItemPricesResult> {
  const input = normalizeInput(inputValue);
  if (!input) return { code: "VALIDATION_ERROR", message: "Die Rechnungspreise sind unvollständig oder ungültig." };

  const authorization = await resolveAuthorization().catch(() => null);
  if (!authorization) return { code: "UNAVAILABLE", message: "Rechnungspreise konnten nicht sicher gespeichert werden." };
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: "Rechnungspreise konnten nicht sicher gespeichert werden." }
      : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }
  if (
    !ALLOWED_ROLES.includes(authorization.data.role as (typeof ALLOWED_ROLES)[number])
    || !authorization.data.permissions.includes("perm_data_orders")
  ) return { code: "FORBIDDEN", message: "Diese Rolle darf keine Rechnungspreise festlegen." };

  const hash = requestHash(input);
  try {
    return await withPrivilegedTenantTransaction(authorization.data, async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('invoice-item-prices:' || ${authorization.data.tenantId} || ':' || ${input.clientEventId}, 0))`);
      const replay = await tx.execute<EventRow>(sql`
        SELECT id, order_id, user_id::text AS user_id, aggregate_version, created_at, payload
        FROM public.events
        WHERE tenant_id = ${authorization.data.tenantId}
          AND client_event_id = ${input.clientEventId}::uuid
        LIMIT 2
      `);
      if (replay.length > 0) {
        const row = replay[0];
        const payload = row?.payload as { requestHash?: unknown } | null;
        return replay.length === 1 && row?.order_id === input.orderId && payload?.requestHash === hash
          ? { code: "OK" as const, receipt: mapReceipt(row), replayed: true }
          : { code: "CONFLICT" as const, message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const orders = await tx.execute<{ id: string; version: number; station: string; status: string; frozen: boolean; invoiced: boolean }>(sql`
        SELECT o.id, o.version, o.station, o.status,
          EXISTS (
            SELECT 1 FROM private.v_order_freeze_state_v1 freeze_state
            WHERE freeze_state.order_id = o.id AND freeze_state.tenant_id = o.tenant_id
              AND freeze_state.active = true AND freeze_state.integrity_ok = true
          ) AS frozen,
          EXISTS (
            SELECT 1 FROM public.invoices invoice
            WHERE invoice.order_id = o.id AND invoice.tenant_id = o.tenant_id
              AND invoice.status = 'issued'
          ) AS invoiced
        FROM public.orders o
        WHERE o.tenant_id = ${authorization.data.tenantId} AND o.id = ${input.orderId}
        FOR UPDATE
      `);
      const order = orders[0];
      if (orders.length !== 1 || !order) return { code: "NOT_FOUND" as const, message: "Auftrag nicht verfügbar." };
      if (order.version !== input.expectedVersion) return { code: "CONFLICT" as const, message: "Auftrag wurde bereits geändert." };
      if (order.station !== "fertig" || order.status !== "fertig" || !order.frozen || order.invoiced) {
        return { code: "VALIDATION_ERROR" as const, message: "Rechnungspreise können nur vor der ersten Rechnung eines fertiggestellten Auftrags ergänzt werden." };
      }

      const items = await tx.execute<{ id: string; preis_netto: number | string | null; catalog_service_id: string | null }>(sql`
        SELECT id, preis_netto, catalog_service_id::text AS catalog_service_id
        FROM public.items
        WHERE tenant_id = ${authorization.data.tenantId} AND order_id = ${input.orderId}
        FOR UPDATE
      `);
      const missing = items.filter((item) => item.preis_netto === null && item.catalog_service_id === null).map((item) => item.id).sort();
      const supplied = input.prices.map((price) => price.itemId).sort();
      if (missing.length !== supplied.length || missing.some((id, index) => id !== supplied[index])) {
        return { code: "VALIDATION_ERROR" as const, message: "Bitte alle preislosen Freitext-Positionen genau einmal ausfüllen." };
      }

      for (const price of input.prices) {
        const updated = await tx.execute<{ id: string }>(sql`
          UPDATE public.items
          SET preis_netto = ${price.unitPriceCents / 100}
          WHERE tenant_id = ${authorization.data.tenantId}
            AND order_id = ${input.orderId}
            AND id = ${price.itemId}
            AND catalog_service_id IS NULL
            AND preis_netto IS NULL
          RETURNING id
        `);
        if (updated.length !== 1 || updated[0]?.id !== price.itemId) throw new Error("INVOICE_PRICE_ITEM_UPDATE_INVALID");
      }

      const nextVersion = input.expectedVersion + 1;
      const updatedOrder = await tx.execute<{ version: number }>(sql`
        UPDATE public.orders SET version = version + 1
        WHERE tenant_id = ${authorization.data.tenantId} AND id = ${input.orderId} AND version = ${input.expectedVersion}
        RETURNING version
      `);
      if (updatedOrder.length !== 1 || updatedOrder[0]?.version !== nextVersion) throw new Error("INVOICE_PRICE_ORDER_UPDATE_INVALID");

      const eventId = randomUUID();
      const eventRows = await tx.execute<EventRow>(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, event_type, description, payload, status,
          user_id, station, client_event_id, event_schema_version, aggregate_version
        ) VALUES (
          ${eventId}, ${authorization.data.tenantId}, ${input.orderId},
          'ORDER_INVOICE_PRICES_SET_V1', 'Rechnungspreise ergänzt',
          ${JSON.stringify({ requestHash: hash, prices: input.prices })}::jsonb,
          'success', ${authorization.data.userId}::uuid, 'fertig',
          ${input.clientEventId}::uuid, 1, ${nextVersion}
        )
        RETURNING id, order_id, user_id::text AS user_id, aggregate_version, created_at, payload
      `);
      if (eventRows.length !== 1 || !eventRows[0]) throw new Error("INVOICE_PRICE_EVENT_INSERT_INVALID");
      return { code: "OK" as const, receipt: mapReceipt(eventRows[0]), replayed: false };
    });
  } catch (error) {
    console.error("[invoice-item-prices] transaction failed", error);
    return { code: "UNAVAILABLE", message: "Rechnungspreise konnten nicht sicher gespeichert werden." };
  }
}
