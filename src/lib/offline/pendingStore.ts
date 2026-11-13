import type {CustomerListResponse} from '@/app/actions/customers.actions';
import type {ActionResult} from '@/lib/server/authHelper';
import {canonicalJson} from '@/lib/domain/canonicalJson';
import {readCacheScopeMarker} from './cacheScopeMarker';
import type {IntakeOriginalTakeover} from '@/modules/eingang/public';
import type {setOrderItemFinishedAction,changeOrderItemExtraWorkAction,OrderResponse} from '@/app/actions/orders.actions';
// Unacknowledged originals in one scoped queue. Server remains authoritative.
export type PendingOriginal = ({ id: string; itemId: string; kind: "file"; file: File; deviceId?:string|null; deviceCapturedAt?:string; captureOrigin?: "warenfoto" | "dokument"; context?:{orderId:string;receiptId:string;clientKey:string;photoKind:"uebersicht"|"teile"|"abweichung"} }
  | { id: string; itemId: string; kind: "note"; text: string; textstand: string; dismissed: string[];expectedVersion?:number;deviceCapturedAt?:string;context?:{customerId?:string;orderId?:string} }) & {queueSequence?:number;takeover?:IntakeOriginalTakeover;takeoverSourceCanonical?:string};
export type PendingQuarantine={id:string;kind:"quarantine";capturedAt:string;payload:Record<string,unknown>};
export type PendingWorkshopCommand={command:'item.finished';input:Parameters<typeof setOrderItemFinishedAction>[0]}|{command:'item.extraWork';input:Parameters<typeof changeOrderItemExtraWorkAction>[0]};
export type PendingWorkshopOriginal=PendingWorkshopCommand&{id:string;itemId:string;kind:'workshop';deviceCapturedAt?:string;queueSequence?:number;notBefore?:string;dispatchStartedAt?:string};
export type PendingWorkshopReceipt={scope:string;clientEventId:string;deviceCapturedAt:string;eventId:string;actorId:string};
export type PendingEntry=PendingOriginal|PendingWorkshopOriginal|PendingQuarantine;
export function isPendingWorkshopOriginal(value:unknown):value is PendingWorkshopOriginal{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const row=value as Record<string,unknown>,input=row.input;
 if(row.kind!=='workshop'||!input||typeof input!=='object'||Array.isArray(input))return false;
 if(Object.keys(row).some(key=>!['id','itemId','kind','command','input','deviceCapturedAt','queueSequence','notBefore','dispatchStartedAt'].includes(key)))return false;
 for(const key of ['notBefore','dispatchStartedAt'])if(row[key]!==undefined&&(typeof row[key]!=='string'||!Number.isFinite(Date.parse(row[key] as string))))return false;
 if(row.deviceCapturedAt!==undefined&&(typeof row.deviceCapturedAt!=='string'||!Number.isFinite(Date.parse(row.deviceCapturedAt))))return false;
 if(row.queueSequence!==undefined&&(typeof row.queueSequence!=='number'||!Number.isSafeInteger(row.queueSequence)||row.queueSequence<1))return false;
 const data=input as Record<string,unknown>,uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
 if(!uuid(data.orderId)||!uuid(data.itemId)||!uuid(data.clientEventId)||row.id!==data.clientEventId||row.itemId!==data.orderId)return false;
 const keys=Object.keys(data).sort().join(',');
 if(row.command==='item.finished')return keys==='clientEventId,expectedVersion,finished,itemId,orderId'&&Number.isSafeInteger(data.expectedVersion)&&typeof data.finished==='boolean';
 return row.command==='item.extraWork'&&keys==='active,catalogPositionId,clientEventId,expectedLineVersion,expectedOrderVersion,itemId,lineId,minutes,orderId'&&uuid(data.lineId)&&uuid(data.catalogPositionId)&&Number.isSafeInteger(data.expectedLineVersion)&&Number.isSafeInteger(data.expectedOrderVersion)&&typeof data.minutes==='number'&&Number.isFinite(data.minutes)&&typeof data.active==='boolean';
}
const STORE = "originals";
const SHELL_STORE = "shellMetadata";
const DEVICE_STORE = "deviceReads";
async function database(scope: string): Promise<IDBDatabase> {
  if (!/^[0-9a-f]{64}$/.test(scope)) throw new Error("INTAKE_PENDING_SCOPE_REQUIRED");
  return new Promise((resolve, reject) => {
    let abandoned=false;
    const request = indexedDB.open(`kreile-pending-originals-v1-${scope}`, 3);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
      if (!request.result.objectStoreNames.contains(SHELL_STORE)) request.result.createObjectStore(SHELL_STORE);
      if (!request.result.objectStoreNames.contains(DEVICE_STORE)) request.result.createObjectStore(DEVICE_STORE);
    };
    request.onsuccess = () => {if(abandoned){request.result.close();return;}request.result.onversionchange=()=>request.result.close();resolve(request.result);};
    request.onerror = () => reject(new Error("INTAKE_PENDING_STORAGE_UNAVAILABLE"));
    request.onblocked = () => {abandoned=true;reject(new Error("INTAKE_PENDING_STORAGE_BLOCKED"));};
  });
}
export type PendingShellMetadata={scope:string|null;cacheGeneration:number;updatedAt:string};
/** Exact metadata-only U2 response, already filtered by the server port. */
type DeviceEnvelope={serverChangedAt?:string|null;portVersion:1;objectId:string;serverReadAt:string;sourceLoginScope:string};
type DeviceDashboard={items:readonly unknown[];visibleFields:readonly unknown[];layout:readonly unknown[];defaultLayout:readonly unknown[];allowedFields:readonly unknown[];delegationTargets:readonly unknown[];outlookMessage:string|null;messageActions?:{code:'OK'|'SOURCE_INCOMPLETE';rows:readonly {messageId:string;version:number;read:import('@/lib/domain/u2ReadContract').U2Read}[];missingMessageIds:readonly string[]}};
export type PendingDeviceRead=DeviceEnvelope&({port:'order.u2'|'customer.u2'|'quote.u2'|'message.u2';response:import('@/lib/domain/u2ReadContract').U2Read}|{port:'today.u3';response:DeviceDashboard}|{port:'orders.list';response:{result:ActionResult<OrderResponse[]>;datenluecken:string[]}}|{port:'customers.list';response:{result:ActionResult<CustomerListResponse[]>;datenluecken:string[]}});
export const DEVICE_READ_PORTS=['order.u2','customer.u2','quote.u2','message.u2','today.u3','orders.list','customers.list'] as const;
const standKey=(loginScope:string,generation:number)=>[loginScope,generation,'stand.complete','stand'];
type CompleteDeviceStand={schemaVersion:1;loginScope:string;serverReadAt:string;ports:readonly PendingDeviceRead['port'][]};
function completeDeviceStand(value:unknown,loginScope:string):value is CompleteDeviceStand{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const row=value as Record<string,unknown>;
 return Object.keys(row).sort().join(',')==='loginScope,ports,schemaVersion,serverReadAt'&&row.schemaVersion===1&&row.loginScope===loginScope&&typeof row.serverReadAt==='string'&&Number.isFinite(Date.parse(row.serverReadAt))&&Array.isArray(row.ports)&&row.ports.join(',')===DEVICE_READ_PORTS.join(',');
}
function fullDeviceValues(values:PendingDeviceRead[],serverReadAt:string){
 if(new Set(values.map(row=>row.port+'\0'+row.objectId)).size!==values.length||values.some(row=>Date.parse(row.serverReadAt)>Date.parse(serverReadAt)))return false;
 const orders=values.find(row=>row.port==='orders.list'),customers=values.find(row=>row.port==='customers.list');
 if(!orders||orders.port!=='orders.list'||orders.objectId!=='orders'||!customers||customers.port!=='customers.list'||customers.objectId!=='customers'||values.filter(row=>row.port==='orders.list').length!==1||values.filter(row=>row.port==='customers.list').length!==1||values.filter(row=>row.port==='today.u3'&&row.objectId==='today').length!==1||values.filter(row=>row.port==='today.u3').length!==1)return false;
 const matches=(ids:string[],port:PendingDeviceRead['port'])=>{const actual=values.filter(row=>row.port===port).map(row=>row.objectId);return actual.length===ids.length&&new Set(ids).size===ids.length&&actual.every(id=>ids.includes(id));};
 if(!orders.response.result.ok&&orders.response.result.error!=='FORBIDDEN'||!customers.response.result.ok&&customers.response.result.error!=='FORBIDDEN')return false;
 return matches(orders.response.result.ok?orders.response.result.data.map(row=>row.id):[],'order.u2')&&matches(customers.response.result.ok?customers.response.result.data.map(row=>row.id):[],'customer.u2');
}
function isDeviceRead(value:unknown):value is PendingDeviceRead{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const row=value as Record<string,unknown>,response=row.response;
 if(Object.keys(row).filter(key=>key!=='serverChangedAt').sort().join(',')!=='objectId,port,portVersion,response,serverReadAt,sourceLoginScope'||Object.prototype.hasOwnProperty.call(row,'serverChangedAt')&&row.serverChangedAt!==null&&(typeof row.serverChangedAt!=='string'||!Number.isFinite(Date.parse(row.serverChangedAt)))||typeof row.sourceLoginScope!=='string'||! /^[a-f0-9]{64}$/.test(row.sourceLoginScope)||!DEVICE_READ_PORTS.includes(row.port as PendingDeviceRead['port'])||row.portVersion!==1||typeof row.objectId!=='string'||!row.objectId.length||row.objectId.length>128||typeof row.serverReadAt!=='string'||!Number.isFinite(Date.parse(row.serverReadAt))||!response||typeof response!=='object'||Array.isArray(response))return false;
 const u2=response as Record<string,unknown>;
 if(row.port==='orders.list'||row.port==='customers.list'){
  if(!Array.isArray(u2.datenluecken)||!u2.datenluecken.every(gap=>typeof gap==='string')||!u2.result||typeof u2.result!=='object'||Array.isArray(u2.result))return false;
  const result=u2.result as Record<string,unknown>;
  if(result.ok===false)return Object.keys(result).sort().join(',')==='error,message,ok'&&(result.error==='FORBIDDEN'||result.error==='UNAUTHORIZED')&&typeof result.message==='string';
  if(row.port==='customers.list')return result.ok===true&&Object.keys(result).sort().join(',')==='data,ok'&&Array.isArray(result.data)&&result.data.every(customer=>customer&&typeof customer==='object'&&['id','customerNumber','name','type'].every(key=>typeof customer[key]==='string')&&Number.isSafeInteger(customer.activeOrderCount)&&Number.isSafeInteger(customer.activeQuoteCount)&&Array.isArray(customer.hints)&&typeof customer.complete==='boolean');
  return result.ok===true&&Object.keys(result).sort().join(',')==='data,ok'&&Array.isArray(result.data)&&result.data.every(order=>order&&typeof order==='object'&&['id','customerId','orderNumber','station','status','risk','title','statusText','dueDate','dueValue'].every(key=>typeof order[key]==='string')&&Array.isArray(order.parts)&&order.parts.every((part:Record<string,unknown>)=>part&&typeof part.id==='string'&&typeof part.name==='string'));
 }
 if(row.port==='today.u3')return ['items','visibleFields','layout','defaultLayout','allowedFields','delegationTargets'].every(key=>Array.isArray(u2[key]))&&(u2.outlookMessage===null||typeof u2.outlookMessage==='string');
 return u2.code==='OK'&&(typeof u2.zustand==='string'||u2.zustand===null)&&(typeof u2.farbe==='string'||u2.farbe===null)&&Array.isArray(u2.erstblick)&&(u2.hauptaktion===null||typeof u2.hauptaktion==='object')&&(u2.weitere===null||Array.isArray(u2.weitere))&&Array.isArray(u2.gesperrt)&&Array.isArray(u2.datenluecken)&&!!u2.quelle&&typeof u2.quelle==='object';
}
const deviceKey=(loginScope:string,generation:number,read:Pick<PendingDeviceRead,'port'|'objectId'>)=>[loginScope,generation,read.port,read.objectId];
/** Same DB and generation as the reading fence; never touches queued originals. */
export async function retainPendingDeviceRead(scope:string,loginScope:string,generation:number,value:PendingDeviceRead|PendingDeviceRead[],replace?:{port:'quote.u2'|'message.u2'|'stand';serverReadAt:string}):Promise<{code:'STORED'|'STALE'}>{
 const values=Array.isArray(value)?value:[value];
 if(!Number.isSafeInteger(generation)||generation<1||values.some(row=>!isDeviceRead(row))||Array.isArray(value)!==!!replace||replace&&(!['quote.u2','message.u2','stand'].includes(replace.port)||!Number.isFinite(Date.parse(replace.serverReadAt))||(replace.port==='stand'?!fullDeviceValues(values,replace.serverReadAt):values.some(row=>row.port!==replace.port)||new Set(values.map(row=>row.objectId)).size!==values.length)))throw Error('OFFLINE_DEVICE_RESPONSE_INVALID');
 if(readCacheScopeMarker()!==loginScope||values.some(row=>row.sourceLoginScope!==loginScope))return {code:'STALE'};
 const metadataKey=shellKey(loginScope),connection=await database(scope);
 return new Promise((resolve,reject)=>{
  const tx=connection.transaction([SHELL_STORE,DEVICE_STORE],'readwrite'),read=tx.objectStore(SHELL_STORE).get(metadataKey);
  let code:'STORED'|'STALE'='STALE',revoked=false;
  read.onsuccess=()=>{
   if(readCacheScopeMarker()!==loginScope||!shellMetadata(read.result,loginScope)||read.result.scope!==loginScope||read.result.cacheGeneration!==generation)return;
   const store=tx.objectStore(DEVICE_STORE);
   if(replace?.port==='stand'){
    if(generation>=Number.MAX_SAFE_INTEGER-1)throw Error('OFFLINE_DEVICE_GENERATION_EXHAUSTED');
    // Seal a new reading generation in this same transaction. Old in-flight
    // requests cannot adopt it, and no prior login's cache bytes survive.
    const nextGeneration=generation+1,cursor=store.openCursor();
    cursor.onsuccess=()=>{
     if(readCacheScopeMarker()!==loginScope){revoked=true;tx.abort();return;}
     const current=cursor.result;if(current){current.delete();current.continue();return;}
     for(const row of values)store.put(row,deviceKey(loginScope,nextGeneration,row));
     tx.objectStore(SHELL_STORE).put({...read.result,cacheGeneration:nextGeneration},metadataKey);
     store.put({schemaVersion:1,loginScope,serverReadAt:replace.serverReadAt,ports:DEVICE_READ_PORTS},standKey(loginScope,nextGeneration));
     if(readCacheScopeMarker()!==loginScope){revoked=true;tx.abort();return;}
     code='STORED';
    };
    return;
   }
   if(replace){
    const incoming=new Map(values.map(row=>[row.objectId,row])),newer=new Set<string>();
    const cursor=store.openCursor(IDBKeyRange.bound([loginScope,generation,replace.port],[loginScope,generation,replace.port,[]]));
    cursor.onsuccess=()=>{
     if(readCacheScopeMarker()!==loginScope){revoked=true;tx.abort();return;}
     const current=cursor.result;
     if(current){
      const existing:unknown=current.value;
      const next=isDeviceRead(existing)?incoming.get(existing.objectId):undefined;
      if(isDeviceRead(existing)&&existing.port===replace.port&&Array.isArray(current.primaryKey)&&current.primaryKey[3]===existing.objectId&&existing.sourceLoginScope===loginScope&&Date.parse(existing.serverReadAt)>Date.parse(next?.serverReadAt??replace.serverReadAt))newer.add(existing.objectId);
      else current.delete();
      current.continue();return;
     }
     for(const row of values)if(!newer.has(row.objectId))store.put(row,deviceKey(loginScope,generation,row));
     code='STORED';
    };
    return;
   }
   const single=values[0],key=deviceKey(loginScope,generation,single),previous=store.get(key);
   previous.onsuccess=()=>{
    if(readCacheScopeMarker()!==loginScope||isDeviceRead(previous.result)&&Date.parse(previous.result.serverReadAt)>Date.parse(single.serverReadAt))return;
    store.put(single,key);code='STORED';
   };
  };
  tx.oncomplete=()=>{connection.close();resolve({code});};
  tx.onabort=()=>{connection.close();if(revoked)resolve({code:'STALE'});else reject(Error('OFFLINE_DEVICE_WRITE_ABORTED'));};
 });
}
export async function readPendingDeviceRead(scope:string,loginScope:string,generation:number,target:Pick<PendingDeviceRead,'port'|'objectId'>):Promise<{code:'EMPTY'|'STALE'|'SOURCE_INCOMPLETE'}|{code:'OK';value:PendingDeviceRead}>{
 if(readCacheScopeMarker()!==loginScope)return {code:'STALE'};
 const metadataKey=shellKey(loginScope),connection=await database(scope);
 return new Promise((resolve,reject)=>{
  const tx=connection.transaction([SHELL_STORE,DEVICE_STORE],'readonly'),state=tx.objectStore(SHELL_STORE).get(metadataKey),read=tx.objectStore(DEVICE_STORE).get(deviceKey(loginScope,generation,target));
  tx.oncomplete=()=>{
   connection.close();
   if(readCacheScopeMarker()!==loginScope||!shellMetadata(state.result,loginScope)||state.result.scope!==loginScope||state.result.cacheGeneration!==generation){resolve({code:'STALE'});return;}
   if(read.result===undefined){resolve({code:'EMPTY'});return;}
   resolve(isDeviceRead(read.result)&&read.result.sourceLoginScope===loginScope&&read.result.port===target.port&&read.result.objectId===target.objectId?{code:'OK',value:read.result}:{code:'SOURCE_INCOMPLETE'});
  };
  tx.onabort=()=>{connection.close();reject(Error('OFFLINE_DEVICE_READ_ABORTED'));};
 });
}
/** Completion provenance is technical metadata in the existing read store.
 * Queued originals and the scope/generation/time shell contract are untouched. */
