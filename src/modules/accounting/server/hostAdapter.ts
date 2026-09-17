import "server-only";

import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { resolveAuthorization } from "@/lib/server/authorization";
import {
  cancelInvoice as cancelExistingInvoice,
  createInvoice as createExistingInvoice,
  type CancelInvoiceInput,
  type CancelInvoiceResult,
  type CreateInvoiceInput,
  type CreateInvoiceResult,
  type ImmutableInvoiceCancellationReceipt,
  type ImmutableInvoiceReceipt,
} from "@/lib/server/commands/immutableInvoiceCommand";
import {
  confirmPayment as confirmExistingPayment,
  type ConfirmPaymentInput,
  type ConfirmPaymentResult,
  type ConfirmPaymentReceipt,
} from "@/lib/server/commands/confirmPaymentCommand";
import {
  setPaymentMode as setExistingPaymentMode,
  type SetPaymentModeInput,
  type SetPaymentModeResult,
} from "@/lib/server/commands/setPaymentModeCommand";
import {
  readInvoiceCancellationReceipt,
  readInvoiceCancellationState,
  readInvoiceReceipt,
  readInvoiceSummaries,
  type ReadInvoiceCancellationReceiptInput,
  type ReadInvoiceCancellationReceiptResult,
  type ReadInvoiceReceiptInput,
  type ReadInvoiceReceiptResult,
  type ReadInvoiceSummariesResult,
} from "@/lib/server/invoiceRead";
import {
  readOrderPaymentState,
  readPaymentReceipt,
  readPaymentSummary,
  type OrderPaymentStateReadResult,
  type ReadOrderPaymentStateInput,
  type ReadPaymentReceiptInput,
  type ReadPaymentReceiptResult,
} from "@/lib/server/paymentSummaryRead";
import {
  ACCOUNTING_CAPABILITIES_V1,
  ACCOUNTING_CORE_CONTRACT_VERSION,
  ACCOUNTING_NEW_CANCELLATION_REASON_MIN_LENGTH_V1,
  ACCOUNTING_NEW_INVOICE_VAT_RATE_BASIS_POINTS_V1,
  ACCOUNTING_SOURCE_IDS_V1,
  type AccountingCapabilityV1,
  type AccountingSourceIdV1,
} from "../core/version";
import type {
  CommandResultV1,
  ContractErrorV1,
  HostActorContextV1,
  InvoiceCancelledReceiptV1,
  InvoiceIssuedReceiptV1,
  InvoiceSummaryV1,
  PaymentConfirmedReceiptV1,
  PaymentSummaryV1,
  ReadEnvelopeV1,
  RecoveryQueryV1,
} from "../core/types";
import type { AccountingHostAdapterV1 } from "../core/ports";
import { contractErrorV1 } from "../core/validation";

const INVOICE_READ_ROLES = ["buero", "meister", "admin"] as const;
const INVOICE_ISSUE_ROLES = ["buero", "meister", "admin"] as const;
const INVOICE_CANCEL_ROLES = ["meister", "admin"] as const;
const PAYMENT_ROLES = ["buero", "meister", "admin"] as const;

function roleAllowed(role: AuthorizationSnapshot["role"], roles: readonly string[]): boolean {
  return roles.includes(role);
}

function capabilitiesFor(authorization: AuthorizationSnapshot): AccountingCapabilityV1[] {
  if (!authorization.active) return [];
  const capabilities: AccountingCapabilityV1[] = [];
  if (roleAllowed(authorization.role, INVOICE_READ_ROLES)) capabilities.push(ACCOUNTING_CAPABILITIES_V1.INVOICE_READ);
  if (roleAllowed(authorization.role, INVOICE_ISSUE_ROLES)) capabilities.push(ACCOUNTING_CAPABILITIES_V1.INVOICE_ISSUE);
  if (roleAllowed(authorization.role, INVOICE_CANCEL_ROLES)) capabilities.push(ACCOUNTING_CAPABILITIES_V1.INVOICE_CANCEL);
  if (authorization.permissions.includes("perm_view_leitstand")) capabilities.push(ACCOUNTING_CAPABILITIES_V1.PAYMENT_READ);
  if (roleAllowed(authorization.role, PAYMENT_ROLES)) capabilities.push(ACCOUNTING_CAPABILITIES_V1.PAYMENT_CONFIRM);
  if (roleAllowed(authorization.role, INVOICE_READ_ROLES) || authorization.permissions.includes("perm_view_leitstand")) {
    capabilities.push(ACCOUNTING_CAPABILITIES_V1.RECEIPT_RECOVERY);
  }
  return capabilities;
}

