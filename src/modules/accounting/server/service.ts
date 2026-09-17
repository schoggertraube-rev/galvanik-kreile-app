import "server-only";

import { randomUUID } from "node:crypto";
import {
  accountingExistingHostBridge,
  accountingHostAdapter,
  type AuthorizationSnapshot,
  type CancelInvoiceInput,
  type CancelInvoiceResult,
  type ConfirmPaymentInput,
  type ConfirmPaymentResult,
  type CreateInvoiceInput,
  type CreateInvoiceResult,
  type OrderPaymentStateReadResult,
  type ReadInvoiceCancellationReceiptInput,
  type ReadInvoiceCancellationReceiptResult,
  type ReadInvoiceReceiptInput,
  type ReadInvoiceReceiptResult,
  type ReadInvoiceSummariesResult,
  type ReadOrderPaymentStateInput,
  type ReadPaymentReceiptInput,
  type ReadPaymentReceiptResult,
  type SetPaymentModeInput,
  type SetPaymentModeResult,
} from "./hostAdapter";
import { createAccountingCoreServerV1 } from "../core/server";
import { contractErrorV1 } from "../core/validation";
import type {
  CancelInvoiceCommandV1,
  ConfirmPaymentCommandV1,
  HostRequestV1,
  IssueInvoiceCommandV1,
  ReceiptRecoveryDecisionV1,
  RecoveryQueryV1,
  InvoiceCancelledReceiptV1,
  InvoiceIssuedReceiptV1,
  PaymentConfirmedReceiptV1,
} from "../core/types";
import { ACCOUNTING_CORE_CONTRACT_VERSION } from "../core/version";

export type {
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

export type RecoveryCommandInput = Omit<RecoveryQueryV1, "tenantId">;
export type RecoveryCommandDecision<TReceipt> =
  | Extract<ReceiptRecoveryDecisionV1<TReceipt>, { readonly state: "resolved" | "denied" | "integrity_failure" }>
  | { readonly state: "not_committed"; readonly retry: "same_idempotency_key_only" }
  | {
      readonly state: "unknown";
      readonly retry: "forbidden_until_reconciled";
      readonly error: Extract<ReceiptRecoveryDecisionV1<TReceipt>, { readonly state: "unknown" }>["error"];
    };

type AuthorizationResult =
  | { readonly ok: true; readonly data: AuthorizationSnapshot }
  | { readonly ok: false; readonly code: "UNAUTHENTICATED" | "UNAVAILABLE"; readonly message: string };

const core = createAccountingCoreServerV1(accountingHostAdapter);

function requestEnvelope(): HostRequestV1 {
  return {
    requestId: randomUUID(),
    correlationId: randomUUID(),
    locale: "de-DE",
    timeZone: "Europe/Berlin",
  };
}

async function authorization(): Promise<AuthorizationResult> {
  const resolved = await accountingExistingHostBridge.resolveAuthorization().catch(() => null);
  if (!resolved || (!resolved.ok && resolved.reason === "AUTHORIZATION_UNAVAILABLE")) {
    return { ok: false, code: "UNAVAILABLE", message: "Berechtigung konnte nicht sicher geprüft werden." };
  }
  if (!resolved.ok) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Bitte erneut anmelden." };
  }
  return { ok: true, data: resolved.data };
}

function mapCoreFailure(
  result: { readonly state: "rejected" | "unknown"; readonly error: { readonly code: string; readonly message: string } },
): Exclude<CreateInvoiceResult, { code: "OK" }> {
  if (result.state === "unknown") {
    return { code: "UNAVAILABLE", message: "Der Ausgang ist noch unklar. Bitte zuerst den gespeicherten Stand prüfen." };
  }
  const code = result.error.code === "UNAUTHENTICATED" ? "UNAUTHENTICATED"
    : result.error.code === "FORBIDDEN" ? "FORBIDDEN"
      : result.error.code === "NOT_FOUND" ? "NOT_FOUND"
        : result.error.code === "CONFLICT" || result.error.code.startsWith("CANCEL_BLOCKED_") ? "CONFLICT"
          : result.error.code === "UNAVAILABLE" || result.error.code === "STALE_READ"
            || result.error.code === "PARTIAL_READ" || result.error.code === "INTEGRITY_ERROR"
            || result.error.code === "LEGACY_SOURCE_FORBIDDEN" ? "UNAVAILABLE"
            : "VALIDATION_ERROR";
  const message = result.error.code === "CANCEL_BLOCKED_PAYMENT_PRESENT"
    ? "Eine Rechnung mit bestätigter Zahlung kann nicht storniert werden."
    : result.error.code === "CANCEL_BLOCKED_INCONSISTENT_STATE"
      ? "Der Zahlungsstand ist nicht eindeutig. Die Rechnung wurde nicht storniert; bitte zuerst den Zahlungsstand klären."
      : result.error.code === "CONFLICT"
        ? "Der gespeicherte Stand hat sich geändert. Bitte neu laden und erneut prüfen."
        : result.error.message;
  return { code, message };
}

