import {
  ACCOUNTING_CORE_CONTRACT_VERSION,
  ACCOUNTING_ERROR_CODES_V1,
  ACCOUNTING_LEGACY_SOURCE_IDS_V1,
  ACCOUNTING_NEW_CANCELLATION_REASON_MIN_LENGTH_V1,
  ACCOUNTING_SOURCE_IDS_V1,
  type AccountingErrorCodeV1,
  type AccountingSourceIdV1,
} from "./version";
import type {
  CancelInvoiceCommandV1,
  CommandEnvelopeV1,
  ConfirmPaymentCommandV1,
  ContractErrorV1,
  ExplicitConfirmationV1,
  HostRequestV1,
  IssueInvoiceCommandV1,
  MoneyV1,
  ReadEnvelopeV1,
  ValidationResultV1,
} from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HEX_64_PATTERN = /^[a-f0-9]{64}$/;
const INVOICE_NUMBER_PATTERN = /^R-\d{4}-\d{4,}$/;
const MAX_CENTS = 2_147_483_647;
const CANONICAL_SOURCE_IDS = new Set<string>(Object.values(ACCOUNTING_SOURCE_IDS_V1));
const LEGACY_SOURCE_IDS = new Set<string>(ACCOUNTING_LEGACY_SOURCE_IDS_V1);

export function contractErrorV1(
  code: AccountingErrorCodeV1,
  message: string,
  retryability: ContractErrorV1["retryability"] = "never",
  details: ContractErrorV1["details"] = {},
): ContractErrorV1 {
  return { code, message, retryability, details };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

export function isCanonicalId(value: unknown, maxLength = 200): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length >= 1
    && value.length <= maxLength;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isIsoInstant(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_INSTANT_PATTERN.test(value)) return false;
  return Number.isFinite(new Date(value).getTime());
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isSha256(value: unknown): value is string {
  return typeof value === "string" && HEX_64_PATTERN.test(value);
}

export function isInvoiceNumber(value: unknown): value is string {
  return typeof value === "string" && INVOICE_NUMBER_PATTERN.test(value);
}

export function isSafeNonNegativeInteger(value: unknown, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max;
}

export function isPositiveCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= MAX_CENTS;
}

export function isMoneyV1(value: unknown): value is MoneyV1 {
  return isRecord(value)
    && hasExactKeys(value, ["amountCents", "currency"])
    && isSafeNonNegativeInteger(value.amountCents, MAX_CENTS)
    && value.currency === "EUR";
}

/** Accepts only a valid, already canonical BCP-47 language tag. */
export function isCanonicalBcp47LanguageTag(value: unknown): value is string {
  if (!isCanonicalId(value, 35)) return false;
  try {
    const canonical = Intl.getCanonicalLocales(value);
    return canonical.length === 1 && canonical[0] === value;
  } catch {
    return false;
  }
}

/** Accepts only a runtime-supported canonical IANA time-zone identifier. */
export function isCanonicalIanaTimeZone(value: unknown): value is string {
  if (!isCanonicalId(value, 100)) return false;
  const supportedValuesOf = (Intl as unknown as {
    supportedValuesOf?: (key: "timeZone") => string[];
  }).supportedValuesOf;
  if (typeof supportedValuesOf !== "function") return false;
  try {
    return supportedValuesOf("timeZone").includes(value);
  } catch {
    return false;
  }
}

export function validateHostRequestV1(value: unknown): ValidationResultV1<HostRequestV1> {
  if (!isRecord(value) || !hasExactKeys(value, ["correlationId", "locale", "requestId", "timeZone"])) {
    return { ok: false, error: contractErrorV1("UNAUTHENTICATED", "Host request identity is invalid.") };
  }
  if (
    !isUuid(value.requestId)
    || !isUuid(value.correlationId)
    || !isCanonicalBcp47LanguageTag(value.locale)
    || !isCanonicalIanaTimeZone(value.timeZone)
  ) {
    return { ok: false, error: contractErrorV1("UNAUTHENTICATED", "Host request identity is invalid.") };
  }
  return { ok: true, value: value as unknown as HostRequestV1 };
}

export function canonicalSourceBoundaryError(
  value: unknown,
  expectedSource?: AccountingSourceIdV1,
): ContractErrorV1 | null {
  const sourceId = isRecord(value)
    && isRecord(value.source)
    && typeof value.source.sourceId === "string"
    ? value.source.sourceId
    : null;
  if (sourceId !== null && LEGACY_SOURCE_IDS.has(sourceId)) {
    return contractErrorV1(
      "LEGACY_SOURCE_FORBIDDEN",
      "A quarantined accounting source cannot enter the canonical contract.",
      "after_reconciliation",
    );
  }
  if (sourceId === null || !CANONICAL_SOURCE_IDS.has(sourceId) || (expectedSource && sourceId !== expectedSource)) {
    return contractErrorV1(
      "INTEGRITY_ERROR",
      "Accounting read source is not the expected canonical source.",
      "after_reconciliation",
    );
  }
  return null;
}

export function isContractErrorV1(value: unknown): value is ContractErrorV1 {
  if (!isRecord(value) || !hasExactKeys(value, ["code", "details", "message", "retryability"])) return false;
  const detailsAreSafe = isRecord(value.details)
    && Object.keys(value.details).length <= 20
    && Object.entries(value.details).every(([key, detail]) =>
      isCanonicalId(key, 80)
      && (detail === null
        || (typeof detail === "string" && detail.length <= 500)
        || (typeof detail === "number" && Number.isFinite(detail))
        || typeof detail === "boolean"));
  return typeof value.code === "string"
    && ACCOUNTING_ERROR_CODES_V1.includes(value.code as AccountingErrorCodeV1)
    && isCanonicalId(value.message, 500)
    && ["never", "after_readback", "after_reconciliation"].includes(value.retryability as string)
    && detailsAreSafe;
}