function sourceStamp(sourceId: AccountingSourceIdV1) {
  return { sourceId, sourceVersion: ACCOUNTING_CORE_CONTRACT_VERSION, owner: "ACCOUNTING" as const };
}

function available<T>(sourceId: AccountingSourceIdV1, data: T, asOf: string): ReadEnvelopeV1<T> {
  return {
    contractVersion: ACCOUNTING_CORE_CONTRACT_VERSION,
    source: sourceStamp(sourceId),
    asOf,
    coverage: { state: "complete", reasons: [] },
    stale: false,
    partial: false,
    denied: false,
    redactions: [],
    state: "available",
    data,
    error: null,
  };
}

function empty(sourceId: AccountingSourceIdV1, asOf: string): ReadEnvelopeV1<never> {
  return {
    contractVersion: ACCOUNTING_CORE_CONTRACT_VERSION,
    source: sourceStamp(sourceId),
    asOf,
    coverage: { state: "complete", reasons: [] },
    stale: false,
    partial: false,
    denied: false,
    redactions: [],
    state: "empty",
    data: null,
    error: null,
  };
}

function failed<T>(
  sourceId: AccountingSourceIdV1,
  error: ContractErrorV1,
  denied: boolean,
): ReadEnvelopeV1<T> {
  return denied
    ? {
        contractVersion: ACCOUNTING_CORE_CONTRACT_VERSION,
        source: sourceStamp(sourceId),
        asOf: null,
        coverage: { state: "none", reasons: ["access_denied"] },
        stale: false,
        partial: false,
        denied: true,
        redactions: [],
        state: "denied",
        data: null,
        error,
      }
    : {
        contractVersion: ACCOUNTING_CORE_CONTRACT_VERSION,
        source: sourceStamp(sourceId),
        asOf: null,
        coverage: { state: "none", reasons: ["host_read_failed"] },
        stale: false,
        partial: false,
        denied: false,
        redactions: [],
        state: "unavailable",
        data: null,
        error,
      };
}

function mapReadFailure<T>(sourceId: AccountingSourceIdV1, code: string): ReadEnvelopeV1<T> {
  if (code === "FORBIDDEN") return failed(sourceId, contractErrorV1("FORBIDDEN", "Accounting read is not permitted."), true);
  return failed(sourceId, contractErrorV1("UNAVAILABLE", "Accounting read is unavailable.", "after_reconciliation"), false);
}

function mapInvoiceReceipt(receipt: ImmutableInvoiceReceipt, tenantId: string): InvoiceIssuedReceiptV1 {
  if (
    receipt.netAmountCents <= 0
    || receipt.vatRateBasisPoints !== ACCOUNTING_NEW_INVOICE_VAT_RATE_BASIS_POINTS_V1
  ) throw new Error("ACCOUNTING_NEW_INVOICE_RECEIPT_POLICY_INVALID");
  const eventSchemaVersion = receipt.eventSchemaVersion;
  return {
    contractVersion: ACCOUNTING_CORE_CONTRACT_VERSION,
    receiptId: receipt.eventId,
    eventId: receipt.eventId,
    intentId: receipt.clientEventId,
    idempotencyKey: receipt.clientEventId,
    correlationId: receipt.correlationId,
    tenantId,
    actorId: receipt.issuedBy,
    occurredAt: receipt.issuedAt,
    kind: "invoice_issued",
    eventType: eventSchemaVersion === 2 ? "INVOICE_CREATED_V2" : "INVOICE_CREATED_V1",
    eventSchemaVersion,
    invoiceSourceState: eventSchemaVersion === 2 ? "after_goods_out" : "before_goods_out",
    invoiceId: receipt.invoiceId,
    invoiceNumber: receipt.invoiceNumber,
    orderId: receipt.orderId,
    expectedOrderVersion: receipt.orderVersion,
    aggregateVersion: 1,
    status: "issued",
    net: { amountCents: receipt.netAmountCents, currency: "EUR" },
    vatRateBasisPoints: ACCOUNTING_NEW_INVOICE_VAT_RATE_BASIS_POINTS_V1,
    vat: { amountCents: receipt.vatAmountCents, currency: "EUR" },
    gross: { amountCents: receipt.grossAmountCents, currency: "EUR" },
    serviceDate: receipt.serviceDate,
    dueDate: receipt.dueDate,
    pdfRef: receipt.pdfRef,
    pdfSha256: receipt.pdfSha256,
  };
}

