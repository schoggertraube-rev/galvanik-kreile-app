"use server";

import { revalidatePath } from "next/cache";
import {
  cancelInvoiceCommand,
  issueInvoiceCommand,
  readInvoiceCancellationReceiptCommand,
  readInvoiceReceiptCommand,
  readInvoiceSummariesCommand,
  recoverInvoiceCancellationCommand,
  recoverInvoiceIssueCommand,
  type CancelInvoiceInput,
  type CancelInvoiceResult,
  type CreateInvoiceInput,
  type CreateInvoiceResult,
  type ReadInvoiceCancellationReceiptInput,
  type ReadInvoiceReceiptInput,
  type RecoveryCommandInput,
} from "@/modules/accounting/server-public";

export async function issueInvoiceAction(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  const result = await issueInvoiceCommand(input);
  if (result.code === "OK") {
    revalidatePath("/buchhaltung/rechnungen");
    revalidatePath("/warendurchlauf");
  }
  return result;
}

export async function cancelInvoiceAction(input: CancelInvoiceInput): Promise<CancelInvoiceResult> {
  const result = await cancelInvoiceCommand(input);
  if (result.code === "OK") {
    revalidatePath("/buchhaltung/rechnungen");
    revalidatePath("/warendurchlauf");
  }
  return result;
}

export async function getInvoiceReceiptAction(input: ReadInvoiceReceiptInput) {
  return readInvoiceReceiptCommand(input);
}

export async function getInvoiceCancellationReceiptAction(
  input: ReadInvoiceCancellationReceiptInput,
) {
  return readInvoiceCancellationReceiptCommand(input);
}

export async function getInvoiceSummariesAction() {
  return readInvoiceSummariesCommand();
}

export async function recoverInvoiceIssueAction(input: RecoveryCommandInput) {
  return recoverInvoiceIssueCommand(input);
}

export async function recoverInvoiceCancellationAction(input: RecoveryCommandInput) {
  return recoverInvoiceCancellationCommand(input);
}
