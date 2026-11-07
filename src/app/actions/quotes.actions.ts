"use server";

import { renderToBuffer } from "@react-pdf/renderer";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { createQuotePdfDocument } from "@/lib/pdf/QuoteDocument";
import {
  getAuthorizationActionGrants,
  hasAuthorizationArea,
  resolveAuthorization,
  type AuthorizationSnapshot,
} from "@/lib/server/authorization";
import { readCustomerSummary } from "@/lib/server/customerSummaryRead";
import { createOrderIntake } from "@/lib/server/commands/orderIntakeCommand";
import { readOrderIntakeReceipt } from "@/lib/server/orderIntakeRead";
import {recordIntakeQuoteEffect,bindQuoteGoodsReceiptToCreatedOrder,writeQuoteGoodsReceiptInTransaction} from '@/modules/eingang/server-public';
import {parseQuoteGoodsReceiptInput} from '@/modules/eingang/public';
import { readCompanyDocumentSettings } from "@/modules/fundament/server-public";
import {
  createQuoteCommand,
  changeQuoteLifecycleCommand,
  type QuoteLifecycleInput,
  listOpenQuotesCommand,
  prepareQuoteConversionCommand,
  readQuoteCommand,
  readQuoteCreateReceiptCommand,
  readQuoteConversionReceiptCommand,
  readQuoteUpdateReceiptCommand,
  updateQuoteCommand,
  type ConvertQuoteInput,
  type CreateQuoteInput,
  type UpdateQuoteInput,
  type QuoteCommandContext,
} from "@/modules/quotes/server-public";

function quoteCommandContext(authorization: AuthorizationSnapshot): QuoteCommandContext {
  const actionGrants = getAuthorizationActionGrants(authorization);
  const canReadQuote = hasAuthorizationArea(authorization, "geld")
    && hasAuthorizationArea(authorization, "auftraege");
  return {
    tenantId: authorization.tenantId,
    userId: authorization.userId,
    capabilities: {
      canCreateQuote: actionGrants.createQuote,
      canReadQuote,
      canUpdateQuote: actionGrants.createQuote,
      canConvertQuote: actionGrants.createQuote,
    },
  };
}

function authorizationFailure(result: Awaited<ReturnType<typeof resolveAuthorization>>) {
  if (result.ok) return null;
  return result.reason === "AUTHORIZATION_UNAVAILABLE"
    ? { code: "UNAVAILABLE" as const, message: "KV-Funktion ist derzeit nicht verfügbar." }
    : { code: "UNAUTHENTICATED" as const, message: "Sitzung oder Berechtigung ist nicht verfügbar." };
}

export async function changeQuoteLifecycleAction(input:QuoteLifecycleInput) {
  try {
    const auth=await resolveAuthorization();
    const failure=authorizationFailure(auth);
    if (failure||!auth.ok) return failure!;
    const result=await changeQuoteLifecycleCommand(quoteCommandContext(auth.data),input);
    if (result.code==='OK') {
      revalidatePath('/');
      revalidatePath('/customers');
      revalidatePath(`/customers/${result.quote.customerId}`);
    }
    return result;
  } catch (error) {
    console.error('[QUOTE_LIFECYCLE_ACTION_FAILED]',error instanceof Error?error.name:'UnknownError');
    return {code:'UNAVAILABLE' as const,message:'KV-Entscheidung konnte nicht sicher bestätigt werden.'};
  }
}

export async function readQuoteDefaultsAction() {
  noStore();
  const auth=await resolveAuthorization();
  const failure=authorizationFailure(auth);
  if (failure||!auth.ok) return failure!;
  const {readQuoteSettings}=await import('@/modules/fundament/server-public');
  return readQuoteSettings({tenantId:auth.data.tenantId,actorId:auth.data.userId,canRead:quoteCommandContext(auth.data).capabilities.canReadQuote});
}

