"use server";
import {FINANCIAL_ACCESS_COPY} from '@/ui/financialAccessCopy';
import {recordObservedFailure} from '@/lib/server/actionObservation';
import {observeAction,subjectForAction,logTechnical} from '@/modules/logging/server-public';
import {readObservedAuthorization} from '@/lib/server/actionObservation';
import {readLoggingSettings} from '@/modules/fundament/server-public';
import {repairInvoiceReissueTask} from '@/lib/server/commands/immutableInvoiceCommand';
import {readCacheLoginScope} from '@/lib/server/authBootstrap';
import {canSynchronizeIntakeMailbox} from "@/lib/auth/authorizationContract";
import {repairEvidenceVisibilityTask} from '@/lib/server/evidenceVisibilityUploadPort';
import {applyEvidenceUploadVisibility} from '@/lib/server/evidenceVisibilityUpload';
import {EVIDENCE_VISIBILITY_COPY,INCOMING_INVOICE_COPY} from '@/ui/situationCatalog';
import {repairCollectionFollowupTask} from '@/lib/server/commands/recordGoodsOutCommand';
import {repairProductionPricingTask} from '@/lib/server/productionSnapshotPort';
import {repairCancellationCreditTask} from '@/lib/server/commands/customerCreditCommand';
import {offlinePartition} from "@/lib/server/offlinePartition";
import {PACKAGE_ASSIGN_COPY} from "@/ui/situationCatalog";
import {quoteOperationContext,canReadQuoteForGoods} from "@/lib/server/quoteAuthorization";

import {listOpenQuotesCommand,readPackageQuoteHistory} from '@/modules/quotes/server-public';
import {readPackageOrderCustomers,createInitialOrderPrintJobs} from '@/modules/orders/server-public';
import type {OrderIntakeTransactionBinding} from '@/lib/server/commands/orderIntakeCommand';
const queueOrderPrints:OrderIntakeTransactionBinding['after']=(tx,auth,receipt)=>createInitialOrderPrintJobs(tx,auth,receipt.orderId,receipt.customerDisplayName,receipt.items.map(item=>item.id));
import type {PackageCustomerHistory} from '@/lib/server/packageIntakeContextPort';
import {readPackageExpectation} from '@/modules/eingang/server-public';
import type {IntakeCaptureResult} from '@/modules/eingang/public';
async function withPackageExpectation(result:IntakeCaptureResult):Promise<IntakeCaptureResult>{
 if(result.code!=='OK'||result.capture.recognition?.kind!=='ware')return result;
 try{
  const auth=await resolveAuthorization();if(!auth.ok)return result;
  const quoteContext=quoteOperationContext(auth.data);
  const canReadExpected=canReadQuoteForGoods(auth.data);
  const quotes=canReadExpected?await listOpenQuotesCommand(quoteContext,result.capture.customerId??undefined):null;
  const history=!result.capture.customerId?await readPackageQuoteHistory(auth.data,result.capture.recognition?.text??result.capture.text??''):[];
  result.capture.packageContext=await withPrivilegedTenantTransaction(auth.data,async tx=>{
   const orderHistory:PackageCustomerHistory[]=[];
   if(!result.capture.customerId)for(const row of await readPackageOrderCustomers(tx,auth.data,result.capture.recognition?.text??result.capture.text??'')){const customer=await readCustomerProfile(tx,auth.data.tenantId,row.customerId);if(customer)orderHistory.push({...row,customerName:customer.name,source:'order'});}
   return readPackageExpectation(tx,auth.data,result.capture,quotes,history,orderHistory);
  });
 }catch{recordObservedFailure('PACKAGE_EXPECTATION_READ_FAILED');result.capture.packageContext={status:'UNAVAILABLE',message:PACKAGE_ASSIGN_COPY.unavailable};}
 return result;
}

