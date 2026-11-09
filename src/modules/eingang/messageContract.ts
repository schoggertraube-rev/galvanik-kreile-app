import type {ComponentType} from 'react';
import type {IntakeDraftPorts} from './draftContract';
import type {AccessArea} from '@/lib/auth/authorizationContract';
import type {IntakeCaptureResult} from './captureContract';
import type {IntakeSelectionInput,IntakeUseInput,IntakeUseResult,IntakeReopenInput} from './intakeLifecycleContract';
import type {AssignmentPorts} from './assignmentContract';

export const MESSAGE_FILTERS=['offen','zuordnen','alle','erledigt','aussortiert'] as const;
export const INTAKE_CHANGED_EVENT='kreile:intake-changed';
export type MessageFilter=typeof MESSAGE_FILTERS[number];
export type IntakeMessage={photoDelivery?:{state:'checking'|'failed';clientRequestId:string|null;version:number;retryAt:string};photoParentId?:string;photoReplies?:Array<{replyId:string;orderId:string|null;photoIds:string[]}>;photoCount?:number;photoRequest?:{at:string;threadId:string};id:string;version:number;channel:string;direction:string;assignment:string;usage:string;senderName:string|null;senderAddress:string|null;groupAddress:string|null;subject:string|null;text:string|null;at:string;customerId:string|null;customerName:string|null;customerType:string|null;orderId:string|null;orderKind:string|null;orderNumber:string|null;orderStation:string|null;goods:string|null;concerns:string[];openConcerns:string[];discardReason:string|null;createdBy:string;fileIds:string[];files?:Array<{id:string;name:string}>};
export type IntakeMessagesResult={code:'OK';messages:IntakeMessage[];areas:AccessArea[];currentLogin:string}|{code:'UNAUTHENTICATED'|'FORBIDDEN'|'VALIDATION_ERROR'|'UNAVAILABLE';message:string};
export type IntakeHandoverRequest={command:"handover_from_mail";sourceItemId:string;sourceVersion:number;clientEventId:string;orderId?:string;expectedVersion?:number};
export type IntakeHandoverResult={code:"OK";receipt:unknown;replayed:boolean}|{code:"UNAUTHENTICATED"|"FORBIDDEN"|"VALIDATION_ERROR"|"NOT_FOUND"|"CONFLICT"|"UNAVAILABLE";message:string;choices?:Array<{id:string;number:string|null;version:number}>};
export type ComplaintResponseRequest={targetType:'CUSTOMER';targetId:string;clientRequestId:string;subject:string;body:string;complaintRejection:{itemId:string;version:number;reason:string}};
export type ComplaintComposer={subject:string;body:string;onSubject:(value:string)=>void;onBody:(value:string)=>void;onSend:()=>void;busy:boolean};
export type IntakeMessagesPorts={replyDrafts?:IntakeDraftPorts;ReplyMailView?:ComponentType<{customerId:string;composer:ComplaintComposer}>;rejectComplaint?:(input:ComplaintResponseRequest)=>Promise<{code:'OK';data:unknown}|{code:string;message:string}>;requestPhotos?:(input:{targetType:'CUSTOMER';targetId:string;clientRequestId:string;subject:string;body:string;complaintPhotoRequest:{itemId:string;version:number}})=>Promise<{code:'OK';data:unknown}|{code:string;message:string}>;handover?:(input:IntakeHandoverRequest)=>Promise<IntakeHandoverResult>;list:(filter:MessageFilter)=>Promise<IntakeMessagesResult>;select:(input:IntakeSelectionInput)=>Promise<IntakeCaptureResult>;finish:(input:IntakeUseInput)=>Promise<IntakeUseResult>;reopen:(input:IntakeReopenInput)=>Promise<IntakeCaptureResult>;assignment:Pick<AssignmentPorts,'read'|'assign'>};
export function messageGroupId(row:IntakeMessage){return row.customerId?'kunde:'+row.customerId:row.groupAddress?'adresse:'+row.groupAddress:'eingang:'+row.id;}
export function messageTone(row:IntakeMessage):'rot'|'orange'|'navy'|'gruen'{
 if(row.usage!=='offen')return 'gruen';
 if(row.openConcerns.includes('reklamation'))return 'rot';
 if(row.assignment==='offen'&&row.direction==='rein'||row.openConcerns.some(value=>['termin','kv_anfrage','kv_annahme','kv_ablehnung'].includes(value)))return 'orange';
 return 'navy';
}
