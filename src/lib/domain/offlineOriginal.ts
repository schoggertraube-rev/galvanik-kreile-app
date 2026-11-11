/** PL 11.11.09:00: device evidence, never a replacement for server booking time. */
export type OfflineOriginal={deviceCapturedAt:string;actorId:string;clientEventId:string};
export function isOfflineOriginal(value:unknown):value is OfflineOriginal{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const row=value as Record<string,unknown>,uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
 return Object.keys(row).sort().join(',')==='actorId,clientEventId,deviceCapturedAt'&&uuid(row.actorId)&&uuid(row.clientEventId)&&typeof row.deviceCapturedAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(row.deviceCapturedAt)&&Number.isFinite(Date.parse(row.deviceCapturedAt));
}
export function normalizeOfflineOriginal(value:OfflineOriginal):OfflineOriginal{return {deviceCapturedAt:value.deviceCapturedAt,actorId:value.actorId,clientEventId:value.clientEventId};}
