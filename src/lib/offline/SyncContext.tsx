"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useEffectEvent, useSyncExternalStore } from "react";
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

function subscribeToOnlineStatus(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);

  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineStatus() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

const getServerOnlineStatus = () => true;

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error("useSync must be used within SyncProvider");
  }
  return ctx;
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    getOnlineStatus,
    getServerOnlineStatus,
  );
  const [outboxItems, setOutboxItems] = useState<OfflineOutboxItem[]>([]);

  const loadOutbox = useCallback(async () => {
    try {
      const items = await offlineOutbox.getAllItems();
      setOutboxItems(items);
    } catch (err) {
      console.error("Failed to load outbox", err);
    }
  }, []);

  useEffect(() => {
    void offlineOutbox.getAllItems()
      .then(setOutboxItems)
      .catch((err) => console.error("Failed to load outbox", err));
  }, []);

  const addToOutbox = async (itemData: Omit<OfflineOutboxItem, "id" | "status" | "retryCount" | "createdAt" | "updatedAt">) => {
    const newItem: OfflineOutboxItem = {
      ...itemData,
      id: createId(),
      status: isOnline ? "queued" : "draft",
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await offlineOutbox.saveItem(newItem);
    await loadOutbox();
    
    if (isOnline) {
      // Trigger sync
      syncNow();
    }
  };

  const removeItem = async (id: string) => {
    await offlineOutbox.removeItem(id);
    await loadOutbox();
  };

  const syncNow = async () => {
    if (!isOnline) return;
    
    // Detailed Sync logic goes here.
    // For Phase 2, we just mark as "synced" or remove them if mock successful.
    const items = await offlineOutbox.getAllItems();
    for (const item of items) {
      if (item.status === "draft" || item.status === "queued" || item.status === "failed") {
        try {
          // Simulate network delay
          await new Promise(r => setTimeout(r, 600));
          // Mock success
          await offlineOutbox.removeItem(item.id);
        } catch {
          item.status = "failed";
          item.retryCount += 1;
          await offlineOutbox.saveItem(item);
        }
      }
    }
    await loadOutbox();
  };

  const autoSyncWhenOnline = useEffectEvent(() => {
    if (outboxItems.length > 0) {
      void syncNow();
    }
  });

  // Auto sync when coming online
  useEffect(() => {
    if (isOnline) {
      autoSyncWhenOnline();
    }
  }, [isOnline]);

  return (
    <SyncContext.Provider value={{ isOnline, outboxItems, addToOutbox, removeItem, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}
