import { describe, expect, it } from "vitest";
import { evaluateCancelSafetyV1, validateCancelStateV1 } from "../core/cancelSafety";
import { decideReceiptRecoveryV1 } from "../core/recovery";
import {
  validateHistoricalInvoiceCancelledReadCompatibilityV1,
  validateHistoricalInvoiceIssuedReadCompatibilityV1,
  validateInvoiceCancelledReceiptV1,
  validateInvoiceIssuedReceiptV1,
} from "../core/receipts";
import type {
  InvoiceCancelStateV1,
  RecoveryQueryV1,
  ValidationResultV1,
} from "../core/types";
import {
  canonicalSourceBoundaryError,
  isCanonicalBcp47LanguageTag,
  isCanonicalIanaTimeZone,
  validateCancelInvoiceCommandV1,
} from "../core/validation";
import { ACCOUNTING_CORE_CONTRACT_VERSION, ACCOUNTING_SOURCE_IDS_V1 } from "../core/version";

const query: RecoveryQueryV1 = {
  kind: "invoice_issued",
  tenantId: "tenant-a",
  intentId: "11111111-1111-4111-8111-111111111111",
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  aggregateId: "order-a",
  expectedVersion: 3,
  expectedAmount: null,
  expectedMethod: null,
  expectedReason: null,
};

function envelope<T>(
  state: "available" | "empty" | "unavailable",
  data: T | null,
  options: { stale?: boolean; partial?: boolean; sourceId?: string } = {},
): unknown {
  const sourceId = options.sourceId ?? ACCOUNTING_SOURCE_IDS_V1.INVOICE_RECEIPT;
  const common = {
    contractVersion: ACCOUNTING_CORE_CONTRACT_VERSION,
    source: { sourceId, sourceVersion: ACCOUNTING_CORE_CONTRACT_VERSION, owner: "ACCOUNTING" as const },
    asOf: "2026-09-17T08:00:00.000Z",
    coverage: {
      state: options.partial ? "partial" as const : "complete" as const,
      reasons: options.partial ? ["limited"] : [],
    },
    stale: options.stale ?? false,
    partial: options.partial ?? false,
    denied: false as const,
    redactions: [],
  };
  if (state === "available") return { ...common, state, data: data as T, error: null };
  if (state === "empty") return { ...common, state, data: null, error: null };
  return {
    ...common,
    state,
    data: null,
    error: { code: "UNAVAILABLE", message: "read failed", retryability: "after_reconciliation", details: {} },
  };
}

function validateReceipt(value: unknown): ValidationResultV1<{ readonly intentId: string }> {
  return value && typeof value === "object" && (value as { intentId?: unknown }).intentId === query.intentId
    ? { ok: true, value: value as { readonly intentId: string } }
    : {
        ok: false,
        error: { code: "INTEGRITY_ERROR", message: "mismatch", retryability: "after_reconciliation", details: {} },
      };
}

function cancellationState(overrides: Partial<InvoiceCancelStateV1> = {}): InvoiceCancelStateV1 {
  return {
    invoiceId: "invoice-a",
    tenantId: "tenant-a",
    lifecycleStatus: "issued",
    aggregateVersion: 1,
    paymentContractVersion: 1,
    gross: { amountCents: 11_900, currency: "EUR" },
    paid: { amountCents: 0, currency: "EUR" },
    open: { amountCents: 11_900, currency: "EUR" },
    paymentStatus: "open",
    paymentVersion: 0,
    latestPaymentMethod: null,
    latestPaymentReceiptId: null,
    latestPaymentEventId: null,
    latestPaymentCorrelationId: null,
    latestPaidAt: null,
    paymentEvidenceCount: 0,
    ...overrides,
  };
}

