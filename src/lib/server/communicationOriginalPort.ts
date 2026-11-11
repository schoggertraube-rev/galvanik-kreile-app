import 'server-only';
import {createHash} from 'node:crypto';
import {readStableDomainAttachment,storeDomainAttachmentBytes} from './domainAttachmentStorage';
import type {AuthorizationSnapshot} from './authorization';
import {hasAuthorizationArea} from './authorization';
import {quoteCommandContext} from './quoteAuthorization';

export type CommunicationOriginal={path:string;fileBytes:number};

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
