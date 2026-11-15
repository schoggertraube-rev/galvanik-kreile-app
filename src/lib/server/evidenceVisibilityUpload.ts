import 'server-only';
import type {AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction,withTenantSavepoint,type PrivilegedTenantTransaction} from './privilegedDb';
import {recordEvidenceUploadIntent,readEvidenceUploadIntent,readEvidenceVisibilityRetrySource} from './evidenceVisibilityUploadPort';
import {changeEvidenceVisibilityInTransaction} from './evidenceVisibilityCommand';
import {EVIDENCE_VISIBILITY_COPY as copy} from '@/ui/situationCatalog';
import type {EvidenceVisibility} from '@/lib/domain/evidenceVisibility';

type Dependencies={synchronizeTask:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,markerId:string)=>Promise<string|null>};
export type UploadVisibilityResult={code:'OK';visibility?:EvidenceVisibility;visibilityPending:boolean}|{code:'UNAVAILABLE';message:string};

/** Invoked only AFTER the existing original writer has durably succeeded.
 * Intent survives a task failure; without the task receipt there is no ACK. */
export async function applyEvidenceUploadVisibility(auth:AuthorizationSnapshot,key:string,requested:boolean|undefined,deps:Dependencies):Promise<UploadVisibilityResult>{
 try{
  const intent=await withPrivilegedTenantTransaction(auth,async tx=>{
   const prior=await readEvidenceUploadIntent(tx,auth,key);
   if(requested===undefined&&!prior)return null;
   return recordEvidenceUploadIntent(tx,auth,key,requested??prior!.requested);
  });
  if(!intent)return {code:'OK',visibilityPending:false};
  return await withPrivilegedTenantTransaction(auth,async tx=>{
   let pending=intent.pending;
   if(pending){
    try{
     await withTenantSavepoint(tx,async nested=>{
      const changed=await changeEvidenceVisibilityInTransaction(nested,auth,{evidenceKey:key,customerVisible:intent.requested,expectedVersion:0,clientEventId:intent.markerId},intent.capturedAt??undefined);
      if(changed.code!=='OK')throw Error('EVIDENCE_UPLOAD_FLAG_'+changed.code);
     });
     pending=false;
    }catch(error){console.error('[EVIDENCE_UPLOAD_FLAG_RETRY_REQUIRED]',error instanceof Error?error.message:'unknown');}
   }
   const taskId=await deps.synchronizeTask(tx,auth,intent.markerId);
   const proof=await readEvidenceVisibilityRetrySource(tx,auth,intent.markerId);
   if(!proof||proof.pending!==pending||pending&&!taskId)throw Error('EVIDENCE_UPLOAD_FOLLOWUP_RECEIPT_MISSING');
   return {code:'OK',visibility:proof.visibility,visibilityPending:pending};
  });
 }catch(error){
  console.error('[EVIDENCE_UPLOAD_FOLLOWUP_UNAVAILABLE]',error instanceof Error?error.message:'unknown');
  return {code:'UNAVAILABLE',message:copy.save};
 }
}
