"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import type {
  RecordGoodsOutInput,
  RecordGoodsOutResult,
} from "@/lib/server/commands/recordGoodsOutCommand";

function invoiceClientEventId(goodsOutClientEventId: string): string {
  const hash = createHash("sha256")
    .update(`absprache-invoice:${goodsOutClientEventId}`)
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function recordGoodsOutAction(
  input: RecordGoodsOutInput,
): Promise<RecordGoodsOutResult> {
  const { authorizeGoodsOutInput, recordGoodsOut } = await import("@/lib/server/commands/recordGoodsOutCommand");
  // Validate and authorize before the composed invoice writer can change data.
  const authorized = await authorizeGoodsOutInput(input);
  if (authorized.code !== "AUTHORIZED") return authorized;
  const invoiceInput=input.agreement&&input.agreement.type!=='sammelrechnung'?{
    orderId:input.orderId,expectedVersion:input.expectedVersion,
    clientEventId:invoiceClientEventId(input.clientEventId),agreement:input.agreement,
  }:null;
  const invoicePort=invoiceInput?await import("@/lib/server/commands/immutableInvoiceCommand"):null;
  const [{lockDispatchCallsForGoodsOut,finishDispatchCallsAfterGoodsOut,recordDispatchCallResult},{completeOrderCallbackTask,createGoodsOutClarificationTask},{recordIntakeTaskEffect},{readCustomerProfile}]=await Promise.all([import('@/lib/server/dispatchCallPort'),import('@/modules/tasks/server-public'),import('@/modules/eingang/server-public'),import('@/modules/customers/server-public')]);
  const [{lockStorageFinalTasksForGoodsOut,finishStorageFinalTasksAfterGoodsOut},{completeStorageTaskAfterGoodsOut}]=await Promise.all([import('@/lib/server/storageFinalStagePort'),import('@/modules/tasks/server-public')]);
  const {recordStoragePostalResult}=await import('@/lib/server/storagePostalPort');
  const {retireOrderPrintJobsAfterGoodsOut}=await import('@/modules/orders/server-public');
  let callTaskIds:string[]|null=null;
  let finalTasks:Awaited<ReturnType<typeof lockStorageFinalTasksForGoodsOut>>=[];
  const result = await recordGoodsOut(input,{
    beforeOrderLock:async(tx,auth)=>{if(invoiceInput&&invoicePort)await invoicePort.lockInvoiceCreation(tx,auth.tenantId,invoiceInput);callTaskIds=await lockDispatchCallsForGoodsOut(tx,auth,input.orderId);finalTasks=await lockStorageFinalTasksForGoodsOut(tx,auth,input.orderId);},
    ...(invoiceInput&&invoicePort?{beforeWrite:async(tx:import('@/lib/server/privilegedDb').PrivilegedTenantTransaction)=>{
      const invoice=await invoicePort.createInvoice(invoiceInput,tx);
      return invoice.code==='OK'?null:{code:invoice.code,message:invoice.message};
    }}:{}),
    afterWriteFailure:async(tx,auth,receipt)=>{await createGoodsOutClarificationTask(tx,auth,{orderId:receipt.orderId,eventId:receipt.eventId},{effect:(writeTx,actor,effect)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)});},
    afterWrite:async(tx,auth)=>{
     const tasks=callTaskIds??await lockDispatchCallsForGoodsOut(tx,auth,input.orderId);
     await finishDispatchCallsAfterGoodsOut(tx,auth,tasks,(id,note)=>completeOrderCallbackTask(tx,auth,id,note,{beforeComplete:recordDispatchCallResult,effect:(writeTx,actor,effect)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)}));
     await finishStorageFinalTasksAfterGoodsOut(tx,auth,finalTasks,request=>completeStorageTaskAfterGoodsOut(tx,auth,request,{beforeComplete:recordStoragePostalResult,effect:(writeTx,actor,effect)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)}));
     await retireOrderPrintJobsAfterGoodsOut(tx,auth,{orderId:input.orderId,clientEventId:input.clientEventId});
    }
  });
  if (result.code === "OK") {
    revalidatePath("/");
    revalidatePath("/warendurchlauf");
    revalidatePath("/buchhaltung/rechnungen");
  }
  return result;
}
