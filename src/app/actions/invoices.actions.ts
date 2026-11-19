"use server";
import {readCustomerInvoiceTerms} from '@/modules/customers/server-public';
import {observeAction,subjectForAction} from '@/modules/logging/server-public';
import {readLoggingSettings} from '@/modules/fundament/server-public';
import {readInvoiceVat} from "@/modules/accounting/server-public";
import {readCustomerCredit,readCustomerCreditInTransaction} from "@/modules/accounting/server-public";
import type {CustomerCreditResult,CustomerCreditApplyInput} from "@/modules/accounting/public";
import {readCustomerProfile} from "@/modules/customers/server-public";
import {synchronizeCancellationCreditRetryTask} from '@/modules/tasks/server-public';
import {recordIntakeTaskEffect,recognizeInvoicePdf} from '@/modules/eingang/server-public';

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
 return observeAction('issueInvoiceAction',subjectForAction('issueInvoiceAction',input),async()=>{
  const { createInvoice } = await import("@/lib/server/commands/immutableInvoiceCommand");
  const {readShippingSettingsInTransaction}=await import('@/modules/fundament/server-public');
  const result = await createInvoice(input,undefined,readInvoiceVat,readShippingSettingsInTransaction,recognizeInvoicePdf,readCustomerInvoiceTerms);
  if (result.code === "OK") {
    revalidatePath("/buchhaltung/rechnungen");
    revalidatePath("/warendurchlauf");
  }
  return result;

 },readLoggingSettings);
}

export async function setInvoiceItemPricesAction(
  input: SetInvoiceItemPricesInput,
): Promise<SetInvoiceItemPricesResult> {
 return observeAction('setInvoiceItemPricesAction',subjectForAction('setInvoiceItemPricesAction',input),async()=>{
  const { setInvoiceItemPrices } = await import("@/lib/server/commands/invoiceItemPriceCommand");
  const result = await setInvoiceItemPrices(input);
  if (result.code === "OK") {
    revalidatePath("/orders");
    revalidatePath("/warendurchlauf");
  }
  return result;

 },readLoggingSettings);
}

export async function cancelInvoiceAction(input: CancelInvoiceInput): Promise<CancelInvoiceResult> {
 return observeAction('cancelInvoiceAction',subjectForAction('cancelInvoiceAction',input),async()=>{
  const { cancelInvoice } = await import("@/lib/server/commands/immutableInvoiceCommand");
  const result = await cancelInvoice(input,readInvoiceVat,{
    failed:async(tx,auth,key)=>synchronizeCancellationCreditRetryTask(tx,auth,key,{effect:(writeTx,actor,effect)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)},'ensure'),
    settled:async(tx,auth,key)=>synchronizeCancellationCreditRetryTask(tx,auth,key,{effect:(writeTx,actor,effect)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)},'settle'),
  },recognizeInvoicePdf);
  if (result.code === "OK") {
    revalidatePath("/buchhaltung/rechnungen");
    revalidatePath("/warendurchlauf");
  }
  return result;

 },readLoggingSettings);
}

export async function getCustomerCreditAction(customerId:string):Promise<CustomerCreditResult>{
 return observeAction('getCustomerCreditAction',subjectForAction('getCustomerCreditAction',{customerId}),async()=>{
  const authorization=await resolveActionAuthorization();
  if(!authorization.ok)return authorization.result;
  const {readCustomerCreditPayoutHistory}=await import('@/lib/server/commands/customerCreditCommand');
  return readCustomerCredit(authorization.data,customerId,readCustomerProfile,readCustomerCreditPayoutHistory);

 },readLoggingSettings);
}

export async function applyCustomerCreditAction(input:CustomerCreditApplyInput){
 return observeAction('applyCustomerCreditAction',subjectForAction('applyCustomerCreditAction',input),async()=>{
 const {applyCustomerCredit}=await import('@/lib/server/commands/customerCreditCommand');
 const result=await applyCustomerCredit(input,(tx,tenantId,customerId)=>readCustomerCreditInTransaction(tx,tenantId,customerId,readCustomerProfile));
 if(result.code==='OK'){
  revalidatePath('/buchhaltung/rechnungen');revalidatePath('/warendurchlauf');revalidatePath('/customers');
 }
 return result;

 },readLoggingSettings);
}

export async function payoutCustomerCreditAction(input:import('@/modules/accounting/public').CustomerCreditPayoutInput){
 return observeAction('payoutCustomerCreditAction',subjectForAction('payoutCustomerCreditAction',input),async()=>{
 const {payoutCustomerCredit}=await import('@/lib/server/commands/customerCreditCommand');
 const result=await payoutCustomerCredit(input,(tx,tenantId,customerId)=>readCustomerCreditInTransaction(tx,tenantId,customerId,readCustomerProfile),readCustomerProfile);
 if(result.code==='OK'){revalidatePath('/buchhaltung/rechnungen');revalidatePath('/customers');}
 return result;

 },readLoggingSettings);
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
 return observeAction('getInvoiceTruthAction',subjectForAction('getInvoiceTruthAction',filter),async()=>{
 const authorization=await resolveActionAuthorization();
 if(!authorization.ok)return authorization.result;
 const {readInvoiceTruth}=await import('@/lib/server/invoiceTruthRead');
 return readInvoiceTruth(authorization.data,filter,readInvoiceVat);

 },readLoggingSettings);
}