function mapCancellationReceipt(
  receipt: ImmutableInvoiceCancellationReceipt,
  tenantId: string,
): InvoiceCancelledReceiptV1 {
  if (receipt.reason.length < ACCOUNTING_NEW_CANCELLATION_REASON_MIN_LENGTH_V1) {
    throw new Error("ACCOUNTING_NEW_CANCELLATION_RECEIPT_POLICY_INVALID");
  }
  return {
    contractVersion: ACCOUNTING_CORE_CONTRACT_VERSION,
    receiptId: receipt.eventId,
    eventId: receipt.eventId,
    intentId: receipt.clientEventId,
    idempotencyKey: receipt.clientEventId,
    correlationId: receipt.correlationId,
    tenantId,
    actorId: receipt.cancelledBy,
    occurredAt: receipt.cancelledAt,
    kind: "invoice_cancelled",
    eventType: "INVOICE_CANCELLED_V1",
    eventSchemaVersion: 1,
    invoiceId: receipt.invoiceId,
    invoiceNumber: receipt.invoiceNumber,
    orderId: receipt.orderId,
    expectedAggregateVersion: 1,
    aggregateVersion: 2,
    status: "cancelled",
    reason: receipt.reason,
    originalPdfSha256: receipt.originalPdfSha256,
    cancellationPdfRef: receipt.cancellationPdfRef,
    cancellationPdfSha256: receipt.cancellationPdfSha256,
  };
}

function mapPaymentReceipt(receipt: ConfirmPaymentReceipt, tenantId: string): PaymentConfirmedReceiptV1 {
  const method = receipt.method === "bar" ? "cash"
    : receipt.method === "ueberweisung" ? "bank_transfer" : "card";
  return {
    contractVersion: ACCOUNTING_CORE_CONTRACT_VERSION,
    receiptId: receipt.receiptId,
    eventId: receipt.eventId,
    intentId: receipt.clientEventId,
    idempotencyKey: receipt.clientEventId,
    correlationId: receipt.correlationId,
    tenantId,
    actorId: receipt.confirmedBy,
    occurredAt: receipt.confirmedAt,
    kind: "payment_confirmed",
    eventType: "PAYMENT_CONFIRMED_V1",
    eventSchemaVersion: 1,
    invoiceId: receipt.invoiceId,
    invoiceNumber: receipt.invoiceNumber,
    orderId: receipt.orderId,
    expectedPaymentVersion: receipt.expectedVersion,
    paymentVersion: receipt.paymentVersion,
    amount: { amountCents: receipt.amountCents, currency: "EUR" },
    gross: { amountCents: receipt.grossAmountCents, currency: "EUR" },
    paid: { amountCents: receipt.paidAmountCents, currency: "EUR" },
    open: { amountCents: receipt.openAmountCents, currency: "EUR" },
    paymentStatus: receipt.paymentStatus === "teilbezahlt" ? "partial" : "paid",
    method,
    source: "manual",
  };
}

function hostRejected<T>(
  code: string,
  message: string,
  recovery: RecoveryQueryV1,
): CommandResultV1<T> {
  if (code === "UNAVAILABLE") {
    return {
      state: "unknown",
      receipt: null,
      replayed: false,
      error: contractErrorV1("UNKNOWN_OUTCOME", message, "after_readback"),
      recovery,
    };
  }
  const mapped = code === "UNAUTHENTICATED" ? "UNAUTHENTICATED"
    : code === "FORBIDDEN" ? "FORBIDDEN"
      : code === "NOT_FOUND" ? "NOT_FOUND"
        : code === "CONFLICT" ? "CONFLICT"
          : "VALIDATION_ERROR";
  return { state: "rejected", receipt: null, replayed: false, error: contractErrorV1(mapped, message) };
}

