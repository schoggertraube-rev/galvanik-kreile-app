"use client";

import React, { createContext, useContext } from "react";
import type { OfflineOutboxItem } from "./OfflineOutbox";

interface SyncContextValue {
  isOnline: boolean;
  outboxItems: OfflineOutboxItem[];
  outboxAvailability: "loading" | "ready" | "unavailable";
  addToOutbox: (item: Omit<OfflineOutboxItem, "id" | "status" | "retryCount" | "createdAt" | "updatedAt">) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

function unavailable(): never {
  throw new Error("NOT_CONFIGURED: Offline-Synchronisierung besitzt keinen bestätigten Server-Receipt-Vertrag.");
}

const unavailableContextValue: SyncContextValue = {
  isOnline: false,
  outboxItems: [],
  outboxAvailability: "unavailable",
  async addToOutbox(item) {
    void item;
    return unavailable();
  },
  async removeItem(id) {
    void id;
    return unavailable();
  },
  async syncNow() {
    return unavailable();
  },
};

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSync must be used within SyncProvider");
  }
  return context;
}

/**
 * Keep the provider mounted so legacy consumers fail explicitly rather than
 * creating browser-local writes or pretending they were synchronized.
 */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  return <SyncContext.Provider value={unavailableContextValue}>{children}</SyncContext.Provider>;
}
