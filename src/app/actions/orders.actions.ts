"use server";
import {withPageReadBudget,hasPageReadBudget,configurePageReadBudget,withPageReadPhase,logPageReadPhase} from '@/db/readBudget';
import {DEFAULT_PAGE_READ_SETTINGS} from '@/db/readBudget';
import {observeAction,subjectForAction} from '@/modules/logging/server-public';
import {readLoggingSettings,readPageReadSettings,readCompanyLetterSettings} from '@/modules/fundament/server-public';
import {canTransportInvoiceDocument} from '@/lib/server/authorization';
import {canReadOrderPaymentCredit} from '@/lib/server/authorizationReadContext';
import {readCacheLoginScope} from '@/lib/server/authBootstrap';

/** Existing settings read; invoice transport may also request its sender name. */
export async function readPageReadSettingsAction(input?:{includeCompanyName:true}){
 if(input!==undefined&&(!input||Object.keys(input).join(',')!=='includeCompanyName'||input.includeCompanyName!==true))return {code:'SOURCE_INCOMPLETE' as const};
 const authorization=await resolveAuthorization();
 if(!authorization.ok)return {code:'FORBIDDEN' as const};
 try{
  const settings=await withPageReadPhase('action.settings',()=>readPageReadSettings(authorization.data));
  const company=input?.includeCompanyName&&canTransportInvoiceDocument(authorization.data)?await withPageReadPhase('action.company',()=>readCompanyLetterSettings({tenantId:authorization.data.tenantId,actorId:authorization.data.userId,canRead:true})):null;
  return {code:'OK' as const,settings,...(company?.code==='OK'?{companyName:company.company.companyName}:{})};
 }
 catch{return {code:'SOURCE_INCOMPLETE' as const};}
}

export async function getProductionWeekAction(input?:{onDate?:string}){
 return observeAction('getProductionWeekAction',subjectForAction('getProductionWeekAction',input),async()=>{
 noStore();
 const authorization=await resolveAuthorization();
 if(!authorization.ok)return {code:authorization.reason==='AUTHORIZATION_UNAVAILABLE'?'UNAVAILABLE' as const:'UNAUTHENTICATED' as const};
 if(input!==undefined&&(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>key!=='onDate')||input.onDate!==undefined&&typeof input.onDate!=='string'))return {code:'VALIDATION_ERROR' as const};
 const {readProductionWeek}=await import('@/lib/server/productionSnapshotPort');
 return readProductionWeek(authorization.data,input?.onDate);

 },readLoggingSettings);
}

import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import type { ActionResult } from "@/lib/server/authHelper";
import {
  resolveAuthorization,
  type AuthorizationSnapshot,
} from "@/lib/server/authorization";
import type { OperationalOrder } from "@/lib/types/operationalOrder";
import {
  transitionWareneingangToGalvanik,
  correctGalvanikToWareneingang,
  recordOrderLabelPrint,
  type OrderStationCommandInput,
  type OrderStationCommandResult,
  type OrderStationCorrectionCommandInput,
  type OrderStationCorrectionCommandResult,
  type OrderLabelPrintCommandInput,
  type OrderLabelPrintCommandResult,
} from "@/lib/server/commands/orderStationCommand";
import type {
  ConfigureExtraWorkCatalogInput,
  ConfigureExtraWorkCatalogResult,
  SetExtraWorkHourlyRateInput,
  SetExtraWorkHourlyRateResult,
} from "@/lib/server/commands/extraWorkAdminCommand";
import type {
  ChangeOrderItemExtraWorkInput,
  ChangeOrderItemExtraWorkResult,
} from "@/lib/server/commands/orderExtraWorkCommand";
import type {
  FreezeOrderInput,
  FreezeOrderResult,
} from "@/lib/server/commands/orderFreezeCommand";
import type {
  ReopenFrozenOrderInput,
  ReopenFrozenOrderResult,
} from "@/lib/server/commands/orderFreezeCorrectionCommand";
import type {
  AssignOrderTaskInput,
  HandBackOrderTaskInput,
  OrderTaskAssignmentResult,
} from "@/lib/server/commands/orderTaskAssignmentCommand";
import type {
  ChangeOrderPromisedDueDateInput,
  ChangeOrderPromisedDueDateResult,
} from "@/lib/server/commands/orderPromiseCommand";
import type {
  ChangeOrderContentInput,
  OrderContentResult,
  SetOrderItemFinishedInput,
} from "@/lib/server/commands/orderContentCommand";
import type {
  ExtraWorkMasterData,
  LiveOrderCard,
  OrderCardReadResult,
} from "@/lib/server/orderCardRead";
import type { EvidenceReadRecord } from "@/lib/server/evidenceRead";

