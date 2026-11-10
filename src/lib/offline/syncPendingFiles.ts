import {readPendingOriginals,acknowledgePendingOriginal} from './pendingStore';
import type {prepareIntakeFileAction,finishIntakeFileAction,saveIntakeNoteAction} from '@/app/actions/eingang.actions';
import {recognizeNoteConcerns} from '@/lib/domain/noteConcerns';
import type {uploadIntakeOriginal} from '@/modules/eingang/public';
type Ports={saveNote:typeof saveIntakeNoteAction;prepare:typeof prepareIntakeFileAction;finish:typeof finishIntakeFileAction;upload:typeof uploadIntakeOriginal;currentScope:()=>string|null};
type Outcome={secured:number;acknowledged:number;blocked:number};
const running=new Map<string,Promise<Outcome>>();
/** Reuses the original registration, immutable-byte upload and secured-original receipt. */
export function syncPendingFiles(scope:string,ports:Ports):Promise<Outcome>{
 const existing=running.get(scope);if(existing)return existing;
 const work=(async()=>{
  const outcome={secured:0,acknowledged:0,blocked:0};
  for(const entry of await readPendingOriginals(scope)){
   if(ports.currentScope()!==scope)break;
   if(entry.kind==='note'){
    if(entry.expectedVersion===undefined||!entry.deviceCapturedAt)continue;
    try{
     const concerns=recognizeNoteConcerns(entry.text).map(item=>item.id).filter(id=>!entry.dismissed.includes(id));
     const saved=await ports.saveNote({itemId:entry.itemId,textstand:entry.textstand,text:entry.text,concerns,expectedVersion:entry.expectedVersion,deviceCapturedAt:entry.deviceCapturedAt,...(entry.context?{context:entry.context}:{})},scope);
     if(saved.code!=='OK'||saved.capture.text!==entry.text){outcome.blocked++;continue;}
     outcome.secured++;
     if(ports.currentScope()!==scope)break;
     await acknowledgePendingOriginal(scope,entry.id,entry.textstand);outcome.acknowledged++;
    }catch(error){outcome.blocked++;console.error('[OFFLINE_NOTE_SYNC_FAILED]',error instanceof Error?error.name:'UnknownError');}
    continue;
   }
   // Historical fingerprints are not guessed; the existing capture dialog can resume them.
   if(entry.kind!=='file'||!Object.hasOwn(entry,'deviceId'))continue;
   try{
    const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await entry.file.arrayBuffer())),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(ports.currentScope()!==scope)break;
    const grant=await ports.prepare({itemId:entry.itemId,fileId:entry.id,name:entry.file.name,mime:entry.file.type||'application/octet-stream',bytes:entry.file.size,sha256,...(entry.deviceId?{deviceId:entry.deviceId}:{}),...(entry.deviceCapturedAt?{deviceCapturedAt:entry.deviceCapturedAt}:{}),...(entry.captureOrigin?{captureOrigin:entry.captureOrigin}:{})},scope);
    if(grant.code!=='OK'){outcome.blocked++;continue;}
    if(grant.upload)await ports.upload(grant.upload,entry.file);
    if(ports.currentScope()!==scope)break;
    const finished=await ports.finish(entry.id,scope);
    if(finished.code!=='OK'||!finished.capture.files.some(file=>file.id===entry.id&&file.secured===true)){outcome.blocked++;continue;}
    outcome.secured++;
    // Goods photos need their real receipt association, not merely a stored blob.
    if(entry.context||entry.captureOrigin==='warenfoto'||ports.currentScope()!==scope)continue;
    await acknowledgePendingOriginal(scope,entry.id);outcome.acknowledged++;
   }catch(error){outcome.blocked++;console.error('[OFFLINE_ORIGINAL_SYNC_FAILED]',error instanceof Error?error.name:'UnknownError');}
  }
  return outcome;
 })();running.set(scope,work);void work.finally(()=>{if(running.get(scope)===work)running.delete(scope);}).catch(()=>{});return work;
}
