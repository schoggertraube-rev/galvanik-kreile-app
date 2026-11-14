import type {replayOfflineWorkshopAction} from '@/app/actions/offlineWorkshop.actions';
import {isPendingWorkshopAcknowledgement,isPendingConfirmedOriginal,type PendingWorkshopOriginal} from './pendingStore';
import {isWorkshopRejectionReceipt} from './workshopRejectionContract';
type Result=Awaited<ReturnType<typeof replayOfflineWorkshopAction>>;

/** PL13Nov13:29: one same-origin transport to the existing replay writer.
 * A successful HTTP status alone never acknowledges or deletes an original. */
export async function replayOfflineWorkshopHttp(scope:string,original:PendingWorkshopOriginal,options:{keepalive?:boolean}={}):Promise<Result>{
 try{
  const response=await fetch('/api/offline/replay',{method:'POST',credentials:'same-origin',cache:'no-store',keepalive:options.keepalive===true,headers:{'content-type':'application/json'},body:JSON.stringify({scope,original})});
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
 }catch(error){console.error('[OFFLINE_REPLAY_HTTP_UNAVAILABLE]',error instanceof Error?error.name:'UnknownError');return {code:'UNAVAILABLE'};}
}
