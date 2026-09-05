import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { sql } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";
import {
  withPrivilegedTenantTransaction,
  type PrivilegedTenantTransaction,
} from "@/lib/server/privilegedDb";
import {
  isPaymentMode,
  PAYMENT_CONTRACT_VERSION,
  type PaymentMode,
} from "@/lib/server/paymentContract";
import {
  createImmutableInvoiceCancellationPdfDocument,
  createImmutableInvoicePdfDocument,
  type ImmutableInvoiceBaseLine,
  type ImmutableInvoiceExtraWorkLine,
  type ImmutableInvoiceLine,
  type ImmutableInvoiceSnapshot,
} from "@/lib/pdf/ImmutableInvoiceDocument";

/**
 * F1.4 — immutable issue/cancellation lifecycle on the single public.invoices
 * truth. Both commands are tenant-bound, versioned, idempotent and confirmed
 * by a separate event/invoice/PDF receipt readback inside the transaction.
 */

const EVENT_TYPE = "INVOICE_CREATED_V1";
const CANCEL_EVENT_TYPE = "INVOICE_CANCELLED_V1";
const EVENT_SCHEMA_VERSION = 1 as const;
const STATION = "fertig" as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const INVOICE_NUMBER_PATTERN = /^R-[0-9]{4}-[0-9]{4,}$/;
const HEX64_PATTERN = /^[a-f0-9]{64}$/;
/** Canonical UTC instant, exactly as `to_char(... 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')` emits it. */
const ISO_INSTANT_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
const INVOICE_ISSUE_ROLES = ["buero", "meister", "admin"] as const;
const INVOICE_CANCEL_ROLES = ["meister", "admin"] as const;

export type CreateInvoiceInput = {
  orderId: string;
  expectedVersion: number;
  clientEventId: string;
};

export type ImmutableInvoiceReceipt = {
  invoiceId: string;
  invoiceNumber: string;
  orderId: string;
  orderVersion: number;
  status: "issued";
  netAmountCents: number;
  vatRateBasisPoints: number;
  vatAmountCents: number;
  grossAmountCents: number;
  serviceDate: string;
  dueDate: string;
  issuedAt: string;
  issuedBy: string;
  pdfRef: string;
  pdfSha256: string;
  eventId: string;
  clientEventId: string;
  correlationId: string;
  aggregateVersion: 1;
  eventSchemaVersion: 1;
};

export type CreateInvoiceResult =
  | { code: "OK"; receipt: ImmutableInvoiceReceipt; replayed: boolean }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

export type CancelInvoiceInput = {
  invoiceId: string;
  expectedVersion: number;
  reason: string;
  clientEventId: string;
};

export type ImmutableInvoiceCancellationReceipt = {
  invoiceId: string;
  invoiceNumber: string;
  orderId: string;
  orderVersion: number;
  status: "cancelled";
  reason: string;
  cancelledAt: string;
  cancelledBy: string;
  originalPdfSha256: string;
  cancellationPdfRef: string;
  cancellationPdfSha256: string;
  eventId: string;
  clientEventId: string;
  correlationId: string;
  expectedVersion: 1;
  aggregateVersion: 2;
  eventSchemaVersion: 1;
};

export type CancelInvoiceResult =
  | { code: "OK"; receipt: ImmutableInvoiceCancellationReceipt; replayed: boolean }
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
  status: string;
  version: number;
  payment_mode: string;
  payment_mode_version: number;
};

type InvoicePaymentInitializationRow = {
  id: string;
  tenant_id: string;
  order_id: string;
  gross_amount_cents: number | string | null;
  payment_contract_version: number | string | null;
  payment_mode: string | null;
  payment_status: string | null;
  payment_open_amount_cents: number | string | null;
  payment_paid_amount_cents: number | string | null;
  payment_currency: string | null;
  payment_method: string | null;
  payment_paid_at: Date | string | null;
  payment_receipt_id: string | null;
  payment_event_id: string | null;
  payment_correlation_id: string | null;
  payment_version: number | string | null;
};

type SourceRow = {
  tenant_id: string;
  order_id: string;
  freeze_id: string;
  order_number: string;
  order_title: string;
  customer_id: string;
  customer_name: string;
  customer_company_name: string | null;
  customer_contact_person: string | null;
  customer_street: string | null;
  customer_zip: string | null;
  customer_city: string | null;
  customer_country: string | null;
  seller_company_name: string | null;
  seller_street: string | null;
  seller_zip: string | null;
  seller_city: string | null;
  seller_country: string | null;
  seller_tax_id: string | null;
  seller_iban: string | null;
  seller_bic: string | null;
  seller_bank_name: string | null;
  invoice_vat_rate_basis_points: number | null;
  invoice_payment_term_days: number | null;
  base_lines: unknown;
  base_line_count: number;
  base_net_amount_cents: number | string;
  extra_work_lines: unknown;
  extra_work_line_count: number;
  extra_work_net_amount_cents: number | string;
  seller_config_complete: boolean;
  customer_config_complete: boolean;
  base_prices_complete: boolean;
  no_active_invoice: boolean;
  integrity_ok: boolean;
  current_order_version: number;
  service_date: Date | string;
};

type ReceiptRow = {
  event_id: string;
  tenant_id: string;
  order_id: string;
  event_type: string;
  client_event_id: string;
  correlation_id: string;
  event_schema_version: number;
  aggregate_version: number;
  actor_id: string;
  occurred_at: Date | string;
  invoice_id: string;
  invoice_number: string;
  order_version: number | string;
  intent_expected_version: number | string;
  current_status: string;
  current_version: number;
  net_amount_cents: number | string;
  vat_rate_basis_points: number;
  vat_amount_cents: number | string;
  gross_amount_cents: number | string;
  service_date: Date | string;
  due_date: Date | string;
  pdf_ref: string;
  pdf_sha256: string;
  cancel_reason: string | null;
  original_pdf_sha256: string;
  integrity_ok: boolean;
};

type LockedInvoice = {
  id: string;
  tenant_id: string;
  order_id: string;
  invoice_number: string;
  status: string;
  aggregate_version: number;
  snapshot: unknown;
  due_date: Date | string;
  pdf_ref: string;
  pdf_sha256: string;
  pdf_content: Buffer | Uint8Array;
};

function isValidInput(input: unknown): input is CreateInvoiceInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  const expected = ["clientEventId", "expectedVersion", "orderId"];
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index])
    && typeof value.orderId === "string"
    && value.orderId.trim() === value.orderId
    && value.orderId.length > 0
    && value.orderId.length <= 128
    && typeof value.clientEventId === "string"
    && UUID_PATTERN.test(value.clientEventId)
    && typeof value.expectedVersion === "number"
    && Number.isSafeInteger(value.expectedVersion)
    && value.expectedVersion > 0;
}

