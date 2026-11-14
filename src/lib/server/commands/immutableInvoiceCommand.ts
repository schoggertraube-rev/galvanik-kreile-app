import type {InvoiceVatGroup,InvoiceVatReader} from '@/modules/accounting/public';
import {readInvoiceVat} from '@/modules/accounting/public';
import "server-only";
import {INVOICE_VAT_COPY} from '@/ui/situationCatalog';
import {CUSTOMER_CREDIT_COPY} from '@/ui/situationCatalog';
import {SHIPPING_FEE_COPY} from '@/ui/situationCatalog';
import {appendCancellationCredit} from './customerCreditCommand';
import {readOrderCommercialQuote,bindOrderQuoteCommercialTerms} from '@/lib/server/orderQuoteReadPort';

import { createHash, randomUUID } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { sql } from "drizzle-orm";
import { hasAuthorizationArea, resolveAuthorization,type AuthorizationSnapshot } from "@/lib/server/authorization";
import { readEffectiveCustomerAgreement } from "@/lib/server/effectiveCustomerAgreementRead";
import {
  withPrivilegedTenantTransaction,
  withTenantSavepoint,
  type PrivilegedTenantTransaction,
} from "@/lib/server/privilegedDb";
import {
  isPaymentMode,
  PAYMENT_CONTRACT_VERSION,
  mapPaymentSummaryRow,
  type PaymentSummaryRow,
  type PaymentSummary,
  type PaymentMode,
} from "@/lib/server/paymentContract";
import {
  createImmutableInvoiceCancellationPdfDocument,
  createImmutableInvoicePdfDocument,
  type ImmutableInvoiceBaseLine,
  type ImmutableInvoiceExtraWorkLine,
  type ImmutableInvoiceShippingLine,
  type ImmutableInvoiceLine,
  type ImmutableInvoiceSnapshot,
} from "@/lib/pdf/ImmutableInvoiceDocument";

/**
 * F1.4 — immutable issue/cancellation lifecycle on the single public.invoices
 * truth. Both commands are tenant-bound, versioned, idempotent and confirmed
 * by a separate event/invoice/PDF receipt readback inside the transaction.
 */

const EVENT_TYPE = "INVOICE_CREATED_V1";
const EVENT_TYPE_V2 = "INVOICE_CREATED_V2";
const CANCEL_EVENT_TYPE = "INVOICE_CANCELLED_V1";
const EVENT_SCHEMA_VERSION = 1 as const;
const STATION = "fertig" as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const INVOICE_NUMBER_PATTERN = /^R-[0-9]{4}-[0-9]{4,}$/;
const HEX64_PATTERN = /^[a-f0-9]{64}$/;
/** Canonical UTC instant, exactly as `to_char(... 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')` emits it. */
const ISO_INSTANT_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;

export type CreateInvoiceInput = {
  orderId: string;
  expectedVersion: number;
  clientEventId: string;
  agreement?: {
    id: string;
    version: number;
    type: "ausgabe_ohne_zahlung" | "zahlungsziel";
  };
  shippingCosts?: {
    invoiceId: string;
    expectedVersion: number;
    scope: string;
    expectedFeeCents: number;
  };
};

type ImmutableInvoiceReceiptBase = {
  belegart?: 'versandkosten';
  ursprungRechnungId?: string;
  invoiceId: string;
  invoiceNumber: string;
  orderId: string;
  orderVersion: number;
  status: "issued";
  netAmountCents: number;
  vatRateBasisPoints: number|null;
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
};

export type ImmutableInvoiceReceipt = ImmutableInvoiceReceiptBase & (
  | { eventSchemaVersion: 1 }
  | { eventSchemaVersion: 2; invoiceSourceState: "after_goods_out" }
);

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
  handover_mode:string|null;
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
  has_quote?:boolean;
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
  customer_vat_id: string | null;
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
  post_goods_out_invoice_eligible: boolean;
  effective_integrity_ok: boolean;
  current_order_version: number;
  service_date: Date | string;
};

type ReceiptRow = {
  belegart: 'auftrag'|'versandkosten';
  ursprung_rechnung_id: string|null;
  shipping_costs_intent: unknown;
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
  vat_rate_basis_points: number|null;
  snapshot: unknown;
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
  net_amount_cents: number | string | null;
  vat_rate_basis_points: number | string | null;
  vat_amount_cents: number | string | null;
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

type LockedCancellationOrder = {
  id: string;
  tenant_id: string;
};

function isValidInput(input: unknown): input is CreateInvoiceInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  const expected = ["clientEventId", "expectedVersion", "orderId"];
  const expectedWithAgreement = ["agreement", ...expected].sort();
  const actual = Object.keys(value).sort();
  const hasAgreement = actual.length === expectedWithAgreement.length
    && actual.every((key, index) => key === expectedWithAgreement[index]);
  const agreement = value.agreement;
  const hasShipping = actual.join(',') === [...expected,'shippingCosts'].sort().join(',');
  return (actual.length === expected.length
      && actual.every((key, index) => key === expected[index])
      || hasAgreement || hasShipping)
    && typeof value.orderId === "string"
    && value.orderId.trim() === value.orderId
    && value.orderId.length > 0
    && value.orderId.length <= 128
    && typeof value.clientEventId === "string"
    && UUID_PATTERN.test(value.clientEventId)
    && typeof value.expectedVersion === "number"
    && Number.isSafeInteger(value.expectedVersion)
    && value.expectedVersion > 0
    && (!hasShipping || validShippingCosts(value.shippingCosts,value.orderId as string))
    && (!hasAgreement || (
      agreement !== null
      && typeof agreement === "object"
      && !Array.isArray(agreement)
      && Object.keys(agreement as Record<string, unknown>).sort().join(",") === "id,type,version"
      && typeof (agreement as Record<string, unknown>).id === "string"
      && UUID_PATTERN.test((agreement as Record<string, unknown>).id as string)
      && typeof (agreement as Record<string, unknown>).version === "number"
      && Number.isSafeInteger((agreement as Record<string, unknown>).version)
      && ((agreement as Record<string, unknown>).version as number) > 0
      && ((agreement as Record<string, unknown>).type === "ausgabe_ohne_zahlung"
        || (agreement as Record<string, unknown>).type === "zahlungsziel")
    ));
}

