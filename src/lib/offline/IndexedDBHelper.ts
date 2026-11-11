import {readLegacyStore,rejectLegacyWrite} from './legacyReadOnly';
export interface OfflineAction {
  id: string; // unique cuid
  actionType: "ORDER_CREATE" | "ORDER_STATUS_UPDATE" | "MATERIAL_BOOKING" | "TIME_BOOKING" | "CUSTOMER_CREATE" | "CUSTOMER_UPDATE" | "INQUIRY_CREATE" | "INQUIRY_UPDATE_STATUS" | "INQUIRY_UPDATE_PRICING" | "ITEM_CREATE" | "ITEM_UPDATE" | "COMPLAINT_CREATE" | "COMPLAINT_UPDATE" | "APP_KVP_CREATE" | "BUSINESS_KVP_CREATE";
  payload: unknown;
  timestamp: string; // ISO format (creation time)
  expiresAt: string; // ISO format (expiration time)
}

// Unknown historical records remain readable without an upgrade or read_cache deletion.
export const IndexedDBHelper={
 async getDB():Promise<IDBDatabase>{rejectLegacyWrite();},
 async pushToQueue(actionType:OfflineAction['actionType'],payload:unknown):Promise<OfflineAction>{void actionType;void payload;rejectLegacyWrite();},
 async getQueue():Promise<OfflineAction[]>{return readLegacyStore('kreile_offline_db','write_queue');},
 async removeFromQueue(id:string):Promise<void>{void id;rejectLegacyWrite();},
 async clearQueue():Promise<void>{rejectLegacyWrite();}
};