import { createHash,randomUUID } from "node:crypto";
import { after } from "next/server";
import {revalidatePath} from "next/cache";
import { getAppSession } from "@/lib/server/appSession";
import {readIntakeMessages} from '@/modules/eingang/server-public';
export async function getIntakeMessagesAction(filter:unknown='offen'){const device=!!filter&&typeof filter==='object'&&!Array.isArray(filter)&&Object.keys(filter).length===1&&'purpose' in filter&&filter.purpose==='device';const result=await readIntakeMessages(device?'alle':filter,undefined,device?new Date(Date.now()-24*60*60*1000).toISOString():undefined);return result.code==='OK'||device&&result.code==='FORBIDDEN'?{...result,serverReadAt:new Date().toISOString(),cacheLoginScope:await readCacheLoginScope()}:result;}
import {readIntakeAssignment,assignIntakeCustomer,setIntakeNoBusiness,createCustomerForIntake} from '@/modules/eingang/server-public';
export async function getIntakeAssignmentAction(input:unknown){return readIntakeAssignment(input,readCustomerProfile);}
export async function assignIntakeCustomerAction(input:unknown){
 return observeAction('assignIntakeCustomerAction',subjectForAction('assignIntakeCustomerAction',input),async()=>{return assignIntakeCustomer(input,readCustomerProfile);
 },readLoggingSettings);
}
export async function setIntakeNoBusinessAction(input:unknown){
 return observeAction('setIntakeNoBusinessAction',subjectForAction('setIntakeNoBusinessAction',input),async()=>{return setIntakeNoBusiness(input);
 },readLoggingSettings);
}
export async function createCustomerForIntakeAction(input:unknown){
 return observeAction('createCustomerForIntakeAction',subjectForAction('createCustomerForIntakeAction',input),async()=>{return createCustomerForIntake(input,createCustomerInTransaction,readCustomerProfile);
 },readLoggingSettings);
}
import {selectIntakeConcern,finishIntakeUse,reopenIntake} from '@/modules/eingang/server-public';
export async function selectIntakeConcernAction(input:unknown){
 return observeAction('selectIntakeConcernAction',subjectForAction('selectIntakeConcernAction',input),async()=>{return selectIntakeConcern(input);
 },readLoggingSettings);
}
export async function finishIntakeUseAction(input:unknown){
 return observeAction('finishIntakeUseAction',subjectForAction('finishIntakeUseAction',input),async()=>{return finishIntakeUse(input);
 },readLoggingSettings);
}
export async function reopenIntakeAction(input:unknown){
 return observeAction('reopenIntakeAction',subjectForAction('reopenIntakeAction',input),async()=>{return reopenIntake(input);
 },readLoggingSettings);
}
import {createIntakeMailFailureTask,createMailboxFetchRetryTask,saveTask,completeTask,readTask,createMissingGoodsTask,createOrderHandoverTask,type TaskEffectRequest} from '@/modules/tasks/server-public';
import {createDispatchCall,recordDispatchCallResult,readDispatchCallRequirement,protectDispatchCallTask,readCompletedDispatchCallReceipt} from '@/lib/server/dispatchCallPort';
import {DISPATCH_CALL_COPY} from '@/ui/situationCatalog';
import {createStorageFinalTask,readStorageFinalTaskReceipt,protectStorageFinalTask} from '@/lib/server/storageFinalStagePort';
import {recordStoragePostalResult,readStoragePostalTask,protectStoragePostalTask} from '@/lib/server/storagePostalPort';
import type {TaskOpenRequest} from '@/modules/tasks/public';
import {recordIntakeTaskEffect,recognizeInvoicePdf} from '@/modules/eingang/server-public';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
const taskEffects={beforeComplete:async(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,task:import('@/modules/tasks/public').TaskRecord,input:import('@/modules/tasks/public').TaskCompleteInput)=>{if(!await repairInvoiceReissueTask(tx,auth,task,recognizeInvoicePdf)){const creditBlocked=await repairCancellationCreditTask(tx,auth,task);if(creditBlocked)return creditBlocked;}await repairCollectionFollowupTask(tx,auth,task);await repairProductionPricingTask(tx,auth,task);await repairEvidenceVisibilityTask(tx,auth,task);const blocked=await recordDispatchCallResult(tx,auth,task,input);if(blocked)return blocked;return recordStoragePostalResult(tx,auth,task,input);},effect:async(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:TaskEffectRequest)=>{
 const blocked=await protectDispatchCallTask(tx,auth,input);if(blocked)return blocked;
 const storageBlocked=await protectStorageFinalTask(tx,auth,input);if(storageBlocked)return storageBlocked;
 await protectStoragePostalTask(tx,auth,input);
 return recordIntakeTaskEffect(tx,auth,input,readCustomerProfile);
}};
import {createInvoiceClarificationTask,resolveInvoiceClarificationTask} from '@/modules/tasks/server-public';
import {readIncomingInvoice,saveIncomingInvoice,changeIncomingInvoice,readInvoiceTaskContext} from '@/modules/eingang/server-public';
import {searchOrderIntakeCustomers} from '@/lib/server/orderIntakeRead';
const invoiceTaskEffects={...taskEffects,readInvoice:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string)=>readInvoiceTaskContext(tx,auth,id,readCustomerProfile)};
const invoiceEffects={readCustomer:readCustomerProfile,updateCustomer:updateCustomerInTransaction,
 findSuppliers:(auth:AuthorizationSnapshot,query:string,by:'vat'|'name')=>searchOrderIntakeCustomers(auth,{query},{exactSupplier:by}),
 createTask:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{invoiceId:string;clientKey:string;reason:string})=>createInvoiceClarificationTask(tx,auth,input,invoiceTaskEffects),
 resolveTask:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{invoiceId:string;taskId:string;note:string})=>resolveInvoiceClarificationTask(tx,auth,input,invoiceTaskEffects)};
