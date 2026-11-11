import {INTAKE_CONCERN_AREAS} from './intakeLifecycleContract';
import type {CaseActorTrace} from "@/lib/domain/caseActorContract";
import type {AccessArea} from '@/lib/auth/authorizationContract';
import type {IntakeCaptureResult} from './captureContract';
import type {IntakeSelectionInput,IntakeUseInput,IntakeUseResult,IntakeReopenInput} from './intakeLifecycleContract';
import type {AssignmentPorts} from './assignmentContract';

export const MESSAGE_FILTERS=['offen','zuordnen','alle','erledigt','aussortiert'] as const;
export const INTAKE_CHANGED_EVENT='kreile:intake-changed';
export type MessageFilter=typeof MESSAGE_FILTERS[number];
export type IntakeMessage={
 fallbackPriority?:ReturnType<typeof readFallbackMessagePriority>;
 nextActionRule?:MessageNextActionRead;
 sendState?:'entwurf'|'sendet'|'gesendet'|'fehler'|'unklar'|'verworfen'|null;
 actorTrace?:CaseActorTrace;id:string;version:number;channel:string;direction:string;assignment:string;usage:string;senderName:string|null;senderAddress:string|null;groupAddress:string|null;subject:string|null;text:string|null;at:string;customerId:string|null;customerName:string|null;customerType:string|null;orderId:string|null;orderKind:string|null;orderNumber:string|null;orderStation:string|null;goods:string|null;concerns:string[];openConcerns:string[];discardReason:string|null;createdBy:string;fileIds:string[];files?:Array<{id:string;name:string}>};
/** Browser-safe read contract; no server implementation import enters the client facade. */
export type MessageNextActionRead=({code:'OK';zustand:string;farbe:'ral'|'warn'|'info'|'succ';nutzung:string;zuordnung:string;prioritaet:number|null;
 erstblick:Array<{key:string;werte:Readonly<Record<string,unknown>>}>;
 hauptaktion:null|{elementId:string;textKey:string;werte:Record<string,string|number>;befehl:{datei:string;funktion:string;argumente:Readonly<Record<string,unknown>>};recht:string|null};
 gesperrt:Array<{elementId:string;grundKey:string}>;datenluecken:readonly string[];weitereStatus:'SOURCE_INCOMPLETE';quelle:Readonly<Record<string,string>>}
 |{code:'SOURCE_INCOMPLETE';missing:readonly string[]}|{code:'FORBIDDEN'})&{source:{kind:'intake';id:string;version:number}};
export type IntakeMessagesResult={code:'OK';messages:IntakeMessage[];areas:AccessArea[];currentLogin:string}|{code:'UNAUTHENTICATED'|'FORBIDDEN'|'VALIDATION_ERROR'|'UNAVAILABLE';message:string};
export type IntakeHandoverRequest={command:"handover_from_mail";sourceItemId:string;sourceVersion:number;clientEventId:string;orderId?:string;expectedVersion?:number};
export type IntakeHandoverResult={code:"OK";receipt:unknown;replayed:boolean}|{code:"UNAUTHENTICATED"|"FORBIDDEN"|"VALIDATION_ERROR"|"NOT_FOUND"|"CONFLICT"|"UNAVAILABLE";message:string;choices?:Array<{id:string;number:string|null;version:number}>};
export type IntakeMessagesPorts={handover?:(input:IntakeHandoverRequest)=>Promise<IntakeHandoverResult>;list:(filter:MessageFilter)=>Promise<IntakeMessagesResult>;select:(input:IntakeSelectionInput)=>Promise<IntakeCaptureResult>;finish:(input:IntakeUseInput)=>Promise<IntakeUseResult>;reopen:(input:IntakeReopenInput)=>Promise<IntakeCaptureResult>;assignment:Pick<AssignmentPorts,'read'|'assign'>};
export function messageGroupId(row:IntakeMessage){return row.customerId?'kunde:'+row.customerId:row.groupAddress?'adresse:'+row.groupAddress:'eingang:'+row.id;}
export function messageTone(row:IntakeMessage):'rot'|'orange'|'navy'|'gruen'{
 if(row.usage!=='offen')return 'gruen';
 if(row.openConcerns.includes('reklamation'))return 'rot';
 if(row.assignment==='offen'&&row.direction==='rein'||row.openConcerns.some(value=>['termin','kv_anfrage','kv_annahme','kv_ablehnung'].includes(value)))return 'orange';
 return 'navy';
}

/** PL02:25 fallback priority, from stored concerns/dispatch state only.
 * This is a fact seam, not the full U2 action/presentation contract. */
export function readFallbackMessagePriority(row:Pick<IntakeMessage,'id'|'version'|'sendState'|'usage'|'discardReason'|'openConcerns'|'assignment'|'customerId'|'direction'>){
 const source={kind:'intake' as const,id:row.id,version:row.version};
 const selected=(rank:1|2|3|4|5|6|8)=>({code:'OK' as const,rank,source});
 if(typeof row.discardReason==='string'||row.usage==='erledigt'||row.usage==='info')return selected(8);
 if(row.usage!=='offen')return {code:'SOURCE_INCOMPLETE' as const,missing:['MESSAGE_USAGE'],source};
 if(row.sendState===undefined||row.sendState!==null&&!['entwurf','sendet','gesendet','fehler','unklar','verworfen'].includes(row.sendState))return {code:'SOURCE_INCOMPLETE' as const,missing:['DISPATCH_STATE'],source};
 if(row.sendState==='unklar')return selected(1);
 if(!['rein','intern','raus'].includes(row.direction)||!Array.isArray(row.openConcerns)||row.openConcerns.some(kind=>!Object.hasOwn(INTAKE_CONCERN_AREAS,kind)))return {code:'SOURCE_INCOMPLETE' as const,missing:['MESSAGE_CLASSIFICATION'],source};
 if(row.openConcerns.some(kind=>kind==='kv_annahme'||kind==='kv_ablehnung'))return selected(2);
 if(row.openConcerns.includes('reklamation'))return selected(3);
 // Generic termin is the production deadline, not evidence of pickup.
 if(row.openConcerns.includes('abholung'))return selected(4);
 if(row.openConcerns.some(kind=>kind==='kv_anfrage'||kind==='ware'))return selected(5);
 if(row.assignment==='offen'&&row.customerId===null&&row.direction==='rein')return selected(6);
 // R13 / PL22:06: unknown reply history cannot hide a known higher-priority concern.
 if(row.direction==='raus')return {code:'SOURCE_INCOMPLETE' as const,missing:['QUESTION_REPLY_HISTORY'],source};
 // Unmatched incoming/internal concerns have no fallback main action.
 return selected(8);
}
