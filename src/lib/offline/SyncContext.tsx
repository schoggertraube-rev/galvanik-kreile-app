"use client";
import {refreshDeviceStand} from './collectDeviceStand';
import {readDeviceStandResponse} from './devicePortRead';
import {readCacheScopeMarker} from './cacheScopeMarker';
import {OFFLINE_NOTE_QUARANTINE_COPY} from '@/ui/situationCatalog';
import React, { createContext, useContext, useEffect, useCallback, useSyncExternalStore } from "react";
import type { OfflineOutboxItem } from "./OfflineOutbox";
import type {PendingQuarantine} from './pendingStore';
import {readPendingEntries,retainQuarantinedPending} from "./pendingStore";
import {usePermissions} from "@/lib/auth/PermissionsContext";
import {syncOriginals} from './syncOriginals';
import { createId } from "@paralleldrive/cuid2";

interface SyncContextValue {
  isOnline: boolean;
  outboxItems: OfflineOutboxItem[];
  quarantinedOriginals:PendingQuarantine[];
  deviceStand:DeviceStandSnapshot;
  pendingStorageUnavailable:boolean;
  addToOutbox: (item: Omit<OfflineOutboxItem, "id" | "status" | "retryCount" | "createdAt" | "updatedAt">) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);
const EMPTY_OUTBOX: OfflineOutboxItem[] = [];
export type DeviceStandSnapshot={code:'DISABLED'|'LOADING'|'INCOMPLETE'|'UNAVAILABLE'}|{code:'COMPLETE';serverReadAt:string};
const LOADING_DEVICE:DeviceStandSnapshot={code:'LOADING'},DISABLED_DEVICE:DeviceStandSnapshot={code:'DISABLED'};
let deviceSnapshot:DeviceStandSnapshot=LOADING_DEVICE,deviceSnapshotScope:string|null=null,deviceReadGeneration=0;
let deviceSnapshotLogin:string|null=null;
let fullRefreshGeneration=0;
let pendingStorageFailureScope:string|null=null;
let snapshotScope: string|null=null;
let activeScope: string|null=null;
let snapshotGeneration=0;
let outboxSnapshot: OfflineOutboxItem[] = EMPTY_OUTBOX;
const EMPTY_QUARANTINE:PendingQuarantine[]=[];
let quarantineSnapshot:PendingQuarantine[]=EMPTY_QUARANTINE;
const outboxListeners = new Set<() => void>();
// Load the existing Server Action references only when their port is used.
// Rendering a client provider must not evaluate an unused server bootstrap.
const deviceStandPorts={
  orders:{list:async()=>(await import('@/app/actions/orders.actions')).getOrdersDb(),read:async(id:string)=>(await import('@/app/actions/orders.actions')).getLiveOrderCardAction({orderId:id})},
  customers:{list:async()=>(await import('@/app/actions/customers.actions')).getCustomersDb(),read:async(id:string)=>(await import('@/app/actions/customers.actions')).getCustomerSummaryAction({customerId:id})},
  quotes:{list:async()=>(await import('@/app/actions/quotes.actions')).listOpenQuotesAction({purpose:'device'}),read:async(id:string)=>(await import('@/app/actions/quotes.actions')).readQuoteAction({quoteId:id,purpose:'operations'})},
  messages:{read:async()=>(await import('@/app/actions/eingang.actions')).getIntakeMessagesAction({purpose:'device'})},
  today:{read:async()=>(await import('@/app/actions/today.actions')).getTodayDeviceAction()},currentScope:()=>activeScope,
};

