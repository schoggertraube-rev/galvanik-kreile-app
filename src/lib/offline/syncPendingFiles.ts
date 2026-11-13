import {readPendingEntries,retainQuarantinedPending,acknowledgePendingOriginal,acknowledgePendingWorkshopOriginal} from './pendingStore';
import type {prepareIntakeFileAction,finishIntakeFileAction,saveIntakeNoteAction} from '@/app/actions/eingang.actions';
import {recognizeNoteConcerns} from '@/lib/domain/noteConcerns';
import type {PendingWorkshopOriginal} from './pendingStore';
import type {uploadIntakeOriginal} from '@/modules/eingang/public';
export type WorkshopAcknowledgement={scope:string;entry:PendingWorkshopOriginal;result:Awaited<ReturnType<typeof import('@/app/actions/offlineWorkshop.actions').replayOfflineWorkshopAction>>};
type Ports={workshopAcknowledged?:(proof:WorkshopAcknowledgement)=>void;saveNote:typeof saveIntakeNoteAction;prepare:typeof prepareIntakeFileAction;finish:typeof finishIntakeFileAction;upload:typeof uploadIntakeOriginal;currentScope:()=>string|null;workshop?:typeof import('@/app/actions/offlineWorkshop.actions').replayOfflineWorkshopAction};
type Outcome={secured:number;acknowledged:number;blocked:number};
const running=new Map<string,Promise<Outcome>>();
/** Reuses the original registration, immutable-byte upload and secured-original receipt. */
export function syncPendingFiles(scope:string,ports:Ports):Promise<Outcome>{
 const existing=running.get(scope);if(existing)return existing;
 const work=(async()=>{
  const outcome={secured:0,acknowledged:0,blocked:0};
  // IndexedDB getAll follows random UUID keys. Replay known capture times in
  // their original order so a later file cannot create the note's base first.
  const inventory=await readPendingEntries(scope);
  const entries=inventory.filter(entry=>entry.kind!=='quarantine');
  const timed=entries.filter(entry=>entry.deviceCapturedAt&&Number.isFinite(Date.parse(entry.deviceCapturedAt)))
   .sort((a,b)=>Date.parse(a.deviceCapturedAt!)-Date.parse(b.deviceCapturedAt!));
  let cursor=0;
  const ordered=entries.map(entry=>entry.deviceCapturedAt&&Number.isFinite(Date.parse(entry.deviceCapturedAt))?timed[cursor++]:entry);
  const hasSequence=(entry:typeof entries[number])=>typeof entry.queueSequence==='number'&&Number.isSafeInteger(entry.queueSequence)&&entry.queueSequence>0;
  const sequenced=ordered.filter(hasSequence).sort((a,b)=>a.queueSequence!-b.queueSequence!);
  let sequenceCursor=0;
  const blockedItems=new Set<string>();
  for(const entry of inventory)if(entry.kind==='quarantine'&&(entry.payload?.reason==='NOTE_SYNC_METADATA_MISSING'||entry.payload?.reason==='FILE_SYNC_DEVICE_ID_MISSING')){
   const original=entry.payload.original;if(original&&typeof original==='object'&&'itemId'in original&&typeof original.itemId==='string')blockedItems.add(original.itemId);
  }
  // Keep legacy entries in their existing time-based slots; never invent a
  // historical sequence. Newly captured originals retain their actual order.
  for(const entry of ordered.map(entry=>hasSequence(entry)?sequenced[sequenceCursor++]:entry)){
   if(ports.currentScope()!==scope)break;
   // Dependent originals must not create the intake before its earlier note.
   // Other intake groups keep their existing independent recovery path.
   if(blockedItems.has(entry.itemId)){outcome.blocked++;continue;}
   if(entry.kind==='workshop'){
    try{
     if(!ports.workshop||!entry.deviceCapturedAt){outcome.blocked++;blockedItems.add(entry.itemId);continue;}
     const result=await ports.workshop(scope,entry);
     if((result.code!=='OK'&&result.code!=='PRESERVED')||!('offlineReceipt' in result)){outcome.blocked++;blockedItems.add(entry.itemId);continue;}
     outcome.secured++;
     if(ports.currentScope()!==scope)break;
     if(await acknowledgePendingWorkshopOriginal(scope,entry,result.offlineReceipt)){outcome.acknowledged++;if(ports.currentScope()===scope)ports.workshopAcknowledged?.({scope,entry,result});}
    }catch(error){outcome.blocked++;blockedItems.add(entry.itemId);console.error('[OFFLINE_WORKSHOP_SYNC_FAILED]',error instanceof Error?error.name:'UnknownError');}
    continue;
   }
   if(entry.kind==='note'){
    if(entry.expectedVersion===undefined||!entry.deviceCapturedAt){
     await retainQuarantinedPending(scope,{id:entry.id,kind:'quarantine',capturedAt:entry.deviceCapturedAt??'',payload:{reason:'NOTE_SYNC_METADATA_MISSING',original:entry}});
     outcome.blocked++;blockedItems.add(entry.itemId);continue;
    }
    try{
     const concerns=recognizeNoteConcerns(entry.text).map(item=>item.id).filter(id=>!entry.dismissed.includes(id));
     const saved=await ports.saveNote({itemId:entry.itemId,textstand:entry.textstand,text:entry.text,concerns,expectedVersion:entry.expectedVersion,deviceCapturedAt:entry.deviceCapturedAt,...(entry.context?{context:entry.context}:{})},scope);
     if(saved.code!=='OK'||saved.capture.text!==entry.text){outcome.blocked++;blockedItems.add(entry.itemId);continue;}
     outcome.secured++;
     if(ports.currentScope()!==scope)break;
     await acknowledgePendingOriginal(scope,entry.id,entry.textstand);outcome.acknowledged++;
    }catch(error){outcome.blocked++;blockedItems.add(entry.itemId);console.error('[OFFLINE_NOTE_SYNC_FAILED]',error instanceof Error?error.name:'UnknownError');}
    continue;
   }
   // Historical fingerprints are not guessed; the existing capture dialog can resume them.
   if(!Object.hasOwn(entry,'deviceId')){
    await retainQuarantinedPending(scope,{id:entry.id,kind:'quarantine',capturedAt:entry.deviceCapturedAt??'',payload:{reason:'FILE_SYNC_DEVICE_ID_MISSING',original:entry}});
    outcome.blocked++;blockedItems.add(entry.itemId);continue;
   }
   try{
    const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await entry.file.arrayBuffer())),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(ports.currentScope()!==scope)break;
    const grant=await ports.prepare({itemId:entry.itemId,fileId:entry.id,name:entry.file.name,mime:entry.file.type||'application/octet-stream',bytes:entry.file.size,sha256,...(entry.deviceId?{deviceId:entry.deviceId}:{}),...(entry.deviceCapturedAt?{deviceCapturedAt:entry.deviceCapturedAt}:{}),...(entry.captureOrigin?{captureOrigin:entry.captureOrigin}:{})},scope);
    if(grant.code!=='OK'){outcome.blocked++;blockedItems.add(entry.itemId);continue;}
    if(grant.upload)await ports.upload(grant.upload,entry.file);
    if(ports.currentScope()!==scope)break;
    const finished=await ports.finish(entry.id,scope);
    if(finished.code!=='OK'||!finished.capture.files.some(file=>file.id===entry.id&&file.secured===true)){outcome.blocked++;blockedItems.add(entry.itemId);continue;}
    outcome.secured++;
    // Goods photos need their real receipt association, not merely a stored blob.
    if(entry.context||entry.captureOrigin==='warenfoto'||ports.currentScope()!==scope)continue;
    await acknowledgePendingOriginal(scope,entry.id);outcome.acknowledged++;
   }catch(error){outcome.blocked++;blockedItems.add(entry.itemId);console.error('[OFFLINE_ORIGINAL_SYNC_FAILED]',error instanceof Error?error.name:'UnknownError');}
  }
  return outcome;
 })();running.set(scope,work);void work.finally(()=>{if(running.get(scope)===work)running.delete(scope);}).catch(error=>{console.error('[OFFLINE_SYNC_FAILED]',error instanceof Error?error.name:'UnknownError');});return work;
}
