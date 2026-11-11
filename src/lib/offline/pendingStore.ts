import {canonicalJson} from '@/lib/domain/canonicalJson';
import type {setOrderItemFinishedAction,changeOrderItemExtraWorkAction} from '@/app/actions/orders.actions';
// Unacknowledged originals in one scoped queue. Server remains authoritative.
export type PendingOriginal = ({ id: string; itemId: string; kind: "file"; file: File; deviceId?:string|null; deviceCapturedAt?:string; captureOrigin?: "warenfoto" | "dokument"; context?:{orderId:string;receiptId:string;clientKey:string;photoKind:"uebersicht"|"teile"|"abweichung"} }
  | { id: string; itemId: string; kind: "note"; text: string; textstand: string; dismissed: string[];expectedVersion?:number;deviceCapturedAt?:string;context?:{customerId?:string;orderId?:string} }) & {queueSequence?:number};
export type PendingQuarantine={id:string;kind:"quarantine";capturedAt:string;payload:Record<string,unknown>};
export type PendingWorkshopCommand={command:'item.finished';input:Parameters<typeof setOrderItemFinishedAction>[0]}|{command:'item.extraWork';input:Parameters<typeof changeOrderItemExtraWorkAction>[0]};
export type PendingWorkshopOriginal=PendingWorkshopCommand&{id:string;itemId:string;kind:'workshop';deviceCapturedAt?:string;queueSequence?:number};
export type PendingEntry=PendingOriginal|PendingWorkshopOriginal|PendingQuarantine;
export function isPendingWorkshopOriginal(value:unknown):value is PendingWorkshopOriginal{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const row=value as Record<string,unknown>,input=row.input;
 if(row.kind!=='workshop'||!input||typeof input!=='object'||Array.isArray(input))return false;
 const data=input as Record<string,unknown>,uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
 if(!uuid(data.orderId)||!uuid(data.itemId)||!uuid(data.clientEventId)||row.id!==data.clientEventId||row.itemId!==data.orderId)return false;
 const keys=Object.keys(data).sort().join(',');
 if(row.command==='item.finished')return keys==='clientEventId,expectedVersion,finished,itemId,orderId'&&Number.isSafeInteger(data.expectedVersion)&&typeof data.finished==='boolean';
 return row.command==='item.extraWork'&&keys==='active,catalogPositionId,clientEventId,expectedLineVersion,expectedOrderVersion,itemId,lineId,minutes,orderId'&&uuid(data.lineId)&&uuid(data.catalogPositionId)&&Number.isSafeInteger(data.expectedLineVersion)&&Number.isSafeInteger(data.expectedOrderVersion)&&typeof data.minutes==='number'&&Number.isFinite(data.minutes)&&typeof data.active==='boolean';
}
const STORE = "originals";
const SHELL_STORE = "shellMetadata";
async function database(scope: string): Promise<IDBDatabase> {
  if (!/^[0-9a-f]{64}$/.test(scope)) throw new Error("INTAKE_PENDING_SCOPE_REQUIRED");
  return new Promise((resolve, reject) => {
    let abandoned=false;
    const request = indexedDB.open(`kreile-pending-originals-v1-${scope}`, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
      if (!request.result.objectStoreNames.contains(SHELL_STORE)) request.result.createObjectStore(SHELL_STORE);
    };
    request.onsuccess = () => {if(abandoned){request.result.close();return;}request.result.onversionchange=()=>request.result.close();resolve(request.result);};
    request.onerror = () => reject(new Error("INTAKE_PENDING_STORAGE_UNAVAILABLE"));
    request.onblocked = () => {abandoned=true;reject(new Error("INTAKE_PENDING_STORAGE_BLOCKED"));};
  });
}
export type PendingShellMetadata={scope:string|null;cacheGeneration:number;updatedAt:string};
type ShellRead={code:'EMPTY'}|{code:'QUARANTINE'}|{code:'OK';metadata:PendingShellMetadata};
function shellMetadata(value:unknown,scope:string):value is PendingShellMetadata{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const row=value as Record<string,unknown>;
 return Object.keys(row).length===3&&(row.scope===scope||row.scope===null)&&typeof row.cacheGeneration==='number'&&Number.isSafeInteger(row.cacheGeneration)&&row.cacheGeneration>0&&row.cacheGeneration<Number.MAX_SAFE_INTEGER&&typeof row.updatedAt==='string'&&Number.isFinite(Date.parse(row.updatedAt));
}
function shellKey(loginScope:string):string{if(!/^[0-9a-f]{64}$/.test(loginScope))throw Error('OFFLINE_SHELL_LOGIN_SCOPE_REQUIRED');return 'login:'+loginScope;}
export async function readPendingShellMetadata(scope:string,loginScope:string):Promise<ShellRead>{
 const key=shellKey(loginScope);
 const connection=await database(scope);
 return new Promise((resolve,reject)=>{
  const tx=connection.transaction(SHELL_STORE,'readonly'),read=tx.objectStore(SHELL_STORE).get(key);
  tx.oncomplete=()=>{connection.close();resolve(read.result===undefined?{code:'EMPTY'}:shellMetadata(read.result,loginScope)?{code:'OK',metadata:read.result}:{code:'QUARANTINE'});};
  tx.onabort=()=>{connection.close();reject(Error('OFFLINE_SHELL_METADATA_READ_ABORTED'));};
 });
}
/** CAS invalidates late warm responses; it grants no identity or permission. */
export async function changePendingShellMetadata(scope:string,loginScope:string,expectedGeneration:number|null,active:boolean):Promise<{code:'STALE'|'QUARANTINE'|'REVOKED'}|{code:'OK';metadata:PendingShellMetadata}>{
 const key=shellKey(loginScope);
 const connection=await database(scope);
 return new Promise((resolve,reject)=>{
  const tx=connection.transaction(SHELL_STORE,'readwrite'),store=tx.objectStore(SHELL_STORE),read=store.get(key);
  let result:{code:'STALE'|'QUARANTINE'|'REVOKED'}|{code:'OK';metadata:PendingShellMetadata}={code:'STALE'};
  read.onsuccess=()=>{
   const previous:unknown=read.result;
   if(previous!==undefined&&!shellMetadata(previous,loginScope)){result={code:'QUARANTINE'};return;}
   const generation=previous===undefined?null:(previous as PendingShellMetadata).cacheGeneration;
   if(generation!==expectedGeneration||active&&generation!==null&&generation>=Number.MAX_SAFE_INTEGER-1)return;
   // Revocation is terminal for this exact server-validated login. A stale tab
   // cannot read the new generation and reactivate its old credential's cache.
   if(active&&previous!==undefined&&(previous as PendingShellMetadata).scope===null){result={code:'REVOKED'};return;}
   const metadata={scope:active?loginScope:null,cacheGeneration:Math.min((generation??0)+1,Number.MAX_SAFE_INTEGER-1),updatedAt:new Date().toISOString()};
   store.put(metadata,key);result={code:'OK',metadata};
  };
  tx.oncomplete=()=>{connection.close();resolve(result);};
  tx.onabort=()=>{connection.close();reject(Error('OFFLINE_SHELL_METADATA_WRITE_ABORTED'));};
 });
}
type ShellInventory={entries:Array<{loginScope:string;metadata:PendingShellMetadata}>;quarantined:number};
function shellInventory(keys:IDBValidKey[],values:unknown[]):ShellInventory{
 const result:ShellInventory={entries:[],quarantined:0};
 for(let index=0;index<keys.length;index++){
  const key=keys[index],loginScope=typeof key==='string'&&/^login:[0-9a-f]{64}$/.test(key)?key.slice(6):null;
  if(!loginScope||!shellMetadata(values[index],loginScope)){result.quarantined++;continue;}
  result.entries.push({loginScope,metadata:values[index] as PendingShellMetadata});
 }
 return result;
}
export async function readPendingShellInventory(scope:string):Promise<ShellInventory>{
 const connection=await database(scope);
 return new Promise((resolve,reject)=>{
  const tx=connection.transaction(SHELL_STORE,'readonly'),store=tx.objectStore(SHELL_STORE),keys=store.getAllKeys(),values=store.getAll();
  tx.oncomplete=()=>{connection.close();resolve(shellInventory(keys.result,values.result));};
  tx.onabort=()=>{connection.close();reject(Error('OFFLINE_SHELL_INVENTORY_ABORTED'));};
 });
}
/** One atomic privacy fence for all known cached logins of this actor.
 * Originals and unknown metadata are never deleted or reassigned. */
