import {readLegacyStore,rejectLegacyWrite} from './legacyReadOnly';
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

// Read-only historical API; the active queue is pendingStore.ts.
export const offlineOutbox={
 async saveItem(item:OfflineOutboxItem):Promise<void>{void item;rejectLegacyWrite();},
 async getAllItems():Promise<OfflineOutboxItem[]>{return readLegacyStore('KreileOfflineOutboxDB','outbox');},
 async removeItem(id:string):Promise<void>{void id;rejectLegacyWrite();},
 async clearAll():Promise<void>{rejectLegacyWrite();}
};
