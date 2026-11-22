import {FINANCIAL_ACCESS_COPY} from '@/ui/financialAccessCopy';
import {MAIL_IMPORT_COPY} from '@/ui/situationCatalog';
import {E_INVOICE_COPY} from '@/ui/situationCatalog';
import {readEvidenceVisibilityRetrySource} from '@/lib/server/evidenceVisibilityUploadPort';
import {EVIDENCE_VISIBILITY_COPY} from '@/ui/situationCatalog';
import {canChangeOrderHandover} from '@/lib/auth/authorizationContract';
import {readManualHandoverSource} from '@/lib/server/orderHandoverSourcePort';
import {ORDER_HANDOVER_COPY} from '@/ui/situationCatalog';
import {canSynchronizeIntakeMailbox} from '@/lib/auth/authorizationContract';
import {MAILBOX_SYNC_COPY} from '@/ui/situationCatalog';
import {canReadQuoteFollowupsForRead} from '@/lib/server/authorizationReadContext';
import {readProductionPricingRetrySource,readProductionPricingRetryKeys} from '@/lib/server/productionSnapshotPort';
import {readCancellationCreditSource} from '@/lib/server/commands/customerCreditCommand';
import {readInvoiceReissueSource} from '@/lib/server/commands/immutableInvoiceCommand';
import {readCancelledCollectionRouting} from '@/lib/server/commands/immutableInvoiceCommand';
import {SHIPPING_FEE_COPY} from '@/ui/situationCatalog';
import {CUSTOMER_CREDIT_COPY,SITUATION_COPY,LEGACY_ACTION_ACCESS_COPY} from '@/ui/situationCatalog';
import {PRODUCTION_PRICING_RETRY_COPY} from '@/ui/situationCatalog';
import {readCanceledInvoiceMailTaskSource,isCanceledInvoiceMailTask,bindCanceledInvoiceMailTask,readCanceledInvoiceTaskCompletion} from '@/lib/server/communicationDocumentPort';
import {readInvoiceMailRemainderFailure,readInvoiceMailCoveringRequestIds,readInvoiceMailOpenRemainder} from '@/lib/server/communicationDocumentPort';
import {INVOICE_DELIVERY_COPY} from '@/ui/situationCatalog';
import {MAIL_RESEND_COPY} from '@/ui/situationCatalog';
import {handedOverProofs} from '@/lib/server/dispatchCallPort';
import {GOODS_OUT_FOLLOWUP_COPY} from '@/ui/situationCatalog';
import {COLLECTION_FOLLOWUP_COPY} from '@/ui/situationCatalog';
import {readCollectionFollowup} from '@/lib/server/invoiceCollectionFollowupRead';
import {readOfflineNoteConflictSource} from '@/lib/server/offlineNoteConflictPort';
import {readOfflineWorkshopConflictSource} from '@/lib/server/offlineWorkshopConflictPort';
import {readQuoteFollowupFacts,readQuoteGoodsOrderRetrySource} from '@/lib/server/quoteGoodsContextPort';
import {quoteOperationContext} from '@/lib/server/quoteAuthorization';
import {QUOTE_CYCLE_COPY} from '@/ui/situationCatalog';
import {storageTaskHasAppointmentSource} from '@/lib/server/pickupAppointmentPort';
import {collectionTaskHasReplySource,collectionTaskReplyRemainder,collectionTaskAppointmentRemainder,readCollectionTaskCurrentOrder} from '@/lib/server/dispatchReplyPort';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import {DISPATCH_CALL_COPY,COLLECTION_REMINDER_COPY,OFFLINE_RECONCILIATION_COPY} from '@/ui/situationCatalog';
import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,resolveAuthorization,readClarificationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {authorizationReadContext,type AuthorizedReadContext} from '@/lib/server/authorizationReadContext';
import {withPrivilegedTenantTransaction,withTenantSavepoint,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {canReadTaskArea,canCompleteTaskArea,type AccessArea} from '@/lib/auth/authorizationContract';
import {invoiceMailRemainderAllowsCompletion,TASK_KINDS,taskUuid,taskValidation,validTaskReference,type TaskReference,type TaskRecord,type TaskReferenceRead,type TaskSaveInput,type TaskFailure,type TaskResult,type TaskReadResult,type TaskCompleteInput,type TaskOpenRequest,type TaskCalendarRead} from '../contract';

export type TaskEffectRequest={key:string;taskId:string;action:'angelegt'|'geaendert'|'erledigt';kind:string;title:string;note:string|null;reference:TaskReferenceRead;itemId?:string;itemVersion?:number};
export type TaskEffects=(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:TaskEffectRequest)=>Promise<void|TaskFailure>;
type Dependencies={effect:TaskEffects;beforeComplete?:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,task:TaskRecord,input:TaskCompleteInput)=>Promise<void|TaskFailure>;readInvoice?:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string)=>Promise<{name:string|null;status:string;taskId:string|null}|null>};
class Rejected extends Error{constructor(readonly result:TaskFailure){super(result.code);}}
function reject(code:TaskFailure['code'],message:string):never{throw new Rejected({code,message});}
const columns=sql`id::text,client_key::text,art,titel,faellig_am::text,to_char(uhrzeit,'HH24:MI') AS uhrzeit,vorlauf_tage,fuer_login::text,fuer_bereich,bezug_typ,bezug_id,item_id::text,notiz,status,erledigt_von::text,erledigt_am::text,erledigt_notiz,erstellt_von::text,erstellt_am::text,version`;
const refAreas:Partial<Record<TaskReference['type'],AccessArea>>={kunde:'kunden',auftrag:'auftraege',kv:'auftraege',eingang:'eingang',eingangsrechnung:'buchhaltung',reklamation:'auftraege'};
const allowed=(auth:AuthorizationSnapshot,task:TaskRecord)=>task.erstellt_von===auth.userId||task.fuer_login===auth.userId||task.fuer_bereich!==null&&hasAuthorizationArea(auth,task.fuer_bereich);
async function reissueTaskSource(tx:PrivilegedTenantTransaction,auth:Pick<AuthorizationSnapshot,'tenantId'>,task:TaskRecord){
 const source=await readInvoiceReissueSource(tx,auth.tenantId,task.client_key);
 if(!source)return null;
 if(task.id!==source.receipt.eventId||task.art!=='aufgabe'||task.bezug_typ!=='auftrag'||task.bezug_id!==source.receipt.orderId)throw Error('INVOICE_REISSUE_TASK_REFERENCE_CHANGED');
 return source;
}
async function find(tx:PrivilegedTenantTransaction,auth:Pick<AuthorizationSnapshot,'tenantId'>,id:string,lock=false){
 const rows=await tx.execute<TaskRecord>(sql`SELECT ${columns} FROM public.tasks WHERE tenant_id=${auth.tenantId} AND id=${id}::uuid ${lock?sql`FOR UPDATE`:sql``}`);
 return rows.length===1?rows[0]:null;
}
function hiddenReference(reference:TaskReference):TaskReferenceRead{return {...reference,label:null,customerId:null,customerType:null,orderId:null,channel:null,phone:null,sourceVersion:null};}
function taskReferenceVisible(auth:AuthorizedReadContext,reference:TaskReferenceRead){
 if(reference.type==='allgemein')return false;
 const requiredArea=reference.type==='eingang'&&reference.channel==='mail'?'mails':refAreas[reference.type];
 return reference.type==='eingang'&&auth.canReadArea('mails')||requiredArea!==undefined&&auth.canReadArea(requiredArea);
}
async function context(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot|AuthorizedReadContext,reference:TaskReference,required=true,enforceVisibility=true):Promise<TaskReferenceRead>{
 const readAuth='canReadArea'in auth?auth:authorizationReadContext(auth);
 if(reference.type==='allgemein')return hiddenReference(reference);
 const rows=await tx.execute<Omit<TaskReferenceRead,'type'>>(sql`SELECT id,label,customer_id AS "customerId",customer_type AS "customerType",order_id AS "orderId",channel,phone,source_version AS "sourceVersion" FROM private.v_task_contexts_v1
  WHERE tenant_id=${auth.tenantId} AND kind=${reference.type} AND id=${reference.id}`);
 if(rows.length!==1){if(required)reject('NOT_FOUND','Bezug nicht verfügbar · Fehlercode: TASK_REFERENCE_NOT_FOUND.');return hiddenReference(reference);}
 const visible=taskReferenceVisible(readAuth,{...rows[0],type:reference.type});
 if(enforceVisibility&&(!visible)){if(required)reject('FORBIDDEN','Der Bezug ist für diesen Login nicht freigegeben.');return hiddenReference(reference);}
 return {...rows[0],type:reference.type};
}
async function recipient(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:TaskSaveInput){
 if(!input.forLogin)return;
 const rows=await tx.execute(sql`SELECT id FROM private.v_task_recipients_v1 WHERE tenant_id=${auth.tenantId} AND id=${input.forLogin}::uuid AND active`);
 if(rows.length!==1)reject('VALIDATION_ERROR','Zuständiger Login nicht verfügbar.');
}
function same(task:TaskRecord,input:TaskSaveInput){
 return task.art===input.kind&&task.titel===input.title.trim()&&task.faellig_am===input.dueDate&&task.uhrzeit===input.time&&task.fuer_login===input.forLogin&&task.fuer_bereich===input.forArea
  &&task.bezug_typ===input.reference.type&&task.bezug_id===input.reference.id&&task.notiz===(input.note?.trim()||null)&&task.item_id===(input.itemId??null);
}
function eventKey(id:string,version:number,action:string){
 const bytes=createHash('sha256').update('kreile-task-effect-v1:'+id+':'+version+':'+action).digest();bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const hex=bytes.subarray(0,16).toString('hex');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
async function session(){const result=await resolveAuthorization();return result.ok?result.data:null;}
function resultError(error:unknown):TaskFailure{
 console.error('[TASK_COMMAND_FAILED]',{code:error instanceof Rejected?error.result.code:'TASK_COMMAND_FAILED',message:error instanceof Error?error.message:'UnknownError'});
 return error instanceof Rejected?error.result:{code:'UNAVAILABLE',message:'Nicht gespeichert · Eingaben sind noch da. Fehlercode: TASK_COMMAND_FAILED.'};
}
export async function saveTask(input:unknown,deps:Dependencies):Promise<TaskResult>{
 const fields=taskValidation(input);if(Object.keys(fields).length)return {code:'VALIDATION_ERROR',message:'Aufgabe ist noch unvollständig.',fields};
 const value=input as TaskSaveInput,auth=await session();if(!auth)return {code:'UNAUTHENTICATED',message:'Sitzung ist nicht verfügbar.'};
 try{return await withPrivilegedTenantTransaction(auth,tx=>persistTask(tx,auth,value,deps));}catch(error){return resultError(error);}
}
/** Both dialog saves and the goods command use this writer and the caller's transaction. */
async function persistTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,value:TaskSaveInput,deps:Dependencies,enforceReferenceVisibility=true,invoiceCommand=false,replyRestriction=false,qualifiedCreateId?:string):Promise<Extract<TaskResult,{code:'OK'}>>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('task:'||${auth.tenantId}||':'||${value.clientKey},0))`);
  const candidates=await tx.execute<{id:string}>(sql`SELECT id::text FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=${value.clientKey}::uuid FOR UPDATE`);
  if(candidates.length>1)throw Error('TASK_CLIENT_KEY_AMBIGUOUS');
  const before=value.taskId?await find(tx,auth,value.taskId,true):candidates[0]?await find(tx,auth,candidates[0].id,true):null;
  if(before&&await readCollectionFollowup(tx,auth.tenantId,{markerId:before.client_key}))reject('FORBIDDEN',COLLECTION_FOLLOWUP_COPY.editBlocked);
  if(before&&(await readInvoiceMailRemainderFailure(tx,auth,before.client_key)||await readCancelledCollectionRouting(tx,auth.tenantId,before.client_key)))reject('FORBIDDEN',INVOICE_DELIVERY_COPY.followupEditBlocked);
  if(before&&await reissueTaskSource(tx,auth,before))reject('FORBIDDEN',SHIPPING_FEE_COPY.reissueForbidden);
  if(qualifiedCreateId&&before&&before.id!==qualifiedCreateId)reject('CONFLICT',ORDER_HANDOVER_COPY.conflict);
  if(value.taskId&&!before)reject('NOT_FOUND','Aufgabe nicht verfügbar.');
  if(before&&await isCanceledInvoiceMailTask(tx,auth,before.id))reject('FORBIDDEN','Aufgabe ist für diesen Login nicht änderbar.');
  if(before&&(before.client_key!==value.clientKey||!replyRestriction&&!allowed(auth,before)))reject('FORBIDDEN','Aufgabe ist für diesen Login nicht änderbar.');
  if(!before&&value.version!==0)reject('CONFLICT','Aufgabenstand ist nicht mehr aktuell.');
  if(before&&before.status!=='offen')reject('CONFLICT','Aufgabe ist bereits erledigt.');
  if(before&&before.bezug_typ==='auftrag'&&value.reference.type==='auftrag'&&before.bezug_id!==value.reference.id){
   const currentOrder=await readCollectionTaskCurrentOrder(tx,auth,before.id);
   if(currentOrder!==value.reference.id)reject('CONFLICT','Der ursprüngliche Bezug der Aufgabe bleibt erhalten.');
   // The dialog opens the current ware; only this qualified display reference maps
   // back to the immutable task provenance for the one existing writer.
   value={...value,reference:{type:'auftrag',id:before.bezug_id}};
  }
  if(before&&!value.taskId){if(before.erstellt_von===auth.userId&&same(before,value))return {code:'OK',task:before,replayed:true};reject('CONFLICT','Diese Anfragekennung gehört zu einer anderen Aufgabe.');}
  if(before&&before.version===value.version+1&&same(before,value))return {code:'OK',task:before,replayed:true};
  if(before&&before.version!==value.version)reject('CONFLICT','Aufgabe wurde inzwischen geändert · Eingaben bleiben erhalten.');
  if(before&&(before.bezug_typ!==value.reference.type||before.bezug_id!==value.reference.id||before.item_id!==(value.itemId??null)))reject('CONFLICT','Der ursprüngliche Bezug der Aufgabe bleibt erhalten.');
  if(value.kind==='rechnung'&&(!before||before.art!=='rechnung')&&!invoiceCommand)reject('FORBIDDEN','Rechnung klären entsteht ausschließlich beim Prüfen einer Eingangsrechnung.');
  if(before?.art==='rechnung'&&value.kind!=='rechnung')reject('FORBIDDEN','Rechnung klären kann nicht in eine andere Aufgabenart geändert werden.');
  // Existing-task authority was checked above; reference facts stay server-side in the history writer.
  const reference=await context(tx,auth,value.reference,true,!before&&enforceReferenceVisibility);await recipient(tx,auth,value);
  const id=before?.id??qualifiedCreateId??randomUUID();
  if(before)await tx.execute(sql`UPDATE public.tasks SET art=${value.kind},titel=${value.title.trim()},faellig_am=${value.dueDate}::date,uhrzeit=${value.time}::time,
   vorlauf_tage=${value.kind==='frist'?5:0},fuer_login=${value.forLogin}::uuid,fuer_bereich=${value.forArea},notiz=${value.note?.trim()||null},version=version+1
   WHERE tenant_id=${auth.tenantId} AND id=${id}::uuid AND version=${value.version}`);
  else await tx.execute(sql`INSERT INTO public.tasks(id,tenant_id,client_key,art,titel,faellig_am,uhrzeit,vorlauf_tage,fuer_login,fuer_bereich,bezug_typ,bezug_id,item_id,notiz,status,erstellt_von)
   VALUES(${id}::uuid,${auth.tenantId},${value.clientKey}::uuid,${value.kind},${value.title.trim()},${value.dueDate}::date,${value.time}::time,${value.kind==='frist'?5:0},${value.forLogin}::uuid,${value.forArea},${reference.type},${reference.id},${value.itemId??null}::uuid,${value.note?.trim()||null},'offen',${auth.userId}::uuid)`);
  const after=await find(tx,auth,id);if(!after||after.version!==value.version+1)throw Error('TASK_READBACK_FAILED');
  const effect=await deps.effect(tx,auth,{key:eventKey(id,after.version,'save'),taskId:id,action:before?'geaendert':'angelegt',kind:after.art,title:after.titel,note:after.notiz,reference,...(!before&&value.itemId?{itemId:value.itemId,itemVersion:value.itemVersion}:{})});if(effect)throw new Rejected(effect);
  return {code:'OK',task:after,replayed:false};
}
/** ware.annehmen: fixed task, authorized by Eingang; no client-selected recipient or reference. */
export async function createMissingGoodsTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{orderId:string;missing:string[];clientKey:string},deps:Dependencies):Promise<string>{
 if(!hasAuthorizationArea(auth,'eingang'))reject('FORBIDDEN','Warenannahme erfordert Eingang.');
 if(!taskUuid(input.clientKey)||!validTaskReference({type:'auftrag',id:input.orderId})||!input.missing.length||input.missing.some(label=>!label.trim()))reject('VALIDATION_ERROR','Offene Warenprüfung ist ungültig.');
 // Eingang already authorizes this goods/order context. No broader dialog/reference permission is granted.
 const reference=await context(tx,auth,{type:'auftrag',id:input.orderId},true,false);
 if(!reference.label)reject('NOT_FOUND','Auftragsnummer für die offene Warenprüfung fehlt.');
 const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
 const value:TaskSaveInput={clientKey:eventKey(input.clientKey,0,'goods-missing'),version:0,kind:'aufgabe',title:input.missing.join(', ')+' fehlt · '+reference.label,
  dueDate:clock.today,time:null,forLogin:null,forArea:'auftraege',reference:{type:'auftrag',id:input.orderId},note:input.missing.join('\n')};
 const fields=taskValidation(value);if(Object.keys(fields).length)reject('VALIDATION_ERROR','Aufgabe zur Warenprüfung ist ungültig.');
 return (await persistTask(tx,auth,value,deps,false)).task.id;
}

/** U252: the checked order/mail command creates a normal visible callback task. */
export async function createOrderHandoverTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{orderId:string;clientKey:string;title:string;note:string;taskId?:string;version?:number;kind?:'aufgabe';forLogin?:string;dueDate?:string},deps:Dependencies,appointmentSource?:{taskId:string;appointmentEventId:string},manualEventId?:string){
 if(!canChangeOrderHandover(auth,'login'))reject('FORBIDDEN',ORDER_HANDOVER_COPY.permission);
 let manual=false;
 if(manualEventId){
  const source=await readManualHandoverSource(tx,auth.tenantId,manualEventId),receipt=source.payload.receipt;
  if(source.order_id!==input.orderId||source.actor_id!==auth.userId||source.client_event_id!==input.clientKey
    ||source.current_order_version!==source.order_version||source.current_handover_mode!==receipt.handoverMode
    ||receipt.outcome!=='call_customer'||receipt.taskClientKey!==input.clientKey||receipt.taskTitle!==input.title||receipt.message!==input.note
    ||input.taskId!==undefined||input.version!==undefined||input.kind!==undefined||input.forLogin!==undefined||input.dueDate!==undefined||appointmentSource){
    reject('FORBIDDEN',ORDER_HANDOVER_COPY.permission);
  }
  manual=true;
 }
 if(!canChangeOrderHandover(auth,'mail')&&!manual&&(!appointmentSource||!await storageTaskHasAppointmentSource(tx,auth,appointmentSource.taskId,appointmentSource.appointmentEventId)))reject('FORBIDDEN','Übergabe klären benötigt Mails und Aufträge.');
 const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
 const value:TaskSaveInput={clientKey:input.clientKey,version:input.version??0,...(input.taskId?{taskId:input.taskId}:{}),kind:input.kind??'rueckruf',title:input.title,dueDate:input.dueDate??clock.today,time:null,forLogin:input.forLogin??null,forArea:input.forLogin?null:'auftraege',reference:{type:'auftrag',id:input.orderId},note:input.note};
 const errors=taskValidation(value);if(Object.keys(errors).length)reject('VALIDATION_ERROR','Rückruf-Aufgabe ist unvollständig.');
 // A manual source reserves only its own UUID for the real TaskWriter row;
 // an unrelated normal task with a coincident command key cannot be adopted.
 return (await persistTask(tx,auth,value,deps,true,false,false,manual?manualEventId:undefined)).task.id;
}

export async function readOrderHandoverTaskState(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{orderId:string;taskId:string}){
 const task=await find(tx,auth,input.taskId);
 if(!task||task.bezug_typ!=='auftrag'||task.bezug_id!==input.orderId||task.art!=='rueckruf'||!allowed(auth,task))return null;
 return {id:task.id,status:task.status,title:task.titel,note:task.notiz};
}
/** Only the invoice command can create this task; all persistence stays in persistTask. */
export async function createInvoiceClarificationTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{invoiceId:string;clientKey:string;reason:string},deps:Dependencies):Promise<string>{
 if(!canCompleteTaskArea(auth,'buchhaltung'))reject('FORBIDDEN',FINANCIAL_ACCESS_COPY.clarifyBookkeeping);
 if(!taskUuid(input.invoiceId)||!taskUuid(input.clientKey))reject('VALIDATION_ERROR','Rechnungskennung ist ungültig.');
 const invoice=await deps.readInvoice?.(tx,auth,input.invoiceId);
 if(!invoice||invoice.status!=='unklar')reject('CONFLICT','Rechnung ist nicht unklar.');
 const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
 const missingSupplier=input.reason==='Lieferant fehlt';
 const value:TaskSaveInput={clientKey:eventKey(input.clientKey,0,'invoice-unclear'),version:0,kind:missingSupplier?'aufgabe':'rechnung',title:missingSupplier?'Lieferant ergänzen':'Rechnung klären · '+(invoice.name??'Lieferant fehlt'),
  dueDate:clock.today,time:null,forLogin:null,forArea:missingSupplier?'eingang':'buchhaltung',reference:{type:'eingangsrechnung',id:input.invoiceId},note:input.reason};
 const fields=taskValidation(value);if(Object.keys(fields).length)reject('VALIDATION_ERROR','Aufgabe zur Rechnung ist ungültig.');
 return (await persistTask(tx,auth,value,deps,true,true)).task.id;
}
/** Shared completion writer. Invoice tasks remain inaccessible to the normal completion action. */
async function finishTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,value:TaskCompleteInput,deps:Dependencies,invoiceId?:string,quoteOperation?:{quoteId:string;keys:string[]},storageOperation?:{orderId:string;clientKey:string},replyEventId?:string):Promise<Extract<TaskResult,{code:'OK'}>>{
  const before=await find(tx,auth,value.taskId,true);if(!before)reject('NOT_FOUND','Aufgabe nicht verfügbar.');
  const reissue=await reissueTaskSource(tx,auth,before);
  if(reissue&&!hasAuthorizationArea(auth,'zahlungen'))reject('FORBIDDEN',SHIPPING_FEE_COPY.reissueForbidden);
  if(await isCanceledInvoiceMailTask(tx,auth,before.id)&&!await readCanceledInvoiceTaskCompletion(tx,auth,before.id))reject('FORBIDDEN','Aufgabe ist für diesen Login nicht änderbar.');
  const operationalQuote=quoteOperation&&before.art==='aufgabe'&&before.bezug_typ==='kv'&&before.bezug_id===quoteOperation.quoteId&&quoteOperation.keys.includes(before.client_key);
  const operationalStorage=storageOperation&&hasAuthorizationArea(auth,'auftraege')&&before.art==='aufgabe'&&before.bezug_typ==='auftrag'&&before.bezug_id===storageOperation.orderId&&before.client_key===storageOperation.clientKey;
  const operationalReply=replyEventId&&hasAuthorizationArea(auth,'auftraege')&&['aufgabe','rueckruf'].includes(before.art)&&before.bezug_typ==='auftrag'&&await collectionTaskHasReplySource(tx,auth,before.id,replyEventId);
  const operationalInvoice=invoiceId!==undefined&&before.bezug_typ==='eingangsrechnung'&&before.bezug_id===invoiceId&&canCompleteTaskArea(auth,'buchhaltung')&&(before.art==='rechnung'||before.art==='aufgabe'&&before.fuer_bereich==='eingang');
  if(!allowed(auth,before)&&!operationalQuote&&!operationalStorage&&!operationalReply&&!operationalInvoice&&!reissue)reject('FORBIDDEN','Aufgabe ist für diesen Login nicht freigegeben.');
  if(before.art==='rechnung'&&(!invoiceId||before.bezug_typ!=='eingangsrechnung'||before.bezug_id!==invoiceId||!canCompleteTaskArea(auth,'buchhaltung')))reject('FORBIDDEN','Rechnung klären wird ausschließlich in der Eingangsrechnung erledigt.');
  const note=value.note?.trim()||null;
  const completion=await deps.beforeComplete?.(tx,auth,before,value);if(completion)throw new Rejected(completion);
  const collection=await readCollectionFollowup(tx,auth.tenantId,{markerId:before.client_key});
  if(collection&&(collection.pending||before.bezug_typ!=='auftrag'||before.bezug_id!==collection.orderId||before.erstellt_von!==collection.actorId))throw Error('COLLECTION_FOLLOWUP_COMPLETION_NOT_PROVEN');
  const mailRemainder=await readInvoiceMailRemainderFailure(tx,auth,before.client_key);
  if(mailRemainder&&(!invoiceMailRemainderAllowsCompletion('KNOWN',mailRemainder)||before.bezug_typ!=='kunde'||before.bezug_id!==mailRemainder.customerId||before.erstellt_von!==mailRemainder.actorId))reject('CONFLICT',INVOICE_DELIVERY_COPY.remainderPending);
  const recollection=await readCancelledCollectionRouting(tx,auth.tenantId,before.client_key);
  if(recollection&&(recollection.pending||before.bezug_typ!=='kunde'||before.bezug_id!==recollection.customerId||before.erstellt_von!==recollection.receipt.cancelledBy))reject('CONFLICT',E_INVOICE_COPY.collectionRoutingPending);
  if(reissue){const repaired=await reissueTaskSource(tx,auth,before),credit=await readCancellationCreditSource(tx,auth.tenantId,before.client_key);if(!repaired||repaired.pending||!credit||credit.pending)reject('CONFLICT',SHIPPING_FEE_COPY.reissuePending);}
  if(before.status==='erledigt'){
   if(before.version===value.version+1&&before.erledigt_von===auth.userId&&before.erledigt_notiz===note)return {code:'OK',task:before,replayed:true};
   reject('CONFLICT','Aufgabe ist bereits erledigt.');
  }
  if(before.version!==value.version)reject('CONFLICT','Aufgabe wurde inzwischen geändert · Eingaben bleiben erhalten.');
  const reference=await context(tx,auth,{type:before.bezug_typ,id:before.bezug_id},true,false);
  await tx.execute(sql`UPDATE public.tasks SET status='erledigt',erledigt_von=${auth.userId}::uuid,erledigt_am=statement_timestamp(),erledigt_notiz=${note},version=version+1 WHERE tenant_id=${auth.tenantId} AND id=${before.id}::uuid AND version=${value.version}`);
  const after=await find(tx,auth,before.id);if(!after||after.version!==value.version+1||after.status!=='erledigt')throw Error('TASK_COMPLETION_READBACK_FAILED');
  const effect=await deps.effect(tx,auth,{key:eventKey(after.id,after.version,'complete'),taskId:after.id,action:'erledigt',kind:after.art,title:after.titel,note,reference});if(effect)throw new Rejected(effect);
  return {code:'OK',task:after,replayed:false};
}
export async function resolveInvoiceClarificationTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{invoiceId:string;taskId:string;note:string},deps:Dependencies):Promise<void>{
 if(!canCompleteTaskArea(auth,'buchhaltung'))reject('FORBIDDEN',FINANCIAL_ACCESS_COPY.clarifyBookkeeping);
 const invoice=await deps.readInvoice?.(tx,auth,input.invoiceId);
 if(!invoice||invoice.taskId!==input.taskId||invoice.status==='unklar')reject('CONFLICT','Rechnung wurde noch nicht geklärt.');
 const task=await find(tx,auth,input.taskId,true);
 if(!task||task.bezug_typ!=='eingangsrechnung'||task.bezug_id!==input.invoiceId||!(task.art==='rechnung'||task.art==='aufgabe'&&task.fuer_bereich==='eingang'))reject('NOT_FOUND','Rechnungsaufgabe nicht verfügbar.');
 // An incoming operator may already have completed the supplier task. Its real
 // completion remains intact; the separately proven invoice is now clarified.
 if(task.art==='aufgabe'&&task.status==='erledigt')return;
 await finishTask(tx,auth,{taskId:task.id,version:task.version,note:input.note},deps,input.invoiceId);
}
export async function completeTask(input:unknown,deps:Dependencies):Promise<TaskResult>{
 if(!input||typeof input!=='object'||Array.isArray(input))return {code:'VALIDATION_ERROR',message:'Aufgabenkennung fehlt.'};
 const value=input as TaskCompleteInput;
 if(!['note,taskId,version','callResult,note,taskId,version','note,postalResult,taskId,version'].includes(Object.keys(value).sort().join(','))||value.callResult!==undefined&&!['reached','notReached'].includes(value.callResult)||!taskUuid(value.taskId)||!Number.isSafeInteger(value.version)||value.version<1||!(value.note===null||typeof value.note==='string'&&value.note.length<=2000))return {code:'VALIDATION_ERROR',message:'Aufgabenkennung oder Notiz ist ungültig.'};
 if(value.postalResult!==undefined&&(!deps.beforeComplete||!value.postalResult||typeof value.postalResult!=='object'||!['posted','discarded'].includes(value.postalResult.kind)||typeof value.postalResult.documentSha256!=='string'||!/^[a-f\d]{64}$/.test(value.postalResult.documentSha256)))return {code:'VALIDATION_ERROR',message:COLLECTION_REMINDER_COPY.postalDateMissing};
 if(value.callResult!==undefined&&!deps.beforeComplete)return {code:'VALIDATION_ERROR',message:DISPATCH_CALL_COPY.notCall};
 const auth=await session();if(!auth)return {code:'UNAUTHENTICATED',message:'Sitzung ist nicht verfügbar.'};
 try{return await withPrivilegedTenantTransaction(auth,tx=>finishTask(tx,auth,value,deps));}catch(error){return resultError(error);}
}
/** A checked goods-out composition finishes the same visible task atomically, never via a second UPDATE writer. */
export async function completeOrderCallbackTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,taskId:string,note:string,deps:Dependencies):Promise<void>{
 if(!hasAuthorizationArea(auth,'auftraege'))reject('FORBIDDEN',DISPATCH_CALL_COPY.forbidden);
 const before=await find(tx,auth,taskId,true);if(!before||before.art!=='rueckruf'||before.bezug_typ!=='auftrag')reject('NOT_FOUND',DISPATCH_CALL_COPY.notCall);
 if(before.status==='erledigt')return;
 await finishTask(tx,auth,{taskId,version:before.version,note},deps);
}
/** Only a qualified goods-out composition supplies this fixed source key, never the task dialog. */
export async function completeStorageTaskAfterGoodsOut(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{taskId:string;orderId:string;clientKey:string},deps:Dependencies):Promise<void>{
 if(!hasAuthorizationArea(auth,'auftraege'))reject('FORBIDDEN',DISPATCH_CALL_COPY.forbidden);
 const before=await find(tx,auth,input.taskId,true);
 if(!before||before.art!=='aufgabe'||before.bezug_typ!=='auftrag'||before.bezug_id!==input.orderId||before.client_key!==input.clientKey)reject('CONFLICT',DISPATCH_CALL_COPY.changed);
 const source=await tx.execute(sql`SELECT task_id FROM private.v_storage_final_task_context_v1 WHERE tenant_id=${auth.tenantId} AND task_id=${before.id} AND client_key=${before.client_key} AND creator_id=${before.erstellt_von} AND order_id=${input.orderId} AND integrity_ok AND goods_out_complete`);
 if(source.length!==1)reject('CONFLICT',DISPATCH_CALL_COPY.changed);
 if(before.status==='erledigt')return;
 await finishTask(tx,auth,{taskId:before.id,version:before.version,note:COLLECTION_REMINDER_COPY.finalTaskGoodsGone},deps,undefined,undefined,input);
}
/** A real appointment can end its original storage task, including an assigned task.
 * The ordinary task action receives no additional rights. */
export async function completeStorageTaskForAppointment(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{taskId:string;appointmentEventId:string;note:string},deps:Dependencies):Promise<void>{
 if(!hasAuthorizationArea(auth,'auftraege'))reject('FORBIDDEN',DISPATCH_CALL_COPY.forbidden);
 const before=await find(tx,auth,input.taskId,true);
 if(!before||before.art!=='aufgabe'||before.bezug_typ!=='auftrag'||!before.bezug_id||!await storageTaskHasAppointmentSource(tx,auth,before.id,input.appointmentEventId))reject('CONFLICT',DISPATCH_CALL_COPY.changed);
 if(before.status==='erledigt')return;
 await finishTask(tx,auth,{taskId:before.id,version:before.version,note:input.note},deps,undefined,undefined,{orderId:before.bezug_id,clientKey:before.client_key});
}
/** Only a qualified original reply can end this original collection task. */
export async function completeCollectionTaskForReply(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{taskId:string;replyEventId:string;note:string},deps:Dependencies):Promise<void>{
 if(!hasAuthorizationArea(auth,'auftraege')||!await collectionTaskHasReplySource(tx,auth,input.taskId,input.replyEventId))reject('FORBIDDEN',DISPATCH_CALL_COPY.forbidden);
 const before=await find(tx,auth,input.taskId,true);
 if(!before||!['aufgabe','rueckruf'].includes(before.art)||before.bezug_typ!=='auftrag')reject('CONFLICT',DISPATCH_CALL_COPY.changed);
 if(before.status==='erledigt')return;
 await finishTask(tx,auth,{taskId:before.id,version:before.version,note:input.note},deps,undefined,undefined,undefined,input.replyEventId);
}
/** Keep the task, recipient and date; preserve the immutable original reference and narrow only the ware note. */
export async function restrictCollectionTaskForReply(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{taskId:string;replyEventId:string},deps:Dependencies){
 const scope=await collectionTaskReplyRemainder(tx,auth,input.taskId,input.replyEventId),before=await find(tx,auth,input.taskId,true);
 if(!scope||!before||before.status!=='offen'||!['aufgabe','rueckruf'].includes(before.art)||before.bezug_typ!=='auftrag'||!before.bezug_id)reject('CONFLICT',DISPATCH_CALL_COPY.changed);
 const value:TaskSaveInput={taskId:before.id,clientKey:before.client_key,version:before.version,kind:before.art as 'aufgabe'|'rueckruf',title:before.titel,dueDate:before.faellig_am,time:before.uhrzeit,forLogin:before.fuer_login,forArea:before.fuer_bereich,reference:{type:'auftrag',id:before.bezug_id},note:scope.note,...(before.item_id?{itemId:before.item_id}:{})};
 const saved=await persistTask(tx,auth,value,deps,false,false,true);
 return {version:saved.task.version,note:scope.note,freezes:scope.freezes};
}
export async function restrictCollectionTaskForAppointment(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{taskId:string;appointmentEventId:string},deps:Dependencies){
 const scope=await collectionTaskAppointmentRemainder(tx,auth,input.taskId,input.appointmentEventId),before=await find(tx,auth,input.taskId,true);
 if(!scope||!before||before.status!=='offen'||!['aufgabe','rueckruf'].includes(before.art)||before.bezug_typ!=='auftrag'||!before.bezug_id)reject('CONFLICT',DISPATCH_CALL_COPY.changed);
 const value:TaskSaveInput={taskId:before.id,clientKey:before.client_key,version:before.version,kind:before.art as 'aufgabe'|'rueckruf',title:before.titel,dueDate:before.faellig_am,time:before.uhrzeit,forLogin:before.fuer_login,forArea:before.fuer_bereich,reference:{type:'auftrag',id:before.bezug_id},note:scope.note,...(before.item_id?{itemId:before.item_id}:{})};
 const saved=await persistTask(tx,auth,value,deps,false,false,true);
 return {version:saved.task.version,note:scope.note,freezes:scope.freezes};
}
/** Common task facts have no acting login or personal command flags. */
export type TaskReadContext=AuthorizedReadContext&Readonly<{canReadTaskArea:(area:AccessArea|null)=>boolean}>;
export type TaskSourceRead=Awaited<ReturnType<typeof readTaskSourceInTransaction>>;
export type TaskCalendarSources={code:'OK'|'SOURCE_INCOMPLETE';rows:TaskSourceRead[];missingTaskIds:string[]};
function liveTaskReadContext(auth:AuthorizationSnapshot):TaskReadContext{
 return {...authorizationReadContext(auth),canReadTaskArea:area=>canReadTaskArea(auth,area)};
}
function validateTaskRead(request:TaskOpenRequest|{calendar:true}):TaskFailure|null{
 if(request&&typeof request==='object'&&!Array.isArray(request)&&'calendar'in request){
  return Object.keys(request).join(',')!=='calendar'||request.calendar!==true?{code:'VALIDATION_ERROR',message:'Aufgabenaufruf ist ungültig.'}:null;
 }
 if(!request||typeof request!=='object'||Array.isArray(request)||('taskId'in request?!taskUuid(request.taskId):!validTaskReference(request.reference)))return {code:'VALIDATION_ERROR',message:'Aufgabenaufruf ist ungültig.'};
 if('taskId'in request?Object.keys(request).join(',')!=='taskId':Object.keys(request).some(key=>!['reference','kind','itemId'].includes(key))||request.kind!==undefined&&!TASK_KINDS.includes(request.kind)||request.itemId!==undefined&&!taskUuid(request.itemId))return {code:'VALIDATION_ERROR',message:'Aufgabenaufruf enthält ungültige Felder.'};
 return null;
}
export async function readTask(request:TaskOpenRequest):Promise<TaskReadResult>;
export async function readTask(request:{calendar:true}):Promise<TaskCalendarRead>;
export async function readTask(request:TaskOpenRequest|{calendar:true}):Promise<TaskReadResult|TaskCalendarRead>{
 const invalid=validateTaskRead(request);if(invalid)return invalid;
 const auth=await session();if(!auth)return {code:'UNAUTHENTICATED',message:'Sitzung ist nicht verfügbar.'};
 return 'calendar'in request?readTaskForAuthorization(auth,request):readTaskForAuthorization(auth,request);
}
export function readTaskForAuthorization(auth:AuthorizationSnapshot,request:TaskOpenRequest):Promise<TaskReadResult>;
export function readTaskForAuthorization(auth:AuthorizationSnapshot,request:{calendar:true}):Promise<TaskCalendarRead>;
export function readTaskForAuthorization(auth:TaskReadContext,request:TaskOpenRequest):Promise<TaskSourceRead|TaskFailure>;
export function readTaskForAuthorization(auth:TaskReadContext,request:{calendar:true}):Promise<TaskCalendarSources|TaskFailure>;
export async function readTaskForAuthorization(auth:AuthorizationSnapshot|TaskReadContext,request:TaskOpenRequest|{calendar:true}):Promise<TaskReadResult|TaskCalendarRead|TaskSourceRead|TaskCalendarSources>{
 const invalid=validateTaskRead(request);if(invalid)return invalid;
 const readAuth='canReadArea'in auth?auth:liveTaskReadContext(auth);
 if('calendar'in request){
  if(!readAuth.canReadArea('mails'))return {code:'FORBIDDEN',message:DISPATCH_CALL_COPY.forbidden};
  try{return await withPrivilegedTenantTransaction(auth,async tx=>{
   const refs=await tx.execute<{id:string;version:number}>(sql`SELECT id::text,version FROM public.tasks WHERE tenant_id=${auth.tenantId} AND status='offen' AND art IN ('rueckruf','frist','aufgabe') AND item_id IS NOT NULL ORDER BY faellig_am,id`);
   const rows:Extract<TaskCalendarRead,{rows:unknown}>['rows']=[],sources:TaskSourceRead[]=[],missingTaskIds:string[]=[];
   for(const ref of refs){
    try{
     const source=await withTenantSavepoint(tx,nested=>readTaskSourceInTransaction(nested,auth,{taskId:ref.id}));
     if(!source.task||source.task.version!==ref.version||source.task.status!=='offen'||!source.task.item_id){missingTaskIds.push(ref.id);continue;}
     if('canReadArea'in auth){sources.push(source);if(source.canceledForEdit.code==='SOURCE_INCOMPLETE')missingTaskIds.push(ref.id);}
     else rows.push(projectCalendarTaskSource(auth,source));
     if(source.pricingSource==='SOURCE_INCOMPLETE'||source.collectionSource==='SOURCE_INCOMPLETE'||source.invoiceFollowupSource==='SOURCE_INCOMPLETE')missingTaskIds.push(ref.id);
    }catch{missingTaskIds.push(ref.id);}
   }
   const code=missingTaskIds.length?'SOURCE_INCOMPLETE' as const:'OK' as const;
   return 'canReadArea'in auth?{code,rows:sources,missingTaskIds}:{code,rows,missingTaskIds};
  });}catch(error){return resultError(error);}
 }
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const source=await readTaskSourceInTransaction(tx,auth,request);
  return 'canReadArea'in auth?source:presentTaskSource(auth,source);
 });}catch(error){return resultError(error);}
}
/** Same actor/recipient/reference projection as the live calendar read. */
function projectCalendarTaskSource(auth:AuthorizationSnapshot,source:TaskSourceRead){
 const task=source.task;
 if(!task||!task.item_id)throw Error('TASK_CALENDAR_SOURCE_INVALID');
 if(!canReadTaskArea(auth,task.fuer_bereich))reject('FORBIDDEN',LEGACY_ACTION_ACCESS_COPY.forbidden);
 const reference=source.reference.type==='allgemein'||taskReferenceVisible(liveTaskReadContext(auth),source.reference)?source.reference:hiddenReference(source.reference);
 const read=presentTaskSource(auth,{...source,reference});
 return {id:task.id,version:task.version,itemId:task.item_id,dueDate:task.faellig_am,canComplete:read.canComplete,canOpenReference:read.canOpenReference};
}
export function projectTaskCalendarSources(auth:AuthorizationSnapshot,source:TaskCalendarSources):TaskCalendarRead{
 if(!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN',message:DISPATCH_CALL_COPY.forbidden};
 const missingTaskIds=source.missingTaskIds.filter(id=>{
  const known=source.rows.find(row=>row.task?.id===id);if(!known)return true;
  return known.pricingSource==='SOURCE_INCOMPLETE'||known.collectionSource==='SOURCE_INCOMPLETE'||known.invoiceFollowupSource==='SOURCE_INCOMPLETE'
   ||known.canceledForEdit.code==='SOURCE_INCOMPLETE'&&!!known.task&&allowed(auth,known.task);
 });
 const rows:Extract<TaskCalendarRead,{rows:unknown}>['rows']=[];
 for(const known of source.rows){
  try{rows.push(projectCalendarTaskSource(auth,known));}
  catch(error){
   if(!known.task)throw error;
   if(!missingTaskIds.includes(known.task.id))missingTaskIds.push(known.task.id);
  }
 }
 const unknownGap=source.code==='SOURCE_INCOMPLETE'&&source.missingTaskIds.length===0;
 return {code:missingTaskIds.length||unknownGap?'SOURCE_INCOMPLETE':'OK',rows,missingTaskIds};
}
async function readTaskSourceInTransaction(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot|TaskReadContext,request:TaskOpenRequest){
 const readAuth='canReadArea'in auth?auth:liveTaskReadContext(auth);
  const task='taskId'in request?await find(tx,auth,request.taskId):null;
  if('taskId'in request&&!task)reject('NOT_FOUND','Aufgabe nicht verfügbar.');
  if(task&&!readAuth.canReadTaskArea(task.fuer_bereich))reject('FORBIDDEN',LEGACY_ACTION_ACCESS_COPY.forbidden);
  const currentOrder=task?.bezug_typ==='auftrag'?await readCollectionTaskCurrentOrder(tx,readAuth,task.id):null;
  const reference=await context(tx,readAuth,task?{type:task.bezug_typ,id:currentOrder??task.bezug_id}:(request as Exclude<TaskOpenRequest,{taskId:string}>).reference,!task);
  // Nonfinancial tasks remain tenant-readable; financial recipients use the canonical area gate.
  let canceledForEdit:{code:'KNOWN';value:boolean}|{code:'SOURCE_INCOMPLETE'}|{code:'NOT_REQUIRED'}={code:'NOT_REQUIRED'};
  if(task?.status==='offen'&&('canReadArea'in auth||allowed(auth,task))){
   if('canReadArea'in auth){
    try{canceledForEdit={code:'KNOWN',value:await withTenantSavepoint(tx,nested=>isCanceledInvoiceMailTask(nested,readAuth,task.id))};}
    catch{canceledForEdit={code:'SOURCE_INCOMPLETE'};}
   }else canceledForEdit={code:'KNOWN',value:await isCanceledInvoiceMailTask(tx,auth,task.id)};
  }
  const canceledCustomer=task?await readCanceledInvoiceTaskCompletion(tx,readAuth,task.id):null;
  let pricing:Awaited<ReturnType<typeof readProductionPricingRetrySource>>=null;
  let collection:Awaited<ReturnType<typeof readCollectionFollowup>>=null,collectionSource:'KNOWN'|'SOURCE_INCOMPLETE'='KNOWN';
  if(task){try{collection=await withTenantSavepoint(tx,nested=>readCollectionFollowup(nested,auth.tenantId,{markerId:task.client_key}));if(collection&&(task.bezug_typ!=='auftrag'||task.bezug_id!==collection.orderId||task.erstellt_von!==collection.actorId))throw Error('COLLECTION_FOLLOWUP_TASK_SOURCE_CHANGED');}catch{collectionSource='SOURCE_INCOMPLETE';}}
  let pricingSource:'KNOWN'|'SOURCE_INCOMPLETE'='KNOWN';
  if(task){try{pricing=await withTenantSavepoint(tx,nested=>readProductionPricingRetrySource(nested,auth,task.client_key));}catch{pricingSource='SOURCE_INCOMPLETE';}}
  let credit:Awaited<ReturnType<typeof readCancellationCreditSource>>=null;
  let creditSource:'KNOWN'|'SOURCE_INCOMPLETE'='KNOWN';
  if(task){try{credit=await withTenantSavepoint(tx,nested=>readCancellationCreditSource(nested,auth.tenantId,task.client_key));}catch{creditSource='SOURCE_INCOMPLETE';}}
  let reissue:Awaited<ReturnType<typeof reissueTaskSource>>=null,reissueSource:'KNOWN'|'SOURCE_INCOMPLETE'='KNOWN';
  if(task){try{reissue=await withTenantSavepoint(tx,nested=>reissueTaskSource(nested,auth,task));}catch{reissueSource='SOURCE_INCOMPLETE';}}
  let mailRemainder:Awaited<ReturnType<typeof readInvoiceMailRemainderFailure>>=null,recollection:Awaited<ReturnType<typeof readCancelledCollectionRouting>>=null,invoiceFollowupSource:'KNOWN'|'SOURCE_INCOMPLETE'='KNOWN';
  if(task){try{
   mailRemainder=await withTenantSavepoint(tx,nested=>readInvoiceMailRemainderFailure(nested,auth,task.client_key));
   recollection=await withTenantSavepoint(tx,nested=>readCancelledCollectionRouting(nested,auth.tenantId,task.client_key));
   if(mailRemainder&&(task.bezug_typ!=='kunde'||task.bezug_id!==mailRemainder.customerId||task.erstellt_von!==mailRemainder.actorId)||recollection&&(task.bezug_typ!=='kunde'||task.bezug_id!==recollection.customerId||task.erstellt_von!==recollection.receipt.cancelledBy))throw Error('INVOICE_FOLLOWUP_TASK_SOURCE_CHANGED');
  }catch{invoiceFollowupSource='SOURCE_INCOMPLETE';}}
  // Keep only the facts used by the existing personal projection. Receipt
  // internals, including financial amounts, do not become task payload fields.
  return {code:'OK' as const,task,reference,canceledForEdit,canceledCustomer,pricing:pricing!==null,pricingSource,collection:collection!==null,collectionSource,credit:credit===null?null:{pending:credit.pending},creditSource,reissue:reissue!==null,reissueSource,mailRemainder:mailRemainder===null?null:{pending:mailRemainder.pending},recollection:recollection!==null,invoiceFollowupSource};
}
/** The only personal projection still uses the actual session actor. */
function presentTaskSource(auth:AuthorizationSnapshot,source:TaskSourceRead):Extract<TaskReadResult,{code:'OK'}>{
 const {task,reference,canceledCustomer,pricing,pricingSource,collection,collectionSource,credit,creditSource,reissue,reissueSource,mailRemainder,recollection,invoiceFollowupSource}=source;
 const mayEdit=task?task.status==='offen'&&allowed(auth,task):true;
 if(task&&mayEdit&&source.canceledForEdit.code==='SOURCE_INCOMPLETE')throw Error('TASK_CANCELLATION_READ_INCOMPLETE');
 const canEdit=mayEdit&&(!task||source.canceledForEdit.code==='KNOWN'&&!source.canceledForEdit.value);
  return {code:'OK',task,reference,currentLogin:auth.userId,pricingSource,creditSource,invoiceFollowupSource,...(collection||collectionSource==='SOURCE_INCOMPLETE'?{collectionSource}:{}),...(reissue||reissueSource==="SOURCE_INCOMPLETE"?{reissueSource}:{}),canEdit:canEdit&&collectionSource==='KNOWN'&&!collection&&reissueSource==='KNOWN'&&!reissue&&invoiceFollowupSource==='KNOWN'&&!mailRemainder&&!recollection,canComplete:!!task&&task.status==='offen'&&invoiceMailRemainderAllowsCompletion(invoiceFollowupSource,mailRemainder)&&collectionSource==='KNOWN'&&reissueSource==='KNOWN'&&(reissue?hasAuthorizationArea(auth,'zahlungen'):(canEdit||canceledCustomer!==null))&&task.art!=='rechnung'&&(!credit?.pending||hasAuthorizationArea(auth,'zahlungen')),...(recollection?{completeLabel:E_INVOICE_COPY.collectionRoutingRetry}:collection?{completeLabel:COLLECTION_FOLLOWUP_COPY.retry}:reissue||credit?{completeLabel:SITUATION_COPY.retry}:pricing?{completeLabel:PRODUCTION_PRICING_RETRY_COPY.retry}:canceledCustomer!==null?{completeLabel:MAIL_RESEND_COPY.canceledCompleted(canceledCustomer)}:{}),canOpenReference:reference.type==='allgemein'||reference.label!==null};
}



export type QuoteFollowupRequest={quoteId:string;quoteNumber:string;customerName:string;edition:number;sentEdition:number|null;action:'sent'|'cancel';dueDate:string|null;reason:string};
/** Current and previous sent edition keys identify only this automatic task, never a user's other task. */
export async function syncQuoteFollowupTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:QuoteFollowupRequest,deps:Dependencies,options:{operationalCancel?:boolean}={}):Promise<string|null>{
 const operational=options.operationalCancel===true&&input.action==='cancel'&&input.reason==='KV zugesagt';
 if((!operational&&(!hasAuthorizationArea(auth,'preise')||!hasAuthorizationArea(auth,'auftraege')))||!taskUuid(input.quoteId)||!Number.isSafeInteger(input.edition)||input.edition<1)reject('FORBIDDEN','KV-Nachfassen ist nicht freigegeben.');
 if(operational){const [quote]=await readQuoteFollowupFacts(tx,auth.tenantId,[input.quoteId]);if(!quote?.integrity||quote.stage!=='zugesagt'||quote.edition!==input.edition)reject('CONFLICT','Die bestätigte KV-Zusage fehlt für das Erledigen der Nachfassaufgabe.');}
 const currentKey=eventKey(input.quoteId,input.edition,'quote-followup');
 const keys=[...new Set([currentKey,...(input.sentEdition?[eventKey(input.quoteId,input.sentEdition,'quote-followup')]:[])])];
 const rows=await tx.execute<TaskRecord>(sql`SELECT ${columns} FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=ANY(ARRAY[${sql.join(keys.map(key=>sql`${key}`),sql`, `)}]::uuid[]) ORDER BY id FOR UPDATE`);
 if(rows.some(row=>row.bezug_typ!=='kv'||row.bezug_id!==input.quoteId||row.art!=='aufgabe'))reject('CONFLICT','Nachfasskennung ist bereits anders belegt.');
 for(const row of rows){if(row.status==='offen'&&(input.action==='cancel'||row.client_key!==currentKey))await finishTask(tx,auth,{taskId:row.id,version:row.version,note:input.reason},deps,undefined,operational?{quoteId:input.quoteId,keys}:undefined);}
 if(input.action==='cancel')return null;
 const current=rows.find(row=>row.client_key===currentKey);
 if(current?.status==='erledigt')return null;
 if(input.dueDate===null)return current?.faellig_am??null;
 const value:TaskSaveInput={clientKey:currentKey,version:current?.version??0,...(current?{taskId:current.id}:{}),kind:'aufgabe',title:quoteFollowupTitle(input.customerName,input.quoteNumber),dueDate:input.dueDate,time:null,forLogin:null,forArea:'preise',reference:{type:'kv',id:input.quoteId},note:'Nachfassen zur versendeten KV-Fassung '+input.edition};
 if(Object.keys(taskValidation(value)).length)reject('VALIDATION_ERROR','KV-Nachfassdatum oder Bezug ist unvollständig.');
 return (await persistTask(tx,auth,value,deps)).task.faellig_am;
}
function quoteFollowupTitle(name:string,number:string){const customer=name.length>120?name.slice(0,119)+'…':name;return 'Bei '+customer+' wegen KV '+number+' nachfragen';}
type QuoteFollowupTaskSource={id:string;title:string;dueDate:string;quoteId:string;quoteNumber:string;customerName:string;assignedLogin:string|null};
type QuoteFollowupTaskToday=Omit<QuoteFollowupTaskSource,'assignedLogin'>&{isMine:boolean};
export function readQuoteFollowupTasksForToday(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,today?:string):Promise<QuoteFollowupTaskToday[]>;
export function readQuoteFollowupTasksForToday(tx:PrivilegedTenantTransaction,auth:AuthorizedReadContext,today?:string):Promise<QuoteFollowupTaskSource[]>;
export async function readQuoteFollowupTasksForToday(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot|AuthorizedReadContext,today=berlinCalendarDay()){
 const readAuth='canReadArea'in auth?auth:authorizationReadContext(auth);
 if(!canReadQuoteFollowupsForRead(auth))return [];
 const tasks=await tx.execute<TaskRecord>(sql`SELECT ${columns} FROM public.tasks WHERE tenant_id=${auth.tenantId} AND bezug_typ='kv' AND art='aufgabe' AND status='offen' AND faellig_am<=${today}::date ORDER BY faellig_am,id`);
 // Narrow shared projection only: exact canonical followup key and live quote
 // are verified below. Generic task read/edit authority is unchanged.
 const candidates=tasks.filter(task=>taskUuid(task.bezug_id));
 const facts=await readQuoteFollowupFacts(tx,auth.tenantId,[...new Set(candidates.map(task=>task.bezug_id!))]);
 const sources=candidates.flatMap(task=>{const quote=facts.find(row=>row.id===task.bezug_id);if(!quote||!quote.integrity)throw Error('QUOTE_FOLLOWUP_CONTEXT_INVALID');if(quote.stage!=='versendet'||task.client_key!==eventKey(quote.id,quote.edition,'quote-followup'))return [];return [maskQuoteFollowupTitle(readAuth,{id:task.id,title:task.titel,dueDate:task.faellig_am,quoteId:quote.id,quoteNumber:quote.number,customerName:quote.customerName,assignedLogin:task.fuer_login})];});
 if('canReadArea'in auth)return sources;
 return projectQuoteFollowupSources(auth,sources);
}
function maskQuoteFollowupTitle(auth:AuthorizedReadContext,source:QuoteFollowupTaskSource){
 return auth.canReadArea('preise')?source:{...source,title:quoteFollowupTitle(source.customerName,source.quoteNumber)};
}
export function projectQuoteFollowupSources(auth:AuthorizationSnapshot,sources:readonly QuoteFollowupTaskSource[]):QuoteFollowupTaskToday[]{
 const readAuth=authorizationReadContext(auth);
 return sources.map(row=>{const {assignedLogin,...source}=maskQuoteFollowupTitle(readAuth,row);return {...source,isMine:assignedLogin===auth.userId};}).sort((left,right)=>Number(right.isMine)-Number(left.isMine));
}

/** Only the persisted physical command can create this normal shared clarification task. */
export async function createGoodsOutClarificationTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{orderId:string;eventId:string},deps:Dependencies){
 if(!hasAuthorizationArea(auth,'auftraege')||!taskUuid(input.eventId)||!validTaskReference({type:'auftrag',id:input.orderId}))reject('FORBIDDEN','Übergabebeleg fehlt.');
 const proofs=await handedOverProofs(tx,auth,[input.orderId]);
 if(!proofs?.some(proof=>proof.eventId===input.eventId))reject('CONFLICT','Übergabebeleg fehlt.');
 const key=eventKey(input.eventId,0,'goods-out-followup');
 await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('task:'||${auth.tenantId}||':'||${key},0))`);
 const prior=await tx.execute<{id:string;art:string;bezug_typ:string;bezug_id:string;erstellt_von:string}>(sql`SELECT id::text,art,bezug_typ,bezug_id,erstellt_von::text FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=${key}::uuid FOR UPDATE`);
 if(prior.length){const task=prior[0];if(prior.length!==1||task.art!=='aufgabe'||task.bezug_typ!=='auftrag'||task.bezug_id!==input.orderId||task.erstellt_von!==auth.userId)reject('CONFLICT','Aufgabenkennung gehört zu einem anderen Vorgang.');return task.id;}
 const reference=await context(tx,auth,{type:'auftrag',id:input.orderId});
 if(!reference.label)reject('NOT_FOUND','Auftragsnummer fehlt.');
 const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
 const title=GOODS_OUT_FOLLOWUP_COPY.incomplete(reference.label);
 const value:TaskSaveInput={clientKey:key,version:0,kind:'aufgabe',title,dueDate:clock.today,time:null,forLogin:null,forArea:await readClarificationArea(tx,auth.tenantId),reference:{type:'auftrag',id:input.orderId},note:title};
 return (await persistTask(tx,auth,value,deps)).task.id;
}

