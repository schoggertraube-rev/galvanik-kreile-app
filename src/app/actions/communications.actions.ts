"use server";

import {storeQuoteMailOriginal,readQuoteMailOriginal} from '@/lib/server/communicationOriginalPort';
import {quoteCommandContext} from '@/lib/server/quoteAuthorization';
import {readQuoteCommand} from '@/modules/quotes/server-public';
import {lockQuoteDeliverySnapshot} from "@/modules/quotes/server-public";
import {freezeStorageDeadline} from '@/lib/server/storageDeadline';
import {createHash,randomUUID} from "node:crypto";
import {readCommunicationDocumentReceipt,readLegacyQuoteReplacement,type LegacyQuoteReplacement,applyRecoveredInvoiceMailEffects,readPreparedInvoiceTransportOriginal,readInvoiceMailCohort,assertInvoiceMailCohort,qualifyInvoiceResend,assertInvoiceNotSent,type CommunicationDocument} from "@/lib/server/communicationDocumentPort";
import { unstable_noStore as noStore } from "next/cache";
import { resolveAuthorization,hasAuthorizationArea,type AuthorizationSnapshot } from "@/lib/server/authorization";
import {
  attachInboxMessage,
  readCommunicationInbox,
  readLinkedCommunicationMessages,
  sendCommunicationMail,
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
import {readReadyNotificationContext} from '@/lib/server/orderReleaseRead';
import {readCollectionReminderReceipt,applyCollectionReminderMailEffects,assertCollectionReminderCurrent,collectionReminderIntent,type CollectionReminderMeta} from '@/lib/server/collectionReminderPort';
import {INVOICE_DELIVERY_COPY,COLLECTION_REMINDER_COPY,CUSTOMER_COLLECTION_COPY} from '@/ui/situationCatalog';

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
  return {code:'OK' as const,data:[...unique.values()].sort((a,b)=>Date.parse(b.receivedAt)-Date.parse(a.receivedAt))};
}

export async function attachOutlookMailAction(input: TargetInput & { graphMessageId: string }) {
  const authorizationResult = await authorization();
  if (!authorizationResult.ok) return { code: "UNAUTHENTICATED" as const, message: authorizationResult.message };
  const imported=await importOutlookMailAction(input?.graphMessageId,{deferDispatchReply:true});
  if(imported.code!=='OK')return imported;
  const linked=await linkImportedMail(authorizationResult.data,{itemId:imported.itemId,targetType:input.targetType,targetId:input.targetId},readCommunicationTargetInTransaction,readCustomerProfile);
  if(linked.code!=='OK')return linked;
  const correspondence=await attachInboxMessage(authorizationResult.data,input,imported.message);
  if(correspondence.code==='OK')await withDispatchReply(authorizationResult.data,imported);
  return correspondence.code==='OK'?{...correspondence,data:{...correspondence.data,attachmentsImported:imported.originalCount,attachmentsSkipped:imported.filteredAttachments}}:correspondence;
}

async function confirmQuoteDelivery(input:{clientRequestId:string},document:Extract<CommunicationDocument,{kind:'QUOTE'}>,data:Awaited<ReturnType<typeof sendCommunicationMail>> & {code:'OK'}){
 const marked=await changeQuoteLifecycleAction({action:'sent',quoteId:document.id,clientEventId:input.clientRequestId,expectedVersion:document.version,edition:document.edition,channel:'mail',evidence:'Versandbeleg '+data.data.threadId+' · PDF SHA-256 '+document.sha256},{actualMail:true});
 const current=marked.code==='OK'?marked.quote.lifecycle:null;
 const notices=marked.code==='OK'?[...(marked.notices??[])]:[];
 if(current&&current.edition!==document.edition&&!notices.some(value=>value.includes('aktuelle Fassung')))notices.push('E-Mail mit Fassung '+document.edition+' gesendet · aktuelle Fassung '+current.edition+(current.sentEdition===current.edition?' bleibt bereits versendet.':' ist noch nicht versendet.'));
 return marked.code==='OK'?{...data,notice:notices.join(' ')||undefined}:{...data,notice:'E-Mail mit KV '+document.number+' · Fassung '+document.edition+' wurde versendet. KV-Stand konnte nicht angepasst werden: '+marked.message+' Nicht erneut senden.'};
}

