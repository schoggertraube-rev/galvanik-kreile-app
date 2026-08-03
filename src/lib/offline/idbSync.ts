// src/lib/offline/idbSync.ts
// ULID-basierte Mutation Queue mit IndexedDB und localStorage Fallback

export type SyncOperation = "CREATE" | "UPDATE" | "DELETE";

export type SyncMutation = {
  id: string; // ULID
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  timestamp: string;
  status: "pending" | "syncing" | "failed";
  retryCount: number;
  lastError?: string;
};

const DB_NAME = "kreile_sync_db";
const STORE_NAME = "mutations";
let dbInstance: IDBDatabase | null = null;

function generateUlid(): string {
  // Simpler ULID-like generator for unique sortable IDs
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not supported"));
    }
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

export const syncQueue = {
  async add(
    entityType: string,
    entityId: string,
    operation: SyncOperation,
    payload: Record<string, unknown>
  ): Promise<string> {
    const mutation: SyncMutation = {
      id: generateUlid(),
      entityType,
      entityId,
      operation,
      payload,
      timestamp: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
    };

    try {
      const db = await initDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.add(mutation);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      return mutation.id;
    } catch (e) {
      console.warn("IndexedDB failed, falling back to localStorage", e);
      // Fallback
      const raw = localStorage.getItem("kreile_sync_fallback") || "[]";
      const q = JSON.parse(raw);
      q.push(mutation);
      localStorage.setItem("kreile_sync_fallback", JSON.stringify(q));
      return mutation.id;
    }
  },

  async getAll(): Promise<SyncMutation[]> {
    try {
      const db = await initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      const raw = localStorage.getItem("kreile_sync_fallback") || "[]";
      return JSON.parse(raw);
    }
  },

  async markFailed(id: string, errorMsg: string): Promise<void> {
    try {
      const db = await initDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => {
          const m = req.result;
          if (m) {
            m.status = "failed";
            m.retryCount++;
            m.lastError = errorMsg;
            store.put(m);
          }
          resolve();
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      // ignore
    }
  },

  async remove(id: string): Promise<void> {
    try {
      const db = await initDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // ignore
    }
  }
};
