import { IndexedDBHelper, OfflineAction } from "./IndexedDBHelper";

export type SyncQueueResult = {
  confirmed: number;
  remaining: number;
  blocked: number;
  reason: "network_unavailable" | "adapter_missing" | "none";
};

export type BrowserNetworkStatus = "unknown" | "available" | "offline";

export const OfflineManager = {
  getBrowserNetworkStatus(): BrowserNetworkStatus {
    if (typeof window === "undefined") return "unknown";

    const simulated = localStorage.getItem("kreile_simulated_offline") === "true";
    if (simulated) return "offline";

    // navigator.onLine is only a browser transport hint. It does not prove that
    // the application backend, tenant session, or a write adapter is reachable.
    return navigator.onLine ? "available" : "offline";
  },

  isOffline(): boolean {
    return this.getBrowserNetworkStatus() === "offline";
  },

  setSimulatedOffline(offline: boolean): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("kreile_simulated_offline", offline ? "true" : "false");
    
    // Dispatch network change event
    window.dispatchEvent(new CustomEvent("kreile-network-change", { 
      detail: { offline: this.isOffline(), simulated: true } 
    }));
    
    // Dispatch storage event to trigger topbar refresh
    window.dispatchEvent(new Event("storage"));
    
    // If we just went online, trigger synchronization
    if (!offline) {
      this.syncQueue().catch(err => console.error("Sync after simulated reconnect failed:", err));
    }
  },

  toggleSimulatedOffline(): void {
    const current = this.isOffline();
    this.setSimulatedOffline(!current);
  },

  async getPendingCount(): Promise<number> {
    const queue = await IndexedDBHelper.getQueue();
    return queue.length;
  },

  async enqueueAction(actionType: OfflineAction["actionType"], payload: unknown): Promise<OfflineAction> {
    const action = await IndexedDBHelper.pushToQueue(actionType, payload);
    
    // Dispatch queue update event
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("kreile-sync-queue-updated"));
      window.dispatchEvent(new Event("storage")); // force reactive UI repaint
    }
    
    return action;
  },

  async syncQueue(): Promise<SyncQueueResult> {
    if (this.getBrowserNetworkStatus() !== "available") {
      const remaining = await this.getPendingCount();
      return { confirmed: 0, remaining, blocked: remaining, reason: "network_unavailable" };
    }

    const queue = await IndexedDBHelper.getQueue();
    // None of the legacy queued payloads currently carries a server-enforced
    // idempotency key plus a verifiable receipt. Sending them would risk either
    // duplicate writes or local data loss. Preserve every item until a concrete
    // action adapter fulfils that contract.
    const result: SyncQueueResult = {
      confirmed: 0,
      remaining: queue.length,
      blocked: queue.length,
      reason: queue.length > 0 ? "adapter_missing" : "none",
    };

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("kreile-sync-queue-updated"));
      window.dispatchEvent(new CustomEvent("kreile-sync-complete", { detail: result }));
      window.dispatchEvent(new Event("storage"));
    }

    return result;
  }
};
