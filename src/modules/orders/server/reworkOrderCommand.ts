import "server-only";

import {isWorkingDay,berlinCalendarDay} from "@/lib/domain/workingDays";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { hasAuthorizationArea, resolveAuthorization } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { ORDER_LIFECYCLE_STATUS } from "../public";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// The current operational lifecycle enters at "angenommen". The receipt still
// names the physical intake station "wareneingang", exactly like order intake.
const ORDER_STATION = ORDER_LIFECYCLE_STATUS.ANGENOMMEN;
const EVENT_STATION = "wareneingang";
const EVENT_TYPE = "ORDER_REWORK_CREATED_V1";

type Bewertung = "berechtigt" | "kulanz";

export type NacharbeitAnlegenInput = {
  reklamationId: string;
  bewertung: Bewertung;
  massnahme: "nacharbeit";
  liefertermin: string;
  version: number;
};

export type NacharbeitAnlegenReceipt = {
  complaintId: string;
  complaintVersion: number;
  orderId: string;
  orderNumber: string;
  eventId: string;
  deliveryDate: string;
};

export type NacharbeitAnlegenResult =
  | { code: "OK"; receipt: NacharbeitAnlegenReceipt; replayed: boolean }
  | { code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR" | "UNAVAILABLE"; message: string };

type ComplaintContextRow = {
  complaint_id: string;
  tenant_id: string;
  source_order_id: string;
  customer_id: string;
  nummer: string | null;
  teile: unknown;
  mangel: string | null;
  ware_zurueck: string | null;
  stand: string | null;
  bewertung: string | null;
  massnahme: string | null;
  nacharbeit_auftrag_id: string | null;
  version: number | string | null;
  source_handover_mode: string | null;
  source_intake_source: string | null;
  source_order_number: string | null;
  source_customer_id: string | null;
  source_items: unknown;
};

type SourceItem = {
  itemId: string;
  name: string;
  quantity: number;
  material: string | null;
  surfaceRequested: string | null;
  executionRequested: string;
  unit: string | null;
};

type ComplaintPart = {
  positionId: string;
  quantity: number;
};

type OrderRow = {
  id: string;
  tenant_id: string;
  order_number: string;
  version: number | string;
};

type EventRow = {
  event_id: string;
};

function isCanonicalText(value: unknown, max = 128): value is string {
  return typeof value === "string" && value.trim() === value && value.length >= 1 && value.length <= max;
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function toPositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && (value.length === 0 || value.trim() !== value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function toPositiveQuantity(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && (value.length === 0 || value.trim() !== value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isNullableText(value: unknown, max = 500): value is string | null {
  return value === null || (typeof value === "string" && value.trim() === value && value.length <= max);
}

function parseParts(value: unknown): ComplaintPart[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) return null;
  const seen = new Set<string>();
  const parts: ComplaintPart[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const raw = entry as Record<string, unknown>;
    if (Object.keys(raw).sort().join(",") !== "menge,position_id") return null;
    const positionId = raw.position_id;
    const quantity = toPositiveQuantity(raw.menge);
    if (!isCanonicalText(positionId) || quantity === null || seen.has(positionId)) return null;
    seen.add(positionId);
    parts.push({ positionId, quantity });
  }
  return parts;
}

function parseSourceItems(value: unknown): SourceItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return null;
  const seen = new Set<string>();
  const items: SourceItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const raw = entry as Record<string, unknown>;
    const itemId = raw.itemId;
    const quantity = toPositiveQuantity(raw.quantity);
    if (
      !isCanonicalText(itemId)
      || !isCanonicalText(raw.name)
      || quantity === null
      || !isNullableText(raw.material)
      || !isNullableText(raw.surfaceRequested)
      || !isCanonicalText(raw.executionRequested)
      || !isNullableText(raw.unit, 50)
      || seen.has(itemId)
    ) return null;
    seen.add(itemId);
    items.push({
      itemId,
      name: raw.name,
      quantity,
      material: raw.material,
      surfaceRequested: raw.surfaceRequested,
      executionRequested: raw.executionRequested,
      unit: raw.unit,
    });
  }
  return items;
}

function isValidInput(input: unknown): input is NacharbeitAnlegenInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  const expectedKeys = ["bewertung", "liefertermin", "massnahme", "reklamationId", "version"];
  const actualKeys = Object.keys(value).sort();
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index])
    && isCanonicalText(value.reklamationId)
    && (value.bewertung === "berechtigt" || value.bewertung === "kulanz")
    && value.massnahme === "nacharbeit"
    && isIsoDate(value.liefertermin)
    && isWorkingDay(value.liefertermin)
    && value.liefertermin >= berlinCalendarDay()
    && toPositiveInteger(value.version) === value.version;
}