function isValidCancelInput(input: unknown): input is CancelInvoiceInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  const expected = ["clientEventId", "expectedVersion", "invoiceId", "reason"];
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index])
    && typeof value.invoiceId === "string"
    && UUID_PATTERN.test(value.invoiceId)
    && typeof value.clientEventId === "string"
    && UUID_PATTERN.test(value.clientEventId)
    && typeof value.expectedVersion === "number"
    && Number.isSafeInteger(value.expectedVersion)
    && value.expectedVersion > 0
    && typeof value.reason === "string"
    && value.reason === value.reason.trim()
    && value.reason.length >= 5
    && value.reason.length <= 500;
}

/**
 * F1.4 — a missing or unusable mandatory master-data value is a user-fixable
 * validation outcome, never an infrastructure failure. It is raised as its own
 * error type so `createInvoice` can fail closed with the existing
 * VALIDATION_ERROR result *before* an invoice number is allocated.
 */
class InvoiceMasterDataError extends Error {}

function toIso(value: unknown): string {
  const parsed = value instanceof Date ? value : new Date(value as string);
  if (!Number.isFinite(parsed.getTime())) throw new Error("INVOICE_TIME_INVALID");
  return parsed.toISOString();
}

/**
 * Accepts only the canonical UTC instant the database emitted for this
 * command. No re-parsing, no fallback and no local-time interpretation: the
 * exact same string is written to invoice, event, snapshot and receipt.
 */
function requireIsoInstant(value: unknown, error: string): string {
  if (typeof value !== "string" || !ISO_INSTANT_PATTERN.test(value)) throw new Error(error);
  return value;
}

function toDateOnly(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && value.length >= 10) return value.slice(0, 10);
  throw new Error("INVOICE_DATE_INVALID");
}

function toSafeInteger(value: unknown, error: string): number {
  // `Number(null)` and `Number("")` are 0; a missing numeric value must never
  // silently become a valid zero amount, quantity or term.
  if (value === null || value === undefined) throw new Error(error);
  if (typeof value === "string" && value.trim().length === 0) throw new Error(error);
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(error);
  return parsed;
}

function requiredText(value: unknown, error: string): string {
  if (typeof value !== "string") throw new Error(error);
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error(error);
  return trimmed;
}

/** Same contract as `requiredText`, but for tenant-fixable master data. */
function masterDataText(value: unknown, error: string): string {
  if (typeof value !== "string") throw new InvoiceMasterDataError(error);
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new InvoiceMasterDataError(error);
  return trimmed;
}

function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function parseBaseLines(value: unknown): ImmutableInvoiceBaseLine[] {
  if (!Array.isArray(value)) throw new Error("INVOICE_BASE_LINES_INVALID");
  return value.map((entry) => {
    if (!plainObject(entry) || !exactKeys(entry, [
      "itemId", "lineNetAmountCents", "name", "quantity", "unitNetAmountCents",
    ])) throw new Error("INVOICE_BASE_LINE_SHAPE_INVALID");
    const quantity = toSafeInteger(entry.quantity, "INVOICE_BASE_LINE_QUANTITY_INVALID");
    const unitNetAmountCents = toSafeInteger(entry.unitNetAmountCents, "INVOICE_BASE_LINE_UNIT_INVALID");
    const lineNetAmountCents = toSafeInteger(entry.lineNetAmountCents, "INVOICE_BASE_LINE_TOTAL_INVALID");
    const itemId = requiredText(entry.itemId, "INVOICE_BASE_LINE_ITEM_INVALID");
    const name = masterDataText(entry.name, "INVOICE_BASE_LINE_NAME_INVALID");
    // Position name, quantity and price are tenant master data: fail closed as
    // a validation outcome, never as an infrastructure error.
    if (quantity < 1 || unitNetAmountCents < 0) {
      throw new InvoiceMasterDataError("INVOICE_BASE_LINE_MASTER_DATA_INVALID");
    }
    if (lineNetAmountCents !== unitNetAmountCents * quantity) {
      throw new Error("INVOICE_BASE_LINE_INTEGRITY_INVALID");
    }
    return { type: "BASE" as const, itemId, name, quantity, unitNetAmountCents, lineNetAmountCents };
  });
}

function parseExtraWorkLines(value: unknown): ImmutableInvoiceExtraWorkLine[] {
  if (!Array.isArray(value)) throw new Error("INVOICE_EXTRA_WORK_LINES_INVALID");
  return value.map((entry) => {
    if (!plainObject(entry) || !exactKeys(entry, [
      "amountCents", "catalogPositionId", "catalogPositionName", "hourlyRateCents", "itemId", "minutes",
    ])) throw new Error("INVOICE_EXTRA_WORK_LINE_SHAPE_INVALID");
    const minutes = toSafeInteger(entry.minutes, "INVOICE_EXTRA_WORK_MINUTES_INVALID");
    const hourlyRateCents = toSafeInteger(entry.hourlyRateCents, "INVOICE_EXTRA_WORK_RATE_INVALID");
    const amountCents = toSafeInteger(entry.amountCents, "INVOICE_EXTRA_WORK_AMOUNT_INVALID");
    const itemId = requiredText(entry.itemId, "INVOICE_EXTRA_WORK_ITEM_INVALID");
    const catalogPositionId = requiredText(entry.catalogPositionId, "INVOICE_EXTRA_WORK_POSITION_ID_INVALID");
    const catalogPositionName = requiredText(entry.catalogPositionName, "INVOICE_EXTRA_WORK_POSITION_NAME_INVALID");
    if (
      !UUID_PATTERN.test(catalogPositionId)
      || minutes < 1
      || hourlyRateCents < 1
      || amountCents !== Math.floor((minutes * hourlyRateCents + 30) / 60)
    ) throw new Error("INVOICE_EXTRA_WORK_LINE_INTEGRITY_INVALID");
    return {
      type: "EXTRA_WORK" as const,
      itemId,
      catalogPositionId,
      catalogPositionName,
      minutes,
      hourlyRateCents,
      amountCents,
    };
  });
}

function parseStoredLine(value: unknown): ImmutableInvoiceLine {
  if (!plainObject(value) || typeof value.type !== "string") {
    throw new Error("INVOICE_SNAPSHOT_LINE_INVALID");
  }
  if (value.type === "BASE") {
    if (!exactKeys(value, [
      "itemId", "lineNetAmountCents", "name", "quantity", "type", "unitNetAmountCents",
    ])) throw new Error("INVOICE_SNAPSHOT_BASE_LINE_SHAPE_INVALID");
    const parsed = parseBaseLines([{
      itemId: value.itemId,
      lineNetAmountCents: value.lineNetAmountCents,
      name: value.name,
      quantity: value.quantity,
      unitNetAmountCents: value.unitNetAmountCents,
    }]);
    const line = parsed[0];
    if (!line) throw new Error("INVOICE_SNAPSHOT_BASE_LINE_INVALID");
    return line;
  }
  if (value.type === "EXTRA_WORK") {
    if (!exactKeys(value, [
      "amountCents", "catalogPositionId", "catalogPositionName", "hourlyRateCents",
      "itemId", "minutes", "type",
    ])) throw new Error("INVOICE_SNAPSHOT_EXTRA_WORK_LINE_SHAPE_INVALID");
    const parsed = parseExtraWorkLines([{
      amountCents: value.amountCents,
      catalogPositionId: value.catalogPositionId,
      catalogPositionName: value.catalogPositionName,
      hourlyRateCents: value.hourlyRateCents,
      itemId: value.itemId,
      minutes: value.minutes,
    }]);
    const line = parsed[0];
    if (!line) throw new Error("INVOICE_SNAPSHOT_EXTRA_WORK_LINE_INVALID");
    return line;
  }
  throw new Error("INVOICE_SNAPSHOT_LINE_TYPE_INVALID");
}

