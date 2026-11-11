import {readCacheScopeMarker} from './cacheScopeMarker';
import {readPendingShellMetadata,changePendingShellMetadata} from './pendingStore';
import {privateReadCachePrefix} from './logoutReadState';

export function qualifiedPrivateCacheName(scope:string,loginScope:string,generation:number):string{
 if(!/^[a-f0-9]{64}$/.test(loginScope)||!Number.isSafeInteger(generation)||generation<1)throw Error('OFFLINE_CACHE_IDENTITY_INVALID');
 return privateReadCachePrefix(scope)+loginScope+'-'+generation;
}
/** Retry failed deletion before any cached content is considered. Originals are in IDB. */
export async function clearUnmarkedPrivateCaches():Promise<void>{
 if(readCacheScopeMarker()||typeof caches==='undefined')return;
 const known=/^kreile-private-[a-f0-9]{64}-[a-f0-9]{64}-[1-9][0-9]*$/;
 for(const name of await caches.keys())if(known.test(name)&&!await caches.delete(name)&&(await caches.keys()).includes(name))throw Error('OFFLINE_CACHE_DELETE_NOT_CONFIRMED');
}
/** The sole read seam for scoped private responses; no broad caches.match fallback. */
export async function readScopedPrivateResponse(scope:string,loginScope:string,request:RequestInfo|URL):Promise<Response|null>{
 const input=request instanceof Request?request:null;
 let url:URL;
 try{url=new URL(input?input.url:String(request),window.location.origin);}catch{return null;}
 if(url.origin!==window.location.origin||input&&(input.method!=='GET'||input.headers.has('authorization')||input.headers.has('rsc')||input.headers.has('next-router-state-tree'))||/^\/(?:api|auth|start|login)(?:\/|$)/.test(url.pathname)||url.searchParams.has('_rsc'))return null;
 if(readCacheScopeMarker()!==loginScope){
  try{await clearUnmarkedPrivateCaches();}catch{console.error('[OFFLINE_START_CACHE_DELETE_FAILED]');}
  return null;
 }
 try{
  const state=await readPendingShellMetadata(scope,loginScope);
  if(state.code!=='OK'||state.metadata.scope!==loginScope)return null;
  const name=qualifiedPrivateCacheName(scope,loginScope,state.metadata.cacheGeneration);
  // Opening a missing cache would create a replacement truth; only read existing.
  if(!(await caches.keys()).includes(name))return null;
  if(readCacheScopeMarker()!==loginScope)return null;
  const response=await caches.match(request,{cacheName:name});
  if(response&&(!response.ok||response.redirected||!/^text\/html(?:;|$)/i.test(response.headers.get('content-type')??'')))return null;
  const current=await readPendingShellMetadata(scope,loginScope);
  if(readCacheScopeMarker()!==loginScope||current.code!=='OK'||current.metadata.scope!==loginScope||current.metadata.cacheGeneration!==state.metadata.cacheGeneration)return null;
  return response??null;
 }catch{console.error('[OFFLINE_PRIVATE_CACHE_READ_BLOCKED]');return null;}
}

/** Store only actual authenticated HTML returned by the existing application route.
 * The readable marker is a fence, never authority: the response must independently
 * carry the exact server bootstrap identity and enabled flag before storage.
 */
export async function warmScopedPrivateResponse(scope:string,loginScope:string,url:URL):Promise<boolean>{
 if(!/^[a-f0-9]{64}$/.test(scope)||readCacheScopeMarker()!==loginScope||url.origin!==window.location.origin||url.search!==''||/^\/(?:api|auth|start|login)(?:\/|$)/.test(url.pathname))return false;
 try{
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{Accept:'text/html'}});
  if(!response.ok||response.redirected||!/^text\/html(?:;|$)/i.test(response.headers.get('content-type')??''))return false;
  const document=new DOMParser().parseFromString(await response.clone().text(),'text/html');
  const root=document.documentElement;
  if(root.dataset.authStatus!=='authenticated'||root.getAttribute('data-offline-24h')!=='enabled'||root.dataset.offlineScope!==scope||root.dataset.offlineLoginScope!==loginScope||readCacheScopeMarker()!==loginScope)return false;
  let state=await readPendingShellMetadata(scope,loginScope);
  if(state.code==='EMPTY'){
   const activated=await changePendingShellMetadata(scope,loginScope,null,true);
   if(activated.code!=='OK')return false;
   state={code:'OK',metadata:activated.metadata};
  }
  if(state.code!=='OK'||state.metadata.scope!==loginScope||readCacheScopeMarker()!==loginScope)return false;
  const name=qualifiedPrivateCacheName(scope,loginScope,state.metadata.cacheGeneration);
  const cache=await caches.open(name);
  await cache.put(url,response);
  const current=await readPendingShellMetadata(scope,loginScope);
  if(readCacheScopeMarker()!==loginScope||current.code!=='OK'||current.metadata.scope!==loginScope||current.metadata.cacheGeneration!==state.metadata.cacheGeneration){await caches.delete(name);return false;}
  return true;
 }catch{console.error('[OFFLINE_PRIVATE_CACHE_WARM_FAILED]');return false;}
}