function issueCommand(input: CreateInvoiceInput, actorId: string): IssueInvoiceCommandV1 {
  return {
    contractVersion: ACCOUNTING_CORE_CONTRACT_VERSION,
    intentId: input.clientEventId,
    idempotencyKey: input.clientEventId,
    expectedVersion: input.expectedVersion,
    confirmation: { kind: "explicit", scope: "issue_invoice", confirmedBy: actorId },
    payload: { orderId: input.orderId },
  };
}

function cancelCommand(input: CancelInvoiceInput, actorId: string): CancelInvoiceCommandV1 {
  return {
    contractVersion: ACCOUNTING_CORE_CONTRACT_VERSION,
    intentId: input.clientEventId,
    idempotencyKey: input.clientEventId,
    expectedVersion: input.expectedVersion,
    confirmation: { kind: "explicit", scope: "cancel_invoice", confirmedBy: actorId },
    payload: { invoiceId: input.invoiceId, reason: input.reason },
  };
}

function paymentCommand(input: ConfirmPaymentInput, actorId: string): ConfirmPaymentCommandV1 {
  return {
    contractVersion: ACCOUNTING_CORE_CONTRACT_VERSION,
    intentId: input.clientEventId,
    idempotencyKey: input.clientEventId,
    expectedVersion: input.expectedVersion,
    confirmation: { kind: "explicit", scope: "confirm_payment", confirmedBy: actorId },
    payload: {
      invoiceId: input.invoiceId,
      amount: { amountCents: input.amount, currency: "EUR" },
      method: input.method === "bar" ? "cash" : input.method === "ueberweisung" ? "bank_transfer" : "card",
    },
  };
}

export async function issueInvoiceCommand(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  const access = await authorization();
  if (!access.ok) return { code: access.code, message: access.message };
  const result = await core.issueInvoice(requestEnvelope(), issueCommand(input, access.data.userId));
  if (result.state !== "succeeded") return mapCoreFailure(result);
  const readback = await accountingExistingHostBridge.readInvoiceReceipt(
    access.data,
    { orderId: input.orderId, clientEventId: input.clientEventId },
  );
  return readback.code === "OK" && readback.data
    ? { code: "OK", receipt: readback.data, replayed: result.replayed }
    : { code: "UNAVAILABLE", message: "Die Rechnung wurde verarbeitet; der technische Ausführungsnachweis muss vor einem erneuten Versuch geprüft werden." };
}

export async function cancelInvoiceCommand(input: CancelInvoiceInput): Promise<CancelInvoiceResult> {
  const access = await authorization();
  if (!access.ok) return { code: access.code, message: access.message };
  const result = await core.cancelInvoice(requestEnvelope(), cancelCommand(input, access.data.userId));
  if (result.state !== "succeeded") return mapCoreFailure(result);
  const readback = await accountingExistingHostBridge.readInvoiceCancellationReceipt(access.data, {
    invoiceId: input.invoiceId,
    clientEventId: input.clientEventId,
  });
  return readback.code === "OK" && readback.data
    ? { code: "OK", receipt: readback.data, replayed: result.replayed }
    : { code: "UNAVAILABLE", message: "Die Stornierung wurde verarbeitet; der technische Ausführungsnachweis muss vor einem erneuten Versuch geprüft werden." };
}

