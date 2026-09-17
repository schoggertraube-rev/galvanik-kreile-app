import type {
  CancelAtomicPreconditionV1,
  CancelInvoiceCommandV1,
  CommandResultV1,
  ConfirmPaymentCommandV1,
  HostActorContextV1,
  HostContextResultV1,
  HostRequestV1,
  InvoiceReadQueryV1,
  IssueInvoiceCommandV1,
  PaymentReadQueryV1,
  ReadEnvelopeV1,
  RecoveryQueryV1,
} from "./types";
import type { AccountingCapabilityV1 } from "./version";

export interface ExistingAccountingReadPortV1 {
  readInvoiceSummaries(context: HostActorContextV1, query: InvoiceReadQueryV1): Promise<ReadEnvelopeV1<readonly unknown[]>>;
  readPaymentSummaries(context: HostActorContextV1, query: PaymentReadQueryV1): Promise<ReadEnvelopeV1<readonly unknown[]>>;
  readInvoiceCancelState(context: HostActorContextV1, invoiceId: string): Promise<ReadEnvelopeV1<unknown>>;
  readInvoiceIssuedReceipt(context: HostActorContextV1, query: RecoveryQueryV1): Promise<ReadEnvelopeV1<unknown>>;
  readInvoiceCancelledReceipt(context: HostActorContextV1, query: RecoveryQueryV1): Promise<ReadEnvelopeV1<unknown>>;
  readPaymentConfirmedReceipt(context: HostActorContextV1, query: RecoveryQueryV1): Promise<ReadEnvelopeV1<unknown>>;
}

export interface ExistingAccountingCommandPortV1 {
  issueInvoice(context: HostActorContextV1, command: IssueInvoiceCommandV1): Promise<CommandResultV1<unknown>>;
  cancelInvoiceAtomic(
    context: HostActorContextV1,
    command: CancelInvoiceCommandV1,
    precondition: CancelAtomicPreconditionV1,
  ): Promise<CommandResultV1<unknown>>;
  confirmPayment(context: HostActorContextV1, command: ConfirmPaymentCommandV1): Promise<CommandResultV1<unknown>>;
}

export interface AccountingHostAdapterV1 {
  readonly adapterContractVersion: "host-adapter.accounting.v1";
  resolveContext(request: HostRequestV1, capability: AccountingCapabilityV1): Promise<HostContextResultV1>;
  readonly reads: ExistingAccountingReadPortV1;
  readonly commands: ExistingAccountingCommandPortV1;
}
