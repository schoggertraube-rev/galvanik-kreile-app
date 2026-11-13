import {readCacheScopeMarker} from './cacheScopeMarker';
import {readPendingShellMetadata,retainPendingDeviceRead,readPendingDeviceRead,type PendingDeviceRead} from './pendingStore';

/** ABNAHMEFAELLE S06: metadata only. Keep the online port unchanged and make
 * the deliberately unavailable offline mail body explicit in its read result. */
function metadataForDevice(value:PendingDeviceRead):PendingDeviceRead{
 if(value.port!=='message.u2')return value;
 return {...value,response:{...value.response,
  erstblick:value.response.erstblick.map(field=>field.key==='nachrichten.inhalt'?{...field,werte:Object.fromEntries(Object.entries(field.werte).filter(([key])=>key!=='text'))}:field),
  datenluecken:[...new Set([...value.response.datenluecken,'OFFLINE_MESSAGE_TEXT_NOT_CACHED'])],
 }};
}
/** Consumes the actual canonical U2 metadata response, never the mail/body/blob DTO. */
export async function retainDevicePortResponse(scope:string,enabled:boolean,value:PendingDeviceRead):Promise<{code:'DISABLED'|'STALE'|'STORED'|'SOURCE_INCOMPLETE'}>{
 if(!enabled)return {code:'DISABLED'};
 const login=readCacheScopeMarker();if(!login)return {code:'STALE'};
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
