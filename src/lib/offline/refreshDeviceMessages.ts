import type {getIntakeMessagesAction} from '@/app/actions/eingang.actions';
import type {PendingDeviceRead} from './pendingStore';
import {refreshDevicePortCohort,type CollectedDeviceReads,type DeviceReadFence} from './devicePortRead';
type Source=Awaited<ReturnType<typeof getIntakeMessagesAction>>;
export type DeviceMessageRefreshPorts={read:()=>Promise<Source>;currentScope:()=>string|null};
export async function collectDeviceMessages(fence:DeviceReadFence,ports:DeviceMessageRefreshPorts):Promise<CollectedDeviceReads>{
 const read=await ports.read();if(ports.currentScope()!==fence.scope)return {code:'STALE'};
 if(read.code==='FORBIDDEN'){
  if(!('cacheLoginScope' in read)||!read.cacheLoginScope||!('serverReadAt' in read)||typeof read.serverReadAt!=='string'||!Number.isFinite(Date.parse(read.serverReadAt)))return {code:'SOURCE_INCOMPLETE'};
  if(read.cacheLoginScope!==fence.loginScope)return {code:'STALE'};
  return {code:'COLLECTED',values:[],serverReadAt:read.serverReadAt,denial:{code:'FORBIDDEN',message:read.message}};
 }
 if(read.code!=='OK'||!read.cacheLoginScope||!Number.isFinite(Date.parse(read.serverReadAt)))return {code:'SOURCE_INCOMPLETE'};
 if(read.cacheLoginScope!==fence.loginScope)return {code:'STALE'};
 if(new Set(read.messages.map(row=>row.id)).size!==read.messages.length||read.messages.some(row=>!row.nextActionRule))return {code:'SOURCE_INCOMPLETE'};
 const values:PendingDeviceRead[]=read.messages.map(row=>({port:'message.u2',portVersion:1,objectId:row.id,serverReadAt:read.serverReadAt,serverChangedAt:row.serverChangedAt??null,sourceLoginScope:read.cacheLoginScope!,response:row.nextActionRule!}));
 return {code:'COLLECTED',values,serverReadAt:read.serverReadAt};
}
export async function refreshDeviceMessages(scope:string,enabled:boolean,ports:DeviceMessageRefreshPorts){return refreshDevicePortCohort(scope,enabled,'message.u2',ports.currentScope,fence=>collectDeviceMessages(fence,ports));}
