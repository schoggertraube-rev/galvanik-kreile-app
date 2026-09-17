import {
  ACCOUNTING_CAPABILITIES_V1,
  ACCOUNTING_CORE_CONTRACT_VERSION,
  ACCOUNTING_SOURCE_IDS_V1,
  type AccountingCapabilityV1,
  type AccountingSourceIdV1,
} from "./version";
import type {
  CancelInvoiceCommandV1,
  CommandResultV1,
  ContractErrorV1,
  HostActorContextV1,
  HostRequestV1,
  InvoiceCancelledReceiptV1,
  InvoiceIssuedReceiptV1,
  InvoiceReadQueryV1,
  InvoiceSummaryV1,
  IssueInvoiceCommandV1,
  PaymentConfirmedReceiptV1,
  PaymentReadQueryV1,
  PaymentSummaryV1,
  ConfirmPaymentCommandV1,
  ReadEnvelopeV1,
  ReceiptRecoveryDecisionV1,
  RecoveryQueryV1,
  ValidationResultV1,
} from "./types";
import type { AccountingHostAdapterV1 } from "./ports";
import { evaluateCancelSafetyV1, validateCancelStateV1 } from "./cancelSafety";
import { validateInvoiceSummaryV1, validatePaymentSummaryV1 } from "./facts";
import {
  cancellationReceiptMatchesIntentV1,
  invoiceReceiptMatchesIntentV1,
  paymentReceiptMatchesIntentV1,
  validateInvoiceCancelledReceiptV1,
  validateInvoiceIssuedReceiptV1,
  validatePaymentConfirmedReceiptV1,
} from "./receipts";
import { decideReceiptRecoveryV1 } from "./recovery";
import {
  canonicalSourceBoundaryError,
  contractErrorV1,
  hasExactKeys,
  isCanonicalId,
  isContractErrorV1,
  isReadEnvelopeV1,
  isRecord,
  isSafeNonNegativeInteger,
  isUuid,
  validateCancelInvoiceCommandV1,
  validateConfirmPaymentCommandV1,
  validateHostRequestV1,
  validateIssueInvoiceCommandV1,
} from "./validation";

type GateResultV1 =
  | { readonly ok: true; readonly context: HostActorContextV1 }
  | { readonly ok: false; readonly error: ContractErrorV1; readonly denied: boolean };

export interface AccountingCoreServerV1 {
  readInvoiceSummaries(request: HostRequestV1, query: InvoiceReadQueryV1): Promise<ReadEnvelopeV1<readonly InvoiceSummaryV1[]>>;
  readPaymentSummaries(request: HostRequestV1, query: PaymentReadQueryV1): Promise<ReadEnvelopeV1<readonly PaymentSummaryV1[]>>;
  issueInvoice(request: HostRequestV1, command: unknown): Promise<CommandResultV1<InvoiceIssuedReceiptV1>>;
  cancelInvoice(request: HostRequestV1, command: unknown): Promise<CommandResultV1<InvoiceCancelledReceiptV1>>;
  confirmPayment(request: HostRequestV1, command: unknown): Promise<CommandResultV1<PaymentConfirmedReceiptV1>>;
  recoverInvoiceIssued(request: HostRequestV1, query: RecoveryQueryV1): Promise<ReceiptRecoveryDecisionV1<InvoiceIssuedReceiptV1>>;
  recoverInvoiceCancelled(request: HostRequestV1, query: RecoveryQueryV1): Promise<ReceiptRecoveryDecisionV1<InvoiceCancelledReceiptV1>>;
  recoverPaymentConfirmed(request: HostRequestV1, query: RecoveryQueryV1): Promise<ReceiptRecoveryDecisionV1<PaymentConfirmedReceiptV1>>;
}

function sourceStamp(sourceId: AccountingSourceIdV1) {
  return { sourceId, sourceVersion: ACCOUNTING_CORE_CONTRACT_VERSION, owner: "ACCOUNTING" as const };
}

function failedRead<T>(
  adapter: AccountingHostAdapterV1,
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
        coverage: { state: "none", reasons: ["read_unavailable"] },
        stale: false,
        partial: false,
        denied: false,
        redactions: [],
        state: "unavailable",
        data: null,
        error,
      };
}

