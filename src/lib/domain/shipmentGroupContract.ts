import {isOfflineOriginal,type OfflineOriginal} from './offlineOriginal';
export type ShipmentGroupMember={orderId:string;expectedVersion:number;agreement?:{id:string;version:number;type:'ausgabe_ohne_zahlung'|'sammelrechnung'|'zahlungsziel'};overdueReleaseReason?:string};
// A confirmation names exactly the membership/version just read from shipments.
// No browser-supplied tracking number or customer identity is authoritative.
export type ShipmentGroupInput={orderId:string;groupId:string;expectedGroupVersion:string;clientEventId:string;members:ShipmentGroupMember[];offlineOriginal?:OfflineOriginal};
export type ShipmentGroupReceipt={eventId:string;clientEventId:string;groupId:string;groupVersion:string;actorId:string;occurredAt:string;trackingNumber:string;carrier:string;shipments:{shipmentId:string;orderId:string;goodsOutEventId:string|null}[];offlineOriginal?:OfflineOriginal};
export type ShipmentGroupResult={code:'OK';receipt:ShipmentGroupReceipt;replayed:boolean}|{code:'UNAUTHENTICATED'|'FORBIDDEN'|'NOT_FOUND'|'CONFLICT'|'VALIDATION_ERROR'|'UNAVAILABLE';message:string;blockedOrderId?:string;blockedOrderNumber?:string};
export function isShipmentGroupInput(value:unknown):value is ShipmentGroupInput{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const row=value as Record<string,unknown>,uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
 return Object.keys(row).sort().join(',')===['clientEventId','expectedGroupVersion','groupId','members','orderId',...(Object.hasOwn(row,'offlineOriginal')?['offlineOriginal']:[])].sort().join(',')
 &&(!Object.hasOwn(row,'offlineOriginal')||isOfflineOriginal(row.offlineOriginal))&&typeof row.orderId==='string'&&!!row.orderId.trim()&&uuid(row.groupId)&&uuid(row.clientEventId)&&typeof row.expectedGroupVersion==='string'&&/^[a-f0-9]{64}$/.test(row.expectedGroupVersion)&&Array.isArray(row.members)&&row.members.length>0&&row.members.length<=100&&row.members.every(member=>member&&typeof member==='object'&&!Array.isArray(member)&&typeof member.orderId==='string'&&member.orderId.length>0&&Number.isSafeInteger(member.expectedVersion)&&member.expectedVersion>0&&Object.keys(member).every(key=>['orderId','expectedVersion','agreement','overdueReleaseReason'].includes(key)))&&new Set(row.members.map(member=>member.orderId)).size===row.members.length&&row.members.some(member=>member.orderId===row.orderId);
}
export function isShipmentGroupReceipt(value:unknown,input:ShipmentGroupInput,actorId:unknown):value is ShipmentGroupReceipt{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const row=value as Record<string,unknown>,uuid=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
 if(Object.keys(row).sort().join(',')!==['actorId','carrier','clientEventId','eventId','groupId','groupVersion','occurredAt','shipments','trackingNumber',...(Object.hasOwn(row,'offlineOriginal')?['offlineOriginal']:[])].sort().join(',')
  ||!uuid(row.eventId)||!uuid(row.actorId)||row.actorId!==actorId||row.clientEventId!==input.clientEventId||row.groupId!==input.groupId||row.groupVersion!==input.expectedGroupVersion
  ||typeof row.occurredAt!=='string'||!Number.isFinite(Date.parse(row.occurredAt))||typeof row.trackingNumber!=='string'||!row.trackingNumber.trim()||typeof row.carrier!=='string'||!row.carrier.trim()||!Array.isArray(row.shipments)||!row.shipments.length)return false;
 if(Object.hasOwn(row,'offlineOriginal')&&(!isOfflineOriginal(row.offlineOriginal)||row.offlineOriginal.actorId!==actorId||row.offlineOriginal.clientEventId!==input.clientEventId))return false;
 return row.shipments.every(parcel=>parcel&&typeof parcel==='object'&&!Array.isArray(parcel)&&Object.keys(parcel).sort().join(',')==='goodsOutEventId,orderId,shipmentId'&&uuid(parcel.shipmentId)&&input.members.some(member=>member.orderId===parcel.orderId)&&(parcel.goodsOutEventId===null||uuid(parcel.goodsOutEventId)))
  &&new Set(row.shipments.map(parcel=>parcel.shipmentId)).size===row.shipments.length&&input.members.every(member=>row.shipments instanceof Array&&row.shipments.some(parcel=>parcel.orderId===member.orderId));
}