export const accountingHostAdapter: AccountingHostAdapterV1 = {
  adapterContractVersion: "host-adapter.accounting.v1",
  async resolveContext(_request, capability) {
    const resolved = await resolveAuthorization().catch(() => null);
    if (!resolved || (!resolved.ok && resolved.reason === "AUTHORIZATION_UNAVAILABLE")) {
      return { state: "unavailable", error: contractErrorV1("UNAVAILABLE", "Authorization is unavailable.") };
    }
    if (!resolved.ok) return { state: "denied", error: contractErrorV1("UNAUTHENTICATED", "Authentication is required.") };
    const capabilities = capabilitiesFor(resolved.data);
    if (!capabilities.includes(capability)) {
      return { state: "denied", error: contractErrorV1("FORBIDDEN", "Accounting capability is not granted.") };
    }
    return {
      state: "authorized",
      context: {
        tenantId: resolved.data.tenantId,
        actorId: resolved.data.userId,
        capabilities,
        authenticated: true,
        active: true,
      },
    };
  },
  reads: {
    async readInvoiceSummaries(context, query) {
      const authorization = await requireMatchingAuthorization(context);
      if (!authorization) return failed(ACCOUNTING_SOURCE_IDS_V1.INVOICE_SUMMARY, contractErrorV1("FORBIDDEN", "Session identity changed."), true);
      const result = await readInvoiceSummaries(authorization);
      if (result.code !== "OK") return mapReadFailure(ACCOUNTING_SOURCE_IDS_V1.INVOICE_SUMMARY, result.code);
      const data: InvoiceSummaryV1[] = result.data.slice(0, query.limit).map((invoice) => ({
        invoiceId: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        orderId: invoice.orderId,
        status: invoice.status,
        aggregateVersion: invoice.aggregateVersion,
        net: { amountCents: invoice.netAmountCents, currency: "EUR" },
        vat: { amountCents: invoice.vatAmountCents, currency: "EUR" },
        gross: { amountCents: invoice.grossAmountCents, currency: "EUR" },
        serviceDate: invoice.serviceDate,
        dueDate: invoice.dueDate,
        issuedAt: invoice.issuedAt,
        cancelledAt: invoice.cancelledAt,
      }));
      return available(ACCOUNTING_SOURCE_IDS_V1.INVOICE_SUMMARY, data, result.asOf);
    },
    async readPaymentSummaries(context, query) {
      const authorization = await requireMatchingAuthorization(context);
      if (!authorization) return failed(ACCOUNTING_SOURCE_IDS_V1.PAYMENT_SUMMARY, contractErrorV1("FORBIDDEN", "Session identity changed."), true);
      const result = await readPaymentSummary(authorization);
      if (result.code !== "OK") return mapReadFailure(ACCOUNTING_SOURCE_IDS_V1.PAYMENT_SUMMARY, result.code);
      const data: PaymentSummaryV1[] = result.data.slice(0, query.limit).map((payment) => ({
        invoiceId: payment.invoiceId,
        invoiceNumber: payment.invoiceNumber,
        orderId: payment.orderId,
        total: { amountCents: payment.totalAmountCents, currency: "EUR" },
        paid: { amountCents: payment.paidAmountCents, currency: "EUR" },
        open: { amountCents: payment.openAmountCents, currency: "EUR" },
        status: payment.status === "offen" ? "open" : payment.status === "teilbezahlt" ? "partial" : "paid",
        paymentVersion: payment.paymentVersion,
        latestMethod: payment.method === null ? null : payment.method === "bar" ? "cash" : payment.method === "ueberweisung" ? "bank_transfer" : "card",
        latestReceiptId: payment.receiptId,
        latestEventId: payment.eventId,
        latestCorrelationId: payment.correlationId,
        latestPaidAt: payment.paidAt,
      }));
      return available(ACCOUNTING_SOURCE_IDS_V1.PAYMENT_SUMMARY, data, result.asOf);
    },
    async readInvoiceCancelState(context, invoiceId) {
      const authorization = await requireMatchingAuthorization(context);
      if (!authorization) return failed(ACCOUNTING_SOURCE_IDS_V1.INVOICE_CANCEL_STATE, contractErrorV1("FORBIDDEN", "Session identity changed."), true);
      const result = await readInvoiceCancellationState(authorization, invoiceId);
      if (result.code !== "OK") return mapReadFailure(ACCOUNTING_SOURCE_IDS_V1.INVOICE_CANCEL_STATE, result.code);
      if (!result.data) return empty(ACCOUNTING_SOURCE_IDS_V1.INVOICE_CANCEL_STATE, result.asOf);
      const state = result.data;
      return available(ACCOUNTING_SOURCE_IDS_V1.INVOICE_CANCEL_STATE, {
        invoiceId: state.invoiceId,
        tenantId: state.tenantId,
        lifecycleStatus: state.lifecycleStatus,
        aggregateVersion: state.aggregateVersion,
        paymentContractVersion: state.paymentContractVersion,
        gross: { amountCents: state.grossAmountCents, currency: "EUR" },
        paid: { amountCents: state.paidAmountCents, currency: "EUR" },
        open: { amountCents: state.openAmountCents, currency: "EUR" },
        paymentStatus: state.paymentStatus === null ? null : state.paymentStatus === "offen" ? "open" : state.paymentStatus === "teilbezahlt" ? "partial" : "paid",
        paymentVersion: state.paymentVersion,
        latestPaymentMethod: state.paymentMethod === null ? null : state.paymentMethod === "bar" ? "cash" : state.paymentMethod === "ueberweisung" ? "bank_transfer" : "card",
        latestPaymentReceiptId: state.paymentReceiptId,
        latestPaymentEventId: state.paymentEventId,
        latestPaymentCorrelationId: state.paymentCorrelationId,
        latestPaidAt: state.paymentPaidAt,
        paymentEvidenceCount: state.paymentEvidenceCount,
      }, result.asOf);
    },
    async readInvoiceIssuedReceipt(context, query) {
      const authorization = await requireMatchingAuthorization(context);
      if (!authorization) return failed(ACCOUNTING_SOURCE_IDS_V1.INVOICE_RECEIPT, contractErrorV1("FORBIDDEN", "Session identity changed."), true);
      const result = await readInvoiceReceipt(authorization, { orderId: query.aggregateId, clientEventId: query.idempotencyKey });
      if (result.code !== "OK") return mapReadFailure(ACCOUNTING_SOURCE_IDS_V1.INVOICE_RECEIPT, result.code);
      return result.data
        ? available(ACCOUNTING_SOURCE_IDS_V1.INVOICE_RECEIPT, mapInvoiceReceipt(result.data, context.tenantId), result.asOf)
        : empty(ACCOUNTING_SOURCE_IDS_V1.INVOICE_RECEIPT, result.asOf);
    },
    async readInvoiceCancelledReceipt(context, query) {
      const authorization = await requireMatchingAuthorization(context);
      if (!authorization) return failed(ACCOUNTING_SOURCE_IDS_V1.INVOICE_CANCELLED_RECEIPT, contractErrorV1("FORBIDDEN", "Session identity changed."), true);
      const result = await readInvoiceCancellationReceipt(authorization, { invoiceId: query.aggregateId, clientEventId: query.idempotencyKey });
      if (result.code !== "OK") return mapReadFailure(ACCOUNTING_SOURCE_IDS_V1.INVOICE_CANCELLED_RECEIPT, result.code);
      return result.data
        ? available(ACCOUNTING_SOURCE_IDS_V1.INVOICE_CANCELLED_RECEIPT, mapCancellationReceipt(result.data, context.tenantId), result.asOf)
        : empty(ACCOUNTING_SOURCE_IDS_V1.INVOICE_CANCELLED_RECEIPT, result.asOf);
    },
    async readPaymentConfirmedReceipt(context, query) {
      const authorization = await requireMatchingAuthorization(context);
      if (!authorization) return failed(ACCOUNTING_SOURCE_IDS_V1.PAYMENT_CONFIRMED_RECEIPT, contractErrorV1("FORBIDDEN", "Session identity changed."), true);
      const result = await readPaymentReceipt(authorization, { invoiceId: query.aggregateId, clientEventId: query.idempotencyKey });
      if (result.code !== "OK") return mapReadFailure(ACCOUNTING_SOURCE_IDS_V1.PAYMENT_CONFIRMED_RECEIPT, result.code);
      return result.data
        ? available(ACCOUNTING_SOURCE_IDS_V1.PAYMENT_CONFIRMED_RECEIPT, mapPaymentReceipt(result.data, context.tenantId), result.asOf)
        : empty(ACCOUNTING_SOURCE_IDS_V1.PAYMENT_CONFIRMED_RECEIPT, result.asOf);
    },
  },
  commands: {
    async issueInvoice(context, command) {
      const authorization = await requireMatchingAuthorization(context);
      const recovery: RecoveryQueryV1 = {
        kind: "invoice_issued",
        tenantId: context.tenantId,
        intentId: command.intentId,
        idempotencyKey: command.idempotencyKey,
        aggregateId: command.payload.orderId,
        expectedVersion: command.expectedVersion,
        expectedAmount: null,
        expectedMethod: null,
        expectedReason: null,
      };
      if (!authorization) return hostRejected("FORBIDDEN", "Session identity changed.", recovery);
      const result = await createExistingInvoice({ orderId: command.payload.orderId, expectedVersion: command.expectedVersion, clientEventId: command.idempotencyKey });
      return result.code === "OK"
        ? { state: "succeeded", receipt: mapInvoiceReceipt(result.receipt, context.tenantId), replayed: result.replayed, error: null }
        : hostRejected(result.code, result.message, recovery);
    },
    async cancelInvoiceAtomic(context, command, precondition) {
      const authorization = await requireMatchingAuthorization(context);
      const recovery: RecoveryQueryV1 = {
        kind: "invoice_cancelled",
        tenantId: context.tenantId,
        intentId: command.intentId,
        idempotencyKey: command.idempotencyKey,
        aggregateId: command.payload.invoiceId,
        expectedVersion: command.expectedVersion,
        expectedAmount: null,
        expectedMethod: null,
        expectedReason: command.payload.reason,
      };
      if (!authorization) return hostRejected("FORBIDDEN", "Session identity changed.", recovery);
      if (
        precondition.invoiceId !== command.payload.invoiceId
        || precondition.tenantId !== context.tenantId
        || precondition.expectedAggregateVersion !== command.expectedVersion
        || precondition.expectedPaymentEvidenceCount !== 0
        || precondition.policyVersion !== "cancel-safety.v1"
      ) return hostRejected("CONFLICT", "Atomic cancellation precondition is invalid.", recovery);
      const result = await cancelExistingInvoice({ invoiceId: command.payload.invoiceId, expectedVersion: command.expectedVersion, reason: command.payload.reason, clientEventId: command.idempotencyKey });
      return result.code === "OK"
        ? { state: "succeeded", receipt: mapCancellationReceipt(result.receipt, context.tenantId), replayed: result.replayed, error: null }
        : hostRejected(result.code, result.message, recovery);
    },
    async confirmPayment(context, command) {
      const authorization = await requireMatchingAuthorization(context);
      const recovery: RecoveryQueryV1 = {
        kind: "payment_confirmed",
        tenantId: context.tenantId,
        intentId: command.intentId,
        idempotencyKey: command.idempotencyKey,
        aggregateId: command.payload.invoiceId,
        expectedVersion: command.expectedVersion,
        expectedAmount: command.payload.amount,
        expectedMethod: command.payload.method,
        expectedReason: null,
      };
      if (!authorization) return hostRejected("FORBIDDEN", "Session identity changed.", recovery);
      const method = command.payload.method === "cash" ? "bar" : command.payload.method === "bank_transfer" ? "ueberweisung" : "karte";
      const result = await confirmExistingPayment({ invoiceId: command.payload.invoiceId, amount: command.payload.amount.amountCents, method, expectedVersion: command.expectedVersion, clientEventId: command.idempotencyKey });
      return result.code === "OK"
        ? { state: "succeeded", receipt: mapPaymentReceipt(result.receipt, context.tenantId), replayed: result.replayed, error: null }
        : hostRejected(result.code, result.message, recovery);
    },
  },
};

