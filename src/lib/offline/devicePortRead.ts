import {readCacheScopeMarker} from './cacheScopeMarker';
import {readPendingShellMetadata,retainPendingDeviceRead,readPendingDeviceRead,type PendingDeviceRead} from './pendingStore';

export type DeviceReadFence={scope:string;loginScope:string;generation:number};
/** Capture before requesting the server. A response must not adopt a newer
 * generation when logout and login happen while the request is in flight. */
export async function captureDeviceReadFence(scope:string,enabled:boolean):Promise<DeviceReadFence|null>{
 if(!enabled)return null;
 const login=readCacheScopeMarker();if(!login)return null;
 try{
  const shell=await readPendingShellMetadata(scope,login);
  return shell.code==='OK'&&shell.metadata.scope===login?{scope,loginScope:login,generation:shell.metadata.cacheGeneration}:null;
 }catch(error){console.error('[OFFLINE_DEVICE_FENCE_FAILED]',error instanceof Error?error.name:'UnknownError');return null;}
}

/** ABNAHMEFAELLE S06: metadata only. Keep the online port unchanged and make
 * the deliberately unavailable offline mail body explicit in its read result. */
function messageMetadata(read:import('@/lib/domain/u2ReadContract').U2Read){
 return {...read,erstblick:read.erstblick.map(field=>field.key==='nachrichten.inhalt'?{...field,werte:Object.fromEntries(Object.entries(field.werte).filter(([key])=>key!=='text'))}:field),datenluecken:[...new Set([...read.datenluecken,'OFFLINE_MESSAGE_TEXT_NOT_CACHED'])]};
}
function metadataForDevice(value:PendingDeviceRead):PendingDeviceRead{
 if(value.port==='customers.list'){
  if(!value.response.result.ok)return value;
  return {...value,response:{result:{ok:true,data:value.response.result.data.map(customer=>({...customer,imageUrls:[]}))},datenluecken:[...new Set([...value.response.datenluecken,'OFFLINE_PHOTO_NOT_CACHED'])]}};
 }
 if(value.port==='orders.list'){
  if(!value.response.result.ok)return value;
  return {...value,response:{result:{ok:true,data:value.response.result.data.map(order=>({...order,parts:order.parts.map(part=>({...part,photo:null,photoIds:null}))}))},datenluecken:[...new Set([...value.response.datenluecken,'OFFLINE_PHOTO_NOT_CACHED'])]}};
 }
 if(value.port==='today.u3')return {...value,response:{...value.response,...(value.response.messageActions?{messageActions:{...value.response.messageActions,rows:value.response.messageActions.rows.map(row=>({...row,read:messageMetadata(row.read)}))}}:{})}};
 if(value.port!=='message.u2')return value;
 return {...value,response:messageMetadata(value.response)};
}
/** Consumes the actual canonical U2 metadata response, never the mail/body/blob DTO. */
export async function retainDevicePortResponse(scope:string,enabled:boolean,value:PendingDeviceRead|PendingDeviceRead[],fence?:DeviceReadFence|null,replaceSnapshotAt?:string,replacePort:'quote.u2'|'message.u2'='quote.u2'):Promise<{code:'DISABLED'|'STALE'|'STORED'|'SOURCE_INCOMPLETE'}>{
 if(!enabled)return {code:'DISABLED'};
 const login=readCacheScopeMarker();if(!login)return {code:'STALE'};
 if(fence!==undefined){
  if(!fence||fence.scope!==scope||fence.loginScope!==login)return {code:'STALE'};
  try{return await retainPendingDeviceRead(scope,login,fence.generation,Array.isArray(value)?value.map(metadataForDevice):metadataForDevice(value),replaceSnapshotAt===undefined?undefined:{port:replacePort,serverReadAt:replaceSnapshotAt});}
  catch(error){console.error('[OFFLINE_DEVICE_PORT_WRITE_FAILED]',error instanceof Error?error.name:'UnknownError');return {code:'SOURCE_INCOMPLETE'};}
 }
 if(Array.isArray(value)||replaceSnapshotAt!==undefined)return {code:'STALE'};
 try{
  const shell=await readPendingShellMetadata(scope,login);
  if(shell.code!=='OK'||shell.metadata.scope!==login)return {code:'STALE'};
  return await retainPendingDeviceRead(scope,login,shell.metadata.cacheGeneration,metadataForDevice(value));
 }catch(error){console.error('[OFFLINE_DEVICE_PORT_WRITE_FAILED]',error instanceof Error?error.name:'UnknownError');return {code:'SOURCE_INCOMPLETE'};}
}

/** The same response stays readable after 24 h; age limits writing, not reading. */
export async function readDevicePortResponse(scope:string,enabled:boolean,target:Pick<PendingDeviceRead,'port'|'objectId'>){
 if(!enabled)return {code:'DISABLED' as const};
 const login=readCacheScopeMarker();if(!login)return {code:'STALE' as const};
 try{
  const shell=await readPendingShellMetadata(scope,login);
  if(shell.code!=='OK'||shell.metadata.scope!==login)return {code:'STALE' as const};
  return await readPendingDeviceRead(scope,login,shell.metadata.cacheGeneration,target);
 }catch(error){console.error('[OFFLINE_DEVICE_PORT_READ_FAILED]',error instanceof Error?error.name:'UnknownError');return {code:'SOURCE_INCOMPLETE' as const};}
}

export type CollectedDeviceReads={code:'COLLECTED';values:PendingDeviceRead[];serverReadAt:string}|{code:'STALE'|'SOURCE_INCOMPLETE'};
type CohortResult={code:'DISABLED'|'STALE'|'SOURCE_INCOMPLETE'}|{code:'STORED';readCount:number};
const refreshingCohorts=new Map<string,Promise<CohortResult>>();
/** One request-generation fence, coalescer and existing cache writer for all
 * current domain refresh callers. Collection does not itself commit or mark
 * a whole multi-domain stand complete. */
export async function refreshDevicePortCohort(scope:string,enabled:boolean,port:'quote.u2'|'message.u2'|'today.u3',currentScope:()=>string|null,collect:(fence:DeviceReadFence)=>Promise<CollectedDeviceReads>):Promise<CohortResult>{
 if(!enabled)return {code:'DISABLED'};
 const fence=await captureDeviceReadFence(scope,true);if(!fence||currentScope()!==scope)return {code:'STALE'};
 const key=[port,scope,fence.loginScope,fence.generation].join(':');
 const existing=refreshingCohorts.get(key);if(existing)return existing;
 const work=(async():Promise<CohortResult>=>{
  try{
   const collected=await collect(fence);if(collected.code!=='COLLECTED')return collected;
   if(currentScope()!==scope)return {code:'STALE'};
   if(collected.values.some(row=>row.port!==port)||port==='today.u3'&&collected.values.length!==1)return {code:'SOURCE_INCOMPLETE'};
   const stored=port==='today.u3'
    ?await retainDevicePortResponse(scope,true,collected.values[0],fence)
    :await retainDevicePortResponse(scope,true,collected.values,fence,collected.serverReadAt,port);
   return stored.code==='STORED'?{code:'STORED',readCount:collected.values.length}:stored.code==='STALE'?{code:'STALE'}:{code:'SOURCE_INCOMPLETE'};
  }catch(error){console.error('[OFFLINE_DEVICE_REFRESH_FAILED]',port,error instanceof Error?error.name:'UnknownError');return {code:'SOURCE_INCOMPLETE'};}
 })();
 refreshingCohorts.set(key,work);try{return await work;}finally{if(refreshingCohorts.get(key)===work)refreshingCohorts.delete(key);}
}