export async function getIncomingInvoiceAction(input:unknown){return readIncomingInvoice(input,invoiceEffects);}
export async function saveIncomingInvoiceAction(input:unknown){
 return observeAction('saveIncomingInvoiceAction',subjectForAction('saveIncomingInvoiceAction',input),async()=>{return saveIncomingInvoice(input,invoiceEffects);
 },readLoggingSettings);
}
export async function changeIncomingInvoiceStatusAction(input:unknown){
 return observeAction('changeIncomingInvoiceStatusAction',subjectForAction('changeIncomingInvoiceStatusAction',input),async()=>{return changeIncomingInvoice(input,invoiceEffects);
 },readLoggingSettings);
}
export async function clarifyIncomingInvoiceAction(input:unknown){
 return observeAction('clarifyIncomingInvoiceAction',subjectForAction('clarifyIncomingInvoiceAction',input),async()=>{return changeIncomingInvoice(input,invoiceEffects,true);
 },readLoggingSettings);
}
/** Supplier selection uses the same canonical customer search and stored profiles. */
export async function searchInvoiceSuppliersAction(query:string){
 return observeAction('searchInvoiceSuppliersAction',subjectForAction('searchInvoiceSuppliersAction',query),async()=>{
 const auth=await resolveAuthorization();if(!auth.ok)return {code:'UNAUTHENTICATED' as const,message:'Sitzung nicht verfügbar.'};
 if(!hasAuthorizationArea(auth.data,'buchhaltung'))return {code:'FORBIDDEN' as const,message:FINANCIAL_ACCESS_COPY.bookkeepingMissing};
 if(typeof query!=='string'||query.length>200)return {code:'VALIDATION_ERROR' as const,message:'Suchtext ist ungültig.'};
 try{
  const candidates=await searchOrderIntakeCustomers(auth.data,{query});
  const suppliers=await withPrivilegedTenantTransaction(auth.data,async tx=>{
   const values=[];for(const candidate of candidates){if(candidate.customerType!=='lieferant')continue;const value=await readCustomerProfile(tx,auth.data.tenantId,candidate.id);if(value)values.push({id:value.id,name:value.name,iban:value.iban,paymentTermDays:value.paymentTermDays});}return values;
  });return {code:'OK' as const,suppliers};
 }catch{recordObservedFailure('INVOICE_SUPPLIER_SEARCH_FAILED');return {code:'UNAVAILABLE' as const,message:INCOMING_INVOICE_COPY.supplierSearchUnavailable};}

 },readLoggingSettings);
}
const goodsEffects={createMissingTask:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{orderId:string;missing:string[];clientKey:string})=>createMissingGoodsTask(tx,auth,input,taskEffects)};
export async function saveIntakeTaskAction(input:unknown){
 return observeAction('saveIntakeTaskAction',subjectForAction('saveIntakeTaskAction',input),async()=>{return saveTask(input,taskEffects);
 },readLoggingSettings);
}
export async function completeIntakeTaskAction(input:unknown){
 return observeAction('completeIntakeTaskAction',subjectForAction('completeIntakeTaskAction',input),async()=>{
 if(input&&typeof input==='object'&&'callResult'in input){
  const auth=await resolveAuthorization();if(!auth.ok)return {code:'UNAUTHENTICATED' as const,message:DISPATCH_CALL_COPY.session};
  if(!hasAuthorizationArea(auth.data,'auftraege'))return {code:'FORBIDDEN' as const,message:DISPATCH_CALL_COPY.forbidden};
  const {getOrdersDb}=await import('@/app/actions/orders.actions');const orders=await getOrdersDb();
  if(!orders.ok)return {code:'UNAVAILABLE' as const,message:DISPATCH_CALL_COPY.unavailable};
  const taskId='taskId' in input?input.taskId:null;
  const answered=orders.data.filter(order=>['STOPPED','PAUSED','APPOINTMENT_EXPIRED'].includes(order.finishedDispatch?.reminder?.state??'')||['CALL_NOT_REACHED'].includes(order.finishedDispatch?.reminder?.state??'')&&!!order.finishedDispatch?.reminder?.callTaskId&&order.finishedDispatch.reminder.callTaskId!==taskId).map(order=>({id:order.id,version:order.version}));
  return completeTask(input,{...taskEffects,beforeComplete:async(tx,auth,task,value)=>{if(!await repairInvoiceReissueTask(tx,auth,task,recognizeInvoicePdf)){const creditBlocked=await repairCancellationCreditTask(tx,auth,task);if(creditBlocked)return creditBlocked;}await repairCollectionFollowupTask(tx,auth,task);await repairProductionPricingTask(tx,auth,task);await repairEvidenceVisibilityTask(tx,auth,task);const blocked=await recordDispatchCallResult(tx,auth,task,value,answered);if(blocked)return blocked;return recordStoragePostalResult(tx,auth,task,value);}});
 }
 return completeTask(input,taskEffects);

 },readLoggingSettings);
}
export async function createDispatchCallTaskAction(input:{customerId:string;handover:'pickup'|'shipping';dueDate:string;clientKey:string}){
 return observeAction('createDispatchCallTaskAction',subjectForAction('createDispatchCallTaskAction',input),async()=>{
 const auth=await resolveAuthorization();if(!auth.ok)return {code:'UNAUTHENTICATED' as const,message:DISPATCH_CALL_COPY.session};
 if(!hasAuthorizationArea(auth.data,'mails')||!hasAuthorizationArea(auth.data,'auftraege'))return {code:'FORBIDDEN' as const,message:DISPATCH_CALL_COPY.forbidden};
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='clientKey,customerId,dueDate,handover'||typeof input.customerId!=='string'||!input.customerId.trim()||input.customerId.length>128||!['pickup','shipping'].includes(input.handover)||typeof input.dueDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)||typeof input.clientKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(input.clientKey))return {code:'VALIDATION_ERROR' as const,message:DISPATCH_CALL_COPY.invalid};
 const receipt=await readCompletedDispatchCallReceipt(auth.data,input);if(receipt.code!=='NOT_FOUND')return receipt;
 const {getOrdersDb}=await import('@/app/actions/orders.actions');const orders=await getOrdersDb();if(!orders.ok)return {code:'UNAVAILABLE' as const,message:DISPATCH_CALL_COPY.unavailable};
 const candidates=orders.data.filter(order=>order.customerId===input.customerId&&order.station==='fertig'&&order.finishedDispatch?.handover===input.handover);
 const plan=candidates.find(order=>order.finishedDispatch?.reminder?.clientKey===input.clientKey)?.finishedDispatch?.reminder;
 if(!plan)return {code:'CONFLICT' as const,message:DISPATCH_CALL_COPY.changed};
 const members=candidates.filter(order=>plan.orderIds.includes(order.id));
 return createDispatchCall(auth.data,input,plan,members,(tx,request)=>createOrderHandoverTask(tx,auth.data,request,{effect:(writeTx,actor,effect)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)}));

 },readLoggingSettings);
}
export async function createStorageFinalTaskAction(input:{customerId:string;handover:'pickup'|'shipping';clientKey:string}){
 return observeAction('createStorageFinalTaskAction',subjectForAction('createStorageFinalTaskAction',input),async()=>{
 const auth=await resolveAuthorization();if(!auth.ok)return {code:'UNAUTHENTICATED' as const,message:DISPATCH_CALL_COPY.session};
 if(!hasAuthorizationArea(auth.data,'mails')||!hasAuthorizationArea(auth.data,'auftraege'))return {code:'FORBIDDEN' as const,message:DISPATCH_CALL_COPY.forbidden};
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='clientKey,customerId,handover'||typeof input.customerId!=='string'||!input.customerId.trim()||input.customerId.length>128||!['pickup','shipping'].includes(input.handover)||typeof input.clientKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(input.clientKey))return {code:'VALIDATION_ERROR' as const,message:DISPATCH_CALL_COPY.invalid};
 const prior=await readStorageFinalTaskReceipt(auth.data,input);if(prior.code!=='NOT_FOUND')return prior;
 const [{getOrdersDb},{readShippingSettings}]=await Promise.all([import('@/app/actions/orders.actions'),import('@/modules/fundament/server-public')]);
 const [orders,settings]=await Promise.all([getOrdersDb(),readShippingSettings({tenantId:auth.data.tenantId,actorId:auth.data.userId,canRead:true})]);
 if(!orders.ok||settings.code!=='OK')return {code:'UNAVAILABLE' as const,message:DISPATCH_CALL_COPY.unavailable};
 const candidates=orders.data.filter(order=>order.customerId===input.customerId&&order.station==='fertig'&&order.finishedDispatch?.handover===input.handover);
 const letter=candidates.find(order=>order.finishedDispatch?.storage?.letter?.clientKey===input.clientKey)?.finishedDispatch?.storage?.letter;
 if(!letter||candidates.some(order=>letter.orderIds.includes(order.id)&&(order.finishedDispatch?.reminder?.requiresResponseCheck!==false||order.finishedDispatch?.pickupAppointment!==undefined&&letter.appointmentEventId!==order.finishedDispatch.pickupAppointment.eventId)))return {code:'CONFLICT' as const,message:DISPATCH_CALL_COPY.changed};
 const members=candidates.filter(order=>letter.orderIds.includes(order.id));
 return createStorageFinalTask(auth.data,input,letter,members.map(order=>({id:order.id,number:order.orderNumber,version:order.version})),settings.settings.updatedAt,(tx,request)=>createOrderHandoverTask(tx,auth.data,request,taskEffects));

 },readLoggingSettings);
}
export async function getIntakeTaskAction(input:{calendar:true}):Promise<import('@/modules/tasks/public').TaskCalendarRead>;
export async function getIntakeTaskAction(input:TaskOpenRequest):Promise<Awaited<ReturnType<typeof readSingleIntakeTask>>>;
export async function getIntakeTaskAction(input:TaskOpenRequest|{calendar:true}){
 return observeAction('getIntakeTaskAction',subjectForAction('getIntakeTaskAction',input),async()=>{
 if(input&&typeof input==='object'&&'calendar'in input)return readTask(input);
 return readSingleIntakeTask(input);

 },readLoggingSettings);
}
async function readSingleIntakeTask(input:TaskOpenRequest){
 const result=await readTask(input);if(result.code!=='OK'||!result.task)return result;
 const auth=await resolveAuthorization();if(!auth.ok)return result;
 try{const call=await readDispatchCallRequirement(auth.data,result.task.id),postal=await readStoragePostalTask(auth.data,result.task.id);return {...result,...(call?{dispatchCall:call}:{}),...(postal?{postalLetter:postal}:{})};}
 catch{recordObservedFailure('DISPATCH_CALL_REQUIREMENT_FAILED');return {code:'UNAVAILABLE' as const,message:DISPATCH_CALL_COPY.unavailable};}
}
import {readOpenIntakeMails} from '@/modules/eingang/server-public';
import {saveIntakeProspect} from '@/modules/eingang/server-public';
export async function saveIntakeProspectAction(input:unknown){
 return observeAction('saveIntakeProspectAction',subjectForAction('saveIntakeProspectAction',input),async()=>{return saveIntakeProspect(input,createCustomerInTransaction,readCustomerProfile);
 },readLoggingSettings);
}
export async function getOpenIntakeMailsAction(){
 return observeAction('getOpenIntakeMailsAction',subjectForAction('getOpenIntakeMailsAction',undefined),async()=>{const notice=await syncIntakeMailbox();const result=await readOpenIntakeMails();return result.code==='OK'?{...result,...(notice?{notice}:{})}:result;
 },readLoggingSettings);
}
import {listMicrosoftGraphInbox,readMicrosoftGraphMailbox} from '@/lib/server/microsoftGraph';
import {parkIntakeMailImportFailure,readFailedIntakeMailImports,observeIntakeMailboxImport,readIntakeMailboxWatermark} from '@/modules/eingang/server-public';
import {readMailboxFetchState,writeMailboxFetchState} from '@/modules/fundament/server-public';
import {MAILBOX_SYNC_COPY} from '@/ui/situationCatalog';
import {importOutlookMailAction} from '@/app/actions/communications.actions';
async function syncIntakeMailbox():Promise<string|null>{
 const authorization=await resolveAuthorization();
 if(!authorization.ok||!canSynchronizeIntakeMailbox(authorization.data))return null;
 try{
  const mailbox=readMicrosoftGraphMailbox();
  if(!mailbox){const missing=await listMicrosoftGraphInbox();return missing.code==='OK'?MAILBOX_SYNC_COPY.unavailable:missing.message;}
  const source=await readIntakeMailboxWatermark(authorization.data,mailbox);
  if(source.code!=='OK')return MAILBOX_SYNC_COPY.unavailable;
  const state=await readMailboxFetchState(authorization.data);
  if(state.code!=='OK')return MAILBOX_SYNC_COPY.unavailable;
  const frames=state.state===null?{}:state.state;
  const saved=frames[mailbox];
  let cursorUrl:string|null=null,remaining:number|null=null;let batchIds:string[]=[];
  if(saved!==undefined&&saved!==null){
   if(typeof saved!=='object'||Array.isArray(saved))throw Error('MAILBOX_CURSOR_SOURCE_INVALID');
   const frame=saved as Record<string,unknown>,at=typeof frame.at==='string'?Date.parse(frame.at):NaN;
   if(typeof frame.url!=='string'||!Number.isFinite(at)||at>Date.now()||!(frame.remaining===null||typeof frame.remaining==='number'&&Number.isSafeInteger(frame.remaining)&&frame.remaining>=0))throw Error('MAILBOX_CURSOR_SOURCE_INVALID');
   if(frame.extraRetryIds!==undefined){if(!Array.isArray(frame.extraRetryIds)||frame.extraRetryIds.length>500||frame.extraRetryIds.some(id=>typeof id!=='string'||!id||id.length>1024)||new Set(frame.extraRetryIds).size!==frame.extraRetryIds.length)throw Error('MAILBOX_BATCH_IDS_INVALID');batchIds=frame.extraRetryIds as string[];}
   if(frame.cursorDone!==undefined&&typeof frame.cursorDone!=='boolean')throw Error('MAILBOX_CURSOR_STATE_INVALID');
   if(Date.now()-at<24*3600000&&frame.cursorDone!==true){cursorUrl=frame.url;remaining=frame.remaining as number|null;}
  }
  const failed=await readFailedIntakeMailImports(authorization.data,mailbox);
  if(failed.code!=='OK')return MAILBOX_SYNC_COPY.unavailable;
  const queued=[...new Map([...batchIds.map(id=>({id})),...failed.data].map(row=>[row.id,row])).values()].slice(0,500);
  const maximum=500-queued.length;
  const inbox=await listMicrosoftGraphInbox(process.env,fetch,{watermark:source.watermark,cursorUrl,remaining,maxMessages:maximum});
  if(inbox.code!=='OK')return inbox.message;
  if(typeof inbox.startUrl!=='string'||inbox.cursorUrl===undefined||inbox.remaining===undefined||inbox.startRemaining===undefined||!Array.isArray(inbox.incomplete))throw Error('MAILBOX_PROGRESS_REQUIRED');
  // Commit the start marker before any original import. A failed completion
  // can replay this exact batch instead of skipping physical originals.
  const previous=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved as Record<string,unknown>:null;
  const retryIdentity=previous?.retryRequired===true?{retryKey:previous.retryKey,retryActorId:previous.retryActorId,retryRequired:true}:{retryKey:randomUUID(),retryActorId:authorization.data.userId,retryRequired:false};
  const batchAt=maximum<50&&previous&&typeof previous.at==='string'?previous.at:new Date().toISOString();
  const attemptKey=randomUUID(),candidates=new Map<string,Partial<import('@/lib/server/microsoftGraph').GraphInboxMessage>&{id:string}>();
  for(const mail of [...queued,...inbox.data,...inbox.incomplete])candidates.set(mail.id,{...candidates.get(mail.id),...mail});
  const reserved={...frames,[mailbox]:{url:inbox.startUrl,at:batchAt,remaining:inbox.startRemaining,cursorDone:maximum<50?previous?.cursorDone===true:false,extraRetryIds:[...candidates.keys()],attemptKey,...retryIdentity}};
  const retryEffect=(tx:PrivilegedTenantTransaction,source:{key:string;actorId:string;mailbox:string})=>createMailboxFetchRetryTask(tx,authorization.data,source,taskEffects);
  const reservation=await writeMailboxFetchState(authorization.data,{settingsId:state.settingsId,before:state.state,after:reserved});
  if(reservation.code!=='OK')return MAILBOX_SYNC_COPY.unavailable;

  let failureNotice:string|null=null;const retryIds=new Set<string>();
  for(const mail of candidates.values()){
   // Graph's flag excludes inline-only images; inspect attachments independently.
   const imported=await importOutlookMailAction(mail.id);
   if(imported.code!=='OK'){
    failureNotice=imported.message;
    const parked=await parkIntakeMailImportFailure(authorization.data,{mail,mailbox,reason:imported.message,attemptKey},(tx,auth,source)=>createIntakeMailFailureTask(tx,auth,source,taskEffects));
    if(parked.code!=='OK')retryIds.add(mail.id);
    continue;
   }
   const observed=await observeIntakeMailboxImport(authorization.data,{mailbox,graphMessageId:mail.id});
   if(observed.code!=='OK'){retryIds.add(mail.id);failureNotice=MAILBOX_SYNC_COPY.unavailable;}
  }
  const progress={url:maximum<50&&previous?previous.url as string:inbox.cursorUrl??inbox.startUrl,at:maximum<50?batchAt:new Date().toISOString(),remaining:maximum<50&&previous?previous.remaining as number|null:inbox.remaining,cursorDone:maximum<50?previous?.cursorDone!==false:inbox.cursorUrl===null,extraRetryIds:[...retryIds],...retryIdentity};
  const advanced={...reserved,[mailbox]:retryIds.size?progress:maximum<50?previous?{...progress,cursorDone:previous.cursorDone===true}:null:inbox.cursorUrl===null?null:progress};
  const completed=await writeMailboxFetchState(authorization.data,{settingsId:state.settingsId,before:reserved,after:advanced,retryMailbox:mailbox,...(retryIds.size?{forceRetry:true}:{})},retryEffect);
  if(completed.code!=='OK')return MAILBOX_SYNC_COPY.unavailable;
  const pendingNotice=inbox.cursorUrl===null?null:inbox.remaining===null?MAILBOX_SYNC_COPY.unavailable:MAILBOX_SYNC_COPY.pending(inbox.remaining);
  return failureNotice&&pendingNotice?failureNotice+'\n'+pendingNotice:failureNotice??pendingNotice;
 }catch{recordObservedFailure('INTAKE_MAIL_SYNC_FAILED');return MAILBOX_SYNC_COPY.unavailable;}
}
import { processIntakeDeviceRequest, discardIntakeCapture, chooseIntakeCaptureKind } from "@/modules/eingang/server-public";
export async function chooseIntakeCaptureKindAction(input: unknown) {
 return observeAction('chooseIntakeCaptureKindAction',subjectForAction('chooseIntakeCaptureKindAction',input),async()=>{ return chooseIntakeCaptureKind(input);
 },readLoggingSettings);
}
import { readIntakeDrafts, writeIntakeDraft, discardIntakeDraft, retryIntakeRecognition, createIntakeContinuation } from "@/modules/eingang/server-public";
import {saveGoodsReceipt,readGoodsReceipts,createGoodsReceiptStationBinding,type GoodsReceiptResult} from "@/modules/eingang/server-public";
import {parseGoodsReceiptInput} from "@/modules/eingang/public";
import {transitionWareneingangToGalvanik} from "@/lib/server/commands/orderStationCommand";
import {openIntakeOriginal,confirmIntakeOriginal} from "@/modules/eingang/server-public";
export async function openIntakeOriginalAction(input:unknown){
 return observeAction('openIntakeOriginalAction',subjectForAction('openIntakeOriginalAction',input),async()=>{return openIntakeOriginal(input);
 },readLoggingSettings);
}
export async function confirmIntakeOriginalAction(input:unknown){
 return observeAction('confirmIntakeOriginalAction',subjectForAction('confirmIntakeOriginalAction',input),async()=>{return confirmIntakeOriginal(input);
 },readLoggingSettings);
}

