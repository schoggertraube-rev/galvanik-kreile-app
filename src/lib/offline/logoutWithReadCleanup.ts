'use client';
import {logout} from '@/app/actions/auth';
import {clearLoggedOutReadState} from './logoutReadState';
import {OFFLINE_LOGOUT_COPY} from '@/ui/situationCatalog';

let notice='';
const listeners=new Set<()=>void>();
export const subscribeLogoutNotice=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export const readLogoutNotice=()=>notice;
/** The existing action ends the session first; local storage is never authority. */
export async function logoutWithReadCleanup(){
 const scope=document.documentElement.dataset.offlineScope??null;
 // Start the server action before touching potentially broken local storage.
 let result:Awaited<ReturnType<typeof logout>>|undefined;
 let failure:unknown;
 try{result=await logout();}catch(error){failure=error;}
 // A lost server response is not a confirmed logout. Still fence local reads
 // and retain originals; do not publish the successful-logout wording.
 document.documentElement.dataset.authStatus=result?'unauthenticated':'error';
 delete document.documentElement.dataset.offlineScope;
 delete document.documentElement.dataset.offlineLoginScope;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const cleanup=await Promise.race([
  clearLoggedOutReadState(scope),
  new Promise<{cacheCleared:false;pendingCount:null}>(resolve=>{timer=setTimeout(()=>{console.error('[OFFLINE_LOGOUT_CLEANUP_TIMEOUT]');resolve({cacheCleared:false,pendingCount:null});},1500);}),
 ]);
 if(timer)clearTimeout(timer);
 notice=result?[!cleanup.cacheCleared?OFFLINE_LOGOUT_COPY.cachePending:null,cleanup.pendingCount?OFFLINE_LOGOUT_COPY.pending(cleanup.pendingCount):null].filter(Boolean).join(' '):'';
 for(const listener of listeners)listener();
 if(!result)throw failure;
 return result;
}
