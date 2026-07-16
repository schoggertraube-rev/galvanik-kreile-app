export type OfflineOutboxItem = {
  id: string;
  entityType:
    | "order"
    | "customer"
    | "item"
    | "photo"
    | "document"
    | "phone_note"
    | "status_event"
    | "payment_note"
    | "complaint"
    | "kvp"
    | "communication_draft";
  actionType: "create" | "update" | "delete" | "upload" | "send_draft";
  localEntityId: string;
  remoteEntityId?: string;
  payload: Record<string, unknown>;
  status: "draft" | "queued" | "syncing" | "synced" | "failed" | "conflict";
  retryCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  userId?: string;
  deviceId?: string;
};

const DB_NAME = "KreileOfflineOutboxDB";
const STORE_NAME = "outbox";
const DB_VERSION = 1;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported"));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

export const offlineOutbox = {
  async saveItem(item: OfflineOutboxItem): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || req.error || new Error("Offline outbox write failed"));
      tx.onabort = () => reject(tx.error || new Error("Offline outbox write aborted"));
    });
  },

  async getAllItems(): Promise<OfflineOutboxItem[]> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      let result: OfflineOutboxItem[] | null = null;
      req.onsuccess = () => { result = req.result as OfflineOutboxItem[]; };
      tx.oncomplete = () => resolve(result ?? []);
      tx.onerror = () => reject(tx.error || req.error || new Error("Offline outbox read failed"));
      tx.onabort = () => reject(tx.error || new Error("Offline outbox read aborted"));
    });
  },

  async removeItem(id: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || req.error || new Error("Offline outbox delete failed"));
      tx.onabort = () => reject(tx.error || new Error("Offline outbox delete aborted"));
    });
  },
  
  async clearAll(): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || req.error || new Error("Offline outbox clear failed"));
      tx.onabort = () => reject(tx.error || new Error("Offline outbox clear aborted"));
    });
  }
};