/** Exact pending physical source, one ordinary task; never a system actor. */
export async function synchronizeCollectionFollowupTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,markerId:string,deps:Dependencies){
 const source=await readCollectionFollowup(tx,auth.tenantId,{markerId});
 if(!source||source.actorId!==auth.userId)throw Error('COLLECTION_FOLLOWUP_TASK_ORIGINAL_ACTOR');
 const rows=await tx.execute<TaskRecord>(sql`SELECT ${columns} FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=${markerId}::uuid FOR UPDATE`);
 let task=rows[0];
 if(rows.length>1||task&&(task.erstellt_von!==source.actorId||task.art!=='aufgabe'||task.bezug_typ!=='auftrag'||task.bezug_id!==source.orderId))throw Error('COLLECTION_FOLLOWUP_TASK_CHANGED');
 if(!task){
  const reference=await context(tx,auth,{type:'auftrag',id:source.orderId});if(!reference.label)throw Error('COLLECTION_FOLLOWUP_ORDER_LABEL_MISSING');
  const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
  const full=COLLECTION_FOLLOWUP_COPY.task(reference.label),budget=120-COLLECTION_FOLLOWUP_COPY.task('').length;
  const label=reference.label.length>budget?reference.label.slice(0,budget-1)+'…':reference.label;
  task=(await persistTask(tx,auth,{clientKey:markerId,version:0,kind:'aufgabe',title:COLLECTION_FOLLOWUP_COPY.task(label),dueDate:clock.today,time:null,forLogin:null,forArea:await readClarificationArea(tx,auth.tenantId),reference:{type:'auftrag',id:source.orderId},note:full},deps)).task;
 }
 if(source.pending&&task.status!=='offen')throw Error('COLLECTION_FOLLOWUP_PENDING_TASK_CLOSED');
 if(!source.pending&&task.status==='offen')await finishTask(tx,auth,{taskId:task.id,version:task.version,note:null},deps);
}

