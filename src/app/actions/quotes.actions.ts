"use server";
import {openIntakePredicate} from '@/modules/eingang/server-public';

import type {ListOpenQuotesResult} from '@/modules/quotes/public';
import {canReadQuoteFollowups} from '@/lib/auth/authorizationContract';
import {createInitialOrderPrintJobs} from '@/modules/orders/server-public';
import {quoteCommandContext,quoteOperationContext} from '@/lib/server/quoteAuthorization';
import {canonicalJson} from '@/lib/domain/canonicalJson';
import {bindOrderQuoteCommercialTerms} from '@/lib/server/orderQuoteReadPort';

import {readMicrosoftGraphSentDocumentEvidence} from "@/lib/server/microsoftGraph";

import {createHash} from "node:crypto";
import {onsitePhaseKey,appendQuoteJournal,readQuoteJournal,readQuoteJournals,readQuoteReplyDocuments,quoteReplyEditionMessage,type QuoteReplyProof} from "@/lib/server/quoteJournalPort";

import { renderToBuffer } from "@react-pdf/renderer";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { createQuotePdfDocument } from "@/lib/pdf/QuoteDocument";
import {
  hasAuthorizationArea,
  resolveAuthorization,
  type AuthorizationSnapshot,
} from "@/lib/server/authorization";
import {quoteForUi,scaleQuotePositions} from "@/modules/quotes/public";
import {readQuoteReceivedQuantities} from "@/lib/server/quoteGoodsContextPort";
import {intakePaymentContract} from "@/lib/domain/intakePaymentContract";
import { readCustomerSummary,readCustomerListSignals } from "@/lib/server/customerSummaryRead";
import {searchOrderIntakeCustomers} from '@/lib/server/orderIntakeRead';
import {recognizeIntakeText} from '@/lib/server/intakeTextRecognition';
import {findRecognizedCustomers} from '@/modules/eingang/public';
import {withPrivilegedTenantTransaction} from "@/lib/server/privilegedDb";
import { createOrderIntake } from "@/lib/server/commands/orderIntakeCommand";
import { readOrderIntakeReceipt } from "@/lib/server/orderIntakeRead";
import {readIntakeQuoteReplyReference,recordIntakeQuoteEffect,bindQuoteGoodsReceiptToCreatedOrder,writeQuoteGoodsReceiptInTransaction,recordIntakeTaskEffect,readIntakeMessages,readIntakeAssignment} from '@/modules/eingang/server-public';
import {parseQuoteGoodsReceiptInput} from '@/modules/eingang/public';
import {syncQuoteFollowupTask,readQuoteFollowupTasksForToday} from '@/modules/tasks/server-public';
import {readCustomerProfile} from '@/modules/customers/server-public';
import {readQuoteSettingsInTransaction} from '@/modules/fundament/server-public';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import { readCompanyDocumentSettings } from "@/modules/fundament/server-public";
import {
  createQuoteCommand,
  readQuoteCopyCommand,
  changeQuoteLifecycleCommand,
  type QuoteLifecycleInput,
  type QuoteFollowupBinding,
  listOpenQuotesCommand,
  prepareQuoteConversionCommand,
  reverseQuoteConversionCommand,readQuoteUndoContext,readQuoteCommand,
  readQuoteCreateReceiptCommand,
  readQuoteConversionReceiptCommand,
  readQuoteUpdateReceiptCommand,
  updateQuoteCommand,
  type ConvertQuoteInput,
  type CreateQuoteInput,
  type UpdateQuoteInput,
} from "@/modules/quotes/server-public";

type PendingMailAcceptance={input:QuoteLifecycleInput;proof:QuoteReplyProof;handoverMode:'pickup'|'shipping';paymentMode:'vorkasse'|'abholung'|'rechnung';eventId?:string;notices?:string[]};
function mailOrderKey(requestId:string){const bytes=createHash('sha256').update('quote-mail-order:'+requestId).digest().subarray(0,16);bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const h=bytes.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}

function quoteFollowupBinding(auth:AuthorizationSnapshot,operationalCancel=false):QuoteFollowupBinding{
 return async(tx,{quote,action,phase})=>{
  const life=quote.lifecycle;if(!life)throw Error('QUOTE_FOLLOWUP_LIFECYCLE_MISSING');
  const deps={effect:async(transaction:typeof tx,snapshot:AuthorizationSnapshot,effect:Parameters<typeof recordIntakeTaskEffect>[2])=>{
   if(operationalCancel){
    if(effect.action!=='erledigt'||effect.kind!=='aufgabe'||effect.reference.type!=='kv'||effect.reference.id!==quote.quoteId)throw Error('QUOTE_OPERATIONAL_TASK_SCOPE_INVALID');
    await appendQuoteJournal(transaction,snapshot,{id:globalThis.crypto.randomUUID(),type:'QUOTE_FOLLOWUP_COMPLETED_V1',clientEventId:effect.key,correlationId:globalThis.crypto.randomUUID(),version:quote.version+1,description:'KV-Nachfassaufgabe durch persönliche Zusage erledigt',payload:{quoteId:quote.quoteId,taskId:effect.taskId,reason:effect.note}});return;
   }
   return recordIntakeTaskEffect(transaction,snapshot,effect,readCustomerProfile);
  }};
  const request={quoteId:quote.quoteId,quoteNumber:quote.quoteNumber,customerName:quote.customerDisplayName,edition:life.edition,sentEdition:life.sentEdition,dueDate:null as string|null,reason:action==='accept'?'KV zugesagt':action==='reject'?'KV abgesagt':action==='conditional'?'KV mit Vorbehalt · Anpassung erforderlich':'Neue KV-Fassung'};
  if(phase==='before'){
   if(action==='sent'&&life.sentEdition!==null&&life.sentEdition!==life.edition)await syncQuoteFollowupTask(tx,auth,{...request,edition:life.sentEdition,action:'cancel'},deps);
   return null;
  }
  if(action!=='sent'||life.acceptedEdition===life.edition){await syncQuoteFollowupTask(tx,auth,{...request,action:'cancel'},deps,{operationalCancel});return null;}
  const settings=await readQuoteSettingsInTransaction(tx,auth.tenantId),days=settings?.followupDays;
  if(days!==null&&days!==undefined){const date=new Date(berlinCalendarDay()+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);request.dueDate=date.toISOString().slice(0,10);}
  await syncQuoteFollowupTask(tx,auth,{...request,action:'sent'},deps);
  return days===null||days===undefined?'Nachfassfrist fehlt · in Einstellungen ergänzen. Es wurde kein Ersatzdatum erfunden.':null;
 };
}

