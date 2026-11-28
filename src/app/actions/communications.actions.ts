"use server";

import {after} from 'next/server';
import {observeAction,subjectForAction} from '@/modules/logging/server-public';
import {readErkennungsEinstellungenInTransaction,readLoggingSettings,readPageReadSettings} from '@/modules/fundament/server-public';
import {storeQuoteMailOriginal,readQuoteMailOriginal} from '@/lib/server/communicationOriginalPort';
import {quoteOperationContext} from '@/lib/server/quoteAuthorization';
import {readQuoteCommand} from '@/modules/quotes/server-public';
import {lockQuoteDeliverySnapshot} from "@/modules/quotes/server-public";
import {freezeStorageDeadline} from '@/lib/server/storageDeadline';
import {createHash,randomUUID} from "node:crypto";
import {readCommunicationDocumentReceipt,readLegacyQuoteReplacement,type LegacyQuoteReplacement,applyRecoveredInvoiceMailEffects,readPreparedInvoiceTransportOriginal,readInvoiceMailCohort,assertInvoiceMailCohort,qualifyInvoiceResend,assertInvoiceNotSent,invoiceMailDocumentFromSource,invoiceMailMembers,lockInvoiceMailDocuments,type CommunicationDocument} from "@/lib/server/communicationDocumentPort";
import { unstable_noStore as noStore } from "next/cache";
import { resolveAuthorization,hasAuthorizationArea,canTransportInvoiceDocument,type AuthorizationSnapshot } from "@/lib/server/authorization";
import {
  attachInboxMessage,
  readCommunicationInbox,
  readLinkedCommunicationMessages,
  sendCommunicationMail as sendCommunicationMailPort,
  readCommunicationTargetInTransaction,
  readCommunicationImportContext,
} from "@/lib/server/communicationPort";
import { readMicrosoftGraphConfigurationStatus } from "@/lib/server/microsoftGraph";
import { changeQuoteLifecycleAction, readQuotePdfAction } from "@/app/actions/quotes.actions";
import {linkImportedMail,readLinkedIntakeMails,readIntakeMailImportReceipt} from '@/modules/eingang/server-public';
import {readCustomerProfile} from '@/modules/customers/server-public';
import {sql} from 'drizzle-orm';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readInvoicePdf} from '@/lib/server/invoiceRead';
import {readCollectionReminderReceipt,applyCollectionReminderMailEffects,assertCollectionReminderCurrent,collectionReminderIntent,type CollectionReminderMeta} from '@/lib/server/collectionReminderPort';
import {INVOICE_DELIVERY_COPY,COLLECTION_REMINDER_COPY,CUSTOMER_COLLECTION_COPY,PAGE_READ_COPY} from '@/ui/situationCatalog';
import {recordInvoiceManualHandover,InvoiceManualHandoverConflict,recordInvoiceMailRemainderFailure,freezeInvoiceMailRequest,readInvoiceMailRequestSnapshot,readInvoiceMailOpenRemainder} from '@/lib/server/communicationDocumentPort';
import {synchronizeInvoiceMailRemainderTask} from '@/modules/tasks/server-public';

type TargetInput = { targetType: "CUSTOMER" | "ORDER"; targetId: string };

async function authorization() {
  return resolveAuthorization();
}

export async function getMicrosoftGraphStatusAction() {
  noStore();
  const authorizationResult = await authorization();
  if (!authorizationResult.ok) return { code: "UNAUTHENTICATED" as const, message: authorizationResult.message };
  const auth = authorizationResult.data;
  if (!auth.areas?.includes("mails")) return { code: "FORBIDDEN" as const, message: "Microsoft 365 ist für dieses Profil nicht freigegeben." };
  return readMicrosoftGraphConfigurationStatus().code === "READY"
    ? { code: "OK" as const }
    : { code: "IN_KLAERUNG" as const, message: "Microsoft 365 · In Klärung. Die Preview-Zugangsdaten sind noch nicht vollständig verbunden." };
}

export async function listOutlookInboxAction(input?: TargetInput) {
  noStore();
  const authorizationResult = await authorization();
  if (!authorizationResult.ok) return { code: "UNAUTHENTICATED" as const, message: authorizationResult.message };
  if(!input)return readCommunicationInbox(authorizationResult.data);
  const legacy=await readLinkedCommunicationMessages(authorizationResult.data,input);
  if(legacy.code!=='OK')return legacy;
  const canonical=await readLinkedIntakeMails(authorizationResult.data,input);
  if(canonical.code!=='OK')return canonical;
  const unique=new Map([...legacy.data,...canonical.data].map(message=>[message.id,message]));
  return {code:'OK' as const,data:[...unique.values()].sort((a,b)=>{const left=a.receivedAt===null?NaN:Date.parse(a.receivedAt),right=b.receivedAt===null?NaN:Date.parse(b.receivedAt);return !Number.isFinite(left)?!Number.isFinite(right)?0:1:!Number.isFinite(right)?-1:right-left;})};
}

export async function attachOutlookMailAction(input: TargetInput & { graphMessageId: string }) {
 return observeAction('attachOutlookMailAction',subjectForAction('attachOutlookMailAction',input),async()=>{
  const authorizationResult = await authorization();
  if (!authorizationResult.ok) return { code: "UNAUTHENTICATED" as const, message: authorizationResult.message };
  const imported=await importOutlookMailAction(input?.graphMessageId,{deferDispatchReply:true});
  if(imported.code!=='OK')return imported;
  const linked=await linkImportedMail(authorizationResult.data,{itemId:imported.itemId,targetType:input.targetType,targetId:input.targetId},readCommunicationTargetInTransaction,readCustomerProfile);
  if(linked.code!=='OK')return linked;
  const correspondence=await attachInboxMessage(authorizationResult.data,input,imported.message);
  if(correspondence.code==='OK')await withDispatchReply(authorizationResult.data,imported);
  return correspondence.code==='OK'?{...correspondence,data:{...correspondence.data,attachmentsImported:imported.originalCount,attachmentsSkipped:imported.filteredAttachments}}:correspondence;

 },readLoggingSettings);
}