export async function getGoodsReceiptsAction(orderId:string){return readGoodsReceipts(orderId);}
export async function saveGoodsReceiptAction(input:unknown):Promise<GoodsReceiptResult>{
 return observeAction('saveGoodsReceiptAction',subjectForAction('saveGoodsReceiptAction',input),async()=>{
 if(input&&typeof input==='object'&&'quoteId'in input)return saveGoodsReceipt(input,goodsEffects);
 const parsed=parseGoodsReceiptInput(input);if(!parsed)return {code:"VALIDATION_ERROR",message:"Warenprüfung ist unvollständig oder ungültig."};
 if(parsed.command!=="galvanik")return saveGoodsReceipt(parsed,goodsEffects);
 const binding=createGoodsReceiptStationBinding(parsed,goodsEffects);
 const moved=await transitionWareneingangToGalvanik({orderId:parsed.orderId,expectedVersion:parsed.expectedOrderVersion,clientEventId:parsed.clientEventId},binding);
 if(moved.code!=="OK"){const bound=binding.result();return bound&&bound.code!=="OK"?bound:moved;}
 return binding.result()??{code:"UNAVAILABLE",message:"Warenbeleg wurde nicht sicher gelesen. Fehlercode: GOODS_RECEIPT_BINDING_MISSING."};

 },readLoggingSettings);
}

