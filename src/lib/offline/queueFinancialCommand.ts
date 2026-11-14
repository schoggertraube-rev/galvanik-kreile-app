import {retainPendingWorkshopOriginal,isPendingWorkshopAcknowledgement,type PendingFinancialCommand,type PendingHandoverCommand,type PendingConfirmedCommand,type PendingWorkshopOriginal} from './pendingStore';
import {syncOriginals} from './syncOriginals';
import type {WorkshopAcknowledgement} from './syncPendingFiles';
import {CUSTOMER_CREDIT_COPY,ORDER_HANDOVER_COPY} from '@/ui/situationCatalog';
import {canonicalJson} from '@/lib/domain/canonicalJson';
import {isWorkshopRejectionReceipt} from './workshopRejectionContract';

type FinancialAcknowledgement=Extract<WorkshopAcknowledgement['result'],{financialCommand:string}>;
type HandoverAcknowledgement=Extract<WorkshopAcknowledgement['result'],{handoverCommand:string}>;
type FinancialFailure=Exclude<WorkshopAcknowledgement['result'],{code:'OK'|'PRESERVED'}>&{message:string};
/** A08-11: retain first in the one scoped store, then use its one dispatcher.
 * Queue absence or a cancellation PDF alone is never financial success. */
export function queueFinancialCommand(scope:string,command:PendingFinancialCommand,currentScope:()=>string|null){return queueConfirmedCommand(scope,command,currentScope);}
export function queueHandoverCommand(scope:string,command:PendingHandoverCommand,currentScope:()=>string|null){return queueConfirmedCommand(scope,command,currentScope);}
function queueConfirmedCommand(scope:string,command:PendingFinancialCommand,currentScope:()=>string|null):Promise<FinancialAcknowledgement|FinancialFailure>;
function queueConfirmedCommand(scope:string,command:PendingHandoverCommand,currentScope:()=>string|null):Promise<HandoverAcknowledgement|FinancialFailure>;
async function queueConfirmedCommand(scope:string,command:PendingConfirmedCommand,currentScope:()=>string|null){
 const unavailable=command.command==='order.handover'?ORDER_HANDOVER_COPY.unavailable:CUSTOMER_CREDIT_COPY.unavailable;
 if(currentScope()!==scope)return {code:'UNAVAILABLE' as const,message:unavailable};
 const original:PendingWorkshopOriginal={...command,id:command.input.clientEventId,itemId:command.command==='invoice.issue'||command.command==='order.handover'?command.input.orderId:command.command==='credit.payout'?command.input.customerId:command.input.invoiceId,kind:'workshop',deviceCapturedAt:new Date().toISOString()};
 const acknowledgement:{value:FinancialAcknowledgement|HandoverAcknowledgement|null}={value:null};
 const failure:{value:FinancialFailure|null}={value:null};
 const accepted=(event:Event)=>{
  const proof=(event as CustomEvent<WorkshopAcknowledgement>).detail;
  if(!proof||currentScope()!==scope||proof.scope!==scope||proof.entry.id!==original.id||proof.entry.command!==original.command)return;
  if(proof.result.code==='OK'&&('financialCommand'in proof.result&&proof.result.financialCommand===original.command||'handoverCommand'in proof.result&&proof.result.handoverCommand===original.command)
    &&canonicalJson(proof.entry.input)===canonicalJson(original.input)
    &&isPendingWorkshopAcknowledgement(scope,proof.entry,proof.result))acknowledgement.value=proof.result;
 };
 const rejected=(event:Event)=>{
  const proof=(event as CustomEvent<WorkshopAcknowledgement>).detail;
  if(!proof||currentScope()!==scope||proof.scope!==scope||proof.entry.id!==original.id||proof.entry.command!==original.command||proof.result.code==='OK')return;
  if('rejectionReceipt'in proof.result&&isWorkshopRejectionReceipt(scope,proof.entry,proof.result.rejectionReceipt)){
   failure.value={code:proof.result.rejectionReceipt.rejection,message:'message'in proof.result&&typeof proof.result.message==='string'?proof.result.message:unavailable};return;
  }
  if(proof.result.code==='PRESERVED')return;
  failure.value={...proof.result,message:'message'in proof.result&&typeof proof.result.message==='string'?proof.result.message:unavailable};
 };
 window.addEventListener('kreile-workshop-acknowledged',accepted);
 window.addEventListener('kreile-workshop-rejected',rejected);
 try{
  await retainPendingWorkshopOriginal(scope,original);
  if(currentScope()!==scope)return {code:'UNAVAILABLE' as const,message:unavailable};
  await syncOriginals(scope,currentScope);
  return acknowledgement.value??failure.value??{code:'UNAVAILABLE' as const,message:unavailable};
 }finally{window.removeEventListener('kreile-workshop-acknowledged',accepted);window.removeEventListener('kreile-workshop-rejected',rejected);}
}
