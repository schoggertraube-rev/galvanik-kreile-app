import type {
  AccountingCapabilityV1,
  AccountingErrorCodeV1,
  AccountingSourceIdV1,
} from "./version";

export type CurrencyCodeV1 = "EUR";
export type InvoiceLifecycleStatusV1 = "issued" | "cancelled";
export type PaymentStatusV1 = "open" | "partial" | "paid";
export type PaymentMethodV1 = "cash" | "bank_transfer" | "card";
export type PaymentSourceV1 = "manual";
export type CoverageStateV1 = "complete" | "partial" | "none";
export type RetryabilityV1 = "never" | "after_readback" | "after_reconciliation";
export type JsonScalarV1 = string | number | boolean | null;
export type RedactedDetailsV1 = Readonly<Record<string, JsonScalarV1>>;

export interface MoneyV1 {
  readonly amountCents: number;
  readonly currency: CurrencyCodeV1;
}

export interface CoverageV1 {
  readonly state: CoverageStateV1;
  readonly reasons: readonly string[];
}

export interface SourceStampV1 {
  readonly sourceId: AccountingSourceIdV1;
  readonly sourceVersion: string;
  readonly owner: "ACCOUNTING";
}

export interface ContractErrorV1 {
  readonly code: AccountingErrorCodeV1;
  readonly message: string;
  readonly retryability: RetryabilityV1;
  readonly details: RedactedDetailsV1;
}

interface ReadEnvelopeBaseV1 {
  readonly contractVersion: "1.0.0-candidate.1";
  readonly source: SourceStampV1;
  /** Authoritative database/read timestamp; null when no trustworthy read completed. */
  readonly asOf: string | null;
  readonly coverage: CoverageV1;
  readonly stale: boolean;
  readonly partial: boolean;
  readonly denied: boolean;
  readonly redactions: readonly string[];
}

export type ReadEnvelopeV1<T> =
  | (ReadEnvelopeBaseV1 & {
      readonly state: "available";
      readonly data: T;
      readonly error: null;
      readonly denied: false;
    })
  | (ReadEnvelopeBaseV1 & {
      readonly state: "empty";
      readonly data: null;
      readonly error: null;
      readonly denied: false;
    })
  | (ReadEnvelopeBaseV1 & {
      readonly state: "denied";
      readonly data: null;
      readonly error: ContractErrorV1;
      readonly denied: true;
    })
  | (ReadEnvelopeBaseV1 & {
      readonly state: "unavailable" | "unknown";
      readonly data: null;
      readonly error: ContractErrorV1;
      readonly denied: false;
    });

export interface ExplicitConfirmationV1 {
  readonly kind: "explicit";
  readonly scope: "issue_invoice" | "cancel_invoice" | "confirm_payment";
  readonly confirmedBy: string;
}

export interface CommandEnvelopeV1<TPayload> {
  readonly contractVersion: "1.0.0-candidate.1";
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly expectedVersion: number;
  readonly confirmation: ExplicitConfirmationV1;
  readonly payload: TPayload;
}

export interface IssueInvoicePayloadV1 { readonly orderId: string }
export interface CancelInvoicePayloadV1 { readonly invoiceId: string; readonly reason: string }
export interface ConfirmPaymentPayloadV1 {
  readonly invoiceId: string;
  readonly amount: MoneyV1;
  readonly method: PaymentMethodV1;
}

export type IssueInvoiceCommandV1 = CommandEnvelopeV1<IssueInvoicePayloadV1>;
export type CancelInvoiceCommandV1 = CommandEnvelopeV1<CancelInvoicePayloadV1>;
export type ConfirmPaymentCommandV1 = CommandEnvelopeV1<ConfirmPaymentPayloadV1>;

export interface DurableReceiptBaseV1 {
  readonly contractVersion: "1.0.0-candidate.1";
  readonly receiptId: string;
  readonly eventId: string;
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly occurredAt: string;
}

export interface InvoiceIssuedReceiptV1 extends DurableReceiptBaseV1 {
  readonly kind: "invoice_issued";
  readonly eventType: "INVOICE_CREATED_V1" | "INVOICE_CREATED_V2";
  readonly eventSchemaVersion: 1 | 2;
  readonly invoiceSourceState: "before_goods_out" | "after_goods_out";
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly orderId: string;
  readonly expectedOrderVersion: number;
  readonly aggregateVersion: 1;
  readonly status: "issued";
  readonly net: MoneyV1;
  readonly vatRateBasisPoints: 1900;
  readonly vat: MoneyV1;
  readonly gross: MoneyV1;
  readonly serviceDate: string;
  readonly dueDate: string;
  readonly pdfRef: string;
  readonly pdfSha256: string;
}

/**
 * Read-only compatibility shape for already persisted invoices. It is never a
 * valid result for a new command and never participates in recovery of a new
 * intent.
 */
export type HistoricalInvoiceIssuedReadCompatibilityV1 = Omit<
  InvoiceIssuedReceiptV1,
  "vatRateBasisPoints"
> & {
  readonly vatRateBasisPoints: 700 | 1900;
};

/**
 * Read-only compatibility shape for an already persisted cancellation whose
 * historic reason predates the current command minimum.
 */
export type HistoricalInvoiceCancelledReadCompatibilityV1 = InvoiceCancelledReceiptV1;

export interface InvoiceCancelledReceiptV1 extends DurableReceiptBaseV1 {
  readonly kind: "invoice_cancelled";
  readonly eventType: "INVOICE_CANCELLED_V1";
  readonly eventSchemaVersion: 1;
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly orderId: string;
  readonly expectedAggregateVersion: 1;
  readonly aggregateVersion: 2;
  readonly status: "cancelled";
  readonly reason: string;
  readonly originalPdfSha256: string;
  readonly cancellationPdfRef: string;
  readonly cancellationPdfSha256: string;
}