export async function getIntakeDraftsAction() { return readIntakeDrafts(); }
export async function saveIntakeDraftAction(input:unknown) {
 return observeAction('saveIntakeDraftAction',subjectForAction('saveIntakeDraftAction',input),async()=>{ return writeIntakeDraft(input);
 },readLoggingSettings);
}
export async function createIntakeContinuationAction(input:unknown) {
 return observeAction('createIntakeContinuationAction',subjectForAction('createIntakeContinuationAction',input),async()=>{ return createIntakeContinuation(input);
 },readLoggingSettings);
}
export async function discardIntakeDraftAction(input:unknown) {
 return observeAction('discardIntakeDraftAction',subjectForAction('discardIntakeDraftAction',input),async()=>{ return discardIntakeDraft(input);
 },readLoggingSettings);
}
export async function retryIntakeRecognitionAction(input:unknown) {
 return observeAction('retryIntakeRecognitionAction',subjectForAction('retryIntakeRecognitionAction',input),async()=>{ return retryIntakeRecognition(input);
 },readLoggingSettings);
}

import {
  erfasseAuftragAusEingangCommand,
  type ErfasseAuftragResult,
} from "@/modules/eingang/server-public";
import { hasAuthorizationArea, resolveAuthorization } from "@/lib/server/authorization";
import {createCustomerInTransaction,updateCustomerInTransaction, readCustomerProfile} from "@/modules/customers/server-public";
import {createOrderIntake} from "@/lib/server/commands/orderIntakeCommand";
import {presentOrderIntakeReceipt} from "@/lib/server/orderIntakeRead";
import { readCustomerOrderReadinessCommand } from "@/modules/customers/server-public";
import { saveIntakeNote, readIntakeCapture, readIntakeNoteText, readIntakePendingScope, prepareIntakeFile, finishIntakeFile, readIntakeFileChanges } from "@/modules/eingang/server-public";
import type { IntakeContext } from "@/modules/eingang/public";