export async function createQuoteAction(input: CreateQuoteInput) {
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "KV konnte nicht sicher gespeichert werden." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;
  const snapshot=authorization.data;
  const result = await createQuoteCommand(quoteCommandContext(snapshot), input,(tx,source)=>recordIntakeQuoteEffect(tx,snapshot,source));
  if (result.code === "OK") {
    revalidatePath("/customers");
    revalidatePath(`/customers/${result.quote.customerId}`);
  }
  return result;
}

export async function readQuoteAction(input: { quoteId: string }) {
  noStore();
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "KV konnte nicht sicher gelesen werden." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;
  return readQuoteCommand(quoteCommandContext(authorization.data), input);
}

export async function listOpenQuotesAction() {
  noStore();
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Offene KVs konnten nicht sicher gelesen werden." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;
  return listOpenQuotesCommand(quoteCommandContext(authorization.data));
}

export async function updateQuoteAction(input: UpdateQuoteInput) {
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "KV konnte nicht sicher aktualisiert werden." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;
  const result = await updateQuoteCommand(quoteCommandContext(authorization.data), input);
  if (result.code === "OK") {
    revalidatePath("/customers");
    revalidatePath(`/customers/${result.quote.customerId}`);
  }
  return result;
}

/** Read-only recovery for an interrupted KV create; it never starts a command. */
export async function readQuoteCreateReceiptAction(input: CreateQuoteInput) {
  noStore();
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Der gespeicherte KV-Stand konnte nicht sicher gelesen werden." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;
  return readQuoteCreateReceiptCommand(quoteCommandContext(authorization.data), input);
}

/** Read-only recovery for an interrupted KV edit; it never starts a command. */
export async function readQuoteUpdateReceiptAction(input: UpdateQuoteInput) {
  noStore();
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Der gespeicherte KV-Stand konnte nicht sicher gelesen werden." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;
  return readQuoteUpdateReceiptCommand(quoteCommandContext(authorization.data), input);
}

/** Read-only recovery for an interrupted award. It verifies both receipts. */
export async function readQuoteConversionReceiptAction(input: { quoteId: string; clientEventId: string }) {
  noStore();
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Der gespeicherte Auftragsstand konnte nicht sicher gelesen werden." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;
  const persisted = await readQuoteConversionReceiptCommand(quoteCommandContext(authorization.data), input);
  if (persisted.code !== "OK") return persisted;
  try {
    const orderReceipt = await readOrderIntakeReceipt(authorization.data, {
      orderId: persisted.receipt.orderId, clientEventId: input.clientEventId,
    });
    if (!orderReceipt || orderReceipt.orderId !== persisted.receipt.orderId || orderReceipt.customerId !== persisted.receipt.customerId) {
      return { code: "UNAVAILABLE" as const, message: "Ein KV-Zuschlag wurde gefunden, der zugehörige Auftragsstand ist aber noch nicht sicher lesbar." };
    }
    return { code: "OK" as const, quote: persisted.quote, quoteReceipt: persisted.receipt, orderReceipt };
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Der gespeicherte Auftragsstand konnte nicht sicher gelesen werden." };
  }
}

