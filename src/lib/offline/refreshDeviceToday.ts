import type {getTodayDeviceAction} from '@/app/actions/today.actions';
import {captureDeviceReadFence,retainDevicePortResponse} from './devicePortRead';
type Source=Awaited<ReturnType<typeof getTodayDeviceAction>>;
type Result={code:'DISABLED'|'STALE'|'SOURCE_INCOMPLETE'|'STORED'};
const running=new Map<string,Promise<Result>>();
/** Same U3 reader and cache writer; no second dashboard or full-stand stamp. */
export async function refreshDeviceToday(scope:string,enabled:boolean,ports:{read:()=>Promise<Source>;currentScope:()=>string|null}):Promise<Result>{
 if(!enabled)return {code:'DISABLED'};
 const fence=await captureDeviceReadFence(scope,true);if(!fence||ports.currentScope()!==scope)return {code:'STALE'};
 const key=scope+':'+fence.loginScope+':'+fence.generation,existing=running.get(key);if(existing)return existing;
 const work=(async():Promise<Result>=>{
  try{
   const read=await ports.read();if(ports.currentScope()!==scope)return {code:'STALE'};
   if(read.code!=='OK'||!read.cacheLoginScope||!Number.isFinite(Date.parse(read.serverReadAt)))return {code:'SOURCE_INCOMPLETE'};
   return await retainDevicePortResponse(scope,true,{port:'today.u3',portVersion:1,objectId:'today',serverReadAt:read.serverReadAt,sourceLoginScope:read.cacheLoginScope,response:read.dashboard},fence);
  }catch(error){console.error('[OFFLINE_TODAY_REFRESH_FAILED]',error instanceof Error?error.name:'UnknownError');return {code:'SOURCE_INCOMPLETE'};}
 })();
 running.set(key,work);try{return await work;}finally{if(running.get(key)===work)running.delete(key);}
}
