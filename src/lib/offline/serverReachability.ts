/** PL13.11.16:05: one transport fact, not an authorization or session lease. */
const listeners=new Set<()=>void>();
let reachable=true;
let owners=0;
let stop:(()=>void)|undefined;
export function readServerReachability(){return typeof navigator==='undefined'||navigator.onLine&&reachable;}
export function subscribeServerReachability(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export const serverReachabilitySnapshot=()=>true;
/** The transport observer settles its fact before an online reader rejects.
 * Preserve business/auth failures; only a real offline fact selects the cache. */
export async function readWithDeviceFallback<T>(online:()=>Promise<T>,device:()=>Promise<T>,enabled:boolean):Promise<T>{
 if(enabled&&!readServerReachability())return device();
 try{return await online();}
 catch(error){if(enabled&&!readServerReachability())return device();throw error;}
}

/** Root SyncProvider owns this observer. Normal requests may mark a failure;
 * only the lightweight no-store heartbeat may clear it. */
export function installServerReachability(){
 owners++;
 if(owners===1){
  const original=window.fetch;
  let disposed=false,timer:ReturnType<typeof setTimeout>|undefined,pinging=false;
  const publish=()=>listeners.forEach(listener=>listener());
  const schedule=()=>{if(!disposed&&!reachable&&!timer)timer=setTimeout(()=>{timer=undefined;void heartbeat();},30_000);};
  const offline=()=>{if(reachable){reachable=false;publish();}schedule();};
  async function bounded(input:RequestInfo|URL,init?:RequestInit){
   const controller=new AbortController(),parent=init?.signal??(input instanceof Request?input.signal:null);
   let expired=false;
   const abort=()=>controller.abort(parent?.reason);
   if(parent?.aborted)abort();else parent?.addEventListener('abort',abort,{once:true});
   const deadline=setTimeout(()=>{expired=true;controller.abort();},8_000);
   try{
    const response=await original.call(window,input,{...init,signal:controller.signal});
    if([502,503,504].includes(response.status))offline();
    return response;
   }catch(error){if(expired||!parent?.aborted)offline();throw error;}
   finally{clearTimeout(deadline);parent?.removeEventListener('abort',abort);}
  }
  async function heartbeat(){
   if(disposed||pinging)return;
   if(!navigator.onLine){offline();schedule();return;}
   pinging=true;
   try{
    const response=await bounded('/api/offline/heartbeat',{method:'GET',cache:'no-store',credentials:'same-origin'});
    // An expired login is still a confirmed server response (PL16:05).
    // It must permit the existing PIN path, never grant authorization itself.
    if(!disposed&&navigator.onLine&&(response.ok||[400,401,403,409,422].includes(response.status))){const changed=!reachable;reachable=true;if(timer){clearTimeout(timer);timer=undefined;}if(changed)publish();}
   }catch(error){console.error('[OFFLINE_HEARTBEAT_UNAVAILABLE]',error instanceof Error?error.name:'UnknownError');}
   finally{pinging=false;schedule();}
  }
  const wrapped:typeof fetch=(input,init)=>{
   const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,window.location.href);
   return url.origin===window.location.origin?bounded(input,init):original.call(window,input,init);
  };
  const browserOnline=()=>{void heartbeat();};
  window.fetch=wrapped;
  window.addEventListener('offline',offline);window.addEventListener('online',browserOnline);
  if(!navigator.onLine)offline();else if(!reachable)void heartbeat();
  stop=()=>{disposed=true;if(timer)clearTimeout(timer);window.removeEventListener('offline',offline);window.removeEventListener('online',browserOnline);if(window.fetch===wrapped)window.fetch=original;};
 }
 return()=>{owners--;if(owners===0){stop?.();stop=undefined;}};
}
