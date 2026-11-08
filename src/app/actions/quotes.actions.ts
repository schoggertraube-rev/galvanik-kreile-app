"use server";

import {createHash} from "node:crypto";
import {appendQuoteJournal,readQuoteJournal} from "@/lib/server/quoteJournalPort";

import { renderToBuffer } from "@react-pdf/renderer";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { createQuotePdfDocument } from "@/lib/pdf/QuoteDocument";
import {
  getAuthorizationActionGrants,
  hasAuthorizationArea,
  resolveAuthorization,
  type AuthorizationSnapshot,
} from "@/lib/server/authorization";
import { readCustomerSummary,readCustomerListSignals } from "@/lib/server/customerSummaryRead";
import {searchOrderIntakeCustomers} from '@/lib/server/orderIntakeRead';
import {recognizeIntakeText} from '@/lib/server/intakeTextRecognition';
import {findRecognizedCustomers} from '@/modules/eingang/public';
import {withPrivilegedTenantTransaction} from "@/lib/server/privilegedDb";
import { createOrderIntake } from "@/lib/server/commands/orderIntakeCommand";
import { readOrderIntakeReceipt } from "@/lib/server/orderIntakeRead";
import {recordIntakeQuoteEffect,bindQuoteGoodsReceiptToCreatedOrder,writeQuoteGoodsReceiptInTransaction,recordIntakeTaskEffect,readIntakeAssignment} from '@/modules/eingang/server-public';
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

