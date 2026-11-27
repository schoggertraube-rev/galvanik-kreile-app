/** PL06:01: a reading fence only. Never accepted by any server authorization. */
export const CACHE_SCOPE_COOKIE='kreile_offline_cache_scope';
export const CACHE_SCOPE_MAX_AGE_SECONDS=365*24*60*60;
const CACHE_PAUSE_PREFIX='kreile_offline_pause_';
const validScope=/^[a-f0-9]{64}$/;

function cookieValues(name:string,jar=document.cookie):string[]{
 const prefix=name+'=';
 return jar.split(';').map(value=>value.trim()).filter(value=>value.startsWith(prefix)).map(value=>value.slice(prefix.length));
}
function currentScopeMarker(jar=document.cookie):string|null{
 const values=cookieValues(CACHE_SCOPE_COOKIE,jar);
 return values.length===1&&validScope.test(values[0])?values[0]:null;
}
/** A paused marker still owns its caches, but cannot be used to read them. */
export function hasCacheScopeMarker():boolean{
 try{return currentScopeMarker()!==null;}catch{return false;}
}
export function readCacheScopeMarker():string|null{
 try{
  const jar=document.cookie,marker=currentScopeMarker(jar);
  return marker&&cookieValues(CACHE_PAUSE_PREFIX+marker,jar).length===0?marker:null;
 }catch{return null;}
}
function writeCachePause(scope:string,value:string,maxAge:number):void{
 document.cookie=`${CACHE_PAUSE_PREFIX}${scope}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
}
/** Denial is scoped to this login. A different login can never inherit or clear it. */
export function pauseCacheScopeMarker(scope:string):void{
 if(currentScopeMarker()===scope&&cookieValues(CACHE_PAUSE_PREFIX+scope).length===0){
  writeCachePause(scope,'pending',CACHE_SCOPE_MAX_AGE_SECONDS);
 }
}
export function endCacheScopePause(scope:string):void{
 if(currentScopeMarker()===scope)writeCachePause(scope,'ended',CACHE_SCOPE_MAX_AGE_SECONDS);
}
export function resumeCacheScopeMarker(scope:string):boolean{
 try{
  if(currentScopeMarker()!==scope)return false;
  const pauses=cookieValues(CACHE_PAUSE_PREFIX+scope);
  if(pauses.length===1&&pauses[0]==='pending')writeCachePause(scope,'',0);
  return readCacheScopeMarker()===scope;
 }catch{return false;}
}
export function removeCacheScopeMarker():void{
 document.cookie=CACHE_SCOPE_COOKIE+'=; Path=/; Max-Age=0; SameSite=Lax';
}
