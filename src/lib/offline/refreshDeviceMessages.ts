import type {getIntakeMessagesAction} from '@/app/actions/eingang.actions';
import type {PendingDeviceRead} from './pendingStore';
import {captureDeviceReadFence,retainDevicePortResponse} from './devicePortRead';

type Source=Awaited<ReturnType<typeof getIntakeMessagesAction>>;
export type DeviceMessageRefreshPorts={read:()=>Promise<Source>;currentScope:()=>string|null};
type Result={code:'DISABLED'|'STALE'|'SOURCE_INCOMPLETE'}|{code:'STORED';readCount:number};
const running=new Map<string,Promise<Result>>();
/** Same canonical message projection, same scoped cache writer. Only U2
 * metadata survives the formatter; this is not a full-stand completion. */
export async function refreshDeviceMessages(scope:string,enabled:boolean,ports:DeviceMessageRefreshPorts):Promise<Result>{
 if(!enabled)return {code:'DISABLED'};
 const fence=await captureDeviceReadFence(scope,true);
 if(!fence||ports.currentScope()!==scope)return {code:'STALE'};
 const key=scope+':'+fence.loginScope+':'+fence.generation,existing=running.get(key);if(existing)return existing;
 const work=(async():Promise<Result>=>{
  try{
   const read=await ports.read();
   if(ports.currentScope()!==scope)return {code:'STALE'};
   if(read.code!=='OK'||!read.cacheLoginScope||!Number.isFinite(Date.parse(read.serverReadAt)))return {code:'SOURCE_INCOMPLETE'};
   if(read.cacheLoginScope!==fence.loginScope)return {code:'STALE'};
   if(new Set(read.messages.map(row=>row.id)).size!==read.messages.length||read.messages.some(row=>!row.nextActionRule))return {code:'SOURCE_INCOMPLETE'};
   const values:PendingDeviceRead[]=read.messages.map(row=>({port:'message.u2',portVersion:1,objectId:row.id,serverReadAt:read.serverReadAt,serverChangedAt:row.serverChangedAt??null,sourceLoginScope:read.cacheLoginScope!,response:row.nextActionRule!}));
   const stored=await retainDevicePortResponse(scope,true,values,fence,read.serverReadAt,'message.u2');
   return stored.code==='STORED'?{code:'STORED',readCount:values.length}:stored.code==='STALE'?{code:'STALE'}:{code:'SOURCE_INCOMPLETE'};
  }catch(error){console.error('[OFFLINE_MESSAGE_REFRESH_FAILED]',error instanceof Error?error.name:'UnknownError');return {code:'SOURCE_INCOMPLETE'};}
 })();
 running.set(key,work);try{return await work;}finally{if(running.get(key)===work)running.delete(key);}
}
