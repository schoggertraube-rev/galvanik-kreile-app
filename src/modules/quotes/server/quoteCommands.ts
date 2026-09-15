import "server-only";

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type {
  ConvertQuoteInput,
  CreateQuoteInput,
  CreateQuoteResult,
  PrepareQuoteConversionResult,
  QuoteCommandContext,
  QuoteConversionReceipt,
  QuoteOrderInput,
  QuotePosition,
  QuoteReadback,
  ReadQuoteConversionReceiptResult,
  ReadQuoteCreateReceiptResult,
  ReadQuoteResult,
} from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type QuoteRow = {
  quote_id: string;
  tenant_id: string;
  quote_number: string;
  customer_id: string;
  customer_number: string | null;
  customer_display_name: string;
  status: string;
  version: number;
  currency: string;
  due_date: Date | string;
  note: string | null;
  total_net_cents: number | string;
  linked_order_id: string | null;
  created_by: string;
  actor_display_name: string;
  created_at: Date | string;
  converted_at: Date | string | null;
  positions: unknown;
  integrity_ok: boolean;
};

type CreateReceiptRow = {
  receipt_id: string;
  event_id: string;
  tenant_id: string;
  quote_id: string;
  customer_id: string;
  actor_id: string;
  client_event_id: string;
  correlation_id: string;
  intent_sha256: string;
  recorded_at: Date | string;
  integrity_ok: boolean;
};

type ConversionReceiptRow = CreateReceiptRow & {
  order_id: string;
  order_intake_event_id: string;
  quote_version: number;
};

function plainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function text(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= min && normalized.length <= max ? normalized : null;
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === null) return null;
  return text(value, 1, max) ?? undefined;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeCreate(value: unknown): CreateQuoteInput | null {
  if (!plainObject(value) || !exactKeys(value, ["clientEventId", "customerId", "dueDate", "note", "positions"])) return null;
  if (typeof value.clientEventId !== "string" || !UUID_PATTERN.test(value.clientEventId)) return null;
  const customerId = text(value.customerId, 1, 128);
  const note = optionalText(value.note, 2000);
  if (!customerId || !validDate(value.dueDate) || note === undefined || !Array.isArray(value.positions) || value.positions.length < 1 || value.positions.length > 20) return null;
  const positions = [];
  for (const candidate of value.positions) {
    if (!plainObject(candidate) || !exactKeys(candidate, ["material", "name", "quantity", "surfaceRequested", "unitPriceCents"])) return null;
    const name = text(candidate.name, 2, 160);
    const material = candidate.material === null ? null : text(candidate.material, 1, 120);
    const surfaceRequested = text(candidate.surfaceRequested, 2, 160);
    if (!name || material === null && candidate.material !== null || !surfaceRequested
      || typeof candidate.quantity !== "number" || !Number.isSafeInteger(candidate.quantity) || candidate.quantity < 1 || candidate.quantity > 1_000_000
      || typeof candidate.unitPriceCents !== "number" || !Number.isSafeInteger(candidate.unitPriceCents) || candidate.unitPriceCents < 0 || candidate.unitPriceCents > 999_999_999) return null;
    positions.push({ name, quantity: candidate.quantity, material, surfaceRequested, unitPriceCents: candidate.unitPriceCents });
  }
  return { clientEventId: value.clientEventId, customerId, dueDate: value.dueDate, note, positions };
}

function normalizeConvert(value: unknown): ConvertQuoteInput | null {
  if (!plainObject(value) || !exactKeys(value, ["clientEventId", "confirmedAward", "confirmedOrderDueDate", "expectedVersion", "quoteId"])) return null;
  if (typeof value.quoteId !== "string" || !UUID_PATTERN.test(value.quoteId)
    || typeof value.clientEventId !== "string" || !UUID_PATTERN.test(value.clientEventId)
    || value.confirmedAward !== true || typeof value.expectedVersion !== "number"
    || !Number.isSafeInteger(value.expectedVersion) || value.expectedVersion < 1
    || !validDate(value.confirmedOrderDueDate)) return null;
  return value as ConvertQuoteInput;
}

