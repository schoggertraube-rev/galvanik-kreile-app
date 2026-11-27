'use client';
import {reportProtocolClientError} from '@/modules/logging/public';

import {logout} from '@/app/actions/auth';
import {clearLoggedOutReadState} from './logoutReadState';
import {OFFLINE_LOGOUT_COPY} from '@/ui/situationCatalog';
import {removeCacheScopeMarker} from './cacheScopeMarker';
import {syncOriginals} from './syncOriginals';
import {readServerReachability} from './serverReachability';

let notice='';
const listeners=new Set<()=>void>();
export const subscribeLogoutNotice=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export const readLogoutNotice=()=>notice;
/** The existing action ends the session first; local storage is never authority. */
export async function logoutWithReadCleanup(reason:'manual'|'inactivity'='manual'){
 const readState=document.documentElement.dataset;
 const scope=readState.offlineScope??null;
 // PL11:25/13:29: finish delayed commands with the original session before
 // ending it. Unavailable network/storage must not consume originals or stop logout.
 if(reason==='inactivity'){
  // The expired session cannot send a command. The next valid login can resume its queue.
  readState.authStatus='error';
  delete readState.offlineScope;
  delete readState.offlineLoginScope;
 }else if(scope&&readServerReachability())try{await syncOriginals(scope,()=>readState.offlineScope??null,{flushDelayed:true,workshopOnly:true});}
 catch{reportProtocolClientError('OFFLINE_LOGOUT_FLUSH_FAILED');}
 try{removeCacheScopeMarker();}catch{reportProtocolClientError('OFFLINE_CACHE_MARKER_REVOKE_FAILED');}
 // Start the server action before touching potentially broken local storage.
 let result:Awaited<ReturnType<typeof logout>>|undefined;
 let failure:unknown;
 try{result=await logout();}catch(error){failure=error;}
 // A lost server response is not a confirmed logout. Still fence local reads
 // and retain originals; do not publish the successful-logout wording.
 readState.authStatus=result?'unauthenticated':'error';
 delete readState.offlineScope;
 delete readState.offlineLoginScope;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const cleanup=await Promise.race([
  clearLoggedOutReadState(scope),
  new Promise<{cacheCleared:false;pendingCount:null}>(resolve=>{timer=setTimeout(()=>{reportProtocolClientError('OFFLINE_LOGOUT_CLEANUP_TIMEOUT');resolve({cacheCleared:false,pendingCount:null});},1500);}),
 ]);
 if(timer)clearTimeout(timer);
 notice=result?[!cleanup.cacheCleared?OFFLINE_LOGOUT_COPY.cachePending:null,cleanup.pendingCount?OFFLINE_LOGOUT_COPY.pending(cleanup.pendingCount):null].filter(Boolean).join(' '):'';
 for(const listener of listeners)listener();
 if(!result)throw failure;
 return result;
}
