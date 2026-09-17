import type {
  ReadEnvelopeV1,
  ReceiptRecoveryDecisionV1,
  RecoveryQueryV1,
  ValidationResultV1,
} from "./types";
import type { AccountingSourceIdV1 } from "./version";
import {
  canonicalSourceBoundaryError,
  contractErrorV1,
  isReadEnvelopeV1,
} from "./validation";

export function decideReceiptRecoveryV1<TReceipt>(
  envelopeInput: unknown,
  query: RecoveryQueryV1,
  expectedSource: AccountingSourceIdV1,
  validateReceipt: (value: unknown) => ValidationResultV1<TReceipt>,
  matchesIntent: (receipt: TReceipt) => boolean,
): ReceiptRecoveryDecisionV1<TReceipt> {
  const sourceError = canonicalSourceBoundaryError(envelopeInput, expectedSource);
  if (sourceError) return { state: "integrity_failure", error: sourceError };
  if (!isReadEnvelopeV1(envelopeInput)) {
    return {
      state: "integrity_failure",
      error: contractErrorV1("INTEGRITY_ERROR", "Recovery read envelope is invalid.", "after_reconciliation"),
    };
  }
  const envelope = envelopeInput as ReadEnvelopeV1<unknown>;
  if (envelope.state === "denied") return { state: "denied", error: envelope.error };
  if (
    envelope.state === "unavailable"
    || envelope.state === "unknown"
    || envelope.asOf === null
    || envelope.stale
    || envelope.partial
    || envelope.coverage.state !== "complete"
  ) {
    return {
      state: "unknown",
      retry: "forbidden_until_reconciled",
      query,
      error: envelope.error ?? contractErrorV1(
        envelope.stale ? "STALE_READ" : "PARTIAL_READ",
        "Recovery read is not complete and fresh.",
        "after_reconciliation",
      ),
    };
  }
  if (envelope.state === "empty") {
    return { state: "not_committed", retry: "same_idempotency_key_only", query };
  }
  let validated: ValidationResultV1<TReceipt>;
  try {
    validated = validateReceipt(envelope.data);
  } catch {
    return {
      state: "integrity_failure",
      error: contractErrorV1("INTEGRITY_ERROR", "Receipt validation failed.", "after_reconciliation"),
    };
  }
  if (!validated.ok) return { state: "integrity_failure", error: validated.error };
  if (!matchesIntent(validated.value)) {
    return {
      state: "integrity_failure",
      error: contractErrorV1(
        "IDEMPOTENCY_CONFLICT",
        "Receipt exists but does not match the requested intent.",
        "after_reconciliation",
      ),
    };
  }
  return { state: "resolved", receipt: validated.value };
}