// DTO Typen (zur Vereinfachung)
export type OrderResponse = OperationalOrder & { cardReadErrorCode?: string | null };
export async function getOrderPickupNoticeAction(input:unknown){const {readOrderPickupNotice}=await import("@/lib/server/commands/orderContentCommand");return readOrderPickupNotice(input);}
export async function changeOrderPickupNoticeAction(input:unknown){
 return observeAction('changeOrderPickupNoticeAction',subjectForAction('changeOrderPickupNoticeAction',input),async()=>{
 const [{changeOrderPickupNotice},{readIntakeHandoverMail,recordIntakeHandoverEffect,recordIntakeTaskEffect},{readCustomerProfile,updateCustomerInTransaction},{createOrderHandoverTask}]=await Promise.all([import('@/lib/server/commands/orderContentCommand'),import('@/modules/eingang/server-public'),import('@/modules/customers/server-public'),import('@/modules/tasks/server-public')]);
 const result=await changeOrderPickupNotice(input,{readMail:readIntakeHandoverMail,recordEffect:recordIntakeHandoverEffect,readCustomer:readCustomerProfile,updateDefault:(tx,auth,request)=>updateCustomerInTransaction(tx,{tenantId:auth.tenantId,userId:auth.userId,capabilities:{canCreateCustomer:false,canEditCustomer:auth.permissions.includes('perm_data_customers'),canManageMoney:auth.areas?.includes('zahlungen')===true}},{customerId:request.customerId,clientEventId:request.clientEventId,handoverPreference:request.mode}),createTask:(tx,auth,request,effect)=>createOrderHandoverTask(tx,auth,request,{effect:async(writeTx,actor,task)=>{if(request.manualEventId)return recordIntakeTaskEffect(writeTx,actor,task,readCustomerProfile);if(!effect)throw Error('HANDOVER_TASK_EFFECT_MISSING');return effect(task.taskId);}},undefined,request.manualEventId)});
 if(result.code==='OK'){revalidatePath('/');revalidatePath('/orders/[orderId]','page');revalidatePath('/nachrichten');}
 return result;

 },readLoggingSettings);
}

export type OrderRegisterFilter = "ALL" | "ORDER" | "QUOTE";

export type OrderRegisterEntry = {
  kind: "ORDER" | "QUOTE";
  id: string;
  reference: string;
  customerId: string;
  customerName: string;
  title: string;
  dueDate: string;
  status: string;
  changedAt: string | null;
};

export async function transitionWareneingangToGalvanikAction(
  input: OrderStationCommandInput,
): Promise<OrderStationCommandResult> {
 return observeAction('transitionWareneingangToGalvanikAction',subjectForAction('transitionWareneingangToGalvanikAction',input),async()=>{
  return transitionWareneingangToGalvanik(input);

 },readLoggingSettings);
}

/** D-F12-004: reversal (galvanik -> wareneingang/angenommen) with a mandatory reason. */
export async function correctGalvanikToWareneingangAction(
  input: OrderStationCorrectionCommandInput,
): Promise<OrderStationCorrectionCommandResult> {
 return observeAction('correctGalvanikToWareneingangAction',subjectForAction('correctGalvanikToWareneingangAction',input),async()=>{
  return correctGalvanikToWareneingang(input);

 },readLoggingSettings);
}

/** Records the existing order timeline event after the browser print dialog closed. */
export async function recordOrderLabelPrintAction(
  input: OrderLabelPrintCommandInput,
): Promise<OrderLabelPrintCommandResult> {
 return observeAction('recordOrderLabelPrintAction',subjectForAction('recordOrderLabelPrintAction',input),async()=>{
  return recordOrderLabelPrint(input);

 },readLoggingSettings);
}

export async function changeOrderItemExtraWorkAction(
  input: ChangeOrderItemExtraWorkInput,
): Promise<ChangeOrderItemExtraWorkResult> {
 return observeAction('changeOrderItemExtraWorkAction',subjectForAction('changeOrderItemExtraWorkAction',input),async()=>{
  const { changeOrderItemExtraWork } = await import(
    "@/lib/server/commands/orderExtraWorkCommand"
  );
  return changeOrderItemExtraWork(input);

 },readLoggingSettings);
}

export async function freezeOrderAction(input: FreezeOrderInput): Promise<FreezeOrderResult> {
 return observeAction('freezeOrderAction',subjectForAction('freezeOrderAction',input),async()=>{
  const { freezeOrder } = await import("@/lib/server/commands/orderFreezeCommand");
  return freezeOrder(input);

 },readLoggingSettings);
}

export async function reopenFrozenOrderAction(
  input: ReopenFrozenOrderInput,
): Promise<ReopenFrozenOrderResult> {
 return observeAction('reopenFrozenOrderAction',subjectForAction('reopenFrozenOrderAction',input),async()=>{
  const { reopenFrozenOrder } = await import(
    "@/lib/server/commands/orderFreezeCorrectionCommand"
  );
  return reopenFrozenOrder(input);

 },readLoggingSettings);
}

export async function assignOrderTaskAction(
  input: AssignOrderTaskInput,
): Promise<OrderTaskAssignmentResult> {
 return observeAction('assignOrderTaskAction',subjectForAction('assignOrderTaskAction',input),async()=>{
  const { assignOrderTask } = await import(
    "@/lib/server/commands/orderTaskAssignmentCommand"
  );
  return assignOrderTask(input);

 },readLoggingSettings);
}

export async function handBackOrderTaskAction(
  input: HandBackOrderTaskInput,
): Promise<OrderTaskAssignmentResult> {
 return observeAction('handBackOrderTaskAction',subjectForAction('handBackOrderTaskAction',input),async()=>{
  const { handBackOrderTask } = await import(
    "@/lib/server/commands/orderTaskAssignmentCommand"
  );
  return handBackOrderTask(input);

 },readLoggingSettings);
}

export async function changeOrderPromisedDueDateAction(
  input: ChangeOrderPromisedDueDateInput,
): Promise<ChangeOrderPromisedDueDateResult> {
 return observeAction('changeOrderPromisedDueDateAction',subjectForAction('changeOrderPromisedDueDateAction',input),async()=>{
  const { changeOrderPromisedDueDate } = await import(
    "@/lib/server/commands/orderPromiseCommand"
  );
  return changeOrderPromisedDueDate(input);

 },readLoggingSettings);
}