function rejected<T>(error: ContractErrorV1): CommandResultV1<T> {
  return { state: "rejected", receipt: null, replayed: false, error };
}

function unknown<T>(query: RecoveryQueryV1, message: string): CommandResultV1<T> {
  return {
    state: "unknown",
    receipt: null,
    replayed: false,
    error: contractErrorV1("UNKNOWN_OUTCOME", message, "after_readback"),
    recovery: query,
  };
}

function authorizedContext(value: unknown, capability: AccountingCapabilityV1): value is HostActorContextV1 {
  const knownCapabilities = Object.values(ACCOUNTING_CAPABILITIES_V1) as readonly string[];
  return isRecord(value)
    && hasExactKeys(value, ["active", "actorId", "authenticated", "capabilities", "tenantId"])
    && value.authenticated === true
    && value.active === true
    && isCanonicalId(value.tenantId, 128)
    && isCanonicalId(value.actorId, 128)
    && Array.isArray(value.capabilities)
    && value.capabilities.every((entry) => typeof entry === "string" && knownCapabilities.includes(entry))
    && new Set(value.capabilities).size === value.capabilities.length
    && value.capabilities.includes(capability);
}

async function gate(
  adapter: AccountingHostAdapterV1,
  request: HostRequestV1,
  capability: AccountingCapabilityV1,
): Promise<GateResultV1> {
  const validRequest = validateHostRequestV1(request);
  if (!validRequest.ok) return { ok: false, denied: true, error: validRequest.error };
  if (adapter.adapterContractVersion !== "host-adapter.accounting.v1") {
    return { ok: false, denied: false, error: contractErrorV1("UNAVAILABLE", "Host adapter contract version is unavailable.") };
  }
  let resolution: unknown;
  try {
    resolution = await adapter.resolveContext(validRequest.value, capability);
  } catch {
    return { ok: false, denied: false, error: contractErrorV1("UNAVAILABLE", "Authorization context is unavailable.") };
  }
  if (!isRecord(resolution) || typeof resolution.state !== "string") {
    return { ok: false, denied: false, error: contractErrorV1("UNAVAILABLE", "Authorization context returned an invalid contract.") };
  }
  if (resolution.state !== "authorized") {
    if (
      (resolution.state !== "denied" && resolution.state !== "unavailable")
      || !hasExactKeys(resolution, ["error", "state"])
      || !isContractErrorV1(resolution.error)
    ) return { ok: false, denied: false, error: contractErrorV1("UNAVAILABLE", "Authorization context returned an invalid outcome.") };
    return { ok: false, denied: resolution.state === "denied", error: resolution.error };
  }
  if (!hasExactKeys(resolution, ["context", "state"]) || !authorizedContext(resolution.context, capability)) {
    return { ok: false, denied: true, error: contractErrorV1("FORBIDDEN", "Required accounting capability is not granted.") };
  }
  return { ok: true, context: resolution.context };
}

function validListQuery(value: unknown): value is InvoiceReadQueryV1 | PaymentReadQueryV1 {
  return isRecord(value) && hasExactKeys(value, ["limit"])
    && isSafeNonNegativeInteger(value.limit, 250) && value.limit >= 1;
}

