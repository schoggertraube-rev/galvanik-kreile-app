/** PL13.11.17:50: capability of this browser, never identity or authority. */
export type StoragePersistence='UNKNOWN'|'GRANTED'|'DENIED'|'UNAVAILABLE';
let state:StoragePersistence='UNKNOWN';
let request:Promise<StoragePersistence>|undefined;
const listeners=new Set<()=>void>();
export const readStoragePersistence=()=>state;
export const serverStoragePersistence=():StoragePersistence=>'UNKNOWN';
export function subscribeStoragePersistence(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
/** One request per application start, including concurrent mounts. Browser
 * grants survive application reloads under the platform's own persistence API. */
export function requestStoragePersistence(){
 if(request)return request;
 request=(async()=>{
  try{state=typeof navigator.storage?.persist==='function'?(await navigator.storage.persist()?'GRANTED':'DENIED'):'UNAVAILABLE';}
  catch(error){console.error('[OFFLINE_PERSISTENCE_UNCONFIRMED]',error instanceof Error?error.name:'UnknownError');state='UNAVAILABLE';}
  listeners.forEach(listener=>listener());return state;
 })();
 return request;
}
