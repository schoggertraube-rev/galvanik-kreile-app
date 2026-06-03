import { createId } from "@paralleldrive/cuid2";

const DB_NAME = "kreile_offline_db";
const DB_VERSION = 1;

export interface OfflineAction {
  id: string; // unique cuid
  actionType: "ORDER_CREATE" | "ORDER_STATUS_UPDATE" | "MATERIAL_BOOKING" | "TIME_BOOKING" | "CUSTOMER_CREATE" | "CUSTOMER_UPDATE" | "INQUIRY_CREATE" | "INQUIRY_UPDATE_STATUS" | "INQUIRY_UPDATE_PRICING" | "ITEM_CREATE" | "ITEM_UPDATE" | "COMPLAINT_CREATE" | "COMPLAINT_UPDATE" | "APP_KVP_CREATE" | "BUSINESS_KVP_CREATE";
  payload: unknown;
  timestamp: string; // ISO format
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
        if (!db.objectStoreNames.contains("read_cache")) {
          db.createObjectStore("read_cache"); // key is string (e.g. 'orders', 'customers')
        }
      };
    });
  },

  async pushToQueue(actionType: OfflineAction["actionType"], payload: unknown): Promise<OfflineAction> {
    const db = await this.getDB();
    const id = createId();
    const action: OfflineAction = {
      id,
      actionType,
      payload,
      timestamp: new Date().toISOString()
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
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("write_queue", "readwrite");
      const store = transaction.objectStore("write_queue");
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async saveSnapshot(key: "orders" | "customers" | "inquiries" | "items" | "complaints", data: unknown[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("read_cache", "readwrite");
      const store = transaction.objectStore("read_cache");
      const request = store.put(data, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getSnapshot<T>(key: "orders" | "customers" | "inquiries" | "items" | "complaints"): Promise<T[] | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction("read_cache", "readonly");
        const store = transaction.objectStore("read_cache");
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }
};
