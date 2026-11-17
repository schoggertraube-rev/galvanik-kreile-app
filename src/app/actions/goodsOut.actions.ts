"use server";
import {observeAction,subjectForAction} from '@/modules/logging/server-public';
import {readLoggingSettings} from '@/modules/fundament/server-public';
import {isShipmentGroupInput,type ShipmentGroupInput,type ShipmentGroupResult} from '@/lib/domain/shipmentGroupContract';
import {readManualShipmentGroup} from '@/modules/orders/server-public';
import {readInvoiceVat} from "@/modules/accounting/server-public";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import type {
  RecordGoodsOutInput,
  RecordGoodsOutResult,
  GoodsOutComposition,
} from "@/lib/server/commands/recordGoodsOutCommand";

function invoiceClientEventId(goodsOutClientEventId: string): string {
  const hash = createHash("sha256")
    .update(`absprache-invoice:${goodsOutClientEventId}`)
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

async function goodsOutComposition(input:RecordGoodsOutInput):Promise<GoodsOutComposition>{
  const invoiceInput=input.agreement&&input.agreement.type!=='sammelrechnung'?{
    orderId:input.orderId,expectedVersion:input.expectedVersion,
    clientEventId:invoiceClientEventId(input.clientEventId),agreement:input.agreement,
  }:null;
  const invoicePort=invoiceInput?await import("@/lib/server/commands/immutableInvoiceCommand"):null;
  const [{lockDispatchCallsForGoodsOut,finishDispatchCallsAfterGoodsOut,recordDispatchCallResult},{completeOrderCallbackTask,createGoodsOutClarificationTask},{recordIntakeTaskEffect},{readCustomerProfile}]=await Promise.all([import('@/lib/server/dispatchCallPort'),import('@/modules/tasks/server-public'),import('@/modules/eingang/server-public'),import('@/modules/customers/server-public')]);
  const [{lockStorageFinalTasksForGoodsOut,finishStorageFinalTasksAfterGoodsOut},{completeStorageTaskAfterGoodsOut}]=await Promise.all([import('@/lib/server/storageFinalStagePort'),import('@/modules/tasks/server-public')]);
  const {recordStoragePostalResult}=await import('@/lib/server/storagePostalPort');
  const {retireOrderPrintJobsAfterGoodsOut}=await import('@/modules/orders/server-public');
  const {readCustomerCreditInTransaction}=await import('@/modules/accounting/server-public');
  let callTaskIds:string[]|null=null;
  let finalTasks:Awaited<ReturnType<typeof lockStorageFinalTasksForGoodsOut>>|null=null;
  return {
    readCredit:(tx,auth,customerId)=>readCustomerCreditInTransaction(tx,auth.tenantId,customerId,readCustomerProfile),
    beforeOrderLock:async(tx,auth)=>{if(invoiceInput&&invoicePort)await invoicePort.lockInvoiceCreation(tx,auth.tenantId,invoiceInput);callTaskIds=await lockDispatchCallsForGoodsOut(tx,auth,input.orderId);finalTasks=await lockStorageFinalTasksForGoodsOut(tx,auth,input.orderId);},
    ...(invoiceInput&&invoicePort?{beforeWrite:async(tx:import('@/lib/server/privilegedDb').PrivilegedTenantTransaction)=>{
      const {readShippingSettingsInTransaction}=await import('@/modules/fundament/server-public');
      const invoice=await invoicePort.createInvoice(invoiceInput,tx,readInvoiceVat,readShippingSettingsInTransaction);
      return invoice.code==='OK'?null:{code:invoice.code,message:invoice.message};
    }}:{}),
    afterWriteFailure:async(tx,auth,receipt)=>{await createGoodsOutClarificationTask(tx,auth,{orderId:receipt.orderId,eventId:receipt.eventId},{effect:(writeTx,actor,effect)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)});},
    afterWrite:async(tx,auth)=>{
     const tasks=callTaskIds??await lockDispatchCallsForGoodsOut(tx,auth,input.orderId);
     await finishDispatchCallsAfterGoodsOut(tx,auth,tasks,(id,note)=>completeOrderCallbackTask(tx,auth,id,note,{beforeComplete:recordDispatchCallResult,effect:(writeTx,actor,effect)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)}));
     await finishStorageFinalTasksAfterGoodsOut(tx,auth,finalTasks??await lockStorageFinalTasksForGoodsOut(tx,auth,input.orderId),request=>completeStorageTaskAfterGoodsOut(tx,auth,request,{beforeComplete:recordStoragePostalResult,effect:(writeTx,actor,effect)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)}));
     await retireOrderPrintJobsAfterGoodsOut(tx,auth,{orderId:input.orderId,clientEventId:input.clientEventId});
    }
  };
}
export async function recordGoodsOutAction(input:RecordGoodsOutInput):Promise<RecordGoodsOutResult>;
export async function recordGoodsOutAction(input:ShipmentGroupInput):Promise<ShipmentGroupResult>;
export async function recordGoodsOutAction(input:RecordGoodsOutInput|ShipmentGroupInput):Promise<RecordGoodsOutResult|ShipmentGroupResult>{
 return observeAction('recordGoodsOutAction',subjectForAction('recordGoodsOutAction',input),async()=>{
 const {authorizeGoodsOutInput,recordGoodsOut,recordShipmentGroupGoodsOut}=await import('@/lib/server/commands/recordGoodsOutCommand');
 let result:RecordGoodsOutResult|ShipmentGroupResult;
 if(isShipmentGroupInput(input))result=await recordShipmentGroupGoodsOut(input,goodsOutComposition,readManualShipmentGroup);
 else{
  const authorized=await authorizeGoodsOutInput(input);if(authorized.code!=='AUTHORIZED')return authorized;
  result=await recordGoodsOut(authorized.input,await goodsOutComposition(authorized.input));
 }
 if(result.code==='OK'){revalidatePath('/');revalidatePath('/warendurchlauf');revalidatePath('/buchhaltung/rechnungen');}
 return result;

 },readLoggingSettings);
}