async function confirmQuoteDelivery(input:{clientRequestId:string},document:Extract<CommunicationDocument,{kind:'QUOTE'}>,data:Awaited<ReturnType<typeof sendCommunicationMail>> & {code:'OK'}){
 const marked=await changeQuoteLifecycleAction({action:'sent',quoteId:document.id,clientEventId:input.clientRequestId,expectedVersion:document.version,edition:document.edition,channel:'mail',evidence:'Versandbeleg '+data.data.threadId+' · PDF SHA-256 '+document.sha256},{actualMail:true});
 const current=marked.code==='OK'?marked.quote.lifecycle:null;
 const notices=marked.code==='OK'?[...(marked.notices??[])]:[];
 if(current&&current.edition!==document.edition&&!notices.some(value=>value.includes('aktuelle Fassung')))notices.push('E-Mail mit Fassung '+document.edition+' gesendet · aktuelle Fassung '+current.edition+(current.sentEdition===current.edition?' bleibt bereits versendet.':' ist noch nicht versendet.'));
 return marked.code==='OK'?{...data,notice:notices.join(' ')||undefined}:{...data,notice:'E-Mail mit KV '+document.number+' · Fassung '+document.edition+' wurde versendet. KV-Stand konnte nicht angepasst werden: '+marked.message+' Nicht erneut senden.'};
}

