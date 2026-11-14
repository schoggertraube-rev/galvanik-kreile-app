'use server';
import {resolveAuthorization,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {offlinePartition} from '@/lib/server/offlinePartition';
import {isPendingWorkshopOriginal,type PendingWorkshopOriginal,type PendingPhysicalWorkshopOriginal} from '@/lib/offline/pendingStore';
import {reconcileOfflineWorkshop} from '@/lib/server/offlineWorkshopConflictPort';
import {setOrderItemFinishedAction,changeOrderItemExtraWorkAction} from './orders.actions';
import {createOfflineWorkshopConflictTask} from '@/modules/tasks/server-public';
import {recordIntakeTaskEffect} from '@/modules/eingang/server-public';
import {readCustomerProfile} from '@/modules/customers/server-public';
import {cancelInvoiceAction,applyCustomerCreditAction} from './invoices.actions';

/** Transport composition only. Business changes still use the existing writers,
 * their real session/rights and their original N5 key. No alternate actor exists.
 */
type ScopeFailure={code:'UNAUTHENTICATED'}|{code:'FORBIDDEN'}|{code:'VALIDATION_ERROR'};
export async function replayOfflineWorkshopAction(scope:string,original:PendingPhysicalWorkshopOriginal):Promise<Awaited<ReturnType<typeof replayPhysical>>|ScopeFailure>;
export async function replayOfflineWorkshopAction(scope:string,original:PendingWorkshopOriginal):ReturnType<typeof replayCommand>;
export async function replayOfflineWorkshopAction(scope:string,original:PendingWorkshopOriginal):Promise<Awaited<ReturnType<typeof replayCommand>>|ScopeFailure>{return replayCommand(scope,original);}
async function replayCommand(scope:string,original:PendingWorkshopOriginal){
 const auth=await resolveAuthorization();if(!auth.ok)return {code:'UNAUTHENTICATED' as const};
 if(offlinePartition(auth.data)!==scope)return {code:'FORBIDDEN' as const};
 if(!isPendingWorkshopOriginal(original)||!original.deviceCapturedAt||!Number.isFinite(Date.parse(original.deviceCapturedAt)))return {code:'VALIDATION_ERROR' as const};
 // Money originals share this transport/store/N5, but never the physical
 // conflict-preservation acknowledgement. Only a real financial OK is final.
 if(original.command==='invoice.cancel'||original.command==='credit.apply'){
  const result=original.command==='invoice.cancel'?await cancelInvoiceAction(original.input):await applyCustomerCreditAction(original.input);
  if(result.code!=='OK')return result;
  return {...result,financialCommand:original.command,offlineReceipt:{scope,clientEventId:original.input.clientEventId,deviceCapturedAt:original.deviceCapturedAt,eventId:result.receipt.eventId,actorId:auth.data.userId}};
 }
 return replayPhysical(auth.data,scope,original);
}
async function replayPhysical(auth:AuthorizationSnapshot,scope:string,original:PendingPhysicalWorkshopOriginal){
 const offlineOriginal={deviceCapturedAt:original.deviceCapturedAt!,actorId:auth.userId,clientEventId:original.input.clientEventId};
 try{const result=await reconcileOfflineWorkshop(auth,original,async()=>original.command==='item.finished'?setOrderItemFinishedAction({...original.input,offlineOriginal}):changeOrderItemExtraWorkAction({...original.input,offlineOriginal}),
  (tx,eventId)=>createOfflineWorkshopConflictTask(tx,auth,eventId,{effect:(writeTx,actor,effect)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)}));
  if(result.code!=='OK'&&result.code!=='PRESERVED')return result;
  return {...result,offlineReceipt:{scope,clientEventId:original.input.clientEventId,deviceCapturedAt:original.deviceCapturedAt!,eventId:result.code==='OK'?result.receipt.eventId:result.eventId,actorId:auth.userId}};
 }catch(error){console.error('[OFFLINE_WORKSHOP_RECONCILIATION_FAILED]',{name:error instanceof Error?error.name:'UnknownError',code:error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:'UNAVAILABLE'});return {code:'UNAVAILABLE' as const};}
}