/** PL00:40: source-bound money task; same persistTask writer, no system actor. */
export async function createCanceledInvoiceMailTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{threadId:string;invoiceId:string},deps:Dependencies){
 const source=await readCanceledInvoiceMailTaskSource(tx,auth,input);if(!source)reject('FORBIDDEN','Versandbeleg fehlt.');
 const key=eventKey(source.invoice_id,0,'cancelled-invoice-arrived');
 await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('task:'||${auth.tenantId}||':'||${key},0))`);
 const prior=await tx.execute<{id:string;bezug_id:string;fuer_bereich:string}>(sql`SELECT id::text,bezug_id,fuer_bereich FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=${key}::uuid FOR UPDATE`);
 if(prior.length){if(prior.length!==1||prior[0].bezug_id!==source.reference.id||prior[0].fuer_bereich!=='preise'||!await isCanceledInvoiceMailTask(tx,auth,prior[0].id))reject('CONFLICT','Aufgabenkennung gehört zu einem anderen Vorgang.');return prior[0].id;}
 const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
 const title=MAIL_RESEND_COPY.canceledTask(source.invoice_number,source.customer_name);
 // PL02:01: only the customer may be shortened; full source facts stay in the note.
 // PL05:15: the normal completion records the operator's actual cancellation delivery.
 const saved=await persistTask(tx,auth,{clientKey:key,version:0,kind:'aufgabe',title,dueDate:clock.today,time:null,forLogin:null,forArea:'preise',reference:source.reference,note:MAIL_RESEND_COPY.canceledTaskDescription(source.invoice_number,source.customer_name,source.sent_at)+(source.cancellation_invoice_number?'\n'+E_INVOICE_COPY.cancellationTitle(source.cancellation_invoice_number,source.invoice_number):'')},deps,false);
 await bindCanceledInvoiceMailTask(tx,auth,{...input,taskId:saved.task.id,clientEventId:eventKey(source.invoice_id,0,'cancelled-invoice-task-source')});
 return saved.task.id;
}

/** PL19:08: normal original actor and normal shared recipient area; no system login. */
export async function createOfflineNoteConflictTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,eventId:string,deps:Dependencies){
 const original=await readOfflineNoteConflictSource(tx,auth,eventId);
 const key=eventKey(eventId,0,'offline-conflict'),prior=await tx.execute<{id:string}>(sql`SELECT id::text FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=${key}::uuid`);
 if(prior.length){const existing=await find(tx,auth,prior[0].id);if(prior.length!==1||existing?.erstellt_von!==auth.userId||existing.bezug_typ!=='eingang'||existing.bezug_id!==eventId)throw Error('OFFLINE_TASK_KEY_CHANGED');return existing.id;}
 const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
 const value:TaskSaveInput={clientKey:key,version:0,kind:'aufgabe',title:OFFLINE_RECONCILIATION_COPY.reason,dueDate:clock.today,time:null,forLogin:null,forArea:await readClarificationArea(tx,auth.tenantId),reference:{type:'eingang',id:eventId},note:new Date(original.deviceCapturedAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin'})};
 // The source note command has already authorized its exact original context.
 return (await persistTask(tx,auth,value,deps,false)).task.id;
}
/** PL 11.11.08:01: a qualified rejected workshop original, never a general grant. */
export async function createOfflineWorkshopConflictTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,eventId:string,deps:Dependencies){
 const source=await readOfflineWorkshopConflictSource(tx,auth,eventId);
 const key=eventKey(eventId,0,'offline-workshop-conflict');
 const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
 const value:TaskSaveInput={clientKey:key,version:0,kind:'aufgabe',title:OFFLINE_RECONCILIATION_COPY.reason,dueDate:clock.today,time:null,forLogin:null,forArea:await readClarificationArea(tx,auth.tenantId),reference:source.orderId?{type:'auftrag',id:source.orderId}:source.customerId?{type:'kunde',id:source.customerId}:{type:'allgemein',id:null},note:new Date(source.deviceCapturedAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin'})};
 return (await persistTask(tx,auth,value,deps,false)).task.id;
}

/** R2: source-bound normal task, original actor, existing recipient resolver. */
export async function createProductionPricingRetryTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,markerId:string,deps:Dependencies){
 const source=await readProductionPricingRetrySource(tx,auth,markerId);
 if(!source||source.actorId!==auth.userId||!source.pending)throw Error('PRODUCTION_PRICING_TASK_SOURCE_INVALID');
 const prior=await tx.execute<{id:string;erstellt_von:string;bezug_id:string;art:string;bezug_typ:string}>(sql`SELECT id::text,erstellt_von::text,bezug_id,art,bezug_typ FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=${markerId}::uuid FOR UPDATE`);
 if(prior.length){if(prior.length!==1||prior[0].erstellt_von!==source.actorId||prior[0].bezug_id!==source.orderId||prior[0].art!=='aufgabe'||prior[0].bezug_typ!=='auftrag')throw Error('PRODUCTION_PRICING_TASK_CHANGED');return prior[0].id;}
 const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
 return (await persistTask(tx,auth,{clientKey:markerId,version:0,kind:'aufgabe',title:source.title,dueDate:clock.today,time:null,forLogin:null,forArea:'preise',reference:{type:'auftrag',id:source.orderId},note:source.description},deps,false)).task.id;
}

/** Same task writer, keyed to the immutable cancellation; no new task truth. */
export async function synchronizeCancellationCreditRetryTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,key:string,deps:Dependencies,mode:'ensure'|'settle'){
 const prior=await tx.execute<TaskRecord>(sql`SELECT ${columns} FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=${key}::uuid FOR UPDATE NOWAIT`);
 if(mode==='settle'&&!prior.length)return;
 const source=await readCancellationCreditSource(tx,auth.tenantId,key);
 const reissue=await readInvoiceReissueSource(tx,auth.tenantId,key);
 if(reissue){
  if(!hasAuthorizationArea(auth,'zahlungen')||!source||source.eventId!==reissue.receipt.eventId||prior.length>1)throw Error('INVOICE_REISSUE_TASK_SOURCE_INVALID');
  for(const task of prior)await reissueTaskSource(tx,auth,task);
  if(mode==='settle'){
   if(source.pending||reissue.pending)throw Error('INVOICE_REISSUE_TASK_NOT_REPAIRED');
   if(prior[0]?.status==='offen')await finishTask(tx,auth,{taskId:prior[0].id,version:prior[0].version,note:null},deps);
   return;
  }
  if(prior.length||!source.pending&&!reissue.pending)return;
  const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
  const fullTitle=SHIPPING_FEE_COPY.reissueTask(source.invoiceNumber),budget=120-SHIPPING_FEE_COPY.reissueTask('').length;
  const title=SHIPPING_FEE_COPY.reissueTask(source.invoiceNumber.length>budget?source.invoiceNumber.slice(0,budget-1)+'…':source.invoiceNumber);
  await persistTask(tx,auth,{clientKey:key,version:0,kind:'aufgabe',title,dueDate:clock.today,time:null,forLogin:null,forArea:await readClarificationArea(tx,auth.tenantId),reference:{type:'auftrag',id:source.orderId},note:fullTitle},deps,false,false,false,reissue.receipt.eventId);
  return;
 }
 if(!source||source.cancelledBy!==auth.userId||prior.length>1||prior.some(task=>task.bezug_typ!==source.reference.type||task.bezug_id!==source.reference.id||task.art!=='aufgabe'||task.erstellt_von!==source.cancelledBy))throw Error('CUSTOMER_CREDIT_TASK_SOURCE_INVALID');
 if(mode==='settle'){
  if(source.pending)throw Error('CUSTOMER_CREDIT_TASK_NOT_REPAIRED');
  if(prior[0]?.status==='offen')await finishTask(tx,auth,{taskId:prior[0].id,version:prior[0].version,note:null},deps);
  return;
 }
 if(!source.pending)throw Error('CUSTOMER_CREDIT_TASK_NOT_PENDING');
 if(prior.length)return;
 const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
 const fullTitle=CUSTOMER_CREDIT_COPY.retryTask(source.invoiceNumber),budget=120-CUSTOMER_CREDIT_COPY.retryTask('').length;
 const title=CUSTOMER_CREDIT_COPY.retryTask(source.invoiceNumber.length>budget?source.invoiceNumber.slice(0,budget-1)+'…':source.invoiceNumber);
 const value:TaskSaveInput={clientKey:key,version:0,kind:'aufgabe',title,dueDate:clock.today,time:null,forLogin:null,forArea:'zahlungen',reference:source.reference,note:fullTitle};
 await persistTask(tx,auth,value,deps,false);
}

/** Narrow R2 composition for the already authorized KV operation, using the
 * normal writer and its effect/readback. No general task permission is added. */
export async function synchronizeQuoteOrderRetryTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,receiptId:string,deps:Dependencies,mode:'ensure'|'settle'='ensure'){
 const rights=quoteOperationContext(auth).capabilities;
 if(!rights.canReadQuote||!rights.canConvertQuote||!taskUuid(receiptId))throw Error('QUOTE_ORDER_TASK_NOT_AUTHORIZED');
 const key=eventKey(receiptId,0,'quote-order-retry');
 // A successful ordinary/legacy conversion has no retry task to settle; it
 // must not acquire a new provenance prerequisite just for an absent task.
 if(mode==='settle'&&!(await tx.execute(sql`SELECT id FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=${key}::uuid`)).length)return;
 const source=await readQuoteGoodsOrderRetrySource(tx,auth,receiptId);
 if(!source)throw Error('QUOTE_ORDER_TASK_SOURCE_MISSING');
 const [lock]=await tx.execute<{locked:boolean}>(sql`SELECT pg_try_advisory_xact_lock(hashtextextended('task:'||${auth.tenantId}||':'||${key},0)) AS locked`);
 if(!lock?.locked)throw Error('QUOTE_ORDER_TASK_BUSY');
 const tasks=await tx.execute<TaskRecord>(sql`SELECT ${columns} FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=${key}::uuid FOR UPDATE NOWAIT`);
 if(tasks.length>1||tasks.some(task=>task.art!=='aufgabe'||task.bezug_typ!=='kv'||task.bezug_id!==source.quoteId))throw Error('QUOTE_ORDER_TASK_REFERENCE_CHANGED');
 if(source.completed){
  const task=tasks[0];if(task?.status==='offen')await finishTask(tx,auth,{taskId:task.id,version:task.version,note:QUOTE_CYCLE_COPY.orderRetry(source.quoteNumber)},deps,undefined,{quoteId:source.quoteId,keys:[key]});
  return;
 }
 if(!source.pending)throw Error('QUOTE_ORDER_TASK_NO_CURRENT_RETRY');
 if(tasks.length)return;
 const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
 const fullTitle=QUOTE_CYCLE_COPY.orderRetryTask(source.quoteNumber),budget=120-QUOTE_CYCLE_COPY.orderRetryTask('').length;
 const title=QUOTE_CYCLE_COPY.orderRetryTask(source.quoteNumber.length>budget?source.quoteNumber.slice(0,budget-1)+'…':source.quoteNumber);
 await persistTask(tx,auth,{clientKey:key,version:0,kind:'aufgabe',title,dueDate:clock.today,time:null,forLogin:null,forArea:await readClarificationArea(tx,auth.tenantId),reference:{type:'kv',id:source.quoteId},note:fullTitle},deps,false);
}
export async function settleProductionPricingRetryTasks(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,eventId:string,deps:Dependencies){
 const keys=await readProductionPricingRetryKeys(tx,auth,eventId);if(!keys.length)return;
 const tasks=await tx.execute<{id:string;version:number;client_key:string}>(sql`SELECT id::text,version,client_key::text FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=ANY(ARRAY[${sql.join(keys.map(key=>sql`${key}::uuid`),sql`, `)}]) AND status='offen' FOR UPDATE NOWAIT`);
 for(const task of tasks){const source=await readProductionPricingRetrySource(tx,auth,task.client_key);if(!source||source.pending)continue;if(source.actorId!==auth.userId)throw Error('PRODUCTION_PRICING_SETTLEMENT_ACTOR');await finishTask(tx,auth,{taskId:task.id,version:task.version,note:null},deps);}
}

/** S11/R2: the same task writer, bound to the immutable original upload intent. */
export async function synchronizeEvidenceVisibilityRetryTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,markerId:string,deps:Dependencies){
 const source=await readEvidenceVisibilityRetrySource(tx,auth,markerId);
 if(!source||source.actorId!==auth.userId)throw Error('EVIDENCE_VISIBILITY_TASK_ORIGINAL_ACTOR');
 const prior=await tx.execute<TaskRecord>(sql`SELECT ${columns} FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=${markerId}::uuid FOR UPDATE NOWAIT`);
 const task=prior[0];
 if(prior.length>1||task&&(task.art!=='aufgabe'||task.erstellt_von!==source.actorId||task.bezug_typ!==source.reference.type||task.bezug_id!==source.reference.id))throw Error('EVIDENCE_VISIBILITY_TASK_CHANGED');
 if(!source.pending){
  if(task?.status==='offen')await finishTask(tx,auth,{taskId:task.id,version:task.version,note:null},deps);
  return task?.id??null;
 }
 if(task){if(task.status!=='offen')throw Error('EVIDENCE_VISIBILITY_PENDING_TASK_CLOSED');return task.id;}
 const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
 const budget=120-EVIDENCE_VISIBILITY_COPY.retryTask('').length;
 const name=source.name.length>budget?source.name.slice(0,budget-1)+'…':source.name;
 return (await persistTask(tx,auth,{clientKey:markerId,version:0,kind:'aufgabe',title:EVIDENCE_VISIBILITY_COPY.retryTask(name),
  dueDate:clock.today,time:null,forLogin:null,forArea:await readClarificationArea(tx,auth.tenantId),reference:source.reference,note:source.description},deps,false)).task.id;
}

/** R2 mailbox reservation is qualified by the owning port before this callback.
 * Persistence, actor, recipient, visible history and receipts use the normal writer. */
export async function createMailboxFetchRetryTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,source:{key:string;actorId:string;mailbox:string},deps:Dependencies){
 if(!canSynchronizeIntakeMailbox(auth)||!taskUuid(source.key)||!taskUuid(source.actorId)||!source.mailbox)throw Error('MAILBOX_TASK_SOURCE_INVALID');
 const prior=await tx.execute<{id:string;erstellt_von:string;art:string;bezug_typ:string;bezug_id:string|null}>(sql`SELECT id::text,erstellt_von::text,art,bezug_typ,bezug_id FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=${source.key}::uuid FOR UPDATE`);
 if(prior.length){if(prior.length!==1||prior[0].erstellt_von!==source.actorId||prior[0].art!=='aufgabe'||prior[0].bezug_typ!=='allgemein'||prior[0].bezug_id!==null)throw Error('MAILBOX_TASK_RECEIPT_CHANGED');return prior[0].id;}
 if(source.actorId!==auth.userId)throw Error('MAILBOX_TASK_ORIGINAL_ACTOR_REQUIRED');
 const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
 return (await persistTask(tx,auth,{clientKey:source.key,version:0,kind:'aufgabe',title:MAILBOX_SYNC_COPY.retryTask,dueDate:clock.today,time:null,forLogin:null,forArea:await readClarificationArea(tx,auth.tenantId),reference:{type:'allgemein',id:null},note:MAILBOX_SYNC_COPY.retryTask},deps)).task.id;
}

/** Fixed R2 follow-up, qualified by the acknowledged invoice original. */
export async function synchronizeInvoiceMailRemainderTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,markerId:string,repaired:boolean,deps:Dependencies){
 const source=await readInvoiceMailRemainderFailure(tx,auth,markerId);
 if(!source){if(repaired)return;throw Error('INVOICE_MAIL_REMAINDER_MARKER_MISSING');}
 if(source.actorId!==auth.userId)throw Error('INVOICE_MAIL_REMAINDER_ACTOR_CHANGED');
 // Later turns reuse an actual same-actor task whose original request covers
 // every invoice here. Never take over an ordinary or another actor's task.
 await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('invoice-mail-task:'||${auth.tenantId}||':'||${source.customerId},0))`);
 if(repaired&&source.pending)throw Error('INVOICE_MAIL_REMAINDER_STILL_PENDING');
 const prior=await tx.execute<{id:string}>(sql`SELECT id::text FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=${markerId}::uuid FOR UPDATE`);
 if(prior.length){
  const task=prior.length===1?await find(tx,auth,prior[0].id,true):null;
  if(!task||task.erstellt_von!==source.actorId||task.bezug_typ!=='kunde'||task.bezug_id!==source.customerId||task.art!=='aufgabe')throw Error('INVOICE_MAIL_REMAINDER_TASK_CHANGED');
  if(repaired&&task.status==='offen')await finishTask(tx,auth,{taskId:task.id,version:task.version,note:INVOICE_DELIVERY_COPY.remainderDone},deps);
  return;
 }
 const coveringSources=await readInvoiceMailCoveringRequestIds(tx,auth,source.customerId,source.invoiceIds);
 if(coveringSources.length){
  const candidates=await tx.execute<TaskRecord>(sql`SELECT ${columns} FROM public.tasks
   WHERE tenant_id=${auth.tenantId} AND erstellt_von=${auth.userId}::uuid AND bezug_typ='kunde' AND bezug_id=${source.customerId} AND art='aufgabe'
    AND (${repaired}::boolean OR status='offen') AND client_key=ANY(ARRAY[${sql.join(coveringSources.map(row=>sql`${row.id}`),sql`, `)}]::uuid[]) ORDER BY erstellt_am,id FOR UPDATE`);
  // The task rows are already locked. Actor/customer/snapshot coverage and the
  // same original evidence proof are qualified without any per-candidate SQL.
  const selected=(()=>{
   const task=candidates[0];if(!task)return null;
   const matches=coveringSources.filter(row=>row.id===task.client_key);
   if(matches.length!==1||!matches[0].invoiceIds)throw Error('INVOICE_MAIL_REMAINDER_SOURCE_INVALID');
   const covering=matches[0],invoiceIds=covering.invoiceIds!;
   if(covering.actorId!==auth.userId||covering.customerId!==source.customerId||!source.invoiceIds.every(id=>invoiceIds.includes(id)))throw Error('INVOICE_MAIL_REMAINDER_SNAPSHOT_INVALID');
   if(task.erstellt_von!==source.actorId||task.bezug_typ!=='kunde'||task.bezug_id!==source.customerId||task.art!=='aufgabe')throw Error('INVOICE_MAIL_REMAINDER_TASK_CHANGED');
   return {task,invoiceIds};
  })();
  if(selected){
   const remainder=await withTenantSavepoint(tx,nested=>readInvoiceMailOpenRemainder(nested,auth.tenantId,source.customerId,selected.invoiceIds));
   if(repaired&&!remainder.length&&selected.task.status==='offen')await finishTask(tx,auth,{taskId:selected.task.id,version:selected.task.version,note:INVOICE_DELIVERY_COPY.remainderDone},deps);
   return;
  }
 }
 if(repaired)throw Error('INVOICE_MAIL_REMAINDER_TASK_MISSING');
 const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
 await persistTask(tx,auth,{clientKey:markerId,version:0,kind:'aufgabe',title:INVOICE_DELIVERY_COPY.remainderTask,dueDate:clock.today,time:null,forLogin:null,forArea:await readClarificationArea(tx,auth.tenantId),reference:{type:'kunde',id:source.customerId},note:INVOICE_DELIVERY_COPY.remainderPending},deps,false);
}

