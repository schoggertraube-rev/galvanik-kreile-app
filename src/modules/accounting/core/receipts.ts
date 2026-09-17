import {
  ACCOUNTING_CORE_CONTRACT_VERSION,
  ACCOUNTING_NEW_CANCELLATION_REASON_MIN_LENGTH_V1,
  ACCOUNTING_NEW_INVOICE_VAT_RATE_BASIS_POINTS_V1,
} from "./version";
import type {
  DurableReceiptBaseV1,
  HistoricalInvoiceCancelledReadCompatibilityV1,
  HistoricalInvoiceIssuedReadCompatibilityV1,
  InvoiceCancelledReceiptV1,
  InvoiceIssuedReceiptV1,
  PaymentConfirmedReceiptV1,
  ValidationResultV1,
} from "./types";
import {
  contractErrorV1,
  hasExactKeys,
  isCanonicalId,
  isInvoiceNumber,
  isIsoDate,
  isIsoInstant,
  isMoneyV1,
  isPositiveCents,
  isRecord,
  isSafeNonNegativeInteger,
  isSha256,
  isUuid,
} from "./validation";

const BASE_KEYS = [
  "actorId", "contractVersion", "correlationId", "eventId", "idempotencyKey",
  "intentId", "occurredAt", "receiptId", "tenantId",
] as const;
const ISSUE_KEYS = [
  ...BASE_KEYS, "aggregateVersion", "dueDate", "eventSchemaVersion", "eventType",
  "expectedOrderVersion", "gross", "invoiceId", "invoiceNumber", "invoiceSourceState",
  "kind", "net", "orderId", "pdfRef", "pdfSha256", "serviceDate", "status",
  "vat", "vatRateBasisPoints",
] as const;
const CANCEL_KEYS = [
  ...BASE_KEYS, "aggregateVersion", "cancellationPdfRef", "cancellationPdfSha256",
  "eventSchemaVersion", "eventType", "expectedAggregateVersion", "invoiceId",
  "invoiceNumber", "kind", "orderId", "originalPdfSha256", "reason", "status",
] as const;
const PAYMENT_KEYS = [
  ...BASE_KEYS, "amount", "eventSchemaVersion", "eventType", "expectedPaymentVersion",
  "gross", "invoiceId", "invoiceNumber", "kind", "method", "open", "orderId",
  "paid", "paymentStatus", "paymentVersion", "source",
] as const;

function baseValid(value: Record<string, unknown>): value is Record<keyof DurableReceiptBaseV1, unknown> {
  return value.contractVersion === ACCOUNTING_CORE_CONTRACT_VERSION
    && isCanonicalId(value.receiptId, 200)
    && isUuid(value.eventId)
    && isUuid(value.intentId)
    && isUuid(value.idempotencyKey)
    && isUuid(value.correlationId)
    && isCanonicalId(value.tenantId, 128)
    && isCanonicalId(value.actorId, 128)
    && isIsoInstant(value.occurredAt);
}

function receiptError(message: string): ValidationResultV1<never> {
  return { ok: false, error: contractErrorV1("INTEGRITY_ERROR", message, "after_reconciliation") };
}

function sameCurrency(...values: readonly unknown[]): boolean {
  return values.every((value) => isMoneyV1(value) && value.currency === "EUR");
}

export function validateInvoiceIssuedReceiptV1(value: unknown): ValidationResultV1<InvoiceIssuedReceiptV1> {
  const compatibility = validateHistoricalInvoiceIssuedReadCompatibilityV1(value);
  if (!compatibility.ok) return compatibility;
  if (
    compatibility.value.vatRateBasisPoints !== ACCOUNTING_NEW_INVOICE_VAT_RATE_BASIS_POINTS_V1
    || compatibility.value.net.amountCents <= 0
  ) return receiptError("New invoice execution proof violates the issuance policy.");
  return { ok: true, value: compatibility.value as InvoiceIssuedReceiptV1 };
}