export async function changeOrderContentAction(
  input: ChangeOrderContentInput,
): Promise<OrderContentResult> {
 return observeAction('changeOrderContentAction',subjectForAction('changeOrderContentAction',input),async()=>{
  const { changeOrderContent } = await import("@/lib/server/commands/orderContentCommand");
  const {readCustomerProfile}=await import('@/modules/customers/server-public');
  return changeOrderContent(input,readCustomerProfile);

 },readLoggingSettings);
}

export async function setOrderItemFinishedAction(
  input: SetOrderItemFinishedInput,
): Promise<OrderContentResult> {
 return observeAction('setOrderItemFinishedAction',subjectForAction('setOrderItemFinishedAction',input),async()=>{
  const { setOrderItemFinished } = await import("@/lib/server/commands/orderContentCommand");
  const [{createProductionPricingRetryTask,settleProductionPricingRetryTasks},{recordIntakeTaskEffect},{readCustomerProfile}]=await Promise.all([import('@/modules/tasks/server-public'),import('@/modules/eingang/server-public'),import('@/modules/customers/server-public')]);
  const effect:import('@/modules/tasks/server-public').TaskEffects=(tx,auth,value)=>recordIntakeTaskEffect(tx,auth,value,readCustomerProfile);
  return setOrderItemFinished(input,{failed:async(tx,auth,id)=>{await createProductionPricingRetryTask(tx,auth,id,{effect});},settled:async(tx,auth,eventId)=>{await settleProductionPricingRetryTasks(tx,auth,eventId,{effect});}});

 },readLoggingSettings);
}

export async function configureExtraWorkCatalogPositionAction(
  input: ConfigureExtraWorkCatalogInput,
): Promise<ConfigureExtraWorkCatalogResult> {
 return observeAction('configureExtraWorkCatalogPositionAction',subjectForAction('configureExtraWorkCatalogPositionAction',input),async()=>{
  const { configureExtraWorkCatalogPosition } = await import(
    "@/lib/server/commands/extraWorkAdminCommand"
  );
  return configureExtraWorkCatalogPosition(input);

 },readLoggingSettings);
}

export async function setExtraWorkHourlyRateAction(
  input: SetExtraWorkHourlyRateInput,
): Promise<SetExtraWorkHourlyRateResult> {
 return observeAction('setExtraWorkHourlyRateAction',subjectForAction('setExtraWorkHourlyRateAction',input),async()=>{
  const { setExtraWorkHourlyRate } = await import(
    "@/lib/server/commands/extraWorkAdminCommand"
  );
  return setExtraWorkHourlyRate(input);

 },readLoggingSettings);
}

type OrderCardActionResult<T> = OrderCardReadResult<T> | {
  code: "UNAUTHENTICATED";
  message: string;
};

async function resolveOrderCardAuthorization(): Promise<
  | { ok: true; data: AuthorizationSnapshot }
  | { ok: false; result: Exclude<OrderCardActionResult<never>,{code:'OK'}> }
> {
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch (error) {
    console.error("[ORDER_CARD_AUTHORIZATION_ERROR]", {
      message: error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN",
    });
    return {
      ok: false,
      result: { code: "UNAVAILABLE", message: "Auftragskarte ist derzeit nicht verfügbar." },
    };
  }
  if (!authorization.ok) {
    return {
      ok: false,
      result: authorization.reason === "AUTHORIZATION_UNAVAILABLE"
        ? { code: "UNAVAILABLE", message: "Auftragskarte ist derzeit nicht verfügbar." }
        : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." },
    };
  }
  return { ok: true, data: authorization.data };
}

type TodayOrderReadData={card:import('@/lib/server/orderCardRead').TodayOrderCard;nextActionRule:ReturnType<typeof import('@/lib/server/v45OrderRead').readV45OrderRule>;handoverConsequences?:Awaited<ReturnType<typeof import('@/lib/server/commands/immutableInvoiceCommand').readInvoiceShippingConsequences>>;pickupAppointment?:Awaited<ReturnType<typeof import('@/lib/server/pickupAppointmentPort').readOrderPickupAppointment>>};
/** Existing order/U2 composition, projected in bulk for Today. The original
 * card/evidence gates run before any financial or transport source. */
export async function getTodayOrderReadAction(input:{orderIds:string[]}):Promise<OrderCardActionResult<{rows:Array<{orderId:string;result:OrderCardReadResult<TodayOrderReadData>}>}>>{
 const inherited=hasPageReadBudget();
 return withPageReadBudget(async()=>{
  const diagnosticStarted=Date.now();
  noStore();
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).join(',')!=='orderIds'||!Array.isArray(input.orderIds))return {code:'VALIDATION_ERROR',message:'Ungültige Auftragskennung.'};
  if(!inherited){const settings=await readPageReadSettingsAction();if(settings.code==='OK')configurePageReadBudget(settings.settings.queryTimeoutMs);}
  const authorization=await withPageReadPhase('action.auth',()=>resolveOrderCardAuthorization());if(!authorization.ok)return authorization.result;
  const auth=authorization.data;
  const {readTodayOrderSources,projectTodayOrderSources}=await import('@/lib/server/todayOrderRead');
  const sources=await readTodayOrderSources(auth,input.orderIds,await todayOrderSourcePorts());
  const rows=projectTodayOrderSources(auth,sources);
  logPageReadPhase('action.model',diagnosticStarted,{requested:input.orderIds.length,ok:rows.filter(row=>row.result.code==='OK').length,failed:rows.filter(row=>row.result.code!=='OK').length});
  return {code:'OK',data:{rows}};
 },DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs);
}

