"use client";
import {refreshDeviceStand} from './collectDeviceStand';
import {getOrdersDb,getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {getCustomersDb,getCustomerSummaryAction} from '@/app/actions/customers.actions';
import {getTodayDeviceAction} from '@/app/actions/today.actions';

import {getIntakeMessagesAction} from '@/app/actions/eingang.actions';
import {listOpenQuotesAction,readQuoteAction} from '@/app/actions/quotes.actions';
import {OFFLINE_NOTE_QUARANTINE_COPY} from '@/ui/situationCatalog';
import React, { createContext, useContext, useEffect, useCallback, useSyncExternalStore } from "react";
import type { OfflineOutboxItem } from "./OfflineOutbox";
import {readPendingEntries,retainQuarantinedPending} from "./pendingStore";
import {usePermissions} from "@/lib/auth/PermissionsContext";
import {syncPendingFiles} from './syncPendingFiles';
import {replayOfflineWorkshopAction} from '@/app/actions/offlineWorkshop.actions';
import {prepareIntakeFileAction,finishIntakeFileAction,saveIntakeNoteAction} from '@/app/actions/eingang.actions';
import {uploadIntakeOriginal} from '@/modules/eingang/public';
import { createId } from "@paralleldrive/cuid2";

interface SyncContextValue {
  isOnline: boolean;
  outboxItems: OfflineOutboxItem[];
  addToOutbox: (item: Omit<OfflineOutboxItem, "id" | "status" | "retryCount" | "createdAt" | "updatedAt">) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);
const EMPTY_OUTBOX: OfflineOutboxItem[] = [];
let snapshotScope: string|null=null;
let activeScope: string|null=null;
let snapshotGeneration=0;
let outboxSnapshot: OfflineOutboxItem[] = EMPTY_OUTBOX;
const outboxListeners = new Set<() => void>();
const deviceStandPorts={
  orders:{list:getOrdersDb,read:(id:string)=>getLiveOrderCardAction({orderId:id})},
  customers:{list:getCustomersDb,read:(id:string)=>getCustomerSummaryAction({customerId:id})},
  quotes:{list:()=>listOpenQuotesAction({purpose:'device'}),read:(id:string)=>readQuoteAction({quoteId:id,purpose:'operations'})},
  messages:{read:()=>getIntakeMessagesAction({purpose:'device'})},
  today:{read:getTodayDeviceAction},currentScope:()=>activeScope,
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

async function refreshOutboxSnapshot(scope:string|null): Promise<void> {
  const generation=++snapshotGeneration;
  if(!scope)return;
  try {
    const entries=await readPendingEntries(scope);
    if(activeScope!==scope||generation!==snapshotGeneration)return;
    outboxSnapshot=entries.map(entry=>({id:entry.id,entityType:entry.kind==='file'?'photo':entry.kind==='note'?'phone_note':entry.kind==='workshop'?'item':'communication_draft',actionType:'create',localEntityId:'itemId' in entry?entry.itemId:entry.id,payload:{},...(entry.kind==='quarantine'&&entry.payload?.reason==='NOTE_SYNC_METADATA_MISSING'?{lastError:OFFLINE_NOTE_QUARANTINE_COPY.notice(entry.capturedAt||null)}:{}),status:entry.kind==='quarantine'?'conflict':'queued',retryCount:0,createdAt:entry.kind==='quarantine'?entry.capturedAt:'',updatedAt:entry.kind==='quarantine'?entry.capturedAt:''}));
    snapshotScope=scope;
    outboxListeners.forEach(listener=>listener());
  } catch (error) {
    // Retain the last confirmed snapshot; unavailable storage is not an empty queue.
    console.error("[OFFLINE_PENDING_READ_FAILED]",error instanceof Error?error.name:'UnknownError');
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

  useEffect(() => {
    activeScope=scope;
    const refresh=()=>{void refreshOutboxSnapshot(scope);};
    refresh();window.addEventListener('kreile-pending-changed',refresh);
    if(scope&&isOnline)void syncPendingFiles(scope,{saveNote:saveIntakeNoteAction,prepare:prepareIntakeFileAction,finish:finishIntakeFileAction,upload:uploadIntakeOriginal,currentScope:()=>activeScope,workshop:replayOfflineWorkshopAction,workshopAcknowledged:proof=>window.dispatchEvent(new CustomEvent('kreile-workshop-acknowledged',{detail:proof}))}).then(()=>refreshDeviceStand(scope,offline24h,deviceStandPorts)).catch(error=>console.error('[OFFLINE_SYNC_UNAVAILABLE]',error instanceof Error?error.name:'UnknownError'));
    return ()=>{window.removeEventListener('kreile-pending-changed',refresh);if(activeScope===scope)activeScope=null;};
  }, [scope,isOnline,offline24h]);

  const syncNow = useCallback(async () => {
    // Retry the same canonical queue; each command checks its current server
    // rights. Customer/order notes do not require the Eingang area on the client.
    if (!isOnline||!scope||activeScope!==scope) return;
    await syncPendingFiles(scope,{saveNote:saveIntakeNoteAction,prepare:prepareIntakeFileAction,finish:finishIntakeFileAction,upload:uploadIntakeOriginal,currentScope:()=>activeScope,workshop:replayOfflineWorkshopAction,workshopAcknowledged:proof=>window.dispatchEvent(new CustomEvent('kreile-workshop-acknowledged',{detail:proof}))});
    await refreshOutboxSnapshot(scope);
    await refreshDeviceStand(scope,offline24h,deviceStandPorts);
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
    <SyncContext.Provider value={{ isOnline, outboxItems, addToOutbox, removeItem, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}
