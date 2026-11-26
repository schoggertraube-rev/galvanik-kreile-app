
import {reportProtocolClientError} from '@/modules/logging/public';
import type {replayOfflineWorkshopAction} from '@/app/actions/offlineWorkshop.actions';
import {isPendingWorkshopAcknowledgement,isPendingConfirmedOriginal,requestPendingReplay,type PendingWorkshopOriginal} from './pendingStore';
import {isWorkshopRejectionReceipt} from './workshopRejectionContract';
type Result=Awaited<ReturnType<typeof replayOfflineWorkshopAction>>;

/** Leave the document using the same pending command dispatcher for either lifecycle signal. */
export function observeDelayedCommandExit(flush: () => void): () => void {
 const hidden = () => { if (document.visibilityState === 'hidden') flush(); };
 window.addEventListener('pagehide', flush);
 document.addEventListener('visibilitychange', hidden);
 return () => {
  window.removeEventListener('pagehide', flush);
  document.removeEventListener('visibilitychange', hidden);
 };
}

export function handOffClosingMail(scope: string, keys: readonly string[]): boolean {
 if (!keys.length) return false;
 const worker = navigator.serviceWorker?.controller;
 if (!worker) return false;
 try {
  worker.postMessage({ type: 'kreile-flush-pending-mail', scope, keys });
  return true;
 } catch {
  reportProtocolClientError('OFFLINE_SYNC_UNAVAILABLE');
  return false;
 }
}

/** PL13Nov13:29: one same-origin transport to the existing replay writer.
 * A successful HTTP status alone never acknowledges or deletes an original. */
export async function replayOfflineWorkshopHttp(scope:string,original:PendingWorkshopOriginal,options:{keepalive?:boolean}={}):Promise<Result>{
 try{
  const response=await requestPendingReplay(scope,original,options.keepalive===true);
  const body:unknown=await response.json();
  if(response.ok&&body&&typeof body==='object'&&'code'in body&&body.code==='PRESERVED'&&'rejectionReceipt'in body&&isWorkshopRejectionReceipt(scope,original,body.rejectionReceipt))return body as Result;
  if(isPendingConfirmedOriginal(original)&&body&&typeof body==='object'&&'code'in body&&['CONFLICT','FORBIDDEN','VALIDATION_ERROR','NOT_FOUND','UNAUTHENTICATED','UNAVAILABLE'].includes(String(body.code)))return body as Result;
  if(!response.ok){
   if(response.status===401)return {code:'UNAUTHENTICATED'};
   if(response.status===403)return {code:'FORBIDDEN'};
   if(response.status===400||response.status===413)return {code:'VALIDATION_ERROR'};
   return {code:'UNAVAILABLE'};
  }
  if(!isPendingWorkshopAcknowledgement(scope,original,body))return {code:'UNAVAILABLE'};
  return body as Result;
 }catch{reportProtocolClientError('OFFLINE_REPLAY_HTTP_UNAVAILABLE');return {code:'UNAVAILABLE'};}
}