function authorizationFailure(result: Awaited<ReturnType<typeof resolveAuthorization>>) {
  if (result.ok) return null;
  return result.reason === "AUTHORIZATION_UNAVAILABLE"
    ? { code: "UNAVAILABLE" as const, message: "KV-Funktion ist derzeit nicht verfügbar." }
    : { code: "UNAUTHENTICATED" as const, message: "Sitzung oder Berechtigung ist nicht verfügbar." };
}

export async function changeQuoteLifecycleAction(input:QuoteLifecycleInput,options?:{actualMail?:boolean;onsiteGoodsReceiptId?:string}) {
  try {
    const auth=await resolveAuthorization();
    const failure=authorizationFailure(auth);
    if (failure||!auth.ok) return failure!;
    let replyProof:QuoteReplyProof|undefined;
    if(input?.action==='accept'&&input.source?.message&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.clientEventId)&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.source.itemId)){
     const context=quoteOperationContext(auth.data);if(!context.capabilities.canDecideQuote)return {code:'FORBIDDEN' as const,message:'KV-Entscheidung ist nicht freigegeben.'};
     const prior=await withPrivilegedTenantTransaction(auth.data,tx=>readQuoteJournal(tx,auth.data,input.clientEventId));
     if(!prior.length){
      const quote=await readQuoteCommand(context,{quoteId:input.quoteId});if(quote.code!=='OK')return quote;
      const source=await readIntakeQuoteReplyReference(auth.data,{itemId:input.source.itemId,version:input.source.version,quoteId:input.quoteId,customerId:quote.quote.customerId});if(source.code!=='OK')return source;
      const target=await readMicrosoftGraphSentDocumentEvidence(source.reference.internetMessageId,source.reference.sender);if(target.code!=='OK')return {code:'VALIDATION_ERROR' as const,message:target.message};
      const documents=await withPrivilegedTenantTransaction(auth.data,tx=>readQuoteReplyDocuments(tx,auth.data,input.quoteId,quote.quote.customerId));
      const matching=documents.filter(row=>Number.isSafeInteger(row.document?.edition)&&target.data.pdfSha256.includes(row.document?.sha256));
      const editions=[...new Set(matching.map(row=>row.document.edition))];if(documents.length>100||editions.length!==1)return {code:'VALIDATION_ERROR' as const,message:'Das beantwortete PDF ist keiner eindeutigen gesendeten KV-Fassung zugeordnet. Aktuelle Fassung bestätigen lassen.'};
      const match=matching[0];replyProof={quoteId:input.quoteId,edition:match.document.edition,sha256:match.document.sha256,sourceItemId:input.source.itemId,sourceVersion:input.source.version,originalSha256:source.reference.originalSha256,inReplyTo:target.data.internetMessageId,sentGraphId:target.data.graphMessageId,dispatchEventId:match.eventId};
      if(replyProof.edition!==quote.quote.lifecycle?.edition)return {code:'VALIDATION_ERROR' as const,message:quoteReplyEditionMessage(replyProof.edition,quote.quote.lifecycle!.edition)};
      if(!quote.quote.linkedOrderId&&quote.quote.lifecycle?.goods?.some(row=>!row.orderId)&&!(await readQuoteUndoContext(context,quote.quote)).automaticSuppressed){
       const profile=await withPrivilegedTenantTransaction(auth.data,tx=>readCustomerProfile(tx,auth.data.tenantId,quote.quote.customerId));
       if(!profile?.handoverPreference||!profile.paymentPreference)return {code:'VALIDATION_ERROR' as const,message:'Übergabe und Zahlungsbedingung in der Kundenkarte ergänzen. Die Mail-Zusage bleibt offen.'};
       const payment=intakePaymentContract({customerMode:'EXISTING',paymentPreference:profile.paymentPreference,handoverMode:profile.handoverPreference,invoiceTermsEnabled:profile.invoiceTermsEnabled,invoiceTermDays:profile.invoiceTermDays});
       if(!payment.ok)return {code:'VALIDATION_ERROR' as const,message:payment.message};
       const pending:PendingMailAcceptance={input,proof:{...replyProof,automaticOrder:true},handoverMode:profile.handoverPreference,paymentMode:payment.mode};
       const converted=await convertQuoteToOrder({quoteId:input.quoteId,clientEventId:mailOrderKey(input.clientEventId),expectedVersion:input.expectedVersion+1,confirmedAward:true,confirmedOrderDueDate:quote.quote.dueDate,handoverMode:pending.handoverMode,paymentMode:pending.paymentMode,goodsReceiptId:quote.quote.lifecycle.goods.find(row=>!row.orderId)!.id},undefined,undefined,pending);
       if(converted.code!=='OK')return converted;
       return {code:'OK' as const,quote:converted.quote,eventId:pending.eventId!,replayed:converted.replayed,notices:pending.notices,orderId:converted.orderReceipt.orderId};
      }

     }
    }
    const result=await changeQuoteLifecycleCommand((input?.action==='accept'||input?.action==='extend')?quoteOperationContext(auth.data):quoteCommandContext(auth.data),input,(tx,source)=>recordIntakeQuoteEffect(tx,auth.data,source),quoteFollowupBinding(auth.data,input?.action==='accept'&&!quoteCommandContext(auth.data).capabilities.canReadQuote),{actualMail:options?.actualMail===true,onsiteGoodsReceiptId:options?.onsiteGoodsReceiptId,replyProof});
    if (result.code==='OK') {
      revalidatePath('/');
      revalidatePath('/customers');
      revalidatePath(`/customers/${result.quote.customerId}`);
    }
    return result.code==='OK'?{...result,quote:quoteForUi(result.quote,quoteCommandContext(auth.data).capabilities.canReadQuote)}:result;
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

