"use server";

import {lockQuoteDeliverySnapshot} from "@/modules/quotes/server-public";
import {createHash} from "node:crypto";
import {readCommunicationDocumentReceipt,type CommunicationDocument} from "@/lib/server/communicationDocumentPort";
import { unstable_noStore as noStore } from "next/cache";
import { resolveAuthorization,hasAuthorizationArea } from "@/lib/server/authorization";
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
import {readCollectionReminderReceipt,collectionReminderIntent,type CollectionReminderMeta} from '@/lib/server/collectionReminderPort';
import {DISPATCH_NOTICE_COPY,COLLECTION_REMINDER_COPY} from '@/ui/situationCatalog';

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
  const imported=await importOutlookMailAction(input?.graphMessageId);
  if(imported.code!=='OK')return imported;
  const linked=await linkImportedMail(authorizationResult.data,{itemId:imported.itemId,targetType:input.targetType,targetId:input.targetId},readCommunicationTargetInTransaction,readCustomerProfile);
  if(linked.code!=='OK')return linked;
  const correspondence=await attachInboxMessage(authorizationResult.data,input,imported.message);
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
 clientRequestId:string;subject:string;body:string;attachment?:{kind:'QUOTE'|'INVOICE';documentId:string};collectionReminder?:{stage:'E1'|'E2';handover:'pickup'|'shipping';dueDate:string};
}){
 try{
 const authorizationResult=await authorization();
 if(!authorizationResult.ok)return {code:'UNAUTHENTICATED' as const,message:authorizationResult.message};
 const auth=authorizationResult.data;
 if(!input||typeof input!=='object')return sendCommunicationMail(auth,input);
 if(input.collectionReminder){
  const request=input.collectionReminder;
  if(input.targetType!=='CUSTOMER'||input.attachment||!hasAuthorizationArea(auth,'auftraege')||!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN' as const,message:COLLECTION_REMINDER_COPY.forbidden};
  if(!request||Object.keys(request).sort().join(',')!=='dueDate,handover,stage'||!['E1','E2'].includes(request.stage)||!['pickup','shipping'].includes(request.handover)||!/^\d{4}-\d{2}-\d{2}$/.test(request.dueDate)||!Number.isFinite(Date.parse(request.dueDate))||typeof input.subject!=='string'||typeof input.body!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.clientRequestId))return {code:'VALIDATION_ERROR' as const,message:COLLECTION_REMINDER_COPY.invalid};
  const prior=await readCollectionReminderReceipt(auth,{...input,collectionReminder:request});if(prior.code!=='NOT_FOUND')return prior;
  const [{getOrdersDb},{readShippingSettings,readShippingSettingsInTransaction}]=await Promise.all([import('@/app/actions/orders.actions'),import('@/modules/fundament/server-public')]);
  const [orders,settings]=await Promise.all([getOrdersDb(),readShippingSettings({tenantId:auth.tenantId,actorId:auth.userId,canRead:true})]);
  if(!orders.ok||settings.code!=='OK')return {code:'UNAVAILABLE' as const,message:COLLECTION_REMINDER_COPY.unavailable};
  const members=orders.data.filter(order=>order.customerId===input.targetId&&order.station==='fertig'&&order.finishedDispatch?.handover===request.handover);
  const proposal=members[0]?.finishedDispatch?.reminder;
  if(!proposal||proposal.stage!==request.stage||proposal.state!=='DUE'||proposal.due!==request.dueDate||!proposal.clientKey||proposal.requiresResponseCheck||proposal.needsNotice.length)return {code:'CONFLICT' as const,message:COLLECTION_REMINDER_COPY.notReady};
  if(settings.settings.dispatchPolicy?.holdMinutes!==0)return {code:'IN_KLAERUNG' as const,message:COLLECTION_REMINDER_COPY.holdUnavailable};
  const meta:CollectionReminderMeta={stage:request.stage,customerId:input.targetId,handover:request.handover,dueDate:request.dueDate,stageKey:proposal.clientKey,intent:collectionReminderIntent({...input,collectionReminder:request}),orders:members.map(order=>({id:order.id,number:order.orderNumber,version:order.version}))};
  const prefix=DISPATCH_NOTICE_COPY.collective(meta.orders.map(order=>order.number))+'\n\n';
  return sendCommunicationMail(auth,{targetType:'CUSTOMER',targetId:input.targetId,clientRequestId:input.clientRequestId,subject:input.subject,body:prefix+input.body.trim(),collectionReminder:meta,beforePrepare:async tx=>(await readShippingSettingsInTransaction(tx,auth.tenantId))?.updatedAt===settings.settings.updatedAt});
 }
 let attachment,document:CommunicationDocument|undefined;
 const additionalAttachments:import('@/lib/server/microsoftGraph').GraphMailAttachment[]=[];
 if(input.attachment){
  const prior=await readCommunicationDocumentReceipt(auth,input,input.attachment.documentId);
  if(prior.code==='OK'){
   if(prior.document.kind!==input.attachment.kind)return {code:'CONFLICT' as const,message:'Die Versandkennung gehört zu einer anderen Belegart.'};
   return prior.document.kind==='QUOTE'?confirmQuoteDelivery(input,prior.document,{code:'OK',data:prior.data}):{code:'OK' as const,data:prior.data};
  }
  if(prior.code!=='NOT_FOUND')return prior;
  if(input.attachment.kind==='INVOICE'){
   const pdf=await readInvoicePdf(auth,input.attachment.documentId,'original');if(pdf.code!=='OK')return pdf;
   const rows=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{id:string;order_id:string;customer_id:string;aggregate_version:number;order_number:string;handover_mode:string|null}>(sql`SELECT invoice.id::text,invoice.order_id,invoice.customer_id,invoice.aggregate_version,orders.order_number,orders.handover_mode FROM public.invoices invoice JOIN public.orders orders ON orders.tenant_id=invoice.tenant_id AND orders.id=invoice.order_id WHERE invoice.tenant_id=${auth.tenantId} AND invoice.id=${input.attachment!.documentId}::uuid AND invoice.status='issued' AND invoice.contract_version=1 AND invoice.pdf_sha256=${pdf.data.pdfSha256}`));
   const invoice=rows[0];
   if(rows.length!==1||!(input.targetType==='ORDER'?invoice.order_id===input.targetId:invoice.customer_id===input.targetId))return {code:'FORBIDDEN' as const,message:'Die Rechnung gehört nicht zu diesem Kunden oder Auftrag.'};
   attachment={filename:pdf.data.invoiceNumber+'.pdf',contentType:'application/pdf' as const,bytes:new Uint8Array(pdf.data.pdf)};
   document={kind:'INVOICE',id:invoice.id,orderId:invoice.order_id,orderNumber:invoice.order_number,number:pdf.data.invoiceNumber,version:invoice.aggregate_version,sha256:pdf.data.pdfSha256};
   const others=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{id:string;order_id:string;order_number:string;aggregate_version:number}>(sql`SELECT invoice.id::text,invoice.order_id,orders.order_number,invoice.aggregate_version FROM public.invoices invoice
    JOIN public.orders orders ON orders.tenant_id=invoice.tenant_id AND orders.id=invoice.order_id
    JOIN private.v_order_freeze_state_v1 freeze_state ON freeze_state.tenant_id=orders.tenant_id AND freeze_state.order_id=orders.id AND freeze_state.active AND freeze_state.integrity_ok
    WHERE invoice.tenant_id=${auth.tenantId} AND invoice.customer_id=${invoice.customer_id} AND invoice.status='issued' AND invoice.contract_version=1 AND invoice.id<>${invoice.id}::uuid
     AND orders.station='fertig' AND orders.current_station='fertig' AND orders.current_station_id='fertig' AND orders.status='fertig' AND orders.handover_mode=${invoice.handover_mode}
    ORDER BY orders.order_number,invoice.id LIMIT 101`));
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
  if(pdf.document.sourceMessageId){
   const source=await readIntakeMailImportReceipt(auth,{itemId:pdf.document.sourceMessageId});
   if(source.code!=='OK')return {...source,message:'KV-Ursprungsnachricht konnte nicht sicher gelesen werden. Es wurde nichts gesendet. '+source.message};
   document.source={itemId:source.itemId,graphMessageId:source.message.id};
  }
  }
 }
 const snapshot=document;
 const sent=await sendCommunicationMail(auth,{targetType:input.targetType,targetId:input.targetId,clientRequestId:input.clientRequestId,subject:input.subject,body:input.body,attachment,additionalAttachments,document,beforePrepare:snapshot?async tx=>{
  if(snapshot.kind==='QUOTE')return lockQuoteDeliverySnapshot(tx,auth.tenantId,snapshot);
  for(const invoice of [snapshot,...snapshot.bundle??[]].sort((a,b)=>a.orderId.localeCompare(b.orderId))){
   if(!await readReadyNotificationContext(tx,auth.tenantId,invoice.orderId))return false;
   const rows=await tx.execute(sql`SELECT id FROM public.invoices WHERE tenant_id=${auth.tenantId} AND id=${invoice.id}::uuid AND order_id=${invoice.orderId} AND status='issued' AND aggregate_version=${invoice.version} AND pdf_sha256=${invoice.sha256} FOR UPDATE`);
   if(rows.length!==1)return false;
  }return true;
 }:undefined});
 return sent.code==='OK'&&document?.kind==='QUOTE'?confirmQuoteDelivery(input,document,sent):sent;
 }catch(error){
  console.error('[CUSTOMER_MAIL_ACTION_FAILED]',{errorName:error instanceof Error?error.name:'UnknownError',reason:error instanceof Error&&/^[A-Z][A-Z0-9_:-]{1,150}$/.test(error.message)?error.message:'DATABASE_OR_INTERNAL_FAILURE'});
  return {code:'UNAVAILABLE' as const,message:'Der Versand konnte nicht sicher bestätigt werden. Behalte Deine Eingaben und sende nicht erneut, bevor der Ausgang geklärt ist.'};
 }
}

import {importIntakeGraphMail} from '@/modules/eingang/server-public';
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
export async function importOutlookMailAction(graphMessageId:string){
 const authorization=await resolveAuthorization();
 if(!authorization.ok)return {code:'UNAUTHENTICATED' as const,message:'Sitzung nicht verfügbar.'};
 if(!hasAuthorizationArea(authorization.data,'eingang')||!hasAuthorizationArea(authorization.data,'mails'))return {code:'FORBIDDEN' as const,message:'Mail-Import benötigt Eingang und Mails.'};
 if(typeof graphMessageId!=='string'||!graphMessageId||graphMessageId.length>1024)return {code:'VALIDATION_ERROR' as const,message:'Mailkennung ungültig.'};
 const saved=await readIntakeMailImportReceipt(authorization.data,{graphMessageId});
 if(saved.code!=='NOT_FOUND')return saved;
 const mail=await readMicrosoftGraphMessage(graphMessageId);
 if(mail.code!=='OK')return mail;
 return importIntakeMessage(authorization.data,mail.data);
}