type CustomerMailInput=TargetInput & {
 clientRequestId:string;subject:string;body:string;confirmedResend?:true;singleInvoice?:true;expectedInvoiceIds?:string[];attachment?:{kind:'QUOTE'|'INVOICE';documentId:string};collectionReminder?:{stage:'E1'|'E2'|'E4';handover:'pickup'|'shipping';dueDate:string;clientKey?:string};
};
type CustomerMailResult=Awaited<ReturnType<typeof sendCommunicationMail>>|Awaited<ReturnType<typeof confirmQuoteDelivery>>|{code:'UNAUTHENTICATED';message:string};
function validExpectedInvoiceIds(input:CustomerMailInput){
 return (input.singleInvoice===undefined||(input.singleInvoice===true&&input.expectedInvoiceIds?.length===1))&&Array.isArray(input.expectedInvoiceIds)&&input.expectedInvoiceIds.length>0&&input.expectedInvoiceIds.length<=101&&new Set(input.expectedInvoiceIds).size===input.expectedInvoiceIds.length&&input.expectedInvoiceIds.every(id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))&&input.attachment!==undefined&&input.expectedInvoiceIds.includes(input.attachment.documentId);
}
function invoiceRemainderKey(tenantId:string,requestId:string,anchor:string){
 const bytes=createHash('sha256').update('invoice-mail-remainder:'+tenantId+':'+requestId.toLowerCase()+':'+anchor).digest();bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
 const h=bytes.subarray(0,16).toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

/** PL20.11.01:02: acknowledged groups continue through this same sender.
 * A pending group never enters this loop; every child retains its own N5 proof.
 * PL20.11.03:10/A18: this is one explicit user send, not autonomous contact.
 * A customer's automatic-mail opt-out does not cancel that explicit request.
 * PL22.11.02:51: stop at the tenant's per-turn invoice count; retain complete
 * immutable groups and the same source-bound remainder task for later turns. */
export async function sendCustomerMailAction(input:CustomerMailInput):Promise<CustomerMailResult>{
 if(input?.attachment?.kind!=='INVOICE'||input.confirmedResend||input.singleInvoice)return sendCustomerMailGroup(input);
 if(!validExpectedInvoiceIds(input)||typeof input.subject!=='string'||typeof input.body!=='string'||typeof input.clientRequestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.clientRequestId))return sendCustomerMailGroup(input);
 const authorizationResult=await authorization();
 if(!authorizationResult.ok)return {code:'UNAUTHENTICATED',message:authorizationResult.message};
 const auth=authorizationResult.data;
 if(!canTransportInvoiceDocument(auth))return sendCustomerMailGroup(input);
 let turnLimit:number;
 try{turnLimit=(await readPageReadSettings(auth)).invoiceMailBatchLimit;}
 catch(error){console.error('[INVOICE_MAIL_SETTINGS_FAILED]',{name:error instanceof Error?error.name:'UnknownError'});return {code:'UNAVAILABLE',message:PAGE_READ_COPY.settingsPending};}
 if(input.expectedInvoiceIds!.length<Math.min(turnLimit,101))return sendCustomerMailGroup(input);
 const markerId=invoiceRemainderKey(auth.tenantId,input.clientRequestId,'followup');
 const request={markerId,requestId:input.clientRequestId.toLowerCase(),invoiceId:input.attachment.documentId,expectedIds:input.expectedInvoiceIds!,unreservedOnly:input.targetType==='ORDER'};
 let snapshot:Awaited<ReturnType<typeof freezeInvoiceMailRequest>>;
 let prior:Awaited<ReturnType<typeof readCommunicationDocumentReceipt>>;
 try{
  prior=await readCommunicationDocumentReceipt(auth,input,input.attachment.documentId);
  if((prior.code==='OK'||prior.code==='PENDING')&&prior.document.kind==='INVOICE'){
   const frozen=await withPrivilegedTenantTransaction(auth,tx=>readInvoiceMailRequestSnapshot(tx,auth,request));
   // A legacy immutable group has no remainder request: preserve it in full.
   if(!frozen)return sendCustomerMailGroup(input,undefined,undefined,prior);
   snapshot=frozen;
  }else snapshot=await withPrivilegedTenantTransaction(auth,tx=>freezeInvoiceMailRequest(tx,auth,request));
 }catch(error){if(error instanceof Error&&['INVOICE_MAIL_REQUEST_LIST_CHANGED','INVOICE_MAIL_REQUEST_ANCHOR_INVALID'].includes(error.message))return sendCustomerMailGroup(input);console.error('[INVOICE_MAIL_REQUEST_SNAPSHOT_FAILED]',{name:error instanceof Error?error.name:'UnknownError'});return {code:'UNAVAILABLE',message:INVOICE_DELIVERY_COPY.remainderPending};}
 if('resend'in snapshot&&snapshot.resend)return sendCustomerMailGroup(input,undefined,undefined,prior);
 const first=await sendCustomerMailGroup(input,snapshot.invoiceIds,turnLimit,prior);
 if(first.code!=='OK')return first;
 const taskDependencies={effect:(tx:import('@/lib/server/privilegedDb').PrivilegedTenantTransaction,actor:AuthorizationSnapshot,effect:import('@/modules/tasks/server-public').TaskEffectRequest)=>recordIntakeTaskEffect(tx,actor,effect,readCustomerProfile)};
 const queueRemainder=async(reason:string):Promise<boolean>=>{
  try{return await recordInvoiceMailRemainderFailure(auth,{markerId,requestId:input.clientRequestId.toLowerCase(),threadId:first.data.threadId,customerId:first.data.customerId,reason},(tx,key)=>synchronizeInvoiceMailRemainderTask(tx,auth,key,false,taskDependencies));}
  catch(error){console.error('[INVOICE_MAIL_REMAINDER_PROOF_FAILED]',{name:error instanceof Error?error.name:'UnknownError',code:error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:null,cause:error&&typeof error==='object'&&'cause'in error&&(error as {cause?:{code?:string}}).cause?.code});return false;}
 };
 const failed=async(reason:string):Promise<CustomerMailResult>=>{await queueRemainder(reason);return {code:'UNAVAILABLE',message:INVOICE_DELIVERY_COPY.remainderPending};};
 try{
  const remaining=()=>withPrivilegedTenantTransaction(auth,tx=>readInvoiceMailOpenRemainder(tx,auth.tenantId,snapshot.customerId,snapshot.invoiceIds));
  let rest=await remaining(),processed=snapshot.invoiceIds.length-rest.length;
  for(let round=1;rest.length&&processed<turnLimit&&round<snapshot.invoiceIds.length;round++){
   const available=turnLimit-processed;
   const group=await withPrivilegedTenantTransaction(auth,tx=>readInvoiceMailCohort(tx,auth.tenantId,snapshot.customerId,snapshot.handover,undefined,snapshot.native,false,{snapshotIds:snapshot.invoiceIds,maxOriginals:available}));
   if(!group.length)return failed('REMAINDER_NO_PROGRESS');
   // A saved PREPARE group is indivisible. Its next turn starts with this group.
   if(group.length>available)break;
   const clientRequestId=invoiceRemainderKey(auth.tenantId,input.clientRequestId,group[0].id);
   const next=await sendCustomerMailGroup({targetType:'CUSTOMER',targetId:snapshot.customerId,subject:input.subject,body:input.body,clientRequestId,attachment:{kind:'INVOICE',documentId:group[0].id},expectedInvoiceIds:group.map(row=>row.id)},snapshot.invoiceIds,available);
   if(next.code!=='OK')return failed(next.code);
   const nextRest=await remaining();if(nextRest.length>=rest.length)return failed('REMAINDER_NO_PROGRESS');rest=nextRest;processed=snapshot.invoiceIds.length-rest.length;
  }
  if(rest.length)return await queueRemainder('TURN_LIMIT_REACHED')?first:{code:'UNAVAILABLE',message:INVOICE_DELIVERY_COPY.remainderPending};
  await withPrivilegedTenantTransaction(auth,tx=>synchronizeInvoiceMailRemainderTask(tx,auth,markerId,true,taskDependencies));
  return first;
 }catch(error){console.error('[INVOICE_MAIL_REMAINDER_FAILED]',{name:error instanceof Error?error.name:'UnknownError'});return failed('REMAINDER_SOURCE_UNAVAILABLE');}
}
async function sendCustomerMailGroup(input:CustomerMailInput,snapshotIds?:readonly string[],turnLimit?:number,priorReceipt?:Awaited<ReturnType<typeof readCommunicationDocumentReceipt>>):Promise<CustomerMailResult>{
 return observeAction('sendCustomerMailAction',subjectForAction('sendCustomerMailAction',input),async()=>{
 try{
 const authorizationResult=await authorization();
 if(!authorizationResult.ok)return {code:'UNAUTHENTICATED' as const,message:authorizationResult.message};
 const auth=authorizationResult.data;
 if(!input||typeof input!=='object')return sendCommunicationMail(auth,input);
 if(input.collectionReminder){
  const request=input.collectionReminder;
  if(input.targetType!=='CUSTOMER'||input.attachment||!hasAuthorizationArea(auth,'mails')&&!hasAuthorizationArea(auth,'zahlungen'))return {code:'FORBIDDEN' as const,message:COLLECTION_REMINDER_COPY.forbidden};
  if(!request||Object.keys(request).sort().join(',')!==(request.stage==='E4'?'clientKey,dueDate,handover,stage':'dueDate,handover,stage')||!['E1','E2','E4'].includes(request.stage)||!['pickup','shipping'].includes(request.handover)||!/^\d{4}-\d{2}-\d{2}$/.test(request.dueDate)||!Number.isFinite(Date.parse(request.dueDate))||typeof input.subject!=='string'||typeof input.body!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.clientRequestId)||(request.stage==='E4'&&(typeof request.clientKey!=='string'||!/^[0-9a-f-]{36}$/.test(request.clientKey))))return {code:'VALIDATION_ERROR' as const,message:COLLECTION_REMINDER_COPY.invalid};
  const prior=await readCollectionReminderReceipt(auth,{...input,collectionReminder:request});
  if(prior.code==='FOLLOWUP_PENDING'){
   await withPrivilegedTenantTransaction(auth,tx=>applyCollectionReminderMailEffects(tx,auth,prior.meta,prior.data.threadId,prior.data.messageId,prior.originalRequestId));
   return {code:'OK' as const,data:prior.data};
  }
  if(prior.code==='PENDING'){
   if(input.confirmedResend&&input.clientRequestId!==prior.originalRequestId)return {code:'CONFLICT' as const,message:COLLECTION_REMINDER_COPY.unclear};
   return sendCommunicationMail(auth,{targetType:'CUSTOMER',targetId:input.targetId,clientRequestId:prior.originalRequestId,subject:prior.original.subject,body:prior.original.body,confirmedResend:input.confirmedResend,collectionReminder:prior.meta,beforePrepare:async tx=>{
    if(!hasAuthorizationArea(auth,prior.meta.moneyRequired!==false?'zahlungen':'mails'))return false;
    await assertCollectionReminderCurrent(tx,auth,prior.meta);
    return true;
   }});
  }
  if(prior.code!=='NOT_FOUND')return prior;
  if(!hasAuthorizationArea(auth,'auftraege')||!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN' as const,message:COLLECTION_REMINDER_COPY.forbidden};
  // An explicit send also synchronizes the already imported originals. It is
  // a write command under the sender, never an effect of opening the list.
  const linked=await readLinkedIntakeMails(auth,{targetType:'CUSTOMER',targetId:input.targetId});
  if(linked.code!=='OK')return linked;
  for(const mail of linked.data){
   const original=await readImportedDispatchReplyEvidence(auth,{graphMessageId:mail.id,customerId:input.targetId});
   if(original.code==='NOT_FOUND')continue;
   if(original.code!=='OK')return {code:original.code,message:COLLECTION_REMINDER_COPY.proofUnavailable};
   const checked=await withDispatchReply(auth,original,true);if(checked.code!=='OK')return checked;
  }

  const [{getOrdersDb},{readShippingSettings,readShippingSettingsInTransaction}]=await Promise.all([import('@/app/actions/orders.actions'),import('@/modules/fundament/server-public')]);
  const [orders,settings]=await Promise.all([getOrdersDb(),readShippingSettings({tenantId:auth.tenantId,actorId:auth.userId,canRead:true})]);
  if(!orders.ok||settings.code!=='OK')return {code:'UNAVAILABLE' as const,message:COLLECTION_REMINDER_COPY.unavailable};
  const candidates=orders.data.filter(order=>order.customerId===input.targetId&&order.station==='fertig'&&order.finishedDispatch?.handover===request.handover);
  const storageLetter=request.stage==='E4'?candidates.find(order=>order.finishedDispatch?.storage?.letter?.clientKey===request.clientKey)?.finishedDispatch?.storage?.letter:undefined;
  const proposal=request.stage==='E4'&&storageLetter?{...storageLetter,stage:'E4' as const,requiresResponseCheck:candidates.some(order=>storageLetter.orderIds.includes(order.id)&&order.finishedDispatch?.reminder?.requiresResponseCheck!==false),needsNotice:[]}:candidates.find(order=>order.finishedDispatch?.reminder?.stage===request.stage&&order.finishedDispatch.reminder.state==='DUE'&&order.finishedDispatch.reminder.due===request.dueDate)?.finishedDispatch?.reminder;
  if(!proposal||proposal.stage!==request.stage||proposal.state!=='DUE'||proposal.due!==request.dueDate||!proposal.clientKey||proposal.requiresResponseCheck||proposal.needsNotice.length)return {code:'CONFLICT' as const,message:COLLECTION_REMINDER_COPY.notReady};
  if(settings.settings.dispatchPolicy?.holdMinutes!==0)return {code:'IN_KLAERUNG' as const,message:COLLECTION_REMINDER_COPY.holdUnavailable};
  const members=candidates.filter(order=>proposal.orderIds.includes(order.id)).sort((a,b)=>a.id.localeCompare(b.id));
  const meta:CollectionReminderMeta={stage:request.stage,customerId:input.targetId,handover:request.handover,dueDate:request.dueDate,stageKey:proposal.clientKey,intent:collectionReminderIntent({...input,collectionReminder:request}),orders:members.map(order=>({id:order.id,number:order.orderNumber,version:order.version})),...(storageLetter?{storageDeadline:freezeStorageDeadline(settings.settings.dispatchPolicy),storageOrigin:{callTaskId:storageLetter.callTaskId,appointmentEventId:storageLetter.appointmentEventId,replyEventId:storageLetter.replyEventId,freezes:storageLetter.freezes}}:{})};
  const [{readCollectionCustomerFacts,readCollectionMoneyAccess},{readCustomerProfile},{readCompanyLetterSettings}]=await Promise.all([import('@/lib/server/storageLetterRead'),import('@/modules/customers/server-public'),import('@/modules/fundament/server-public')]);
  const [customer,company]=await Promise.all([withPrivilegedTenantTransaction(auth,tx=>readCustomerProfile(tx,auth.tenantId,input.targetId)),readCompanyLetterSettings({tenantId:auth.tenantId,actorId:auth.userId,canRead:true})]);
  if(!customer||company.code==='UNAVAILABLE')return {code:'UNAVAILABLE' as const,message:COLLECTION_REMINDER_COPY.proofUnavailable};
  const moneyAccess=await readCollectionMoneyAccess(auth,members.map(order=>order.id),settings.settings,request.stage);
  if(!moneyAccess.sendAllowed)return {code:'FORBIDDEN' as const,message:moneyAccess.roles.length?COLLECTION_REMINDER_COPY.moneyRequired(customer.name,moneyAccess.roles.join(', ')):COLLECTION_REMINDER_COPY.forbidden};
  meta.moneyRequired=moneyAccess.required;
  const facts=await readCollectionCustomerFacts(auth,members,settings.settings,{name:customer.name,company:company.code==='OK'?company.company.companyName:null},meta.storageDeadline?.due??null);
  const message=CUSTOMER_COLLECTION_COPY.render(request.stage,facts);meta.customerMessage=message;
  return sendCommunicationMail(auth,{targetType:'CUSTOMER',targetId:input.targetId,clientRequestId:input.clientRequestId,subject:message.subject,body:message.body,collectionReminder:meta,beforePrepare:async tx=>(await readShippingSettingsInTransaction(tx,auth.tenantId))?.updatedAt===settings.settings.updatedAt});
 }
 let attachment,document:CommunicationDocument|undefined;
 let legacyReplaces:LegacyQuoteReplacement|undefined;
 let invoiceGroup:{customerId:string;handover:string|null;native:boolean;unreservedOnly?:boolean;snapshotIds?:readonly string[];maxOriginals?:number;anchorId?:string}|undefined;
 let invoiceExpectedForTurn:readonly string[]|undefined;
 const expectedForInvoiceTurn=(ids:readonly string[])=>{
  if(turnLimit===undefined)return input.expectedInvoiceIds!;
  if(!snapshotIds)throw Error('INVOICE_MAIL_REQUEST_SNAPSHOT_INVALID');
  const turnIds=new Set(ids);
  // Only this authenticated frozen request may retain consent outside its
  // unchanged transport original. Unknown outside IDs remain a hard mismatch.
  return input.expectedInvoiceIds!.filter(id=>turnIds.has(id)||!snapshotIds.includes(id));
 };
 if(input.attachment?.kind==='INVOICE'&&!validExpectedInvoiceIds(input)){const original=await readInvoicePdf(auth,input.attachment.documentId,'original');if(original.code!=='OK')return original;return {code:'VALIDATION_ERROR' as const,message:INVOICE_DELIVERY_COPY.expectedListMissing(original.data.invoiceNumber)};}
 const reconcileInvoice=(tx:import('@/lib/server/privilegedDb').PrivilegedTenantTransaction,threadId:string)=>applyRecoveredInvoiceMailEffects(auth,threadId,(writeTx,value)=>createCanceledInvoiceMailTask(writeTx,auth,value,{effect:(effectTx,actor,effect)=>recordIntakeTaskEffect(effectTx,actor,effect,readCustomerProfile)}),tx);
 const additionalAttachments:import('@/lib/server/microsoftGraph').GraphMailAttachment[]=[];
 if(input.attachment){
  const prior=priorReceipt??await readCommunicationDocumentReceipt(auth,input,input.attachment.documentId);
  if(prior.code==='PENDING'){
   const original=prior.document;
   if(input.confirmedResend&&input.clientRequestId!==prior.originalRequestId)return {code:'CONFLICT' as const,message:COLLECTION_REMINDER_COPY.unclear};
   if(original.kind==='QUOTE'&&input.attachment.kind==='QUOTE'){
    if(!original.original&&!input.confirmedResend){const replacement=await readLegacyQuoteReplacement(auth,prior.originalRequestId);if(replacement)return sendCustomerMailAction({...input,clientRequestId:replacement});}
    const bytes=original.original?await readQuoteMailOriginal(original.original,original.sha256):null;
    const result=await sendCommunicationMail(auth,{targetType:input.targetType,targetId:input.targetId,clientRequestId:prior.originalRequestId,subject:input.subject,body:input.body,confirmedResend:input.confirmedResend,allowResend:!!bytes,document:original,attachment:bytes?{filename:original.number+'.pdf',contentType:'application/pdf',bytes}:undefined,beforePrepare:async()=>{
     if(!bytes)return false;
     return (await readQuoteCommand(quoteOperationContext(auth),{quoteId:original.id})).code==='OK';
    }});
    if(!original.original&&result.code==='CONFLICT'&&result.newPrepare&&input.clientRequestId!==prior.originalRequestId&&!input.confirmedResend){legacyReplaces={requestId:prior.originalRequestId,checkedAt:result.newPrepare.checkedAt};}
    else return result.code==='OK'?confirmQuoteDelivery({...input,clientRequestId:prior.originalRequestId},original,result):result;
   }else{
   if(original.kind!=='INVOICE'||input.attachment.kind!=='INVOICE')return {code:'CONFLICT' as const,message:COLLECTION_REMINDER_COPY.unclear};
   const invoices=[original,...original.bundle??[]];
   if(JSON.stringify(invoices.map(row=>row.id).sort())!==JSON.stringify(expectedForInvoiceTurn(invoices.map(row=>row.id)).slice().sort()))return {code:'CONFLICT' as const,message:INVOICE_DELIVERY_COPY.expectedListMissing(original.number)};
   const originals:import('@/lib/server/microsoftGraph').GraphMailAttachment[]=[];
   for(const invoice of invoices){
    const pdf=await readPreparedInvoiceTransportOriginal(auth,{...input,clientRequestId:prior.originalRequestId},original,invoice);
    if(!pdf)return {code:'CONFLICT' as const,message:COLLECTION_REMINDER_COPY.proofUnavailable};
    originals.push({filename:invoice.number+'.pdf',contentType:'application/pdf',bytes:new Uint8Array(pdf)});
   }
   return sendCommunicationMail(auth,{targetType:input.targetType,targetId:input.targetId,clientRequestId:prior.originalRequestId,subject:input.subject,body:input.body,confirmedResend:input.confirmedResend,reconcileInvoice,document:original,attachment:originals[0],additionalAttachments:originals.slice(1),beforePrepare:async tx=>{
    return lockInvoiceMailDocuments(tx,auth,invoices);
   }});
   }
  }
  if(prior.code==='OK'){
   if('mailOnly'in prior&&prior.mailOnly)await withPrivilegedTenantTransaction(auth,tx=>reconcileInvoice(tx,prior.data.threadId));
   if(prior.document.kind!==input.attachment.kind)return {code:'CONFLICT' as const,message:'Die Versandkennung gehört zu einer anderen Belegart.'};
   if(prior.document.kind==='INVOICE'){const ids=[prior.document.id,...prior.document.bundle?.map(row=>row.id)??[]];if(JSON.stringify(ids.sort())!==JSON.stringify(expectedForInvoiceTurn(ids).slice().sort()))return {code:'VALIDATION_ERROR' as const,message:INVOICE_DELIVERY_COPY.expectedListMissing(prior.document.number)};}
   return prior.document.kind==='QUOTE'?confirmQuoteDelivery(input,prior.document,{code:'OK',data:prior.data}):{code:'OK' as const,data:prior.data};
  }
  if(prior.code==='PENDING'&&!legacyReplaces)return {code:'CONFLICT' as const,message:COLLECTION_REMINDER_COPY.unclear};
  if(prior.code!=='NOT_FOUND'&&prior.code!=='PENDING')return prior;
  if(input.attachment.kind==='INVOICE'){
   const pdf=await readInvoicePdf(auth,input.attachment.documentId,'original');if(pdf.code!=='OK')return pdf;
   const rows=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{id:string;order_id:string|null;customer_id:string;aggregate_version:number;order_number:string|null;collection_source:unknown;handover_mode:string|null}>(sql`SELECT invoice.id::text,invoice.order_id,invoice.customer_id,invoice.aggregate_version,orders.order_number,invoice.snapshot->'collection' AS collection_source,orders.handover_mode FROM public.invoices invoice LEFT JOIN public.orders orders ON orders.tenant_id=invoice.tenant_id AND orders.id=invoice.order_id WHERE invoice.tenant_id=${auth.tenantId} AND invoice.id=${input.attachment!.documentId}::uuid AND invoice.status='issued' AND invoice.contract_version=1 AND invoice.pdf_sha256=${pdf.data.pdfSha256}`));
   const invoice=rows[0];
   if(rows.length!==1)return {code:'FORBIDDEN' as const,message:'Die Rechnung gehört nicht zu diesem Kunden oder Auftrag.'};
   const selectedDocument=invoiceMailDocumentFromSource({...invoice,invoice_number:pdf.data.invoiceNumber},pdf.data.pdfSha256);
   if(!(input.targetType==='ORDER'?invoiceMailMembers(selectedDocument).some(member=>member.orderId===input.targetId):invoice.customer_id===input.targetId))return {code:'FORBIDDEN' as const,message:'Die Rechnung gehört nicht zu diesem Kunden oder Auftrag.'};
   attachment={filename:pdf.data.invoiceNumber+'.pdf',contentType:'application/pdf' as const,bytes:new Uint8Array(pdf.data.pdf)};
   document={...selectedDocument,kind:'INVOICE',bundle:[]};
   const selectedIds=input.singleInvoice?[invoice.id]:snapshotIds;
   invoiceGroup={customerId:invoice.customer_id,handover:invoice.handover_mode,native:invoice.order_id===null,...(selectedIds?{snapshotIds:selectedIds}:{}),...(turnLimit!==undefined?{maxOriginals:turnLimit,anchorId:invoice.id}:{})};
   const resend=await withPrivilegedTenantTransaction(auth,tx=>qualifyInvoiceResend(tx,auth,invoice.id,invoice.customer_id));if(resend)document.resend=resend;
   // An explicit other order can send its own new originals. The customer
   // command still resumes the frozen group exposed by its canonical reader.
   invoiceGroup.unreservedOnly=input.targetType==='ORDER'&&!resend;
   const selectedGroup=invoiceGroup;
   const cohort=await withPrivilegedTenantTransaction(auth,tx=>readInvoiceMailCohort(tx,auth.tenantId,invoice.customer_id,invoice.handover_mode,resend?.originals.map(row=>row.id),invoice.order_id===null,selectedGroup.unreservedOnly,{snapshotIds:selectedIds,maxOriginals:selectedGroup.maxOriginals,anchorId:selectedGroup.anchorId}));
   const others=cohort.filter(row=>row.id!==invoice.id);
   if(turnLimit!==undefined){
    // PL22.11.04:34 K1: consent outside this turn belongs to the immutable
    // request remainder. An ID outside that snapshot stays in the expected list
    // so the same locked checker still reports it as removed with its real number.
    // Unconfirmed added rows remain absent here and fail the same added check.
    invoiceExpectedForTurn=expectedForInvoiceTurn(cohort.map(row=>row.id));
   }
   if(others.length>100)return {code:'VALIDATION_ERROR' as const,message:'Zu viele offene Belege für eine einzelne Sammel-Mail. Es wurde nichts gesendet.'};
   for(const other of others){
    const original=await readInvoicePdf(auth,other.id,'original');if(original.code!=='OK')return original;
    additionalAttachments.push({filename:original.data.invoiceNumber+'.pdf',contentType:'application/pdf',bytes:new Uint8Array(original.data.pdf)});
    (document.bundle??=[]).push(invoiceMailDocumentFromSource({...other,invoice_number:original.data.invoiceNumber},original.data.pdfSha256));
   }
  }else{
  const pdf=await readQuotePdfAction({quoteId:input.attachment.documentId});
  if(pdf.code!=='OK')return pdf;
  const belongs=input.targetType==='CUSTOMER'?pdf.document.customerId===input.targetId:pdf.document.linkedOrderId===input.targetId;
  if(!belongs)return {code:'FORBIDDEN' as const,message:'Der KV gehört nicht zu diesem Kunden oder Auftrag.'};
  if(pdf.document.edition===null)return {code:'VALIDATION_ERROR' as const,message:'KV-Fassung fehlt. Es wurde nichts gesendet.'};
  attachment={filename:pdf.quoteNumber+'.pdf',contentType:'application/pdf' as const,bytes:new Uint8Array(pdf.pdf)};
  document={kind:'QUOTE',id:pdf.document.id,number:pdf.quoteNumber,version:pdf.document.version,edition:pdf.document.edition,sha256:createHash('sha256').update(attachment.bytes).digest('hex')};
  document.original=await storeQuoteMailOriginal(auth,input.clientRequestId,document.id,attachment.bytes);
  if(pdf.document.sourceMessageId){
   const source=await readIntakeMailImportReceipt(auth,{itemId:pdf.document.sourceMessageId});
   if(source.code!=='OK')return {...source,message:'KV-Ursprungsnachricht konnte nicht sicher gelesen werden. Es wurde nichts gesendet. '+source.message};
   document.source={itemId:source.itemId,graphMessageId:source.message.id};
  }
  }
 }
 const snapshot=document;
 const sent=await sendCommunicationMail(auth,{targetType:input.targetType,targetId:input.targetId,clientRequestId:input.clientRequestId,subject:input.subject,body:input.body,confirmedResend:input.confirmedResend,attachment,additionalAttachments,document,reconcileInvoice,legacyReplaces,beforePrepare:snapshot?async (tx,recipient)=>{
  if(snapshot.kind==='QUOTE')return lockQuoteDeliverySnapshot(tx,auth.tenantId,snapshot);
  const originals=[snapshot,...snapshot.bundle??[]];
  if(!await lockInvoiceMailDocuments(tx,auth,originals))return false;
  for(const invoice of originals){
   if(!snapshot.resend?.originals.some(original=>original.id===invoice.id&&original.sha256===invoice.sha256))await assertInvoiceNotSent(tx,auth.tenantId,invoice);
  }
  if(!invoiceGroup)throw Error('INVOICE_GROUP_MISSING');
  if(snapshot.resend){const qualified=await qualifyInvoiceResend(tx,auth,snapshot.id,invoiceGroup!.customerId,recipient);if(JSON.stringify(qualified)!==JSON.stringify(snapshot.resend)||!snapshot.resend.originals.every(original=>[snapshot,...snapshot.bundle??[]].some(row=>row.id===original.id&&row.sha256===original.sha256)))return false;}
  await assertInvoiceMailCohort(tx,auth.tenantId,invoiceGroup,invoiceExpectedForTurn??input.expectedInvoiceIds!,[snapshot.id,...snapshot.bundle?.map(row=>row.id)??[]],snapshot.resend?.originals.map(row=>row.id));
  return true;
 }:undefined});
 return sent.code==='OK'&&document?.kind==='QUOTE'?confirmQuoteDelivery(input,document,sent):sent;
 }catch(error){
  console.error('[CUSTOMER_MAIL_ACTION_FAILED]',{errorName:error instanceof Error?error.name:'UnknownError',reason:error instanceof Error&&/^[A-Z][A-Z0-9_:-]{1,150}$/.test(error.message)?error.message:'DATABASE_OR_INTERNAL_FAILURE'});
  return {code:'UNAVAILABLE' as const,message:'Der Versand konnte nicht sicher bestätigt werden. Behalte Deine Eingaben und sende nicht erneut, bevor der Ausgang geklärt ist.'};
 }

 },readLoggingSettings);
}

