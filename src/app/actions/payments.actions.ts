"use server";

import { revalidatePath } from "next/cache";
import {V45_RUNTIME} from "@/ui/v45.generated";
import {DELIVERY_NOTE_COPY,SITUATION_COPY} from "@/ui/situationCatalog";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import {hasAuthorizationArea} from '@/lib/auth/authorizationContract';
import {observeAction} from '@/modules/logging/server-public';
import {readLoggingSettings} from '@/modules/fundament/server-public';
import type {
  ConfirmPaymentInput,
  ConfirmPaymentResult,
} from "@/lib/server/commands/confirmPaymentCommand";
import type {
  SetPaymentModeInput,
  SetPaymentModeResult,
} from "@/lib/server/commands/setPaymentModeCommand";
import type {
  OrderPaymentStateReadResult,
} from "@/lib/server/paymentSummaryRead";

type ActionAuthorizationResult =
  | { ok: true; data: AuthorizationSnapshot }
  | { ok: false; result: { code: "UNAUTHENTICATED" | "UNAVAILABLE"; message: string } };

async function resolveActionAuthorization(): Promise<ActionAuthorizationResult> {
  const { resolveAuthorization } = await import("@/lib/server/authorization");
  const authorization = await resolveAuthorization().catch((error: unknown) => {
    console.error("[ORDER_CARD_PAYMENT_AUTHORIZATION_ERROR]", {
      message: error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN",
    });
    return null;
  });
  if (!authorization || (!authorization.ok && authorization.reason === "AUTHORIZATION_UNAVAILABLE")) {
    return {
      ok: false,
      result: { code: "UNAVAILABLE", message: "Zahlungsdaten konnten nicht sicher geladen werden." },
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

function revalidatePaymentConsumers(): void {
  revalidatePath("/buchhaltung/rechnungen");
  revalidatePath("/cockpit");
  revalidatePath("/warendurchlauf");
}

export async function confirmPaymentAction(
  input: ConfirmPaymentInput,
): Promise<ConfirmPaymentResult> {
  const { confirmPayment } = await import("@/lib/server/commands/confirmPaymentCommand");
  const result = await observeAction('confirmPayment',{type:'invoice',id:input?.invoiceId},()=>confirmPayment(input),readLoggingSettings);
  if (result.code === "OK") revalidatePaymentConsumers();
  return result;
}

export async function setPaymentModeAction(
  input: SetPaymentModeInput,
): Promise<SetPaymentModeResult> {
  const { setPaymentMode } = await import("@/lib/server/commands/setPaymentModeCommand");
  const result = await observeAction('setPaymentMode',{type:'order',id:input?.orderId},()=>setPaymentMode(input),readLoggingSettings);
  if (result.code === "OK") revalidatePaymentConsumers();
  return result;
}

export type GetOrderPaymentStateActionResult =
  | (Extract<OrderPaymentStateReadResult,{code:"OK"}>&{deliveryNoteSource?:import("@/lib/domain/deliveryNoteContract").DeliveryNoteSourceRead})
  | Exclude<OrderPaymentStateReadResult,{code:"OK"}>
  | { code: "UNAUTHENTICATED"; message: string };

export async function getOrderPaymentStateAction(
  input: { orderId: string; includeDeliveryNoteSource?:boolean },
): Promise<GetOrderPaymentStateActionResult> {
  try {
    const authorization = await resolveActionAuthorization();
    if (!authorization.ok) return authorization.result;
    const { getPaymentState } = await import("@/lib/server/paymentSummaryRead");
    const readCredit=hasAuthorizationArea(authorization.data,'zahlungen')?async(tx:import('@/lib/server/privilegedDb').PrivilegedTenantTransaction,tenantId:string,customerId:string)=>{
      const [{readCustomerCreditInTransaction},{readCustomerProfile}]=await Promise.all([import('@/modules/accounting/server-public'),import('@/modules/customers/server-public')]);
      return readCustomerCreditInTransaction(tx,tenantId,customerId,readCustomerProfile);
    }:undefined;
    const state=await getPaymentState(authorization.data,input.orderId,readCredit);
    if(state.code!=='OK'||!input.includeDeliveryNoteSource)return state;
    try{
    const [{readDeliveryNoteSource},{readCompanyLetterSettings},{readCustomerProfile},{readInvoiceVat}]=await Promise.all([
      import('@/lib/server/deliveryNotePort'),import('@/modules/fundament/server-public'),import('@/modules/customers/server-public'),import('@/modules/accounting/server-public')
    ]);
    const deliveryNoteSource=await readDeliveryNoteSource(authorization.data,[input.orderId],{readVat:readInvoiceVat,readCustomer:readCustomerProfile,
      readCompany:()=>readCompanyLetterSettings({tenantId:authorization.data.tenantId,actorId:authorization.data.userId,canRead:true,includeDeliveryNoteIdentity:true})});
    return {...state,deliveryNoteSource};
    }catch(error){
      console.error('[ORDER_DELIVERY_NOTE_SOURCE_ACTION_FAILED]',error instanceof Error?error.name:'UnknownError');
      return {...state,deliveryNoteSource:{code:'UNAVAILABLE',message:V45_RUNTIME.texte['error.server'].text.replace('{gegenstand}',DELIVERY_NOTE_COPY.title).replace('{ausweg}',SITUATION_COPY.retry)}};
    }
  } catch (error) {
    console.error("[ORDER_CARD_PAYMENT_ACTION_ERROR]", {
      orderId: input.orderId,
      message: error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN",
    });
    return { code: "UNAVAILABLE", message: "Zahlungsdaten konnten nicht sicher geladen werden." };
  }
}
