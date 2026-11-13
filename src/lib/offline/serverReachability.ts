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
  const offline=()=>{if(disposed)return;if(reachable){reachable=false;publish();}schedule();};
  async function observe(input:RequestInfo|URL,init?:RequestInit){
   const parent=init?.signal??(input instanceof Request?input.signal:null);
   // PL18:25: slow work is not failure. Do not replace its signal, body,
   // keepalive or deadline; independently check reachability after eight seconds.
   const deadline=setTimeout(()=>{if(reachable)void heartbeat();},8_000);
   try{
    const response=await original.call(window,input,init);
    if([502,503,504].includes(response.status))offline();
    return response;
   }catch(error){if(!parent?.aborted)offline();throw error;}
   finally{clearTimeout(deadline);}
  }
  async function heartbeat(){
   if(disposed||pinging)return;
   if(!navigator.onLine){offline();schedule();return;}
   pinging=true;
   // Only this no-data health request owns a timeout. Its failure may change
   // the transport fact; it never cancels the application request that caused it.
   const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),8_000);
   try{
    const response=await original.call(window,'/api/offline/heartbeat',{method:'GET',cache:'no-store',credentials:'same-origin',signal:controller.signal});
    // An expired login is still a confirmed server response (PL16:05).
    // It must permit the existing PIN path, never grant authorization itself.
    if(!disposed&&navigator.onLine&&(response.ok||[400,401,403,409,422].includes(response.status))){const changed=!reachable;reachable=true;if(timer){clearTimeout(timer);timer=undefined;}if(changed)publish();}
    else offline();
   }catch(error){offline();console.error('[OFFLINE_HEARTBEAT_UNAVAILABLE]',error instanceof Error?error.name:'UnknownError');}
   finally{clearTimeout(deadline);pinging=false;schedule();}
  }
  const wrapped:typeof fetch=(input,init)=>{
   const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,window.location.href);
   return url.origin===window.location.origin?observe(input,init):original.call(window,input,init);
  };
  const browserOnline=()=>{void heartbeat();};
  window.fetch=wrapped;
  window.addEventListener('offline',offline);window.addEventListener('online',browserOnline);
  if(!navigator.onLine)offline();else if(!reachable)void heartbeat();
  stop=()=>{disposed=true;if(timer)clearTimeout(timer);window.removeEventListener('offline',offline);window.removeEventListener('online',browserOnline);if(window.fetch===wrapped)window.fetch=original;};
 }
 return()=>{owners--;if(owners===0){stop?.();stop=undefined;}};
}