export function validateHistoricalInvoiceIssuedReadCompatibilityV1(
  value: unknown,
): ValidationResultV1<HistoricalInvoiceIssuedReadCompatibilityV1> {
  if (!isRecord(value) || !hasExactKeys(value, ISSUE_KEYS) || !baseValid(value)) {
    return receiptError("Invoice receipt shape or base identity is invalid.");
  }
  const versionPairValid = (
    value.eventType === "INVOICE_CREATED_V1"
    && value.eventSchemaVersion === 1
    && value.invoiceSourceState === "before_goods_out"
  ) || (
    value.eventType === "INVOICE_CREATED_V2"
    && value.eventSchemaVersion === 2
    && value.invoiceSourceState === "after_goods_out"
  );
  if (
    value.kind !== "invoice_issued"
    || !versionPairValid
    || value.receiptId !== value.eventId
    || !isCanonicalId(value.invoiceId, 128)
    || !isInvoiceNumber(value.invoiceNumber)
    || !isCanonicalId(value.orderId, 128)
    || !isSafeNonNegativeInteger(value.expectedOrderVersion, 2_147_483_647)
    || value.aggregateVersion !== 1
    || value.status !== "issued"
    || !sameCurrency(value.net, value.vat, value.gross)
    || (value.vatRateBasisPoints !== 700 && value.vatRateBasisPoints !== 1900)
    || !isIsoDate(value.serviceDate)
    || !isIsoDate(value.dueDate)
    || value.dueDate < value.serviceDate
    || !isCanonicalId(value.pdfRef, 500)
    || !isSha256(value.pdfSha256)
  ) return receiptError("Invoice receipt contract values are invalid.");
  if (!isMoneyV1(value.net) || !isMoneyV1(value.vat) || !isMoneyV1(value.gross)) {
    return receiptError("Invoice receipt monetary values are invalid.");
  }
  if (
    value.net.amountCents + value.vat.amountCents !== value.gross.amountCents
    || Math.round((value.net.amountCents * value.vatRateBasisPoints) / 10_000) !== value.vat.amountCents
  ) return receiptError("Invoice receipt totals are inconsistent.");
  return { ok: true, value: value as unknown as HistoricalInvoiceIssuedReadCompatibilityV1 };
}

export function validateInvoiceCancelledReceiptV1(value: unknown): ValidationResultV1<InvoiceCancelledReceiptV1> {
  const compatibility = validateHistoricalInvoiceCancelledReadCompatibilityV1(value);
  if (!compatibility.ok) return compatibility;
  if (compatibility.value.reason.length < ACCOUNTING_NEW_CANCELLATION_REASON_MIN_LENGTH_V1) {
    return receiptError("New cancellation execution proof violates the reason policy.");
  }
  return { ok: true, value: compatibility.value };
}

export function validateHistoricalInvoiceCancelledReadCompatibilityV1(
  value: unknown,
): ValidationResultV1<HistoricalInvoiceCancelledReadCompatibilityV1> {
  if (!isRecord(value) || !hasExactKeys(value, CANCEL_KEYS) || !baseValid(value)) {
    return receiptError("Cancellation receipt shape or base identity is invalid.");
  }
  if (
    value.kind !== "invoice_cancelled"
    || value.eventType !== "INVOICE_CANCELLED_V1"
    || value.eventSchemaVersion !== 1
    || value.receiptId !== value.eventId
    || !isCanonicalId(value.invoiceId, 128)
    || !isInvoiceNumber(value.invoiceNumber)
    || !isCanonicalId(value.orderId, 128)
    || value.expectedAggregateVersion !== 1
    || value.aggregateVersion !== 2
    || value.status !== "cancelled"
    || !isCanonicalId(value.reason, 500)
    || value.reason.length < 5
    || !isSha256(value.originalPdfSha256)
    || !isCanonicalId(value.cancellationPdfRef, 500)
    || !isSha256(value.cancellationPdfSha256)
  ) return receiptError("Cancellation receipt contract values are invalid.");
  return { ok: true, value: value as unknown as HistoricalInvoiceCancelledReadCompatibilityV1 };
}