/** K4/R2: the existing cancellation receipt is also the exact task/retry source. */
export async function synchronizeCancelledCollectionTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,key:string,deps:Dependencies,repaired:boolean){
 const source=await readCancelledCollectionRouting(tx,auth.tenantId,key);if(!source)throw Error('INVOICE_COLLECTION_ROUTING_TASK_SOURCE_MISSING');
 const prior=await tx.execute<{id:string}>(sql`SELECT id::text FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=${source.receipt.eventId}::uuid FOR UPDATE NOWAIT`);
 if(prior.length){
  const task=prior.length===1?await find(tx,auth,prior[0].id,true):null;
  if(!task||task.bezug_typ!=='kunde'||task.bezug_id!==source.customerId||task.art!=='aufgabe'||task.erstellt_von!==source.receipt.cancelledBy)throw Error('INVOICE_COLLECTION_ROUTING_TASK_CHANGED');
  if(repaired&&task.status==='offen')await finishTask(tx,auth,{taskId:task.id,version:task.version,note:E_INVOICE_COPY.collectionRoutingDone},deps);
  return;
 }
 if(repaired)return;
 if(auth.userId!==source.receipt.cancelledBy||!source.pending)throw Error('INVOICE_COLLECTION_ROUTING_TASK_ACTOR_INVALID');
 const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
 await persistTask(tx,auth,{clientKey:source.receipt.eventId,version:0,kind:'aufgabe',title:E_INVOICE_COPY.collectionRoutingPending,dueDate:clock.today,time:null,forLogin:null,forArea:await readClarificationArea(tx,auth.tenantId),reference:{type:'kunde',id:source.customerId},note:E_INVOICE_COPY.collectionRoutingPending},deps,false);
}