export interface PaymentConfirmedReceiptV1 extends DurableReceiptBaseV1 {
  readonly kind: "payment_confirmed";
  readonly eventType: "PAYMENT_CONFIRMED_V1";
  readonly eventSchemaVersion: 1;
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly orderId: string;
  readonly expectedPaymentVersion: number;
  readonly paymentVersion: number;
  readonly amount: MoneyV1;
  readonly gross: MoneyV1;
  readonly paid: MoneyV1;
  readonly open: MoneyV1;
  readonly paymentStatus: "partial" | "paid";
  readonly method: PaymentMethodV1;
  readonly source: PaymentSourceV1;
}

export interface InvoiceSummaryV1 {
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly orderId: string;
  readonly status: InvoiceLifecycleStatusV1;
  readonly aggregateVersion: 1 | 2;
  readonly net: MoneyV1;
  readonly vat: MoneyV1;
  readonly gross: MoneyV1;
  readonly serviceDate: string;
  readonly dueDate: string;
  readonly issuedAt: string;
  readonly cancelledAt: string | null;
}

export interface PaymentSummaryV1 {
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly orderId: string;
  readonly total: MoneyV1;
  readonly paid: MoneyV1;
  readonly open: MoneyV1;
  readonly status: PaymentStatusV1;
  readonly paymentVersion: number;
  readonly latestMethod: PaymentMethodV1 | null;
  readonly latestReceiptId: string | null;
  readonly latestEventId: string | null;
  readonly latestCorrelationId: string | null;
  readonly latestPaidAt: string | null;
}

export interface InvoiceCancelStateV1 {
  readonly invoiceId: string;
  readonly tenantId: string;
  readonly lifecycleStatus: InvoiceLifecycleStatusV1;
  readonly aggregateVersion: number;
  readonly paymentContractVersion: 1 | null;
  readonly gross: MoneyV1;
  readonly paid: MoneyV1;
  readonly open: MoneyV1;
  readonly paymentStatus: PaymentStatusV1 | null;
  readonly paymentVersion: number;
  readonly latestPaymentMethod: PaymentMethodV1 | null;
  readonly latestPaymentReceiptId: string | null;
  readonly latestPaymentEventId: string | null;
  readonly latestPaymentCorrelationId: string | null;
  readonly latestPaidAt: string | null;
  readonly paymentEvidenceCount: number;
}

export interface CancelAtomicPreconditionV1 {
  readonly invoiceId: string;
  readonly tenantId: string;
  readonly expectedAggregateVersion: number;
  readonly expectedPaymentContractVersion: 1;
  readonly expectedPaymentVersion: 0;
  readonly expectedPaymentStatus: "open";
  readonly expectedCurrency: "EUR";
  readonly expectedGrossAmountCents: number;
  readonly expectedPaidAmountCents: 0;
  readonly expectedOpenAmountCents: number;
  readonly expectedPaymentMethod: null;
  readonly expectedPaymentReceiptId: null;
  readonly expectedPaymentEventId: null;
  readonly expectedPaymentCorrelationId: null;
  readonly expectedPaidAt: null;
  readonly expectedPaymentEvidenceCount: 0;
  readonly policyVersion: "cancel-safety.v1";
}

export type ValidationResultV1<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ContractErrorV1 };

export type CommandResultV1<TReceipt> =
  | { readonly state: "succeeded"; readonly receipt: TReceipt; readonly replayed: boolean; readonly error: null }
  | { readonly state: "rejected"; readonly receipt: null; readonly replayed: false; readonly error: ContractErrorV1 }
  | {
      readonly state: "unknown";
      readonly receipt: null;
      readonly replayed: false;
      readonly error: ContractErrorV1;
      readonly recovery: RecoveryQueryV1;
    };

export interface RecoveryQueryV1 {
  readonly kind: "invoice_issued" | "invoice_cancelled" | "payment_confirmed";
  readonly tenantId: string;
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly aggregateId: string;
  readonly expectedVersion: number;
  readonly expectedAmount: MoneyV1 | null;
  readonly expectedMethod: PaymentMethodV1 | null;
  readonly expectedReason: string | null;
}

export type ReceiptRecoveryDecisionV1<TReceipt> =
  | { readonly state: "resolved"; readonly receipt: TReceipt }
  | { readonly state: "not_committed"; readonly retry: "same_idempotency_key_only"; readonly query: RecoveryQueryV1 }
  | {
      readonly state: "unknown";
      readonly retry: "forbidden_until_reconciled";
      readonly query: RecoveryQueryV1;
      readonly error: ContractErrorV1;
    }
  | { readonly state: "denied"; readonly error: ContractErrorV1 }
  | { readonly state: "integrity_failure"; readonly error: ContractErrorV1 };

export interface HostRequestV1 {
  readonly requestId: string;
  readonly correlationId: string;
  readonly locale: string;
  readonly timeZone: string;
}

export interface HostActorContextV1 {
  readonly tenantId: string;
  readonly actorId: string;
  readonly capabilities: readonly AccountingCapabilityV1[];
  readonly authenticated: true;
  readonly active: true;
}

export type HostContextResultV1 =
  | { readonly state: "authorized"; readonly context: HostActorContextV1 }
  | { readonly state: "denied" | "unavailable"; readonly error: ContractErrorV1 };

export interface InvoiceReadQueryV1 { readonly limit: number }
export interface PaymentReadQueryV1 { readonly limit: number }
