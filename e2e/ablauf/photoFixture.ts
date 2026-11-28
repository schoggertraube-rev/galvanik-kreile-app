import {randomUUID,createHash} from 'node:crypto';
export const TEST_PHOTO_BYTES=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6p0AAAAASUVORK5CYII=','base64');
import {full,withSession} from './replayHarness';
import {resolveAuthorization} from '@/lib/server/authorization';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';

async function legacyPhotoActor(){
 if(!KREILE_TENANT_SLUG.startsWith('TEST-')||!process.env.DATABASE_URL||
   new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('TEST_PHOTO_LOOPBACK_REQUIRED');
 const actor=await resolveAuthorization();
 if(!actor.ok)throw Error('TEST_PHOTO_AUTH:'+actor.reason);
 return actor.data;
}

/** Creates actual historical originals only on the isolated TEST database. */
export async function reserveLegacyDocument(input:unknown){
 const {reserveDomainAttachment}=await import('@/lib/server/domainAttachment');
 return reserveDomainAttachment(await legacyPhotoActor(),input);
}

export async function reserveLegacyStationPhoto(input:Parameters<typeof import('@/lib/server/orderStationAttachment').reserveOrderStationAttachment>[1]){
 const {reserveOrderStationAttachment}=await import('@/lib/server/orderStationAttachment');
 return reserveOrderStationAttachment(await legacyPhotoActor(),input);
}

export async function finishLegacyDocument(input:{attachmentId:string;fileBytes:number;contentSha256:string;customerVisible?:boolean}){
 const {finalizeDomainAttachment}=await import('@/lib/server/domainAttachment');
 const {customerVisible,...original}=input;
 const result=await finalizeDomainAttachment(await legacyPhotoActor(),original);
 if(result.code!=='OK')return result;
 const {setEvidenceVisibilityAction}=await import('@/app/actions/domainAttachments.actions');
 const flag=await setEvidenceVisibilityAction({mode:'upload',evidenceKey:'legacy-scan-upload:'+result.data.receipt.attachmentId,
  ...(customerVisible===undefined?{}:{customerVisible})});
 return flag.code==='OK'?{...result,data:{...result.data,visibilityPending:flag.visibilityPending,...(flag.visibility?{visibility:flag.visibility}:{})}}:flag;
}

/** Same reserve -> signed HTTP upload -> finalize actions as the current photo control. */
export async function storeOrderPhoto(orderId:string){
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6p0AAAAASUVORK5CYII=','base64');
 const contentSha256=createHash('sha256').update(bytes).digest('hex');
 const reserved=await withSession(full,()=>reserveLegacyDocument({targetType:'ORDER',targetId:orderId,clientRequestId:randomUUID(),mimeType:'image/png',fileBytes:bytes.length,contentSha256}));
 if(reserved.code!=='OK'||!reserved.data.upload)throw Error('TEST_PHOTO_RESERVE:'+reserved.code);
 const endpoint=new URL('/storage/v1/object/upload/sign/scans/'+reserved.data.upload.path,process.env.NEXT_PUBLIC_SUPABASE_URL);
 if(endpoint.hostname!=='127.0.0.1')throw Error('TEST_PHOTO_LOOPBACK_REQUIRED');
 endpoint.searchParams.set('token',reserved.data.upload.token);
 const uploaded=await fetch(endpoint,{method:'PUT',headers:{'content-type':'image/png','x-upsert':'false'},body:new Blob([new Uint8Array(bytes).buffer],{type:'image/png'})});
 if(!uploaded.ok)throw Error('TEST_PHOTO_UPLOAD:'+uploaded.status);
 const attachmentId=reserved.data.receipt.attachmentId;
 const finalized=await withSession(full,()=>finishLegacyDocument({attachmentId,fileBytes:bytes.length,contentSha256}));
 if(finalized.code!=='OK')throw Error('TEST_PHOTO_FINALIZE:'+finalized.code);
 return attachmentId;
}

/** The actual incoming-photo controls, with Storage HTTP and secured readback. */
export async function storeIntakeGoodsPhoto(existingItemId?:string,actor=full,customerVisible?:boolean,deviceCapturedAt?:string){
 const itemId=existingItemId??randomUUID(),fileId=randomUUID();
 const bytes=Buffer.from(existingItemId?'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=':'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6p0AAAAASUVORK5CYII=','base64');
 const sha256=createHash('sha256').update(bytes).digest('hex');
 const {prepareIntakeFileAction,finishIntakeFileAction}=await import('@/app/actions/eingang.actions');
 const grant=await withSession(actor,()=>prepareIntakeFileAction({itemId,fileId,name:'TEST-Rücksendung.png',mime:'image/png',bytes:bytes.length,sha256,captureOrigin:'warenfoto',...(deviceCapturedAt?{deviceCapturedAt}:{})}));
 if(grant.code!=='OK')throw Error('H7_RETURN_PHOTO_GRANT:'+grant.code);
 if(grant.upload){
 const url=new URL('/storage/v1/object/upload/sign/'+grant.upload.bucket+'/'+grant.upload.path,process.env.NEXT_PUBLIC_SUPABASE_URL);
 if(url.hostname!=='127.0.0.1')throw Error('H7_RETURN_PHOTO_LOOPBACK_REQUIRED');
 url.searchParams.set('token',grant.upload.token);
 const response=await fetch(url,{method:'PUT',headers:{'content-type':'image/png','x-upsert':'false'},body:new Blob([new Uint8Array(bytes).buffer],{type:'image/png'})});
 if(!response.ok)throw Error('H7_RETURN_PHOTO_UPLOAD:'+response.status);
 }
 const finished=await withSession(actor,()=>finishIntakeFileAction(fileId,undefined,customerVisible));
 if(finished.code!=='OK'||!finished.capture.files.some(file=>file.id===fileId&&file.secured))throw Error('H7_RETURN_PHOTO_FINALIZE:'+finished.code);
 return {itemId,fileId};
}

/** Exactly the existing OrderStationAttachmentPanel ports, not a second ITEM writer. */
export async function storeItemPhoto(orderId:string,itemId:string,customerVisible?:boolean){
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId}));
 if(card.code!=='OK')throw Error('TEST_ITEM_CARD:'+card.code);
 const {finalizeGalvanikHandoffAttachmentAction}=await import('@/app/warendurchlauf/actions');
 const contentSha256=createHash('sha256').update(TEST_PHOTO_BYTES).digest('hex');
 const reserved=await withSession(full,()=>reserveLegacyStationPhoto({orderId,itemId,expectedVersion:card.data.card.version,clientRequestId:randomUUID(),mimeType:'image/png',fileBytes:TEST_PHOTO_BYTES.length,contentSha256}));
 if(reserved.code!=='OK'||!reserved.data.upload)throw Error('TEST_ITEM_PHOTO_RESERVE:'+reserved.code);
 const url=new URL('/storage/v1/object/upload/sign/item-photos/'+reserved.data.upload.path,process.env.NEXT_PUBLIC_SUPABASE_URL);
 if(url.hostname!=='127.0.0.1')throw Error('TEST_ITEM_PHOTO_LOOPBACK_REQUIRED');url.searchParams.set('token',reserved.data.upload.token);
 const uploaded=await fetch(url,{method:'PUT',headers:{'content-type':'image/png','x-upsert':'false'},body:new Blob([new Uint8Array(TEST_PHOTO_BYTES).buffer],{type:'image/png'})});
 if(!uploaded.ok)throw Error('TEST_ITEM_PHOTO_UPLOAD:'+uploaded.status);
 const finalized=await withSession(full,()=>finalizeGalvanikHandoffAttachmentAction({reservationId:reserved.data.receipt.reservationId,...(customerVisible===undefined?{}:{customerVisible})}));
 if(finalized.code!=='OK'||!finalized.data.receipt.receiptId)throw Error('TEST_ITEM_PHOTO_FINALIZE:'+finalized.code);
 return finalized.data.receipt.receiptId;
}