export async function getLiveOrderCardAction(input:{orderId:string}):ReturnType<typeof readLiveOrderCardForPage>{
 const inherited=hasPageReadBudget();
 return withPageReadBudget(async()=>{
  if(!inherited){
   const settings=await readPageReadSettingsAction();
   if(settings.code==='OK')configurePageReadBudget(settings.settings.queryTimeoutMs);
  }
  return readLiveOrderCardForPage(input);
 },DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs);
}

async function readLiveOrderCardForPage(
  input: { orderId: string },
): Promise<OrderCardActionResult<{ serverReadAt?:string; cacheLoginScope?:string; handoverConsequences?:Awaited<ReturnType<typeof import('@/lib/server/commands/immutableInvoiceCommand').readInvoiceShippingConsequences>>; nextActionRule?:ReturnType<typeof import('@/lib/server/v45OrderRead').readV45OrderRule>; card: LiveOrderCard; evidence: EvidenceReadRecord[]; customerInformed?:Awaited<ReturnType<typeof import('@/lib/server/orderReleaseRead').readOrderInformed>>; manualShipping?:Awaited<ReturnType<typeof import('@/modules/orders/server-public').readManualShipping>>; printQueue?:Awaited<ReturnType<typeof import('@/modules/orders/server-public').readOrderPrintQueue>>; pickupAppointment?:Awaited<ReturnType<typeof import('@/lib/server/pickupAppointmentPort').readOrderPickupAppointment>> }>> {
  noStore();
  try {
    const authorization = await resolveOrderCardAuthorization();
    if (!authorization.ok) return authorization.result;
    const [{ readLiveOrderCard }, { readEvidenceRecordsByTarget }] = await Promise.all([
      import("@/lib/server/orderCardRead"),
      import("@/lib/server/evidenceRead"),
    ]);
    const card = await readLiveOrderCard(authorization.data, input);
    if (card.code !== "OK") return card;
    // These qualified sources depend on the card identity/version, not on
    // each other. Keep one read budget and preserve every source's own guard.
    const [{readInvoiceShippingConsequences},{readInvoiceVat},fundament,orders,tasks,{readOrderInformed},{readOrderPickupAppointment},{readV45OrderRule},{getPaymentState}]=await Promise.all([
      import('@/lib/server/commands/immutableInvoiceCommand'),import('@/modules/accounting/server-public'),
      import('@/modules/fundament/server-public'),import('@/modules/orders/server-public'),import('@/modules/tasks/server-public'),
      import('@/lib/server/orderReleaseRead'),import('@/lib/server/pickupAppointmentPort'),import('@/lib/server/v45OrderRead'),import('@/lib/server/paymentSummaryRead'),
    ]);
    const readCredit=canReadOrderPaymentCredit(authorization.data)?async(tx:import('@/lib/server/privilegedDb').PrivilegedTenantTransaction,tenantId:string,customerId:string)=>{
      const [{readCustomerCreditInTransaction},{readCustomerProfile}]=await Promise.all([import('@/modules/accounting/server-public'),import('@/modules/customers/server-public')]);
      return readCustomerCreditInTransaction(tx,tenantId,customerId,readCustomerProfile);
    }:undefined;
    const [handoverTask,shippingSettings,handoverConsequences,evidence,actors,manualShipping,customerInformed,printQueue,pickupAppointment,payment,cacheLoginScope]=await Promise.all([
      card.data.handoverNotice?.taskId?(async()=>{const {withPrivilegedTenantTransaction}=await import('@/lib/server/privilegedDb');return withPrivilegedTenantTransaction(authorization.data,tx=>tasks.readOrderHandoverTaskState(tx,authorization.data,{orderId:card.data.id,taskId:card.data.handoverNotice!.taskId!}));})():Promise.resolve(undefined),
      card.data.handoverMode==='shipping'?fundament.readShippingSettings({tenantId:authorization.data.tenantId,actorId:authorization.data.userId,canRead:true}):Promise.resolve(undefined),
      readInvoiceShippingConsequences(authorization.data,{orderId:card.data.id,expectedVersion:card.data.version,manualHandoverEventId:card.data.handoverNotice?.manualEventId},readInvoiceVat,fundament.readShippingSettingsInTransaction),
      readEvidenceRecordsByTarget(authorization.data,{targetType:'ORDER',targetId:input.orderId}),
      orders.readOrderActors(authorization.data,{orderId:input.orderId,version:card.data.version}),
      card.data.handoverMode==='shipping'?readManualShippingForOrder(authorization.data,input.orderId):Promise.resolve(undefined),
      readOrderInformed(authorization.data,input.orderId),orders.readOrderPrintQueue(authorization.data,input.orderId),
      readOrderPickupAppointment(authorization.data,input.orderId),
      card.data.station==='fertig'?getPaymentState(authorization.data,input.orderId,readCredit):Promise.resolve(undefined),
      readCacheLoginScope(),
    ]);
    if(card.data.handoverNotice?.taskId)card.data.handoverNotice.taskState=handoverTask?.status??'nicht_verfuegbar';
    if(shippingSettings){
      card.data.shippingService=shippingSettings.code==='OK'?shippingSettings.settings.service:null;
      if(shippingSettings.code!=='OK')card.data.shippingServiceError=shippingSettings.message;
    }
    if(evidence.code!=='OK')return evidence;
    if(customerInformed.code==='OK'&&customerInformed.orderVersion!==card.data.version)return {code:'UNAVAILABLE',message:'Der Auftrag wurde während des Lesens geändert. Lade die Auftragskarte erneut.'};
    return { code: "OK", data: { ...(handoverConsequences?{handoverConsequences}:{}),serverReadAt:new Date().toISOString(),cacheLoginScope,nextActionRule:readV45OrderRule(authorization.data,card.data,{orderId:input.orderId,value:customerInformed},{orderId:input.orderId,records:evidence.data},{shipping:handoverConsequences,payment,shipment:manualShipping}),card: {...card.data,...(actors.code==='OK'?{actors:actors.actors}:{actorReadError:actors.message})}, evidence: evidence.data,customerInformed,printQueue,pickupAppointment,...(manualShipping?{manualShipping}:{}) } };
  } catch (error) {
    console.error("[ORDER_CARD_ACTION_ERROR]", {
      orderId: input.orderId,
      message: error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN",
    });
    return { code: "UNAVAILABLE", message: "Auftragskarte ist derzeit nicht verfügbar." };
  }
}

