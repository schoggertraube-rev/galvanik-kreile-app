import {canonicalJson} from '@/lib/domain/canonicalJson';
import type {PendingWorkshopOriginal} from './pendingStore';

export type WorkshopRejectionCode='CONFLICT'|'FORBIDDEN'|'NOT_FOUND'|'VALIDATION_ERROR';
export type WorkshopRejectionReceipt={scope:string;eventId:string;taskId:string;actorId:string;clientEventId:string;deviceCapturedAt:string;originalCanonical:string;rejection:WorkshopRejectionCode};
export function isWorkshopRejectionCode(value:unknown):value is WorkshopRejectionCode{return ['CONFLICT','FORBIDDEN','NOT_FOUND','VALIDATION_ERROR'].includes(String(value));}
/** A distinct disposition proof. It cannot acknowledge any business effect. */
export function isWorkshopRejectionReceipt(scope:string,original:PendingWorkshopOriginal,value:unknown):value is WorkshopRejectionReceipt{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const row=value as Record<string,unknown>,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
 return Object.keys(row).sort().join(',')==='actorId,clientEventId,deviceCapturedAt,eventId,originalCanonical,rejection,scope,taskId'
  &&row.scope===scope&&row.clientEventId===original.id&&row.deviceCapturedAt===original.deviceCapturedAt
  &&typeof row.eventId==='string'&&uuid.test(row.eventId)&&typeof row.taskId==='string'&&uuid.test(row.taskId)
  &&typeof row.actorId==='string'&&uuid.test(row.actorId)&&isWorkshopRejectionCode(row.rejection)
  &&row.originalCanonical===canonicalJson({command:original.command,input:original.input,deviceCapturedAt:original.deviceCapturedAt});
}
