import type {getTodayDeviceAction} from '@/app/actions/today.actions';
import {refreshDevicePortCohort,type CollectedDeviceReads,type DeviceReadFence} from './devicePortRead';
type Source=Awaited<ReturnType<typeof getTodayDeviceAction>>;
export type DeviceTodayRefreshPorts={read:()=>Promise<Source>;currentScope:()=>string|null};
export async function collectDeviceToday(fence:DeviceReadFence,ports:DeviceTodayRefreshPorts):Promise<CollectedDeviceReads>{
 const read=await ports.read();if(ports.currentScope()!==fence.scope)return {code:'STALE'};
 if(read.code!=='OK'||!read.cacheLoginScope||!Number.isFinite(Date.parse(read.serverReadAt)))return {code:'SOURCE_INCOMPLETE'};
 if(read.cacheLoginScope!==fence.loginScope)return {code:'STALE'};
 return {code:'COLLECTED',values:[{port:'today.u3',portVersion:1,objectId:'today',serverReadAt:read.serverReadAt,sourceLoginScope:read.cacheLoginScope,response:read.dashboard}],serverReadAt:read.serverReadAt};
}
export async function refreshDeviceToday(scope:string,enabled:boolean,ports:DeviceTodayRefreshPorts){return refreshDevicePortCohort(scope,enabled,'today.u3',ports.currentScope,fence=>collectDeviceToday(fence,ports));}