function hashIntent(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function hashOrderIntent(input: QuoteOrderInput): string {
  return hashIntent({
    clientEventId: input.clientEventId,
    customer: input.customer,
    dueDate: input.dueDate,
    items: input.items.map(({ name, quantity, material, surfaceRequested }) => ({
      name, quantity, material, surfaceRequested,
    })),
    note: input.note,
  });
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parsePositions(value: unknown): QuotePosition[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;
  if (!value.every(plainObject)) return null;
  const positions = value.map((position) => ({
    id: String(position.id),
    position: Number(position.position),
    name: String(position.name),
    quantity: Number(position.quantity),
    material: position.material === null ? null : String(position.material),
    surfaceRequested: String(position.surfaceRequested),
    unitPriceCents: Number(position.unitPriceCents),
    lineTotalCents: Number(position.lineTotalCents),
  }));
  const valid = positions.every((position) => UUID_PATTERN.test(position.id)
    && Number.isSafeInteger(position.position) && position.position >= 1 && position.position <= 20
    && Boolean(text(position.name, 2, 160)) && Number.isSafeInteger(position.quantity) && position.quantity >= 1
    && (position.material === null || Boolean(text(position.material, 1, 120)))
    && Boolean(text(position.surfaceRequested, 2, 160))
    && Number.isSafeInteger(position.unitPriceCents) && position.unitPriceCents >= 0
    && Number.isSafeInteger(position.lineTotalCents)
    && position.lineTotalCents === position.quantity * position.unitPriceCents);
  return valid ? positions : null;
}

function quoteFromRow(row: QuoteRow, tenantId: string): QuoteReadback | null {
  const positions = parsePositions(row.positions);
  const createdAt = iso(row.created_at);
  const convertedAt = iso(row.converted_at);
  const dueDate = row.due_date instanceof Date ? row.due_date.toISOString().slice(0, 10) : String(row.due_date).slice(0, 10);
  const total = Number(row.total_net_cents);
  if (row.integrity_ok !== true || row.tenant_id !== tenantId || !UUID_PATTERN.test(row.quote_id)
    || !/^KV-\d{4}-\d{4,}$/.test(row.quote_number) || !positions || !validDate(dueDate)
    || !Number.isSafeInteger(total) || total !== positions.reduce((sum, item) => sum + item.lineTotalCents, 0)
    || !createdAt || (row.converted_at !== null && !convertedAt)
    || !["draft", "converted"].includes(row.status) || ![1, 2].includes(row.version)
    || row.currency !== "EUR" || !UUID_PATTERN.test(row.created_by)) return null;
  return {
    quoteId: row.quote_id, quoteNumber: row.quote_number, customerId: row.customer_id,
    customerNumber: row.customer_number, customerDisplayName: row.customer_display_name,
    status: row.status as QuoteReadback["status"], version: row.version as QuoteReadback["version"], currency: "EUR",
    dueDate, note: row.note, totalNetCents: total, linkedOrderId: row.linked_order_id,
    actorId: row.created_by, actorDisplayName: row.actor_display_name, createdAt, convertedAt, positions,
  };
}

function diagnostic(error: unknown, key: "message" | "details" | "hint"): string | null {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  const source = record.cause && typeof record.cause === "object" ? record.cause as Record<string, unknown> : record;
  const value = source[key] ?? (key === "details" ? source.detail : null);
  if (typeof value !== "string") return null;
  return /\b(?:select|insert|update|delete)\b|params:/i.test(value) ? "DATABASE_OPERATION_FAILED" : value.replace(/\s+/g, " ").slice(0, 500);
}

async function readQuote(tx: PrivilegedTenantTransaction, tenantId: string, quoteId: string): Promise<QuoteReadback | null> {
  const rows = await tx.execute<QuoteRow>(sql`SELECT * FROM private.v_quotes_v1 WHERE quote_id = ${quoteId}::uuid LIMIT 2`);
  if (rows.length === 0) return null;
  if (rows.length !== 1 || !rows[0]) throw new Error("QUOTE_READBACK_AMBIGUOUS");
  const quote = quoteFromRow(rows[0], tenantId);
  if (!quote) throw new Error("QUOTE_READBACK_INVALID");
  return quote;
}

export async function createQuoteCommand(authorization: QuoteCommandContext, input: unknown): Promise<CreateQuoteResult> {
  const normalized = normalizeCreate(input);
  if (!normalized) return { code: "VALIDATION_ERROR", message: "KV-Daten sind unvollständig oder ungültig." };
  if (!authorization.capabilities.canCreateQuote) return { code: "FORBIDDEN", message: "KVs dürfen mit dieser Rolle nicht angelegt werden." };
  const intentSha256 = hashIntent(normalized);
  try {
    return await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const result = await tx.execute<{ result_code: string; result_quote_id: string | null; replayed: boolean }>(sql`
        SELECT * FROM private.create_quote_v1(
          ${authorization.tenantId}, ${authorization.userId}::uuid, ${normalized.clientEventId}::uuid,
          ${intentSha256}, ${normalized.customerId}, ${normalized.dueDate}::date, ${normalized.note},
          ${JSON.stringify(normalized.positions)}::jsonb
        )
      `);
      const outcome = result.length === 1 ? result[0] : null;
      if (!outcome || outcome.result_code !== "OK" || !outcome.result_quote_id || !UUID_PATTERN.test(outcome.result_quote_id)) {
        if (outcome?.result_code === "CONFLICT" || outcome?.result_code === "NOT_FOUND" || outcome?.result_code === "VALIDATION_ERROR") {
          return { code: outcome.result_code, message: outcome.result_code === "CONFLICT" ? "Anfragekennung wurde bereits anders verwendet." : outcome.result_code === "NOT_FOUND" ? "Kunde ist nicht verfügbar." : "KV-Daten sind ungültig." };
        }
        throw new Error("QUOTE_CREATE_RESULT_INVALID");
      }
      const quote = await readQuote(tx, authorization.tenantId, outcome.result_quote_id);
      const receipts = await tx.execute<CreateReceiptRow>(sql`
        SELECT * FROM private.v_quote_create_receipts_v1
        WHERE actor_id = ${authorization.userId}::uuid AND client_event_id = ${normalized.clientEventId}::uuid LIMIT 2
      `);
      const receipt = receipts.length === 1 ? receipts[0] : null;
      const recordedAt = receipt ? iso(receipt.recorded_at) : null;
      if (!quote || !receipt || receipt.integrity_ok !== true || receipt.tenant_id !== authorization.tenantId
        || receipt.quote_id !== quote.quoteId || receipt.customer_id !== normalized.customerId
        || receipt.actor_id !== authorization.userId || receipt.client_event_id !== normalized.clientEventId
        || receipt.intent_sha256 !== intentSha256 || !recordedAt) throw new Error("QUOTE_CREATE_READBACK_INVALID");
      return { code: "OK", quote, replayed: outcome.replayed, receipt: {
        receiptId: receipt.receipt_id, eventId: receipt.event_id, quoteId: receipt.quote_id,
        customerId: receipt.customer_id, actorId: receipt.actor_id, clientEventId: receipt.client_event_id,
        correlationId: receipt.correlation_id, recordedAt, aggregateVersion: 1,
      } };
    });
  } catch (error) {
    console.error("quote_create_command_failed", { message: diagnostic(error, "message"), details: diagnostic(error, "details"), hint: diagnostic(error, "hint") });
    return { code: "UNAVAILABLE", message: "KV konnte nicht sicher gespeichert werden." };
  }
}