function quoteFollowupBinding(auth:AuthorizationSnapshot):QuoteFollowupBinding{
 return async(tx,{quote,action,phase})=>{
  const life=quote.lifecycle;if(!life)throw Error('QUOTE_FOLLOWUP_LIFECYCLE_MISSING');
  const deps={effect:(transaction:typeof tx,snapshot:AuthorizationSnapshot,effect:Parameters<typeof recordIntakeTaskEffect>[2])=>recordIntakeTaskEffect(transaction,snapshot,effect,readCustomerProfile)};
  const request={quoteId:quote.quoteId,quoteNumber:quote.quoteNumber,customerName:quote.customerDisplayName,edition:life.edition,sentEdition:life.sentEdition,dueDate:null as string|null,reason:action==='accept'?'KV zugesagt':action==='reject'?'KV abgesagt':action==='conditional'?'KV mit Vorbehalt · Anpassung erforderlich':'Neue KV-Fassung'};
  if(phase==='before'){
   if(action==='sent'&&life.sentEdition!==null&&life.sentEdition!==life.edition)await syncQuoteFollowupTask(tx,auth,{...request,edition:life.sentEdition,action:'cancel'},deps);
   return null;
  }
  if(action!=='sent'||life.acceptedEdition===life.edition){await syncQuoteFollowupTask(tx,auth,{...request,action:'cancel'},deps);return null;}
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
    const result=await changeQuoteLifecycleCommand(quoteCommandContext(auth.data),input,(tx,source)=>recordIntakeQuoteEffect(tx,auth.data,source),quoteFollowupBinding(auth.data),{actualMail:options?.actualMail===true,onsiteGoodsReceiptId:options?.onsiteGoodsReceiptId});
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
  const prepared = await prepareQuoteConversionCommand(commandContext, input,{planOnly:true,pendingGoodsId:newGoods?.id,pendingQuantities:newGoods?.quantities});
  if (prepared.code !== "OK") return prepared;

  let goods:Awaited<ReturnType<typeof bindQuoteGoodsReceiptToCreatedOrder>>|null=null;
  let boundFailure:{code:'VALIDATION_ERROR'|'CONFLICT'|'UNAVAILABLE'|'FORBIDDEN'|'NOT_FOUND';message:string}|null=null;
  const saveGoods=async(tx:Parameters<typeof bindQuoteGoodsReceiptToCreatedOrder>[0],auth:AuthorizationSnapshot)=>{
    if(!newGoods)return;
    const saved=await writeQuoteGoodsReceiptInTransaction(tx,auth,newGoods);
    if(saved.code!=='OK'){boundFailure={code:saved.code==='UNAUTHENTICATED'?'FORBIDDEN':saved.code,message:saved.message};throw Error('QUOTE_NEW_GOODS_FAILED');}
  };
  const check=async(tx:Parameters<typeof bindQuoteGoodsReceiptToCreatedOrder>[0],planOnly:boolean)=>{
    const result=await prepareQuoteConversionCommand(commandContext,input,{transaction:tx,planOnly,pendingGoodsId:newGoods?.id,pendingQuantities:newGoods?.quantities});
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
    return { code: "OK" as const, pdf, quoteNumber: quoteResult.quote.quoteNumber,document:{id:quoteResult.quote.quoteId,customerId:quoteResult.quote.customerId,linkedOrderId:quoteResult.quote.linkedOrderId,version:quoteResult.quote.version,edition:quoteResult.quote.lifecycle?.edition??null,sourceMessageId:quoteResult.quote.lifecycle?.sourceMessageId??null} };
  } catch {
    return { code: "UNAVAILABLE" as const, message: "KV-PDF konnte nicht sicher erstellt werden." };
  }
}


export async function getQuoteFollowupsForTodayAction(){
 noStore();
 try{const auth=await resolveAuthorization();const denied=authorizationFailure(auth);if(denied||!auth.ok)return denied!;
  if(!quoteCommandContext(auth.data).capabilities.canReadQuote)return {code:'FORBIDDEN' as const,message:'KV-Nachfassen ist nicht freigegeben.'};
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
  const hints=customerId?(await readCustomerListSignals(auth,[customerId])).get(customerId)?.hints.filter(hint=>hint.kind==='agreement').map(hint=>hint.text)??[]:[];
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

/** One confirmed onsite request; every mutation delegates to its existing idempotent writer. */
export async function receiveOnsiteQuoteAction(input:{
 clientRequestId:string;
 customer:{mode:'EXISTING';customerId:string}|{mode:'NEW';data:Omit<import('@/modules/customers/public').CreateCustomerInput,'clientEventId'>};
 quote:Omit<CreateQuoteInput,'clientEventId'|'customerId'|'source'>;
 evidence:string;
 goods:Record<string,unknown>;
 quantities:Array<{position:number;received:number;note:string|null}>;
 handoverMode:'pickup'|'shipping';paymentMode:'abholung'|'vorkasse'|'rechnung';confirmedOrderDueDate:string;
}){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!input||!uuid.test(input.clientRequestId)||!input.customer||!['NEW','EXISTING'].includes(input.customer.mode)||!input.quote||Object.hasOwn(input.quote,'source')||typeof input.evidence!=='string'||input.evidence.trim().length<3||!Array.isArray(input.quantities)||!input.quantities.length||input.quantities.some(row=>!Number.isSafeInteger(row.position)||row.position<1||!Number.isSafeInteger(row.received)||row.received<0)||new Set(input.quantities.map(row=>row.position)).size!==input.quantities.length)return {code:'VALIDATION_ERROR' as const,message:'Kunde, KV, Zusage und tatsaechlich angenommene Mengen vollstaendig pruefen.'};
 const phase=(name:string)=>{const hex=createHash('sha256').update('kreile-onsite:'+input.clientRequestId+':'+name).digest('hex');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-5'+hex.slice(13,16)+'-8'+hex.slice(17,20)+'-'+hex.slice(20,32);};
 const intent=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 let customerId:string|undefined,quoteId:string|undefined;
 try{
  const authResult=await resolveAuthorization(),denied=authorizationFailure(authResult);if(denied||!authResult.ok)return denied!;
  const auth=authResult.data;
  if(!quoteCommandContext(auth).capabilities.canCreateQuote||!hasAuthorizationArea(auth,'eingang'))return {code:'FORBIDDEN' as const,message:'Vor-Ort-Erfassung benoetigt KV und Eingang.'};
  const reserved=await withPrivilegedTenantTransaction(auth,async tx=>{
   await tx.execute((await import('drizzle-orm')).sql`SELECT pg_advisory_xact_lock(hashtextextended(${'onsite:'+auth.tenantId+':'+input.clientRequestId},0))`);
   const prior=await readQuoteJournal<{intent:string}>(tx,auth,input.clientRequestId);
   if(prior.length)return prior.length===1&&prior[0].eventType==='QUOTE_ONSITE_REQUESTED_V04'&&prior[0].payload.intent===intent;
   await appendQuoteJournal(tx,auth,{id:phase('request-event'),type:'QUOTE_ONSITE_REQUESTED_V04',clientEventId:input.clientRequestId,correlationId:input.clientRequestId,version:null,description:'Vor-Ort-Erfassung bestaetigt',payload:{intent,quoteRequestId:phase('quote'),orderRequestId:phase('order'),customerRequestId:phase('customer')}});return true;
  });
  if(!reserved)return {code:'CONFLICT' as const,message:'Diese Erfassungskennung wurde bereits mit anderen Eingaben verwendet. Nicht erneut buchen.'};
  if(input.customer.mode==='EXISTING')customerId=input.customer.customerId;
  else{
   const {createCustomerAction}=await import('@/app/actions/customers.actions');
   const customer=await createCustomerAction({...input.customer.data,clientEventId:phase('customer')});
   if(customer.code!=='OK')return {...customer,phase:'customer',requestId:input.clientRequestId};
   customerId=customer.receipt.customerId;
  }
  const savedQuote=await readQuoteCreateReceiptAction({...input.quote,customerId,clientEventId:phase('quote')});
  // A completed outcome is recovered before any new phase; the root intent was checked above.
  if(savedQuote.code==='OK'){
   const completed=await readQuoteConversionReceiptAction({quoteId:savedQuote.quote.quoteId,clientEventId:phase('order')});
   if(completed.code==='OK')return {...completed,replayed:true,phase:'complete' as const,quoteId:completed.quote.quoteId,customerId,requestId:input.clientRequestId};
   if(completed.code!=='NOT_FOUND')return {...completed,phase:'readback',requestId:input.clientRequestId};
  }
  const created=await createQuoteAction({...input.quote,customerId,clientEventId:phase('quote')});
  if(created.code!=='OK')return {...created,phase:'quote',customerId,requestId:input.clientRequestId};
  quoteId=created.quote.quoteId;
  if(input.quantities.length!==created.quote.positions.length)return {code:'VALIDATION_ERROR' as const,message:'Jede KV-Position braucht ihre angenommene Menge.',quoteId,customerId,requestId:input.clientRequestId};
  const goods={...input.goods,id:phase('goods-id'),clientKey:phase('goods-key'),clientEventId:phase('goods'),quoteId,expectedQuoteVersion:1,quantities:created.quote.positions.map(position=>{const quantity=input.quantities.find(row=>row.position===position.position);return {itemId:position.id,expected:position.quantity,received:quantity?.received===position.quantity?null:quantity?.received,confirmed:quantity?.received===position.quantity,note:quantity?.note};})};
  const {saveGoodsReceiptAction}=await import('@/app/actions/eingang.actions');
  const received=created.quote.lifecycle?.goods?.some(row=>row.id===phase('goods-id'))?{code:'OK' as const}:await saveGoodsReceiptAction(goods);
  if(received.code!=='OK')return {...received,phase:'goods',quoteId,customerId,requestId:input.clientRequestId};
  const accepted=await changeQuoteLifecycleAction({action:'accept',quoteId,clientEventId:phase('accept'),expectedVersion:1,edition:1,evidence:input.evidence},{onsiteGoodsReceiptId:phase('goods-id')});
  if(accepted.code!=='OK')return {...accepted,phase:'acceptance',quoteId,customerId,requestId:input.clientRequestId};
  const result=await convertQuoteToOrderAction({quoteId,clientEventId:phase('order'),expectedVersion:2,confirmedAward:true,confirmedOrderDueDate:input.confirmedOrderDueDate,handoverMode:input.handoverMode,paymentMode:input.paymentMode,goodsReceiptId:phase('goods-id')});
  return {...result,phase:result.code==='OK'?'complete':'order',quoteId,customerId,requestId:input.clientRequestId};
 }catch(error){console.error('[QUOTE_ONSITE_REQUEST_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'Ausgang nicht sicher bestaetigt. Eingaben und Erfassungskennung behalten; gespeicherte Zwischenschritte bleiben nachvollziehbar.',customerId,quoteId,requestId:input.clientRequestId};}
}