export async function readPendingDeviceStand(scope:string,loginScope:string):Promise<{code:'EMPTY';reason:'NO_SHELL'|'NO_COMPLETION'}|{code:'STALE'|'SOURCE_INCOMPLETE'}|{code:'OK';serverReadAt:string;cacheGeneration:number}>{
 if(readCacheScopeMarker()!==loginScope)return {code:'STALE'};
 const connection=await database(scope);
 return new Promise((resolve,reject)=>{
  let tx:IDBTransaction;try{tx=connection.transaction([SHELL_STORE,DEVICE_STORE],'readonly');}catch(error){connection.close();reject(error);return;}
  const state=tx.objectStore(SHELL_STORE).get(shellKey(loginScope));let marker:unknown;
  state.onsuccess=()=>{if(shellMetadata(state.result,loginScope)&&state.result.scope===loginScope){const read=tx.objectStore(DEVICE_STORE).get(standKey(loginScope,state.result.cacheGeneration));read.onsuccess=()=>{marker=read.result;};}};
  tx.oncomplete=()=>{
   connection.close();if(readCacheScopeMarker()!==loginScope){resolve({code:'STALE'});return;}
   if(state.result===undefined){resolve({code:'EMPTY',reason:'NO_SHELL'});return;}
   if(!shellMetadata(state.result,loginScope)){resolve({code:'SOURCE_INCOMPLETE'});return;}
   if(state.result.scope!==loginScope){resolve({code:'STALE'});return;}
   if(marker===undefined){resolve({code:'EMPTY',reason:'NO_COMPLETION'});return;}
   resolve(completeDeviceStand(marker,loginScope)?{code:'OK',serverReadAt:marker.serverReadAt,cacheGeneration:state.result.cacheGeneration}:{code:'SOURCE_INCOMPLETE'});
  };
  tx.onabort=()=>{connection.close();reject(Error('OFFLINE_DEVICE_STAND_READ_ABORTED'));};
 });
}
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
export async function revokePendingShells(scope:string,unmarkedOnly=false):Promise<{loginScopes:string[];quarantined:number}>{
 const connection=await database(scope);
 return new Promise((resolve,reject)=>{
  const tx=connection.transaction([SHELL_STORE,DEVICE_STORE],'readwrite'),store=tx.objectStore(SHELL_STORE),keys=store.getAllKeys(),values=store.getAll();
  let keysReady=false,valuesReady=false,result:{loginScopes:string[];quarantined:number}={loginScopes:[],quarantined:0};
  const revoke=()=>{
   if(!keysReady||!valuesReady)return;
   if(unmarkedOnly&&readCacheScopeMarker()!==null){tx.abort();return;}
   tx.objectStore(DEVICE_STORE).clear();
   const inventory=shellInventory(keys.result,values.result);result={loginScopes:inventory.entries.map(entry=>entry.loginScope),quarantined:inventory.quarantined};
   for(const entry of inventory.entries)if(entry.metadata.scope!==null)store.put({scope:null,cacheGeneration:Math.min(entry.metadata.cacheGeneration+1,Number.MAX_SAFE_INTEGER-1),updatedAt:new Date().toISOString()},shellKey(entry.loginScope));
  };
  keys.onsuccess=()=>{keysReady=true;revoke();};values.onsuccess=()=>{valuesReady=true;revoke();};
  tx.oncomplete=()=>{connection.close();resolve(result);};
  tx.onabort=()=>{connection.close();reject(Error('OFFLINE_SHELL_REVOCATION_ABORTED'));};
 });
}
/** Retry reading-state deletion before a new login; original stores are untouched. */
export async function revokeUnmarkedPendingDeviceReads():Promise<void>{
 if(readCacheScopeMarker()!==null)throw Error('OFFLINE_CLEANUP_SCOPE_CHANGED');
 if(typeof indexedDB==='undefined'||typeof indexedDB.databases!=='function')throw Error('OFFLINE_DEVICE_INVENTORY_UNAVAILABLE');
 const databases=await indexedDB.databases();
 for(const entry of databases){
  const match=entry.name?.match(/^kreile-pending-originals-v1-([a-f0-9]{64})$/);
  if(!match)continue;
  if(readCacheScopeMarker()!==null)throw Error('OFFLINE_CLEANUP_SCOPE_CHANGED');
  await revokePendingShells(match[1],true);
 }
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
/** U291: claim and withdraw serialize on the original store. Once an attempt
 * starts, response loss cannot reopen the undo window or replace its N5 key. */
export async function claimPendingWorkshop(scope:string,id:string,flush=false):Promise<PendingWorkshopOriginal|null>{
 return changeDelayedWorkshop(scope,id,'claim',flush) as Promise<PendingWorkshopOriginal|null>;
}
export async function withdrawPendingWorkshop(scope:string,id:string):Promise<boolean>{
 return changeDelayedWorkshop(scope,id,'withdraw',false) as Promise<boolean>;
}
async function changeDelayedWorkshop(scope:string,id:string,mode:'claim'|'withdraw',flush:boolean):Promise<PendingWorkshopOriginal|null|boolean>{
 const db=await database(scope);
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),read=store.get(id);let result:PendingWorkshopOriginal|null|boolean=mode==='claim'?null:false;
  read.onsuccess=()=>{
   const row:unknown=read.result;if(!isPendingWorkshopOriginal(row))return;
   const now=new Date(),due=row.notBefore===undefined||Date.parse(row.notBefore)<=now.getTime();
   if(mode==='withdraw'){
    if(row.notBefore===undefined||row.dispatchStartedAt!==undefined||due)return;
    store.delete(id);result=true;return;
   }
   if(!flush&&!due&&row.dispatchStartedAt===undefined)return;
   const claimed=row.notBefore!==undefined&&row.dispatchStartedAt===undefined?{...row,dispatchStartedAt:now.toISOString()}:row;
   if(claimed!==row)store.put(claimed);result=claimed;
  };
  tx.oncomplete=()=>{db.close();if(mode==='withdraw'&&result===true)window.dispatchEvent(new Event('kreile-pending-changed'));resolve(result);};
  tx.onabort=()=>{db.close();reject(Error('OFFLINE_WORKSHOP_QUEUE_ABORTED'));};
 });
}
type RequiredDeviceStand={loginScope:string;cacheGeneration:number;serverReadAt:string};
async function retainOriginal(scope:string,original:PendingOriginal|PendingWorkshopOriginal,requiredStand?:RequiredDeviceStand):Promise<void>{
 const connection=await database(scope);
 return new Promise((resolve,reject)=>{
  const tx=connection.transaction(requiredStand?[STORE,SHELL_STORE,DEVICE_STORE]:STORE,"readwrite"),store=tx.objectStore(STORE);
  const shell=requiredStand?tx.objectStore(SHELL_STORE).get(shellKey(requiredStand.loginScope)):null;
  const stand=requiredStand?tx.objectStore(DEVICE_STORE).get(standKey(requiredStand.loginScope,requiredStand.cacheGeneration)):null;
  const read=store.get(original.id);let staleStand=false;
  read.onsuccess=()=>{const previous=read.result as PendingOriginal|PendingWorkshopOriginal|undefined;
   if(requiredStand){
    const age=new Date().getTime()-Date.parse(requiredStand.serverReadAt);
    if(readCacheScopeMarker()!==requiredStand.loginScope||!shellMetadata(shell?.result,requiredStand.loginScope)||shell?.result.scope!==requiredStand.loginScope||shell.result.cacheGeneration!==requiredStand.cacheGeneration||!completeDeviceStand(stand?.result,requiredStand.loginScope)||stand?.result.serverReadAt!==requiredStand.serverReadAt||!Number.isFinite(age)||age<0||age>=24*60*60*1000){staleStand=true;tx.abort();return;}
   }
   if(original.kind==='workshop'&&previous){
    if(!isPendingWorkshopOriginal(previous)||previous.command!==original.command||canonicalJson(previous.input)!==canonicalJson(original.input)){tx.abort();return;}
    store.put(previous);return;
   }
   const same=original.kind==='file'?previous?.kind==='file':original.kind==='note'&&previous?.kind==='note'&&previous.textstand===original.textstand;
   const deviceCapturedAt=same?previous?.deviceCapturedAt:original.kind==='workshop'&&original.deviceCapturedAt?original.deviceCapturedAt:new Date().toISOString();
   const expectedVersion=same&&previous?.kind==='note'?previous.expectedVersion:original.kind==='note'?original.expectedVersion:undefined;
   if(previous&&previous.kind!==original.kind){tx.abort();return;}
   // The first file is the original. A retry must never replace its bytes or
   // provenance while it still awaits the server receipt.
   if(original.kind==='file'&&previous?.kind==='file'){store.put(previous);return;}
   const value={...original};delete value.deviceCapturedAt;
   if(value.kind==='note'&&previous?.kind==='note'&&previous.takeover){value.takeover=previous.takeover;value.takeoverSourceCanonical=previous.takeoverSourceCanonical;}
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
  tx.onabort=()=>{connection.close();reject(new Error(staleStand?"OFFLINE_WORKSHOP_STAND_STALE":"INTAKE_PENDING_STORAGE_ABORTED"));};
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
/** Explicit takeover preserves the raw quarantined row until its real capture
 * receipt. A double click reuses the already retained original and N5 key. */
function quarantineCanonical(value:unknown):string{
 return canonicalJson(JSON.parse(JSON.stringify(value,(_key,entry)=>typeof File!=='undefined'&&entry instanceof File?{name:entry.name,type:entry.type,size:entry.size,lastModified:entry.lastModified}:entry)));
}
function containsBinary(value:unknown,seen=new WeakSet<object>()):boolean{
 if(!value||typeof value!=='object'||seen.has(value))return false;seen.add(value);
 if(value instanceof Blob||value instanceof ArrayBuffer||ArrayBuffer.isView(value))return true;
 return Object.values(value).some(entry=>containsBinary(entry,seen));
}
export async function adoptQuarantinedOriginal(scope:string,sourceId:string,deviceId:string,currentScope:()=>string|null=()=>scope){
 const login=readCacheScopeMarker();if(currentScope()!==scope)return {code:'SOURCE_INCOMPLETE' as const};
 const rows=await transaction<unknown[]>(scope,'readonly',store=>store.getAll());
 const isSource=(row:unknown):row is Record<string,unknown>=>!!row&&typeof row==='object'&&!Array.isArray(row)&&'id'in row&&'quarantine:'+quarantineKey(row.id)===sourceId;
 const raw=rows.find(isSource);if(!raw)return {code:'SOURCE_INCOMPLETE' as const};
 const wrapper=raw.kind==='quarantine'&&raw.payload&&typeof raw.payload==='object'?raw.payload as Record<string,unknown>:raw;
 let source=wrapper.original&&typeof wrapper.original==='object'&&!Array.isArray(wrapper.original)?wrapper.original as Record<string,unknown>:wrapper;
 if(source.text===undefined&&source.file===undefined&&source.payload&&typeof source.payload==='object'&&!Array.isArray(source.payload))source=source.payload as Record<string,unknown>;
 const file=typeof File!=='undefined'&&source.file instanceof File?source.file:null;
 const text=typeof source.text==='string'&&source.text.trim()?source.text:!file&&!containsBinary(source)?quarantineCanonical(source):null;
 if(!file&&(!text||text.length>20000))return {code:'SOURCE_INCOMPLETE' as const};
 const serialized=quarantineCanonical(raw);if(serialized.length>250000)return {code:'SOURCE_INCOMPLETE' as const};
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialized))),byte=>byte.toString(16).padStart(2,'0')).join('');
 const id=crypto.randomUUID(),metadata={takeover:{sourceId,deviceId,sha256:hash,originalRecord:serialized},takeoverSourceCanonical:serialized,deviceCapturedAt:new Date().toISOString()};
 const original:PendingOriginal=file?{...metadata,kind:'file',id,itemId:crypto.randomUUID(),file,deviceId,captureOrigin:'dokument'}:{...metadata,kind:'note',id,itemId:id,text:text!,textstand:crypto.randomUUID(),dismissed:[],expectedVersion:0};
 const db=await database(scope);
 return new Promise<{code:'OK';original:PendingOriginal}|{code:'SOURCE_INCOMPLETE'}>((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),read=store.getAll();let saved:PendingOriginal|undefined;
  read.onsuccess=()=>{
   if(currentScope()!==scope||readCacheScopeMarker()!==login)return;
   const values=read.result as unknown[],current=values.find(isSource);
   if(!current||quarantineCanonical(current)!==serialized)return;
   const previous=values.find(row=>!!row&&typeof row==='object'&&'takeover'in row&&(row as PendingOriginal).takeover?.sourceId===sourceId) as PendingOriginal|undefined;
   if(previous){if(previous.takeover?.sha256===hash)saved=previous;return;}
   const maximum=values.reduce<number>((max,row)=>{const sequence=row&&typeof row==='object'&&'queueSequence'in row?row.queueSequence:undefined;return typeof sequence==='number'&&Number.isSafeInteger(sequence)&&sequence>max?sequence:max;},0);
   if(maximum>=Number.MAX_SAFE_INTEGER){tx.abort();return;}
   original.queueSequence=maximum+1;store.put(original);saved=original;
  };
  tx.oncomplete=()=>{db.close();if(saved){window.dispatchEvent(new Event('kreile-pending-changed'));resolve({code:'OK',original:saved});}else resolve({code:'SOURCE_INCOMPLETE'});};
  tx.onabort=()=>{db.close();reject(Error('OFFLINE_TAKEOVER_STORAGE_ABORTED'));};
 });
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
export async function retainQuarantinedPending(scope:string,entry:PendingQuarantine):Promise<void>{
 const db=await database(scope);return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),read=store.get(entry.id);read.onsuccess=()=>{if(read.result?.kind!=='quarantine')store.put(entry);};tx.oncomplete=()=>{db.close();window.dispatchEvent(new Event('kreile-pending-changed'));resolve();};tx.onabort=()=>{db.close();reject(Error('INTAKE_PENDING_STORAGE_ABORTED'));};});
}
export async function readPendingOriginals(scope: string): Promise<PendingOriginal[]> {return (await readPendingEntries(scope)).filter((entry):entry is PendingOriginal=>entry.kind==="file"||entry.kind==="note");}
export async function acknowledgePendingOriginal(scope: string, id: string, textstand?: string,takeoverProof?:Array<IntakeOriginalTakeover&{actorId:string}>): Promise<void> {
  const connection = await database(scope);
  return new Promise((resolve, reject) => {
    const transaction = connection.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const request = store.get(id);
    request.onsuccess = () => {
      const original = request.result as PendingOriginal | undefined;
      if (!original || (original.kind!=="file"&&original.kind!=="note") || textstand && (original.kind !== "note" || original.textstand !== textstand)) return;
      if(original.takeover){
        const source=original.takeover;
        if(!takeoverProof?.some(proof=>proof.sourceId===source.sourceId&&proof.deviceId===source.deviceId&&proof.sha256===source.sha256&&proof.originalRecord===source.originalRecord&&typeof proof.actorId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(proof.actorId))){transaction.abort();return;}
        const sources=store.getAll();sources.onsuccess=()=>{for(const raw of sources.result as Array<Record<string,unknown>>)if('id'in raw&&'quarantine:'+quarantineKey(raw.id)===source.sourceId){if(quarantineCanonical(raw)!==original.takeoverSourceCanonical){transaction.abort();return;}store.delete(raw.id as IDBValidKey);}};
      }
      store.delete(id);
    };
    transaction.oncomplete = () => { connection.close(); window.dispatchEvent(new Event("kreile-pending-changed")); resolve(); };
    transaction.onerror = () => { connection.close(); reject(new Error("INTAKE_PENDING_ACK_FAILED")); };
    transaction.onabort = () => { connection.close(); reject(new Error("INTAKE_PENDING_ACK_ABORTED")); };
  });
}
/** One receipt predicate for the transport boundary and the actual queue ack. */
export function isPendingWorkshopReceipt(scope:string,entry:PendingWorkshopOriginal,value:unknown):value is PendingWorkshopReceipt{
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
 if(!isPendingWorkshopOriginal(entry)||!value||typeof value!=='object'||Array.isArray(value))return false;
 const receipt=value as Record<string,unknown>;
 return receipt.scope===scope&&receipt.clientEventId===entry.id&&typeof receipt.deviceCapturedAt==='string'&&receipt.deviceCapturedAt===entry.deviceCapturedAt&&typeof receipt.eventId==='string'&&uuid.test(receipt.eventId)&&typeof receipt.actorId==='string'&&uuid.test(receipt.actorId);
}
/** A command cannot be erased by the legacy file/note acknowledgement. */
export async function acknowledgePendingWorkshopOriginal(scope:string,entry:PendingWorkshopOriginal,receipt:PendingWorkshopReceipt):Promise<boolean>{
 if(!isPendingWorkshopReceipt(scope,entry,receipt))throw Error('OFFLINE_WORKSHOP_RECEIPT_REQUIRED');
 const db=await database(scope);
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),read=store.get(entry.id);let removed=false;
  read.onsuccess=()=>{const current=read.result;if(!isPendingWorkshopOriginal(current)||current.command!==entry.command||current.deviceCapturedAt!==entry.deviceCapturedAt||canonicalJson(current.input)!==canonicalJson(entry.input))return;store.delete(entry.id);removed=true;};
  tx.oncomplete=()=>{db.close();if(removed)window.dispatchEvent(new Event('kreile-pending-changed'));resolve(removed);};
  tx.onabort=()=>{db.close();reject(Error('OFFLINE_WORKSHOP_ACK_ABORTED'));};
 });
}

