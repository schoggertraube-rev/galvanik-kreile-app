import type {getOrdersDb,getLiveOrderCardAction} from '@/app/actions/orders.actions';
import type {getCustomersDb,getCustomerSummaryAction} from '@/app/actions/customers.actions';
import type {PendingDeviceRead} from './pendingStore';
import type {CollectedDeviceReads,DeviceReadFence} from './devicePortRead';
type Orders=Awaited<ReturnType<typeof getOrdersDb>>;
type Customers=Awaited<ReturnType<typeof getCustomersDb>>;
export type DeviceOrderReadPorts={list:()=>Promise<Orders>;read:(id:string)=>ReturnType<typeof getLiveOrderCardAction>;currentScope:()=>string|null};
export type DeviceCustomerReadPorts={list:()=>Promise<Customers>;read:(id:string)=>ReturnType<typeof getCustomerSummaryAction>;currentScope:()=>string|null};
function identity(fence:DeviceReadFence,source:{serverReadAt?:string;cacheLoginScope?:string}){
 if(!source.serverReadAt||!source.cacheLoginScope||!Number.isFinite(Date.parse(source.serverReadAt)))return 'SOURCE_INCOMPLETE' as const;
 return source.cacheLoginScope===fence.loginScope?'OK' as const:'STALE' as const;
}
/** Actual canonical list/card replies only; no cache writes, no new status or
 * right calculation, and no full-stand completion stamp. */
export async function collectDeviceOrders(fence:DeviceReadFence,ports:DeviceOrderReadPorts):Promise<CollectedDeviceReads>{
 const list=await ports.list();if(ports.currentScope()!==fence.scope)return {code:'STALE'};
 if(!list.ok&&list.error!=='FORBIDDEN')return {code:'SOURCE_INCOMPLETE'};
 const bound=identity(fence,list);if(bound!=='OK')return {code:bound};
 const values:PendingDeviceRead[]=[{port:'orders.list',portVersion:1,objectId:'orders',serverReadAt:list.serverReadAt!,sourceLoginScope:list.cacheLoginScope!,response:{result:list.ok?{ok:true,data:list.data}:{ok:false,error:list.error,message:list.message},datenluecken:[]}}];
 if(list.ok){
  if(new Set(list.data.map(row=>row.id)).size!==list.data.length)return {code:'SOURCE_INCOMPLETE'};
  for(const row of list.data){
   if(ports.currentScope()!==fence.scope)return {code:'STALE'};
   const read=await ports.read(row.id);
   if(read.code!=='OK'||!read.data.nextActionRule||read.data.card.id!==row.id||read.data.card.customerId!==row.customerId||read.data.card.version!==row.version)return {code:'SOURCE_INCOMPLETE'};
   const same=identity(fence,read.data);if(same!=='OK')return {code:same};
   values.push({port:'order.u2',portVersion:1,objectId:row.id,serverReadAt:read.data.serverReadAt!,sourceLoginScope:read.data.cacheLoginScope!,serverChangedAt:row.serverChangedAt??null,response:read.data.nextActionRule});
  }
 }
 if(ports.currentScope()!==fence.scope)return {code:'STALE'};
 return {code:'COLLECTED',values,serverReadAt:list.serverReadAt!};
}
export async function collectDeviceCustomers(fence:DeviceReadFence,ports:DeviceCustomerReadPorts):Promise<CollectedDeviceReads>{
 const list=await ports.list();if(ports.currentScope()!==fence.scope)return {code:'STALE'};
 if(!list.ok&&list.error!=='FORBIDDEN')return {code:'SOURCE_INCOMPLETE'};
 const bound=identity(fence,list);if(bound!=='OK')return {code:bound};
 const values:PendingDeviceRead[]=[{port:'customers.list',portVersion:1,objectId:'customers',serverReadAt:list.serverReadAt!,sourceLoginScope:list.cacheLoginScope!,response:{result:list.ok?{ok:true,data:list.data}:{ok:false,error:list.error,message:list.message},datenluecken:[]}}];
 if(list.ok){
  if(new Set(list.data.map(row=>row.id)).size!==list.data.length)return {code:'SOURCE_INCOMPLETE'};
  for(const row of list.data){
   if(ports.currentScope()!==fence.scope)return {code:'STALE'};
   const read=await ports.read(row.id);
   if(read.code!=='OK'||!read.data.nextActionRule||read.data.id!==row.id)return {code:'SOURCE_INCOMPLETE'};
   const same=identity(fence,read);if(same!=='OK')return {code:same};
   values.push({port:'customer.u2',portVersion:1,objectId:row.id,serverReadAt:read.serverReadAt!,sourceLoginScope:read.cacheLoginScope!,serverChangedAt:read.data.updatedAt,response:read.data.nextActionRule});
  }
 }
 if(ports.currentScope()!==fence.scope)return {code:'STALE'};
 return {code:'COLLECTED',values,serverReadAt:list.serverReadAt!};
}