function validateRecoveryQuery(value: unknown, expectedKind: RecoveryQueryV1["kind"]): ValidationResultV1<RecoveryQueryV1> {
  if (!isRecord(value) || !hasExactKeys(value, [
    "aggregateId", "expectedAmount", "expectedMethod", "expectedReason", "expectedVersion",
    "idempotencyKey", "intentId", "kind", "tenantId",
  ])) return { ok: false, error: contractErrorV1("VALIDATION_ERROR", "Recovery query shape is invalid.") };
  if (
    value.kind !== expectedKind
    || !isCanonicalId(value.tenantId, 128)
    || !isUuid(value.intentId)
    || !isUuid(value.idempotencyKey)
    || !isCanonicalId(value.aggregateId, 128)
    || !isSafeNonNegativeInteger(value.expectedVersion, 2_147_483_646)
  ) return { ok: false, error: contractErrorV1("VALIDATION_ERROR", "Recovery query values are invalid.") };
  const payment = expectedKind === "payment_confirmed"
    && isRecord(value.expectedAmount)
    && hasExactKeys(value.expectedAmount, ["amountCents", "currency"])
    && isSafeNonNegativeInteger(value.expectedAmount.amountCents, 2_147_483_647)
    && value.expectedAmount.amountCents > 0
    && value.expectedAmount.currency === "EUR"
    && ["cash", "bank_transfer", "card"].includes(value.expectedMethod as string)
    && value.expectedReason === null;
  const cancellation = expectedKind === "invoice_cancelled"
    && value.expectedAmount === null
    && value.expectedMethod === null
    && isCanonicalId(value.expectedReason, 500)
    && value.expectedReason.length >= 5;
  const invoice = expectedKind === "invoice_issued"
    && value.expectedAmount === null && value.expectedMethod === null && value.expectedReason === null;
  return payment || cancellation || invoice
    ? { ok: true, value: value as unknown as RecoveryQueryV1 }
    : { ok: false, error: contractErrorV1("VALIDATION_ERROR", "Recovery query intent values are invalid.") };
}

function verifyHostList<T>(
  adapter: AccountingHostAdapterV1,
  envelopeInput: unknown,
  expectedSource: AccountingSourceIdV1,
  itemValidator: (value: unknown) => ValidationResultV1<T>,
): ReadEnvelopeV1<readonly T[]> {
  const sourceError = canonicalSourceBoundaryError(envelopeInput, expectedSource);
  if (sourceError) return failedRead(adapter, expectedSource, sourceError, false);
  if (!isReadEnvelopeV1(envelopeInput)) {
    return failedRead(adapter, expectedSource, contractErrorV1("INTEGRITY_ERROR", "Host read envelope is invalid.", "after_reconciliation"), false);
  }
  const envelope = envelopeInput as ReadEnvelopeV1<unknown>;
  if (envelope.state !== "available") return envelope as ReadEnvelopeV1<readonly T[]>;
  if (!Array.isArray(envelope.data)) {
    return failedRead(adapter, expectedSource, contractErrorV1("INTEGRITY_ERROR", "Host read data is not a list.", "after_reconciliation"), false);
  }
  const mapped: T[] = [];
  for (const item of envelope.data) {
    const parsed = itemValidator(item);
    if (!parsed.ok) return failedRead(adapter, expectedSource, parsed.error, false);
    mapped.push(parsed.value);
  }
  return { ...envelope, data: mapped } as ReadEnvelopeV1<readonly T[]>;
}

function recoveryQuery(
  kind: RecoveryQueryV1["kind"],
  context: HostActorContextV1,
  command: IssueInvoiceCommandV1 | CancelInvoiceCommandV1 | ConfirmPaymentCommandV1,
  aggregateId: string,
): RecoveryQueryV1 {
  return {
    kind,
    tenantId: context.tenantId,
    intentId: command.intentId,
    idempotencyKey: command.idempotencyKey,
    aggregateId,
    expectedVersion: command.expectedVersion,
    expectedAmount: "amount" in command.payload ? command.payload.amount : null,
    expectedMethod: "method" in command.payload ? command.payload.method : null,
    expectedReason: "reason" in command.payload ? command.payload.reason : null,
  };
}

