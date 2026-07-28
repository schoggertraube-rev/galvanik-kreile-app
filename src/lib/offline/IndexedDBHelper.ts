import { createId } from "@paralleldrive/cuid2";

const DB_NAME = "kreile_offline_db";
const DB_VERSION = 2;

// Offline writes/deletes remain disabled until W3 defines tenant ownership,
// idempotency and recovery receipts. Existing browser data is preserved.
function isOfflineQueueContractEnabled(): boolean {
  return false;
}

function offlineQueueContractUnavailable(): never {
  throw new Error("NOT_CONFIGURED: Die lokale Offline-Warteschlange besitzt keinen bestätigten Server-Receipt-Vertrag.");
}

export interface OfflineAction {
  id: string; // unique cuid
  actionType: "ORDER_CREATE" | "ORDER_STATUS_UPDATE" | "MATERIAL_BOOKING" | "TIME_BOOKING" | "CUSTOMER_CREATE" | "CUSTOMER_UPDATE" | "INQUIRY_CREATE" | "INQUIRY_UPDATE_STATUS" | "INQUIRY_UPDATE_PRICING" | "ITEM_CREATE" | "ITEM_UPDATE" | "COMPLAINT_CREATE" | "COMPLAINT_UPDATE" | "APP_KVP_CREATE" | "BUSINESS_KVP_CREATE";
  payload: unknown;
  timestamp: string; // ISO format (creation time)
  expiresAt: string; // ISO format (expiration time)
}

export const IndexedDBHelper = {
  getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("IndexedDB is only available in browser environments."));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const target = event.target as IDBOpenDBRequest;
        const db = target.result;
        if (!db.objectStoreNames.contains("write_queue")) {
          db.createObjectStore("write_queue", { keyPath: "id" });
        }
        // Do not remove legacy object stores during a repair. They are ignored
        // by the current application until a reviewed recovery path exists.
      };
    });
  },

  async pushToQueue(actionType: OfflineAction["actionType"], payload: unknown): Promise<OfflineAction> {
    if (!isOfflineQueueContractEnabled()) return offlineQueueContractUnavailable();

    const db = await this.getDB();
    const id = createId();
    
    const now = new Date();
    const expires = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours from now

    const action: OfflineAction = {
      id,
      actionType,
      payload,
      timestamp: now.toISOString(),
      expiresAt: expires.toISOString()
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction("write_queue", "readwrite");
      const store = transaction.objectStore("write_queue");
      const request = store.add(action);

      request.onsuccess = () => resolve(action);
      request.onerror = () => reject(request.error);
    });
  },

  async getQueue(): Promise<OfflineAction[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("write_queue", "readonly");
      const store = transaction.objectStore("write_queue");
      const request = store.getAll();

      request.onsuccess = () => {
        const sorted = request.result.sort(
          (a: OfflineAction, b: OfflineAction) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        resolve(sorted);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async removeFromQueue(id: string): Promise<void> {
    if (!isOfflineQueueContractEnabled()) return offlineQueueContractUnavailable();

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("write_queue", "readwrite");
      const store = transaction.objectStore("write_queue");
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async clearQueue(): Promise<void> {
    if (!isOfflineQueueContractEnabled()) return offlineQueueContractUnavailable();

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("write_queue", "readwrite");
      const store = transaction.objectStore("write_queue");
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};