export async function convertQuoteToOrderAction(input: ConvertQuoteInput,newGoodsInput?:unknown) {
  const newGoods=newGoodsInput===undefined?null:parseQuoteGoodsReceiptInput(newGoodsInput);
  if(newGoodsInput!==undefined&&(!newGoods||newGoods.quoteId!==input.quoteId||newGoods.id!==input.goodsReceiptId||newGoods.expectedQuoteVersion!==input.expectedVersion))return {code:"VALIDATION_ERROR" as const,message:"KV und neue Warenprüfung passen nicht zusammen."};
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "KV konnte nicht sicher beauftragt werden." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;

  const commandContext = quoteCommandContext(authorization.data);
  const prepared = await prepareQuoteConversionCommand(commandContext, input,{planOnly:true,pendingGoodsId:newGoods?.id});
  if (prepared.code !== "OK") return prepared;

  let goods:Awaited<ReturnType<typeof bindQuoteGoodsReceiptToCreatedOrder>>|null=null;
  let boundFailure:{code:'VALIDATION_ERROR'|'CONFLICT'|'UNAVAILABLE'|'FORBIDDEN'|'NOT_FOUND';message:string}|null=null;
  const saveGoods=async(tx:Parameters<typeof bindQuoteGoodsReceiptToCreatedOrder>[0],auth:AuthorizationSnapshot)=>{
    if(!newGoods)return;
    const saved=await writeQuoteGoodsReceiptInTransaction(tx,auth,newGoods);
    if(saved.code!=='OK'){boundFailure={code:saved.code==='UNAUTHENTICATED'?'FORBIDDEN':saved.code,message:saved.message};throw Error('QUOTE_NEW_GOODS_FAILED');}
  };
  const check=async(tx:Parameters<typeof bindQuoteGoodsReceiptToCreatedOrder>[0],planOnly:boolean)=>{
    const result=await prepareQuoteConversionCommand(commandContext,input,{transaction:tx,planOnly,pendingGoodsId:newGoods?.id});
    if(result.code!=='OK'){boundFailure=result;throw Error('QUOTE_ORDER_BINDING_FAILED');}
  };
  const order = await createOrderIntake(prepared.orderInput,undefined,{
    before:async(tx,auth)=>{await check(tx,true);if(newGoods&&prepared.replayed)await saveGoods(tx,auth);},
    beforeEvent:async(tx,auth)=>{await saveGoods(tx,auth);await check(tx,false);},
    after:async(tx,auth,receipt)=>{
      try{goods=await bindQuoteGoodsReceiptToCreatedOrder(tx,auth,{quoteId:input.quoteId,receiptId:input.goodsReceiptId!,clientEventId:input.clientEventId,orderId:receipt.orderId,items:receipt.items});}
      catch(error){
        if(error&&typeof error==='object'&&'result'in error){const result=error.result as {code:string;message:string};boundFailure={code:result.code==='CONFLICT'?'CONFLICT':'VALIDATION_ERROR',message:result.message};}
        throw error;
      }
    },
  });
  if (order.code !== "OK") return boundFailure??order;

  const persisted = await readQuoteConversionReceiptCommand(commandContext, {
    quoteId: input.quoteId,
    clientEventId: input.clientEventId,
  });
  if (persisted.code !== "OK"
    || persisted.receipt.orderId !== order.receipt.orderId
    || persisted.receipt.orderIntakeEventId !== order.receipt.eventId
    || persisted.quote.linkedOrderId !== order.receipt.orderId) {
    return { code: "UNAVAILABLE" as const, message: "Auftrag wurde angelegt, der sichere KV-Readback ist noch nicht verfügbar." };
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${order.receipt.orderId}`);
  revalidatePath("/customers");
  revalidatePath(`/customers/${persisted.receipt.customerId}`);
  return {
    code: "OK" as const,
    quote: persisted.quote,
    quoteReceipt: persisted.receipt,
    orderReceipt: order.receipt,
    goodsReceipt:goods,
    replayed: prepared.replayed && order.replayed,
  };
}

export async function readQuotePdfAction(input: { quoteId: string }) {
  noStore();
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "KV-PDF ist derzeit nicht verfügbar." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;

  const quoteResult = await readQuoteCommand(quoteCommandContext(authorization.data), input);
  if (quoteResult.code !== "OK") return quoteResult;
  const [customerResult, companyResult] = await Promise.all([
    readCustomerSummary(authorization.data, { customerId: quoteResult.quote.customerId }),
    readCompanyDocumentSettings({
      tenantId: authorization.data.tenantId,
      actorId: authorization.data.userId,
      canRead: authorization.data.permissions.includes("perm_view_leitstand"),
    }),
  ]);
  if (customerResult.code !== "OK") return customerResult;
  if (companyResult.code !== "OK") return companyResult;

  try {
    const pdf = await renderToBuffer(createQuotePdfDocument({
      company: companyResult.company,
      customer: customerResult.data,
      quote: quoteResult.quote,
    }));
    return { code: "OK" as const, pdf, quoteNumber: quoteResult.quote.quoteNumber };
  } catch {
    return { code: "UNAVAILABLE" as const, message: "KV-PDF konnte nicht sicher erstellt werden." };
  }
}