export async function sendCustomerMailAction(input: TargetInput & {
 clientRequestId:string;subject:string;body:string;confirmedResend?:true;expectedInvoiceIds?:string[];attachment?:{kind:'QUOTE'|'INVOICE';documentId:string};collectionReminder?:{stage:'E1'|'E2'|'E4';handover:'pickup'|'shipping';dueDate:string;clientKey?:string};
}){
 try{
 const authorizationResult=await authorization();
 if(!authorizationResult.ok)return {code:'UNAUTHENTICATED' as const,message:authorizationResult.message};
 const auth=authorizationResult.data;
 if(!input||typeof input!=='object')return sendCommunicationMail(auth,input);
 if(input.collectionReminder){
  const request=input.collectionReminder;
  if(input.targetType!=='CUSTOMER'||input.attachment||!hasAuthorizationArea(auth,'auftraege')||!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN' as const,message:COLLECTION_REMINDER_COPY.forbidden};
  if(!request||Object.keys(request).sort().join(',')!==(request.stage==='E4'?'clientKey,dueDate,handover,stage':'dueDate,handover,stage')||!['E1','E2','E4'].includes(request.stage)||!['pickup','shipping'].includes(request.handover)||!/^\d{4}-\d{2}-\d{2}$/.test(request.dueDate)||!Number.isFinite(Date.parse(request.dueDate))||typeof input.subject!=='string'||typeof input.body!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.clientRequestId)||(request.stage==='E4'&&(typeof request.clientKey!=='string'||!/^[0-9a-f-]{36}$/.test(request.clientKey))))return {code:'VALIDATION_ERROR' as const,message:COLLECTION_REMINDER_COPY.invalid};
  const prior=await readCollectionReminderReceipt(auth,{...input,collectionReminder:request});
  if(prior.code==='FOLLOWUP_PENDING'){
   await withPrivilegedTenantTransaction(auth,tx=>applyCollectionReminderMailEffects(tx,auth,prior.meta,prior.data.threadId,prior.data.messageId,prior.originalRequestId));
   return {code:'OK' as const,data:prior.data};
  }
  if(prior.code==='PENDING'){
   if(input.confirmedResend&&input.clientRequestId!==prior.originalRequestId)return {code:'CONFLICT' as const,message:COLLECTION_REMINDER_COPY.unclear};
   const [{readShippingSettingsInTransaction},{readCollectionMoneyAccess}]=await Promise.all([import('@/modules/fundament/server-public'),import('@/lib/server/storageLetterRead')]);
   return sendCommunicationMail(auth,{targetType:'CUSTOMER',targetId:input.targetId,clientRequestId:prior.originalRequestId,subject:prior.original.subject,body:prior.original.body,confirmedResend:input.confirmedResend,collectionReminder:prior.meta,beforePrepare:async tx=>{
    if(prior.meta.moneyRequired!==false&&!hasAuthorizationArea(auth,'geld'))return false;
    await assertCollectionReminderCurrent(tx,auth,prior.meta);
    const settings=await readShippingSettingsInTransaction(tx,auth.tenantId);if(!settings)return false;
    return (await readCollectionMoneyAccess(auth,prior.meta.orders.map(order=>order.id),settings,prior.meta.stage)).sendAllowed;
   }});
  }
  if(prior.code!=='NOT_FOUND')return prior;
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
 let invoiceGroup:{customerId:string;handover:string|null}|undefined;
 if(input.attachment?.kind==='INVOICE'&&(!Array.isArray(input.expectedInvoiceIds)||!input.expectedInvoiceIds.length||input.expectedInvoiceIds.length>101||new Set(input.expectedInvoiceIds).size!==input.expectedInvoiceIds.length||input.expectedInvoiceIds.some(id=>typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))||!input.expectedInvoiceIds.includes(input.attachment.documentId))){const original=await readInvoicePdf(auth,input.attachment.documentId,'original');if(original.code!=='OK')return original;return {code:'VALIDATION_ERROR' as const,message:INVOICE_DELIVERY_COPY.expectedListMissing(original.data.invoiceNumber)};}
 const reconcileInvoice=(tx:import('@/lib/server/privilegedDb').PrivilegedTenantTransaction,threadId:string)=>applyRecoveredInvoiceMailEffects(auth,threadId,(writeTx,value)=>createCanceledInvoiceMailTask(writeTx,auth,value,{effect:(effectTx,actor,effect)=>recordIntakeTaskEffect(effectTx,actor,effect,readCustomerProfile)}),tx);
 const additionalAttachments:import('@/lib/server/microsoftGraph').GraphMailAttachment[]=[];
 if(input.attachment){
  const prior=await readCommunicationDocumentReceipt(auth,input,input.attachment.documentId);
  if(prior.code==='PENDING'){
   const original=prior.document;
   if(input.confirmedResend&&input.clientRequestId!==prior.originalRequestId)return {code:'CONFLICT' as const,message:COLLECTION_REMINDER_COPY.unclear};
   if(original.kind==='QUOTE'&&input.attachment.kind==='QUOTE'){
    if(!original.original&&!input.confirmedResend){const replacement=await readLegacyQuoteReplacement(auth,prior.originalRequestId);if(replacement)return sendCustomerMailAction({...input,clientRequestId:replacement});}
    const bytes=original.original?await readQuoteMailOriginal(original.original,original.sha256):null;
    const result=await sendCommunicationMail(auth,{targetType:input.targetType,targetId:input.targetId,clientRequestId:prior.originalRequestId,subject:input.subject,body:input.body,confirmedResend:input.confirmedResend,allowResend:!!bytes,document:original,attachment:bytes?{filename:original.number+'.pdf',contentType:'application/pdf',bytes}:undefined,beforePrepare:async()=>{
     if(!bytes)return false;
     return (await readQuoteCommand(quoteCommandContext(auth),{quoteId:original.id})).code==='OK';
    }});
    if(!original.original&&result.code==='CONFLICT'&&result.newPrepare&&input.clientRequestId!==prior.originalRequestId&&!input.confirmedResend){legacyReplaces={requestId:prior.originalRequestId,checkedAt:result.newPrepare.checkedAt};}
    else return result.code==='OK'?confirmQuoteDelivery({...input,clientRequestId:prior.originalRequestId},original,result):result;
   }else{
   if(original.kind!=='INVOICE'||input.attachment.kind!=='INVOICE')return {code:'CONFLICT' as const,message:COLLECTION_REMINDER_COPY.unclear};
   const invoices=[original,...original.bundle??[]];
   if(JSON.stringify(invoices.map(row=>row.id).sort())!==JSON.stringify(input.expectedInvoiceIds!.slice().sort()))return {code:'CONFLICT' as const,message:INVOICE_DELIVERY_COPY.expectedListMissing(original.number)};
   const originals:import('@/lib/server/microsoftGraph').GraphMailAttachment[]=[];
   for(const invoice of invoices){
    const pdf=await readPreparedInvoiceTransportOriginal(auth,{...input,clientRequestId:prior.originalRequestId},original,invoice);
    if(!pdf)return {code:'CONFLICT' as const,message:COLLECTION_REMINDER_COPY.proofUnavailable};
    originals.push({filename:invoice.number+'.pdf',contentType:'application/pdf',bytes:new Uint8Array(pdf)});
   }
   return sendCommunicationMail(auth,{targetType:input.targetType,targetId:input.targetId,clientRequestId:prior.originalRequestId,subject:input.subject,body:input.body,confirmedResend:input.confirmedResend,reconcileInvoice,document:original,attachment:originals[0],additionalAttachments:originals.slice(1),beforePrepare:async tx=>{
    for(const invoice of invoices.slice().sort((a,b)=>a.orderId.localeCompare(b.orderId))){
     if(!await readReadyNotificationContext(tx,auth.tenantId,invoice.orderId))return false;
     const locked=await tx.execute(sql`SELECT id FROM public.invoices WHERE tenant_id=${auth.tenantId} AND id=${invoice.id}::uuid AND status='issued' AND aggregate_version=${invoice.version} AND pdf_sha256=${invoice.sha256} FOR UPDATE`);
     if(locked.length!==1)return false;
    }
    return true;
   }});
   }
  }
  if(prior.code==='OK'){
   if('mailOnly'in prior&&prior.mailOnly)await withPrivilegedTenantTransaction(auth,tx=>reconcileInvoice(tx,prior.data.threadId));
   if(prior.document.kind!==input.attachment.kind)return {code:'CONFLICT' as const,message:'Die Versandkennung gehört zu einer anderen Belegart.'};
   if(prior.document.kind==='INVOICE'&&JSON.stringify([prior.document.id,...prior.document.bundle?.map(row=>row.id)??[]].sort())!==JSON.stringify(input.expectedInvoiceIds!.slice().sort()))return {code:'VALIDATION_ERROR' as const,message:INVOICE_DELIVERY_COPY.expectedListMissing(prior.document.number)};
   return prior.document.kind==='QUOTE'?confirmQuoteDelivery(input,prior.document,{code:'OK',data:prior.data}):{code:'OK' as const,data:prior.data};
  }
  if(prior.code==='PENDING'&&!legacyReplaces)return {code:'CONFLICT' as const,message:COLLECTION_REMINDER_COPY.unclear};
  if(prior.code!=='NOT_FOUND'&&prior.code!=='PENDING')return prior;
  if(input.attachment.kind==='INVOICE'){
   const pdf=await readInvoicePdf(auth,input.attachment.documentId,'original');if(pdf.code!=='OK')return pdf;
   const rows=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{id:string;order_id:string;customer_id:string;aggregate_version:number;order_number:string;handover_mode:string|null}>(sql`SELECT invoice.id::text,invoice.order_id,invoice.customer_id,invoice.aggregate_version,orders.order_number,orders.handover_mode FROM public.invoices invoice JOIN public.orders orders ON orders.tenant_id=invoice.tenant_id AND orders.id=invoice.order_id WHERE invoice.tenant_id=${auth.tenantId} AND invoice.id=${input.attachment!.documentId}::uuid AND invoice.status='issued' AND invoice.contract_version=1 AND invoice.pdf_sha256=${pdf.data.pdfSha256}`));
   const invoice=rows[0];
   if(rows.length!==1||!(input.targetType==='ORDER'?invoice.order_id===input.targetId:invoice.customer_id===input.targetId))return {code:'FORBIDDEN' as const,message:'Die Rechnung gehört nicht zu diesem Kunden oder Auftrag.'};
   attachment={filename:pdf.data.invoiceNumber+'.pdf',contentType:'application/pdf' as const,bytes:new Uint8Array(pdf.data.pdf)};
   document={kind:'INVOICE',id:invoice.id,orderId:invoice.order_id,orderNumber:invoice.order_number,number:pdf.data.invoiceNumber,version:invoice.aggregate_version,sha256:pdf.data.pdfSha256,bundle:[]};
   invoiceGroup={customerId:invoice.customer_id,handover:invoice.handover_mode};
   const resend=await withPrivilegedTenantTransaction(auth,tx=>qualifyInvoiceResend(tx,auth,invoice.id,invoice.customer_id));if(resend)document.resend=resend;
   const others=(await withPrivilegedTenantTransaction(auth,tx=>readInvoiceMailCohort(tx,auth.tenantId,invoice.customer_id,invoice.handover_mode,resend?.originals.map(row=>row.id)))).filter(row=>row.id!==invoice.id);
   if(others.length>100)return {code:'VALIDATION_ERROR' as const,message:'Zu viele offene Belege für eine einzelne Sammel-Mail. Es wurde nichts gesendet.'};
   for(const other of others){
    const original=await readInvoicePdf(auth,other.id,'original');if(original.code!=='OK')return original;
    additionalAttachments.push({filename:original.data.invoiceNumber+'.pdf',contentType:'application/pdf',bytes:new Uint8Array(original.data.pdf)});
    (document.bundle??=[]).push({id:other.id,orderId:other.order_id,orderNumber:other.order_number,number:original.data.invoiceNumber,version:other.aggregate_version,sha256:original.data.pdfSha256});
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
  for(const invoice of [snapshot,...snapshot.bundle??[]].sort((a,b)=>a.orderId.localeCompare(b.orderId))){
   if(!await readReadyNotificationContext(tx,auth.tenantId,invoice.orderId))return false;
   const rows=await tx.execute(sql`SELECT id FROM public.invoices WHERE tenant_id=${auth.tenantId} AND id=${invoice.id}::uuid AND order_id=${invoice.orderId} AND status='issued' AND aggregate_version=${invoice.version} AND pdf_sha256=${invoice.sha256} FOR UPDATE`);
   if(rows.length!==1)return false;
   if(!snapshot.resend?.originals.some(original=>original.id===invoice.id&&original.sha256===invoice.sha256))await assertInvoiceNotSent(tx,auth.tenantId,invoice);
  }
  if(!invoiceGroup)throw Error('INVOICE_GROUP_MISSING');
  if(snapshot.resend){const qualified=await qualifyInvoiceResend(tx,auth,snapshot.id,invoiceGroup!.customerId,recipient);if(JSON.stringify(qualified)!==JSON.stringify(snapshot.resend)||!snapshot.resend.originals.every(original=>[snapshot,...snapshot.bundle??[]].some(row=>row.id===original.id&&row.sha256===original.sha256)))return false;}
  await assertInvoiceMailCohort(tx,auth.tenantId,invoiceGroup,input.expectedInvoiceIds!,[snapshot.id,...snapshot.bundle?.map(row=>row.id)??[]],snapshot.resend?.originals.map(row=>row.id));
  return true;
 }:undefined});
 return sent.code==='OK'&&document?.kind==='QUOTE'?confirmQuoteDelivery(input,document,sent):sent;
 }catch(error){
  console.error('[CUSTOMER_MAIL_ACTION_FAILED]',{errorName:error instanceof Error?error.name:'UnknownError',reason:error instanceof Error&&/^[A-Z][A-Z0-9_:-]{1,150}$/.test(error.message)?error.message:'DATABASE_OR_INTERNAL_FAILURE'});
  return {code:'UNAVAILABLE' as const,message:'Der Versand konnte nicht sicher bestätigt werden. Behalte Deine Eingaben und sende nicht erneut, bevor der Ausgang geklärt ist.'};
 }
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
 const qualified=await qualifyImportedDeliveryFailure(auth,result.itemId,customerId=>linkImportedMail(auth,{itemId:result.itemId!,targetType:'CUSTOMER',targetId:customerId},readCommunicationTargetInTransaction,readCustomerProfile));
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
 await recordImportedDispatchReplies(auth,result.itemId,{readLinked:readLinkedIntakeMails,record});return result;}
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
 const result=await importIntakeGraphMail(auth,mail,[{key:'mime',name:'Original.eml',mime:'message/rfc822',bytes:mime.data},...files.data.attachments.map(file=>({key:file.id,name:file.filename,mime:file.contentType,bytes:file.bytes}))],readCommunicationImportContext,files.data.skipped);
 if(result.code!=='OK')return result;
 const saved=await readIntakeMailImportReceipt(auth,{itemId:result.itemId});
 return saved.code==='OK'?{...saved,replayed:result.replayed}:saved;
}
export async function importOutlookMailAction(graphMessageId:string,options?:{deferDispatchReply?:boolean}){
 const authorization=await resolveAuthorization();
 if(!authorization.ok)return {code:'UNAUTHENTICATED' as const,message:'Sitzung nicht verfügbar.'};
 if(!hasAuthorizationArea(authorization.data,'eingang')||!hasAuthorizationArea(authorization.data,'mails'))return {code:'FORBIDDEN' as const,message:'Mail-Import benötigt Eingang und Mails.'};
 if(typeof graphMessageId!=='string'||!graphMessageId||graphMessageId.length>1024)return {code:'VALIDATION_ERROR' as const,message:'Mailkennung ungültig.'};
 const saved=await readIntakeMailImportReceipt(authorization.data,{graphMessageId});
 if(saved.code!=='NOT_FOUND')return withDeliveryFailure(authorization.data,saved,options?.deferDispatchReply===true);
 const mail=await readMicrosoftGraphMessage(graphMessageId);
 if(mail.code!=='OK')return mail;
 return withDeliveryFailure(authorization.data,await importIntakeMessage(authorization.data,mail.data),options?.deferDispatchReply===true);
}
