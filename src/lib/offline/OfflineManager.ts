import { IndexedDBHelper, type OfflineAction } from "./IndexedDBHelper";

/**
 * Offline is currently read-only: the browser may report its connectivity and
 * preserve already-existing queued entries, but it must never simulate a
 * connection, enqueue a mutation, synchronise, expire, or delete a queue item.
 */
export const OfflineManager = {
  isOffline(): boolean {
    return typeof window !== "undefined" && !window.navigator.onLine;
  },

  setSimulatedOffline(_offline: boolean): never {
    throw new Error("NOT_CONFIGURED: Offline-Simulation und lokale Warteschlange sind nicht freigegeben.");
  },

  toggleSimulatedOffline(): never {
    throw new Error("NOT_CONFIGURED: Offline-Simulation und lokale Warteschlange sind nicht freigegeben.");
  },

  async getPendingCount(): Promise<number> {
    const queue = await IndexedDBHelper.getQueue();
    return queue.length;
  },

  async enqueueAction(_actionType: OfflineAction["actionType"], _payload: unknown): Promise<OfflineAction> {
    throw new Error("NOT_CONFIGURED: Offline-Aktionen werden nicht lokal als erfolgreich vorgemerkt.");
  },

  async syncQueue(): Promise<void> {
    throw new Error("NOT_CONFIGURED: Die lokale Offline-Warteschlange wird nicht ohne bestätigten Server-Receipt geleert.");
  },
};
