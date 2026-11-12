'use server';
import {resolveAuthorization} from '@/lib/server/authorization';
import {offlinePartition} from '@/lib/server/offlinePartition';
import {isPendingWorkshopOriginal,type PendingWorkshopOriginal} from '@/lib/offline/pendingStore';
import {reconcileOfflineWorkshop} from '@/lib/server/offlineWorkshopConflictPort';
import {setOrderItemFinishedAction,changeOrderItemExtraWorkAction} from './orders.actions';
import {createOfflineWorkshopConflictTask} from '@/modules/tasks/server-public';
import {recordIntakeTaskEffect} from '@/modules/eingang/server-public';
import {readCustomerProfile} from '@/modules/customers/server-public';

/** Transport composition only. Business changes still use the existing writers,
 * their real session/rights and their original N5 key. No alternate actor exists.
 */
export async function replayOfflineWorkshopAction(scope:string,original:PendingWorkshopOriginal){
 const auth=await resolveAuthorization();if(!auth.ok)return {code:'UNAUTHENTICATED' as const};
 if(offlinePartition(auth.data)!==scope)return {code:'FORBIDDEN' as const};
 if(!isPendingWorkshopOriginal(original)||!original.deviceCapturedAt||!Number.isFinite(Date.parse(original.deviceCapturedAt)))return {code:'VALIDATION_ERROR' as const};
 const offlineOriginal={deviceCapturedAt:original.deviceCapturedAt,actorId:auth.data.userId,clientEventId:original.input.clientEventId};
 try{const result=await reconcileOfflineWorkshop(auth.data,original,async()=>original.command==='item.finished'?setOrderItemFinishedAction({...original.input,offlineOriginal}):changeOrderItemExtraWorkAction({...original.input,offlineOriginal}),
  (tx,eventId)=>createOfflineWorkshopConflictTask(tx,auth.data,eventId,{effect:(writeTx,actor,effect)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)}));
  if(result.code!=='OK'&&result.code!=='PRESERVED')return result;
  return {...result,offlineReceipt:{scope,clientEventId:original.input.clientEventId,deviceCapturedAt:original.deviceCapturedAt,eventId:result.code==='OK'?result.receipt.eventId:result.eventId,actorId:auth.data.userId}};
 }catch(error){console.error('[OFFLINE_WORKSHOP_RECONCILIATION_FAILED]',{name:error instanceof Error?error.name:'UnknownError',code:error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:'UNAVAILABLE'});return {code:'UNAVAILABLE' as const};}
}
