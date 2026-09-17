import type { InvoiceSummaryV1, PaymentSummaryV1, ValidationResultV1 } from "./types";
import {
  contractErrorV1,
  hasExactKeys,
  isCanonicalId,
  isInvoiceNumber,
  isIsoDate,
  isIsoInstant,
  isMoneyV1,
  isRecord,
  isSafeNonNegativeInteger,
} from "./validation";

const INVOICE_SUMMARY_KEYS = [
  "aggregateVersion", "cancelledAt", "dueDate", "gross", "invoiceId", "invoiceNumber",
  "issuedAt", "net", "orderId", "serviceDate", "status", "vat",
] as const;
const PAYMENT_SUMMARY_KEYS = [
  "invoiceId", "invoiceNumber", "latestCorrelationId", "latestEventId", "latestMethod",
  "latestPaidAt", "latestReceiptId", "open", "orderId", "paid", "paymentVersion",
  "status", "total",
] as const;

function integrityFailure<T>(message: string): ValidationResultV1<T> {
  return { ok: false, error: contractErrorV1("INTEGRITY_ERROR", message, "after_reconciliation") };
}
export function validateInvoiceSummaryV1(value: unknown): ValidationResultV1<InvoiceSummaryV1> {
  if (!isRecord(value) || !hasExactKeys(value, INVOICE_SUMMARY_KEYS)) {
    return integrityFailure("Invoice summary shape is invalid.");
  }
  if (
    !isCanonicalId(value.invoiceId, 128)
    || !isInvoiceNumber(value.invoiceNumber)
    || !isCanonicalId(value.orderId, 128)
    || (value.status !== "issued" && value.status !== "cancelled")
    || (value.aggregateVersion !== 1 && value.aggregateVersion !== 2)
    || !isMoneyV1(value.net)
    || !isMoneyV1(value.vat)
    || !isMoneyV1(value.gross)
    || value.net.amountCents <= 0
    || value.gross.amountCents <= 0
    || value.net.amountCents + value.vat.amountCents !== value.gross.amountCents
    || !isIsoDate(value.serviceDate)
    || !isIsoDate(value.dueDate)
    || value.dueDate < value.serviceDate
    || !isIsoInstant(value.issuedAt)
    || (value.cancelledAt !== null && !isIsoInstant(value.cancelledAt))
    || (typeof value.cancelledAt === "string" && value.cancelledAt < value.issuedAt)
    || (value.status === "issued" && (value.aggregateVersion !== 1 || value.cancelledAt !== null))
    || (value.status === "cancelled" && (value.aggregateVersion !== 2 || value.cancelledAt === null))
  ) return integrityFailure("Invoice summary values are inconsistent.");
  return { ok: true, value: value as unknown as InvoiceSummaryV1 };
}

function noPaymentEvidence(value: Record<string, unknown>): boolean {
  return value.latestMethod === null
    && value.latestReceiptId === null
    && value.latestEventId === null
    && value.latestCorrelationId === null
    && value.latestPaidAt === null;
}

function completePaymentEvidence(value: Record<string, unknown>): boolean {
  return ["cash", "bank_transfer", "card"].includes(value.latestMethod as string)
    && isCanonicalId(value.latestReceiptId, 200)
    && isCanonicalId(value.latestEventId, 128)
    && isCanonicalId(value.latestCorrelationId, 128)
    && isIsoInstant(value.latestPaidAt);
}

export function validatePaymentSummaryV1(value: unknown): ValidationResultV1<PaymentSummaryV1> {
  if (!isRecord(value) || !hasExactKeys(value, PAYMENT_SUMMARY_KEYS)) {
    return integrityFailure("Payment summary shape is invalid.");
  }
  if (
    !isCanonicalId(value.invoiceId, 128)
    || !isInvoiceNumber(value.invoiceNumber)
    || !isCanonicalId(value.orderId, 128)
    || !isMoneyV1(value.total)
    || !isMoneyV1(value.paid)
    || !isMoneyV1(value.open)
    || value.total.amountCents <= 0
    || value.paid.amountCents + value.open.amountCents !== value.total.amountCents
    || !["open", "partial", "paid"].includes(value.status as string)
    || !isSafeNonNegativeInteger(value.paymentVersion, 2_147_483_647)
  ) return integrityFailure("Payment summary base values are inconsistent.");

  const consistent = (
    value.status === "open"
    && value.paid.amountCents === 0
    && value.open.amountCents === value.total.amountCents
    && value.paymentVersion === 0
    && noPaymentEvidence(value)
  ) || (
    value.status === "partial"
    && value.paid.amountCents > 0
    && value.open.amountCents > 0
    && value.paymentVersion > 0
    && completePaymentEvidence(value)
  ) || (
    value.status === "paid"
    && value.paid.amountCents === value.total.amountCents
    && value.open.amountCents === 0
    && value.paymentVersion > 0
    && completePaymentEvidence(value)
  );
  return consistent
    ? { ok: true, value: value as unknown as PaymentSummaryV1 }
    : integrityFailure("Payment summary status and evidence are inconsistent.");
}