export async function createIntakeMailFailureTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,source:{itemId:string;key:string;graphId:string;actors:string[];reason:string},deps:Dependencies){
 if(!canSynchronizeIntakeMailbox(auth)||!taskUuid(source.itemId)||!taskUuid(source.key)||source.actors.length<3||!source.actors.includes(auth.userId))throw Error('MAIL_IMPORT_TASK_SOURCE_INVALID');
 const prior=await tx.execute<{id:string;erstellt_von:string;art:string;bezug_typ:string;bezug_id:string|null}>(sql`SELECT id::text,erstellt_von::text,art,bezug_typ,bezug_id FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=${source.key}::uuid FOR UPDATE`);
 if(prior.length){if(prior.length!==1||!source.actors.includes(prior[0].erstellt_von)||prior[0].art!=='aufgabe'||prior[0].bezug_typ!=='eingang'||prior[0].bezug_id!==source.itemId)throw Error('MAIL_IMPORT_TASK_CHANGED');return prior[0].id;}
 const full=MAIL_IMPORT_COPY.task(source.graphId),budget=120-MAIL_IMPORT_COPY.task('').length,id=source.graphId.length>budget?source.graphId.slice(0,budget-1)+'…':source.graphId;
 const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
 // Fixed import-failure purpose; history gets the normal readable reference
 // projection. Ordinary dialog writes and reference-reader rights stay unchanged.
 const scopedEffects:Dependencies={...deps,effect:async(nested,actor,input)=>deps.effect(nested,actor,{...input,reference:await context(nested,actor,input.reference,false,true)})};
 return (await persistTask(tx,auth,{clientKey:source.key,version:0,kind:'aufgabe',title:MAIL_IMPORT_COPY.task(id),dueDate:clock.today,time:null,forLogin:null,forArea:'eingang',reference:{type:'eingang',id:source.itemId},note:full+'\n'+source.reason},scopedEffects,false)).task.id;
}