export async function revokePendingShells(scope:string):Promise<{loginScopes:string[];quarantined:number}>{
 const connection=await database(scope);
 return new Promise((resolve,reject)=>{
  const tx=connection.transaction(SHELL_STORE,'readwrite'),store=tx.objectStore(SHELL_STORE),keys=store.getAllKeys(),values=store.getAll();
  let keysReady=false,valuesReady=false,result:{loginScopes:string[];quarantined:number}={loginScopes:[],quarantined:0};
  const revoke=()=>{
   if(!keysReady||!valuesReady)return;
   const inventory=shellInventory(keys.result,values.result);result={loginScopes:inventory.entries.map(entry=>entry.loginScope),quarantined:inventory.quarantined};
   for(const entry of inventory.entries)if(entry.metadata.scope!==null)store.put({scope:null,cacheGeneration:Math.min(entry.metadata.cacheGeneration+1,Number.MAX_SAFE_INTEGER-1),updatedAt:new Date().toISOString()},shellKey(entry.loginScope));
  };
  keys.onsuccess=()=>{keysReady=true;revoke();};values.onsuccess=()=>{valuesReady=true;revoke();};
  tx.oncomplete=()=>{connection.close();resolve(result);};
  tx.onabort=()=>{connection.close();reject(Error('OFFLINE_SHELL_REVOCATION_ABORTED'));};
 });
}
async function transaction<T>(scope: string, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const connection = await database(scope);
  return new Promise((resolve, reject) => {
    const transaction = connection.transaction(STORE, mode);
    const request = work(transaction.objectStore(STORE));
    transaction.oncomplete = () => { connection.close(); if(mode==="readwrite")window.dispatchEvent(new Event("kreile-pending-changed")); resolve(request.result); };
    transaction.onerror = () => { connection.close(); reject(new Error("INTAKE_PENDING_STORAGE_FAILED")); };
    transaction.onabort = () => { connection.close(); reject(new Error("INTAKE_PENDING_STORAGE_ABORTED")); };
  });
}
export async function retainPendingOriginal(scope: string, original: PendingOriginal): Promise<void> {
 return retainOriginal(scope,original);
}
/** Same store and sequence as files/notes; the N5 key and original intent cannot change. */
export async function retainPendingWorkshopOriginal(scope:string,original:PendingWorkshopOriginal):Promise<void>{
 if(!isPendingWorkshopOriginal(original))throw Error('OFFLINE_WORKSHOP_ORIGINAL_INVALID');
 return retainOriginal(scope,original);
}
async function retainOriginal(scope:string,original:PendingOriginal|PendingWorkshopOriginal):Promise<void>{
 const connection=await database(scope);
 return new Promise((resolve,reject)=>{
  const tx=connection.transaction(STORE,"readwrite"),store=tx.objectStore(STORE),read=store.get(original.id);
  read.onsuccess=()=>{const previous=read.result as PendingOriginal|PendingWorkshopOriginal|undefined;
   if(original.kind==='workshop'&&previous){
    if(!isPendingWorkshopOriginal(previous)||previous.command!==original.command||canonicalJson(previous.input)!==canonicalJson(original.input)){tx.abort();return;}
    store.put(previous);return;
   }
   const same=original.kind==='file'?previous?.kind==='file':original.kind==='note'&&previous?.kind==='note'&&previous.textstand===original.textstand;
   const deviceCapturedAt=same?previous?.deviceCapturedAt:new Date().toISOString();
   const expectedVersion=same&&previous?.kind==='note'?previous.expectedVersion:original.kind==='note'?original.expectedVersion:undefined;
   if(previous&&previous.kind!==original.kind){tx.abort();return;}
   // The first file is the original. A retry must never replace its bytes or
   // provenance while it still awaits the server receipt.
   if(original.kind==='file'&&previous?.kind==='file'){store.put(previous);return;}
   const value={...original};delete value.deviceCapturedAt;
   if(value.kind==='note'){delete value.expectedVersion;if(expectedVersion!==undefined)value.expectedVersion=expectedVersion;}
   if(deviceCapturedAt)value.deviceCapturedAt=deviceCapturedAt;
   // Assign order in the same serialized IDB transaction as the original.
   // Device clocks can tie or move backwards; UUID order is not capture order.
   if(same){if(previous?.queueSequence!==undefined)value.queueSequence=previous.queueSequence;else delete value.queueSequence;store.put(value);return;}
   const queued=store.getAll();queued.onsuccess=()=>{
    const maximum=(queued.result as Array<{queueSequence?:unknown}>).reduce((max,row)=>typeof row.queueSequence==='number'&&Number.isSafeInteger(row.queueSequence)&&row.queueSequence>max?row.queueSequence:max,0);
    if(maximum>=Number.MAX_SAFE_INTEGER){tx.abort();return;}
    value.queueSequence=maximum+1;store.put(value);
   };};
  tx.oncomplete=()=>{connection.close();window.dispatchEvent(new Event("kreile-pending-changed"));resolve();};
  tx.onabort=()=>{connection.close();reject(new Error("INTAKE_PENDING_STORAGE_ABORTED"));};
 });
}
// IDB keys can be numbers, dates, binary values or arrays. An unknown legacy
// row must not make real originals in the same store unreadable.
function quarantineKey(key:unknown):string{
 if(typeof key==='string')return 'string:'+JSON.stringify(key);
 if(typeof key==='number'&&!Number.isNaN(key))return 'number:'+String(key);
 if(key instanceof Date&&Number.isFinite(key.getTime()))return 'date:'+key.toISOString();
 if(Array.isArray(key))return 'array:'+JSON.stringify(key.map(quarantineKey));
 if(key instanceof ArrayBuffer||ArrayBuffer.isView(key)){const bytes=key instanceof ArrayBuffer?new Uint8Array(key):new Uint8Array(key.buffer,key.byteOffset,key.byteLength);return 'binary:'+Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');}
 throw Error('INTAKE_PENDING_MALFORMED_KEY');
}
export async function readPendingEntries(scope:string):Promise<PendingEntry[]> {
 const rows=await transaction<unknown[]>(scope,"readonly",store=>store.getAll());
 return rows.map(value=>{
  if(!value||typeof value!=="object"||Array.isArray(value)||!("id" in value))throw new Error("INTAKE_PENDING_MALFORMED_ENTRY");
  const row=value as Record<string,unknown>;
  const original=row as unknown as PendingOriginal;
  const projectedId="quarantine:"+quarantineKey(row.id);
  const isOriginal=typeof row.id==='string'&&typeof row.itemId==="string"&&(row.kind==="note"&&typeof row.text==="string"&&typeof row.textstand==="string"&&Array.isArray(row.dismissed)&&row.dismissed.every(item=>typeof item==="string")||row.kind==="file"&&typeof row.file==="object"&&row.file!==null&&typeof (row.file as File).arrayBuffer==="function"&&typeof (row.file as File).name==="string");
  if(isOriginal)return original;
  if(isPendingWorkshopOriginal(row))return row;
  if(row.kind==="quarantine"&&typeof row.capturedAt==="string"&&row.payload&&typeof row.payload==="object"&&!Array.isArray(row.payload))return {...row,id:projectedId} as unknown as PendingQuarantine;
  // Read-only quarantine projection: preserve the exact unknown record in its original store.
  return {id:projectedId,kind:"quarantine",capturedAt:"",payload:row};
 });
}
export async function retainQuarantinedPending(scope:string,entry:PendingQuarantine):Promise<void>{await transaction(scope,"readwrite",store=>store.put(entry));}
export async function readPendingOriginals(scope: string): Promise<PendingOriginal[]> {return (await readPendingEntries(scope)).filter((entry):entry is PendingOriginal=>entry.kind==="file"||entry.kind==="note");}
export async function acknowledgePendingOriginal(scope: string, id: string, textstand?: string): Promise<void> {
  const connection = await database(scope);
  return new Promise((resolve, reject) => {
    const transaction = connection.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const request = store.get(id);
    request.onsuccess = () => {
      const original = request.result as PendingOriginal | undefined;
      if (!original || (original.kind!=="file"&&original.kind!=="note") || textstand && (original.kind !== "note" || original.textstand !== textstand)) return;
      store.delete(id);
    };
    transaction.oncomplete = () => { connection.close(); window.dispatchEvent(new Event("kreile-pending-changed")); resolve(); };
    transaction.onerror = () => { connection.close(); reject(new Error("INTAKE_PENDING_ACK_FAILED")); };
    transaction.onabort = () => { connection.close(); reject(new Error("INTAKE_PENDING_ACK_ABORTED")); };
  });
}
