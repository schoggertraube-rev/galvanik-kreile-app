"use server";
import {readInvoiceVat} from "@/modules/accounting/server-public";
import {readCustomerCredit} from "@/modules/accounting/server-public";
import type {CustomerCreditResult} from "@/modules/accounting/public";
import {readCustomerProfile} from "@/modules/customers/server-public";
import {synchronizeCancellationCreditRetryTask} from '@/modules/tasks/server-public';
import {recordIntakeTaskEffect} from '@/modules/eingang/server-public';

import { revalidatePath } from "next/cache";
import { resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";
import type {
  CancelInvoiceInput,
  CancelInvoiceResult,
  CreateInvoiceInput,
  CreateInvoiceResult,
} from "@/lib/server/commands/immutableInvoiceCommand";
import type {
  SetInvoiceItemPricesInput,
  SetInvoiceItemPricesResult,
} from "@/lib/server/commands/invoiceItemPriceCommand";
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
  const authorization = await resolveAuthorization();
  if (!authorization.ok && authorization.reason === "AUTHORIZATION_UNAVAILABLE") {
    return {
      ok: false,
      result: { code: "UNAVAILABLE", message: authorization.message },
    };
  }
  if (!authorization.ok) {
    return {
      ok: false,
      result: { code: "UNAUTHENTICATED", message: authorization.message },
    };
  }
  return { ok: true, data: authorization.data };
}

export async function issueInvoiceAction(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  const { createInvoice } = await import("@/lib/server/commands/immutableInvoiceCommand");
  const result = await createInvoice(input,undefined,readInvoiceVat);
  if (result.code === "OK") {
    revalidatePath("/buchhaltung/rechnungen");
    revalidatePath("/warendurchlauf");
  }
  return result;
}

export async function setInvoiceItemPricesAction(
  input: SetInvoiceItemPricesInput,
): Promise<SetInvoiceItemPricesResult> {
  const { setInvoiceItemPrices } = await import("@/lib/server/commands/invoiceItemPriceCommand");
  const result = await setInvoiceItemPrices(input);
  if (result.code === "OK") {
    revalidatePath("/orders");
    revalidatePath("/warendurchlauf");
  }
  return result;
}

export async function cancelInvoiceAction(input: CancelInvoiceInput): Promise<CancelInvoiceResult> {
  const { cancelInvoice } = await import("@/lib/server/commands/immutableInvoiceCommand");
  const result = await cancelInvoice(input,readInvoiceVat,{
    failed:async(tx,auth,key)=>synchronizeCancellationCreditRetryTask(tx,auth,key,{effect:(writeTx,actor,effect)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)},'ensure'),
    settled:async(tx,auth,key)=>synchronizeCancellationCreditRetryTask(tx,auth,key,{effect:(writeTx,actor,effect)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)},'settle'),
  });
  if (result.code === "OK") {
    revalidatePath("/buchhaltung/rechnungen");
    revalidatePath("/warendurchlauf");
  }
  return result;
}

export async function getCustomerCreditAction(customerId:string):Promise<CustomerCreditResult>{
  const authorization=await resolveActionAuthorization();
  if(!authorization.ok)return authorization.result;
  return readCustomerCredit(authorization.data,customerId,readCustomerProfile);
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
  return readInvoiceReceipt(authorization.data, input,readInvoiceVat);
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
  return readInvoiceSummaries(authorization.data,readInvoiceVat);
}

/** Existing truth port composed at the same root as issue/read/cancellation. */
export async function getInvoiceTruthAction(filter:{from?:string;to?:string;customerId?:string}={}){
 const authorization=await resolveActionAuthorization();
 if(!authorization.ok)return authorization.result;
 const {readInvoiceTruth}=await import('@/lib/server/invoiceTruthRead');
 return readInvoiceTruth(authorization.data,filter,readInvoiceVat);
}