export async function readQuoteCommand(authorization: QuoteCommandContext, input: { quoteId: string }): Promise<ReadQuoteResult> {
  if (!plainObject(input) || !exactKeys(input, ["quoteId"]) || typeof input.quoteId !== "string" || !UUID_PATTERN.test(input.quoteId)) return { code: "VALIDATION_ERROR", message: "KV-Kennung ist ungültig." };
  if (!authorization.capabilities.canReadQuote) return { code: "FORBIDDEN", message: "KV darf mit dieser Rolle nicht gelesen werden." };
  try {
    return await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const quote = await readQuote(tx, authorization.tenantId, input.quoteId);
      return quote ? { code: "OK", quote } : { code: "NOT_FOUND", message: "KV ist nicht verfügbar." };
    });
  } catch (error) {
    console.error("quote_read_failed", { message: diagnostic(error, "message"), details: diagnostic(error, "details"), hint: diagnostic(error, "hint") });
    return { code: "UNAVAILABLE", message: "KV konnte nicht sicher gelesen werden." };
  }
}

/** Read-only recovery for an interrupted KV create using the original client event. */
export async function readQuoteCreateReceiptCommand(
  authorization: QuoteCommandContext,
  input: unknown,
): Promise<ReadQuoteCreateReceiptResult> {
  const normalized = normalizeCreate(input);
  if (!normalized) return { code: "VALIDATION_ERROR", message: "Die gespeicherte KV-Anfrage kann nicht sicher geprüft werden." };
  if (!authorization.capabilities.canReadQuote) return { code: "FORBIDDEN", message: "Der gespeicherte KV-Stand darf mit dieser Rolle nicht gelesen werden." };
  const intentSha256 = hashIntent(normalized);
  try {
    return await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<CreateReceiptRow>(sql`
        SELECT * FROM private.v_quote_create_receipts_v1
        WHERE actor_id = ${authorization.userId}::uuid AND client_event_id = ${normalized.clientEventId}::uuid LIMIT 2
      `);
      if (rows.length === 0) return { code: "NOT_FOUND", message: "Zu dieser Anfrage wurde noch kein sicherer KV-Stand gefunden." };
      const receipt = rows.length === 1 ? rows[0] : null;
      const recordedAt = receipt ? iso(receipt.recorded_at) : null;
      if (!receipt || receipt.integrity_ok !== true || receipt.tenant_id !== authorization.tenantId
        || receipt.customer_id !== normalized.customerId || receipt.actor_id !== authorization.userId
        || receipt.client_event_id !== normalized.clientEventId || receipt.intent_sha256 !== intentSha256 || !recordedAt) {
        throw new Error("QUOTE_CREATE_RECEIPT_INVALID");
      }
      const quote = await readQuote(tx, authorization.tenantId, receipt.quote_id);
      if (!quote || quote.customerId !== normalized.customerId) throw new Error("QUOTE_CREATE_RECEIPT_READBACK_INVALID");
      return { code: "OK", quote, receipt: {
        receiptId: receipt.receipt_id, eventId: receipt.event_id, quoteId: receipt.quote_id, customerId: receipt.customer_id,
        actorId: receipt.actor_id, clientEventId: receipt.client_event_id, correlationId: receipt.correlation_id,
        recordedAt, aggregateVersion: 1,
      } };
    });
  } catch (error) {
    console.error("quote_create_receipt_read_failed", { message: diagnostic(error, "message"), details: diagnostic(error, "details"), hint: diagnostic(error, "hint") });
    return { code: "UNAVAILABLE", message: "Der gespeicherte KV-Stand konnte nicht sicher gelesen werden." };
  }
}

