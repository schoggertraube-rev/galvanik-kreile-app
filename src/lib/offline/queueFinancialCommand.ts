import {retainPendingWorkshopOriginal,isPendingWorkshopAcknowledgement,type PendingFinancialCommand,type PendingWorkshopOriginal} from './pendingStore';
import {canonicalJson} from '@/lib/domain/canonicalJson';
import {isWorkshopRejectionReceipt,type WorkshopRejectionReceipt} from './workshopRejectionContract';
import {syncOriginals} from './syncOriginals';
import type {WorkshopAcknowledgement} from './syncPendingFiles';
import {CUSTOMER_CREDIT_COPY} from '@/ui/situationCatalog';

type FinancialAcknowledgement=Extract<WorkshopAcknowledgement['result'],{financialCommand:string}>;
type FinancialFailure=Exclude<WorkshopAcknowledgement['result'],{code:'OK'|'PRESERVED'}>&{message:string;rejectionReceipt?:WorkshopRejectionReceipt};
/** A08-11: retain first in the one scoped store, then use its one dispatcher.
 * Queue absence or a cancellation PDF alone is never financial success. */
export async function queueFinancialCommand(scope:string,command:PendingFinancialCommand,currentScope:()=>string|null){
 if(currentScope()!==scope)return {code:'UNAVAILABLE' as const,message:CUSTOMER_CREDIT_COPY.unavailable};
 const original:PendingWorkshopOriginal={...command,id:command.input.clientEventId,itemId:command.command==='credit.payout'?command.input.customerId:command.input.invoiceId,kind:'workshop',deviceCapturedAt:new Date().toISOString()};
 const acknowledgement:{value:FinancialAcknowledgement|null}={value:null};
 const failure:{value:FinancialFailure|null}={value:null};
 const accepted=(event:Event)=>{
  const proof=(event as CustomEvent<WorkshopAcknowledgement>).detail;
  if(!proof||currentScope()!==scope||proof.scope!==scope||proof.entry.id!==original.id||proof.entry.command!==original.command)return;
  if(proof.result.code==='OK'&&'financialCommand'in proof.result&&proof.result.financialCommand===original.command
   &&canonicalJson(proof.entry.input)===canonicalJson(original.input)&&isPendingWorkshopAcknowledgement(scope,proof.entry,proof.result))acknowledgement.value=proof.result;
 };
 const rejected=(event:Event)=>{
  const proof=(event as CustomEvent<WorkshopAcknowledgement>).detail;
  if(!proof||currentScope()!==scope||proof.scope!==scope||proof.entry.id!==original.id||proof.entry.command!==original.command||canonicalJson(proof.entry.input)!==canonicalJson(original.input)||proof.result.code==='OK')return;
  if('rejectionReceipt'in proof.result){
   if(!isWorkshopRejectionReceipt(scope,proof.entry,proof.result.rejectionReceipt))return;
   failure.value={...proof.result,code:proof.result.rejectionReceipt.rejection,message:'message'in proof.result&&typeof proof.result.message==='string'?proof.result.message:CUSTOMER_CREDIT_COPY.unavailable};return;
  }
  failure.value={...proof.result,message:'message'in proof.result&&typeof proof.result.message==='string'?proof.result.message:CUSTOMER_CREDIT_COPY.unavailable};
 };
 window.addEventListener('kreile-workshop-acknowledged',accepted);
 window.addEventListener('kreile-workshop-rejected',rejected);
 try{
  await retainPendingWorkshopOriginal(scope,original);
  if(currentScope()!==scope)return {code:'UNAVAILABLE' as const,message:CUSTOMER_CREDIT_COPY.unavailable};
  await syncOriginals(scope,currentScope,{followUp:true});
  if(currentScope()!==scope)return {code:'UNAVAILABLE' as const,message:CUSTOMER_CREDIT_COPY.unavailable};
  return acknowledgement.value??failure.value??{code:'UNAVAILABLE' as const,message:command.command==='invoice.cancel'?CUSTOMER_CREDIT_COPY.pending:CUSTOMER_CREDIT_COPY.unavailable};
 }finally{window.removeEventListener('kreile-workshop-acknowledged',accepted);window.removeEventListener('kreile-workshop-rejected',rejected);}
}
