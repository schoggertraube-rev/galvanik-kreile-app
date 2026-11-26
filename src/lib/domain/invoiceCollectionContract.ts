import {invoiceDate} from '@/modules/eingang/public';

/** The collection branch of the existing v3 invoice original (PL19.11.14:47).
 * This describes frozen originals, never current order/customer master data. */
export type InvoiceCollectionMember={
 orderId:string;orderVersion:number;orderNumber:string;title:string;freezeId:string;serviceDate:string;
};
export type InvoiceCollectionOriginal={
 collectionId:string;version:number;month:string;members:InvoiceCollectionMember[];
};
/** PL19.11.16:22: preparation has no planned month and no billable membership. */
export type InvoiceCollectionPlanInput={orderId:string;expectedVersion:number;clientEventId:string};
export type InvoiceCollectionPlanReceipt={eventId:string;orderId:string;orderVersion:number;customerId:string;freezeId:string;agreementId:string;agreementVersion:number;actorId:string;clientEventId:string;recordedAt:string;collectionPlanned:true};
export type InvoiceCollectionRemoveInput={collectionId:string;orderId:string;expectedVersion:number;clientEventId:string};
export type InvoiceCollectionRemoveReceipt={eventId:string;orderId:string;orderVersion:number;customerId:string;collectionId:string;collectionVersion:number;collectionVersionAfter:number;goodsOutEventId:string;memberCreatedAt:string;actorId:string;clientEventId:string;recordedAt:string};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function object(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function keys(value:Record<string,unknown>,expected:string){return Object.keys(value).sort().join(',')===expected;}
function text(value:unknown):value is string{return typeof value==='string'&&value.trim().length>0;}
function version(value:unknown):value is number{return typeof value==='number'&&Number.isSafeInteger(value)&&value>0;}
export function parseInvoiceCollectionOriginal(value:unknown):InvoiceCollectionOriginal{
 if(!object(value)||!keys(value,'collectionId,members,month,version')
  ||typeof value.collectionId!=='string'||!UUID.test(value.collectionId)||!version(value.version)
  ||typeof value.month!=='string'||!invoiceDate(value.month)||!value.month.endsWith('-01')
  ||!Array.isArray(value.members)||value.members.length===0)throw Error('INVOICE_COLLECTION_SNAPSHOT_INVALID');
 const seenOrders=new Set<string>(),seenFreezes=new Set<string>();
 const members=value.members.map((raw:unknown)=>{
  const member=parseMember(raw);
  if(seenOrders.has(member.orderId)||seenFreezes.has(member.freezeId))throw Error('INVOICE_COLLECTION_MEMBER_INVALID');
  seenOrders.add(member.orderId);seenFreezes.add(member.freezeId);
  return member;
 });
 return {collectionId:value.collectionId,version:value.version,month:value.month,members};
}

function parseMember(member:unknown):InvoiceCollectionMember{
 if(!object(member)||!keys(member,'freezeId,orderId,orderNumber,orderVersion,serviceDate,title')
  ||!text(member.orderId)||member.orderId.trim()!==member.orderId||member.orderId.length>128
  ||!version(member.orderVersion)||!text(member.orderNumber)||!text(member.title)
  ||typeof member.freezeId!=='string'||!UUID.test(member.freezeId)
  ||typeof member.serviceDate!=='string'||!invoiceDate(member.serviceDate))throw Error('INVOICE_COLLECTION_MEMBER_INVALID');
 return {orderId:member.orderId,orderVersion:member.orderVersion,orderNumber:member.orderNumber,title:member.title,freezeId:member.freezeId,serviceDate:member.serviceDate};
}
/** Resolve the actual source branch, never a representative first member. */
export function invoiceOriginalMembers(source:{order:unknown;collection?:unknown;serviceDate:unknown}):InvoiceCollectionMember[]{
 if(source.collection!==undefined){
  if(source.order!==null||source.serviceDate!==null)throw Error('INVOICE_ORIGINAL_SOURCE_AMBIGUOUS');
  return parseInvoiceCollectionOriginal(source.collection).members;
 }
 if(!object(source.order))throw Error('INVOICE_ORIGINAL_ORDER_SOURCE_INVALID');
 const row=source.order;
 if(!text(row.orderId)||!version(row.orderVersion)||!text(row.orderNumber)||!text(row.title)||!text(row.freezeId)||typeof source.serviceDate!=='string'||!invoiceDate(source.serviceDate))throw Error('INVOICE_ORIGINAL_ORDER_SOURCE_INVALID');
 return [{orderId:row.orderId,orderVersion:row.orderVersion,orderNumber:row.orderNumber,title:row.title,freezeId:row.freezeId,serviceDate:source.serviceDate}];
}
export function invoiceOriginalLineMember(source:Parameters<typeof invoiceOriginalMembers>[0],line:{sourceOrderId?:unknown}):InvoiceCollectionMember{
 const members=invoiceOriginalMembers(source);
 if(source.collection===undefined&&line.sourceOrderId===undefined)return members[0];
 const member=members.find(row=>row.orderId===line.sourceOrderId);
 if(!member)throw Error('INVOICE_COLLECTION_LINE_SOURCE_INVALID');
 return member;
}

/** A shipping line may belong to several real members of the same shipment.
 * It still appears once and never assigns the charge to an arbitrary order. */
export function invoiceOriginalLineMembers(source:Parameters<typeof invoiceOriginalMembers>[0],line:{type:string;sourceOrderId?:unknown;sourceOrderIds?:unknown}):InvoiceCollectionMember[]{
 if(source.collection===undefined){
  if(line.sourceOrderIds!==undefined)throw Error('INVOICE_COLLECTION_LINE_SOURCE_INVALID');
  return [invoiceOriginalLineMember(source,line)];
 }
 if(line.type!=='SHIPPING'){
  if(line.sourceOrderIds!==undefined)throw Error('INVOICE_COLLECTION_LINE_SOURCE_INVALID');
  return [invoiceOriginalLineMember(source,line)];
 }
 if(line.sourceOrderId!==undefined||!Array.isArray(line.sourceOrderIds)||line.sourceOrderIds.length===0||new Set(line.sourceOrderIds).size!==line.sourceOrderIds.length)throw Error('INVOICE_COLLECTION_LINE_SOURCE_INVALID');
 return line.sourceOrderIds.map(id=>invoiceOriginalLineMember(source,{sourceOrderId:id}));
}

/** Qualify source coverage once for both the stored reader and the XML writer. */
export function assertInvoiceOriginalLineSources(source:Parameters<typeof invoiceOriginalMembers>[0],lines:readonly {type:string;itemId?:unknown;sourceOrderId?:unknown;sourceOrderIds?:unknown;shipmentGroupId?:unknown;eventIds?:unknown}[]):void{
 const members=invoiceOriginalMembers(source),represented=new Set<string>(),goods=new Set<string>(),shipments=new Set<string>();
 const materialEvents=new Set<string>();
 for(const line of lines){
  const origins=invoiceOriginalLineMembers(source,line);
  if(line.type==='MATERIAL'){
   if(line.sourceOrderId!==origins[0].orderId||!Array.isArray(line.eventIds)||line.eventIds.length===0)throw Error('INVOICE_MATERIAL_SOURCE_INVALID');
   for(const id of line.eventIds){
    if(typeof id!=='string'||id.length!==36||!UUID.test(id)||materialEvents.has(id))throw Error('INVOICE_MATERIAL_SOURCE_INVALID');
    materialEvents.add(id);
   }
  }
  if(source.collection===undefined)continue; // Existing ordinary line checks remain in their canonical parser.
  if(line.type==='SHIPPING'){
   if(!text(line.shipmentGroupId)||shipments.has(line.shipmentGroupId))throw Error('INVOICE_COLLECTION_SHIPMENT_DUPLICATED');
   shipments.add(line.shipmentGroupId);
  }else if(line.type==='BASE'){
   const key=origins[0].orderId+':'+String(line.itemId);
   if(!text(line.itemId)||goods.has(key))throw Error('INVOICE_COLLECTION_ITEM_DUPLICATED');
   goods.add(key);represented.add(origins[0].orderId);
  }
 }
 if(source.collection!==undefined&&members.some(member=>!represented.has(member.orderId)))throw Error('INVOICE_COLLECTION_MEMBER_LINES_MISSING');
}