export async function prepareQuoteConversionCommand(authorization: QuoteCommandContext, input: unknown): Promise<PrepareQuoteConversionResult> {
  const normalized = normalizeConvert(input);
  if (!normalized) return { code: "VALIDATION_ERROR", message: "Beauftragungsdaten sind ungültig." };
  if (!authorization.capabilities.canConvertQuote) return { code: "FORBIDDEN", message: "KV darf mit dieser Rolle nicht beauftragt werden." };
  const intentSha256 = hashIntent(normalized);
  try {
    return await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const quote = await readQuote(tx, authorization.tenantId, normalized.quoteId);
      if (!quote) return { code: "NOT_FOUND", message: "KV ist nicht verfügbar." };
      const sourceOrderInput: QuoteOrderInput = {
        clientEventId: normalized.clientEventId,
        customer: { mode: "EXISTING", customerId: quote.customerId },
        dueDate: quote.dueDate,
        note: quote.note,
        items: quote.positions.map(({ name, quantity, material, surfaceRequested }) => ({
          name, quantity, material, surfaceRequested,
        })),
      };
      // The quote keeps the customer's requested date. The confirmed order date is
      // explicitly part of the immutable F1.1 intent and therefore of replay/conflict.
      const orderInput: QuoteOrderInput = {
        ...sourceOrderInput,
        dueDate: normalized.confirmedOrderDueDate,
      };
      const orderIntentSha256 = hashOrderIntent(orderInput);
      const rows = await tx.execute<{ result_code: string; order_input: unknown; replayed: boolean }>(sql`
        SELECT * FROM private.prepare_quote_conversion_v1(
          ${authorization.tenantId}, ${authorization.userId}::uuid, ${normalized.quoteId}::uuid,
          ${normalized.clientEventId}::uuid, ${intentSha256}, ${orderIntentSha256}, ${normalized.expectedVersion}
        )
      `);
      const result = rows.length === 1 ? rows[0] : null;
      if (!result || result.result_code !== "OK") {
        if (result?.result_code === "CONFLICT" || result?.result_code === "NOT_FOUND" || result?.result_code === "VALIDATION_ERROR") {
          return { code: result.result_code, message: result.result_code === "CONFLICT" ? "KV wurde bereits beauftragt oder zwischenzeitlich geändert." : result.result_code === "NOT_FOUND" ? "KV ist nicht verfügbar." : "Beauftragungsdaten sind ungültig." };
        }
        throw new Error("QUOTE_CONVERSION_PLAN_INVALID");
      }
      let persistedOrderInput: unknown = result.order_input;
      if (typeof persistedOrderInput === "string") {
        try {
          persistedOrderInput = JSON.parse(persistedOrderInput) as unknown;
        } catch {
          throw new Error("QUOTE_ORDER_INPUT_INVALID");
        }
      }
      // SQL preserves the quote's wish-date snapshot and its immutable order-intent
      // hash. The actual F1.1 input below uses the explicit promised date; changing
      // that date with the same client event conflicts on the stored hash.
      if (!plainObject(persistedOrderInput) || !plainObject(persistedOrderInput.customer)
        || persistedOrderInput.clientEventId !== normalized.clientEventId
        || persistedOrderInput.customer.mode !== "EXISTING" || persistedOrderInput.customer.customerId !== sourceOrderInput.customer.customerId
        || persistedOrderInput.dueDate !== sourceOrderInput.dueDate || persistedOrderInput.note !== sourceOrderInput.note
        || !Array.isArray(persistedOrderInput.items) || persistedOrderInput.items.length !== sourceOrderInput.items.length
        || !persistedOrderInput.items.every((item, index) => plainObject(item)
          && item.name === sourceOrderInput.items[index]?.name
          && item.quantity === sourceOrderInput.items[index]?.quantity
          && item.material === sourceOrderInput.items[index]?.material
          && item.surfaceRequested === sourceOrderInput.items[index]?.surfaceRequested)) throw new Error("QUOTE_ORDER_INPUT_INVALID");
      return { code: "OK", quoteId: normalized.quoteId, orderInput, replayed: result.replayed };
    });
  } catch (error) {
    console.error("quote_conversion_prepare_failed", { message: diagnostic(error, "message"), details: diagnostic(error, "details"), hint: diagnostic(error, "hint") });
    return { code: "UNAVAILABLE", message: "KV konnte nicht sicher beauftragt werden." };
  }
}

