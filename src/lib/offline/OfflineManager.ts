import { IndexedDBHelper, OfflineAction } from "./IndexedDBHelper";

// CONTAINMENT: sync disabled until OFFLINE-48H-001 implements idempotent drain.
// The previous syncQueue() deleted queue entries on ANY error (catch block),
// causing silent data loss. Queue writes are preserved; drain is disabled.

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

    // CONTAINMENT: auto-sync on reconnect removed — was calling syncQueue()
    // which deletes entries on error. Re-enable with OFFLINE-48H-001.
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
    // CONTAINMENT: sync disabled until OFFLINE-48H-001.
    // Previous implementation deleted queue entries on sync errors,
    // causing silent data loss. Entries are preserved in IndexedDB
    // until a proper idempotent drain is implemented.
    console.warn("[OfflineManager] syncQueue disabled — OFFLINE-48H-001 pending");
    return;
  }
};

// CONTAINMENT: auto-sync on browser "online" event removed.
// Was: window.addEventListener("online", () => OfflineManager.syncQueue())
// Re-enable with OFFLINE-48H-001.
