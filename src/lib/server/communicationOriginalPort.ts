import 'server-only';
import {createHash} from 'node:crypto';
import {readStableDomainAttachment,storeDomainAttachmentBytes} from './domainAttachmentStorage';
import type {AuthorizationSnapshot} from './authorization';
import {hasAuthorizationArea} from './authorization';
import {quoteCommandContext} from './quoteAuthorization';
import {withPrivilegedTenantTransaction} from './privilegedDb';
import {readIntakeConfirmationMailSource} from './intakeDraftEvents';

export type CommunicationOriginal={path:string;fileBytes:number};
export type IntakeMailOriginal=CommunicationOriginal&{sha256:string};

/** PL03:01: exact subject/body bytes in the same immutable original store. */
export async function storeIntakeMailOriginal(auth:AuthorizationSnapshot,source:{orderId:string;outboxId:string;sourceClientEventId:string},message:{subject:string;body:string}):Promise<IntakeMailOriginal>{
 if(!hasAuthorizationArea(auth,'eingang')||!await withPrivilegedTenantTransaction(auth,tx=>readIntakeConfirmationMailSource(tx,auth,source)))throw Error('INTAKE_MAIL_ORIGINAL_FORBIDDEN');
 const digest=createHash('sha256').update(JSON.stringify(['intake-mail-original',auth.tenantId,auth.userId,source.outboxId,source.sourceClientEventId])).digest();
 digest[6]=(digest[6]&15)|80;digest[8]=(digest[8]&63)|128;
 const h=digest.subarray(0,16).toString('hex'),id=`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
 const bytes=new TextEncoder().encode(JSON.stringify([message.subject.trim(),message.body.trim()]));
 const original={path:'domain-attachments/v1/'+id+'.json',fileBytes:bytes.byteLength,sha256:createHash('sha256').update(bytes).digest('hex')};
 await storeDomainAttachmentBytes(original.path,bytes,'application/json');
 await readIntakeMailOriginal(original);
 return original;
}

/** Caller qualifies the original actor/source PREPARE before reading this ref. */
export async function readIntakeMailOriginal(original:IntakeMailOriginal){
 const saved=await readStableDomainAttachment(original.path,{fileBytes:original.fileBytes,mimeType:'application/json'});
 if(createHash('sha256').update(saved.bytes).digest('hex')!==original.sha256)throw Error('INTAKE_MAIL_ORIGINAL_HASH_MISMATCH');
 const value:unknown=JSON.parse(new TextDecoder().decode(saved.bytes));
 if(!Array.isArray(value)||value.length!==2||value.some(part=>typeof part!=='string'||!part.trim()))throw Error('INTAKE_MAIL_ORIGINAL_INVALID');
 return {subject:value[0] as string,body:value[1] as string};
}

/** PL02:01: the existing immutable original store, never a second PDF renderer. */
export async function storeQuoteMailOriginal(auth:AuthorizationSnapshot,requestId:string,quoteId:string,bytes:Uint8Array):Promise<CommunicationOriginal>{
 if(!hasAuthorizationArea(auth,'mails')||!quoteCommandContext(auth).capabilities.canReadQuote)throw Error('QUOTE_MAIL_ORIGINAL_FORBIDDEN');
 const digest=createHash('sha256').update(JSON.stringify(['quote-mail-original',auth.tenantId,auth.userId,requestId,quoteId])).digest();
 digest[6]=(digest[6]&15)|80;digest[8]=(digest[8]&63)|128;
 const h=digest.subarray(0,16).toString('hex'),id=`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
 const original={path:'domain-attachments/v1/'+id+'.pdf',fileBytes:bytes.byteLength};
 await storeDomainAttachmentBytes(original.path,bytes,'application/pdf');
 await readQuoteMailOriginal(original,createHash('sha256').update(bytes).digest('hex'));
 return original;
}

/** Caller must first qualify the immutable actor/tenant/document PREPARE. */
export async function readQuoteMailOriginal(original:CommunicationOriginal,sha256:string){
 const saved=await readStableDomainAttachment(original.path,{fileBytes:original.fileBytes,mimeType:'application/pdf'});
 if(createHash('sha256').update(saved.bytes).digest('hex')!==sha256)throw Error('QUOTE_MAIL_ORIGINAL_HASH_MISMATCH');
 return saved.bytes;
}