/** Only the committed, source-qualified capture exposes an adopted original. */
async function logCapturedTakeovers<T extends {code:string;capture?:import('@/modules/eingang/public').IntakeCapture}>(result:T,sourceCommandId:unknown):Promise<T>{
 if(result.code!=='OK'||!result.capture?.takeovers?.length||typeof sourceCommandId!=='string')return result;
 const auth=readObservedAuthorization();
 for(const source of result.capture.takeovers){
  if(source.sourceCommandId!==sourceCommandId)continue;
  // Missing historical time is an explicit diagnostic loss, never today's time.
  await logTechnical(auth,{type:'offline_quarantine',command:'intakeOriginalTakeover',subject:{type:'intake',id:result.capture.id},occurredAt:source.deviceCapturedAt??''});
 }
 return result;
}

export async function saveIntakeNoteAction(input: unknown,pendingScope?:string) {
 return observeAction('saveIntakeNoteAction',subjectForAction('saveIntakeNoteAction',input),async()=>{
  if(!await matchesPendingActor(pendingScope))return {code:"FORBIDDEN" as const,message:"Die Aufnahme wartet auf die ursprüngliche Anmeldung."};
  const sourceKey=input&&typeof input==='object'?Object.getOwnPropertyDescriptor(input,'textstand')?.value:undefined;
  if(pendingScope===undefined)return logCapturedTakeovers(await saveIntakeNote(input,readCustomerProfile),sourceKey);
  const [{preserveOfflineNoteConflict},{writeIntakeNoteInTransaction},{createOfflineNoteConflictTask},{recordIntakeTaskEffect}]=await Promise.all([import('@/lib/server/offlineNoteConflictPort'),import('@/modules/eingang/server-public'),import('@/modules/tasks/server-public'),import('@/modules/eingang/server-public')]);
  return logCapturedTakeovers(await saveIntakeNote(input,readCustomerProfile,async(tx,auth,note,currentVersion,orderCustomerId)=>{
   try{await preserveOfflineNoteConflict(tx,auth,note,currentVersion,async eventId=>{
    const failure=await writeIntakeNoteInTransaction(tx,auth,{...note,itemId:eventId,textstand:eventId,expectedVersion:0,concerns:[]},readCustomerProfile,orderCustomerId);if(failure)throw Error('OFFLINE_CONFLICT_ORIGINAL_'+failure.code);
    return createOfflineNoteConflictTask(tx,auth,eventId,{effect:(writeTx,actor,effect)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)});
   });}catch{recordObservedFailure('OFFLINE_NOTE_CONFLICT_FAILED');throw Error('OFFLINE_NOTE_CONFLICT_FAILED');}
  }),sourceKey);

 },readLoggingSettings);
}
export async function discardIntakeCaptureAction(input:unknown){
 return observeAction('discardIntakeCaptureAction',subjectForAction('discardIntakeCaptureAction',input),async()=>{return discardIntakeCapture(input);
 },readLoggingSettings);
}
async function matchesPendingActor(scope:string|undefined){
 if(scope===undefined)return true;
 const auth=await resolveAuthorization();return auth.ok&&offlinePartition(auth.data)===scope;
}
export async function prepareIntakeFileAction(input: unknown,pendingScope?:string) {
 return observeAction('prepareIntakeFileAction',subjectForAction('prepareIntakeFileAction',input),async()=>{
 if(!await matchesPendingActor(pendingScope))return {code:'FORBIDDEN' as const,message:'Die Aufnahme wartet auf die ursprüngliche Anmeldung.'};
 return prepareIntakeFile(input);

 },readLoggingSettings);
}
export async function finishIntakeFileAction(fileId: string,pendingScope?:string,customerVisible?:boolean) {
 return observeAction('finishIntakeFileAction',subjectForAction('finishIntakeFileAction',{fileId}),async()=>{
 if(customerVisible!==undefined&&typeof customerVisible!=='boolean')return {code:'VALIDATION_ERROR' as const,message:EVIDENCE_VISIBILITY_COPY.invalid};
 if(!await matchesPendingActor(pendingScope))return {code:'FORBIDDEN' as const,message:'Die Aufnahme wartet auf die ursprüngliche Anmeldung.'};
 const result=await logCapturedTakeovers(await finishIntakeFile(fileId),fileId);if(result.code!=='OK')return result;
 const auth=await resolveAuthorization();if(!auth.ok)return {code:'UNAUTHENTICATED' as const,message:EVIDENCE_VISIBILITY_COPY.save};
 const {synchronizeEvidenceVisibilityRetryTask}=await import('@/modules/tasks/server-public');
 const flag=await applyEvidenceUploadVisibility(auth.data,'intake-file:'+fileId,customerVisible,
  {synchronizeTask:(tx,actor,id)=>synchronizeEvidenceVisibilityRetryTask(tx,actor,id,
   {effect:(writeTx,writer,effect)=>recordIntakeTaskEffect(writeTx,writer,effect,readCustomerProfile)})});
 // No visibility intent means the unchanged native capture receipt. Its fresh
 // read and historical retries must retain the same default response shape.
 if(flag.code==='OK'&&!flag.visibility&&!flag.visibilityPending)return result;
 return flag.code==='OK'?{...result,visibilityPending:flag.visibilityPending,...(flag.visibility?{visibility:flag.visibility}:{})}:flag;

 },readLoggingSettings);
}
export async function getIntakePendingScopeAction() { return readIntakePendingScope(); }
export async function getIntakeFileChangesAction(since: string, after: string | null) { return readIntakeFileChanges(since, after); }
export async function saveIntakeDeviceRequestAction(input: unknown) {
 return observeAction('saveIntakeDeviceRequestAction',subjectForAction('saveIntakeDeviceRequestAction',input),async()=>{
  const session = await getAppSession();
  const fingerprint = session ? createHash("sha256").update(JSON.stringify(["intake-device", session.tenantId, session.userId, session.issuedAt])).digest("hex") : null;
  return processIntakeDeviceRequest(input, fingerprint);

 },readLoggingSettings);
}
export async function getIntakeCaptureAction(itemId: string, context?: IntakeContext, options?:{packageExpectation?:boolean}) {
 return observeAction('getIntakeCaptureAction',subjectForAction('getIntakeCaptureAction',{itemId}),async()=>{
  const read=await readIntakeCapture(itemId, context);
  return options?.packageExpectation===true?withPackageExpectation(read):read;

 },readLoggingSettings);
}
export async function recognizeIntakeNoteAction(text: string) {
 return observeAction('recognizeIntakeNoteAction',subjectForAction('recognizeIntakeNoteAction',text),async()=>{
  const authorization = await resolveAuthorization();
  if (!authorization.ok || !hasAuthorizationArea(authorization.data, "eingang")) return { code: "FORBIDDEN" as const, message: "Eingang ist nicht freigegeben." };
  if (typeof text !== "string" || text.length > 20_000) return { code: "VALIDATION_ERROR" as const, message: "Notiz darf höchstens 20.000 Zeichen enthalten." };
  return { code: "OK" as const, data: readIntakeNoteText(text) };

 },readLoggingSettings);
}