async function manualShippingPorts(){
 const [{readCustomerProfile,readCustomerProfiles},{readShippingSettingsInTransaction}]=await Promise.all([import('@/modules/customers/server-public'),import('@/modules/fundament/server-public')]);
 const {readShippingMergeAllocation}=await import('@/lib/server/commands/immutableInvoiceCommand');
 const {readInvoiceVat}=await import('@/modules/accounting/server-public');
 return {readCustomer:readCustomerProfile,readCustomers:readCustomerProfiles,readSettings:readShippingSettingsInTransaction,readAllocation:(tx:import('@/lib/server/privilegedDb').PrivilegedTenantTransaction,tenantId:string,customerId:string,input:Parameters<typeof readShippingMergeAllocation>[3])=>readShippingMergeAllocation(tx,tenantId,customerId,input,readInvoiceVat)};
}
async function todayOrderSourcePorts():Promise<import('@/lib/server/todayOrderRead').TodayOrderReadPorts>{
 const [{readInvoiceVat},{readShippingSettingsInTransaction}]=await Promise.all([import('@/modules/accounting/server-public'),import('@/modules/fundament/server-public')]);
 return {readVat:readInvoiceVat,readSettings:readShippingSettingsInTransaction,
  readCredit:async(tx,tenantId,customerId)=>{
   const [{readCustomerCreditInTransaction},{readCustomerProfile}]=await Promise.all([import('@/modules/accounting/server-public'),import('@/modules/customers/server-public')]);
   return readCustomerCreditInTransaction(tx,tenantId,customerId,readCustomerProfile);
  },
  readShipments:async(auth,ids,readSettings)=>{
   const {readManualShippingBatch}=await import('@/modules/orders/server-public');
   return readManualShippingBatch(auth,ids,{...await manualShippingPorts(),readSettings});
  },
 };
}


