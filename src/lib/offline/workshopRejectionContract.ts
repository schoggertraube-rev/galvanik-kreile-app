import {canonicalJson} from '@/lib/domain/canonicalJson';
import type {PendingWorkshopOriginal} from './pendingStore';

export type WorkshopRejectionCode='CONFLICT'|'FORBIDDEN'|'NOT_FOUND'|'VALIDATION_ERROR';
export type WorkshopRejectionSubject={kind:'invoice'|'customer';id:string;label:string;amountCents:number};
export type WorkshopRejectionReceipt={scope:string;eventId:string;taskId:string;actorId:string;clientEventId:string;deviceCapturedAt:string;originalCanonical:string;rejection:WorkshopRejectionCode;subject?:WorkshopRejectionSubject};
export function isWorkshopRejectionCode(value:unknown):value is WorkshopRejectionCode{return ['CONFLICT','FORBIDDEN','NOT_FOUND','VALIDATION_ERROR'].includes(String(value));}
/** Release only the consumed controller key; retained original and disposition stay untouched. */
export function releaseRejectedWorkshopRequest(scope:string,original:PendingWorkshopOriginal,receipt:unknown,requests:Record<string,string>,key:string):boolean{
 if(requests[key]!==original.id||!isWorkshopRejectionReceipt(scope,original,receipt))return false;
 delete requests[key];return true;
}
/** A distinct disposition proof. It cannot acknowledge any business effect. */
export function isWorkshopRejectionReceipt(scope:string,original:PendingWorkshopOriginal,value:unknown):value is WorkshopRejectionReceipt{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const row=value as Record<string,unknown>,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
 const keys=Object.keys(row).sort().join(',');
 const subject=row.subject as WorkshopRejectionSubject|undefined;
 const subjectOk=subject===undefined||!!subject&&typeof subject==='object'&&!Array.isArray(subject)
  &&Object.keys(subject).sort().join(',')==='amountCents,id,kind,label'&&typeof subject.label==='string'&&subject.label.length>0
  &&Number.isSafeInteger(subject.amountCents)&&subject.amountCents>=0
  &&(original.command==='invoice.cancel'||original.command==='credit.apply'?subject.kind==='invoice'&&subject.id===original.input.invoiceId&&(original.command==='invoice.cancel'||subject.amountCents===original.input.amount):original.command==='credit.payout'&&subject.kind==='customer'&&subject.id===original.input.customerId&&subject.amountCents===original.input.amount);
 return (keys==='actorId,clientEventId,deviceCapturedAt,eventId,originalCanonical,rejection,scope,taskId'||keys==='actorId,clientEventId,deviceCapturedAt,eventId,originalCanonical,rejection,scope,subject,taskId')&&subjectOk
  &&row.scope===scope&&row.clientEventId===original.id&&row.deviceCapturedAt===original.deviceCapturedAt
  &&typeof row.eventId==='string'&&uuid.test(row.eventId)&&typeof row.taskId==='string'&&uuid.test(row.taskId)
  &&typeof row.actorId==='string'&&uuid.test(row.actorId)&&isWorkshopRejectionCode(row.rejection)
  &&row.originalCanonical===canonicalJson({command:original.command,input:original.input,deviceCapturedAt:original.deviceCapturedAt});
}
