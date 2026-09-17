import type {
  CancelAtomicPreconditionV1,
  ContractErrorV1,
  InvoiceCancelStateV1,
  ValidationResultV1,
} from "./types";
import {
  contractErrorV1,
  hasExactKeys,
  isCanonicalId,
  isIsoInstant,
  isMoneyV1,
  isRecord,
  isSafeNonNegativeInteger,
} from "./validation";

export type CancelSafetyDecisionV1 =
  | { readonly decision: "allow"; readonly precondition: CancelAtomicPreconditionV1 }
  | {
      readonly decision: "block";
      readonly reason: "not_issued" | "stale_aggregate_version" | "payment_present" | "inconsistent_payment_state";
      readonly error: ContractErrorV1;
    };

const CANCEL_STATE_KEYS = [
  "aggregateVersion", "gross", "invoiceId", "latestPaidAt", "latestPaymentCorrelationId",
  "latestPaymentEventId", "latestPaymentMethod", "latestPaymentReceiptId", "lifecycleStatus",
  "open", "paid", "paymentContractVersion", "paymentEvidenceCount", "paymentStatus",
  "paymentVersion", "tenantId",
] as const;

function nullableCanonicalId(value: unknown): value is string | null {
  return value === null || isCanonicalId(value, 200);
}

export function validateCancelStateV1(value: unknown): ValidationResultV1<InvoiceCancelStateV1> {
  if (!isRecord(value) || !hasExactKeys(value, CANCEL_STATE_KEYS)) {
    return { ok: false, error: contractErrorV1("CANCEL_BLOCKED_INCONSISTENT_STATE", "Invoice cancellation state has an invalid shape.") };
  }
  if (
    !isCanonicalId(value.invoiceId, 128)
    || !isCanonicalId(value.tenantId, 128)
    || !["issued", "cancelled"].includes(value.lifecycleStatus as string)
    || !isSafeNonNegativeInteger(value.aggregateVersion, 2_147_483_647)
    || (value.paymentContractVersion !== 1 && value.paymentContractVersion !== null)
    || !isMoneyV1(value.gross)
    || !isMoneyV1(value.paid)
    || !isMoneyV1(value.open)
    || (value.paymentStatus !== "open" && value.paymentStatus !== "partial"
      && value.paymentStatus !== "paid" && value.paymentStatus !== null)
    || !isSafeNonNegativeInteger(value.paymentVersion, 2_147_483_647)
    || !isSafeNonNegativeInteger(value.paymentEvidenceCount, 2_147_483_647)
    || (value.latestPaymentMethod !== "cash" && value.latestPaymentMethod !== "bank_transfer"
      && value.latestPaymentMethod !== "card" && value.latestPaymentMethod !== null)
    || !nullableCanonicalId(value.latestPaymentReceiptId)
    || !nullableCanonicalId(value.latestPaymentEventId)
    || !nullableCanonicalId(value.latestPaymentCorrelationId)
    || (value.latestPaidAt !== null && !isIsoInstant(value.latestPaidAt))
  ) {
    return { ok: false, error: contractErrorV1("CANCEL_BLOCKED_INCONSISTENT_STATE", "Invoice cancellation state contains invalid values.") };
  }
  return { ok: true, value: value as unknown as InvoiceCancelStateV1 };
}

function noPaymentEvidence(state: InvoiceCancelStateV1): boolean {
  return state.paymentEvidenceCount === 0
    && state.latestPaymentMethod === null
    && state.latestPaymentReceiptId === null
    && state.latestPaymentEventId === null
    && state.latestPaymentCorrelationId === null
    && state.latestPaidAt === null;
}

function completePaymentEvidence(state: InvoiceCancelStateV1): boolean {
  return state.paymentEvidenceCount >= 1
    && state.latestPaymentMethod !== null
    && state.latestPaymentReceiptId !== null
    && state.latestPaymentEventId !== null
    && state.latestPaymentCorrelationId !== null
    && state.latestPaidAt !== null;
}

function paymentStateConsistent(state: InvoiceCancelStateV1): boolean {
  if (
    state.paymentContractVersion !== 1
    || state.gross.currency !== "EUR"
    || state.paid.currency !== "EUR"
    || state.open.currency !== "EUR"
    || state.gross.amountCents <= 0
    || state.paid.amountCents + state.open.amountCents !== state.gross.amountCents
  ) return false;
  if (state.paymentStatus === "open") {
    return state.paid.amountCents === 0
      && state.open.amountCents === state.gross.amountCents
      && state.paymentVersion === 0
      && noPaymentEvidence(state);
  }
  if (state.paymentStatus === "partial") {
    return state.paid.amountCents > 0
      && state.open.amountCents > 0
      && state.paymentVersion > 0
      && completePaymentEvidence(state);
  }
  if (state.paymentStatus === "paid") {
    return state.paid.amountCents === state.gross.amountCents
      && state.open.amountCents === 0
      && state.paymentVersion > 0
      && completePaymentEvidence(state);
  }
  return false;
}

export function evaluateCancelSafetyV1(
  stateInput: unknown,
  expectedAggregateVersion: number,
): CancelSafetyDecisionV1 {
  const parsed = validateCancelStateV1(stateInput);
  if (!parsed.ok || !paymentStateConsistent(parsed.value)) {
    return {
      decision: "block",
      reason: "inconsistent_payment_state",
      error: parsed.ok
        ? contractErrorV1("CANCEL_BLOCKED_INCONSISTENT_STATE", "Cancellation is blocked because payment state is inconsistent.")
        : parsed.error,
    };
  }
  const state = parsed.value;
  if (state.lifecycleStatus !== "issued") {
    return { decision: "block", reason: "not_issued", error: contractErrorV1("CONFLICT", "Only an issued invoice can be cancelled.") };
  }
  if (state.aggregateVersion !== expectedAggregateVersion) {
    return {
      decision: "block",
      reason: "stale_aggregate_version",
      error: contractErrorV1("CONFLICT", "Invoice changed after the cancellation intent was created."),
    };
  }
  if (state.paymentStatus !== "open" || state.paid.amountCents !== 0 || state.paymentVersion !== 0 || state.paymentEvidenceCount !== 0) {
    return {
      decision: "block",
      reason: "payment_present",
      error: contractErrorV1("CANCEL_BLOCKED_PAYMENT_PRESENT", "Cancellation is blocked because a payment has been confirmed."),
    };
  }
  return {
    decision: "allow",
    precondition: {
      invoiceId: state.invoiceId,
      tenantId: state.tenantId,
      expectedAggregateVersion: state.aggregateVersion,
      expectedPaymentContractVersion: 1,
      expectedPaymentVersion: 0,
      expectedPaymentStatus: "open",
      expectedCurrency: "EUR",
      expectedGrossAmountCents: state.gross.amountCents,
      expectedPaidAmountCents: 0,
      expectedOpenAmountCents: state.open.amountCents,
      expectedPaymentMethod: null,
      expectedPaymentReceiptId: null,
      expectedPaymentEventId: null,
      expectedPaymentCorrelationId: null,
      expectedPaidAt: null,
      expectedPaymentEvidenceCount: 0,
      policyVersion: "cancel-safety.v1",
    },
  };
}
