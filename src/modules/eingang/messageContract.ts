import type {CaseActorTrace} from "@/lib/server/quoteJournalPort";
import type {AccessArea} from '@/lib/auth/authorizationContract';
import type {IntakeCaptureResult} from './captureContract';
import type {IntakeSelectionInput,IntakeUseInput,IntakeUseResult,IntakeReopenInput} from './intakeLifecycleContract';
import type {AssignmentPorts} from './assignmentContract';

export const MESSAGE_FILTERS=['offen','zuordnen','alle','erledigt','aussortiert'] as const;
export const INTAKE_CHANGED_EVENT='kreile:intake-changed';
export type MessageFilter=typeof MESSAGE_FILTERS[number];
export type IntakeMessage={
 actorTrace?:CaseActorTrace;id:string;version:number;channel:string;direction:string;assignment:string;usage:string;senderName:string|null;senderAddress:string|null;groupAddress:string|null;subject:string|null;text:string|null;at:string;customerId:string|null;customerName:string|null;customerType:string|null;orderId:string|null;orderKind:string|null;orderNumber:string|null;orderStation:string|null;goods:string|null;concerns:string[];openConcerns:string[];discardReason:string|null;createdBy:string;fileIds:string[];files?:Array<{id:string;name:string}>};
export type IntakeMessagesResult={code:'OK';messages:IntakeMessage[];areas:AccessArea[];currentLogin:string}|{code:'UNAUTHENTICATED'|'FORBIDDEN'|'VALIDATION_ERROR'|'UNAVAILABLE';message:string};
export type IntakeMessagesPorts={list:(filter:MessageFilter)=>Promise<IntakeMessagesResult>;select:(input:IntakeSelectionInput)=>Promise<IntakeCaptureResult>;finish:(input:IntakeUseInput)=>Promise<IntakeUseResult>;reopen:(input:IntakeReopenInput)=>Promise<IntakeCaptureResult>;assignment:Pick<AssignmentPorts,'read'|'assign'>};
export function messageGroupId(row:IntakeMessage){return row.customerId?'kunde:'+row.customerId:row.groupAddress?'adresse:'+row.groupAddress:'eingang:'+row.id;}
export function messageTone(row:IntakeMessage):'rot'|'orange'|'navy'|'gruen'{
 if(row.usage!=='offen')return 'gruen';
 if(row.openConcerns.includes('reklamation'))return 'rot';
 if(row.assignment==='offen'&&row.direction==='rein'||row.openConcerns.some(value=>['termin','kv_anfrage','kv_annahme','kv_ablehnung'].includes(value)))return 'orange';
 return 'navy';
}
