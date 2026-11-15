import {setEvidenceVisibilityAction} from '@/app/actions/domainAttachments.actions';
import type {ChangeEvidenceVisibilityInput} from '@/lib/domain/evidenceVisibility';
import {OFFLINE_ITEM_FINISHED_COPY} from '@/ui/situationCatalog';
import {readServerReachability} from './serverReachability';

/** PL15Nov00:28: later switches need the server and never create an original.
 * Capture-time visibility instead travels with its existing queued file. */
export async function changeEvidenceVisibilityOnline(input:ChangeEvidenceVisibilityInput):Promise<Awaited<ReturnType<typeof setEvidenceVisibilityAction>>>{
 if(!readServerReachability())return {code:'UNAVAILABLE',message:OFFLINE_ITEM_FINISHED_COPY.networkRequired};
 try{return await setEvidenceVisibilityAction(input);}
 catch(error){
  console.error('[EVIDENCE_VISIBILITY_TRANSPORT_UNAVAILABLE]',error instanceof Error?error.name:'unknown');
  return {code:'UNAVAILABLE',message:OFFLINE_ITEM_FINISHED_COPY.networkRequired};
 }
}