export async function markOrderInformedByPhoneAction(input:{orderId:string;expectedVersion:number;clientEventId:string}){
 return observeAction('markOrderInformedByPhoneAction',subjectForAction('markOrderInformedByPhoneAction',input),async()=>{
 const auth=await resolveOrderCardAuthorization();if(!auth.ok)return auth.result;
 const {markOrderInformedByPhone}=await import('@/lib/server/orderReleaseRead');
 const result=await markOrderInformedByPhone(auth.data,input);
 if(result.code==='OK'){revalidatePath('/warendurchlauf');revalidatePath('/orders');}
 return result;

 },readLoggingSettings);
}
export async function setOrderPickupAppointmentAction(input:unknown){
 return observeAction('setOrderPickupAppointmentAction',subjectForAction('setOrderPickupAppointmentAction',input),async()=>{
 const auth=await resolveOrderCardAuthorization();if(!auth.ok)return auth.result;
 const {setOrderPickupAppointment,readAppointmentPostalContext}=await import('@/lib/server/pickupAppointmentPort');
 const [{finishDispatchCallsForAppointment},{completeOrderCallbackTask},{recordIntakeTaskEffect},{readCustomerProfile}]=await Promise.all([import('@/lib/server/dispatchCallPort'),import('@/modules/tasks/server-public'),import('@/modules/eingang/server-public'),import('@/modules/customers/server-public')]);
 const [{finishPostalTasksForAppointment},{finishFinalTasksForAppointment},{completeStorageTaskForAppointment,restrictCollectionTaskForAppointment,createOrderHandoverTask}]=await Promise.all([import('@/lib/server/storagePostalPort'),import('@/lib/server/storageFinalStagePort'),import('@/modules/tasks/server-public')]);
 const {readShippingSettingsInTransaction}=await import('@/modules/fundament/server-public');
 const result=await setOrderPickupAppointment(auth.data,input,async(tx,receipt)=>{
  const effects={effect:(writeTx:import('@/lib/server/privilegedDb').PrivilegedTenantTransaction,actor:AuthorizationSnapshot,effect:import('@/modules/tasks/server-public').TaskEffectRequest)=>recordIntakeTaskEffect(writeTx,actor,effect,readCustomerProfile)};
  await finishDispatchCallsForAppointment(tx,auth.data,receipt,(taskId,note)=>completeOrderCallbackTask(tx,auth.data,taskId,note,effects),taskId=>restrictCollectionTaskForAppointment(tx,auth.data,{taskId,appointmentEventId:receipt.eventId},effects));
  const close=(taskId:string,note:string)=>completeStorageTaskForAppointment(tx,auth.data,{taskId,note,appointmentEventId:receipt.eventId},effects);
  const postalContext=await readAppointmentPostalContext(tx,auth.data,receipt.eventId);
  if(postalContext.sourceTaskId){
  const settings=await readShippingSettingsInTransaction(tx,auth.data.tenantId);if(!settings)throw Error('PICKUP_POSTAL_SETTINGS_UNAVAILABLE');
  await finishPostalTasksForAppointment(tx,auth.data,receipt,close,{
   settingsUpdatedAt:settings.updatedAt,
   customerCurrent:async(writeTx,snapshot)=>{const {customerCountryLabel}=await import('@/modules/customers/public');const customer=await readCustomerProfile(writeTx,auth.data.tenantId,postalContext.customerId,true),r=snapshot.recipient;return !!customer&&customer.name===r.name&&[customer.street,customer.houseNumber].filter(Boolean).join(' ')===r.street&&customer.zipCode===r.zip&&customer.city===r.city&&customerCountryLabel(customer.country)===r.country;},
   createTask:(writeTx,value)=>createOrderHandoverTask(writeTx,auth.data,value,effects,postalContext.sourceTaskId?{taskId:postalContext.sourceTaskId,appointmentEventId:receipt.eventId}:undefined)
  });
  }
  await finishFinalTasksForAppointment(tx,auth.data,receipt,close,taskId=>restrictCollectionTaskForAppointment(tx,auth.data,{taskId,appointmentEventId:receipt.eventId},effects));
 });
 if(result.code==='OK'){revalidatePath('/warendurchlauf');revalidatePath('/orders');}
 return result;

 },readLoggingSettings);
}
async function readManualShippingForOrder(auth:AuthorizationSnapshot,orderId:unknown){
 const {readManualShipping}=await import('@/modules/orders/server-public');
 return readManualShipping(auth,orderId,await manualShippingPorts());
}
export async function getManualShippingAction(input:{orderId:string}){
 return observeAction('getManualShippingAction',subjectForAction('getManualShippingAction',input),async()=>{
 const auth=await resolveOrderCardAuthorization();if(!auth.ok)return auth.result;
 return readManualShippingForOrder(auth.data,input?.orderId);

 },readLoggingSettings);
}
export async function saveManualTrackingAction(input:unknown){
 return observeAction('saveManualTrackingAction',subjectForAction('saveManualTrackingAction',input),async()=>{
 const auth=await resolveOrderCardAuthorization();if(!auth.ok)return auth.result;
 const {saveManualTracking}=await import('@/modules/orders/server-public');
 const result=await saveManualTracking(auth.data,input,await manualShippingPorts());
 if(result.code==='OK'){revalidatePath('/warendurchlauf');revalidatePath('/orders');}
 return result;

 },readLoggingSettings);
}

export async function getExtraWorkMasterDataAction(): Promise<OrderCardActionResult<ExtraWorkMasterData>> {
  noStore();
  try {
    const authorization = await resolveOrderCardAuthorization();
    if (!authorization.ok) return authorization.result;
    const { readExtraWorkMasterData } = await import("@/lib/server/orderCardRead");
    return readExtraWorkMasterData(authorization.data);
  } catch (error) {
    console.error("[ORDER_CARD_EXTRA_WORK_ACTION_ERROR]", {
      message: error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN",
    });
    return { code: "UNAVAILABLE", message: "Mehrarbeitsstammdaten sind derzeit nicht verfügbar." };
  }
}

export async function getOrderFrozenReceiptAction(input: {
  orderId: string;
  clientEventId: string;
}) {
  noStore();
  const authorization = await resolveOrderCardAuthorization();
  if (!authorization.ok) return authorization.result;
  const { readOrderFrozenReceipt } = await import("@/lib/server/orderFreezeRead");
  return readOrderFrozenReceipt(authorization.data, input);
}

export async function getOrderFreezeCorrectionReceiptAction(input: {
  orderId: string;
  clientEventId: string;
}) {
  noStore();
  const authorization = await resolveOrderCardAuthorization();
  if (!authorization.ok) return authorization.result;
  const { readOrderFreezeCorrectionReceipt } = await import(
    "@/lib/server/orderFreezeCorrectionRead"
  );
  return readOrderFreezeCorrectionReceipt(authorization.data, input);
}

export async function getOrderTaskAssignmentReceiptAction(input: {
  orderId: string;
  clientEventId: string;
}) {
  noStore();
  const authorization = await resolveOrderCardAuthorization();
  if (!authorization.ok) return authorization.result;
  const { readOrderTaskAssignmentReceipt } = await import(
    "@/lib/server/orderTaskAssignmentRead"
  );
  return readOrderTaskAssignmentReceipt(authorization.data, input);
}

export async function getOrderItemExtraWorkReceiptAction(input: {
  orderId: string;
  clientEventId: string;
}) {
  noStore();
  const authorization = await resolveOrderCardAuthorization();
  if (!authorization.ok) return authorization.result;
  const { readOrderItemExtraWorkReceipt } = await import(
    "@/lib/server/extraWorkReceiptRead"
  );
  return readOrderItemExtraWorkReceipt(authorization.data, input);
}

