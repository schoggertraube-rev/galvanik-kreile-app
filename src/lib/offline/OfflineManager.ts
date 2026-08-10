import { IndexedDBHelper, OfflineAction } from "./IndexedDBHelper";

export const OfflineManager = {
  isOffline(): boolean {
    if (typeof window === "undefined") return false;
    
    // Check if network simulation offline is enabled
    const simulated = localStorage.getItem("kreile_simulated_offline") === "true";
    if (simulated) return true;
    
    // Fallback to real browser network status
    return !navigator.onLine;
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
    try {
      const queue = await IndexedDBHelper.getQueue();
      return queue.length;
    } catch {
      return 0;
    }
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

  async syncQueue(): Promise<void> {
    if (this.isOffline()) {
      console.log("📴 Sync requested, but app is currently offline. Aborting.");
      return;
    }

    const queue = await IndexedDBHelper.getQueue();
    if (queue.length === 0) return;

    for (const item of queue) {
      console.warn(`NOT_AVAILABLE: queued ${item.actionType} action ${item.id} remains pending until a secure command contract exists.`);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("kreile-sync-success", { detail: { count: 0, blockedCount: queue.length } }));
    }
  }
};

// Global browser listeners for automatic synchronization
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("🌐 Browser regained network connection. Starting auto-sync.");
    OfflineManager.syncQueue().catch(err => console.error("Browser auto-sync failed:", err));
  });
}