function existingCustomerId(input: unknown): string | null {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return null;
  const customer = (input as Record<string, unknown>).customer;
  if (customer === null || typeof customer !== "object" || Array.isArray(customer)) return null;
  const value = customer as Record<string, unknown>;
  return value.mode === "EXISTING" && typeof value.customerId === "string" && value.customerId.trim().length > 0
    ? value.customerId.trim()
    : null;
}

export async function erfasseAuftragAusEingangAction(input: unknown): Promise<ErfasseAuftragResult> {
 return observeAction('erfasseAuftragAusEingangAction',subjectForAction('erfasseAuftragAusEingangAction',input),async()=>{
  const customerId = existingCustomerId(input);
  const authorization = await resolveAuthorization();
  if (!customerId || !authorization.ok || !hasAuthorizationArea(authorization.data, "eingang") || (input as {customer?:{changes?:unknown}})?.customer?.changes) {
    return erfasseAuftragAusEingangCommand(input,undefined,createCustomerInTransaction,updateCustomerInTransaction,after,queueOrderPrints);
  }
  const customer = await readCustomerOrderReadinessCommand(authorization.data, {
    customerId,
    requirePaymentPreference: hasAuthorizationArea(authorization.data, "zahlungen"),
  });
  if (customer.code !== "OK") {
    return customer.code === "NOT_FOUND"
      ? { code: "VALIDATION_ERROR", message: customer.message }
      : { code: "CONFLICT", message: customer.message };
  }
  const readiness = customer.readiness;
  if (readiness.issues.length > 0) {
    return {
      code: "CUSTOMER_INCOMPLETE",
      message: `Kunde ist für den Auftrag unvollständig: ${readiness.issues.map((issue) => issue.message).join(", ")}. Bitte im Abschnitt Kunde ergänzen.`,
      missing: readiness.issues.map((issue) => issue.field),
    };
  }
  return erfasseAuftragAusEingangCommand(input, { customerId, readiness },undefined,undefined,after,queueOrderPrints);

 },readLoggingSettings);
}