export async function getExtraWorkCatalogReceiptAction(input: {
  positionId: string;
  clientEventId: string;
}) {
  noStore();
  const authorization = await resolveOrderCardAuthorization();
  if (!authorization.ok) return authorization.result;
  const { readExtraWorkCatalogReceipt } = await import(
    "@/lib/server/extraWorkReceiptRead"
  );
  return readExtraWorkCatalogReceipt(authorization.data, input);
}

export async function getExtraWorkRateReceiptAction(input: {
  rateId: string;
  clientEventId: string;
}) {
  noStore();
  const authorization = await resolveOrderCardAuthorization();
  if (!authorization.ok) return authorization.result;
  const { readExtraWorkRateReceipt } = await import(
    "@/lib/server/extraWorkReceiptRead"
  );
  return readExtraWorkRateReceipt(authorization.data, input);
}

async function resolveOperationalReadAuthorization(): Promise<ActionResult<AuthorizationSnapshot>> {
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return {
      ok: false,
      error: "DB_ERROR",
      message: "Auftragsdaten sind derzeit nicht verfügbar.",
    };
  }

  if (!authorization.ok) {
    if (authorization.reason === "AUTHORIZATION_UNAVAILABLE") {
      return {
        ok: false,
        error: "DB_ERROR",
        message: "Auftragsdaten sind derzeit nicht verfügbar.",
      };
    }
    return {
      ok: false,
      error: "UNAUTHORIZED",
      message: "Sitzung oder Berechtigung ist nicht verfügbar.",
    };
  }

  if (!authorization.data.permissions.includes("perm_view_leitstand")) {
    return {
      ok: false,
      error: "FORBIDDEN",
      message: "Auftragsansicht ist nicht erlaubt.",
    };
  }

  return { ok: true, data: authorization.data };
}

export async function getOrdersDb(): Promise<ActionResult<OrderResponse[]> & {serverReadAt?:string;cacheLoginScope?:string}> {
 return observeAction('getOrdersDb',subjectForAction('getOrdersDb',undefined),async()=>{
  noStore();
  const authorization = await resolveOperationalReadAuthorization();
  if (!authorization.ok) return authorization.error==='FORBIDDEN'||authorization.error==='UNAUTHORIZED'?{...authorization,serverReadAt:new Date().toISOString(),cacheLoginScope:await readCacheLoginScope()}:authorization;

  try {
    const { getOperationalOrders } = await import("@/lib/server/operationalOrders");
    const [{ readLiveOrderCard }, orders] = await Promise.all([
      import("@/lib/server/orderCardRead"),
      getOperationalOrders(authorization.data),
    ]);
    const cardReads = await Promise.all(orders.map((order) => readLiveOrderCard(authorization.data, { orderId: order.id })));
    const finished=orders.some(order=>order.station==='fertig')?await (async()=>{
     const [{readFinishedDispatchQueue},{readShippingSettings}]=await Promise.all([import('@/modules/orders/server-public'),import('@/modules/fundament/server-public')]);
     const settings=await readShippingSettings({tenantId:authorization.data.tenantId,actorId:authorization.data.userId,canRead:true});
     if(settings.code==='UNAVAILABLE')return {code:'UNAVAILABLE' as const};
     const [{readCustomerProfile},{withPrivilegedTenantTransaction}]=await Promise.all([import('@/modules/customers/server-public'),import('@/lib/server/privilegedDb')]);
     return readFinishedDispatchQueue(authorization.data,orders,settings.code==='OK'?settings.settings.dispatchPolicy??null:null,{readHasMail:id=>withPrivilegedTenantTransaction(authorization.data,async tx=>{const customer=await readCustomerProfile(tx,authorization.data.tenantId,id);if(!customer)throw Error('DISPATCH_CUSTOMER_NOT_FOUND');return !!customer.email?.trim();})});
    })():{code:'OK' as const,rows:[]};
    const projections=new Map(finished.code==='OK'?finished.rows.map((row,rank)=>[row.orderId,{state:row.unavailable?'unavailable' as const:'available' as const,rank,...row}]):[]);
    const data: OrderResponse[] = orders.map((order, index) => {
      const cardRead = cardReads[index];
      return {
        ...order,
        ...(order.station==='fertig'?{finishedDispatch:projections.get(order.id)??{state:'unavailable' as const}}:{}),
        cardReadErrorCode: cardRead?.code === "OK"
          ? null
          : cardRead?.code === "UNAVAILABLE"
            ? cardRead.errorCode ?? "ORDER_CARD_READ_FAILED"
            : `ORDER_CARD_${cardRead?.code ?? "READ_FAILED"}`,
      };
    });
    return { ok: true, data,serverReadAt:new Date().toISOString(),cacheLoginScope:await readCacheLoginScope() };
  } catch (error: unknown) {
    console.error("[ORDER_READ_ERROR]", error);
    return {
      ok: false,
      error: "DB_ERROR",
      message: "Auftragsdaten konnten nicht sicher geladen werden.",
    };
  }

 },readLoggingSettings);
}

/**
 * F3 register read: one tenant-bound source for the order list and its KV
 * filter. The UI can select either aggregate without joining client results or
 * resolving authorization twice.
 */