function subscribeToNetworkStatus(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineSnapshot(): boolean {
  return typeof window === "undefined" || navigator.onLine;
}

function subscribeToOutbox(onStoreChange: () => void): () => void {
  outboxListeners.add(onStoreChange);
  return () => outboxListeners.delete(onStoreChange);
}

function getOutboxSnapshot(scope:string|null): OfflineOutboxItem[] {
  return scope&&scope===snapshotScope?outboxSnapshot:EMPTY_OUTBOX;
}
function publishSnapshots(){outboxListeners.forEach(listener=>listener());}
async function refreshDeviceSnapshot(scope:string|null,enabled:boolean){
  const generation=++deviceReadGeneration;if(!scope||!enabled)return;
  const login=readCacheScopeMarker();
  const read=await readDeviceStandResponse(scope,true);
  if(activeScope!==scope||generation!==deviceReadGeneration||readCacheScopeMarker()!==login)return;
  deviceSnapshot=read.code==='OK'?{code:'COMPLETE',serverReadAt:read.serverReadAt}:read.code==='EMPTY'&&read.reason==='NO_SHELL'||'reason' in read&&read.reason==='STORAGE_UNAVAILABLE'?{code:'UNAVAILABLE'}:{code:'INCOMPLETE'};
  deviceSnapshotScope=scope;deviceSnapshotLogin=login;publishSnapshots();
}
async function refreshFullDeviceStand(scope:string,enabled:boolean){
  const request=++fullRefreshGeneration,login=readCacheScopeMarker();
  const result=await refreshDeviceStand(scope,enabled,deviceStandPorts);
  if(enabled&&result.code==='SOURCE_INCOMPLETE'&&activeScope===scope&&request===fullRefreshGeneration&&readCacheScopeMarker()===login){
    await refreshDeviceSnapshot(scope,true);
    if(activeScope===scope&&request===fullRefreshGeneration&&readCacheScopeMarker()===login&&deviceSnapshotScope===scope&&deviceSnapshotLogin===login&&deviceSnapshot.code!=='UNAVAILABLE'){
      deviceSnapshot={code:'INCOMPLETE'};publishSnapshots();
    }
  }
  return result;
}

async function refreshOutboxSnapshot(scope:string|null): Promise<void> {
  const generation=++snapshotGeneration;
  if(!scope)return;
  try {
    const entries=await readPendingEntries(scope);
    if(activeScope!==scope||generation!==snapshotGeneration)return;
    outboxSnapshot=entries.map(entry=>({id:entry.id,entityType:entry.kind==='file'?'photo':entry.kind==='note'?'phone_note':entry.kind==='workshop'?'item':'communication_draft',actionType:'create',localEntityId:'itemId' in entry?entry.itemId:entry.id,payload:{},...(entry.kind==='quarantine'&&entry.payload?.reason==='NOTE_SYNC_METADATA_MISSING'?{lastError:OFFLINE_NOTE_QUARANTINE_COPY.notice(entry.capturedAt||null)}:{}),status:entry.kind==='quarantine'?'conflict':'queued',retryCount:0,createdAt:entry.kind==='quarantine'?entry.capturedAt:'',updatedAt:entry.kind==='quarantine'?entry.capturedAt:''}));
    quarantineSnapshot=entries.filter((entry):entry is PendingQuarantine=>entry.kind==='quarantine');
    snapshotScope=scope;
    pendingStorageFailureScope=null;publishSnapshots();
  } catch (error) {
    // Retain the last confirmed snapshot; unavailable storage is not an empty queue.
    console.error("[OFFLINE_PENDING_READ_FAILED]",error instanceof Error?error.name:'UnknownError');
    if(activeScope===scope&&generation===snapshotGeneration){pendingStorageFailureScope=scope;publishSnapshots();}
  }
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error("useSync must be used within SyncProvider");
  }
  return ctx;
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const {offlineScope,status,offline24h}=usePermissions();
  const scope=status==="authenticated"?offlineScope:null;
  const isOnline = useSyncExternalStore(subscribeToNetworkStatus, getOnlineSnapshot, () => true);
  const outboxItems = useSyncExternalStore(subscribeToOutbox, ()=>getOutboxSnapshot(scope), () => EMPTY_OUTBOX);
  const quarantinedOriginals=useSyncExternalStore(subscribeToOutbox,()=>scope&&snapshotScope===scope?quarantineSnapshot:EMPTY_QUARANTINE,()=>EMPTY_QUARANTINE);
  const deviceStand=useSyncExternalStore(subscribeToOutbox,()=>!offline24h?DISABLED_DEVICE:scope&&deviceSnapshotScope===scope&&deviceSnapshotLogin===readCacheScopeMarker()?deviceSnapshot:LOADING_DEVICE,()=>LOADING_DEVICE);
  const pendingStorageUnavailable=useSyncExternalStore(subscribeToOutbox,()=>!!scope&&pendingStorageFailureScope===scope,()=>false);

  useEffect(() => {
    activeScope=scope;
    const refresh=()=>{void refreshOutboxSnapshot(scope);};
    let timer:ReturnType<typeof setTimeout>|undefined,disposed=false;
    let timerGeneration=0;
    const run=(flushDelayed=false,keepalive=false)=>{
      if(!scope||!navigator.onLine||activeScope!==scope)return;
      void syncOriginals(scope,()=>activeScope,{flushDelayed,keepalive,workshopOnly:keepalive}).then(()=>keepalive?undefined:refreshFullDeviceStand(scope,offline24h)).catch(error=>console.error('[OFFLINE_SYNC_UNAVAILABLE]',error instanceof Error?error.name:'UnknownError'));
    };
    const schedule=async()=>{
      const generation=++timerGeneration;if(timer)clearTimeout(timer);
      if(!scope||!navigator.onLine)return;
      try{
        const entries=await readPendingEntries(scope);
        if(disposed||generation!==timerGeneration||activeScope!==scope)return;
        const due=entries.filter(entry=>entry.kind==='workshop'&&entry.notBefore!==undefined&&entry.dispatchStartedAt===undefined).map(entry=>Date.parse((entry as {notBefore:string}).notBefore));
        if(due.length)timer=setTimeout(()=>run(),Math.max(0,Math.min(...due)-Date.now()));
      }catch(error){console.error('[OFFLINE_DELAYED_READ_FAILED]',error instanceof Error?error.name:'UnknownError');}
    };
    const changed=()=>{refresh();void schedule();};
    const leave=()=>run(true,true);
    const hidden=()=>{if(document.visibilityState==='hidden')leave();};
    const refreshStand=()=>{void refreshDeviceSnapshot(scope,offline24h);};
    const shellReady=(event:Event)=>{
      const detail=(event as CustomEvent<{scope:string;loginScope:string}>).detail;
      if(detail?.scope===scope&&detail.loginScope===readCacheScopeMarker())run(true);
    };
    refreshStand();window.addEventListener('kreile-device-stand-changed',refreshStand);
    window.addEventListener('kreile-offline-shell-ready',shellReady);
    refresh();window.addEventListener('kreile-pending-changed',changed);
    window.addEventListener('pagehide',leave);document.addEventListener('visibilitychange',hidden);
    if(scope&&isOnline)run(true);
    return ()=>{disposed=true;++timerGeneration;if(timer)clearTimeout(timer);window.removeEventListener('kreile-pending-changed',changed);window.removeEventListener('pagehide',leave);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('kreile-device-stand-changed',refreshStand);window.removeEventListener('kreile-offline-shell-ready',shellReady);if(activeScope===scope)activeScope=null;};
  }, [scope,isOnline,offline24h]);

  const syncNow = useCallback(async () => {
    // Retry the same canonical queue; each command checks its current server
    // rights. Customer/order notes do not require the Eingang area on the client.
    if (!isOnline||!scope||activeScope!==scope) return;
    await syncOriginals(scope,()=>activeScope);
    await refreshOutboxSnapshot(scope);
    await refreshFullDeviceStand(scope,offline24h);
  }, [isOnline,scope,offline24h]);

  const addToOutbox = useCallback(async (itemData: Omit<OfflineOutboxItem, "id" | "status" | "retryCount" | "createdAt" | "updatedAt">) => {
    const newItem: OfflineOutboxItem = {
      ...itemData,
      id: createId(),
      status: isOnline ? "queued" : "draft",
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if(!scope)throw new Error("OFFLINE_PARTITION_REQUIRED");
    // An old generic mutation has no secure command contract: preserve it, never execute it.
    await retainQuarantinedPending(scope,{id:newItem.id,kind:"quarantine",capturedAt:newItem.createdAt,payload:newItem as unknown as Record<string,unknown>});
    await refreshOutboxSnapshot(scope);
  }, [isOnline,scope]);

  const removeItem = useCallback(async (id: string) => {
    // Pending real events can only be acknowledged by their actual server receipt.
    void id;
    throw new Error("OFFLINE_SERVER_RECEIPT_REQUIRED");
  }, []);


  return (
    <SyncContext.Provider value={{ isOnline, outboxItems,quarantinedOriginals,deviceStand,pendingStorageUnavailable,addToOutbox, removeItem, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}
