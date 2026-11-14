'use server';
import {resolveAuthorization,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {offlinePartition} from '@/lib/server/offlinePartition';
import {isPendingWorkshopOriginal,isPendingFinancialOriginal,type PendingWorkshopOriginal,type PendingPhysicalWorkshopOriginal} from '@/lib/offline/pendingStore';
import {reconcileOfflineWorkshop} from '@/lib/server/offlineWorkshopConflictPort';
import {setOrderItemFinishedAction,changeOrderItemExtraWorkAction,changeOrderPickupNoticeAction} from './orders.actions';
import {isManualHandoverCommandReceipt} from '@/lib/domain/orderHandoverContract';
import {ORDER_HANDOVER_COPY} from '@/ui/situationCatalog';
import type {WorkshopRejectionReceipt} from '@/lib/offline/workshopRejectionContract';
import {createOfflineWorkshopConflictTask} from '@/modules/tasks/server-public';
import {recordIntakeTaskEffect} from '@/modules/eingang/server-public';
import {readCustomerProfile} from '@/modules/customers/server-public';
import {issueInvoiceAction,cancelInvoiceAction,applyCustomerCreditAction,payoutCustomerCreditAction} from './invoices.actions';

/** Transport composition only. Business changes still use the existing writers,
 * their real session/rights and their original N5 key. No alternate actor exists.
 */
type ScopeFailure={code:'UNAUTHENTICATED'}|{code:'FORBIDDEN'}|{code:'VALIDATION_ERROR'};
type RejectedOriginal={code:'PRESERVED';eventId:string;taskId:string;replayed:boolean;message:string;rejectionReceipt:WorkshopRejectionReceipt};
export async function replayOfflineWorkshopAction(scope:string,original:PendingPhysicalWorkshopOriginal):Promise<Awaited<ReturnType<typeof replayPhysical>>|RejectedOriginal|ScopeFailure>;
export async function replayOfflineWorkshopAction(scope:string,original:PendingWorkshopOriginal):ReturnType<typeof replayCommand>;
export async function replayOfflineWorkshopAction(scope:string,original:PendingWorkshopOriginal):Promise<Awaited<ReturnType<typeof replayCommand>>|ScopeFailure>{return replayCommand(scope,original);}
async function replayCommand(scope:string,original:PendingWorkshopOriginal){
 const auth=await resolveAuthorization();if(!auth.ok)return {code:'UNAUTHENTICATED' as const};
 if(offlinePartition(auth.data)!==scope)return {code:'FORBIDDEN' as const};
 if(!isPendingWorkshopOriginal(original)||!original.deviceCapturedAt||!Number.isFinite(Date.parse(original.deviceCapturedAt)))return {code:'VALIDATION_ERROR' as const};
 try{
  const result=await reconcileOfflineWorkshop(auth.data,original,()=>applyKnownCommand(auth.data,scope,original),
   (tx,eventId)=>createOfflineWorkshopConflictTask(tx,auth.data,eventId,{effect:(writeTx,actor,effect)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)}),readCustomerProfile);
  if(result.code==='PRESERVED'&&'rejectionReceipt'in result)return {...result,rejectionReceipt:{...result.rejectionReceipt,scope}};
  return result;
 }catch(error){console.error('[OFFLINE_WORKSHOP_RECONCILIATION_FAILED]',{name:error instanceof Error?error.name:'UnknownError',code:error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:'UNAVAILABLE'});return {code:'UNAVAILABLE' as const};}
}
async function applyKnownCommand(auth:AuthorizationSnapshot,scope:string,original:PendingWorkshopOriginal){
 if(original.command==='order.handover'){
  const result=await changeOrderPickupNoticeAction(original.input);
  if(result.code!=='OK')return result;
  const receipt=result.receipt;
  if(!isManualHandoverCommandReceipt(receipt,original.input,auth.userId))return {code:'UNAVAILABLE' as const,message:ORDER_HANDOVER_COPY.unavailable};
  return {...result,receipt,handoverCommand:original.command,offlineReceipt:{scope,clientEventId:original.input.clientEventId,deviceCapturedAt:original.deviceCapturedAt!,eventId:receipt.eventId,actorId:auth.userId}};
 }
 // Money originals share this transport/store/N5, but never the physical
 // conflict-preservation acknowledgement. Only a real financial OK is final.
 if(isPendingFinancialOriginal(original)){
  const result=original.command==='invoice.issue'?await issueInvoiceAction(original.input):original.command==='invoice.cancel'?await cancelInvoiceAction(original.input):original.command==='credit.apply'?await applyCustomerCreditAction(original.input):await payoutCustomerCreditAction(original.input);
  if(result.code!=='OK')return result;
  return {...result,financialCommand:original.command,offlineReceipt:{scope,clientEventId:original.input.clientEventId,deviceCapturedAt:original.deviceCapturedAt!,eventId:result.receipt.eventId,actorId:auth.userId}};
 }
 return replayPhysical(auth,scope,original);
}
async function replayPhysical(auth:AuthorizationSnapshot,scope:string,original:PendingPhysicalWorkshopOriginal){
 const offlineOriginal={deviceCapturedAt:original.deviceCapturedAt!,actorId:auth.userId,clientEventId:original.input.clientEventId};
 const result=await (original.command==='item.finished'?setOrderItemFinishedAction({...original.input,offlineOriginal}):changeOrderItemExtraWorkAction({...original.input,offlineOriginal}));
 if(result.code!=='OK')return result;
 return {...result,offlineReceipt:{scope,clientEventId:original.input.clientEventId,deviceCapturedAt:original.deviceCapturedAt!,eventId:result.receipt.eventId,actorId:auth.userId}};
}