function parseStoredSnapshot(value: unknown, invoice: LockedInvoice): ImmutableInvoiceSnapshot {
  if (!plainObject(value) || !exactKeys(value, [
    "customer", "issuedAt", "lines", "order", "paymentTermDays", "schemaVersion",
    "seller", "serviceDate", "totals",
  ])) throw new Error("INVOICE_SNAPSHOT_SHAPE_INVALID");
  if (value.schemaVersion !== 1 || !plainObject(value.seller) || !plainObject(value.customer)
    || !plainObject(value.order) || !plainObject(value.totals) || !Array.isArray(value.lines)) {
    throw new Error("INVOICE_SNAPSHOT_TYPE_INVALID");
  }
  if (!exactKeys(value.seller, [
    "bankName", "bic", "city", "companyName", "country", "iban", "street", "taxId", "zip",
  ])) throw new Error("INVOICE_SNAPSHOT_SELLER_SHAPE_INVALID");
  if (!exactKeys(value.customer, [
    "city", "companyName", "contactPerson", "country", "name", "street", "zip",
  ])) throw new Error("INVOICE_SNAPSHOT_CUSTOMER_SHAPE_INVALID");
  if (!exactKeys(value.order, ["freezeId", "orderId", "orderNumber", "orderVersion", "title"])) {
    throw new Error("INVOICE_SNAPSHOT_ORDER_SHAPE_INVALID");
  }
  if (!exactKeys(value.totals, [
    "grossAmountCents", "netAmountCents", "vatAmountCents", "vatRateBasisPoints",
  ])) throw new Error("INVOICE_SNAPSHOT_TOTALS_SHAPE_INVALID");

  const orderVersion = toSafeInteger(value.order.orderVersion, "INVOICE_SNAPSHOT_ORDER_VERSION_INVALID");
  const netAmountCents = toSafeInteger(value.totals.netAmountCents, "INVOICE_SNAPSHOT_NET_INVALID");
  const vatRateBasisPoints = toSafeInteger(value.totals.vatRateBasisPoints, "INVOICE_SNAPSHOT_VAT_RATE_INVALID");
  const vatAmountCents = toSafeInteger(value.totals.vatAmountCents, "INVOICE_SNAPSHOT_VAT_INVALID");
  const grossAmountCents = toSafeInteger(value.totals.grossAmountCents, "INVOICE_SNAPSHOT_GROSS_INVALID");
  const paymentTermDays = toSafeInteger(value.paymentTermDays, "INVOICE_SNAPSHOT_PAYMENT_TERM_INVALID");
  const issuedAt = toIso(value.issuedAt);
  const serviceDate = toDateOnly(value.serviceDate);
  const lines = value.lines.map(parseStoredLine);
  if (
    value.order.orderId !== invoice.order_id
    || orderVersion < 1
    || lines.length < 1
    || netAmountCents < 0
    || ![700, 1900].includes(vatRateBasisPoints)
    || vatAmountCents !== Math.round((netAmountCents * vatRateBasisPoints) / 10000)
    || grossAmountCents !== netAmountCents + vatAmountCents
    || paymentTermDays < 1
    || paymentTermDays > 365
  ) throw new Error("INVOICE_SNAPSHOT_INTEGRITY_INVALID");

  const optionalSnapshotText = (input: unknown, error: string): string | null => {
    if (input === null) return null;
    return requiredText(input, error);
  };

  return {
    schemaVersion: 1,
    seller: {
      companyName: requiredText(value.seller.companyName, "INVOICE_SNAPSHOT_SELLER_NAME_INVALID"),
      street: requiredText(value.seller.street, "INVOICE_SNAPSHOT_SELLER_STREET_INVALID"),
      zip: requiredText(value.seller.zip, "INVOICE_SNAPSHOT_SELLER_ZIP_INVALID"),
      city: requiredText(value.seller.city, "INVOICE_SNAPSHOT_SELLER_CITY_INVALID"),
      country: requiredText(value.seller.country, "INVOICE_SNAPSHOT_SELLER_COUNTRY_INVALID"),
      taxId: requiredText(value.seller.taxId, "INVOICE_SNAPSHOT_SELLER_TAX_INVALID"),
      iban: requiredText(value.seller.iban, "INVOICE_SNAPSHOT_SELLER_IBAN_INVALID"),
      bic: requiredText(value.seller.bic, "INVOICE_SNAPSHOT_SELLER_BIC_INVALID"),
      bankName: requiredText(value.seller.bankName, "INVOICE_SNAPSHOT_SELLER_BANK_INVALID"),
    },
    customer: {
      name: requiredText(value.customer.name, "INVOICE_SNAPSHOT_CUSTOMER_NAME_INVALID"),
      companyName: optionalSnapshotText(value.customer.companyName, "INVOICE_SNAPSHOT_CUSTOMER_COMPANY_INVALID"),
      contactPerson: optionalSnapshotText(value.customer.contactPerson, "INVOICE_SNAPSHOT_CUSTOMER_CONTACT_INVALID"),
      street: requiredText(value.customer.street, "INVOICE_SNAPSHOT_CUSTOMER_STREET_INVALID"),
      zip: requiredText(value.customer.zip, "INVOICE_SNAPSHOT_CUSTOMER_ZIP_INVALID"),
      city: requiredText(value.customer.city, "INVOICE_SNAPSHOT_CUSTOMER_CITY_INVALID"),
      country: requiredText(value.customer.country, "INVOICE_SNAPSHOT_CUSTOMER_COUNTRY_INVALID"),
    },
    order: {
      orderId: requiredText(value.order.orderId, "INVOICE_SNAPSHOT_ORDER_ID_INVALID"),
      orderVersion,
      orderNumber: requiredText(value.order.orderNumber, "INVOICE_SNAPSHOT_ORDER_NUMBER_INVALID"),
      title: requiredText(value.order.title, "INVOICE_SNAPSHOT_ORDER_TITLE_INVALID"),
      freezeId: requiredText(value.order.freezeId, "INVOICE_SNAPSHOT_FREEZE_ID_INVALID"),
    },
    lines,
    totals: { netAmountCents, vatRateBasisPoints, vatAmountCents, grossAmountCents },
    serviceDate,
    issuedAt,
    paymentTermDays,
  };
}