describe("Accounting A0-A2 neutral core contract", () => {
  it("accepts only exact canonical BCP-47 and runtime-supported IANA identifiers", () => {
    expect(isCanonicalBcp47LanguageTag("de-DE")).toBe(true);
    expect(isCanonicalBcp47LanguageTag("de-de")).toBe(false);
    expect(isCanonicalBcp47LanguageTag("not_a_locale")).toBe(false);
    expect(isCanonicalIanaTimeZone("Europe/Berlin")).toBe(true);
    expect(isCanonicalIanaTimeZone("Europe/Not-A-Zone")).toBe(false);
    expect(isCanonicalIanaTimeZone(" europe/Berlin ")).toBe(false);
  });

  it("emits the unambiguous legacy-source error only at the canonical boundary", () => {
    const legacy = envelope("empty", null, { sourceId: "zahlung" });
    expect(canonicalSourceBoundaryError(legacy)?.code).toBe("LEGACY_SOURCE_FORBIDDEN");
    const unknown = envelope("empty", null, { sourceId: "unknown.accounting.source" });
    expect(canonicalSourceBoundaryError(unknown)?.code).toBe("INTEGRITY_ERROR");
    expect(canonicalSourceBoundaryError(envelope("empty", null))).toBeNull();
  });

  it("permits same-key retry only after complete, fresh, canonical absence", () => {
    const emptyResult = decideReceiptRecoveryV1(
      envelope("empty", null), query, ACCOUNTING_SOURCE_IDS_V1.INVOICE_RECEIPT,
      validateReceipt, () => false,
    );
    expect(emptyResult).toEqual({ state: "not_committed", retry: "same_idempotency_key_only", query });

    for (const unsafe of [
      envelope("unavailable", null),
      envelope("available", { intentId: query.intentId }, { stale: true }),
      envelope("available", { intentId: query.intentId }, { partial: true }),
    ]) {
      const result = decideReceiptRecoveryV1(
        unsafe, query, ACCOUNTING_SOURCE_IDS_V1.INVOICE_RECEIPT, validateReceipt, () => false,
      );
      expect(result.state).toBe("unknown");
      if (result.state === "unknown") expect(result.retry).toBe("forbidden_until_reconciled");
    }

    const denied = decideReceiptRecoveryV1(
      {
        ...(envelope("empty", null) as Record<string, unknown>),
        state: "denied",
        asOf: null,
        coverage: { state: "none", reasons: ["access_denied"] },
        denied: true,
        error: { code: "FORBIDDEN", message: "Access denied.", retryability: "never", details: {} },
      },
      query,
      ACCOUNTING_SOURCE_IDS_V1.INVOICE_RECEIPT,
      validateReceipt,
      () => false,
    );
    expect(denied).toMatchObject({ state: "denied", error: { code: "FORBIDDEN" } });
  });

  it("resolves matching receipts and rejects intent or source mismatches", () => {
    const resolved = decideReceiptRecoveryV1(
      envelope("available", { intentId: query.intentId }), query,
      ACCOUNTING_SOURCE_IDS_V1.INVOICE_RECEIPT, validateReceipt,
      (receipt) => receipt.intentId === query.intentId,
    );
    expect(resolved.state).toBe("resolved");

    const mismatch = decideReceiptRecoveryV1(
      envelope("available", { intentId: query.intentId }), query,
      ACCOUNTING_SOURCE_IDS_V1.INVOICE_RECEIPT, validateReceipt, () => false,
    );
    expect(mismatch.state).toBe("integrity_failure");
    if (mismatch.state === "integrity_failure") expect(mismatch.error.code).toBe("IDEMPOTENCY_CONFLICT");

    const corrupt = decideReceiptRecoveryV1(
      envelope("available", { intentId: "wrong-intent" }), query,
      ACCOUNTING_SOURCE_IDS_V1.INVOICE_RECEIPT, validateReceipt, () => false,
    );
    expect(corrupt).toMatchObject({ state: "integrity_failure", error: { code: "INTEGRITY_ERROR" } });
  });

  it("allows cancellation only for a complete unpaid state with zero payment evidence", () => {
    const allowed = evaluateCancelSafetyV1(cancellationState(), 1);
    expect(allowed.decision).toBe("allow");
    if (allowed.decision === "allow") expect(allowed.precondition.expectedPaymentEvidenceCount).toBe(0);

    const oneCent = cancellationState({
      paid: { amountCents: 1, currency: "EUR" },
      open: { amountCents: 11_899, currency: "EUR" },
      paymentStatus: "partial",
      paymentVersion: 1,
      latestPaymentMethod: "bank_transfer",
      latestPaymentReceiptId: "receipt-a",
      latestPaymentEventId: "event-a",
      latestPaymentCorrelationId: "correlation-a",
      latestPaidAt: "2026-09-17T08:00:00.000Z",
      paymentEvidenceCount: 1,
    });
    expect(evaluateCancelSafetyV1(oneCent, 1)).toMatchObject({ decision: "block", reason: "payment_present" });
    expect(evaluateCancelSafetyV1(cancellationState({ paymentEvidenceCount: 1 }), 1))
      .toMatchObject({ decision: "block", reason: "inconsistent_payment_state" });
    expect(validateCancelStateV1(cancellationState()).ok).toBe(true);
  });

  it("separates current execution proofs from explicitly read-only historical compatibility", () => {
    const base = {
      contractVersion: ACCOUNTING_CORE_CONTRACT_VERSION,
      receiptId: "22222222-2222-4222-8222-222222222222",
      eventId: "22222222-2222-4222-8222-222222222222",
      intentId: "11111111-1111-4111-8111-111111111111",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      correlationId: "33333333-3333-4333-8333-333333333333",
      tenantId: "tenant-a",
      actorId: "44444444-4444-4444-8444-444444444444",
      occurredAt: "2026-09-17T08:00:00.000Z",
    } as const;
    const historicalSevenPercent = {
      ...base,
      kind: "invoice_issued",
      eventType: "INVOICE_CREATED_V1",
      eventSchemaVersion: 1,
      invoiceSourceState: "before_goods_out",
      invoiceId: "55555555-5555-4555-8555-555555555555",
      invoiceNumber: "R-2026-0001",
      orderId: "order-a",
      expectedOrderVersion: 3,
      aggregateVersion: 1,
      status: "issued",
      net: { amountCents: 10_000, currency: "EUR" },
      vatRateBasisPoints: 700,
      vat: { amountCents: 700, currency: "EUR" },
      gross: { amountCents: 10_700, currency: "EUR" },
      serviceDate: "2026-09-17",
      dueDate: "2026-10-17",
      pdfRef: "invoice://55555555-5555-4555-8555-555555555555/original",
      pdfSha256: "a".repeat(64),
    } as const;
    expect(validateHistoricalInvoiceIssuedReadCompatibilityV1(historicalSevenPercent).ok).toBe(true);
    expect(validateInvoiceIssuedReceiptV1(historicalSevenPercent).ok).toBe(false);

    const historicalZeroNet = {
      ...historicalSevenPercent,
      net: { amountCents: 0, currency: "EUR" },
      vat: { amountCents: 0, currency: "EUR" },
      gross: { amountCents: 0, currency: "EUR" },
    } as const;
    expect(validateHistoricalInvoiceIssuedReadCompatibilityV1(historicalZeroNet).ok).toBe(true);
    expect(validateInvoiceIssuedReceiptV1(historicalZeroNet).ok).toBe(false);

    const historicalFiveCharacterCancellation = {
      ...base,
      kind: "invoice_cancelled",
      eventType: "INVOICE_CANCELLED_V1",
      eventSchemaVersion: 1,
      invoiceId: "55555555-5555-4555-8555-555555555555",
      invoiceNumber: "R-2026-0001",
      orderId: "order-a",
      expectedAggregateVersion: 1,
      aggregateVersion: 2,
      status: "cancelled",
      reason: "Alt 5",
      originalPdfSha256: "a".repeat(64),
      cancellationPdfRef: "invoice://55555555-5555-4555-8555-555555555555/cancellation",
      cancellationPdfSha256: "b".repeat(64),
    } as const;
    expect(validateHistoricalInvoiceCancelledReadCompatibilityV1(historicalFiveCharacterCancellation).ok).toBe(true);
    expect(validateInvoiceCancelledReceiptV1(historicalFiveCharacterCancellation).ok).toBe(false);

    const canonicalInvoice = {
      ...historicalSevenPercent,
      vatRateBasisPoints: 1900,
      vat: { amountCents: 1_900, currency: "EUR" },
      gross: { amountCents: 11_900, currency: "EUR" },
    } as const;
    expect(validateInvoiceIssuedReceiptV1(canonicalInvoice).ok).toBe(true);

    const canonicalCancellation = {
      ...historicalFiveCharacterCancellation,
      reason: "Storno neu",
    } as const;
    expect(validateInvoiceCancelledReceiptV1(canonicalCancellation).ok).toBe(true);
  });

  it("rejects five-to-nine-character reasons in the current cancellation command", () => {
    const command = (reason: string) => ({
      contractVersion: ACCOUNTING_CORE_CONTRACT_VERSION,
      intentId: "11111111-1111-4111-8111-111111111111",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      expectedVersion: 1,
      confirmation: {
        kind: "explicit",
        scope: "cancel_invoice",
        confirmedBy: "44444444-4444-4444-8444-444444444444",
      },
      payload: {
        invoiceId: "55555555-5555-4555-8555-555555555555",
        reason,
      },
    });
    for (const reason of ["12345", "123456789"]) {
      expect(validateCancelInvoiceCommandV1(command(reason)).ok).toBe(false);
    }
    expect(validateCancelInvoiceCommandV1(command("1234567890")).ok).toBe(true);
  });
});
