export type DeliveryNoteSourceReference={paymentHash:string;contentHash:string};
export type DeliveryNoteInput={orderIds:string[];clientEventId:string;expectedVersions:Record<string,number>;expectedSources?:Record<string,DeliveryNoteSourceReference>};
export type DeliveryNoteSourceRead={code:'OK';source:Pick<DeliveryNoteInput,'orderIds'|'expectedVersions'|'expectedSources'>}|Exclude<DeliveryNoteResult,{code:'OK'}>;
export function isDeliveryNoteInput(value:unknown):value is DeliveryNoteInput{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const row=value as Record<string,unknown>;
 if(!['clientEventId,expectedVersions,orderIds','clientEventId,expectedSources,expectedVersions,orderIds'].includes(Object.keys(row).sort().join(','))||!Array.isArray(row.orderIds)||!row.orderIds.length
  ||row.orderIds.some(id=>typeof id!=='string'||!id.trim()||id!==id.trim()||id.length>128)
  ||new Set(row.orderIds).size!==row.orderIds.length||typeof row.clientEventId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(row.clientEventId)
  ||!row.expectedVersions||typeof row.expectedVersions!=='object'||Array.isArray(row.expectedVersions))return false;
 const versions=row.expectedVersions as Record<string,unknown>;
 if(Object.hasOwn(row,'expectedSources')){
  const sources=row.expectedSources;if(!sources||typeof sources!=='object'||Array.isArray(sources)||Object.keys(sources).sort().join('\0')!==[...row.orderIds].sort().join('\0'))return false;
  for(const id of row.orderIds){const source=(sources as Record<string,unknown>)[id];if(!source||typeof source!=='object'||Array.isArray(source)||Object.keys(source).sort().join(',')!=='contentHash,paymentHash'||!Object.values(source).every(hash=>typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash)))return false;}
 }
 return Object.keys(versions).sort().join('\0')===[...row.orderIds].sort().join('\0')&&row.orderIds.every(id=>Number.isSafeInteger(versions[id])&&Number(versions[id])>0);
}
export type DeliveryNoteReceipt={eventId:string;originalEventId:string;clientEventId:string;actorId:string;version:number;orderIds:string[];pdfSha256:string;storagePath:string};
export type DeliveryNoteRemedy={href:string;field:string;datei:string;funktion:string;argumente:Record<string,string>};
export type DeliveryNoteResult={code:'OK';receipt:DeliveryNoteReceipt;pdfBase64:string;replayed:boolean}|{code:'UNAUTHENTICATED'|'FORBIDDEN'|'VALIDATION_ERROR'|'CONFLICT'|'NOT_FOUND'|'UNAVAILABLE';message:string;remedy?:DeliveryNoteRemedy};
export function isDeliveryNoteReceipt(value:unknown,input:DeliveryNoteInput,actorId:unknown):value is DeliveryNoteReceipt{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const row=value as Record<string,unknown>,uuid=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
 return Object.keys(row).sort().join(',')==='actorId,clientEventId,eventId,orderIds,originalEventId,pdfSha256,storagePath,version'
  &&uuid(row.eventId)&&uuid(row.originalEventId)&&row.actorId===actorId&&uuid(row.actorId)&&row.clientEventId===input.clientEventId
  &&Array.isArray(row.orderIds)&&JSON.stringify(row.orderIds)===JSON.stringify([...input.orderIds].sort())
  &&Number.isSafeInteger(row.version)&&Number(row.version)>0&&typeof row.pdfSha256==='string'&&/^[a-f0-9]{64}$/.test(row.pdfSha256)
  &&row.storagePath==='domain-attachments/v1/'+row.originalEventId+'.json';
}
