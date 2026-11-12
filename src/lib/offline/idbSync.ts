import {readLegacyStore,rejectLegacyWrite} from './legacyReadOnly';
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

// No anonymous writes, silent fallback or deletion; these are unassigned legacy originals.
export const syncQueue={
 async add(entityType:string,entityId:string,operation:SyncOperation,payload:Record<string,unknown>):Promise<string>{void entityType;void entityId;void operation;void payload;rejectLegacyWrite();},
 async getAll():Promise<SyncMutation[]>{
  const rows=await readLegacyStore<SyncMutation>('kreile_sync_db','mutations');
  const raw=localStorage.getItem('kreile_sync_fallback');
  if(raw===null)return rows;
  const fallback:unknown=JSON.parse(raw);if(!Array.isArray(fallback))throw Error('OFFLINE_LEGACY_FALLBACK_INVALID');
  return [...rows,...fallback];
 },
 async markFailed(id:string,message:string):Promise<void>{void id;void message;rejectLegacyWrite();},
 async remove(id:string):Promise<void>{void id;rejectLegacyWrite();}
};