export async function readQuoteConversionReceiptCommand(
  authorization: QuoteCommandContext,
  input: { quoteId: string; clientEventId: string },
): Promise<ReadQuoteConversionReceiptResult> {
  if (!plainObject(input) || !exactKeys(input, ["clientEventId", "quoteId"]) || typeof input.quoteId !== "string" || !UUID_PATTERN.test(input.quoteId)
    || typeof input.clientEventId !== "string" || !UUID_PATTERN.test(input.clientEventId)) return { code: "VALIDATION_ERROR", message: "Receipt-Kennung ist ungültig." };
  if (!authorization.capabilities.canReadQuote) return { code: "FORBIDDEN", message: "Beauftragungsbeleg darf mit dieser Rolle nicht gelesen werden." };
  try {
    return await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<ConversionReceiptRow>(sql`
        SELECT * FROM private.v_quote_conversion_receipts_v1
        WHERE quote_id = ${input.quoteId}::uuid AND actor_id = ${authorization.userId}::uuid
          AND client_event_id = ${input.clientEventId}::uuid LIMIT 2
      `);
      const row = rows.length === 1 ? rows[0] : null;
      const recordedAt = row ? iso(row.recorded_at) : null;
      const quote = await readQuote(tx, authorization.tenantId, input.quoteId);
      if (!row) return { code: "NOT_FOUND", message: "Beauftragungsbeleg ist nicht verfügbar." };
      if (!quote || row.integrity_ok !== true || row.tenant_id !== authorization.tenantId || row.quote_version !== 2
        || row.quote_id !== quote.quoteId || row.order_id !== quote.linkedOrderId || !recordedAt) throw new Error("QUOTE_CONVERSION_RECEIPT_INVALID");
      const receipt: QuoteConversionReceipt = {
        receiptId: row.receipt_id, eventId: row.event_id, quoteId: row.quote_id, customerId: row.customer_id,
        orderId: row.order_id, orderIntakeEventId: row.order_intake_event_id, actorId: row.actor_id,
        clientEventId: row.client_event_id, correlationId: row.correlation_id, recordedAt, aggregateVersion: 2,
      };
      return { code: "OK", receipt, quote };
    });
  } catch (error) {
    console.error("quote_conversion_receipt_failed", { message: diagnostic(error, "message"), details: diagnostic(error, "details"), hint: diagnostic(error, "hint") });
    return { code: "UNAVAILABLE", message: "Beauftragungsbeleg konnte nicht sicher gelesen werden." };
  }
}