type PreparedInvoiceContent = {
  seller: ImmutableInvoiceSnapshot["seller"];
  customer: ImmutableInvoiceSnapshot["customer"];
  order: ImmutableInvoiceSnapshot["order"];
  lines: ImmutableInvoiceLine[];
  totals: ImmutableInvoiceSnapshot["totals"];
};

/**
 * Builds every snapshot part that depends on live master data and frozen
 * lines. It runs *before* the number allocation so an incomplete tenant,
 * customer, order or position leaves invoice, lifecycle event and counter
 * completely untouched.
 */
function prepareInvoiceContent(
  source: SourceRow,
  order: LockedOrder,
  vatRateBasisPoints: number,
): PreparedInvoiceContent {
  const baseLines = parseBaseLines(source.base_lines);
  const extraWorkLines = parseExtraWorkLines(source.extra_work_lines);
  if (
    baseLines.length !== toSafeInteger(source.base_line_count, "INVOICE_BASE_LINE_COUNT_INVALID")
    || extraWorkLines.length !== toSafeInteger(source.extra_work_line_count, "INVOICE_EXTRA_WORK_LINE_COUNT_INVALID")
  ) throw new Error("INVOICE_LINE_COUNT_MISMATCH");
  if (baseLines.length < 1) {
    throw new InvoiceMasterDataError("INVOICE_BASE_LINES_MISSING");
  }

  const baseNetAmountCents = toSafeInteger(source.base_net_amount_cents, "INVOICE_BASE_AMOUNT_INVALID");
  const extraWorkNetAmountCents = toSafeInteger(source.extra_work_net_amount_cents, "INVOICE_EXTRA_WORK_AMOUNT_TOTAL_INVALID");
  if (
    baseLines.reduce((sum, line) => sum + line.lineNetAmountCents, 0) !== baseNetAmountCents
    || extraWorkLines.reduce((sum, line) => sum + line.amountCents, 0) !== extraWorkNetAmountCents
  ) throw new Error("INVOICE_LINE_TOTAL_MISMATCH");

  const netAmountCents = baseNetAmountCents + extraWorkNetAmountCents;
  const vatAmountCents = Math.round((netAmountCents * vatRateBasisPoints) / 10000);
  const grossAmountCents = netAmountCents + vatAmountCents;
  if (
    !Number.isSafeInteger(netAmountCents)
    || !Number.isSafeInteger(vatAmountCents)
    || !Number.isSafeInteger(grossAmountCents)
    || netAmountCents < 0
  ) throw new Error("INVOICE_AMOUNT_UNSAFE");

  return {
    seller: {
      companyName: masterDataText(source.seller_company_name, "INVOICE_SELLER_NAME_INVALID"),
      street: masterDataText(source.seller_street, "INVOICE_SELLER_STREET_INVALID"),
      zip: masterDataText(source.seller_zip, "INVOICE_SELLER_ZIP_INVALID"),
      city: masterDataText(source.seller_city, "INVOICE_SELLER_CITY_INVALID"),
      country: masterDataText(source.seller_country, "INVOICE_SELLER_COUNTRY_INVALID"),
      taxId: masterDataText(source.seller_tax_id, "INVOICE_SELLER_TAX_ID_INVALID"),
      iban: masterDataText(source.seller_iban, "INVOICE_SELLER_IBAN_INVALID"),
      bic: masterDataText(source.seller_bic, "INVOICE_SELLER_BIC_INVALID"),
      bankName: masterDataText(source.seller_bank_name, "INVOICE_SELLER_BANK_NAME_INVALID"),
    },
    customer: {
      name: masterDataText(source.customer_name, "INVOICE_CUSTOMER_NAME_INVALID"),
      companyName: optionalText(source.customer_company_name),
      contactPerson: optionalText(source.customer_contact_person),
      street: masterDataText(source.customer_street, "INVOICE_CUSTOMER_STREET_INVALID"),
      zip: masterDataText(source.customer_zip, "INVOICE_CUSTOMER_ZIP_INVALID"),
      city: masterDataText(source.customer_city, "INVOICE_CUSTOMER_CITY_INVALID"),
      country: masterDataText(source.customer_country, "INVOICE_CUSTOMER_COUNTRY_INVALID"),
    },
    order: {
      orderId: order.id,
      orderVersion: order.version,
      orderNumber: masterDataText(source.order_number, "INVOICE_ORDER_NUMBER_INVALID"),
      title: masterDataText(source.order_title, "INVOICE_ORDER_TITLE_INVALID"),
      freezeId: requiredText(source.freeze_id, "INVOICE_FREEZE_ID_INVALID"),
    },
    lines: [...baseLines, ...extraWorkLines] as ImmutableInvoiceLine[],
    totals: { netAmountCents, vatRateBasisPoints, vatAmountCents, grossAmountCents },
  };
}

function mapReceipt(row: ReceiptRow, tenantId: string, actorId: string): ImmutableInvoiceReceipt {
  const orderVersion = toSafeInteger(row.order_version, "INVOICE_RECEIPT_ORDER_VERSION_INVALID");
  const intentExpectedVersion = toSafeInteger(
    row.intent_expected_version,
    "INVOICE_RECEIPT_INTENT_VERSION_INVALID",
  );
  const netAmountCents = toSafeInteger(row.net_amount_cents, "INVOICE_RECEIPT_NET_INVALID");
  const vatAmountCents = toSafeInteger(row.vat_amount_cents, "INVOICE_RECEIPT_VAT_INVALID");
  const grossAmountCents = toSafeInteger(row.gross_amount_cents, "INVOICE_RECEIPT_GROSS_INVALID");
  const vatRateBasisPoints = toSafeInteger(row.vat_rate_basis_points, "INVOICE_RECEIPT_RATE_INVALID");
  const aggregateVersion = toSafeInteger(row.aggregate_version, "INVOICE_RECEIPT_VERSION_INVALID");
  const eventSchemaVersion = toSafeInteger(row.event_schema_version, "INVOICE_RECEIPT_SCHEMA_INVALID");
  const serviceDate = toDateOnly(row.service_date);
  const dueDate = toDateOnly(row.due_date);
  const currentLifecycleValid = (
    row.current_status === "issued"
    && row.current_version === 1
    && row.cancel_reason === null
  ) || (
    row.current_status === "cancelled"
    && row.current_version === 2
    && typeof row.cancel_reason === "string"
    && row.cancel_reason === row.cancel_reason.trim()
    && row.cancel_reason.length >= 5
    && row.cancel_reason.length <= 500
  );
  if (
    row.integrity_ok !== true
    || row.tenant_id !== tenantId
    || row.actor_id !== actorId
    || row.event_type !== EVENT_TYPE
    || eventSchemaVersion !== EVENT_SCHEMA_VERSION
    || aggregateVersion !== 1
    || !currentLifecycleValid
    || orderVersion < 1
    || intentExpectedVersion !== orderVersion
    || !UUID_PATTERN.test(row.event_id)
    || !UUID_PATTERN.test(row.client_event_id)
    || !UUID_PATTERN.test(row.correlation_id)
    || !UUID_PATTERN.test(row.invoice_id)
    || !INVOICE_NUMBER_PATTERN.test(row.invoice_number)
    || row.pdf_ref !== `invoice://${row.invoice_id}/original`
    || !HEX64_PATTERN.test(row.pdf_sha256)
    || row.original_pdf_sha256 !== row.pdf_sha256
    || netAmountCents < 0
    || vatAmountCents < 0
    || ![700, 1900].includes(vatRateBasisPoints)
    || grossAmountCents !== netAmountCents + vatAmountCents
    || vatAmountCents !== Math.round((netAmountCents * vatRateBasisPoints) / 10000)
  ) throw new Error("INVOICE_RECEIPT_INVALID");

  return {
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    orderId: row.order_id,
    orderVersion,
    status: "issued",
    netAmountCents,
    vatRateBasisPoints,
    vatAmountCents,
    grossAmountCents,
    serviceDate,
    dueDate,
    issuedAt: toIso(row.occurred_at),
    issuedBy: row.actor_id,
    pdfRef: row.pdf_ref,
    pdfSha256: row.pdf_sha256,
    eventId: row.event_id,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    aggregateVersion: 1,
    eventSchemaVersion: 1,
  };
}