export async function confirmPaymentCommand(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult> {
  const access = await authorization();
  if (!access.ok) return { code: access.code, message: access.message };
  const result = await core.confirmPayment(requestEnvelope(), paymentCommand(input, access.data.userId));
  if (result.state !== "succeeded") return mapCoreFailure(result);
  const readback = await accountingExistingHostBridge.readPaymentReceipt(access.data, {
    invoiceId: input.invoiceId,
    clientEventId: input.clientEventId,
  });
  return readback.code === "OK" && readback.data
    ? { code: "OK", receipt: readback.data, replayed: result.replayed }
    : { code: "UNAVAILABLE", message: "Die Zahlung wurde verarbeitet; der technische Ausführungsnachweis muss vor einem erneuten Versuch geprüft werden." };
}

export async function setPaymentModeCommand(input: SetPaymentModeInput): Promise<SetPaymentModeResult> {
  return accountingExistingHostBridge.setPaymentMode(input);
}

export async function readInvoiceReceiptCommand(
  input: ReadInvoiceReceiptInput,
): Promise<ReadInvoiceReceiptResult | { code: "UNAUTHENTICATED" | "UNAVAILABLE"; message: string }> {
  const access = await authorization();
  return access.ok
    ? accountingExistingHostBridge.readInvoiceReceipt(access.data, input)
    : { code: access.code, message: access.message };
}

export async function readInvoiceCancellationReceiptCommand(
  input: ReadInvoiceCancellationReceiptInput,
): Promise<ReadInvoiceCancellationReceiptResult | { code: "UNAUTHENTICATED" | "UNAVAILABLE"; message: string }> {
  const access = await authorization();
  return access.ok
    ? accountingExistingHostBridge.readInvoiceCancellationReceipt(access.data, input)
    : { code: access.code, message: access.message };
}

export async function readPaymentReceiptCommand(
  input: ReadPaymentReceiptInput,
): Promise<ReadPaymentReceiptResult | { code: "UNAUTHENTICATED" | "UNAVAILABLE"; message: string }> {
  const access = await authorization();
  return access.ok
    ? accountingExistingHostBridge.readPaymentReceipt(access.data, input)
    : { code: access.code, message: access.message };
}

export async function readInvoiceSummariesCommand(): Promise<ReadInvoiceSummariesResult | { code: "UNAUTHENTICATED" | "UNAVAILABLE"; message: string }> {
  const access = await authorization();
  return access.ok
    ? accountingExistingHostBridge.readInvoiceSummaries(access.data)
    : { code: access.code, message: access.message };
}

export async function readOrderPaymentStateCommand(
  input: ReadOrderPaymentStateInput,
): Promise<OrderPaymentStateReadResult | { code: "UNAUTHENTICATED" | "UNAVAILABLE"; message: string }> {
  const access = await authorization();
  return access.ok
    ? accountingExistingHostBridge.readOrderPaymentState(access.data, input)
    : { code: access.code, message: access.message };
}

async function recoverWithServerTenant<TReceipt>(
  query: RecoveryCommandInput,
  recover: (bound: RecoveryQueryV1) => Promise<ReceiptRecoveryDecisionV1<TReceipt>>,
): Promise<RecoveryCommandDecision<TReceipt>> {
  const access = await authorization();
  if (!access.ok) {
    return {
      state: "denied",
      error: contractErrorV1(
        access.code,
        access.message,
        access.code === "UNAVAILABLE" ? "after_reconciliation" : "never",
      ),
    };
  }
  const decision = await recover({ ...query, tenantId: access.data.tenantId });
  if (decision.state === "not_committed") {
    return { state: decision.state, retry: decision.retry };
  }
  if (decision.state === "unknown") {
    return { state: decision.state, retry: decision.retry, error: decision.error };
  }
  return decision;
}

export async function recoverInvoiceIssueCommand(
  query: RecoveryCommandInput,
): Promise<RecoveryCommandDecision<InvoiceIssuedReceiptV1>> {
  return recoverWithServerTenant(query, (bound) => core.recoverInvoiceIssued(requestEnvelope(), bound));
}

export async function recoverInvoiceCancellationCommand(
  query: RecoveryCommandInput,
): Promise<RecoveryCommandDecision<InvoiceCancelledReceiptV1>> {
  return recoverWithServerTenant(query, (bound) => core.recoverInvoiceCancelled(requestEnvelope(), bound));
}

export async function recoverPaymentConfirmationCommand(
  query: RecoveryCommandInput,
): Promise<RecoveryCommandDecision<PaymentConfirmedReceiptV1>> {
  return recoverWithServerTenant(query, (bound) => core.recoverPaymentConfirmed(requestEnvelope(), bound));
}