export async function readQuoteAction(input: { quoteId: string;receivedQuantities?:Array<{position:number;quantity:number}>;goodsReceiptId?:string;purpose?:'operations' }) {
  noStore();
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "KV konnte nicht sicher gelesen werden." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;
  const financialContext=quoteCommandContext(authorization.data),operationalContext=quoteOperationContext(authorization.data);
  const financial=financialContext.capabilities.canReadQuote;
  const context=input?.purpose==='operations'?operationalContext:financialContext;
  const result=await readQuoteCommand(context,{quoteId:input?.quoteId});
  if(result.code!=='OK')return result;
  try{
    const customer=await withPrivilegedTenantTransaction(authorization.data,tx=>readCustomerProfile(tx,authorization.data.tenantId,result.quote.customerId));
    const handoverMode=customer?.handoverPreference??null;
    const payment=customer&&handoverMode?intakePaymentContract({customerMode:'EXISTING',paymentPreference:customer.paymentPreference,handoverMode,invoiceTermsEnabled:customer.invoiceTermsEnabled,invoiceTermDays:customer.invoiceTermDays}):null;
    const receiptQuantities=input.goodsReceiptId?await withPrivilegedTenantTransaction(authorization.data,tx=>readQuoteReceivedQuantities(tx,authorization.data.tenantId,result.quote.quoteId,input.goodsReceiptId!)):null;
    if(input.goodsReceiptId&&!receiptQuantities)return {code:'VALIDATION_ERROR' as const,message:'Passender angenommener Warenbeleg fehlt oder ist gesperrt.'};
    const quantities=receiptQuantities?receiptQuantities.map(row=>({position:row.kv_position,quantity:Number(row.bestaetigt)})):input.receivedQuantities??result.quote.positions.map(row=>({position:row.position,quantity:row.quantity}));
    if(!Array.isArray(quantities))return {code:'VALIDATION_ERROR' as const,message:'Beauftragungsdaten sind ungültig.'};
    const {readQuoteActors}=await import('@/modules/quotes/server-public');
    const actors=await readQuoteActors(context,{quoteId:result.quote.quoteId,version:result.quote.version});
    const annotated={...result.quote,...(actors.code==='OK'?{actorTrace:actors.trace}:{actorReadError:actors.message})};
    const preview=scaleQuotePositions(result.quote.lifecycle?.calculation??null,result.quote.positions,quantities);
    if(preview.code!=='OK')return preview;
    const {readV45QuoteRule}=await import('@/lib/server/v45QuoteRead');
    const canEdit=financial&&context.capabilities.canUpdateQuote,canReceive=hasAuthorizationArea(authorization.data,'eingang');
    return {...result,nextActionRule:readV45QuoteRule(authorization.data,result.quote,{financial,commandRights:{'quote.receive':canReceive,'quote.revise':canEdit,'quote.send':hasAuthorizationArea(authorization.data,'mails'),'quote.followup':hasAuthorizationArea(authorization.data,'mails'),'quote.convert':operationalContext.capabilities.canConvertQuote,'quote.accept':operationalContext.capabilities.canReadQuote&&(operationalContext.capabilities.canUpdateQuote||operationalContext.capabilities.canDecideQuote),'quote.extend':operationalContext.capabilities.canReadQuote&&(operationalContext.capabilities.canUpdateQuote||operationalContext.capabilities.canDecideQuote),'quote.return_goods':authorization.data.active}}),undo:await readQuoteUndoContext(context,result.quote),quote:quoteForUi(annotated,financial),canEdit,canOperate:true,canReceive,conversion:{handoverMode,paymentMode:payment?.ok?payment.mode:null},preview:{totalNetCents:financial?preview.totalNetCents:null,plannedHours:preview.calculation?.hours??null,positions:preview.positions.map(row=>({position:row.position,quantity:row.quantity,lineTotalCents:financial?row.lineTotalCents:null}))}};
  }catch(error){console.error('[QUOTE_CONVERSION_DEFAULTS_READ_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'KV konnte nicht sicher gelesen werden.'};}
}

export async function listOpenQuotesAction():Promise<ListOpenQuotesResult>;
export async function listOpenQuotesAction(input:{purpose:'today'}):Promise<{code:'OK';quotes:Array<{quoteId:string;version:number}>}|Exclude<ListOpenQuotesResult,{code:'OK'}>>;
export async function listOpenQuotesAction(input?:{purpose:'today'}) {
  noStore();
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Offene KVs konnten nicht sicher gelesen werden." };
  }
  const failure = authorizationFailure(authorization);
  if (failure || !authorization.ok) return failure!;
  if(input?.purpose==='today'){
    if(!canReadQuoteFollowups(authorization.data))return {code:'FORBIDDEN' as const,message:'KV-Nachfassen ist nicht freigegeben.'};
    const result=await listOpenQuotesCommand(quoteOperationContext(authorization.data));
    return result.code==='OK'?{code:'OK' as const,quotes:result.quotes.map(({quoteId,version})=>({quoteId,version}))}:result;
  }
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
  const result = await updateQuoteCommand(quoteCommandContext(authorization.data), input,quoteFollowupBinding(authorization.data),(tx,source)=>recordIntakeQuoteEffect(tx,authorization.data,source));
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

export async function convertQuoteToOrderAction(input: ConvertQuoteInput,newGoodsInput?:unknown,telephoneAcceptance?:{clientEventId:string;edition:number;evidence:string}) {return convertQuoteToOrder(input,newGoodsInput,telephoneAcceptance);}

async function convertQuoteToOrder(input:ConvertQuoteInput,newGoodsInput?:unknown,telephoneAcceptance?:{clientEventId:string;edition:number;evidence:string},pendingMail?:PendingMailAcceptance) {
  if(!input||typeof input!=='object')return {code:'VALIDATION_ERROR' as const,message:'KV und Buchungsdaten fehlen.'};
  if(telephoneAcceptance!==undefined&&(!telephoneAcceptance||typeof telephoneAcceptance!=='object'||Array.isArray(telephoneAcceptance)||Object.keys(telephoneAcceptance).sort().join(',')!=='clientEventId,edition,evidence'||typeof telephoneAcceptance.clientEventId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(telephoneAcceptance.clientEventId)||telephoneAcceptance.clientEventId===input.clientEventId||!Number.isSafeInteger(telephoneAcceptance.edition)||telephoneAcceptance.edition<1||typeof telephoneAcceptance.evidence!=='string'||telephoneAcceptance.evidence.trim().length<3||telephoneAcceptance.evidence.length>4000))return {code:'VALIDATION_ERROR' as const,message:'Telefonische Zusage braucht eigene Kennung, Fassung und Wortlaut.'};
  const conversionInput=telephoneAcceptance?{...input,expectedVersion:input.expectedVersion+1}:input;
  const pendingAcceptance=telephoneAcceptance?{edition:telephoneAcceptance.edition,beforeVersion:input.expectedVersion}:pendingMail?{edition:pendingMail.input.edition,beforeVersion:pendingMail.input.expectedVersion}:undefined;
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

  const commandContext = quoteOperationContext(authorization.data);
  const prepared = await prepareQuoteConversionCommand(commandContext, conversionInput,{planOnly:true,pendingAcceptance,pendingGoodsId:newGoods?.id,pendingQuantities:newGoods?.quantities});
  if (prepared.code !== "OK") return prepared;

  let goods:Awaited<ReturnType<typeof bindQuoteGoodsReceiptToCreatedOrder>>|null=null;
  let boundFailure:{code:'VALIDATION_ERROR'|'CONFLICT'|'UNAVAILABLE'|'FORBIDDEN'|'NOT_FOUND';message:string}|null=null;
  const saveGoods=async(tx:Parameters<typeof bindQuoteGoodsReceiptToCreatedOrder>[0],auth:AuthorizationSnapshot)=>{
    if(!newGoods)return;
    const saved=await writeQuoteGoodsReceiptInTransaction(tx,auth,newGoods);
    if(saved.code!=='OK'){boundFailure={code:saved.code==='UNAUTHENTICATED'?'FORBIDDEN':saved.code,message:saved.message};throw Error('QUOTE_NEW_GOODS_FAILED');}
  };
  const check=async(tx:Parameters<typeof bindQuoteGoodsReceiptToCreatedOrder>[0],planOnly:boolean,prospective=false)=>{
    const result=await prepareQuoteConversionCommand(commandContext,conversionInput,{transaction:tx,planOnly,pendingAcceptance:prospective?pendingAcceptance:undefined,pendingGoodsId:newGoods?.id,pendingQuantities:newGoods?.quantities});
    if(result.code!=='OK'){boundFailure=result;throw Error('QUOTE_ORDER_BINDING_FAILED');}
  };
  const accept=async(tx:Parameters<typeof bindQuoteGoodsReceiptToCreatedOrder>[0],auth:AuthorizationSnapshot)=>{
    if(!telephoneAcceptance)return;
    const result=await changeQuoteLifecycleCommand(commandContext,{quoteId:input.quoteId,expectedVersion:input.expectedVersion,action:'accept',...telephoneAcceptance},(transaction,source)=>recordIntakeQuoteEffect(transaction,auth,source),quoteFollowupBinding(auth,!quoteCommandContext(auth).capabilities.canReadQuote),{transaction:tx});
    if(result.code!=='OK'){boundFailure=result;throw Error('QUOTE_TELEPHONE_ACCEPTANCE_FAILED');}
  };
  const order = await createOrderIntake(prepared.orderInput,undefined,{
    quoteAuthorization:{quoteId:input.quoteId},
    before:async(tx,auth)=>{
      await saveGoods(tx,auth);
      if(pendingMail){
       const accepted=await changeQuoteLifecycleCommand(commandContext,pendingMail.input,(transaction,source)=>recordIntakeQuoteEffect(transaction,auth,source),quoteFollowupBinding(auth),{transaction:tx,replyProof:pendingMail.proof});
       if(accepted.code!=='OK'){boundFailure=accepted;throw Error('QUOTE_MAIL_ACCEPT_FAILED');}pendingMail.eventId=accepted.eventId;pendingMail.notices=accepted.notices;
       const profile=await readCustomerProfile(tx,auth.tenantId,prepared.orderInput.customer.customerId,true);
       if(!profile?.handoverPreference||!profile.paymentPreference||profile.handoverPreference!==pendingMail.handoverMode){boundFailure={code:'VALIDATION_ERROR',message:'Kundenbedingungen wurden geändert. Mail-Zusage bleibt offen.'};throw Error('QUOTE_MAIL_CUSTOMER_CHANGED');}
       const payment=intakePaymentContract({customerMode:'EXISTING',paymentPreference:profile.paymentPreference,handoverMode:profile.handoverPreference,invoiceTermsEnabled:profile.invoiceTermsEnabled,invoiceTermDays:profile.invoiceTermDays});
       if(!payment.ok||payment.mode!==pendingMail.paymentMode){boundFailure={code:'VALIDATION_ERROR',message:'Zahlungsbedingung wurde geändert. Mail-Zusage bleibt offen.'};throw Error('QUOTE_MAIL_PAYMENT_CHANGED');}
      }
      if(telephoneAcceptance)await accept(tx,auth);
      await check(tx,false);
    },
    beforeEvent:async(tx)=>{await check(tx,false);},
    after:async(tx,auth,receipt)=>{
      await createInitialOrderPrintJobs(tx,auth,receipt.orderId,receipt.customerDisplayName,receipt.items.map(item=>item.id));
      try{goods=await bindQuoteGoodsReceiptToCreatedOrder(tx,auth,{quoteId:input.quoteId,receiptId:input.goodsReceiptId!,clientEventId:input.clientEventId,orderId:receipt.orderId,items:receipt.items});await bindOrderQuoteCommercialTerms(tx,auth,receipt.orderId);}
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
    quote: quoteForUi(persisted.quote,quoteCommandContext(authorization.data).capabilities.canReadQuote),
    quoteReceipt: persisted.receipt,
    orderReceipt: quoteCommandContext(authorization.data).capabilities.canReadQuote?order.receipt:{...order.receipt,items:order.receipt.items.map(row=>({...row,unitPriceCents:null,vatRateBasisPoints:null}))},
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
    readCustomerSummary(authorization.data, { customerId: quoteResult.quote.customerId },openIntakePredicate()),
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
    return { code: "OK" as const, pdf, quoteNumber: quoteResult.quote.quoteNumber,document:{id:quoteResult.quote.quoteId,customerId:quoteResult.quote.customerId,linkedOrderId:quoteResult.quote.linkedOrderId,version:quoteResult.quote.version,edition:quoteResult.quote.lifecycle?.edition??null,sourceMessageId:quoteResult.quote.lifecycle?.sourceMessageId??null} };
  } catch {
    return { code: "UNAVAILABLE" as const, message: "KV-PDF konnte nicht sicher erstellt werden." };
  }
}


export async function getQuoteFollowupsForTodayAction(){
 noStore();
 try{const auth=await resolveAuthorization();const denied=authorizationFailure(auth);if(denied||!auth.ok)return denied!;
  if(!canReadQuoteFollowups(auth.data))return {code:'FORBIDDEN' as const,message:'KV-Nachfassen ist nicht freigegeben.'};
  const tasks=await withPrivilegedTenantTransaction(auth.data,tx=>readQuoteFollowupTasksForToday(tx,auth.data));
  return {code:'OK' as const,tasks};
 }catch(error){console.error('[QUOTE_FOLLOWUP_READ_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'KV-Nachfassaufgaben konnten nicht geladen werden.'};}
}

/** Preparation reads the existing original and search ports; it never creates or assigns a customer. */
export async function prepareQuoteFromIntakeAction(input:{sourceItemId:string;customerId?:string}){
 noStore();
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['sourceItemId','customerId'].includes(key))||typeof input.sourceItemId!=='string'||!input.sourceItemId||input.customerId!==undefined&&(typeof input.customerId!=='string'||!input.customerId||input.customerId.length>128))return {code:'VALIDATION_ERROR' as const,message:'Original oder gewählter Kunde fehlt.'};
 try{
  const result=await resolveAuthorization(),denied=authorizationFailure(result);if(denied||!result.ok)return denied!;
  const auth=result.data;if(!quoteCommandContext(auth).capabilities.canCreateQuote)return {code:'FORBIDDEN' as const,message:'KV-Vorbereitung ist nicht freigegeben.'};
  const original=await readIntakeAssignment({itemId:input.sourceItemId,mode:'rein'},readCustomerProfile);
  if(original.code!=='OK')return original;
  const source=original.view;
  if(source.restricted)return {code:'FORBIDDEN' as const,message:'Nachrichten-Inhalte benötigen Mails.'};
  const text=source.text;
  if(!text?.trim())return {code:'VALIDATION_ERROR' as const,message:'Lesbarer Originaltext fehlt. Original prüfen oder Text ergänzen.'};
  if(text.length>6000)return {code:'VALIDATION_ERROR' as const,message:'Der Originaltext ist für die schnelle Vorbereitung zu lang. Relevanten Text im bestehenden Eingang bestätigen.'};
  if(input.customerId&&source.customer&&source.customer.id!==input.customerId)return {code:'CONFLICT' as const,message:'Das Original gehört einem anderen Kunden.'};
  const recognition=recognizeIntakeText(text);
  const identifiers={email:recognition.fields.find(field=>field.field==='email')?.value??source.senderAddress??undefined,phone:recognition.fields.find(field=>field.field==='phone')?.value};
  const matches=await findRecognizedCustomers(text,async query=>({code:'OK',customers:await searchOrderIntakeCustomers(auth,{query})}),identifiers);
  if(matches.code!=='OK')return matches;
  const customerId=source.customer?.id??input.customerId??null;
  const customer=customerId?await withPrivilegedTenantTransaction(auth,tx=>readCustomerProfile(tx,auth.tenantId,customerId)):null;
  if(customerId&&!customer)return {code:'NOT_FOUND' as const,message:'Gewählter Kunde ist nicht verfügbar.'};
  const hints=customerId?(await readCustomerListSignals(auth,[customerId],openIntakePredicate())).get(customerId)?.hints.filter(hint=>hint.kind==='agreement').map(hint=>hint.text)??[]:[];
  const specialRequests=[...hints,...(recognition.instructions??[]).map(value=>value.text)];
  return {code:'OK' as const,preparation:{source:{itemId:source.itemId,version:source.version,message:source.channel==='mail'},text,files:source.files,customer:customer?{id:customer.id,name:customer.name}:null,customerQuery:matches.query,proposals:matches.customers.map(value=>({id:value.id,name:value.name,reason:'Treffer im Original: '+matches.query})),recognition,confirmedCustomerHints:hints,specialRequests:specialRequests.length?[...new Set(specialRequests)].join('\n'):null}};
 }catch(error){console.error('[QUOTE_INTAKE_PREPARATION_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'KV-Vorbereitung konnte nicht sicher gelesen werden. Original bleibt erhalten.'};}
}

/** Read-only copy preparation. Saving still uses createQuoteAction and its receipt. */
export async function prepareQuoteCopyAction(input: { kind: 'quote' | 'order'; id: string; customerId: string }) {
  noStore();
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !['kind', 'id', 'customerId'].includes(key))
    || !['quote', 'order'].includes(input.kind)
    || typeof input.id !== 'string' || !input.id || input.id.length > 128
    || typeof input.customerId !== 'string' || !input.customerId || input.customerId.length > 128) {
    return { code: 'VALIDATION_ERROR' as const, message: 'Kopiervorlage und Kunde fehlen.' };
  }
  try {
    const result = await resolveAuthorization();
    const denied = authorizationFailure(result);
    if (denied || !result.ok) return denied!;
    const context = quoteCommandContext(result.data);
    if (!context.capabilities.canCreateQuote || !context.capabilities.canReadQuote) {
      return { code: 'FORBIDDEN' as const, message: 'KV-Kopiervorbereitung ist nicht freigegeben.' };
    }
    let quote;
    let copyPositions: import('@/modules/quotes/public').QuotePositionInput[] | undefined;
    let order: import('@/lib/server/orderCardRead').LiveOrderCard | null = null;
    if (input.kind === 'order') {
      const { getLiveOrderCardAction } = await import('@/app/actions/orders.actions');
      const source = await getLiveOrderCardAction({ orderId: input.id });
      if (source.code !== 'OK') return source;
      order = source.data.card;
      if (order.customerId !== input.customerId) {
        return { code: 'CONFLICT' as const, message: 'Die Kopiervorlage gehört einem anderen Kunden.' };
      }
      if (order.commercialQuote) {
        const sourceQuote = await readQuoteCopyCommand(context, { quoteId: order.commercialQuote.quoteId });
        if (sourceQuote.code !== 'OK') return sourceQuote;
        quote = sourceQuote.quote;
        const commercial=order.commercialQuote;
        copyPositions = commercial.positions.map(actual=>{const position=sourceQuote.positions[actual.position-1];if(!position)throw Error('QUOTE_COPY_POSITION_MISSING');return {...position,quantity:actual.quantity,lineTotalCents:actual.lineTotalCents};});
      }
    } else {
      const source = await readQuoteCopyCommand(context, { quoteId: input.id });
      if (source.code !== 'OK') return source;
      quote = source.quote;
      copyPositions = source.positions;
    }
    if (quote && quote.customerId !== input.customerId) {
      return { code: 'CONFLICT' as const, message: 'Die Kopiervorlage gehört einem anderen Kunden.' };
    }
    const positions = copyPositions ?? order!.items.map(item => ({ name: item.name, quantity: item.quantity, material: item.material,
        surfaceRequested: item.surfaceRequested, unitPriceCents: item.unitPriceCents,
        lineTotalCents: item.unitPriceCents === null || !Number.isSafeInteger(item.quantity * item.unitPriceCents)
          ? null : item.quantity * item.unitPriceCents }));
    return {
      code: 'OK' as const,
      preparation: {
        source: { kind: input.kind, id: input.id, number: order?.orderNumber ?? quote!.quoteNumber,
          version: order?.version ?? quote!.version },
        customerId: input.customerId,
        positions,
        specialRequests: quote?.lifecycle?.specialRequests ?? null,
        previousCalculation: quote?.lifecycle?.calculation ?? null,
        comparison: { plannedHours: order?.commercialQuote ? order.commercialQuote.plannedHours : quote?.lifecycle?.calculation?.hours ?? null,
          actualHours: null, actualHoursReason: 'Ist-Stunden fehlen: keine gebundene aktive Zeiterfassung.',
          orderId: order?.id ?? quote?.linkedOrderId ?? null },
        missing: positions.some(position => position.unitPriceCents === null || position.lineTotalCents === null)
          ? ['Preis'] : [],
      },
    };
  } catch (error) {
    console.error('[QUOTE_COPY_PREPARATION_FAILED]', error);
    return { code: 'UNAVAILABLE' as const, message: 'Kopiervorlage konnte nicht sicher gelesen werden. Es wurde kein KV angelegt.' };
  }
}

export async function prepareQuoteTextChangeAction(input:{quoteId:string;text:string}){
 noStore();
 if(!input||typeof input.quoteId!=='string'||typeof input.text!=='string'||!input.text.trim()||input.text.length>6000)return {code:'VALIDATION_ERROR' as const,message:'KV und Aenderungstext fehlen oder sind zu lang.'};
 try{const auth=await resolveAuthorization(),denied=authorizationFailure(auth);if(denied||!auth.ok)return denied!;
  if(!quoteCommandContext(auth.data).capabilities.canUpdateQuote)return {code:'FORBIDDEN' as const,message:'KV-Aenderung ist nicht freigegeben.'};
  const {prepareQuoteTextChangeCommand}=await import('@/modules/quotes/server-public');
  return prepareQuoteTextChangeCommand(quoteCommandContext(auth.data),input.quoteId,recognizeIntakeText(input.text));
 }catch(error){console.error('[QUOTE_TEXT_PROPOSAL_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'Aenderungsvorschlag konnte nicht sicher gelesen werden. Es wurde nichts geaendert.'};}
}

/** Single copy command; preparation and persistence remain the existing quote ports. */
export async function duplicateQuoteAction(input:{kind:'quote'|'order';id:string;customerId:string;expectedSourceVersion:number;clientEventId:string;dueDate:string}){
 if(!input||!Number.isSafeInteger(input.expectedSourceVersion)||input.expectedSourceVersion<1)return {code:'VALIDATION_ERROR' as const,message:'Version der Kopiervorlage fehlt.'};
 const source=await prepareQuoteCopyAction({kind:input.kind,id:input.id,customerId:input.customerId});
 if(source.code!=='OK')return source;
 if(source.preparation.source.version!==input.expectedSourceVersion)return {code:'CONFLICT' as const,message:'Kopiervorlage wurde geaendert. Aktuellen Stand pruefen.'};
 if(source.preparation.missing.length)return {code:'VALIDATION_ERROR' as const,message:'Kopiervorlage ist unvollstaendig: '+source.preparation.missing.join(', ')};
 const positions=source.preparation.positions.map(position=>{if(position.unitPriceCents===null||position.lineTotalCents===null||position.lineTotalCents===undefined)throw Error('QUOTE_COPY_PRICE_MISSING');return {...position,unitPriceCents:position.unitPriceCents,lineTotalCents:position.lineTotalCents};});
 return createQuoteAction({clientEventId:input.clientEventId,customerId:input.customerId,dueDate:input.dueDate,note:'Kopie von '+source.preparation.source.number+' · Stand '+input.expectedSourceVersion,positions,specialRequests:source.preparation.specialRequests,...(input.kind==='quote'&&source.preparation.previousCalculation?{calculation:source.preparation.previousCalculation}:{})});

}
/** Reread the one confirmed request and its actually booked phases, with the same write authorization. */
export async function readOnsiteQuoteProgressAction(input:{requestId:string;request?:import('@/lib/onsiteQuoteContract').OnsiteQuoteInput}){
 if(!input||typeof input!=='object'||Object.keys(input).some(key=>!['requestId','request'].includes(key))||typeof input.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId))return {code:'VALIDATION_ERROR' as const};
 try{const resolved=await resolveAuthorization();if(!resolved.ok)return {code:'UNAUTHENTICATED' as const};const auth=resolved.data;
  if(!quoteCommandContext(auth).capabilities.canCreateQuote||!hasAuthorizationArea(auth,'eingang'))return {code:'FORBIDDEN' as const};
  const names=['customer','quote','goods','order'] as const;
  const rows=await withPrivilegedTenantTransaction(auth,tx=>readQuoteJournals<{phase?:string;customerId?:string;quoteId?:string;intent?:string;snapshot?:unknown}>(tx,auth,[input.requestId,...names.map(name=>onsitePhaseKey(input.requestId,'proof-'+name))]));
  const phases={customer:false,quote:false,goods:false,order:false};const facts:Partial<Record<typeof names[number],unknown>>={};
  for(const name of names){const proofs=rows.filter(row=>row.clientEventId===onsitePhaseKey(input.requestId,'proof-'+name));if(proofs.length>1||proofs.some(row=>row.payload.phase!==name||!['QUOTE_ONSITE_PHASE_V04','QUOTE_ONSITE_REQUESTED_V04'].includes(row.eventType)))throw Error('ONSITE_PHASE_READ_INVALID');phases[name]=proofs.length===1;if(proofs.length){const request=input.request;const legacy=request?(name==='customer'?request.customer:name==='quote'?request.quote:name==='goods'?{goods:request.goods,quantities:request.quantities}:{evidence:request.evidence,handoverMode:request.handoverMode,paymentMode:request.paymentMode,due:request.confirmedOrderDueDate}):undefined;const snapshot=proofs[0].payload.snapshot??legacy;if(snapshot!==undefined&&createHash('sha256').update(canonicalJson(snapshot)).digest('hex')===proofs[0].payload.intent)facts[name]=snapshot;else if(request)throw Error('ONSITE_PHASE_SNAPSHOT_MISMATCH');}}
  const roots=rows.filter(row=>row.clientEventId===input.requestId);if(roots.length>1||rows.length&&!roots.length||roots.some(row=>row.eventType!=='QUOTE_ONSITE_REQUESTED_V04'))throw Error('ONSITE_ROOT_READ_INVALID');
  let progress:import('@/lib/onsiteQuoteContract').OnsiteQuoteProgress|null=null;
  const quoteId=rows.find(row=>row.clientEventId===onsitePhaseKey(input.requestId,'proof-quote'))?.payload.quoteId;
  if(quoteId){const read=await readQuoteCommand(quoteCommandContext(auth),{quoteId});if(read.code!=='OK')return read;progress={customerId:read.quote.customerId,quoteId:read.quote.quoteId,quoteNumber:read.quote.quoteNumber,customerName:read.quote.customerDisplayName,goodsBooked:phases.goods};}
  return {code:'OK' as const,phases,progress,facts};
 }catch(error){console.error('[ONSITE_PHASE_READ_FAILED]',{name:error instanceof Error?error.name:'unknown'});return {code:'UNAVAILABLE' as const};}
}
/** One confirmed onsite request; every mutation delegates to its existing idempotent writer. */
export async function receiveOnsiteQuoteAction(input:import("@/lib/onsiteQuoteContract").OnsiteQuoteInput){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!input||!uuid.test(input.clientRequestId)||!input.customer||!['NEW','EXISTING'].includes(input.customer.mode)||!input.quote||Object.hasOwn(input.quote,'source')||typeof input.evidence!=='string'||input.evidence.trim().length<3||!Array.isArray(input.quantities)||!input.quantities.length||input.quantities.some(row=>!Number.isSafeInteger(row.position)||row.position<1||!Number.isSafeInteger(row.received)||row.received<0)||new Set(input.quantities.map(row=>row.position)).size!==input.quantities.length)return {code:'VALIDATION_ERROR' as const,message:'Kunde, KV, Zusage und tatsaechlich angenommene Mengen vollstaendig pruefen.'};
 const phase=(name:string)=>onsitePhaseKey(input.clientRequestId,name);
 const digest=(value:unknown)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
 const snapshots={customer:input.customer,quote:input.quote,goods:{goods:input.goods,quantities:input.quantities},order:{evidence:input.evidence,handoverMode:input.handoverMode,paymentMode:input.paymentMode,due:input.confirmedOrderDueDate}};
 const hashes={customer:digest(snapshots.customer),quote:digest(snapshots.quote),goods:digest(snapshots.goods),order:digest(snapshots.order)};
 let customerId:string|undefined,quoteId:string|undefined;
 try{
  const authResult=await resolveAuthorization(),denied=authorizationFailure(authResult);if(denied||!authResult.ok)return denied!;
  const auth=authResult.data;
  if(!quoteCommandContext(auth).capabilities.canCreateQuote||!hasAuthorizationArea(auth,'eingang'))return {code:'FORBIDDEN' as const,message:'Vor-Ort-Erfassung benoetigt KV und Eingang.'};
  const reserved=await withPrivilegedTenantTransaction(auth,async tx=>{
   await tx.execute((await import('drizzle-orm')).sql`SELECT pg_advisory_xact_lock(hashtextextended(${'onsite:'+auth.tenantId+':'+input.clientRequestId},0))`);
   const prior=await readQuoteJournal<{intent:string}>(tx,auth,input.clientRequestId);
   if(prior.length)return prior.length===1&&prior[0].eventType==='QUOTE_ONSITE_REQUESTED_V04';
   await appendQuoteJournal(tx,auth,{id:phase('request-event'),type:'QUOTE_ONSITE_REQUESTED_V04',clientEventId:input.clientRequestId,correlationId:input.clientRequestId,version:null,description:'Vor-Ort-Erfassung bestaetigt',payload:{quoteRequestId:phase('quote'),orderRequestId:phase('order'),customerRequestId:phase('customer')}});return true;
  });
  if(!reserved)return {code:'CONFLICT' as const,message:'Diese Erfassungskennung wurde bereits mit anderen Eingaben verwendet. Nicht erneut buchen.'};
  type Proof={intent:string;customerId?:string;quoteId?:string;quoteNumber?:string;customerName?:string};
  const readProof=async(name:keyof typeof hashes)=>withPrivilegedTenantTransaction(auth,async tx=>{const rows=await readQuoteJournal<Proof>(tx,auth,phase('proof-'+name));if(rows.length>1)throw Error('ONSITE_PHASE_AMBIGUOUS');const proof=rows[0]?.payload;if(proof&&proof.intent!==hashes[name])throw Error('ONSITE_BOOKED_PHASE_CHANGED');return proof;});
  const customerProof=await readProof('customer');await readProof('quote');await readProof('goods');await readProof('order');
  const finishProof=async(name:keyof typeof hashes,data:Omit<Proof,'intent'>)=>withPrivilegedTenantTransaction(auth,async tx=>{const {sql}=await import('drizzle-orm');await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'onsite-proof:'+auth.tenantId+':'+input.clientRequestId+':'+name},0))`);const rows=await readQuoteJournal<Proof>(tx,auth,phase('proof-'+name));if(rows.length){if(rows.length!==1||rows[0].payload.intent!==hashes[name])throw Error('ONSITE_BOOKED_PHASE_CHANGED');return;}await appendQuoteJournal(tx,auth,{id:phase('proof-event-'+name),type:'QUOTE_ONSITE_PHASE_V04',clientEventId:phase('proof-'+name),correlationId:input.clientRequestId,version:null,description:'Vor-Ort-Teilphase gebucht',payload:{phase:name,intent:hashes[name],snapshot:snapshots[name],...data}});});
  if(customerProof?.customerId)customerId=customerProof.customerId;else if(input.customer.mode==='EXISTING')customerId=input.customer.customerId;
  else{
   const {createCustomerAction}=await import('@/app/actions/customers.actions');
   const customer=await createCustomerAction({...input.customer.data,clientEventId:phase('customer')});
   if(customer.code!=='OK')return {...customer,phase:'customer',requestId:input.clientRequestId};
   customerId=customer.receipt.customerId;
  }
  await finishProof('customer',{customerId});
  const savedQuote=await readQuoteCreateReceiptAction({...input.quote,customerId,clientEventId:phase('quote')});
  // A completed outcome is recovered before any new phase; the root intent was checked above.
  if(savedQuote.code==='OK'){
   const completed=await readQuoteConversionReceiptAction({quoteId:savedQuote.quote.quoteId,clientEventId:phase('order')});
   if(completed.code==='OK'){await finishProof('order',{customerId,quoteId:savedQuote.quote.quoteId});return {...completed,replayed:true,phase:'complete' as const,quoteId:completed.quote.quoteId,customerId,requestId:input.clientRequestId};}
   if(completed.code!=='NOT_FOUND')return {...completed,phase:'readback',requestId:input.clientRequestId};
  }
  const created=savedQuote.code==='OK'?savedQuote:await createQuoteAction({...input.quote,customerId,clientEventId:phase('quote')});
  if(created.code!=='OK')return {...created,phase:'quote',customerId,requestId:input.clientRequestId};
  quoteId=created.quote.quoteId;
  const progress={customerId:customerId!,quoteId,quoteNumber:created.quote.quoteNumber,customerName:created.quote.customerDisplayName,goodsBooked:created.quote.lifecycle?.goods?.some(row=>row.id===phase('goods-id'))===true};
  await finishProof('quote',progress);
  if(input.quantities.length!==created.quote.positions.length)return {code:'VALIDATION_ERROR' as const,message:'Jede KV-Position braucht ihre angenommene Menge.',quoteId,customerId,progress,requestId:input.clientRequestId};
  const goods={...input.goods,id:phase('goods-id'),clientKey:phase('goods-key'),clientEventId:phase('goods'),quoteId,expectedQuoteVersion:1,quantities:created.quote.positions.map(position=>{const quantity=input.quantities.find(row=>row.position===position.position);return {itemId:position.id,expected:position.quantity,received:quantity?.received===position.quantity?null:quantity?.received,confirmed:quantity?.received===position.quantity,note:quantity?.note};})};
  const {saveGoodsReceiptAction}=await import('@/app/actions/eingang.actions');
  const received=created.quote.lifecycle?.goods?.some(row=>row.id===phase('goods-id'))?{code:'OK' as const}:await saveGoodsReceiptAction(goods);
  if(received.code!=='OK')return {...received,phase:'goods',quoteId,customerId,progress,requestId:input.clientRequestId};
  await finishProof('goods',progress);progress.goodsBooked=true;
  const accepted=await changeQuoteLifecycleAction({action:'accept',quoteId,clientEventId:phase('accept'),expectedVersion:1,edition:1,evidence:input.evidence},{onsiteGoodsReceiptId:phase('goods-id')});
  if(accepted.code!=='OK')return {...accepted,phase:'acceptance',quoteId,customerId,progress,requestId:input.clientRequestId};
  const result=await convertQuoteToOrderAction({quoteId,clientEventId:phase('order'),expectedVersion:2,confirmedAward:true,confirmedOrderDueDate:input.confirmedOrderDueDate,handoverMode:input.handoverMode,paymentMode:input.paymentMode,goodsReceiptId:phase('goods-id')});
  if(result.code==='OK')await finishProof('order',progress);
  return {...result,progress,phase:result.code==='OK'?'complete':'order',quoteId,customerId,requestId:input.clientRequestId};
 }catch(error){console.error('[QUOTE_ONSITE_REQUEST_FAILED]',error);return {code:error instanceof Error&&error.message==='ONSITE_BOOKED_PHASE_CHANGED'?'CONFLICT' as const:'UNAVAILABLE' as const,message:'Ausgang nicht sicher bestaetigt. Eingaben und Erfassungskennung behalten; gespeicherte Zwischenschritte bleiben nachvollziehbar.',customerId,quoteId,requestId:input.clientRequestId};}
}

/** Operational workshop projection: no prices/calculation/PDFs leave this purpose-bound reader. */
export async function readWorkshopQuoteGoodsAction(){
 noStore();
 try{const auth=await resolveAuthorization(),denied=authorizationFailure(auth);if(denied||!auth.ok)return denied!;
  if(!auth.data.permissions.includes('perm_view_leitstand'))return {code:'FORBIDDEN' as const,message:'KV-Ware ist nicht freigegeben.'};
  const context={tenantId:auth.data.tenantId,userId:auth.data.userId,capabilities:{canReadQuote:true,canCreateQuote:false,canUpdateQuote:false,canConvertQuote:false}};
  const result=await listOpenQuotesCommand(context);
  if(result.code!=='OK')return result;
  const today=berlinCalendarDay();
  const quotes=result.quotes.flatMap(quote=>{const life=quote.lifecycle;if(quote.linkedOrderId||!life)return [];
   const goods=life.goods?.filter(row=>!row.orderId)??[],accepted=life.acceptedEdition===life.edition&&Boolean(life.acceptedAt),expired=Boolean(quote.validUntil&&quote.validUntil<today),conditional=life.conditional?.edition===life.edition;
   if(!goods.length&&(!accepted||expired||conditional))return [];
   const blocked=life.stage==='abgesagt'||!accepted||expired||conditional;
   return [{id:quote.quoteId,number:quote.quoteNumber,customer:quote.customerDisplayName,parts:quote.positions.map(row=>row.quantity+' × '+row.name).join(' / '),due:quote.dueDate,kind:goods.length?(blocked?'blocked' as const:'here' as const):'expected' as const,locations:goods.map(row=>row.location).filter(Boolean),reason:life.stage==='abgesagt'?'KV abgesagt':expired?'Gültigkeit abgelaufen':conditional?'Zusage mit Vorbehalt':!accepted?'Zusage fehlt':goods.length?'Auftrag noch nicht angelegt':null}];
  });
  return {code:'OK' as const,quotes,limited:result.quotes.length===100};
 }catch(error){console.error('[WORKSHOP_QUOTE_GOODS_READ_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'KV-Ware konnte nicht sicher gelesen werden.'};}
}


/** Operational targets are bounded by the real reply's assigned customer; no financial projection. */
export async function readQuoteReplyTargetsAction(input:{sourceItemId:string;quoteId?:string}){
 noStore();
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['sourceItemId','quoteId'].includes(key))||typeof input.sourceItemId!=='string'||!uuid.test(input.sourceItemId)||input.quoteId!==undefined&&(typeof input.quoteId!=='string'||!uuid.test(input.quoteId)))return {code:'VALIDATION_ERROR' as const,message:'Originalantwort fehlt.'};
 try{
  const authorized=await resolveAuthorization(),denied=authorizationFailure(authorized);if(denied||!authorized.ok)return denied!;
  const messages=await readIntakeMessages('alle',input.sourceItemId);if(messages.code!=='OK')return messages;
  const source=messages.messages.find(row=>row.id===input.sourceItemId);if(!source)return {code:'NOT_FOUND' as const,message:'Originalantwort ist nicht verfügbar.'};
  if(!source.customerId)return {code:'VALIDATION_ERROR' as const,message:'Ordne die Antwort zuerst einem Kunden zu.'};
  const context=quoteOperationContext(authorized.data);
  const result=input.quoteId?await readQuoteCommand(context,{quoteId:input.quoteId}):await listOpenQuotesCommand(context);if(result.code!=='OK')return result;
  const quotes='quotes'in result?result.quotes:[result.quote];
  if(input.quoteId&&quotes[0].customerId!==source.customerId)return {code:'CONFLICT' as const,message:'Nachricht und KV gehören nicht zum selben Kunden.'};
  return {code:'OK' as const,source:{id:source.id,version:source.version,channel:source.channel,text:source.text,customer:source.customerName??'Name fehlt',openConcerns:source.openConcerns,files:source.files??[]},targets:quotes.filter(q=>q.customerId===source.customerId&&!q.linkedOrderId&&q.lifecycle?.stage!=='abgesagt').map(q=>({id:q.quoteId,number:q.quoteNumber,customer:q.customerDisplayName,parts:q.positions.map(row=>row.quantity+' × '+row.name).join(' / ')})),limited:!input.quoteId&&quotes.length===100};
 }catch(error){console.error('[QUOTE_REPLY_TARGETS_FAILED]',error instanceof Error?error.name:'UnknownError');return {code:'UNAVAILABLE' as const,message:'KVs zu dieser Antwort konnten nicht sicher gelesen werden.'};}
}


export async function undoQuoteConversionAction(input:{quoteId:string;expectedVersion:number;clientEventId:string;reason:string}){
 try{const authorized=await resolveAuthorization(),denied=authorizationFailure(authorized);if(denied||!authorized.ok)return denied!;
  const result=await reverseQuoteConversionCommand(quoteOperationContext(authorized.data),input);
  if(result.code!=='OK')return result;
  for(const route of ['/','/orders','/warendurchlauf','/nachrichten'])revalidatePath(route);
  return {...result,quote:quoteForUi(result.quote,quoteCommandContext(authorized.data).capabilities.canReadQuote)};
 }catch(error){console.error('[QUOTE_UNDO_ACTION_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const,message:'Rücknahme ist ungeklärt. Mit derselben Kennung erneut prüfen.'};}
}
