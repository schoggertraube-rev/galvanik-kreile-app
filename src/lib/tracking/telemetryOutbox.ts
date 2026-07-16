import type { UsageEventInput } from '@/lib/telemetry/contract'

const DB_NAME = 'kreile_usage_telemetry_outbox'
const STORE = 'events'
const MAX_OUTBOX_EVENTS = 500

export type StoredTelemetryEvent = {
  id: string
  event: UsageEventInput
  state: 'pending' | 'blocked'
  attempts: number
  lastError?: string
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: 'id' })
    }
  })
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const telemetryOutbox = {
  async enqueue(event: UsageEventInput): Promise<boolean> {
    const database = await openDatabase()
    const transaction = database.transaction(STORE, 'readwrite')
    const store = transaction.objectStore(STORE)
    const count = await requestValue(store.count())
    if (count >= MAX_OUTBOX_EVENTS) return false
    await requestValue(store.add({ id: event.clientEventId, event, state: 'pending', attempts: 0 } satisfies StoredTelemetryEvent))
    return true
  },

  async pending(limit = 25): Promise<StoredTelemetryEvent[]> {
    const database = await openDatabase()
    const all = await requestValue(database.transaction(STORE, 'readonly').objectStore(STORE).getAll()) as StoredTelemetryEvent[]
    return all.filter((entry) => entry.state === 'pending').slice(0, limit)
  },

  async remove(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const database = await openDatabase()
    const transaction = database.transaction(STORE, 'readwrite')
    const store = transaction.objectStore(STORE)
    for (const id of ids) store.delete(id)
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  },

  async block(entries: StoredTelemetryEvent[], code: string): Promise<void> {
    if (entries.length === 0) return
    const database = await openDatabase()
    const transaction = database.transaction(STORE, 'readwrite')
    const store = transaction.objectStore(STORE)
    for (const entry of entries) {
      store.put({ ...entry, state: 'blocked', attempts: entry.attempts + 1, lastError: code.slice(0, 80) } satisfies StoredTelemetryEvent)
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  },
}
