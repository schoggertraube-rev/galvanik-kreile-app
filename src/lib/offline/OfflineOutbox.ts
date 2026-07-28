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

// Existing local outbox entries may contain unsynchronised user work. A repair
// must never discard them before a dedicated tenant-bound recovery contract
// can prove whether the corresponding server receipt exists.
function isOfflineDestructiveRecoveryEnabled(): boolean {
  return false;
}

function offlineDestructiveRecoveryUnavailable(): never {
  throw new Error("NOT_CONFIGURED: Offline-Vormerkungen dürfen ohne bestätigten Wiederherstellungsvertrag nicht gelöscht werden.");
}

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
    if (!isOfflineDestructiveRecoveryEnabled()) return offlineDestructiveRecoveryUnavailable();

    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getAllItems(): Promise<OfflineOutboxItem[]> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as OfflineOutboxItem[]);
      req.onerror = () => reject(req.error);
    });
  },

  async removeItem(id: string): Promise<void> {
    if (!isOfflineDestructiveRecoveryEnabled()) return offlineDestructiveRecoveryUnavailable();

    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  
  async clearAll(): Promise<void> {
    if (!isOfflineDestructiveRecoveryEnabled()) return offlineDestructiveRecoveryUnavailable();

    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
};
