/** S03: historical unscoped stores stay in place, unassigned and never replayed. */
export const LEGACY_QUEUE_READ_ONLY='OFFLINE_LEGACY_READ_ONLY';
export function rejectLegacyWrite():never{throw Error(LEGACY_QUEUE_READ_ONLY);}
export function readLegacyStore<T>(name:string,storeName:string):Promise<T[]>{
 return new Promise((resolve,reject)=>{
  let missing=false,abandoned=false;
  const request=indexedDB.open(name);
  // A read must not create an absent database or upgrade/delete old stores.
  request.onupgradeneeded=()=>{missing=true;request.transaction?.abort();};
  request.onblocked=()=>{abandoned=true;reject(Error('OFFLINE_LEGACY_READ_BLOCKED'));};
  request.onerror=()=>missing?resolve([]):reject(request.error??Error('OFFLINE_LEGACY_READ_FAILED'));
  request.onsuccess=()=>{
   const db=request.result;
   if(abandoned){db.close();return;}
   db.onversionchange=()=>db.close();
   if(!db.objectStoreNames.contains(storeName)){db.close();resolve([]);return;}
   const tx=db.transaction(storeName,'readonly'),rows=tx.objectStore(storeName).getAll();
   tx.oncomplete=()=>{db.close();resolve(rows.result as T[]);};
   tx.onabort=()=>{db.close();reject(tx.error??Error('OFFLINE_LEGACY_READ_ABORTED'));};
  };
 });
}
