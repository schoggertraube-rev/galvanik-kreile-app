// Only unacknowledged uploads, as specified by eingang.geraete. Server remains authoritative.
export type PendingOriginal = ({ id: string; itemId: string; kind: "file"; file: File; deviceId?:string|null; deviceCapturedAt?:string; captureOrigin?: "warenfoto" | "dokument"; context?:{orderId:string;receiptId:string;clientKey:string;photoKind:"uebersicht"|"teile"|"abweichung"} }
  | { id: string; itemId: string; kind: "note"; text: string; textstand: string; dismissed: string[];expectedVersion?:number;deviceCapturedAt?:string;context?:{customerId?:string;orderId?:string} }) & {queueSequence?:number};
export type PendingQuarantine={id:string;kind:"quarantine";capturedAt:string;payload:Record<string,unknown>};
export type PendingEntry=PendingOriginal|PendingQuarantine;
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
 return Object.keys(row).length===3&&(row.scope===scope||row.scope===null)&&typeof row.cacheGeneration==='number'&&Number.isSafeInteger(row.cacheGeneration)&&row.cacheGeneration>0&&typeof row.updatedAt==='string'&&Number.isFinite(Date.parse(row.updatedAt));
}
export async function readPendingShellMetadata(scope:string):Promise<ShellRead>{
 const connection=await database(scope);
 return new Promise((resolve,reject)=>{
  const tx=connection.transaction(SHELL_STORE,'readonly'),read=tx.objectStore(SHELL_STORE).get('active');
  tx.oncomplete=()=>{connection.close();resolve(read.result===undefined?{code:'EMPTY'}:shellMetadata(read.result,scope)?{code:'OK',metadata:read.result}:{code:'QUARANTINE'});};
  tx.onabort=()=>{connection.close();reject(Error('OFFLINE_SHELL_METADATA_READ_ABORTED'));};
 });
}
/** CAS invalidates late warm responses; it grants no identity or permission. */
export async function changePendingShellMetadata(scope:string,expectedGeneration:number|null,active:boolean):Promise<{code:'STALE'|'QUARANTINE'}|{code:'OK';metadata:PendingShellMetadata}>{
 const connection=await database(scope);
 return new Promise((resolve,reject)=>{
  const tx=connection.transaction(SHELL_STORE,'readwrite'),store=tx.objectStore(SHELL_STORE),read=store.get('active');
  let result:{code:'STALE'|'QUARANTINE'}|{code:'OK';metadata:PendingShellMetadata}={code:'STALE'};
  read.onsuccess=()=>{
   const previous:unknown=read.result;
   if(previous!==undefined&&!shellMetadata(previous,scope)){result={code:'QUARANTINE'};return;}
   const generation=previous===undefined?null:(previous as PendingShellMetadata).cacheGeneration;
   if(generation!==expectedGeneration||generation===Number.MAX_SAFE_INTEGER)return;
   const metadata={scope:active?scope:null,cacheGeneration:(generation??0)+1,updatedAt:new Date().toISOString()};
   store.put(metadata,'active');result={code:'OK',metadata};
  };
  tx.oncomplete=()=>{connection.close();resolve(result);};
  tx.onabort=()=>{connection.close();reject(Error('OFFLINE_SHELL_METADATA_WRITE_ABORTED'));};
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
 const connection=await database(scope);
 return new Promise((resolve,reject)=>{
  const tx=connection.transaction(STORE,"readwrite"),store=tx.objectStore(STORE),read=store.get(original.id);
  read.onsuccess=()=>{const previous=read.result as PendingOriginal|undefined;
   const same=original.kind==='file'?previous?.kind==='file':previous?.kind==='note'&&previous.textstand===original.textstand;
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
