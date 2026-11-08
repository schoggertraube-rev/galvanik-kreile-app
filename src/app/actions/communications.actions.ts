"use server";
import {readComplaintRejectionSource,prepareComplaintRejection,complaintRejectionReplay,completeIntakeComplaintRejection} from "@/modules/eingang/server-public";

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
import {prepareComplaintPhotoMail,readComplaintPhotoMailSource,complaintPhotoMailReplay,completeComplaintPhotoMail} from '@/modules/eingang/server-public';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {sql} from 'drizzle-orm';
import {readCustomerProfile} from '@/modules/customers/server-public';

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

async function confirmQuoteDelivery(input:{clientRequestId:string},document:CommunicationDocument,data:Awaited<ReturnType<typeof sendCommunicationMail>> & {code:'OK'}){
 const marked=await changeQuoteLifecycleAction({action:'sent',quoteId:document.id,clientEventId:input.clientRequestId,expectedVersion:document.version,edition:document.edition,channel:'mail',evidence:'Versandbeleg '+data.data.threadId+' · PDF SHA-256 '+document.sha256},{actualMail:true});
 const current=marked.code==='OK'?marked.quote.lifecycle:null;
 const notices=marked.code==='OK'?[...(marked.notices??[])]:[];
 if(current&&current.edition!==document.edition&&!notices.some(value=>value.includes('aktuelle Fassung')))notices.push('E-Mail mit Fassung '+document.edition+' gesendet · aktuelle Fassung '+current.edition+(current.sentEdition===current.edition?' bleibt bereits versendet.':' ist noch nicht versendet.'));
 return marked.code==='OK'?{...data,notice:notices.join(' ')||undefined}:{...data,notice:'E-Mail mit KV '+document.number+' · Fassung '+document.edition+' wurde versendet. KV-Stand konnte nicht angepasst werden: '+marked.message+' Nicht erneut senden.'};
}