export async function getOrderRegisterDb(
  input: { filter: OrderRegisterFilter } = { filter: "ALL" },
): Promise<ActionResult<OrderRegisterEntry[]>> {
  noStore();
  if (
    !input
    || typeof input !== "object"
    || Object.keys(input).length !== 1
    || !["ALL", "ORDER", "QUOTE"].includes(input.filter)
  ) {
    return {
      ok: false,
      error: "VALIDATION_ERROR",
      message: "Auftragsfilter ist ungültig.",
    };
  }

  const authorization = await resolveOperationalReadAuthorization();
  if (!authorization.ok) return authorization;

  try {
    const readOrders = input.filter !== "QUOTE";
    const readQuotes = input.filter !== "ORDER";
    const [orderRows, quoteResult] = await Promise.all([
      readOrders
        ? import("@/lib/server/operationalOrders").then(({ getOperationalOrders }) => getOperationalOrders(authorization.data))
        : Promise.resolve([]),
      readQuotes
        ? import("@/modules/quotes/server-public").then(({ listOpenQuotesCommand }) => listOpenQuotesCommand({
          tenantId: authorization.data.tenantId,
          userId: authorization.data.userId,
          capabilities: {
            canCreateQuote: false,
            canReadQuote: true,
            canUpdateQuote: false,
            canConvertQuote: false,
          },
        }))
        : Promise.resolve({ code: "OK" as const, quotes: [] }),
    ]);

    if (quoteResult.code !== "OK") {
      return {
        ok: false,
        error: quoteResult.code === "FORBIDDEN" ? "FORBIDDEN" : "DB_ERROR",
        message: "Aufträge und KVs konnten nicht gemeinsam sicher geladen werden.",
      };
    }

    const entries: OrderRegisterEntry[] = [
      ...orderRows.map((order) => ({
        kind: "ORDER" as const,
        id: order.id,
        reference: order.orderNumber,
        customerId: order.customerId,
        customerName: order.customerName ?? "",
        title: order.title,
        dueDate: order.dueDate,
        status: order.status,
        changedAt: order.serverChangedAt ?? null,
      })),
      ...quoteResult.quotes.map((quote) => ({
        kind: "QUOTE" as const,
        id: quote.quoteId,
        reference: quote.quoteNumber,
        customerId: quote.customerId,
        customerName: quote.customerDisplayName,
        title: quote.positions[0]?.name ?? quote.quoteNumber,
        dueDate: quote.dueDate,
        status: quote.status,
        changedAt: quote.updatedAt,
      })),
    ];

    entries.sort((left, right) => {
      const timeOrder = (right.changedAt ?? "").localeCompare(left.changedAt ?? "");
      return timeOrder || left.reference.localeCompare(right.reference, "de");
    });
    return { ok: true, data: entries };
  } catch (error: unknown) {
    console.error("[ORDER_REGISTER_READ_ERROR]", error);
    return {
      ok: false,
      error: "DB_ERROR",
      message: "Aufträge und KVs konnten nicht gemeinsam sicher geladen werden.",
    };
  }
}

/** Tenant-bound count from the same versioned operational read port. */
export async function getOrderCountDb(): Promise<ActionResult<{ count: number }>> {
  noStore();
  const authorization = await resolveOperationalReadAuthorization();
  if (!authorization.ok) return authorization;

  try {
    const { getOperationalOrderCount } = await import("@/lib/server/operationalOrders");
    const count = await getOperationalOrderCount(authorization.data);
    return { ok: true, data: { count } };
  } catch (error: unknown) {
    console.error("[ORDER_COUNT_ERROR]", error);
    return {
      ok: false,
      error: "DB_ERROR",
      message: "Auftragsanzahl konnte nicht sicher geladen werden.",
    };
  }
}

export async function createOrderDb(data: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {
  void data;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Auftragserstellung benötigt den W3-Command-Vertrag." };
}

export async function updateOrderDb(id: string, changes: {
  status?: string;
  currentStationId?: string;
  priorityComputed?: string;
  title?: string;
}): Promise<ActionResult<Record<string, unknown>>> {
  void id;
  void changes;
  // F0-W2C-B1: This legacy ID-only writer has no actor, tenant, ownership, or
  // version contract. It must not start a partial order/item/feedback workflow.
  // W3 will replace it with a command contract; retain this ActionResult shape
  // so existing clients receive an explicit denial instead of a false success.
  return {
    ok: false,
    error: "CONFLICT",
    message: "NOT_AVAILABLE: Auftragsänderungen sind bis zum serverseitigen Command-Vertrag nicht verfügbar.",
  };
}

export async function getRiskOrders(_limit = 3): Promise<{ ok: false; error: "NOT_AVAILABLE"; message: string }> {
  void _limit;
  return { ok: false, error: "NOT_AVAILABLE", message: "NOT_AVAILABLE: Terminrisiken benötigen eine kanonische, quellgestützte Berechnung." };
}

// F0-W2C quarantine: transitionOrderProcess is an unsafe transition port without
// the W3 command contract. It denies every station transition until W3 replaces it.

export async function transitionOrderProcess(params: {
  orderId: string;
  targetStep?: string;
  action?: string;
}): Promise<ActionResult<never>> {
  void params;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Stationswechsel benötigen den W3-Command-Vertrag." };
}

export async function createOrderFromScan(params: {
  customerId?: string;
  customerName?: string;
  title?: string;
  parts: { name: string; quantity: number; surfaceRequested?: string; material?: string }[];
  forceCreateCustomer?: boolean;
}): Promise<
  | { ok: true; data: { orderId: string; newCustomerId?: string; status: string; customerChoices?: Record<string, unknown>[] } }
  | { ok: false; error: string; message: string; details?: unknown }
> {
  void params;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Auftragserstellung benötigt den W3-Command-Vertrag." };
}
