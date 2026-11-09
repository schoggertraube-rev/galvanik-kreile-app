import {readQuoteFollowupFacts} from '@/lib/server/quoteGoodsContextPort';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,resolveAuthorization,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {AccessArea} from '@/lib/auth/authorizationContract';
import {TASK_KINDS,taskUuid,taskValidation,validTaskReference,type TaskReference,type TaskRecord,type TaskReferenceRead,type TaskSaveInput,type TaskFailure,type TaskResult,type TaskReadResult,type TaskCompleteInput,type TaskOpenRequest} from '../contract';

export type TaskEffectRequest={key:string;taskId:string;action:'angelegt'|'geaendert'|'erledigt';kind:string;title:string;note:string|null;reference:TaskReferenceRead;itemId?:string;itemVersion?:number};
export type TaskEffects=(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:TaskEffectRequest)=>Promise<void|TaskFailure>;
type Dependencies={effect:TaskEffects;readInvoice?:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string)=>Promise<{name:string|null;status:string;taskId:string|null}|null>};
class Rejected extends Error{constructor(readonly result:TaskFailure){super(result.code);}}
function reject(code:TaskFailure['code'],message:string):never{throw new Rejected({code,message});}
const columns=sql`id::text,client_key::text,art,titel,faellig_am::text,to_char(uhrzeit,'HH24:MI') AS uhrzeit,vorlauf_tage,fuer_login::text,fuer_bereich,bezug_typ,bezug_id,item_id::text,notiz,status,erledigt_von::text,erledigt_am::text,erledigt_notiz,erstellt_von::text,erstellt_am::text,version`;
const refAreas:Partial<Record<TaskReference['type'],AccessArea>>={kunde:'kunden',auftrag:'auftraege',kv:'auftraege',eingang:'eingang',eingangsrechnung:'geld',reklamation:'auftraege'};
const allowed=(auth:AuthorizationSnapshot,task:TaskRecord)=>task.erstellt_von===auth.userId||task.fuer_login===auth.userId||task.fuer_bereich!==null&&hasAuthorizationArea(auth,task.fuer_bereich);
async function find(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string,lock=false){
 const rows=await tx.execute<TaskRecord>(sql`SELECT ${columns} FROM public.tasks WHERE tenant_id=${auth.tenantId} AND id=${id}::uuid ${lock?sql`FOR UPDATE`:sql``}`);
 return rows.length===1?rows[0]:null;
}
function hiddenReference(reference:TaskReference):TaskReferenceRead{return {...reference,label:null,customerId:null,customerType:null,orderId:null,channel:null,phone:null,sourceVersion:null};}
async function context(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,reference:TaskReference,required=true,enforceVisibility=true):Promise<TaskReferenceRead>{
 if(reference.type==='allgemein')return hiddenReference(reference);
 const area=refAreas[reference.type];
 const rows=await tx.execute<Omit<TaskReferenceRead,'type'>>(sql`SELECT id,label,customer_id AS "customerId",customer_type AS "customerType",order_id AS "orderId",channel,phone,source_version AS "sourceVersion" FROM private.v_task_contexts_v1
  WHERE tenant_id=${auth.tenantId} AND kind=${reference.type} AND id=${reference.id}`);
 if(rows.length!==1){if(required)reject('NOT_FOUND','Bezug nicht verfügbar · Fehlercode: TASK_REFERENCE_NOT_FOUND.');return hiddenReference(reference);}
 const requiredArea=reference.type==='eingang'&&rows[0].channel==='mail'?'mails':area;
 const visible=reference.type==='eingang'&&hasAuthorizationArea(auth,'mails')||requiredArea!==undefined&&hasAuthorizationArea(auth,requiredArea);
 if(enforceVisibility&&(!visible||rows[0].customerType==='lieferant'&&!hasAuthorizationArea(auth,'geld'))){if(required)reject('FORBIDDEN','Der Bezug ist für diesen Login nicht freigegeben.');return hiddenReference(reference);}
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
async function persistTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,value:TaskSaveInput,deps:Dependencies,enforceReferenceVisibility=true,invoiceCommand=false):Promise<Extract<TaskResult,{code:'OK'}>>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('task:'||${auth.tenantId}||':'||${value.clientKey},0))`);
  const candidates=await tx.execute<{id:string}>(sql`SELECT id::text FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=${value.clientKey}::uuid FOR UPDATE`);
  if(candidates.length>1)throw Error('TASK_CLIENT_KEY_AMBIGUOUS');
  const before=value.taskId?await find(tx,auth,value.taskId,true):candidates[0]?await find(tx,auth,candidates[0].id,true):null;
  if(value.taskId&&!before)reject('NOT_FOUND','Aufgabe nicht verfügbar.');
  if(before&&(before.client_key!==value.clientKey||!allowed(auth,before)))reject('FORBIDDEN','Aufgabe ist für diesen Login nicht änderbar.');
  if(!before&&value.version!==0)reject('CONFLICT','Aufgabenstand ist nicht mehr aktuell.');
  if(before&&before.status!=='offen')reject('CONFLICT','Aufgabe ist bereits erledigt.');
  if(before&&!value.taskId){if(before.erstellt_von===auth.userId&&same(before,value))return {code:'OK',task:before,replayed:true};reject('CONFLICT','Diese Anfragekennung gehört zu einer anderen Aufgabe.');}
  if(before&&before.version===value.version+1&&same(before,value))return {code:'OK',task:before,replayed:true};
  if(before&&before.version!==value.version)reject('CONFLICT','Aufgabe wurde inzwischen geändert · Eingaben bleiben erhalten.');
  if(before&&(before.bezug_typ!==value.reference.type||before.bezug_id!==value.reference.id||before.item_id!==(value.itemId??null)))reject('CONFLICT','Der ursprüngliche Bezug der Aufgabe bleibt erhalten.');
  if(value.kind==='rechnung'&&(!before||before.art!=='rechnung')&&!invoiceCommand)reject('FORBIDDEN','Rechnung klären entsteht ausschließlich beim Prüfen einer Eingangsrechnung.');
  if(before?.art==='rechnung'&&value.kind!=='rechnung')reject('FORBIDDEN','Rechnung klären kann nicht in eine andere Aufgabenart geändert werden.');
  // Existing-task authority was checked above; reference facts stay server-side in the history writer.
  const reference=await context(tx,auth,value.reference,true,!before&&enforceReferenceVisibility);await recipient(tx,auth,value);
  const id=before?.id??randomUUID();
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
export async function createOrderHandoverTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{orderId:string;clientKey:string;title:string;note:string},deps:Dependencies){
 if(!hasAuthorizationArea(auth,'mails')||!hasAuthorizationArea(auth,'auftraege'))reject('FORBIDDEN','Übergabe klären benötigt Mails und Aufträge.');
 const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
 const value:TaskSaveInput={clientKey:input.clientKey,version:0,kind:'rueckruf',title:input.title,dueDate:clock.today,time:null,forLogin:null,forArea:'auftraege',reference:{type:'auftrag',id:input.orderId},note:input.note};
 const errors=taskValidation(value);if(Object.keys(errors).length)reject('VALIDATION_ERROR','Rückruf-Aufgabe ist unvollständig.');
 return (await persistTask(tx,auth,value,deps)).task.id;
}

export async function readOrderHandoverTaskState(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{orderId:string;taskId:string}){
 const task=await find(tx,auth,input.taskId);
 if(!task||task.bezug_typ!=='auftrag'||task.bezug_id!==input.orderId||task.art!=='rueckruf'||!allowed(auth,task))return null;
 return {id:task.id,status:task.status,title:task.titel,note:task.notiz};
}
/** Only the invoice command can create this task; all persistence stays in persistTask. */
export async function createInvoiceClarificationTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{invoiceId:string;clientKey:string;reason:string},deps:Dependencies):Promise<string>{
 if(!hasAuthorizationArea(auth,'geld'))reject('FORBIDDEN','Rechnung klären benötigt Geld.');
 if(!taskUuid(input.invoiceId)||!taskUuid(input.clientKey))reject('VALIDATION_ERROR','Rechnungskennung ist ungültig.');
 const invoice=await deps.readInvoice?.(tx,auth,input.invoiceId);
 if(!invoice||invoice.status!=='unklar')reject('CONFLICT','Rechnung ist nicht unklar.');
 const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
 const value:TaskSaveInput={clientKey:eventKey(input.clientKey,0,'invoice-unclear'),version:0,kind:'rechnung',title:input.reason==='Lieferant fehlt'?'Lieferant ergänzen':'Rechnung klären · '+(invoice.name??'Lieferant fehlt'),
  dueDate:clock.today,time:null,forLogin:null,forArea:'geld',reference:{type:'eingangsrechnung',id:input.invoiceId},note:input.reason};
 const fields=taskValidation(value);if(Object.keys(fields).length)reject('VALIDATION_ERROR','Aufgabe zur Rechnung ist ungültig.');
 return (await persistTask(tx,auth,value,deps,true,true)).task.id;
}
/** Shared completion writer. Invoice tasks remain inaccessible to the normal completion action. */
async function finishTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,value:TaskCompleteInput,deps:Dependencies,invoiceId?:string,quoteOperation?:{quoteId:string;keys:string[]}):Promise<Extract<TaskResult,{code:'OK'}>>{
  const before=await find(tx,auth,value.taskId,true);if(!before)reject('NOT_FOUND','Aufgabe nicht verfügbar.');
  const operationalQuote=quoteOperation&&before.art==='aufgabe'&&before.bezug_typ==='kv'&&before.bezug_id===quoteOperation.quoteId&&quoteOperation.keys.includes(before.client_key);
  if(!allowed(auth,before)&&!operationalQuote)reject('FORBIDDEN','Aufgabe ist für diesen Login nicht freigegeben.');
  if(before.art==='rechnung'&&(!invoiceId||before.bezug_typ!=='eingangsrechnung'||before.bezug_id!==invoiceId||!hasAuthorizationArea(auth,'geld')))reject('FORBIDDEN','Rechnung klären wird ausschließlich in der Eingangsrechnung erledigt.');
  const note=value.note?.trim()||null;
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
 if(!hasAuthorizationArea(auth,'geld'))reject('FORBIDDEN','Rechnung klären benötigt Geld.');
 const invoice=await deps.readInvoice?.(tx,auth,input.invoiceId);
 if(!invoice||invoice.taskId!==input.taskId||invoice.status==='unklar')reject('CONFLICT','Rechnung wurde noch nicht geklärt.');
 const task=await find(tx,auth,input.taskId,true);if(!task||task.art!=='rechnung')reject('NOT_FOUND','Rechnungsaufgabe nicht verfügbar.');
 await finishTask(tx,auth,{taskId:task.id,version:task.version,note:input.note},deps,input.invoiceId);
}
export async function completeTask(input:unknown,deps:Dependencies):Promise<TaskResult>{
 if(!input||typeof input!=='object'||Array.isArray(input))return {code:'VALIDATION_ERROR',message:'Aufgabenkennung fehlt.'};
 const value=input as TaskCompleteInput;
 if(Object.keys(value).sort().join(',')!=='note,taskId,version'||!taskUuid(value.taskId)||!Number.isSafeInteger(value.version)||value.version<1||!(value.note===null||typeof value.note==='string'&&value.note.length<=2000))return {code:'VALIDATION_ERROR',message:'Aufgabenkennung oder Notiz ist ungültig.'};
 const auth=await session();if(!auth)return {code:'UNAUTHENTICATED',message:'Sitzung ist nicht verfügbar.'};
 try{return await withPrivilegedTenantTransaction(auth,tx=>finishTask(tx,auth,value,deps));}catch(error){return resultError(error);}
}
export async function readTask(request:TaskOpenRequest):Promise<TaskReadResult>{
 if(!request||typeof request!=='object'||Array.isArray(request)||('taskId'in request?!taskUuid(request.taskId):!validTaskReference(request.reference)))return {code:'VALIDATION_ERROR',message:'Aufgabenaufruf ist ungültig.'};
 if('taskId'in request?Object.keys(request).join(',')!=='taskId':Object.keys(request).some(key=>!['reference','kind','itemId'].includes(key))||request.kind!==undefined&&!TASK_KINDS.includes(request.kind)||request.itemId!==undefined&&!taskUuid(request.itemId))return {code:'VALIDATION_ERROR',message:'Aufgabenaufruf enthält ungültige Felder.'};
 const auth=await session();if(!auth)return {code:'UNAUTHENTICATED',message:'Sitzung ist nicht verfügbar.'};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const task='taskId'in request?await find(tx,auth,request.taskId):null;
  if('taskId'in request&&!task)reject('NOT_FOUND','Aufgabe nicht verfügbar.');
  const reference=await context(tx,auth,task?{type:task.bezug_typ,id:task.bezug_id}:(request as Exclude<TaskOpenRequest,{taskId:string}>).reference,!task);
  // Aufgaben sind je Mandant für jeden Login lesbar; Bezug und Schreibknöpfe prüfen ihre eigenen Rechte.
  const canEdit=task?task.status==='offen'&&allowed(auth,task):true;
  return {code:'OK',task,reference,currentLogin:auth.userId,canEdit,canComplete:!!task&&canEdit&&task.art!=='rechnung',canOpenReference:reference.type==='allgemein'||reference.label!==null};
 });}catch(error){return resultError(error);}
}


export type QuoteFollowupRequest={quoteId:string;quoteNumber:string;customerName:string;edition:number;sentEdition:number|null;action:'sent'|'cancel';dueDate:string|null;reason:string};
/** Current and previous sent edition keys identify only this automatic task, never a user's other task. */
export async function syncQuoteFollowupTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:QuoteFollowupRequest,deps:Dependencies,options:{operationalCancel?:boolean}={}):Promise<string|null>{
 const operational=options.operationalCancel===true&&input.action==='cancel'&&input.reason==='KV zugesagt';
 if((!operational&&(!hasAuthorizationArea(auth,'geld')||!hasAuthorizationArea(auth,'auftraege')))||!taskUuid(input.quoteId)||!Number.isSafeInteger(input.edition)||input.edition<1)reject('FORBIDDEN','KV-Nachfassen ist nicht freigegeben.');
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
 const customer=input.customerName.length>120?input.customerName.slice(0,119)+'…':input.customerName;
 const value:TaskSaveInput={clientKey:currentKey,version:current?.version??0,...(current?{taskId:current.id}:{}),kind:'aufgabe',title:'Bei '+customer+' wegen KV '+input.quoteNumber+' nachfragen',dueDate:input.dueDate,time:null,forLogin:null,forArea:'geld',reference:{type:'kv',id:input.quoteId},note:'Nachfassen zur versendeten KV-Fassung '+input.edition};
 if(Object.keys(taskValidation(value)).length)reject('VALIDATION_ERROR','KV-Nachfassdatum oder Bezug ist unvollständig.');
 return (await persistTask(tx,auth,value,deps)).task.faellig_am;
}
export async function readQuoteFollowupTasksForToday(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,today=berlinCalendarDay()){
 if(!hasAuthorizationArea(auth,'geld')||!hasAuthorizationArea(auth,'auftraege'))return [];
 const tasks=await tx.execute<TaskRecord>(sql`SELECT ${columns} FROM public.tasks WHERE tenant_id=${auth.tenantId} AND bezug_typ='kv' AND art='aufgabe' AND status='offen' AND faellig_am<=${today}::date ORDER BY faellig_am,id`);
 const candidates=tasks.filter(task=>taskUuid(task.bezug_id)&&allowed(auth,task));
 const facts=await readQuoteFollowupFacts(tx,auth.tenantId,[...new Set(candidates.map(task=>task.bezug_id!))]);
 return candidates.flatMap(task=>{const quote=facts.find(row=>row.id===task.bezug_id);if(!quote||quote.stage!=='versendet'||task.client_key!==eventKey(quote.id,quote.edition,'quote-followup'))return [];if(!quote.integrity)throw Error('QUOTE_FOLLOWUP_CONTEXT_INVALID');return [{id:task.id,title:task.titel,dueDate:task.faellig_am,quoteId:quote.id,quoteNumber:quote.number,customerName:quote.customerName,isMine:task.fuer_login===auth.userId}];}).sort((left,right)=>Number(right.isMine)-Number(left.isMine));
}