function validShippingCosts(value:unknown,orderId:string):value is NonNullable<CreateInvoiceInput['shippingCosts']>{
  if(!plainObject(value)||Object.keys(value).sort().join(',')!=='expectedFeeCents,expectedVersion,invoiceId,scope')return false;
  return typeof value.invoiceId==='string'&&UUID_PATTERN.test(value.invoiceId)
    &&typeof value.expectedVersion==='number'&&Number.isSafeInteger(value.expectedVersion)&&value.expectedVersion>0
    &&typeof value.expectedFeeCents==='number'&&Number.isSafeInteger(value.expectedFeeCents)&&value.expectedFeeCents>=0
    &&typeof value.scope==='string'&&(value.scope==='order:'+orderId
      ||value.scope.startsWith('sendung:')&&UUID_PATTERN.test(value.scope.slice(8))&&value.scope===value.scope.toLowerCase());
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
class InvoiceVatRateError extends InvoiceMasterDataError {
  constructor(readonly part:string,readonly missingCompany=false){super("INVOICE_LINE_VAT_RATE_MISSING");}
}
const INVOICE_EU_OUTSIDE_DE=new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']);
function invoiceLineVat(value:unknown,part:string,reverseCharge:boolean,companyRate:number|null):0|700|1900{
  if(reverseCharge)return 0;
  if(value===null){if(companyRate===700||companyRate===1900)return companyRate;throw new InvoiceVatRateError(part,true);}
  if(value!==700&&value!==1900)throw new InvoiceVatRateError(part);
  return value;
}

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

function parseBaseLines(value: unknown, vat?:{reverseCharge:boolean;companyRate:number|null}): ImmutableInvoiceBaseLine[] {
  if (!Array.isArray(value)) throw new Error("INVOICE_BASE_LINES_INVALID");
  return value.map((entry) => {
    if (!plainObject(entry) || !exactKeys(entry, [
      "itemId", "lineNetAmountCents", "name", "quantity", "unitNetAmountCents",
      ...(vat ? ["vat_rate_basis_points"] : []),
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
    if (lineNetAmountCents < 0 || unitNetAmountCents !== Number((BigInt(lineNetAmountCents)+BigInt(quantity)/BigInt(2))/BigInt(quantity))) {
      throw new Error("INVOICE_BASE_LINE_INTEGRITY_INVALID");
    }
    return { type: "BASE" as const, itemId, name, quantity, unitNetAmountCents, lineNetAmountCents,
      ...(vat ? {vat_rate_basis_points:invoiceLineVat(entry.vat_rate_basis_points,name,vat.reverseCharge,vat.companyRate)} : {}),
    };
  });
}

function parseExtraWorkLines(value: unknown, vat?:{reverseCharge:boolean;companyRate:number|null}): ImmutableInvoiceExtraWorkLine[] {
  if (!Array.isArray(value)) throw new Error("INVOICE_EXTRA_WORK_LINES_INVALID");
  return value.map((entry) => {
    if (!plainObject(entry) || !exactKeys(entry, [
      "amountCents", "catalogPositionId", "catalogPositionName", "hourlyRateCents", "itemId", "minutes",
      ...(vat ? ["vat_rate_basis_points"] : []),
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
      ...(vat ? {vat_rate_basis_points:invoiceLineVat(entry.vat_rate_basis_points,catalogPositionName,vat.reverseCharge,vat.companyRate)} : {}),
    };
  });
}

function parseStoredLine(value: unknown, schemaVersion: 1|2): ImmutableInvoiceLine {
  if (!plainObject(value) || typeof value.type !== "string") {
    throw new Error("INVOICE_SNAPSHOT_LINE_INVALID");
  }
  if(value.type==='SHIPPING'){
    if(schemaVersion!==2||!exactKeys(value,['type','shipmentGroupId','name','amountCents','vat_rate_basis_points']))throw Error('INVOICE_SNAPSHOT_SHIPPING_SHAPE_INVALID');
    const rate=value.vat_rate_basis_points;
    if(rate!==0&&rate!==700&&rate!==1900)throw Error('INVOICE_SNAPSHOT_SHIPPING_RATE_INVALID');
    return {type:'SHIPPING',shipmentGroupId:requiredText(value.shipmentGroupId,'INVOICE_SNAPSHOT_SHIPPING_SOURCE_INVALID'),name:requiredText(value.name,'INVOICE_SNAPSHOT_SHIPPING_NAME_INVALID'),amountCents:toSafeInteger(value.amountCents,'INVOICE_SNAPSHOT_SHIPPING_AMOUNT_INVALID'),vat_rate_basis_points:rate};
  }
  if (value.type === "BASE") {
    if (!exactKeys(value, [
      "itemId", "lineNetAmountCents", "name", "quantity", "type", "unitNetAmountCents",
      ...(schemaVersion === 2 ? ["vat_rate_basis_points"] : []),
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
    return schemaVersion === 2 ? {...value,...line} as ImmutableInvoiceLine : line;
  }
  if (value.type === "EXTRA_WORK") {
    if (!exactKeys(value, [
      "amountCents", "catalogPositionId", "catalogPositionName", "hourlyRateCents",
      "itemId", "minutes", "type",
      ...(schemaVersion === 2 ? ["vat_rate_basis_points"] : []),
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
    return schemaVersion === 2 ? {...value,...line} as ImmutableInvoiceLine : line;
  }
  throw new Error("INVOICE_SNAPSHOT_LINE_TYPE_INVALID");
}

function parseStoredSnapshot(value: unknown, invoice: LockedInvoice, readVat: InvoiceVatReader): ImmutableInvoiceSnapshot {
  if (!plainObject(value) || !exactKeys(value, [
    "customer", "issuedAt", "lines", "order", "paymentTermDays", "schemaVersion",
    "seller", "serviceDate", "totals",
  ])) throw new Error("INVOICE_SNAPSHOT_SHAPE_INVALID");
  if ((value.schemaVersion !== 1 && value.schemaVersion !== 2) || !plainObject(value.seller) || !plainObject(value.customer)
    || !plainObject(value.order) || !plainObject(value.totals) || !Array.isArray(value.lines)) {
    throw new Error("INVOICE_SNAPSHOT_TYPE_INVALID");
  }
  if (!exactKeys(value.seller, [
    "bankName", "bic", "city", "companyName", "country", "iban", "street", "taxId", "zip",
  ])) throw new Error("INVOICE_SNAPSHOT_SELLER_SHAPE_INVALID");
  if (!exactKeys(value.customer, [
    "city", "companyName", "contactPerson", "country", "name", "street", "zip",
    ...(value.schemaVersion === 2 ? ["vatId"] : []),
  ])) throw new Error("INVOICE_SNAPSHOT_CUSTOMER_SHAPE_INVALID");
  if (!exactKeys(value.order, ["freezeId", "orderId", "orderNumber", "orderVersion", "title"])) {
    throw new Error("INVOICE_SNAPSHOT_ORDER_SHAPE_INVALID");
  }
  if (!exactKeys(value.totals, [
    "grossAmountCents", "netAmountCents", "vatAmountCents", "vatRateBasisPoints",
    ...(value.schemaVersion === 2 ? ["vatBreakdown"] : []),
  ])) throw new Error("INVOICE_SNAPSHOT_TOTALS_SHAPE_INVALID");

  const orderVersion = toSafeInteger(value.order.orderVersion, "INVOICE_SNAPSHOT_ORDER_VERSION_INVALID");
  const vat = readVat(invoice);
  const {netAmountCents,vatAmountCents,grossAmountCents,headRate:vatRateBasisPoints} = vat;
  const paymentTermDays = toSafeInteger(value.paymentTermDays, "INVOICE_SNAPSHOT_PAYMENT_TERM_INVALID");
  const issuedAt = toIso(value.issuedAt);
  const serviceDate = toDateOnly(value.serviceDate);
  const schemaVersion = value.schemaVersion;
  const lines = value.lines.map(line => parseStoredLine(line, schemaVersion));
  if (
    value.order.orderId !== invoice.order_id
    || orderVersion < 1
    || lines.length < 1
    || netAmountCents < 0
    || paymentTermDays < 1
    || paymentTermDays > 365
  ) throw new Error("INVOICE_SNAPSHOT_INTEGRITY_INVALID");

  const optionalSnapshotText = (input: unknown, error: string): string | null => {
    if (input === null) return null;
    return requiredText(input, error);
  };

  return {
    schemaVersion,
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
      ...(schemaVersion === 2 ? {vatId:optionalSnapshotText(value.customer.vatId,"INVOICE_SNAPSHOT_CUSTOMER_VAT_ID_INVALID")} : {}),
    },
    order: {
      orderId: requiredText(value.order.orderId, "INVOICE_SNAPSHOT_ORDER_ID_INVALID"),
      orderVersion,
      orderNumber: requiredText(value.order.orderNumber, "INVOICE_SNAPSHOT_ORDER_NUMBER_INVALID"),
      title: requiredText(value.order.title, "INVOICE_SNAPSHOT_ORDER_TITLE_INVALID"),
      freezeId: requiredText(value.order.freezeId, "INVOICE_SNAPSHOT_FREEZE_ID_INVALID"),
    },
    lines,
    totals: { netAmountCents, vatRateBasisPoints, vatAmountCents, grossAmountCents,
      ...(schemaVersion === 2 ? {vatBreakdown:vat.groups} : {}),
    },
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
  shippingFees:Array<{shipmentGroupId:string;amountCents:number;name:string}>,
  shippingOnly=false,
): PreparedInvoiceContent {
  const customerCountry=masterDataText(source.customer_country,"INVOICE_CUSTOMER_COUNTRY_INVALID");
  const customerVatId=optionalText(source.customer_vat_id);
  const reverseCharge=INVOICE_EU_OUTSIDE_DE.has(customerCountry)&&customerVatId!==null;
  const vatSource={reverseCharge,companyRate:source.invoice_vat_rate_basis_points};
  // PL14Nov05:45: this document bills only the selected real shipping source.
  // Zero goods is known from its explicit kind, never a missing-price fallback.
  const baseLines = shippingOnly?[]:parseBaseLines(source.base_lines,vatSource);
  const extraWorkLines = shippingOnly?[]:parseExtraWorkLines(source.extra_work_lines,vatSource);
  const shippingLines:ImmutableInvoiceShippingLine[]=shippingFees.map(fee=>({type:'SHIPPING',shipmentGroupId:fee.shipmentGroupId,name:fee.name,amountCents:fee.amountCents,vat_rate_basis_points:invoiceLineVat(null,fee.name,reverseCharge,source.invoice_vat_rate_basis_points)}));
  if (
    !shippingOnly && (baseLines.length !== toSafeInteger(source.base_line_count, "INVOICE_BASE_LINE_COUNT_INVALID")
    || extraWorkLines.length !== toSafeInteger(source.extra_work_line_count, "INVOICE_EXTRA_WORK_LINE_COUNT_INVALID"))
  ) throw new Error("INVOICE_LINE_COUNT_MISMATCH");
  if ((!shippingOnly && baseLines.length < 1)||(shippingOnly&&shippingLines.length<1)) {
    throw new InvoiceMasterDataError("INVOICE_BASE_LINES_MISSING");
  }

  const baseNetAmountCents = shippingOnly?0:toSafeInteger(source.base_net_amount_cents, "INVOICE_BASE_AMOUNT_INVALID");
  const extraWorkNetAmountCents = shippingOnly?0:toSafeInteger(source.extra_work_net_amount_cents, "INVOICE_EXTRA_WORK_AMOUNT_TOTAL_INVALID");
  if (
    baseLines.reduce((sum, line) => sum + line.lineNetAmountCents, 0) !== baseNetAmountCents
    || extraWorkLines.reduce((sum, line) => sum + line.amountCents, 0) !== extraWorkNetAmountCents
  ) throw new Error("INVOICE_LINE_TOTAL_MISMATCH");

  const netAmountCents = baseNetAmountCents + extraWorkNetAmountCents+shippingLines.reduce((sum,line)=>sum+line.amountCents,0);
  const byRate=new Map<0|700|1900,number>();
  for(const line of [...baseLines,...extraWorkLines,...shippingLines]){
    const rate=line.vat_rate_basis_points;
    if(rate===undefined)throw Error("INVOICE_LINE_RATE_REQUIRED");
    const amount=line.type==="BASE"?line.lineNetAmountCents:line.amountCents;
    const accumulated=(byRate.get(rate)??0)+amount;
    if(!Number.isSafeInteger(accumulated))throw Error("INVOICE_AMOUNT_UNSAFE");
    byRate.set(rate,accumulated);
  }
  const vatBreakdown:InvoiceVatGroup[]=[...byRate].map(([rateBp,netCents])=>{
    const vatCents=Number((BigInt(netCents)*BigInt(rateBp)+BigInt(5000))/BigInt(10000));
    return {rateBp,netCents,vatCents,grossCents:netCents+vatCents};
  });
  const vatAmountCents=vatBreakdown.reduce((sum,group)=>sum+group.vatCents,0);
  const grossAmountCents=vatBreakdown.reduce((sum,group)=>sum+group.grossCents,0);
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
      country: customerCountry,
      vatId:customerVatId,
    },
    order: {
      orderId: order.id,
      orderVersion: order.version,
      orderNumber: masterDataText(source.order_number, "INVOICE_ORDER_NUMBER_INVALID"),
      title: masterDataText(source.order_title, "INVOICE_ORDER_TITLE_INVALID"),
      freezeId: requiredText(source.freeze_id, "INVOICE_FREEZE_ID_INVALID"),
    },
    lines: [...baseLines, ...extraWorkLines,...shippingLines] as ImmutableInvoiceLine[],
    totals: { netAmountCents, vatRateBasisPoints:null, vatBreakdown, vatAmountCents, grossAmountCents },
  };
}

export function mapInvoiceIssueReceipt(row: ReceiptRow, tenantId: string, actorId: string,readVat:InvoiceVatReader): ImmutableInvoiceReceipt {
  const kindValid=row.belegart==='auftrag'
    ?row.ursprung_rechnung_id===null&&row.shipping_costs_intent===null
    :row.belegart==='versandkosten'&&typeof row.ursprung_rechnung_id==='string'&&UUID_PATTERN.test(row.ursprung_rechnung_id)
      &&validShippingCosts(row.shipping_costs_intent,row.order_id)
      &&row.shipping_costs_intent.invoiceId===row.ursprung_rechnung_id
      &&plainObject(row.snapshot)&&Array.isArray(row.snapshot.lines)&&row.snapshot.lines.length>0
      &&row.snapshot.lines.every(line=>plainObject(line)&&line.type==='SHIPPING')
      &&row.shipping_costs_intent.expectedFeeCents===toSafeInteger(row.net_amount_cents,'INVOICE_SHIPPING_NET_INVALID');
  if(!kindValid)throw Error('INVOICE_RECEIPT_KIND_INVALID');
  const orderVersion = toSafeInteger(row.order_version, "INVOICE_RECEIPT_ORDER_VERSION_INVALID");
  const intentExpectedVersion = toSafeInteger(
    row.intent_expected_version,
    "INVOICE_RECEIPT_INTENT_VERSION_INVALID",
  );
  const {netAmountCents,vatAmountCents,grossAmountCents,headRate:vatRateBasisPoints}=readVat(row);
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
    || !UUID_PATTERN.test(row.actor_id)
    || (row.event_type !== EVENT_TYPE && row.event_type !== EVENT_TYPE_V2)
    || (row.event_type === EVENT_TYPE ? eventSchemaVersion !== EVENT_SCHEMA_VERSION : eventSchemaVersion !== 2)
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
    || grossAmountCents !== netAmountCents + vatAmountCents
  ) throw new Error("INVOICE_RECEIPT_INVALID");

  const receipt: ImmutableInvoiceReceiptBase = {
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
    ...(row.belegart==='versandkosten'?{belegart:'versandkosten' as const,ursprungRechnungId:requiredText(row.ursprung_rechnung_id,'INVOICE_SHIPPING_ORIGIN_MISSING')} : {}),
  };
  return row.event_type === EVENT_TYPE_V2
    ? { ...receipt, eventSchemaVersion: 2, invoiceSourceState: "after_goods_out" }
    : { ...receipt, eventSchemaVersion: 1 };
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

function receiptMatchesIntent(receipt: ImmutableInvoiceReceipt, input: CreateInvoiceInput, row:ReceiptRow): boolean {
  return receipt.orderId === input.orderId
    && receipt.orderVersion === input.expectedVersion
    && (input.shippingCosts===undefined
      ?row.belegart==='auftrag'&&row.ursprung_rechnung_id===null&&row.shipping_costs_intent===null
      :row.belegart==='versandkosten'&&row.ursprung_rechnung_id===input.shippingCosts.invoiceId
        &&validShippingCosts(row.shipping_costs_intent,input.orderId)
        &&row.shipping_costs_intent.invoiceId===input.shippingCosts.invoiceId
        &&row.shipping_costs_intent.expectedVersion===input.shippingCosts.expectedVersion
        &&row.shipping_costs_intent.scope===input.shippingCosts.scope
        &&row.shipping_costs_intent.expectedFeeCents===input.shippingCosts.expectedFeeCents);
}

export async function readCreateInvoiceReceipts(
  tx: PrivilegedTenantTransaction,
  clientEventId: string,
): Promise<ReceiptRow[]> {
  return tx.execute<ReceiptRow>(sql`
    WITH receipt AS (SELECT *
    FROM private.v_invoice_receipt_v1
    WHERE client_event_id = ${clientEventId}
      AND event_type = ${EVENT_TYPE}
    UNION ALL
    SELECT *
    FROM private.v_invoice_created_receipt_v2
    WHERE client_event_id = ${clientEventId}
      AND event_type = ${EVENT_TYPE_V2}
    ) SELECT receipt.*,invoice.belegart,invoice.ursprung_rechnung_id::text,
      event.payload->'shippingCosts' AS shipping_costs_intent
    FROM receipt JOIN public.invoices invoice ON invoice.tenant_id=receipt.tenant_id AND invoice.id=receipt.invoice_id
    JOIN public.events event ON event.tenant_id=receipt.tenant_id AND event.id=receipt.event_id
    LIMIT 2
  `);
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

/** Shared lock order for standalone issuance and issuance composed with goods-out. */
/** Same customer lock as the shipment writer. Only issued, fully checked originals
 * allocate a fee; proposals and retries never reserve a second money truth. */
async function readShippingInvoiceLines(tx:PrivilegedTenantTransaction,tenantId:string,order:LockedOrder,amountCents:number|null,readVat:InvoiceVatReader){
  const shipments=await tx.execute<{id:string;sendung_id:string|null}>(sql`
    SELECT id::text,sendung_id::text FROM public.shipments
    WHERE tenant_id=${tenantId} AND order_id=${order.id} ORDER BY created_at,id`);
  const groups=new Map<string,{sendungId:string|null;shipmentId:string|null}>();
  if(shipments.length===0)groups.set('order:'+order.id,{sendungId:null,shipmentId:null});
  for(const shipment of shipments){
    const key=shipment.sendung_id===null?'shipment:'+shipment.id:'sendung:'+shipment.sendung_id;
    if(!groups.has(key))groups.set(key,{sendungId:shipment.sendung_id,shipmentId:shipment.id});
  }
  const lines:Array<{shipmentGroupId:string;amountCents:number;name:string}>=[];
  for(const [groupKey,group] of groups){
    const members=group.sendungId===null
      ?[{order_id:order.id,customer_id:order.customer_id,shipment_id:group.shipmentId}]
      :await tx.execute<{order_id:string;customer_id:string;shipment_id:string}>(sql`
        SELECT shipment.order_id,orders.customer_id,shipment.id::text AS shipment_id
        FROM public.shipments shipment JOIN public.orders orders
          ON orders.tenant_id=shipment.tenant_id AND orders.id=shipment.order_id
        WHERE shipment.tenant_id=${tenantId} AND shipment.sendung_id=${group.sendungId}::uuid
        ORDER BY shipment.order_id,shipment.id`);
    if(members.length===0||members.some(member=>member.customer_id!==order.customer_id)||!members.some(member=>member.order_id===order.id))throw Error('INVOICE_SHIPPING_GROUP_SOURCE_INVALID');
    const orderIds=[...new Set(members.map(member=>member.order_id))];
    const quoteOrders=await tx.execute<{order_id:string}>(sql`SELECT DISTINCT order_id FROM private.quote_conversion_receipts
      WHERE tenant_id=${tenantId} AND order_id IN (${sql.join(orderIds.map(value=>sql`${value}`),sql`,`)}) ORDER BY order_id`);
    let included=false;
    for(const member of quoteOrders){
      const commercial=await readOrderCommercialQuote(tx,tenantId,member.order_id);
      if(typeof commercial.shippingIncluded!=='boolean')throw Error('INVOICE_SHIPPING_QUOTE_SOURCE_MISSING');
      if(commercial.shippingIncluded)included=true;
    }
    // PL13Nov22:20: explicitly included in one awarded quote means the whole
    // actual shipment is included. Unknown source throws above, never false.
    if(included)continue;
    const sourceKeys=new Set([groupKey,...members.flatMap(member=>['order:'+member.order_id,...(member.shipment_id===null?[]:['shipment:'+member.shipment_id])])]);
    const originals=await tx.execute<LockedInvoice&{client_event_id:string;issued_by:string}>(sql`
      SELECT invoice.* FROM public.invoices invoice
      WHERE invoice.tenant_id=${tenantId} AND invoice.order_id IN (${sql.join(orderIds.map(value=>sql`${value}`),sql`,`)})
        AND invoice.status='issued' AND invoice.contract_version=1
      ORDER BY invoice.invoice_number FOR SHARE OF invoice`);
    const charged:Array<{invoiceNumber:string}>=[];
    for(const original of originals){
      if(original.tenant_id!==tenantId||!orderIds.includes(original.order_id)||!INVOICE_NUMBER_PATTERN.test(original.invoice_number)||!original.pdf_content||!HEX64_PATTERN.test(original.pdf_sha256)
        ||createHash('sha256').update(original.pdf_content).digest('hex')!==original.pdf_sha256)throw Error('INVOICE_SHIPPING_ORIGINAL_INVALID');
      const snapshot=parseStoredSnapshot(original.snapshot,original,readVat);
      const matching=snapshot.lines.filter(line=>line.type==='SHIPPING'&&sourceKeys.has(line.shipmentGroupId)&&(line.amountCents>0||line.name===SHIPPING_FEE_COPY.line));
      if(matching.length>1)throw Error('INVOICE_SHIPPING_ALLOCATION_AMBIGUOUS');
      if(matching.length===1){
        const receipts=await readCreateInvoiceReceipts(tx,original.client_event_id);
        if(receipts.length!==1)throw Error('INVOICE_SHIPPING_ORIGINAL_RECEIPT_MISSING');
        const receipt=mapInvoiceIssueReceipt(receipts[0],tenantId,original.issued_by,readVat);
        if(receipt.invoiceId!==original.id||receipt.invoiceNumber!==original.invoice_number)throw Error('INVOICE_SHIPPING_ORIGINAL_RECEIPT_INVALID');
        charged.push({invoiceNumber:receipt.invoiceNumber});
      }
    }
    if(charged.length>1)throw Error('INVOICE_SHIPPING_ALLOCATION_AMBIGUOUS');
    if(charged.length===1)lines.push({shipmentGroupId:groupKey,amountCents:0,name:SHIPPING_FEE_COPY.inInvoice(charged[0].invoiceNumber)});
    else if(amountCents!==null)lines.push({shipmentGroupId:groupKey,amountCents,name:SHIPPING_FEE_COPY.line});
  }
  return lines;
}

export async function lockInvoiceCreation(tx:PrivilegedTenantTransaction,tenantId:string,input:{clientEventId:string;orderId:string}):Promise<void>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('f1:invoice:client-event:' || ${tenantId} || ':' || ${input.clientEventId}, 0))`);
  await tx.execute(sql`SELECT private.lock_shipping_customer_v1(${tenantId},(SELECT customer_id FROM public.orders WHERE tenant_id=${tenantId} AND id=${input.orderId}))`);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('f1:invoice:order:' || ${tenantId} || ':' || ${input.orderId}, 0))`);
}

export async function createInvoice(input: unknown, existingTransaction?:PrivilegedTenantTransaction,readVat?:InvoiceVatReader,readShippingSettings?:(tx:PrivilegedTenantTransaction,tenantId:string)=>Promise<{shippingFeeCents?:number|null}|null>): Promise<CreateInvoiceResult> {
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
  const agreementDelegation = input.agreement !== undefined
    && hasAuthorizationArea(authorization.data, "auftraege");
  if (!hasAuthorizationArea(authorization.data, "geld") && !agreementDelegation) {
    return { code: "FORBIDDEN", message: "Geld, Preise & Buchhaltung ist nicht freigegeben." };
  }

  const tenantId = authorization.data.tenantId;
  const actorId = authorization.data.userId;

  try {
    const write=async(tx:PrivilegedTenantTransaction):Promise<CreateInvoiceResult>=>{
      await lockInvoiceCreation(tx,tenantId,input);

      const replayRows = await readCreateInvoiceReceipts(tx, input.clientEventId);
      if (replayRows.length > 0) {
        if (replayRows.length !== 1 || !replayRows[0]) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        // Validate the complete persisted original before comparing the caller.
        // A valid receipt owned by another actor is a key conflict, not an outage;
        // damaged receipts still fail the unchanged integrity validator.
        const receipt = mapInvoiceIssueReceipt(replayRows[0], tenantId, replayRows[0].actor_id,requireVatReader(readVat));
        return receipt.issuedBy === actorId && receiptMatchesIntent(receipt, input,replayRows[0])
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
          payment_mode, payment_mode_version,handover_mode
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
      const agreement = input.agreement === undefined
        ? null
        : await readEffectiveCustomerAgreement(tx, {
            tenantId,
            customerId: order.customer_id,
            orderId: order.id,
            lock: true,
          });
      if (
        input.agreement !== undefined
        && (
          agreement === null
          || agreement.id !== input.agreement.id
          || agreement.version !== input.agreement.version
          || agreement.type !== input.agreement.type
        )
      ) {
        return { code: "VALIDATION_ERROR", message: "Zahlung fehlt." };
      }
      const afterGoodsOut = order.station === "abgeholt" && order.status === "abgeholt";
      if (
        (order.station !== STATION || order.status !== STATION)
        && !(afterGoodsOut && order.payment_mode === "rechnung")
      ) {
        return { code: "VALIDATION_ERROR", message: "Nur ein fertiggestellter Auftrag kann in Rechnung gestellt werden." };
      }

      // service_date arrives Berlin-normalised from the read port. The command
      // never derives a calendar day from the database session time zone.
      const sourceRows = await tx.execute<SourceRow>(sql`
        SELECT source.*,EXISTS(SELECT 1 FROM private.quote_conversion_receipts receipt JOIN private.quotes quote ON quote.tenant_id=receipt.tenant_id AND quote.id=receipt.quote_id AND quote.linked_order_id=receipt.order_id WHERE receipt.tenant_id=source.tenant_id AND receipt.order_id=source.order_id) AS has_quote
        FROM private.v_invoice_issue_source_v2 source
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

      if (!source.no_active_invoice && input.shippingCosts===undefined) {
        return { code: "CONFLICT", message: "Für diesen Auftrag besteht bereits eine aktive Rechnung." };
      }
      // The additional document references a fully qualified released original;
      // it never changes or rebinds that document's goods prices.
      let originalInvoiceNumber:string|undefined;
      if(input.shippingCosts){
        const originals=await tx.execute<LockedInvoice&{client_event_id:string;issued_by:string;belegart:string}>(sql`
          SELECT * FROM public.invoices WHERE tenant_id=${tenantId} AND id=${input.shippingCosts.invoiceId}::uuid
            AND contract_version=1 FOR UPDATE`);
        const original=originals[0];
        if(originals.length!==1||!original||original.order_id!==order.id||original.belegart!=='auftrag'
          ||original.status!=='issued'||original.aggregate_version!==input.shippingCosts.expectedVersion){
          return {code:'CONFLICT',message:SHIPPING_FEE_COPY.changed};
        }
        if(!original.pdf_content||createHash('sha256').update(original.pdf_content).digest('hex')!==original.pdf_sha256)throw Error('INVOICE_SHIPPING_ORIGIN_PDF_INVALID');
        parseStoredSnapshot(original.snapshot,original,requireVatReader(readVat));
        const receipts=await readCreateInvoiceReceipts(tx,original.client_event_id);
        if(receipts.length!==1)throw Error('INVOICE_SHIPPING_ORIGIN_RECEIPT_MISSING');
        const originalReceipt=mapInvoiceIssueReceipt(receipts[0],tenantId,original.issued_by,requireVatReader(readVat));
        if(originalReceipt.invoiceId!==original.id)throw Error('INVOICE_SHIPPING_ORIGIN_RECEIPT_INVALID');
        originalInvoiceNumber=originalReceipt.invoiceNumber;
      }
      const commercial=source.has_quote&&input.shippingCosts===undefined?await readOrderCommercialQuote(tx,tenantId,order.id):null;
      if(commercial){
        if(!Array.isArray(source.base_lines)||source.base_lines.some(line=>!plainObject(line)||typeof line.itemId!=='string'))throw Error('INVOICE_QUOTE_BASE_SOURCE_INVALID');
        const awardedItems=new Set(commercial.positions.map(row=>row.itemId));
        // A07-12/14: additional parts keep the ordinary invoice source. Only
        // the actually awarded items are replaced by the canonical KV terms.
        const additional=source.base_lines.filter(line=>!awardedItems.has(line.itemId));
        const checkedAdditional=additional.some(line=>line.unitNetAmountCents===null||line.lineNetAmountCents===null)?null:parseBaseLines(additional.map(({vat_rate_basis_points:rate,...line})=>{void rate;return line;}));
        source.base_lines=[...commercial.positions.map(row=>{
          const quantity=row.quantity;
          return {itemId:row.itemId,name:row.name,quantity,unitNetAmountCents:Number((BigInt(row.lineTotalCents)+BigInt(quantity)/BigInt(2))/BigInt(quantity)),lineNetAmountCents:row.lineTotalCents,vat_rate_basis_points:row.vatRateBasisPoints??commercial.vatRateBasisPoints};
        }),...additional];
        if(!Array.isArray(source.extra_work_lines))throw Error('INVOICE_QUOTE_EXTRA_WORK_SOURCE_INVALID');
        source.extra_work_lines=source.extra_work_lines.map(line=>{
          if(!plainObject(line)||typeof line.itemId!=='string')throw Error('INVOICE_QUOTE_EXTRA_WORK_SOURCE_INVALID');
          const positions=commercial.positions.filter(position=>position.itemId===line.itemId);
          return {...line,vat_rate_basis_points:positions.length===1?(positions[0].vatRateBasisPoints??commercial.vatRateBasisPoints??null):line.vat_rate_basis_points};
        });
        // The existing canonical awarded-quote port proves these prices; no price is copied into an intake intent.
        source.base_line_count=commercial.positions.length+additional.length;
        if(checkedAdditional!==null)source.base_net_amount_cents=commercial.totalNetCents+checkedAdditional.reduce((sum,line)=>sum+line.lineNetAmountCents,0);
        source.base_prices_complete=checkedAdditional!==null&&source.base_line_count>0&&commercial.positions.every(row=>Number.isSafeInteger(row.lineTotalCents)&&row.lineTotalCents>=0);
      }
      if(commercial||input.shippingCosts){
        // Recompose the existing structural guards with the canonical quote price proof.
        // The legacy SQL projection includes item prices in integrity_ok, which are
        // deliberately absent for a quote-backed intake. No structural guard is waived.
        const proofs=await tx.execute<{frozen:boolean;handed_over:boolean}>(sql`
          SELECT count(*)=1 AND bool_and(frozen_state.active AND frozen_state.integrity_ok AND frozen_state.freeze_id=${source.freeze_id}::uuid) AS frozen,
            (SELECT count(*)=1 AND bool_and(receipt.integrity_ok) FROM private.v_goods_out_receipt_v2 receipt WHERE receipt.tenant_id=${tenantId} AND receipt.order_id=${order.id} AND receipt.order_version=${order.version}) AS handed_over
          FROM private.v_order_freeze_state_v1 frozen_state WHERE frozen_state.tenant_id=${tenantId} AND frozen_state.order_id=${order.id}
        `);
        const structural=proofs.length===1&&proofs[0].frozen===true&&source.seller_config_complete&&source.customer_config_complete
          &&(input.shippingCosts!==undefined||source.base_prices_complete);
        source.post_goods_out_invoice_eligible=structural&&proofs[0].handed_over===true&&order.payment_mode==='rechnung'&&order.station==='abgeholt'&&order.status==='abgeholt';
        source.effective_integrity_ok=structural&&(order.station==='fertig'||source.post_goods_out_invoice_eligible);
      }
      if (
        !source.effective_integrity_ok
        || (afterGoodsOut && !source.post_goods_out_invoice_eligible)
        || !source.seller_config_complete
        || !source.customer_config_complete
        || (input.shippingCosts===undefined&&!source.base_prices_complete)
      ) {
        return { code: "VALIDATION_ERROR", message: "Stammdaten für die Rechnungsausgabe sind unvollständig." };
      }

      const sourcePaymentTermDays = toSafeInteger(source.invoice_payment_term_days, "INVOICE_PAYMENT_TERM_INVALID");
      const requestedPaymentTermDays = agreement?.type === "zahlungsziel"
        ? agreement.targetDays
        : sourcePaymentTermDays;
      if (
        typeof requestedPaymentTermDays !== "number"
        || !Number.isSafeInteger(requestedPaymentTermDays)
        || requestedPaymentTermDays < 1
        || requestedPaymentTermDays > 365
      ) {
        return { code: "VALIDATION_ERROR", message: "Stammdaten für die Rechnungsausgabe sind unvollständig." };
      }
      const paymentTermDays = requestedPaymentTermDays;

      // Every master-data dependent value is built before a number exists, so
      // an incomplete tenant, customer, order or position cannot consume one.
      let content: PreparedInvoiceContent;
      try {
        let shippingFees:Array<{shipmentGroupId:string;amountCents:number;name:string}>=[];
        if(order.handover_mode==='shipping'){
          if(!readShippingSettings)throw Error('INVOICE_SHIPPING_SETTINGS_PORT_MISSING');
          const settings=await readShippingSettings(tx,tenantId);
          if(!settings||settings.shippingFeeCents===undefined)throw Error('INVOICE_SHIPPING_SETTINGS_SOURCE_MISSING');
          shippingFees=await readShippingInvoiceLines(tx,tenantId,order,settings.shippingFeeCents,requireVatReader(readVat));
        }
        if(input.shippingCosts){
          const intent=input.shippingCosts;
          shippingFees=shippingFees.filter(line=>intent.scope.startsWith('sendung:')?line.shipmentGroupId===intent.scope:!line.shipmentGroupId.startsWith('sendung:'));
          if(shippingFees.length===0||!shippingFees.some(line=>line.name===SHIPPING_FEE_COPY.line)
            ||shippingFees.reduce((sum,line)=>sum+line.amountCents,0)!==intent.expectedFeeCents){
            return {code:'CONFLICT',message:SHIPPING_FEE_COPY.changed};
          }
        }
        content = prepareInvoiceContent(source, order,shippingFees,input.shippingCosts!==undefined);
      } catch (error) {
        if (error instanceof InvoiceVatRateError) return {code:"VALIDATION_ERROR",message:error.missingCompany?INVOICE_VAT_COPY.missingCompanyRate(error.part):INVOICE_VAT_COPY.missingRate(error.part)};
        if (error instanceof InvoiceMasterDataError) {
          return { code: "VALIDATION_ERROR", message: "Stammdaten für die Rechnungsausgabe sind unvollständig." };
        }
        throw error;
      }
      const { netAmountCents, vatRateBasisPoints, vatAmountCents, grossAmountCents } = content.totals;
      if(commercial){
        const bound=await bindOrderQuoteCommercialTerms(tx,authorization.data,order.id);
        const unchanged=bound.shippingIncluded===commercial.shippingIncluded&&bound.quoteId===commercial.quoteId&&bound.edition===commercial.edition
          &&bound.totalNetCents===commercial.totalNetCents&&bound.positions.length===commercial.positions.length
          &&new Set(bound.positions.map(position=>position.itemId)).size===bound.positions.length
          &&bound.positions.every(position=>{
            const prior=commercial.positions.filter(original=>original.itemId===position.itemId);
            return prior.length===1&&prior[0].quantity===position.quantity&&prior[0].lineTotalCents===position.lineTotalCents
              &&(prior[0].vatRateBasisPoints??commercial.vatRateBasisPoints??source.invoice_vat_rate_basis_points)
                ===(position.vatRateBasisPoints??bound.vatRateBasisPoints??source.invoice_vat_rate_basis_points);
          });
        if(!unchanged)throw Error('QUOTE_COMMERCIAL_TERMS_CHANGED_DURING_INVOICE');
      }

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
        schemaVersion: 2,
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
          createImmutableInvoicePdfDocument({ invoiceNumber, dueDate, snapshot,vat:requireVatReader(readVat)(snapshot),originalInvoiceNumber }),
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
      const invoiceEventType = afterGoodsOut ? EVENT_TYPE_V2 : EVENT_TYPE;
      const invoiceEventSchemaVersion = afterGoodsOut ? 2 : EVENT_SCHEMA_VERSION;
      const invoiceEventStation = afterGoodsOut ? "abgeholt" : STATION;
      const eventPayload = {
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
        ...(input.shippingCosts?{shippingCosts:input.shippingCosts}:{}),
        ...(afterGoodsOut ? { invoiceSourceState: "after_goods_out" as const } : {}),
      };

      const eventRows = await tx.execute<{ event_id: string }>(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, item_id, event_type, description, user_id,
          payload, status, station, client_event_id, event_schema_version,
          correlation_id, aggregate_version, from_station, created_at
        ) VALUES (
          gen_random_uuid()::text, ${tenantId}, ${order.id}, NULL,
          ${invoiceEventType}, 'Unveränderliche Rechnung erstellt', ${actorId}::uuid,
          ${JSON.stringify(eventPayload)}::jsonb,
          'success', ${invoiceEventStation}, ${input.clientEventId}::uuid, ${invoiceEventSchemaVersion},
          ${correlationId}::uuid, 1, ${invoiceEventStation},
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
          payment_correlation_id, payment_version,belegart,ursprung_rechnung_id
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
          ${grossAmountCents}, 0, 'EUR', NULL, NULL, NULL, NULL, NULL, 0,
          ${input.shippingCosts?'versandkosten':'auftrag'},${input.shippingCosts?.invoiceId??null}::uuid
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

      const receiptRows = await readCreateInvoiceReceipts(tx, input.clientEventId);
      if (receiptRows.length !== 1 || !receiptRows[0]) throw new Error("INVOICE_RECEIPT_MISSING");
      const receipt = mapInvoiceIssueReceipt(receiptRows[0], tenantId, actorId,requireVatReader(readVat));
      if (
        !receiptMatchesIntent(receipt, input,receiptRows[0])
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
    };
    return existingTransaction ? await write(existingTransaction) : await withPrivilegedTenantTransaction(authorization.data,write);
  } catch (error) {
    const cause = error && typeof error === "object" && "cause" in error
      ? (error as { cause?: { code?: unknown; constraint_name?: unknown } }).cause
      : undefined;
    console.error("INVOICE_CREATE_UNAVAILABLE", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage:error instanceof Error?error.message:'UNKNOWN_INVOICE_ERROR',
      databaseCode: typeof cause?.code === "string" ? cause.code : null,
      constraint: typeof cause?.constraint_name === "string" ? cause.constraint_name : null,
    });
    return { code: "UNAVAILABLE", message: "Rechnung konnte nicht sicher ausgestellt werden." };
  }
}

export type CancellationCreditComposition={failed:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,key:string)=>Promise<void>;settled:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,key:string)=>Promise<void>};
export async function cancelInvoice(input: unknown,readVat?:InvoiceVatReader,creditComposition?:CancellationCreditComposition): Promise<CancelInvoiceResult> {
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
  if (
    !hasAuthorizationArea(authorization.data, "geld")
  ) {
    return { code: "FORBIDDEN", message: "Geld, Preise & Buchhaltung ist nicht freigegeben." };
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
        const receipt = mapCancellationReceipt(replayRows[0], tenantId, replayRows[0].actor_id);
        return receipt.cancelledBy === actorId && cancellationReceiptMatchesIntent(receipt, input)
          ? await completeCancellationCredit(tx,authorization.data,receipt,true,creditComposition)
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

      // Payment confirmation locks the order before the invoice. Cancellation
      // uses the same order to avoid an invoice->order / order->invoice
      // deadlock through the cancellation event's order foreign key.
      const customerRows=await tx.execute<{customer_id:string|null}>(sql`
        SELECT customer_id FROM public.invoices
        WHERE tenant_id=${tenantId} AND id=${input.invoiceId}::uuid LIMIT 2
      `);
      if(customerRows.length!==1||!customerRows[0]?.customer_id)return {code:'NOT_FOUND',message:CUSTOMER_CREDIT_COPY.notFound};
      // All credit commands acquire the same customer lock before order/invoice locks.
      await tx.execute(sql`SELECT private.lock_customer_credit_v1(${tenantId},${customerRows[0].customer_id})`);
      const orderRows = await tx.execute<LockedCancellationOrder>(sql`
        SELECT orders.id, orders.tenant_id
        FROM public.invoices invoice
        JOIN public.orders orders
          ON orders.id = invoice.order_id
         AND orders.tenant_id = invoice.tenant_id
        WHERE invoice.id = ${input.invoiceId}::uuid
          AND invoice.tenant_id = ${tenantId}
          AND invoice.contract_version = 1
        LIMIT 2
        FOR UPDATE OF orders
      `);
      if (
        orderRows.length !== 1
        || !orderRows[0]
        || orderRows[0].tenant_id !== tenantId
      ) {
        return { code: "NOT_FOUND", message: "Rechnung nicht verfügbar." };
      }

      const invoiceRows = await tx.execute<LockedInvoice>(sql`
        SELECT
          id, tenant_id, order_id, invoice_number, status, aggregate_version,
          snapshot, due_date, pdf_ref, pdf_sha256, pdf_content,
          net_amount_cents, vat_rate_basis_points, vat_amount_cents,
          gross_amount_cents, payment_contract_version, payment_mode,
          payment_status, payment_open_amount_cents, payment_paid_amount_cents,
          payment_currency, payment_method, payment_paid_at,
          payment_receipt_id, payment_event_id, payment_correlation_id,
          payment_version
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
      if (invoice.order_id !== orderRows[0].id) {
        throw new Error("INVOICE_CANCEL_ORDER_INTEGRITY_INVALID");
      }
      if (invoice.status !== "issued" || invoice.aggregate_version !== input.expectedVersion) {
        return { code: "CONFLICT", message: "Rechnung wurde bereits verändert." };
      }
      if (input.expectedVersion !== 1) {
        return { code: "CONFLICT", message: "Rechnung wurde bereits verändert." };
      }
      const paymentRows=await tx.execute<PaymentSummaryRow>(sql`
        SELECT * FROM private.v_payment_summary_v1
        WHERE tenant_id=${tenantId} AND invoice_id=${invoice.id}::uuid LIMIT 2
      `);
      let cancellationPayment:PaymentSummary;
      try{
        if(paymentRows.length!==1||!paymentRows[0])throw Error('INVOICE_CANCEL_PAYMENT_SOURCE_MISSING');
        cancellationPayment=mapPaymentSummaryRow(paymentRows[0],authorization.data);
      }catch{return {code:'CONFLICT',message:CUSTOMER_CREDIT_COPY.paymentUnknown};}
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
      const snapshot = parseStoredSnapshot(invoice.snapshot, invoice, requireVatReader(readVat));

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
            vat:requireVatReader(readVat)(snapshot),
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
          AND payment_contract_version = ${PAYMENT_CONTRACT_VERSION}
          AND payment_mode IN ('vorkasse', 'abholung', 'rechnung')
          AND payment_status = ${cancellationPayment.status}
          AND payment_paid_amount_cents = ${cancellationPayment.paidAmountCents}
          AND payment_open_amount_cents = ${cancellationPayment.openAmountCents}
          AND payment_currency = 'EUR'
          AND payment_version = ${cancellationPayment.paymentVersion}
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

      return completeCancellationCredit(tx,authorization.data,receipt,false,creditComposition);
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Rechnung konnte nicht sicher storniert werden." };
  }
}

async function completeCancellationCredit(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,receipt:ImmutableInvoiceCancellationReceipt,replayed:boolean,composition?:CancellationCreditComposition):Promise<CancelInvoiceResult>{
  try{
    await withTenantSavepoint(tx,nested=>appendCancellationCredit(nested,auth.tenantId,receipt));
    if(composition)await withTenantSavepoint(tx,nested=>composition.settled(nested,auth,receipt.clientEventId));
    return {code:'OK',receipt,replayed};
  }catch(error){
    console.error('[CUSTOMER_CREDIT_FOLLOWUP_FAILED]',{name:error instanceof Error?error.name:'UnknownError'});
    // Cancellation remains committed. Its original N5/actor/receipt is the
    // retry marker even when the ordinary task's own receipt is unavailable.
    try{if(!composition)throw Error('CUSTOMER_CREDIT_TASK_PORT_MISSING');await withTenantSavepoint(tx,nested=>composition.failed(nested,auth,receipt.clientEventId));}
    catch(taskError){console.error('[CUSTOMER_CREDIT_TASK_PENDING]',{name:taskError instanceof Error?taskError.name:'UnknownError'});}
    return {code:'UNAVAILABLE',message:CUSTOMER_CREDIT_COPY.pending};
  }
}


function requireVatReader(reader:InvoiceVatReader|undefined):InvoiceVatReader{
 return reader??readInvoiceVat;
}
