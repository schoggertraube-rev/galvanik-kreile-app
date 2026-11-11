/** PL06:01: a reading fence only. Never accepted by any server authorization. */
export const CACHE_SCOPE_COOKIE='kreile_offline_cache_scope';
export function readCacheScopeMarker():string|null{
 try{
  const values=document.cookie.split(';').map(value=>value.trim()).filter(value=>value.startsWith(CACHE_SCOPE_COOKIE+'='));
  if(values.length!==1)return null;
  const scope=values[0].slice(CACHE_SCOPE_COOKIE.length+1);
  return /^[a-f0-9]{64}$/.test(scope)?scope:null;
 }catch{return null;}
}
export function removeCacheScopeMarker():void{
 document.cookie=CACHE_SCOPE_COOKIE+'=; Path=/; Max-Age=0; SameSite=Lax';
}
