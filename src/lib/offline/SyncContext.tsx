"use client";

import React, { createContext, useContext, useEffect, useCallback, useSyncExternalStore } from "react";
import { offlineOutbox, OfflineOutboxItem } from "./OfflineOutbox";
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

function getOutboxSnapshot(): OfflineOutboxItem[] {
  return outboxSnapshot;
}

async function refreshOutboxSnapshot(): Promise<void> {
  try {
    outboxSnapshot = await offlineOutbox.getAllItems();
    outboxListeners.forEach((listener) => listener());
  } catch (error) {
    console.error("Failed to load outbox", error);
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
  const isOnline = useSyncExternalStore(subscribeToNetworkStatus, getOnlineSnapshot, () => true);
  const outboxItems = useSyncExternalStore(subscribeToOutbox, getOutboxSnapshot, () => EMPTY_OUTBOX);

  useEffect(() => {
    void refreshOutboxSnapshot();
  }, []);

  const syncNow = useCallback(async () => {
    // CONTAINMENT (OFFLINE-48H-001): No real server sync transport exists yet.
    // The previous implementation deleted outbox items after a fake 600ms delay
    // WITHOUT transmitting them to the server, causing silent data loss on
    // reconnect. Until a real, verified sync transport is implemented, syncNow
    // must NEVER remove or mutate outbox items. It only refreshes the snapshot
    // so the UI reflects the pending, still-intact items.
    if (!isOnline) return;
    await refreshOutboxSnapshot();
  }, [isOnline]);

  const addToOutbox = useCallback(async (itemData: Omit<OfflineOutboxItem, "id" | "status" | "retryCount" | "createdAt" | "updatedAt">) => {
    const newItem: OfflineOutboxItem = {
      ...itemData,
      id: createId(),
      status: isOnline ? "queued" : "draft",
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await offlineOutbox.saveItem(newItem);
    await refreshOutboxSnapshot();
  }, [isOnline]);

  const removeItem = useCallback(async (id: string) => {
    await offlineOutbox.removeItem(id);
    await refreshOutboxSnapshot();
  }, []);

  // CONTAINMENT (OFFLINE-48H-001): Auto-refresh outbox snapshot when coming
  // online. This deliberately does NOT trigger any deletion or fake sync.
  useEffect(() => {
    if (isOnline && outboxItems.length > 0) {
      void syncNow();
    }
  }, [isOnline, outboxItems.length, syncNow]);

  return (
    <SyncContext.Provider value={{ isOnline, outboxItems, addToOutbox, removeItem, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}