function normalizeCommandResult<TReceipt>(
  input: unknown,
  query: RecoveryQueryV1,
  validateReceipt: (value: unknown) => ValidationResultV1<TReceipt>,
  matchesIntent: (receipt: TReceipt) => boolean,
  context: HostActorContextV1,
): CommandResultV1<TReceipt> {
  if (!isRecord(input) || typeof input.state !== "string") return unknown(query, "Host command returned an invalid outcome; independent readback is required.");
  if (input.state === "rejected") {
    return hasExactKeys(input, ["error", "receipt", "replayed", "state"])
      && input.receipt === null && input.replayed === false && isContractErrorV1(input.error)
      && input.error.code !== "UNKNOWN_OUTCOME"
      ? rejected(input.error)
      : unknown(query, "Host rejection contract is invalid; independent readback is required.");
  }
  if (input.state === "unknown") return unknown(query, "Host command outcome is unknown; independent readback is required.");
  if (
    input.state !== "succeeded"
    || !hasExactKeys(input, ["error", "receipt", "replayed", "state"])
    || input.error !== null
    || typeof input.replayed !== "boolean"
  ) return unknown(query, "Host command outcome is invalid; independent readback is required.");
  let parsed: ValidationResultV1<TReceipt>;
  try { parsed = validateReceipt(input.receipt); } catch { return unknown(query, "Host success receipt failed validation; reconciliation is required."); }
  if (!parsed.ok || !matchesIntent(parsed.value) || !isRecord(parsed.value)
    || parsed.value.tenantId !== context.tenantId || parsed.value.actorId !== context.actorId) {
    return unknown(query, "Host success receipt failed validation; reconciliation is required.");
  }
  return { state: "succeeded", receipt: parsed.value, replayed: input.replayed, error: null };
}

