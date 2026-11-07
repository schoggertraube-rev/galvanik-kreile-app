"use server";

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
import { readQuoteAction, readQuotePdfAction } from "@/app/actions/quotes.actions";
import {linkImportedMail,readLinkedIntakeMails,readIntakeMailImportReceipt} from '@/modules/eingang/server-public';
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

export async function sendCustomerMailAction(input: TargetInput & {
  clientRequestId: string;
  subject: string;
  body: string;
  attachment?: { kind: "QUOTE"; documentId: string };
}) {
  const authorizationResult = await authorization();
  if (!authorizationResult.ok) return { code: "UNAUTHENTICATED" as const, message: authorizationResult.message };
  const auth = authorizationResult.data;
  let attachment;
  if (input.attachment) {
    const quote = await readQuoteAction({ quoteId: input.attachment.documentId });
    if (quote.code !== "OK") return quote;
    const belongs = input.targetType === "CUSTOMER"
      ? quote.quote.customerId === input.targetId
      : quote.quote.linkedOrderId === input.targetId;
    if (!belongs) return { code: "FORBIDDEN" as const, message: "Der KV gehört nicht zu diesem Kunden oder Auftrag." };
    const pdf = await readQuotePdfAction({ quoteId: input.attachment.documentId });
    if (pdf.code !== "OK") return pdf;
    attachment = {
      filename: `${pdf.quoteNumber}.pdf`,
      contentType: "application/pdf" as const,
      bytes: new Uint8Array(pdf.pdf),
    };
  }
  return sendCommunicationMail(auth, {
    targetType: input.targetType,
    targetId: input.targetId,
    clientRequestId: input.clientRequestId,
    subject: input.subject,
    body: input.body,
    attachment,
  });
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
