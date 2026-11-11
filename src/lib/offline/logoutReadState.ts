import {revokePendingShells,readPendingEntries} from './pendingStore';

/** Private reading caches only. Public build assets and every queued original survive. */
export function privateReadCachePrefix(scope:string):string{
 if(!/^[a-f0-9]{64}$/.test(scope))throw Error('OFFLINE_PARTITION_REQUIRED');
 return `kreile-private-${scope}-`;
}
export async function deletePrivateReadCaches(scope:string):Promise<void>{
 const prefix=privateReadCachePrefix(scope);
 if(typeof caches==='undefined')return;
 const names=await caches.keys();
 await Promise.all(names.filter(name=>name.startsWith(prefix)).map(async name=>{
  if(!await caches.delete(name))throw Error('OFFLINE_CACHE_DELETE_NOT_CONFIRMED');
 }));
}
export type LogoutReadState={cacheCleared:boolean;pendingCount:number|null};
/** Called after the real server logout. Local failure can never prevent logout. */
export async function clearLoggedOutReadState(scope:string|null):Promise<LogoutReadState>{
 if(!scope)return {cacheCleared:true,pendingCount:null};
 const results=await Promise.allSettled([
  revokePendingShells(scope),deletePrivateReadCaches(scope),readPendingEntries(scope),
 ]);
 const cacheCleared=results[0].status==='fulfilled'&&results[1].status==='fulfilled';
 if(!cacheCleared)console.error('[OFFLINE_LOGOUT_CACHE_DELETE_FAILED]');
 if(results[2].status==='rejected')console.error('[OFFLINE_LOGOUT_PENDING_READ_FAILED]');
 return {cacheCleared,pendingCount:results[2].status==='fulfilled'?results[2].value.length:null};
}
