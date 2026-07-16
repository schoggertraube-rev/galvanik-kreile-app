"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { IndexedDBHelper, type OfflineAction } from "./IndexedDBHelper";
import { OfflineManager, type BrowserNetworkStatus } from "./OfflineManager";

interface SyncContextValue {
  networkStatus: BrowserNetworkStatus;
  outboxItems: OfflineAction[];
  outboxError: string | null;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error("useSync must be used within SyncProvider");
  }
  return ctx;
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [networkStatus, setNetworkStatus] = useState<BrowserNetworkStatus>("unknown");
  const [outboxItems, setOutboxItems] = useState<OfflineAction[]>([]);
  const [outboxReadError, setOutboxReadError] = useState<string | null>(null);
  const [syncBlocker, setSyncBlocker] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const outboxError = outboxReadError ?? syncBlocker;

  const loadOutbox = useCallback(async () => {
    try {
      const items = await IndexedDBHelper.getQueue();
      setOutboxItems(items);
      setOutboxReadError(null);
    } catch (err) {
      console.error("Failed to load outbox", err);
      setOutboxReadError("Lokale Synchronisationswarteschlange ist nicht lesbar; Bestand unbekannt.");
    }
  }, []);

  useEffect(() => {
    const refreshNetwork = () => setNetworkStatus(OfflineManager.getBrowserNetworkStatus());
    const refreshQueue = () => { void loadOutbox(); };
    refreshNetwork();
    void loadOutbox();

    window.addEventListener("online", refreshNetwork);
    window.addEventListener("offline", refreshNetwork);
    window.addEventListener("kreile-network-change", refreshNetwork);
    window.addEventListener("kreile-sync-queue-updated", refreshQueue);
    return () => {
      window.removeEventListener("online", refreshNetwork);
      window.removeEventListener("offline", refreshNetwork);
      window.removeEventListener("kreile-network-change", refreshNetwork);
      window.removeEventListener("kreile-sync-queue-updated", refreshQueue);
    };
  }, [loadOutbox]);

  const syncNow = useCallback(async () => {
    if (networkStatus !== "available" || isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await OfflineManager.syncQueue();
      await loadOutbox();
      if (result.reason === "adapter_missing") {
        setSyncBlocker("Ausstehende Änderungen bleiben erhalten, weil noch kein idempotenter Backend-Belegvertrag angebunden ist.");
      } else if (result.reason === "network_unavailable") {
        setSyncBlocker("Der Browser meldet kein verfügbares Netzwerk; die lokalen Einträge bleiben erhalten.");
      } else {
        setSyncBlocker(null);
      }
    } catch (error) {
      console.error("Offline sync failed", error);
      setSyncBlocker("Synchronisation konnte nicht vom Backend bestätigt werden; die Einträge bleiben erhalten.");
      await loadOutbox().catch(() => undefined);
    } finally {
      setIsSyncing(false);
    }
  }, [networkStatus, isSyncing, loadOutbox]);

  return (
    <SyncContext.Provider value={{ networkStatus, outboxItems, outboxError, isSyncing, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}