function mapCancellationReceipt(
  row: ReceiptRow,
  tenantId: string,
  actorId: string,
): ImmutableInvoiceCancellationReceipt {
  const orderVersion = toSafeInteger(row.order_version, "INVOICE_CANCEL_RECEIPT_ORDER_VERSION_INVALID");
  const expectedVersion = toSafeInteger(
    row.intent_expected_version,
    "INVOICE_CANCEL_RECEIPT_EXPECTED_VERSION_INVALID",
  );
  const aggregateVersion = toSafeInteger(row.aggregate_version, "INVOICE_CANCEL_RECEIPT_VERSION_INVALID");
  const eventSchemaVersion = toSafeInteger(
    row.event_schema_version,
    "INVOICE_CANCEL_RECEIPT_SCHEMA_INVALID",
  );
  const reason = requiredText(row.cancel_reason, "INVOICE_CANCEL_RECEIPT_REASON_INVALID");
  if (
    row.integrity_ok !== true
    || row.tenant_id !== tenantId
    || row.actor_id !== actorId
    || row.event_type !== CANCEL_EVENT_TYPE
    || eventSchemaVersion !== EVENT_SCHEMA_VERSION
    || expectedVersion !== 1
    || aggregateVersion !== 2
    || row.current_version !== 2
    || row.current_status !== "cancelled"
    || orderVersion < 1
    || reason.length < 5
    || reason.length > 500
    || !UUID_PATTERN.test(row.event_id)
    || !UUID_PATTERN.test(row.client_event_id)
    || !UUID_PATTERN.test(row.correlation_id)
    || !UUID_PATTERN.test(row.invoice_id)
    || !INVOICE_NUMBER_PATTERN.test(row.invoice_number)
    || row.pdf_ref !== `invoice://${row.invoice_id}/cancellation`
    || !HEX64_PATTERN.test(row.pdf_sha256)
    || !HEX64_PATTERN.test(row.original_pdf_sha256)
  ) throw new Error("INVOICE_CANCEL_RECEIPT_INVALID");

  return {
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    orderId: row.order_id,
    orderVersion,
    status: "cancelled",
    reason,
    cancelledAt: toIso(row.occurred_at),
    cancelledBy: row.actor_id,
    originalPdfSha256: row.original_pdf_sha256,
    cancellationPdfRef: row.pdf_ref,
    cancellationPdfSha256: row.pdf_sha256,
    eventId: row.event_id,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    expectedVersion: 1,
    aggregateVersion: 2,
    eventSchemaVersion: 1,
  };
}

function receiptMatchesIntent(receipt: ImmutableInvoiceReceipt, input: CreateInvoiceInput): boolean {
  return receipt.orderId === input.orderId
    && receipt.orderVersion === input.expectedVersion;
}

function cancellationReceiptMatchesIntent(
  receipt: ImmutableInvoiceCancellationReceipt,
  input: CancelInvoiceInput,
): boolean {
  return receipt.invoiceId === input.invoiceId
    && receipt.expectedVersion === input.expectedVersion
    && receipt.reason === input.reason;
}

async function readInitialPaymentState(
  tx: PrivilegedTenantTransaction,
  expected: {
    tenantId: string;
    invoiceId: string;
    orderId: string;
    grossAmountCents: number;
    paymentMode: PaymentMode;
  },
): Promise<void> {
  const rows = await tx.execute<InvoicePaymentInitializationRow>(sql`
    SELECT
      id::text,
      tenant_id,
      order_id,
      gross_amount_cents,
      payment_contract_version,
      payment_mode,
      payment_status,
      payment_open_amount_cents,
      payment_paid_amount_cents,
      payment_currency,
      payment_method,
      payment_paid_at,
      payment_receipt_id,
      payment_event_id,
      payment_correlation_id::text,
      payment_version
    FROM public.invoices
    WHERE id = ${expected.invoiceId}::uuid
      AND tenant_id = ${expected.tenantId}
      AND order_id = ${expected.orderId}
    LIMIT 2
  `);
  const row = rows[0];
  if (
    rows.length !== 1 || !row || row.id !== expected.invoiceId ||
    row.tenant_id !== expected.tenantId || row.order_id !== expected.orderId ||
    toSafeInteger(row.gross_amount_cents, "INVOICE_PAYMENT_GROSS_INVALID") !== expected.grossAmountCents ||
    toSafeInteger(row.payment_contract_version, "INVOICE_PAYMENT_CONTRACT_INVALID") !== PAYMENT_CONTRACT_VERSION ||
    row.payment_mode !== expected.paymentMode || row.payment_status !== "offen" ||
    toSafeInteger(row.payment_open_amount_cents, "INVOICE_PAYMENT_OPEN_INVALID") !== expected.grossAmountCents ||
    toSafeInteger(row.payment_paid_amount_cents, "INVOICE_PAYMENT_PAID_INVALID") !== 0 ||
    row.payment_currency !== "EUR" || row.payment_method !== null || row.payment_paid_at !== null ||
    row.payment_receipt_id !== null || row.payment_event_id !== null || row.payment_correlation_id !== null ||
    toSafeInteger(row.payment_version, "INVOICE_PAYMENT_VERSION_INVALID") !== 0
  ) {
    throw new Error("INVOICE_PAYMENT_INITIALIZATION_READBACK_INVALID");
  }
}