/** PL11:01 producer gate. This is a device reading fence, never server authority.
 * A missing/expired/revoked device stand cannot start a new offline command. */
export async function capturePendingItemFinished(scope:string,enabled:boolean,input:Extract<PendingWorkshopCommand,{command:'item.finished'}>['input']){
 if(!enabled||input.finished!==true)return {code:'NETWORK_REQUIRED' as const};
 const {readCacheScopeMarker}=await import('./cacheScopeMarker');
 const login=readCacheScopeMarker();if(!login)return {code:'NETWORK_REQUIRED' as const};
 const state=await readPendingDeviceStand(scope,login),now=new Date();
 if(state.code!=='OK')return {code:'NETWORK_REQUIRED' as const};
 const age=now.getTime()-Date.parse(state.serverReadAt);
 if(!Number.isFinite(age)||age<0||age>=24*60*60*1000||readCacheScopeMarker()!==login)return {code:'NETWORK_REQUIRED' as const};
 const original:PendingWorkshopOriginal={kind:'workshop',command:'item.finished',id:input.clientEventId,itemId:input.orderId,input,deviceCapturedAt:now.toISOString()};
 if(!isPendingWorkshopOriginal(original))throw Error('OFFLINE_WORKSHOP_ORIGINAL_INVALID');
 try{await retainOriginal(scope,original,{loginScope:login,cacheGeneration:state.cacheGeneration,serverReadAt:state.serverReadAt});}
 catch(error){if(error instanceof Error&&error.message==='OFFLINE_WORKSHOP_STAND_STALE')return {code:'NETWORK_REQUIRED' as const};throw error;}
 return {code:'QUEUED' as const};
}