export function isReadEnvelopeV1(value: unknown): value is ReadEnvelopeV1<unknown> {
  if (!isRecord(value) || !hasExactKeys(value, [
    "asOf", "contractVersion", "coverage", "data", "denied", "error",
    "partial", "redactions", "source", "stale", "state",
  ])) return false;
  if (
    value.contractVersion !== ACCOUNTING_CORE_CONTRACT_VERSION
    || (value.asOf !== null && !isIsoInstant(value.asOf))
  ) return false;
  if (!isRecord(value.source) || !hasExactKeys(value.source, ["owner", "sourceId", "sourceVersion"])) return false;
  if (
    value.source.owner !== "ACCOUNTING"
    || typeof value.source.sourceId !== "string"
    || !CANONICAL_SOURCE_IDS.has(value.source.sourceId)
    || !isCanonicalId(value.source.sourceVersion, 80)
  ) return false;
  if (!isRecord(value.coverage) || !hasExactKeys(value.coverage, ["reasons", "state"])) return false;
  if (
    !["complete", "partial", "none"].includes(value.coverage.state as string)
    || !Array.isArray(value.coverage.reasons)
    || !value.coverage.reasons.every((reason) => isCanonicalId(reason, 200))
    || (value.coverage.state === "complete" && value.coverage.reasons.length !== 0)
    || (value.coverage.state !== "complete" && value.coverage.reasons.length === 0)
  ) return false;
  if (
    typeof value.stale !== "boolean"
    || typeof value.partial !== "boolean"
    || typeof value.denied !== "boolean"
    || !Array.isArray(value.redactions)
    || !value.redactions.every((entry) => isCanonicalId(entry, 120))
    || value.partial !== (value.coverage.state === "partial")
  ) return false;

  switch (value.state) {
    case "available":
      return value.data !== null && value.error === null && value.denied === false
        && value.coverage.state !== "none" && isIsoInstant(value.asOf);
    case "empty":
      return value.data === null && value.error === null && value.denied === false
        && value.coverage.state === "complete" && isIsoInstant(value.asOf);
    case "denied":
      return value.data === null && value.denied === true && isContractErrorV1(value.error)
        && value.coverage.state === "none";
    case "unavailable":
    case "unknown":
      return value.data === null && value.denied === false && isContractErrorV1(value.error);
    default:
      return false;
  }
}

function isConfirmation(value: unknown, expectedScope: ExplicitConfirmationV1["scope"]): value is ExplicitConfirmationV1 {
  return isRecord(value)
    && hasExactKeys(value, ["confirmedBy", "kind", "scope"])
    && value.kind === "explicit"
    && value.scope === expectedScope
    && isCanonicalId(value.confirmedBy, 128);
}

function validateCommandBase<TPayload>(
  value: unknown,
  expectedScope: ExplicitConfirmationV1["scope"],
  payloadValidator: (payload: unknown) => payload is TPayload,
): ValidationResultV1<CommandEnvelopeV1<TPayload>> {
  if (!isRecord(value) || !hasExactKeys(value, [
    "confirmation", "contractVersion", "expectedVersion", "idempotencyKey",
    "intentId", "payload",
  ])) return { ok: false, error: contractErrorV1("VALIDATION_ERROR", "Command envelope shape is invalid.") };
  if (
    value.contractVersion !== ACCOUNTING_CORE_CONTRACT_VERSION
    || !isUuid(value.intentId)
    || !isUuid(value.idempotencyKey)
    || !isSafeNonNegativeInteger(value.expectedVersion, 2_147_483_646)
    || !isConfirmation(value.confirmation, expectedScope)
    || !payloadValidator(value.payload)
  ) return { ok: false, error: contractErrorV1("VALIDATION_ERROR", "Command envelope values are invalid.") };
  return { ok: true, value: value as unknown as CommandEnvelopeV1<TPayload> };
}

export function validateIssueInvoiceCommandV1(value: unknown): ValidationResultV1<IssueInvoiceCommandV1> {
  return validateCommandBase(value, "issue_invoice", (payload): payload is IssueInvoiceCommandV1["payload"] =>
    isRecord(payload) && hasExactKeys(payload, ["orderId"]) && isCanonicalId(payload.orderId, 128));
}

export function validateCancelInvoiceCommandV1(value: unknown): ValidationResultV1<CancelInvoiceCommandV1> {
  return validateCommandBase(value, "cancel_invoice", (payload): payload is CancelInvoiceCommandV1["payload"] =>
    isRecord(payload)
    && hasExactKeys(payload, ["invoiceId", "reason"])
    && isCanonicalId(payload.invoiceId, 128)
    && isCanonicalId(payload.reason, 500)
    && payload.reason.length >= ACCOUNTING_NEW_CANCELLATION_REASON_MIN_LENGTH_V1);
}

export function validateConfirmPaymentCommandV1(value: unknown): ValidationResultV1<ConfirmPaymentCommandV1> {
  return validateCommandBase(value, "confirm_payment", (payload): payload is ConfirmPaymentCommandV1["payload"] =>
    isRecord(payload)
    && hasExactKeys(payload, ["amount", "invoiceId", "method"])
    && isCanonicalId(payload.invoiceId, 128)
    && isMoneyV1(payload.amount)
    && isPositiveCents(payload.amount.amountCents)
    && ["cash", "bank_transfer", "card"].includes(payload.method as string));
}