export async function createInvoice(input: unknown): Promise<CreateInvoiceResult> {
  if (!isValidInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Rechnungsanfrage." };
  }

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: "Rechnung konnte nicht sicher ausgestellt werden." };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: "Rechnung konnte nicht sicher ausgestellt werden." }
      : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }
  if (!INVOICE_ISSUE_ROLES.includes(authorization.data.role as (typeof INVOICE_ISSUE_ROLES)[number])) {
    return { code: "FORBIDDEN", message: "Rechnungsausgabe ist mit dieser Rolle nicht erlaubt." };
  }

  const tenantId = authorization.data.tenantId;
  const actorId = authorization.data.userId;

  try {
    return await withPrivilegedTenantTransaction(authorization.data, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended('f1:invoice:client-event:' || ${tenantId} || ':' || ${input.clientEventId}, 0)
        )
      `);
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended('f1:invoice:order:' || ${tenantId} || ':' || ${input.orderId}, 0)
        )
      `);

      const replayRows = await tx.execute<ReceiptRow>(sql`
        SELECT *
        FROM private.v_invoice_receipt_v1
        WHERE client_event_id = ${input.clientEventId}
          AND event_type = ${EVENT_TYPE}
        LIMIT 2
      `);
      if (replayRows.length > 0) {
        if (replayRows.length !== 1 || !replayRows[0]) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const receipt = mapReceipt(replayRows[0], tenantId, actorId);
        return receiptMatchesIntent(receipt, input)
          ? { code: "OK", receipt, replayed: true }
          : { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const reusedEvents = await tx.execute<{ id: string }>(sql`
        SELECT id
        FROM public.events
        WHERE tenant_id = ${tenantId}
          AND client_event_id = ${input.clientEventId}
        LIMIT 1
      `);
      if (reusedEvents.length > 0) {
        return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const orderRows = await tx.execute<LockedOrder>(sql`
        SELECT
          id, tenant_id, customer_id, station, status, version,
          payment_mode, payment_mode_version
        FROM public.orders
        WHERE id = ${input.orderId}
          AND tenant_id = ${tenantId}
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
        !isPaymentMode(order.payment_mode) || !Number.isSafeInteger(order.payment_mode_version) ||
        order.payment_mode_version < 0
      ) {
        return { code: "VALIDATION_ERROR", message: "Zahlungsmodus des Auftrags ist nicht verfügbar." };
      }
      if (order.station !== STATION || order.status !== STATION) {
        return { code: "VALIDATION_ERROR", message: "Nur ein fertiggestellter Auftrag kann in Rechnung gestellt werden." };
      }

      // service_date arrives Berlin-normalised from the read port. The command
      // never derives a calendar day from the database session time zone.
      const sourceRows = await tx.execute<SourceRow>(sql`
        SELECT source.*
        FROM private.v_invoice_issue_source_v1 source
        WHERE source.order_id = ${order.id}
        LIMIT 2
      `);
      const source = sourceRows[0];
      if (sourceRows.length !== 1 || !source) {
        return { code: "NOT_FOUND", message: "Rechnungsgrundlage nicht verfügbar." };
      }
      if (
        source.tenant_id !== tenantId
        || source.order_id !== order.id
        || source.customer_id !== order.customer_id
        || source.current_order_version !== order.version
      ) throw new Error("INVOICE_SOURCE_INTEGRITY_INVALID");

      if (!source.no_active_invoice) {
        return { code: "CONFLICT", message: "Für diesen Auftrag besteht bereits eine aktive Rechnung." };
      }
      if (
        !source.integrity_ok
        || !source.seller_config_complete
        || !source.customer_config_complete
        || !source.base_prices_complete
      ) {
        return { code: "VALIDATION_ERROR", message: "Stammdaten für die Rechnungsausgabe sind unvollständig." };
      }

      const paymentTermDays = toSafeInteger(source.invoice_payment_term_days, "INVOICE_PAYMENT_TERM_INVALID");
      const vatRateBasisPoints = toSafeInteger(source.invoice_vat_rate_basis_points, "INVOICE_VAT_RATE_INVALID");
      if (paymentTermDays < 1 || paymentTermDays > 365 || ![700, 1900].includes(vatRateBasisPoints)) {
        return { code: "VALIDATION_ERROR", message: "Stammdaten für die Rechnungsausgabe sind unvollständig." };
      }

      // Every master-data dependent value is built before a number exists, so
      // an incomplete tenant, customer, order or position cannot consume one.
      let content: PreparedInvoiceContent;
      try {
        content = prepareInvoiceContent(source, order, vatRateBasisPoints);
      } catch (error) {
        if (error instanceof InvoiceMasterDataError) {
          return { code: "VALIDATION_ERROR", message: "Stammdaten für die Rechnungsausgabe sind unvollständig." };
        }
        throw error;
      }
      const { netAmountCents, vatAmountCents, grossAmountCents } = content.totals;

      // Exactly one issue instant per invoice. Berlin is the only legal
      // calendar truth for the invoice year and the due date; the same instant
      // is reused for invoice, lifecycle event, snapshot and receipt.
      const timeRows = await tx.execute<{ issued_at_iso: string; invoice_year: number; due_date: Date | string }>(sql`
        WITH issue_instant AS (SELECT clock_timestamp() AS ts)
        SELECT
          to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS issued_at_iso,
          extract(year FROM (ts AT TIME ZONE 'Europe/Berlin'))::integer AS invoice_year,
          ((ts AT TIME ZONE 'Europe/Berlin')::date + ${paymentTermDays}::integer) AS due_date
        FROM issue_instant
      `);
      const timeRow = timeRows[0];
      if (timeRows.length !== 1 || !timeRow) throw new Error("INVOICE_TIME_UNAVAILABLE");
      const issuedAtIso = requireIsoInstant(timeRow.issued_at_iso, "INVOICE_TIME_INVALID");
      const invoiceYear = toSafeInteger(timeRow.invoice_year, "INVOICE_YEAR_INVALID");
      const dueDate = toDateOnly(timeRow.due_date);
      const serviceDate = toDateOnly(source.service_date);

      const numberRows = await tx.execute<{ invoice_number: string }>(sql`
        SELECT private.allocate_invoice_number(${tenantId}, ${invoiceYear}) AS invoice_number
      `);
      const invoiceNumber = numberRows[0]?.invoice_number;
      if (!invoiceNumber || !INVOICE_NUMBER_PATTERN.test(invoiceNumber)) {
        throw new Error("INVOICE_NUMBER_ALLOCATION_FAILED");
      }

      const snapshot: ImmutableInvoiceSnapshot = {
        schemaVersion: 1,
        seller: content.seller,
        customer: content.customer,
        order: content.order,
        lines: content.lines,
        totals: content.totals,
        serviceDate,
        issuedAt: issuedAtIso,
        paymentTermDays,
      };

      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await renderToBuffer(
          createImmutableInvoicePdfDocument({ invoiceNumber, dueDate, snapshot }),
        );
      } catch {
        throw new Error("INVOICE_PDF_RENDER_FAILED");
      }
      if (pdfBuffer.byteLength < 1 || pdfBuffer.byteLength > 20 * 1024 * 1024) {
        throw new Error("INVOICE_PDF_SIZE_INVALID");
      }
      const pdfSha256 = createHash("sha256").update(pdfBuffer).digest("hex");

      const invoiceId = randomUUID();
      const correlationId = randomUUID();
      const pdfRef = `invoice://${invoiceId}/original`;

      const eventRows = await tx.execute<{ event_id: string }>(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, item_id, event_type, description, user_id,
          payload, status, station, client_event_id, event_schema_version,
          correlation_id, aggregate_version, from_station, created_at
        ) VALUES (
          gen_random_uuid()::text, ${tenantId}, ${order.id}, NULL,
          ${EVENT_TYPE}, 'Unveränderliche Rechnung erstellt', ${actorId}::uuid,
          ${JSON.stringify({
            invoiceId,
            freezeId: source.freeze_id,
            invoiceNumber,
            orderVersion: order.version,
            netAmountCents,
            vatRateBasisPoints,
            vatAmountCents,
            grossAmountCents,
            pdfSha256,
            invoiceVersion: 1,
          })}::jsonb,
          'success', ${STATION}, ${input.clientEventId}::uuid, ${EVENT_SCHEMA_VERSION},
          ${correlationId}::uuid, 1, ${STATION},
          ${issuedAtIso}::timestamptz AT TIME ZONE 'UTC'
        )
        RETURNING id AS event_id
      `);
      const event = eventRows[0];
      if (eventRows.length !== 1 || !event || !UUID_PATTERN.test(event.event_id)) {
        throw new Error("INVOICE_EVENT_INSERT_FAILED");
      }

      const invoiceRows = await tx.execute<{ id: string }>(sql`
        INSERT INTO public.invoices (
          id, tenant_id, customer_id, order_id, invoice_number, amount_total, status, due_date,
          contract_version, freeze_id, snapshot, net_amount_cents, vat_rate_basis_points,
          vat_amount_cents, gross_amount_cents, service_date, payment_term_days,
          order_version, aggregate_version, client_event_id, correlation_id, issue_event_id,
          issued_at, issued_by, pdf_ref, pdf_sha256, pdf_content,
          payment_contract_version, payment_mode, payment_status,
          payment_open_amount_cents, payment_paid_amount_cents, payment_currency,
          payment_method, payment_paid_at, payment_receipt_id, payment_event_id,
          payment_correlation_id, payment_version
        ) VALUES (
          ${invoiceId}::uuid, ${tenantId}, ${order.customer_id}, ${order.id},
          ${invoiceNumber}, (${grossAmountCents}::numeric / 100), 'issued', ${dueDate}::date,
          1, ${source.freeze_id}::uuid, ${JSON.stringify(snapshot)}::jsonb,
          ${netAmountCents}, ${vatRateBasisPoints}, ${vatAmountCents}, ${grossAmountCents},
          ${serviceDate}::date, ${paymentTermDays}, ${order.version}, 1,
          ${input.clientEventId}::uuid, ${correlationId}::uuid,
          ${event.event_id}, ${issuedAtIso}::timestamptz, ${actorId}::uuid,
          ${pdfRef}, ${pdfSha256}, ${pdfBuffer},
          ${PAYMENT_CONTRACT_VERSION}, ${order.payment_mode}, 'offen',
          ${grossAmountCents}, 0, 'EUR', NULL, NULL, NULL, NULL, NULL, 0
        )
        RETURNING id
      `);
      const insertedInvoice = invoiceRows[0];
      if (invoiceRows.length !== 1 || !insertedInvoice || insertedInvoice.id !== invoiceId) {
        throw new Error("INVOICE_INSERT_FAILED");
      }

      await readInitialPaymentState(tx, {
        tenantId,
        invoiceId,
        orderId: order.id,
        grossAmountCents,
        paymentMode: order.payment_mode,
      });

      const receiptRows = await tx.execute<ReceiptRow>(sql`
        SELECT *
        FROM private.v_invoice_receipt_v1
        WHERE client_event_id = ${input.clientEventId}
          AND event_type = ${EVENT_TYPE}
        LIMIT 2
      `);
      if (receiptRows.length !== 1 || !receiptRows[0]) throw new Error("INVOICE_RECEIPT_MISSING");
      const receipt = mapReceipt(receiptRows[0], tenantId, actorId);
      if (
        !receiptMatchesIntent(receipt, input)
        || receipt.invoiceId !== invoiceId
        || receipt.invoiceNumber !== invoiceNumber
        || receipt.netAmountCents !== netAmountCents
        || receipt.vatAmountCents !== vatAmountCents
        || receipt.grossAmountCents !== grossAmountCents
        || receipt.serviceDate !== serviceDate
        || receipt.dueDate !== dueDate
        || receipt.pdfSha256 !== pdfSha256
        // One instant on invoice, event, snapshot and receipt — proven, not assumed.
        || receipt.issuedAt !== issuedAtIso
      ) throw new Error("INVOICE_RECEIPT_MISMATCH");

      return { code: "OK", receipt, replayed: false };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Rechnung konnte nicht sicher ausgestellt werden." };
  }
}

export async function cancelInvoice(input: unknown): Promise<CancelInvoiceResult> {
  if (!isValidCancelInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Stornoanfrage." };
  }

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: "Rechnung konnte nicht sicher storniert werden." };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: "Rechnung konnte nicht sicher storniert werden." }
      : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }
  if (!INVOICE_CANCEL_ROLES.includes(authorization.data.role as (typeof INVOICE_CANCEL_ROLES)[number])) {
    return { code: "FORBIDDEN", message: "Rechnungsstorno ist mit dieser Rolle nicht erlaubt." };
  }

  const tenantId = authorization.data.tenantId;
  const actorId = authorization.data.userId;

  try {
    return await withPrivilegedTenantTransaction(authorization.data, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended('f1:invoice:client-event:' || ${tenantId} || ':' || ${input.clientEventId}, 0)
        )
      `);
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended('f1:invoice:cancel:' || ${tenantId} || ':' || ${input.invoiceId}, 0)
        )
      `);

      const replayRows = await tx.execute<ReceiptRow>(sql`
        SELECT *
        FROM private.v_invoice_receipt_v1
        WHERE client_event_id = ${input.clientEventId}
          AND event_type = ${CANCEL_EVENT_TYPE}
        LIMIT 2
      `);
      if (replayRows.length > 0) {
        if (replayRows.length !== 1 || !replayRows[0]) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const receipt = mapCancellationReceipt(replayRows[0], tenantId, actorId);
        return cancellationReceiptMatchesIntent(receipt, input)
          ? { code: "OK", receipt, replayed: true }
          : { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const reusedEvents = await tx.execute<{ id: string }>(sql`
        SELECT id
        FROM public.events
        WHERE tenant_id = ${tenantId}
          AND client_event_id = ${input.clientEventId}
        LIMIT 1
      `);
      if (reusedEvents.length > 0) {
        return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const invoiceRows = await tx.execute<LockedInvoice>(sql`
        SELECT
          id, tenant_id, order_id, invoice_number, status, aggregate_version,
          snapshot, due_date, pdf_ref, pdf_sha256, pdf_content
        FROM public.invoices
        WHERE id = ${input.invoiceId}::uuid
          AND tenant_id = ${tenantId}
          AND contract_version = 1
        FOR UPDATE
      `);
      const invoice = invoiceRows[0];
      if (invoiceRows.length !== 1 || !invoice) {
        return { code: "NOT_FOUND", message: "Rechnung nicht verfügbar." };
      }
      if (invoice.status !== "issued" || invoice.aggregate_version !== input.expectedVersion) {
        return { code: "CONFLICT", message: "Rechnung wurde bereits verändert." };
      }
      if (input.expectedVersion !== 1) {
        return { code: "CONFLICT", message: "Rechnung wurde bereits verändert." };
      }
      if (
        invoice.tenant_id !== tenantId
        || !INVOICE_NUMBER_PATTERN.test(invoice.invoice_number)
        || invoice.pdf_ref !== `invoice://${invoice.id}/original`
        || !HEX64_PATTERN.test(invoice.pdf_sha256)
        || !invoice.pdf_content
      ) throw new Error("INVOICE_CANCEL_SOURCE_INVALID");
      const originalPdf = Buffer.isBuffer(invoice.pdf_content)
        ? invoice.pdf_content
        : Buffer.from(invoice.pdf_content);
      if (createHash("sha256").update(originalPdf).digest("hex") !== invoice.pdf_sha256) {
        throw new Error("INVOICE_CANCEL_ORIGINAL_PDF_INVALID");
      }
      const snapshot = parseStoredSnapshot(invoice.snapshot, invoice);

      // Exactly one cancellation instant, reused for invoice, lifecycle event,
      // cancellation document and receipt.
      const timeRows = await tx.execute<{ cancelled_at_iso: string }>(sql`
        SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          AS cancelled_at_iso
      `);
      if (timeRows.length !== 1) throw new Error("INVOICE_CANCEL_TIME_UNAVAILABLE");
      const cancelledAt = requireIsoInstant(
        timeRows[0]?.cancelled_at_iso,
        "INVOICE_CANCEL_TIME_INVALID",
      );

      let cancellationPdfBuffer: Buffer;
      try {
        cancellationPdfBuffer = await renderToBuffer(
          createImmutableInvoiceCancellationPdfDocument({
            invoiceNumber: invoice.invoice_number,
            cancelledAt,
            cancelReason: input.reason,
            snapshot,
          }),
        );
      } catch {
        throw new Error("INVOICE_CANCELLATION_PDF_RENDER_FAILED");
      }
      if (cancellationPdfBuffer.byteLength < 1 || cancellationPdfBuffer.byteLength > 20 * 1024 * 1024) {
        throw new Error("INVOICE_CANCELLATION_PDF_SIZE_INVALID");
      }
      const cancellationPdfSha256 = createHash("sha256")
        .update(cancellationPdfBuffer)
        .digest("hex");
      const cancellationPdfRef = `invoice://${invoice.id}/cancellation`;
      const correlationId = randomUUID();

      const eventRows = await tx.execute<{ event_id: string }>(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, item_id, event_type, description, user_id,
          payload, status, station, client_event_id, event_schema_version,
          correlation_id, aggregate_version, from_station, created_at
        ) VALUES (
          gen_random_uuid()::text, ${tenantId}, ${invoice.order_id}, NULL,
          ${CANCEL_EVENT_TYPE}, ${input.reason}, ${actorId}::uuid,
          ${JSON.stringify({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoice_number,
            expectedVersion: input.expectedVersion,
            cancelReason: input.reason,
            cancellationPdfSha256,
            invoiceVersion: 2,
          })}::jsonb,
          'success', ${STATION}, ${input.clientEventId}::uuid, ${EVENT_SCHEMA_VERSION},
          ${correlationId}::uuid, 2, ${STATION},
          ${cancelledAt}::timestamptz AT TIME ZONE 'UTC'
        )
        RETURNING id AS event_id
      `);
      const event = eventRows[0];
      if (eventRows.length !== 1 || !event || !UUID_PATTERN.test(event.event_id)) {
        throw new Error("INVOICE_CANCEL_EVENT_INSERT_FAILED");
      }

      await tx.execute(sql`SELECT set_config('app.invoice_cancel_command', 'v1', true)`);
      const updatedRows = await tx.execute<{ id: string }>(sql`
        UPDATE public.invoices
        SET
          status = 'cancelled',
          aggregate_version = 2,
          cancel_client_event_id = ${input.clientEventId}::uuid,
          cancel_correlation_id = ${correlationId}::uuid,
          cancelled_by = ${actorId}::uuid,
          cancel_reason = ${input.reason},
          cancelled_at = ${cancelledAt}::timestamptz,
          cancel_event_id = ${event.event_id},
          cancellation_pdf_ref = ${cancellationPdfRef},
          cancellation_pdf_sha256 = ${cancellationPdfSha256},
          cancellation_pdf_content = ${cancellationPdfBuffer}
        WHERE id = ${invoice.id}::uuid
          AND tenant_id = ${tenantId}
          AND contract_version = 1
          AND status = 'issued'
          AND aggregate_version = ${input.expectedVersion}
        RETURNING id
      `);
      if (updatedRows.length !== 1 || updatedRows[0]?.id !== invoice.id) {
        throw new Error("INVOICE_CANCEL_UPDATE_FAILED");
      }

      const receiptRows = await tx.execute<ReceiptRow>(sql`
        SELECT *
        FROM private.v_invoice_receipt_v1
        WHERE client_event_id = ${input.clientEventId}
          AND event_type = ${CANCEL_EVENT_TYPE}
        LIMIT 2
      `);
      if (receiptRows.length !== 1 || !receiptRows[0]) {
        throw new Error("INVOICE_CANCEL_RECEIPT_MISSING");
      }
      const receipt = mapCancellationReceipt(receiptRows[0], tenantId, actorId);
      if (
        !cancellationReceiptMatchesIntent(receipt, input)
        || receipt.invoiceNumber !== invoice.invoice_number
        || receipt.orderId !== invoice.order_id
        || receipt.originalPdfSha256 !== invoice.pdf_sha256
        || receipt.cancellationPdfSha256 !== cancellationPdfSha256
        || receipt.cancellationPdfRef !== cancellationPdfRef
        || receipt.cancelledAt !== cancelledAt
      ) throw new Error("INVOICE_CANCEL_RECEIPT_MISMATCH");

      return { code: "OK", receipt, replayed: false };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Rechnung konnte nicht sicher storniert werden." };
  }
}