export function createAccountingCoreServerV1(adapter: AccountingHostAdapterV1): AccountingCoreServerV1 {
  return {
    async readInvoiceSummaries(request, query) {
      if (!validListQuery(query)) return failedRead(adapter, ACCOUNTING_SOURCE_IDS_V1.INVOICE_SUMMARY, contractErrorV1("VALIDATION_ERROR", "Invoice read query is invalid."), false);
      const access = await gate(adapter, request, ACCOUNTING_CAPABILITIES_V1.INVOICE_READ);
      if (!access.ok) return failedRead(adapter, ACCOUNTING_SOURCE_IDS_V1.INVOICE_SUMMARY, access.error, access.denied);
      try {
        return verifyHostList(adapter, await adapter.reads.readInvoiceSummaries(access.context, query), ACCOUNTING_SOURCE_IDS_V1.INVOICE_SUMMARY, validateInvoiceSummaryV1);
      } catch {
        return failedRead(adapter, ACCOUNTING_SOURCE_IDS_V1.INVOICE_SUMMARY, contractErrorV1("UNAVAILABLE", "Invoice read is unavailable."), false);
      }
    },
    async readPaymentSummaries(request, query) {
      if (!validListQuery(query)) return failedRead(adapter, ACCOUNTING_SOURCE_IDS_V1.PAYMENT_SUMMARY, contractErrorV1("VALIDATION_ERROR", "Payment read query is invalid."), false);
      const access = await gate(adapter, request, ACCOUNTING_CAPABILITIES_V1.PAYMENT_READ);
      if (!access.ok) return failedRead(adapter, ACCOUNTING_SOURCE_IDS_V1.PAYMENT_SUMMARY, access.error, access.denied);
      try {
        return verifyHostList(adapter, await adapter.reads.readPaymentSummaries(access.context, query), ACCOUNTING_SOURCE_IDS_V1.PAYMENT_SUMMARY, validatePaymentSummaryV1);
      } catch {
        return failedRead(adapter, ACCOUNTING_SOURCE_IDS_V1.PAYMENT_SUMMARY, contractErrorV1("UNAVAILABLE", "Payment read is unavailable."), false);
      }
    },
    async issueInvoice(request, commandInput) {
      const parsed = validateIssueInvoiceCommandV1(commandInput);
      if (!parsed.ok) return rejected(parsed.error);
      const access = await gate(adapter, request, ACCOUNTING_CAPABILITIES_V1.INVOICE_ISSUE);
      if (!access.ok) return rejected(access.error);
      const command = parsed.value;
      if (command.confirmation.confirmedBy !== access.context.actorId) return rejected(contractErrorV1("CONFIRMATION_REQUIRED", "Confirmation actor does not match authorization."));
      const query = recoveryQuery("invoice_issued", access.context, command, command.payload.orderId);
      let hostResult: unknown;
      try { hostResult = await adapter.commands.issueInvoice(access.context, command); }
      catch { return unknown(query, "Invoice command may have committed; read receipt before retry."); }
      const result = normalizeCommandResult(hostResult, query, validateInvoiceIssuedReceiptV1,
        (receipt) => invoiceReceiptMatchesIntentV1(receipt, { intentId: command.intentId, idempotencyKey: command.idempotencyKey, orderId: command.payload.orderId, expectedVersion: command.expectedVersion }), access.context);
      return result;
    },
    async cancelInvoice(request, commandInput) {
      const parsed = validateCancelInvoiceCommandV1(commandInput);
      if (!parsed.ok) return rejected(parsed.error);
      const access = await gate(adapter, request, ACCOUNTING_CAPABILITIES_V1.INVOICE_CANCEL);
      if (!access.ok) return rejected(access.error);
      const command = parsed.value;
      if (command.confirmation.confirmedBy !== access.context.actorId) return rejected(contractErrorV1("CONFIRMATION_REQUIRED", "Confirmation actor does not match authorization."));
      let stateEnvelope: ReadEnvelopeV1<unknown>;
      try { stateEnvelope = await adapter.reads.readInvoiceCancelState(access.context, command.payload.invoiceId); }
      catch { return rejected(contractErrorV1("UNAVAILABLE", "Cancellation state is unavailable.")); }
      const sourceError = canonicalSourceBoundaryError(stateEnvelope, ACCOUNTING_SOURCE_IDS_V1.INVOICE_CANCEL_STATE);
      if (sourceError) return rejected(sourceError);
      if (!isReadEnvelopeV1(stateEnvelope)) return rejected(contractErrorV1("INTEGRITY_ERROR", "Cancellation state read is invalid."));
      if (stateEnvelope.state === "denied") return rejected(stateEnvelope.error);
      if (stateEnvelope.state === "empty") return rejected(contractErrorV1("NOT_FOUND", "Invoice was not found."));
      if (stateEnvelope.state !== "available") return rejected(stateEnvelope.error ?? contractErrorV1("UNAVAILABLE", "Cancellation state is unavailable."));
      if (stateEnvelope.stale || stateEnvelope.partial || stateEnvelope.coverage.state !== "complete") {
        return rejected(contractErrorV1(stateEnvelope.stale ? "STALE_READ" : "PARTIAL_READ", "Cancellation requires a complete and fresh state."));
      }
      const cancelState = validateCancelStateV1(stateEnvelope.data);
      if (!cancelState.ok || cancelState.value.tenantId !== access.context.tenantId || cancelState.value.invoiceId !== command.payload.invoiceId) {
        return rejected(cancelState.ok ? contractErrorV1("INTEGRITY_ERROR", "Cancellation state does not match the authorized intent.") : cancelState.error);
      }
      const safety = evaluateCancelSafetyV1(cancelState.value, command.expectedVersion);
      if (safety.decision === "block") return rejected(safety.error);
      const query = recoveryQuery("invoice_cancelled", access.context, command, command.payload.invoiceId);
      let hostResult: unknown;
      try { hostResult = await adapter.commands.cancelInvoiceAtomic(access.context, command, safety.precondition); }
      catch { return unknown(query, "Cancellation may have committed; read receipt before retry."); }
      const result = normalizeCommandResult(hostResult, query, validateInvoiceCancelledReceiptV1,
        (receipt) => cancellationReceiptMatchesIntentV1(receipt, { intentId: command.intentId, idempotencyKey: command.idempotencyKey, invoiceId: command.payload.invoiceId, expectedVersion: command.expectedVersion, reason: command.payload.reason }), access.context);
      return result;
    },
    async confirmPayment(request, commandInput) {
      const parsed = validateConfirmPaymentCommandV1(commandInput);
      if (!parsed.ok) return rejected(parsed.error);
      const access = await gate(adapter, request, ACCOUNTING_CAPABILITIES_V1.PAYMENT_CONFIRM);
      if (!access.ok) return rejected(access.error);
      const command = parsed.value;
      if (command.confirmation.confirmedBy !== access.context.actorId) return rejected(contractErrorV1("CONFIRMATION_REQUIRED", "Confirmation actor does not match authorization."));
      const query = recoveryQuery("payment_confirmed", access.context, command, command.payload.invoiceId);
      let hostResult: unknown;
      try { hostResult = await adapter.commands.confirmPayment(access.context, command); }
      catch { return unknown(query, "Payment command may have committed; read receipt before retry."); }
      const result = normalizeCommandResult(hostResult, query, validatePaymentConfirmedReceiptV1,
        (receipt) => paymentReceiptMatchesIntentV1(receipt, { intentId: command.intentId, idempotencyKey: command.idempotencyKey, invoiceId: command.payload.invoiceId, expectedVersion: command.expectedVersion, amountCents: command.payload.amount.amountCents, currency: command.payload.amount.currency, method: command.payload.method }), access.context);
      return result;
    },
    recoverInvoiceIssued: (request, query) => recover(adapter, request, query, "invoice_issued", ACCOUNTING_SOURCE_IDS_V1.INVOICE_RECEIPT, (context, recovery) => adapter.reads.readInvoiceIssuedReceipt(context, recovery), validateInvoiceIssuedReceiptV1, (receipt, recovery) => invoiceReceiptMatchesIntentV1(receipt, { intentId: recovery.intentId, idempotencyKey: recovery.idempotencyKey, orderId: recovery.aggregateId, expectedVersion: recovery.expectedVersion })),
    recoverInvoiceCancelled: (request, query) => recover(adapter, request, query, "invoice_cancelled", ACCOUNTING_SOURCE_IDS_V1.INVOICE_CANCELLED_RECEIPT, (context, recovery) => adapter.reads.readInvoiceCancelledReceipt(context, recovery), validateInvoiceCancelledReceiptV1, (receipt, recovery) => cancellationReceiptMatchesIntentV1(receipt, { intentId: recovery.intentId, idempotencyKey: recovery.idempotencyKey, invoiceId: recovery.aggregateId, expectedVersion: recovery.expectedVersion, reason: recovery.expectedReason ?? "" })),
    recoverPaymentConfirmed: (request, query) => recover(adapter, request, query, "payment_confirmed", ACCOUNTING_SOURCE_IDS_V1.PAYMENT_CONFIRMED_RECEIPT, (context, recovery) => adapter.reads.readPaymentConfirmedReceipt(context, recovery), validatePaymentConfirmedReceiptV1, (receipt, recovery) => recovery.expectedAmount !== null && recovery.expectedMethod !== null && paymentReceiptMatchesIntentV1(receipt, { intentId: recovery.intentId, idempotencyKey: recovery.idempotencyKey, invoiceId: recovery.aggregateId, expectedVersion: recovery.expectedVersion, amountCents: recovery.expectedAmount.amountCents, currency: recovery.expectedAmount.currency, method: recovery.expectedMethod })),
  };
}

