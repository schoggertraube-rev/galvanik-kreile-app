"use server";

import { revalidatePath } from "next/cache";
import { resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";
import type {
  CancelInvoiceInput,
  CancelInvoiceResult,
  CreateInvoiceInput,
  CreateInvoiceResult,
} from "@/lib/server/commands/immutableInvoiceCommand";
import type {
  ReadInvoiceCancellationReceiptInput,
  ReadInvoiceCancellationReceiptResult,
  ReadInvoiceReceiptInput,
  ReadInvoiceReceiptResult,
  ReadInvoiceSummariesResult,
} from "@/lib/server/invoiceRead";

type ActionAuthorizationResult =
  | { ok: true; data: AuthorizationSnapshot }
  | { ok: false; result: { code: "UNAUTHENTICATED" | "UNAVAILABLE"; message: string } };

async function resolveActionAuthorization(): Promise<ActionAuthorizationResult> {
  const authorization = await resolveAuthorization().catch(() => null);
  if (!authorization || (!authorization.ok && authorization.reason === "AUTHORIZATION_UNAVAILABLE")) {
    return {
      ok: false,
      result: { code: "UNAVAILABLE", message: "Rechnungsdaten konnten nicht sicher geladen werden." },
    };
  }
  if (!authorization.ok) {
    return {
      ok: false,
      result: { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." },
    };
  }
  return { ok: true, data: authorization.data };
}

export async function issueInvoiceAction(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  const { createInvoice } = await import("@/lib/server/commands/immutableInvoiceCommand");
  const result = await createInvoice(input);
  if (result.code === "OK") {
    revalidatePath("/buchhaltung/rechnungen");
    revalidatePath("/warendurchlauf");
  }
  return result;
}

export async function cancelInvoiceAction(input: CancelInvoiceInput): Promise<CancelInvoiceResult> {
  const { cancelInvoice } = await import("@/lib/server/commands/immutableInvoiceCommand");
  const result = await cancelInvoice(input);
  if (result.code === "OK") {
    revalidatePath("/buchhaltung/rechnungen");
    revalidatePath("/warendurchlauf");
  }
  return result;
}

export type GetInvoiceReceiptActionResult =
  | ReadInvoiceReceiptResult
  | { code: "UNAUTHENTICATED"; message: string };

export async function getInvoiceReceiptAction(
  input: ReadInvoiceReceiptInput,
): Promise<GetInvoiceReceiptActionResult> {
  const authorization = await resolveActionAuthorization();
  if (!authorization.ok) return authorization.result;
  const { readInvoiceReceipt } = await import("@/lib/server/invoiceRead");
  return readInvoiceReceipt(authorization.data, input);
}

export type GetInvoiceCancellationReceiptActionResult =
  | ReadInvoiceCancellationReceiptResult
  | { code: "UNAUTHENTICATED"; message: string };

export async function getInvoiceCancellationReceiptAction(
  input: ReadInvoiceCancellationReceiptInput,
): Promise<GetInvoiceCancellationReceiptActionResult> {
  const authorization = await resolveActionAuthorization();
  if (!authorization.ok) return authorization.result;
  const { readInvoiceCancellationReceipt } = await import("@/lib/server/invoiceRead");
  return readInvoiceCancellationReceipt(authorization.data, input);
}

export type GetInvoiceSummariesActionResult =
  | ReadInvoiceSummariesResult
  | { code: "UNAUTHENTICATED"; message: string };

export async function getInvoiceSummariesAction(): Promise<GetInvoiceSummariesActionResult> {
  const authorization = await resolveActionAuthorization();
  if (!authorization.ok) return authorization.result;
  const { readInvoiceSummaries } = await import("@/lib/server/invoiceRead");
  return readInvoiceSummaries(authorization.data);
}