async function requireMatchingAuthorization(context: HostActorContextV1): Promise<AuthorizationSnapshot | null> {
  const resolved = await resolveAuthorization().catch(() => null);
  return resolved?.ok && resolved.data.active
    && resolved.data.tenantId === context.tenantId
    && resolved.data.userId === context.actorId
    ? resolved.data
    : null;
}

export type {
  AuthorizationSnapshot,
  CancelInvoiceInput,
  CancelInvoiceResult,
  ConfirmPaymentInput,
  ConfirmPaymentResult,
  CreateInvoiceInput,
  CreateInvoiceResult,
  OrderPaymentStateReadResult,
  ReadInvoiceCancellationReceiptInput,
  ReadInvoiceCancellationReceiptResult,
  ReadInvoiceReceiptInput,
  ReadInvoiceReceiptResult,
  ReadInvoiceSummariesResult,
  ReadOrderPaymentStateInput,
  ReadPaymentReceiptInput,
  ReadPaymentReceiptResult,
  SetPaymentModeInput,
  SetPaymentModeResult,
};

/**
 * The only Kreile-specific infrastructure seam used by the server facade.
 * It deliberately exposes existing commands and reads without creating a
 * second accounting writer or persistence contract.
 */
export const accountingExistingHostBridge = {
  resolveAuthorization,
  issueInvoice: createExistingInvoice,
  cancelInvoice: cancelExistingInvoice,
  confirmPayment: confirmExistingPayment,
  setPaymentMode: setExistingPaymentMode,
  readInvoiceReceipt,
  readInvoiceCancellationReceipt,
  readInvoiceSummaries,
  readOrderPaymentState,
  readPaymentReceipt,
} as const;