export async function sendCustomerMailAction(input: TargetInput & {
 clientRequestId:string;subject:string;body:string;attachment?:{kind:'QUOTE';documentId:string};complaintRejection?:{itemId:string;version:number;reason:string};complaintPhotoRequest?:{itemId:string;version:number};
}){
 const authorizationResult=await authorization();
 if(!authorizationResult.ok)return {code:'UNAUTHENTICATED' as const,message:authorizationResult.message};
 const auth=authorizationResult.data;
 if(input.complaintRejection)return sendComplaintRejection(auth,input);
 if(input.complaintPhotoRequest)return sendComplaintPhotoRequest(auth,input);
 let attachment,document:CommunicationDocument|undefined;
 if(input.attachment){
  const prior=await readCommunicationDocumentReceipt(auth,input,input.attachment.documentId);
  if(prior.code==='OK')return confirmQuoteDelivery(input,prior.document,{code:'OK',data:prior.data});
  if(prior.code!=='NOT_FOUND')return prior;
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
 const sent=await sendCommunicationMail(auth,{targetType:input.targetType,targetId:input.targetId,clientRequestId:input.clientRequestId,subject:input.subject,body:input.body,attachment,document,beforePrepare:document?tx=>lockQuoteDeliverySnapshot(tx,auth.tenantId,document!):undefined});
 return sent.code==='OK'&&document?confirmQuoteDelivery(input,document,sent):sent;
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

/** Bound reply purpose of the existing sender; never an arbitrary recipient override. */
async function sendComplaintPhotoRequest(auth:import('@/lib/server/authorization').AuthorizationSnapshot,input:TargetInput&{clientRequestId:string;subject:string;body:string;attachment?:unknown;complaintPhotoRequest?:{itemId:string;version:number}}){
 if(!['eingang','mails','kunden'].every(area=>hasAuthorizationArea(auth,area as 'eingang'|'mails'|'kunden')))return {code:'FORBIDDEN' as const,message:'Fotoanfrage benötigt Eingang, Mails und Kunden.'};
 const request=input.complaintPhotoRequest;
 if(!request||Object.keys(request).some(key=>!['itemId','version'].includes(key))||!/^[0-9a-f-]{36}$/i.test(request.itemId)||!Number.isSafeInteger(request.version)||request.version<1||!/^[0-9a-f-]{36}$/i.test(input.clientRequestId)||input.attachment)return {code:'VALIDATION_ERROR' as const,message:'Eingang oder Anfragekennung ist ungültig.'};
 try{
  const context=await withPrivilegedTenantTransaction(auth,async tx=>{
   const source=await readComplaintPhotoMailSource(tx,auth,{...request,clientRequestId:input.clientRequestId});
   if(input.targetType!=='CUSTOMER'||input.targetId!==source.customerId)throw Error('COMPLAINT_PHOTO_MAIL_TARGET_MISMATCH');
   const customer=await readCustomerProfile(tx,auth.tenantId,source.customerId!);if(!customer)throw Error('COMPLAINT_PHOTO_MAIL_CUSTOMER_MISSING');
   const [template]=await tx.execute<{subject:string;body:string|null}>(sql`SELECT subject_template AS subject,body_text_template AS body FROM public.email_templates WHERE tenant_id=${auth.tenantId} AND template_key=${auth.tenantId+':reklamation_fotos_anfordern'}`);
   if(!template?.body?.trim()||!template.subject.trim())throw Error('COMPLAINT_PHOTO_MAIL_TEMPLATE_MISSING');
   const subject=template.subject.replaceAll('{Kunde}',customer.name),body=template.body.replaceAll('{Kunde}',customer.name);
   if(/\{[^}]+\}/.test(subject+body))throw Error('COMPLAINT_PHOTO_MAIL_TEMPLATE_VARIABLE_UNKNOWN');
   return {source,subject,body};
  });
  const intent=createHash('sha256').update(JSON.stringify({itemId:request.itemId,version:request.version,customerId:context.source.customerId,graphId:context.source.graphId,original:context.source.originalSha256,subject:context.subject,body:context.body})).digest('hex');
  return sendCommunicationMail(auth,{targetType:'CUSTOMER',targetId:context.source.customerId!,clientRequestId:input.clientRequestId,subject:context.subject,body:context.body,intakeReply:{itemId:request.itemId,version:request.version,graphMessageId:context.source.graphId!,sender:context.source.sender!,intent,
   validate:tx=>prepareComplaintPhotoMail(tx,auth,{...request,clientRequestId:input.clientRequestId,customerId:context.source.customerId!,originalSha256:context.source.originalSha256,graphId:context.source.graphId!,sender:context.source.sender!,intent}),
   complete:async(tx,threadId)=>completeComplaintPhotoMail(tx,auth,{...request,clientRequestId:input.clientRequestId,intent,threadId,customerId:context.source.customerId!,originalSha256:context.source.originalSha256}),
   replay:async(tx,threadId)=>complaintPhotoMailReplay(tx,auth,{itemId:request.itemId,clientRequestId:input.clientRequestId,intent,threadId})}});
 }catch(error){console.error('[COMPLAINT_PHOTO_REQUEST_FAILED]',{code:error instanceof Error?error.message:'UNKNOWN'});return {code:'VALIDATION_ERROR' as const,message:error instanceof Error&&error.message==='COMPLAINT_PHOTO_MAIL_TEMPLATE_MISSING'?'Mailvorlage fehlt · in Einstellungen ergänzen.':error instanceof Error&&error.message==='COMPLAINT_PHOTO_MAIL_ALREADY_REQUESTED'?'Fotoanfrage läuft bereits · Versandbeleg prüfen.':error instanceof Error&&error.message==='COMPLAINT_PHOTO_MAIL_PHOTOS_ALREADY_PRESENT'?'Fotos sind schon da · Reklamation anlegen.':'Original-Mail, Kundenzuordnung oder Stand konnte nicht sicher geprüft werden. Es wurde nichts erneut gesendet.'};}
}

async function sendComplaintRejection(auth:import('@/lib/server/authorization').AuthorizationSnapshot,input:TargetInput&{clientRequestId:string;subject:string;body:string;attachment?:unknown;complaintPhotoRequest?:unknown;complaintRejection?:{itemId:string;version:number;reason:string}}){
 if(!['eingang','mails','kunden'].every(area=>hasAuthorizationArea(auth,area as 'eingang'|'mails'|'kunden')))return {code:'FORBIDDEN' as const,message:'Antwort benötigt Eingang, Mails und Kunden.'};
 const request=input.complaintRejection,uuid=/^[0-9a-f-]{36}$/i;
 if(!request||!uuid.test(request.itemId)||!uuid.test(input.clientRequestId)||!Number.isSafeInteger(request.version)||request.version<1||typeof request.reason!=='string'||request.reason.trim().length<3||request.reason.length>500||typeof input.subject!=='string'||!input.subject.trim()||input.subject.length>500||typeof input.body!=='string'||!input.body.trim()||input.body.length>20000||input.attachment||input.complaintPhotoRequest)return {code:'VALIDATION_ERROR' as const,message:'Original, Antwort und konkreten Grund ergänzen.'};
 try{
  const source=await withPrivilegedTenantTransaction(auth,tx=>readComplaintRejectionSource(tx,auth,{...request,clientRequestId:input.clientRequestId}));
  if(input.targetType!=='CUSTOMER'||input.targetId!==source.customerId)return {code:'FORBIDDEN' as const,message:'Die Antwort gehört zu einem anderen Kunden.'};
  const intent=createHash('sha256').update(JSON.stringify({itemId:request.itemId,version:request.version,customerId:source.customerId,graphId:source.graphId,originalSha256:source.originalSha256,subject:input.subject.trim(),body:input.body.trim(),reason:request.reason.trim()})).digest('hex');
  return sendCommunicationMail(auth,{targetType:'CUSTOMER',targetId:source.customerId!,clientRequestId:input.clientRequestId,subject:input.subject,body:input.body,intakeReply:{purpose:'no-complaint',itemId:request.itemId,version:request.version,graphMessageId:source.graphId!,sender:source.sender!,intent,
   validate:tx=>prepareComplaintRejection(tx,auth,{...request,clientRequestId:input.clientRequestId,intent}),
   complete:(tx,threadId)=>completeIntakeComplaintRejection(tx,auth,{itemId:request.itemId,version:request.version,clientKey:input.clientRequestId,customerId:source.customerId!,orderId:null,threadId,reason:request.reason.trim(),intent}),
   replay:(tx,threadId)=>complaintRejectionReplay(tx,auth,{itemId:request.itemId,clientRequestId:input.clientRequestId,threadId,intent})}});
 }catch(error){console.error('[COMPLAINT_RESPONSE_FAILED]',{code:error instanceof Error?error.message:'UNKNOWN'});return {code:'CONFLICT' as const,message:'Antwort oder Anliegen ist inzwischen geändert · kein erneuter Versand bestätigt.'};}
}
