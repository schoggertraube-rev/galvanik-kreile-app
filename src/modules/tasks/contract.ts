import {isAccessArea,type AccessArea} from '@/lib/auth/authorizationContract';

export const TASK_KINDS=['rueckruf','frist','aufgabe','rechnung'] as const;
export type TaskKind=typeof TASK_KINDS[number];
export const TASK_KIND_LABELS:Record<TaskKind,string>={rueckruf:'Rückruf',frist:'Frist',aufgabe:'Aufgabe',rechnung:'Rechnung klären'};
export type TaskReferenceType='kunde'|'auftrag'|'kv'|'eingang'|'eingangsrechnung'|'reklamation'|'allgemein';
export type TaskReference={type:TaskReferenceType;id:string|null};
export type TaskSaveInput={clientKey:string;taskId?:string;version:number;kind:TaskKind;title:string;dueDate:string;time:string|null;forLogin:string|null;forArea:AccessArea|null;reference:TaskReference;note:string|null;itemId?:string;itemVersion?:number};
export type TaskCompleteInput={taskId:string;version:number;note:string|null;callResult?:'reached'|'notReached';postalResult?:{kind:'posted';postedOn:string;documentSha256:string}|{kind:'discarded';reason:string;documentSha256:string}};
export type TaskRecord={id:string;client_key:string;art:TaskKind;titel:string;faellig_am:string;uhrzeit:string|null;vorlauf_tage:number;fuer_login:string|null;fuer_bereich:AccessArea|null;bezug_typ:TaskReferenceType;bezug_id:string|null;item_id:string|null;notiz:string|null;status:'offen'|'erledigt';erledigt_von:string|null;erledigt_am:string|null;erledigt_notiz:string|null;erstellt_von:string;erstellt_am:string;version:number};
export type TaskReferenceRead=TaskReference&{label:string|null;customerId:string|null;customerType:string|null;orderId:string|null;channel:string|null;phone:string|null;sourceVersion:number|null};
export type TaskFailure={code:'UNAUTHENTICATED'|'FORBIDDEN'|'NOT_FOUND'|'VALIDATION_ERROR'|'CONFLICT'|'UNAVAILABLE';message:string;fields?:Record<string,string>};
export type TaskResult={code:'OK';task:TaskRecord;replayed:boolean}|TaskFailure;
export type TaskReadResult={code:'OK';task:TaskRecord|null;reference:TaskReferenceRead;currentLogin:string;canEdit:boolean;canComplete:boolean;completeLabel?:string;pricingSource?:'KNOWN'|'SOURCE_INCOMPLETE';canOpenReference:boolean}|TaskFailure;
export type TaskOpenRequest={taskId:string}|{reference:TaskReference;kind?:TaskKind;itemId?:string};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const taskUuid=(value:unknown):value is string=>typeof value==='string'&&UUID.test(value);
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function validTaskReference(value:unknown):value is TaskReference{
 if(!record(value)||Object.keys(value).sort().join(',')!=='id,type'||!['kunde','auftrag','kv','eingang','eingangsrechnung','reklamation','allgemein'].includes(String(value.type)))return false;
 return value.type==='allgemein'?value.id===null:typeof value.id==='string'&&value.id===value.id.trim()&&value.id.length>0&&value.id.length<=128;
}
function date(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const parsed=new Date(value+'T12:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
export function taskValidation(value:unknown):Record<string,string>{
 if(!record(value))return {form:'Aufgabe ist ungültig.'};
 const fields:Record<string,string>={};
 if(!taskUuid(value.clientKey)||!(value.taskId===undefined||taskUuid(value.taskId))||!Number.isSafeInteger(value.version)||(value.version as number)<0)fields.form='Aufgabenkennung oder Version ist ungültig.';
 if(!TASK_KINDS.includes(value.kind as TaskKind))fields.kind='Art fehlt.';
 if(typeof value.title!=='string'||value.title.trim().length<3||value.title.trim().length>120)fields.title='Was ist zu tun? (3–120 Zeichen)';
 if(!date(value.dueDate))fields.dueDate='Fällig fehlt oder ist ungültig.';
 if(!(value.time===null||typeof value.time==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.time)))fields.time='Uhrzeit ist ungültig.';
 if(!((value.forLogin===null&&isAccessArea(value.forArea)&&value.forArea!=='statistik_alle')||(taskUuid(value.forLogin)&&value.forArea===null)))fields.recipient='Für fehlt oder ist nicht eindeutig.';
 if(!validTaskReference(value.reference))fields.reference='Bezug fehlt oder ist ungültig.';
 if(!(value.note===null||typeof value.note==='string'&&value.note.length<=2000))fields.note='Notiz darf höchstens 2000 Zeichen enthalten.';
 if(!(value.itemId===undefined&&value.itemVersion===undefined||taskUuid(value.itemId)&&(value.taskId!==undefined&&value.itemVersion===undefined||Number.isSafeInteger(value.itemVersion)&&(value.itemVersion as number)>0)))fields.item='Eingangsbezug oder Version ist ungültig.';
 if(Object.keys(value).some(key=>!['clientKey','taskId','version','kind','title','dueDate','time','forLogin','forArea','reference','note','itemId','itemVersion'].includes(key)))fields.form='Unbekannte Aufgabenfelder.';
 return fields;
}