async function recover<TReceipt>(
  adapter: AccountingHostAdapterV1,
  request: HostRequestV1,
  queryInput: unknown,
  expectedKind: RecoveryQueryV1["kind"],
  expectedSource: AccountingSourceIdV1,
  read: (context: HostActorContextV1, query: RecoveryQueryV1) => Promise<ReadEnvelopeV1<unknown>>,
  validate: (value: unknown) => ValidationResultV1<TReceipt>,
  matches: (receipt: TReceipt, query: RecoveryQueryV1) => boolean,
): Promise<ReceiptRecoveryDecisionV1<TReceipt>> {
  const query = validateRecoveryQuery(queryInput, expectedKind);
  if (!query.ok) return { state: "integrity_failure", error: query.error };
  const access = await gate(adapter, request, ACCOUNTING_CAPABILITIES_V1.RECEIPT_RECOVERY);
  if (!access.ok) return access.denied
    ? { state: "denied", error: access.error }
    : { state: "unknown", retry: "forbidden_until_reconciled", query: query.value, error: access.error };
  if (query.value.tenantId !== access.context.tenantId) {
    return { state: "denied", error: contractErrorV1("FORBIDDEN", "Recovery query tenant does not match authorization.") };
  }
  let envelope: ReadEnvelopeV1<unknown>;
  try { envelope = await read(access.context, query.value); }
  catch {
    return { state: "unknown", retry: "forbidden_until_reconciled", query: query.value, error: contractErrorV1("UNAVAILABLE", "Recovery read is unavailable.", "after_reconciliation") };
  }
  return decideReceiptRecoveryV1(envelope, query.value, expectedSource, validate, (receipt) => matches(receipt, query.value));
}