function readDiagnostic(error: unknown, key: "message" | "details" | "hint"): string | null {
  if (!error || typeof error !== "object") return key === "message" && error instanceof Error ? error.message : null;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function logDatabaseFailure(error: unknown): void {
  console.error("nacharbeitAnlegen database error", {
    message: readDiagnostic(error, "message"),
    details: readDiagnostic(error, "details"),
    hint: readDiagnostic(error, "hint"),
  });
}

async function allocateOrderNumber(tx: PrivilegedTenantTransaction): Promise<string> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('f1:order-number', 0))`);
  const rows = await tx.execute<{ current_year: number | string; next_number: number | string }>(sql`
    WITH current_clock AS (
      SELECT extract(year FROM statement_timestamp() AT TIME ZONE 'Europe/Berlin')::int AS current_year
    )
    SELECT
      clock.current_year,
      coalesce(max(substring(orders.order_number FROM '[0-9]+$')::int), 0) + 1 AS next_number
    FROM current_clock clock
    LEFT JOIN public.orders orders
      ON orders.order_number ~ ('^A-' || clock.current_year::text || '-[0-9]{4,}$')
    GROUP BY clock.current_year
  `);
  const row = rows[0];
  const year = toPositiveInteger(row?.current_year);
  const next = toPositiveInteger(row?.next_number);
  if (rows.length !== 1 || !year || !next || year < 2000 || year > 9999) {
    throw new Error("REWORK_ORDER_NUMBER_INVALID");
  }
  return `A-${year}-${String(next).padStart(4, "0")}`;
}

async function readComplaintContext(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  complaintId: string,
): Promise<ComplaintContextRow[]> {
  return tx.execute<ComplaintContextRow>(sql`
    SELECT *
    FROM public.v_complaint_rework_context_v1
    WHERE tenant_id = ${tenantId}
      AND complaint_id = ${complaintId}
    LIMIT 2
  `);
}

async function receiptForExistingRework(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  context: ComplaintContextRow,
  deliveryDate: string,
): Promise<NacharbeitAnlegenReceipt | null> {
  if (!isCanonicalText(context.nacharbeit_auftrag_id)) return null;
  const orders = await tx.execute<OrderRow>(sql`
    SELECT id, tenant_id, order_number, version
    FROM public.orders
    WHERE tenant_id = ${tenantId}
      AND id = ${context.nacharbeit_auftrag_id}
      AND nacharbeit_zu = ${context.complaint_id}
      AND payment_mode = 'keiner'
    LIMIT 2
  `);
  const events = await tx.execute<EventRow>(sql`
    SELECT id AS event_id
    FROM public.events
    WHERE tenant_id = ${tenantId}
      AND order_id = ${context.nacharbeit_auftrag_id}
      AND event_type = ${EVENT_TYPE}
      AND status = 'success'
    LIMIT 2
  `);
  const order = orders[0];
  const event = events[0];
  const complaintVersion = toPositiveInteger(context.version);
  if (
    orders.length !== 1 || !order || order.tenant_id !== tenantId || !isCanonicalText(order.id)
    || !isCanonicalText(order.order_number) || toPositiveInteger(order.version) === null
    || events.length !== 1 || !event || !isCanonicalText(event.event_id) || complaintVersion === null
  ) return null;
  return {
    complaintId: context.complaint_id,
    complaintVersion,
    orderId: order.id,
    orderNumber: order.order_number,
    eventId: event.event_id,
    deliveryDate,
  };
}

export async function nacharbeitAnlegen(input: unknown): Promise<NacharbeitAnlegenResult> {
  if (!isValidInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Nacharbeit ist unvollständig oder ungültig." };
  }

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch (error) {
    logDatabaseFailure(error);
    return { code: "UNAVAILABLE", message: "Nacharbeit konnte nicht sicher angelegt werden." };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: "Nacharbeit konnte nicht sicher angelegt werden." }
      : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }
  if (
    authorization.data.tenantId !== KREILE_TENANT_SLUG
    || !hasAuthorizationArea(authorization.data, "entscheiden")
  ) {
    return { code: "FORBIDDEN", message: "Nacharbeit ist mit dieser Rolle nicht erlaubt." };
  }

  const tenantId = authorization.data.tenantId;
  const actorId = authorization.data.userId;
  try {
    return await withPrivilegedTenantTransaction(authorization.data, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended('ein4b:rework:' || ${tenantId} || ':' || ${input.reklamationId}, 0)
        )
      `);

      const contexts = await readComplaintContext(tx, tenantId, input.reklamationId);
      const context = contexts[0];
      if (contexts.length !== 1 || !context || context.tenant_id !== tenantId) {
        return { code: "NOT_FOUND", message: "Reklamation ist nicht verfügbar." };
      }

      const persistedVersion = toPositiveInteger(context.version);
      if (
        context.stand === "massnahme_nacharbeit"
        && context.bewertung === input.bewertung
        && context.massnahme === "nacharbeit"
        && persistedVersion === input.version + 1
      ) {
        const receipt = await receiptForExistingRework(tx, tenantId, context, input.liefertermin);
        if (receipt) return { code: "OK", receipt, replayed: true };
        throw new Error("REWORK_ORDER_REPLAY_READBACK_INVALID");
      }
      if (context.stand !== "aufgenommen") {
        return { code: "CONFLICT", message: "Reklamation wurde bereits geändert." };
      }
      if (persistedVersion !== input.version) {
        return { code: "CONFLICT", message: "Reklamation wurde bereits geändert." };
      }
      if (context.nacharbeit_auftrag_id) {
        return { code: "VALIDATION_ERROR", message: "Zu dieser Reklamation besteht bereits eine Nacharbeit. Neue Reklamation zum Nacharbeitsauftrag aufnehmen." };
      }
      if (!["ja", "offen"].includes(context.ware_zurueck ?? "")) {
        return { code: "VALIDATION_ERROR", message: "Nacharbeit braucht die Teile." };
      }
      if (
        !isCanonicalText(context.source_order_id)
        || !isCanonicalText(context.customer_id)
        || context.source_customer_id !== context.customer_id
        || !isCanonicalText(context.source_order_number)
        || (context.source_handover_mode !== "pickup" && context.source_handover_mode !== "shipping")
        || !isCanonicalText(context.source_intake_source)
        || !isCanonicalText(context.nummer)
        || !isCanonicalText(context.mangel, 100)
      ) {
        throw new Error("REWORK_ORDER_SOURCE_CONTRACT_INVALID");
      }

      const complaintParts = parseParts(context.teile);
      const sourceItems = parseSourceItems(context.source_items);
      if (!complaintParts || !sourceItems) {
        return { code: "VALIDATION_ERROR", message: "Nacharbeit braucht die Teile." };
      }
      const sourceById = new Map(sourceItems.map((item) => [item.itemId, item]));
      const reworkItems: Array<SourceItem & { reworkQuantity: number }> = [];
      for (const complaintPart of complaintParts) {
        const sourceItem = sourceById.get(complaintPart.positionId);
        if (!sourceItem || complaintPart.quantity > sourceItem.quantity) {
          return { code: "VALIDATION_ERROR", message: "Nacharbeit braucht die Teile." };
        }
        reworkItems.push({ ...sourceItem, reworkQuantity: complaintPart.quantity });
      }

      await tx.execute(sql`SELECT set_config('app.rework_order_command', 'v1', true)`);
      const orderId = randomUUID();
      const eventId = randomUUID();
      const clientEventId = randomUUID();
      const correlationId = randomUUID();
      const orderNumber = await allocateOrderNumber(tx);
      const hint = `Reklamation ${context.nummer}: ${context.mangel}`;
      const title = `Nacharbeit · ${context.source_order_number} · ${reworkItems[0]?.name ?? ""}`.slice(0, 240);
      const task = reworkItems.map((item) => `${item.reworkQuantity}× ${item.name}`).join("; ").slice(0, 2000);
      if (!isCanonicalText(title, 240) || !isCanonicalText(task, 2000)) {
        throw new Error("REWORK_ORDER_DISPLAY_INVALID");
      }

      const insertedOrders = await tx.execute<OrderRow>(sql`
        INSERT INTO public.orders (
          id, tenant_id, order_number, customer_id, title, task, station,
          current_station, current_station_id, version, status, risk, priority_computed,
          intake_date, due_date, promised_due_date, intake_term_status, intake_source,
          source, source_ref, freetext_original, handover_mode, payment_mode, payment_mode_version,
          geprueft, ware, ware_seit, wunschtermin, termin_herkunft, terminstatus_seit,
          nacharbeit_zu, hinweis_auftrag, created_at
        ) VALUES (
          ${orderId}, ${tenantId}, ${orderNumber}, ${context.customer_id}, ${title}, ${task}, ${ORDER_STATION},
          ${ORDER_STATION}, ${ORDER_STATION}, 1, ${ORDER_LIFECYCLE_STATUS.ANGENOMMEN}, 'green', 'green',
          statement_timestamp() AT TIME ZONE 'UTC', ${input.liefertermin}::date, ${input.liefertermin}::date, 'wunsch', ${context.source_intake_source},
          'REKLAMATION_NACHARBEIT', ${context.complaint_id}, ${hint}, ${context.source_handover_mode}, 'keiner', 0,
          false, 'erwartet', statement_timestamp() AT TIME ZONE 'UTC', ${input.liefertermin}::date, 'vorschlag', statement_timestamp() AT TIME ZONE 'UTC',
          ${context.complaint_id}, ${hint}, statement_timestamp() AT TIME ZONE 'UTC'
        )
        RETURNING id, tenant_id, order_number, version
      `);
      const insertedOrder = insertedOrders[0];
      if (
        insertedOrders.length !== 1 || !insertedOrder || insertedOrder.id !== orderId
        || insertedOrder.tenant_id !== tenantId || insertedOrder.order_number !== orderNumber
        || toPositiveInteger(insertedOrder.version) !== 1
      ) throw new Error("REWORK_ORDER_INSERT_FAILED");

      for (const item of reworkItems) {
        const itemId = randomUUID();
        const insertedItems = await tx.execute<{ id: string; tenant_id: string; order_id: string; customer_id: string }>(sql`
          INSERT INTO public.items (
            id, tenant_id, order_id, customer_id, name, quantity, current_station_id,
            material, surface_requested, execution_requested, unit, preis_netto, internal_notes, created_at
          ) VALUES (
            ${itemId}, ${tenantId}, ${orderId}, ${context.customer_id}, ${item.name}, ${item.reworkQuantity}, ${ORDER_STATION},
            ${item.material}, ${item.surfaceRequested}, ${item.executionRequested}, ${item.unit}, 0, ${hint}, statement_timestamp() AT TIME ZONE 'UTC'
          )
          RETURNING id, tenant_id, order_id, customer_id
        `);
        const insertedItem = insertedItems[0];
        if (
          insertedItems.length !== 1 || !insertedItem || insertedItem.id !== itemId
          || insertedItem.tenant_id !== tenantId || insertedItem.order_id !== orderId
          || insertedItem.customer_id !== context.customer_id
        ) throw new Error("REWORK_ORDER_ITEM_INSERT_FAILED");
      }

      const updatedComplaints = await tx.execute<{ complaint_id: string; version: number | string }>(sql`
        UPDATE public.v_complaint_rework_context_v1
        SET stand = 'massnahme_nacharbeit',
            bewertung = ${input.bewertung},
            massnahme = 'nacharbeit',
            nacharbeit_auftrag_id = ${orderId},
            version = version + 1
        WHERE tenant_id = ${tenantId}
          AND complaint_id = ${context.complaint_id}
          AND stand = 'aufgenommen'
          AND version = ${input.version}
        RETURNING complaint_id, version
      `);
      const updatedComplaint = updatedComplaints[0];
      if (
        updatedComplaints.length !== 1 || !updatedComplaint || updatedComplaint.complaint_id !== context.complaint_id
        || toPositiveInteger(updatedComplaint.version) !== input.version + 1
      ) {
        return { code: "CONFLICT", message: "Reklamation wurde bereits geändert." };
      }

      const payload = {
        complaintId: context.complaint_id,
        deliveryDate: input.liefertermin,
        orderId,
        paymentMode: "keiner" as const,
        previousState: "aufgenommen" as const,
        sourceOrderId: context.source_order_id,
        state: "massnahme_nacharbeit" as const,
      };
      const insertedEvents = await tx.execute<{ event_id: string }>(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, item_id, event_type, description, notes, payload,
          status, user_id, station, client_event_id, event_schema_version,
          correlation_id, aggregate_version, from_station, created_at
        ) VALUES (
          ${eventId}, ${tenantId}, ${orderId}, NULL, ${EVENT_TYPE}, 'Nacharbeit angelegt', ${hint},
          ${JSON.stringify(payload)}::jsonb, 'success', ${actorId}::uuid, ${EVENT_STATION}, ${clientEventId}::uuid, 1,
          ${correlationId}::uuid, 1, NULL, statement_timestamp() AT TIME ZONE 'UTC'
        )
        RETURNING id AS event_id
      `);
      if (insertedEvents.length !== 1 || insertedEvents[0]?.event_id !== eventId) {
        throw new Error("REWORK_ORDER_EVENT_INSERT_FAILED");
      }

      const receipts = await readComplaintContext(tx, tenantId, context.complaint_id);
      const receiptContext = receipts[0];
      if (
        receipts.length !== 1 || !receiptContext || receiptContext.stand !== "massnahme_nacharbeit"
        || receiptContext.bewertung !== input.bewertung || receiptContext.massnahme !== "nacharbeit"
        || receiptContext.nacharbeit_auftrag_id !== orderId
        || toPositiveInteger(receiptContext.version) !== input.version + 1
      ) throw new Error("REWORK_ORDER_READBACK_INVALID");

      return {
        code: "OK",
        replayed: false,
        receipt: {
          complaintId: context.complaint_id,
          complaintVersion: input.version + 1,
          orderId,
          orderNumber,
          eventId,
          deliveryDate: input.liefertermin,
        },
      };
    });
  } catch (error) {
    logDatabaseFailure(error);
    return { code: "UNAVAILABLE", message: "Nacharbeit konnte nicht sicher angelegt werden." };
  }
}
