// Only unacknowledged uploads, as specified by eingang.geraete. Server remains authoritative.
export type PendingOriginal = { id: string; itemId: string; kind: "file"; file: File; captureOrigin?: "warenfoto" | "dokument" }
  | { id: string; itemId: string; kind: "note"; text: string; textstand: string; dismissed: string[] };
const STORE = "originals";
async function database(scope: string): Promise<IDBDatabase> {
  if (!/^[0-9a-f]{64}$/.test(scope)) throw new Error("INTAKE_PENDING_SCOPE_REQUIRED");
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`kreile-pending-originals-v1-${scope}`, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("INTAKE_PENDING_STORAGE_UNAVAILABLE"));
    request.onblocked = () => reject(new Error("INTAKE_PENDING_STORAGE_BLOCKED"));
  });
}
async function transaction<T>(scope: string, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const connection = await database(scope);
  return new Promise((resolve, reject) => {
    const transaction = connection.transaction(STORE, mode);
    const request = work(transaction.objectStore(STORE));
    transaction.oncomplete = () => { connection.close(); resolve(request.result); };
    transaction.onerror = () => { connection.close(); reject(new Error("INTAKE_PENDING_STORAGE_FAILED")); };
    transaction.onabort = () => { connection.close(); reject(new Error("INTAKE_PENDING_STORAGE_ABORTED")); };
  });
}
export async function retainPendingOriginal(scope: string, original: PendingOriginal): Promise<void> { await transaction(scope, "readwrite", store => store.put(original)); }
export async function readPendingOriginals(scope: string): Promise<PendingOriginal[]> { return transaction(scope, "readonly", store => store.getAll()); }
export async function acknowledgePendingOriginal(scope: string, id: string, textstand?: string): Promise<void> {
  const connection = await database(scope);
  return new Promise((resolve, reject) => {
    const transaction = connection.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const request = store.get(id);
    request.onsuccess = () => {
      const original = request.result as PendingOriginal | undefined;
      if (!original || textstand && (original.kind !== "note" || original.textstand !== textstand)) return;
      store.delete(id);
    };
    transaction.oncomplete = () => { connection.close(); resolve(); };
    transaction.onerror = () => { connection.close(); reject(new Error("INTAKE_PENDING_ACK_FAILED")); };
    transaction.onabort = () => { connection.close(); reject(new Error("INTAKE_PENDING_ACK_ABORTED")); };
  });
}
