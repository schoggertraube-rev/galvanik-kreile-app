import {PROTOCOL_EVENT_ID} from './clickContract';
import type {ClientDiagnosticFact,ClientMissedFact} from './public';
/** Existing S06 diagnostic identifiers only; no error objects or user text. */
export const PROTOCOL_CLIENT_ERRORS=[
 "ACTION_REQUEST_FAILED",
 "EVIDENCE_VISIBILITY_TRANSPORT_UNAVAILABLE",
 "OFFLINE_CACHE_MARKER_REVOKE_FAILED",
 "OFFLINE_DELAYED_READ_FAILED",
 "OFFLINE_DEVICE_FENCE_FAILED",
 "OFFLINE_DEVICE_PORT_READ_FAILED",
 "OFFLINE_DEVICE_PORT_WRITE_FAILED",
 "OFFLINE_DEVICE_REFRESH_FAILED",
 "OFFLINE_DEVICE_SOURCE_FAILED",
 "OFFLINE_DEVICE_STAND_READ_FAILED",
 "OFFLINE_DEVICE_STAND_REFRESH_FAILED",
 "OFFLINE_DEVICE_STAND_WRITE_FAILED",
 "OFFLINE_HEARTBEAT_UNAVAILABLE",
 "OFFLINE_LOGIN_CACHE_UNAVAILABLE",
 "OFFLINE_LOGOUT_CACHE_DELETE_FAILED",
 "OFFLINE_LOGOUT_CLEANUP_TIMEOUT",
 "OFFLINE_LOGOUT_FLUSH_FAILED",
 "OFFLINE_LOGOUT_PENDING_READ_FAILED",
 "OFFLINE_NOTE_SYNC_FAILED",
 "OFFLINE_ORIGINAL_SYNC_FAILED",
 "OFFLINE_PENDING_READ_FAILED",
 "OFFLINE_PERSISTENCE_UNCONFIRMED",
 "OFFLINE_PRIVATE_CACHE_READ_BLOCKED",
 "OFFLINE_PRIVATE_CACHE_WARM_FAILED",
 "OFFLINE_REPLAY_HTTP_UNAVAILABLE",
 "OFFLINE_START_CACHE_DELETE_FAILED",
 "OFFLINE_SYNC_FAILED",
 "OFFLINE_SYNC_UNAVAILABLE",
 "OFFLINE_TAKEOVER_UNAVAILABLE",
 "OFFLINE_WORKSHOP_STAND_UNAVAILABLE",
 "OFFLINE_WORKSHOP_SYNC_FAILED",
 "SERVICE_WORKER_REGISTRATION_FAILED"
] as const;
export type ProtocolClientErrorCode=typeof PROTOCOL_CLIENT_ERRORS[number];
export function isProtocolClientErrorCode(value:unknown):value is ProtocolClientErrorCode{return typeof value==='string'&&(PROTOCOL_CLIENT_ERRORS as readonly string[]).includes(value);}
export function parseClientDiagnostic(value:unknown):ClientDiagnosticFact|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const row=value as Record<string,unknown>;
 if(Object.keys(row).sort().join(',')!=='command,id,kind,occurredAt'||row.kind!=='error'||typeof row.id!=='string'||!PROTOCOL_EVENT_ID.test(row.id)||!isProtocolClientErrorCode(row.command)||typeof row.occurredAt!=='string'||!Number.isFinite(Date.parse(row.occurredAt)))return null;
 return {kind:'error',id:row.id,command:row.command,occurredAt:new Date(row.occurredAt).toISOString()};
}
export function parseClientMissed(value:unknown):ClientMissedFact|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const row=value as Record<string,unknown>;
 if(Object.keys(row).sort().join(',')!=='count,id,kind,occurredAt'||row.kind!=='missed'||typeof row.id!=='string'||!PROTOCOL_EVENT_ID.test(row.id)||!Number.isSafeInteger(row.count)||Number(row.count)<1||Number(row.count)>2147483647||typeof row.occurredAt!=='string'||!Number.isFinite(Date.parse(row.occurredAt)))return null;
 return {kind:'missed',id:row.id,count:Number(row.count),occurredAt:new Date(row.occurredAt).toISOString()};
}
