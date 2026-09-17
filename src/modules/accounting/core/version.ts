export const ACCOUNTING_CORE_CONTRACT_VERSION = "1.0.0-candidate.1" as const;
export const ACCOUNTING_NEW_INVOICE_VAT_RATE_BASIS_POINTS_V1 = 1900 as const;
export const ACCOUNTING_NEW_CANCELLATION_REASON_MIN_LENGTH_V1 = 10 as const;

export const ACCOUNTING_CAPABILITIES_V1 = Object.freeze({
  INVOICE_READ: "accounting.invoice.read.v1",
  INVOICE_ISSUE: "accounting.invoice.issue.v1",
  INVOICE_CANCEL: "accounting.invoice.cancel.v1",
  PAYMENT_READ: "accounting.payment.read.v1",
  PAYMENT_CONFIRM: "accounting.payment.confirm.v1",
  RECEIPT_RECOVERY: "accounting.receipt.recovery.v1",
} as const);

export const ACCOUNTING_SOURCE_IDS_V1 = Object.freeze({
  INVOICE_SUMMARY: "accounting.invoice.summary.v1",
  INVOICE_CANCEL_STATE: "accounting.invoice.cancel-state.v1",
  INVOICE_RECEIPT: "accounting.invoice.receipt.v1",
  INVOICE_CREATED_V2_RECEIPT: "accounting.invoice-created-v2.receipt.v1",
  INVOICE_CANCELLED_RECEIPT: "accounting.invoice-cancelled.receipt.v1",
  PAYMENT_SUMMARY: "accounting.payment.summary.v1",
  PAYMENT_CONFIRMED_RECEIPT: "accounting.payment-confirmed.receipt.v1",
} as const);

/** Quarantined host sources that must never cross the canonical adapter boundary. */
export const ACCOUNTING_LEGACY_SOURCE_IDS_V1 = Object.freeze([
  "ausgangsrechnung",
  "ausgangsrechnung_position",
  "zahlung",
  "payments",
  "beleg",
  "beleg_position",
  "kostenposten",
  "cost_positions",
  "order_cost_positions",
  "export_lauf",
  "bh_audit_log",
] as const);

export const ACCOUNTING_ERROR_CODES_V1 = Object.freeze([
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INTEGRITY_ERROR",
  "UNAVAILABLE",
  "UNKNOWN_OUTCOME",
  "STALE_READ",
  "PARTIAL_READ",
  "IDEMPOTENCY_CONFLICT",
  "CONFIRMATION_REQUIRED",
  "CANCEL_BLOCKED_PAYMENT_PRESENT",
  "CANCEL_BLOCKED_INCONSISTENT_STATE",
  "LEGACY_SOURCE_FORBIDDEN",
] as const);

export type AccountingCapabilityV1 =
  (typeof ACCOUNTING_CAPABILITIES_V1)[keyof typeof ACCOUNTING_CAPABILITIES_V1];
export type AccountingSourceIdV1 =
  (typeof ACCOUNTING_SOURCE_IDS_V1)[keyof typeof ACCOUNTING_SOURCE_IDS_V1];
export type AccountingErrorCodeV1 = (typeof ACCOUNTING_ERROR_CODES_V1)[number];