export function validatePaymentConfirmedReceiptV1(value: unknown): ValidationResultV1<PaymentConfirmedReceiptV1> {
  if (!isRecord(value) || !hasExactKeys(value, PAYMENT_KEYS) || !baseValid(value)) {
    return receiptError("Payment receipt shape or base identity is invalid.");
  }
  if (
    value.kind !== "payment_confirmed"
    || value.eventType !== "PAYMENT_CONFIRMED_V1"
    || value.eventSchemaVersion !== 1
    || !isCanonicalId(value.invoiceId, 128)
    || !isInvoiceNumber(value.invoiceNumber)
    || !isCanonicalId(value.orderId, 128)
    || !isSafeNonNegativeInteger(value.expectedPaymentVersion, 2_147_483_646)
    || !isSafeNonNegativeInteger(value.paymentVersion, 2_147_483_647)
    || value.paymentVersion !== value.expectedPaymentVersion + 1
    || !sameCurrency(value.amount, value.gross, value.paid, value.open)
    || (value.paymentStatus !== "partial" && value.paymentStatus !== "paid")
    || !["cash", "bank_transfer", "card"].includes(value.method as string)
    || value.source !== "manual"
  ) return receiptError("Payment receipt contract values are invalid.");
  if (
    !isMoneyV1(value.amount)
    || !isMoneyV1(value.gross)
    || !isMoneyV1(value.paid)
    || !isMoneyV1(value.open)
    || !isPositiveCents(value.amount.amountCents)
    || value.gross.amountCents <= 0
    || value.paid.amountCents <= 0
    || value.paid.amountCents + value.open.amountCents !== value.gross.amountCents
    || value.amount.amountCents > value.paid.amountCents
    || (value.expectedPaymentVersion === 0 && value.amount.amountCents !== value.paid.amountCents)
    || (value.paymentStatus === "partial" && value.open.amountCents <= 0)
    || (value.paymentStatus === "paid" && value.open.amountCents !== 0)
  ) return receiptError("Payment receipt totals or status are inconsistent.");
  return { ok: true, value: value as unknown as PaymentConfirmedReceiptV1 };
}

export function invoiceReceiptMatchesIntentV1(
  receipt: InvoiceIssuedReceiptV1,
  intent: { readonly intentId: string; readonly idempotencyKey: string; readonly orderId: string; readonly expectedVersion: number },
): boolean {
  return receipt.intentId === intent.intentId
    && receipt.idempotencyKey === intent.idempotencyKey
    && receipt.orderId === intent.orderId
    && receipt.expectedOrderVersion === intent.expectedVersion;
}

export function cancellationReceiptMatchesIntentV1(
  receipt: InvoiceCancelledReceiptV1,
  intent: {
    readonly intentId: string;
    readonly idempotencyKey: string;
    readonly invoiceId: string;
    readonly expectedVersion: number;
    readonly reason: string;
  },
): boolean {
  return receipt.intentId === intent.intentId
    && receipt.idempotencyKey === intent.idempotencyKey
    && receipt.invoiceId === intent.invoiceId
    && receipt.expectedAggregateVersion === intent.expectedVersion
    && receipt.reason === intent.reason;
}

export function paymentReceiptMatchesIntentV1(
  receipt: PaymentConfirmedReceiptV1,
  intent: {
    readonly intentId: string;
    readonly idempotencyKey: string;
    readonly invoiceId: string;
    readonly expectedVersion: number;
    readonly amountCents: number;
    readonly currency: "EUR";
    readonly method: PaymentConfirmedReceiptV1["method"];
  },
): boolean {
  return receipt.intentId === intent.intentId
    && receipt.idempotencyKey === intent.idempotencyKey
    && receipt.invoiceId === intent.invoiceId
    && receipt.expectedPaymentVersion === intent.expectedVersion
    && receipt.amount.amountCents === intent.amountCents
    && receipt.amount.currency === intent.currency
    && receipt.method === intent.method;
}
