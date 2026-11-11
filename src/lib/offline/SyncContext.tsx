"use client";

import React, { createContext, useContext, useEffect, useCallback, useSyncExternalStore } from "react";
import type { OfflineOutboxItem } from "./OfflineOutbox";
import {readPendingEntries,retainQuarantinedPending} from "./pendingStore";
import {usePermissions} from "@/lib/auth/PermissionsContext";
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
    outboxSnapshot=entries.map(entry=>({id:entry.id,entityType:entry.kind==='file'?'photo':entry.kind==='note'?'phone_note':'communication_draft',actionType:'create',localEntityId:'itemId' in entry?entry.itemId:entry.id,payload:{},status:entry.kind==='quarantine'?'conflict':'queued',retryCount:0,createdAt:entry.kind==='quarantine'?entry.capturedAt:'',updatedAt:entry.kind==='quarantine'?entry.capturedAt:''}));
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
  const {offlineScope,status}=usePermissions();
  const scope=status==="authenticated"?offlineScope:null;
  const isOnline = useSyncExternalStore(subscribeToNetworkStatus, getOnlineSnapshot, () => true);
  const outboxItems = useSyncExternalStore(subscribeToOutbox, ()=>getOutboxSnapshot(scope), () => EMPTY_OUTBOX);

  useEffect(() => {
    activeScope=scope;
    const refresh=()=>{void refreshOutboxSnapshot(scope);};
    refresh();window.addEventListener('kreile-pending-changed',refresh);
    return ()=>{window.removeEventListener('kreile-pending-changed',refresh);if(activeScope===scope)activeScope=null;};
  }, [scope,isOnline]);

  const syncNow = useCallback(async () => {
    // CONTAINMENT (OFFLINE-48H-001): No real server sync transport exists yet.
    // The previous implementation deleted outbox items after a fake 600ms delay
    // WITHOUT transmitting them to the server, causing silent data loss on
    // reconnect. Until a real, verified sync transport is implemented, syncNow
    // must NEVER remove or mutate outbox items. It only refreshes the snapshot
    // so the UI reflects the pending, still-intact items.
    if (!isOnline) return;
    await refreshOutboxSnapshot(scope);
  }, [isOnline,scope]);

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