import {importIntakeGraphMail} from '@/modules/eingang/server-public';
import {recordDispatchReply} from '@/lib/server/dispatchReplyPort';
import {finishDispatchCallsForReply} from '@/lib/server/dispatchCallPort';
import {finishPostalTasksForReply} from '@/lib/server/storagePostalPort';
import {finishFinalTasksForReply} from '@/lib/server/storageFinalStagePort';
import {readShippingSettings} from '@/modules/fundament/server-public';
import {recordIntakeTaskEffect} from '@/modules/eingang/server-public';
import {completeCollectionTaskForReply,restrictCollectionTaskForReply,createOrderHandoverTask,createCanceledInvoiceMailTask} from '@/modules/tasks/server-public';
import {recordImportedDispatchReplies,readImportedDispatchReplyEvidence} from '@/lib/server/dispatchReplyEffectsPort';
import {qualifyImportedDeliveryFailure} from '@/lib/server/communicationDeliveryPort';
async function withDeliveryFailure<T extends {code:string;itemId?:string}>(auth:AuthorizationSnapshot,result:T,deferReply=false){
 if(result.code!=='OK'||!result.itemId)return result;
 const qualified=await qualifyImportedDeliveryFailure(auth,result.itemId,customerId=>linkImportedMail(auth,{itemId:result.itemId!,targetType:'CUSTOMER',targetId:customerId},readCommunicationTargetInTransaction,readCustomerProfile),()=>readPageReadSettings(auth));
 return qualified.code==='OK'?(deferReply?result:withDispatchReply(auth,result)):{...qualified,itemId:result.itemId};
}
async function withDispatchReply<T extends {code:string;itemId?:string}>(auth:AuthorizationSnapshot,result:T,strict=false){
 if(result.code!=='OK'||!result.itemId)return result;
 try{
 const settings=await readShippingSettings({tenantId:auth.tenantId,actorId:auth.userId,canRead:true});
 if(settings.code==='UNAVAILABLE')throw Error('DISPATCH_REPLY_SETTINGS_UNAVAILABLE');
 const record=(input:Parameters<typeof recordDispatchReply>[1])=>recordDispatchReply(auth,input,{readCustomerName:async tx=>{const customer=await readCustomerProfile(tx,auth.tenantId,input.customerId);if(!customer)throw Error('DISPATCH_REPLY_CUSTOMER_MISSING');return customer.name;},afterRecord:async(tx,receipt)=>{const complete=(taskId:string,note:string)=>completeCollectionTaskForReply(tx,auth,{taskId,replyEventId:receipt.eventId,note},{effect:(writeTx,actor,effect)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)});const restrict=(taskId:string)=>restrictCollectionTaskForReply(tx,auth,{taskId,replyEventId:receipt.eventId},{effect:(writeTx,actor,effect)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)});await finishDispatchCallsForReply(tx,auth,receipt,complete,restrict);await finishPostalTasksForReply(tx,auth,receipt,complete,{
 settingsUpdatedAt:settings.code==='OK'?settings.settings.updatedAt:'',
 customerCurrent:async(writeTx,snapshot)=>{const customer=await readCustomerProfile(writeTx,auth.tenantId,receipt.customerId,true);const {customerCountryLabel}=await import('@/modules/customers/public');const r=snapshot.recipient;return !!customer&&customer.name===r.name&&[customer.street,customer.houseNumber].filter(Boolean).join(' ')===r.street&&customer.zipCode===r.zip&&customer.city===r.city&&customerCountryLabel(customer.country)===r.country;},
 createTask:(writeTx,value)=>createOrderHandoverTask(writeTx,auth,value,{effect:(effectTx,actor,effect)=>recordIntakeTaskEffect(effectTx,actor,effect,readCustomerProfile)})
 });await finishFinalTasksForReply(tx,auth,receipt,complete,restrict);}});
 await recordImportedDispatchReplies(auth,result.itemId,{readLinked:readLinkedIntakeMails,record,readGraphSettings:()=>readPageReadSettings(auth)});return result;}
 catch(error){
  const reason=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'DATABASE_OR_PROVIDER_FAILURE';
  console.error('[IMPORTED_DISPATCH_REPLY_FAILED]',{name:error instanceof Error?error.name:'UnknownError',reason});
  try{await withPrivilegedTenantTransaction(auth,tx=>tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,user_id,payload,status,client_event_id,correlation_id,event_schema_version,created_at)
   VALUES(${randomUUID()},${auth.tenantId},'DISPATCH_REPLY_RETRY_REQUIRED_V1','DISPATCH_REPLY_RETRY_REQUIRED_V1',${auth.userId}::uuid,${JSON.stringify({itemId:result.itemId,reason})}::jsonb,'success',${randomUUID()}::uuid,${result.itemId}::uuid,1,statement_timestamp())`));}
  catch(markerError){console.error('[DISPATCH_REPLY_RETRY_MARKER_FAILED]',{name:markerError instanceof Error?markerError.name:'UnknownError'});}
  // Every next assignment and reminder reads the same linked original again.
  // Reaction uncertainty can block a reminder, never invalidate its saved mail.
  return strict?{code:'UNAVAILABLE' as const,itemId:result.itemId,message:COLLECTION_REMINDER_COPY.proofUnavailable}:result;
 }
}
import {readMicrosoftGraphAttachments,readMicrosoftGraphMime,readMicrosoftGraphMessage,type GraphInboxMessage} from '@/lib/server/microsoftGraph';
async function importIntakeMessage(auth:Parameters<typeof importIntakeGraphMail>[0],mail:GraphInboxMessage){
 const [mime,files]=await Promise.all([readMicrosoftGraphMime(mail.id),readMicrosoftGraphAttachments(mail.id)]);
 if(mime.code!=='OK')return mime;
 if(files.code!=='OK')return files;
 const result=await importIntakeGraphMail(auth,mail,[{key:'mime',name:'Original.eml',mime:'message/rfc822',bytes:mime.data},...files.data.attachments.map(file=>({key:file.id,name:file.filename,mime:file.contentType,bytes:file.bytes}))],
  {readSettings:readErkennungsEinstellungenInTransaction,scheduleRecognition:after},readCommunicationImportContext,files.data.skipped);
 if(result.code!=='OK')return result;
 const saved=await readIntakeMailImportReceipt(auth,{itemId:result.itemId});
 return saved.code==='OK'?{...saved,replayed:result.replayed}:saved;
}
export async function importOutlookMailAction(graphMessageId:string,options?:{deferDispatchReply?:boolean}){
 return observeAction('importOutlookMailAction',subjectForAction('importOutlookMailAction',graphMessageId),async()=>{
 const authorization=await resolveAuthorization();
 if(!authorization.ok)return {code:'UNAUTHENTICATED' as const,message:'Sitzung nicht verfügbar.'};
 if(!hasAuthorizationArea(authorization.data,'eingang')||!hasAuthorizationArea(authorization.data,'mails'))return {code:'FORBIDDEN' as const,message:'Mail-Import benötigt Eingang und Mails.'};
 if(typeof graphMessageId!=='string'||!graphMessageId||graphMessageId.length>1024)return {code:'VALIDATION_ERROR' as const,message:'Mailkennung ungültig.'};
 const saved=await readIntakeMailImportReceipt(authorization.data,{graphMessageId});
 if(saved.code!=='NOT_FOUND')return withDeliveryFailure(authorization.data,saved,options?.deferDispatchReply===true);
 const mail=await readMicrosoftGraphMessage(graphMessageId);
 if(mail.code!=='OK')return mail;
 return withDeliveryFailure(authorization.data,await importIntakeMessage(authorization.data,mail.data),options?.deferDispatchReply===true);

 },readLoggingSettings);
}


/** PL20.11.10:10: paper delivery is an actual receipt, never a simulated mail. */
export async function confirmInvoiceHandoverAction(input:{invoiceId:string;clientRequestId:string}){
 return observeAction('confirmInvoiceHandoverAction',subjectForAction('confirmInvoiceHandoverAction',input),async()=>{
  const authorizationResult=await authorization();if(!authorizationResult.ok)return {code:'UNAUTHENTICATED' as const,message:authorizationResult.message};
  const auth=authorizationResult.data;
  if(!canTransportInvoiceDocument(auth))return {code:'FORBIDDEN' as const,message:INVOICE_DELIVERY_COPY.manualHandoverForbidden};
  if(!input||!['invoiceId','clientRequestId'].every(key=>typeof input[key as keyof typeof input]==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input[key as keyof typeof input])))return {code:'VALIDATION_ERROR' as const,message:INVOICE_DELIVERY_COPY.manualHandoverConflict};
  try{
   const original=await readInvoicePdf(auth,input.invoiceId,'original');if(original.code!=='OK')return original;
   const result=await withPrivilegedTenantTransaction(auth,tx=>recordInvoiceManualHandover(tx,auth,{invoiceId:input.invoiceId.toLowerCase(),clientRequestId:input.clientRequestId.toLowerCase(),originalSha256:original.data.pdfSha256}));
   return {code:'OK' as const,...result,message:INVOICE_DELIVERY_COPY.manualHandoverSaved};
  }catch(error){
   if(error instanceof InvoiceManualHandoverConflict)return {code:'CONFLICT' as const,message:INVOICE_DELIVERY_COPY.manualHandoverConflict};
   console.error('[INVOICE_MANUAL_HANDOVER_FAILED]',{name:error instanceof Error?error.name:'UnknownError'});
   return {code:'UNAVAILABLE' as const,message:INVOICE_DELIVERY_COPY.manualHandoverFailed};
  }
 },readLoggingSettings);
}

// Root-only composition: the transport keeps its existing module boundary.
const sendCommunicationMail=(auth:Parameters<typeof sendCommunicationMailPort>[0],input:Parameters<typeof sendCommunicationMailPort>[1])=>sendCommunicationMailPort(auth,input,()=>readPageReadSettings(auth));