export async function createOrderIntakeAction(input:unknown){
 return observeAction('createOrderIntakeAction',subjectForAction('createOrderIntakeAction',input),async()=>{
  const authorization=await resolveAuthorization();
  if(!authorization.ok)return {code:"UNAUTHENTICATED" as const,message:authorization.message};
  const result=await createOrderIntake(input,createCustomerInTransaction,{before:async()=>undefined,after:queueOrderPrints});
  return result.code==="OK"?{...result,receipt:presentOrderIntakeReceipt(result.receipt,hasAuthorizationArea(authorization.data,"preise"))}:result;

 },readLoggingSettings);
}

import {returnQuoteGoodsReceipt,readQuoteGoodsReturns} from "@/modules/eingang/server-public";
export async function recordQuoteGoodsReturnAction(input:unknown){
 return observeAction('recordQuoteGoodsReturnAction',subjectForAction('recordQuoteGoodsReturnAction',input),async()=>{const result=await returnQuoteGoodsReceipt(input);if(result.code==='OK'){for(const path of ['/','/warendurchlauf','/nachrichten'])revalidatePath(path);}return result;
 },readLoggingSettings);
}
export async function getQuoteGoodsReturnsAction(quoteId:unknown){
 return observeAction('getQuoteGoodsReturnsAction',subjectForAction('getQuoteGoodsReturnsAction',{quoteId}),async()=>{return readQuoteGoodsReturns(quoteId);
 },readLoggingSettings);
}
