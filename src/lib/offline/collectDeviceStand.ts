import type {PendingDeviceRead} from './pendingStore';
import {captureDeviceReadFence,retainDeviceStandResponse,type CollectedDeviceReads,type DeviceReadFence} from './devicePortRead';
import {collectDeviceOrders,collectDeviceCustomers,type DeviceOrderReadPorts,type DeviceCustomerReadPorts} from './collectDeviceLists';
import {collectDeviceQuotes,type DeviceQuoteRefreshPorts} from './refreshDeviceQuotes';
import {collectDeviceMessages,type DeviceMessageRefreshPorts} from './refreshDeviceMessages';
import {collectDeviceToday,type DeviceTodayRefreshPorts} from './refreshDeviceToday';
export type DeviceStandReadPorts={
 orders:Omit<DeviceOrderReadPorts,'currentScope'>;customers:Omit<DeviceCustomerReadPorts,'currentScope'>;
 quotes:Omit<DeviceQuoteRefreshPorts,'currentScope'>;messages:Omit<DeviceMessageRefreshPorts,'currentScope'>;
 today:Omit<DeviceTodayRefreshPorts,'currentScope'>;currentScope:()=>string|null;
};
type SourceName='orders'|'customers'|'quotes'|'messages'|'today';
export type DeviceStandCollection={code:'COLLECTED'|'SOURCE_INCOMPLETE'|'STALE';sources:Array<{source:SourceName;result:CollectedDeviceReads}>;values:PendingDeviceRead[];serverReadAt:string|null};
/** One source pass under the caller's pre-request login/generation fence.
 * This performs no cache mutation and is never a persisted completion stamp.
 * A partial read retains its successful groups; unknown is not an empty list. */
export async function collectDeviceStand(fence:DeviceReadFence,ports:DeviceStandReadPorts):Promise<DeviceStandCollection>{
 const sources:DeviceStandCollection['sources']=[],values:PendingDeviceRead[]=[];
 const stale=():DeviceStandCollection=>({code:'STALE',sources,values,serverReadAt:null});
 const bound={currentScope:ports.currentScope};
 const readers:Array<[SourceName,()=>Promise<CollectedDeviceReads>]>=[
  ['orders',()=>collectDeviceOrders(fence,{...ports.orders,...bound})],
  ['customers',()=>collectDeviceCustomers(fence,{...ports.customers,...bound})],
  ['quotes',()=>collectDeviceQuotes(fence,{...ports.quotes,...bound})],
  ['messages',()=>collectDeviceMessages(fence,{...ports.messages,...bound})],
  ['today',()=>collectDeviceToday(fence,{...ports.today,...bound})],
 ];
 for(const [source,read]of readers){
  if(ports.currentScope()!==fence.scope)return stale();
  let result:CollectedDeviceReads;
  try{result=await read();}catch(error){console.error('[OFFLINE_DEVICE_SOURCE_FAILED]',source,error instanceof Error?error.name:'UnknownError');result={code:'SOURCE_INCOMPLETE'};}
  sources.push({source,result});
  if(ports.currentScope()!==fence.scope||result.code==='STALE')return stale();
  if(result.code==='COLLECTED')values.push(...result.values);
 }
 if(values.some(row=>row.sourceLoginScope!==fence.loginScope))return stale();
 const today=sources.find(row=>row.source==='today')?.result;
 return {code:sources.every(row=>row.result.code==='COLLECTED')?'COLLECTED':'SOURCE_INCOMPLETE',sources,values,serverReadAt:today?.code==='COLLECTED'?today.serverReadAt:null};
}

type RefreshResult={code:'DISABLED'|'STALE'|'SOURCE_INCOMPLETE'|'STORED'};
const refreshing=new Map<string,Promise<RefreshResult>>();
/** Shared login/reconnect/manual refresh. A failed source cannot advance the
 * complete stand, and concurrent starts use the same request-generation fence. */
export async function refreshDeviceStand(scope:string,enabled:boolean,ports:DeviceStandReadPorts):Promise<RefreshResult>{
 if(!enabled)return {code:'DISABLED'};
 try{
  const fence=await captureDeviceReadFence(scope,true);
  if(!fence||ports.currentScope()!==scope)return {code:'STALE'};
  const key=[scope,fence.loginScope,fence.generation].join(':');
  const previous=refreshing.get(key);if(previous)return previous;
  const work=(async():Promise<RefreshResult>=>{
   const collected=await collectDeviceStand(fence,ports);
   if(ports.currentScope()!==scope||collected.code==='STALE')return {code:'STALE'};
   if(collected.code!=='COLLECTED')return {code:'SOURCE_INCOMPLETE'};
   return retainDeviceStandResponse(scope,true,collected,fence);
  })();
  refreshing.set(key,work);try{return await work;}finally{if(refreshing.get(key)===work)refreshing.delete(key);}
 }catch(error){console.error('[OFFLINE_DEVICE_STAND_REFRESH_FAILED]',error instanceof Error?error.name:'UnknownError');return {code:'SOURCE_INCOMPLETE'};}
}
