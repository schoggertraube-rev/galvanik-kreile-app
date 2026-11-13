import {afterEach,expect,it,vi} from 'vitest';
import {IndexedDBHelper} from '../IndexedDBHelper';
import {offlineOutbox} from '../OfflineOutbox';
import {syncQueue} from '../idbSync';
import {retainQuarantinedPending} from '../pendingStore';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it('the canonical queue acknowledges only commit, never an aborted write',async()=>{
 const request={result:undefined};
 const tx={oncomplete:null as null|(()=>void),onabort:null as null|(()=>void),onerror:null as null|(()=>void),error:null as Error|null,objectStore:()=>({put:()=>request,get:()=>{const read={result:undefined,onsuccess:null as null|(()=>void)};queueMicrotask(()=>read.onsuccess?.());return read;}})};
 const db={close:vi.fn(),transaction:()=>tx};
 vi.stubGlobal('indexedDB',{open:()=>{const opened={result:db,onsuccess:null as null|(()=>void)};queueMicrotask(()=>opened.onsuccess?.());return opened;}});
 const write=()=>retainQuarantinedPending('a'.repeat(64),{id:'TEST-stable-click',kind:'quarantine',capturedAt:'2026-11-10T00:00:00Z',payload:{clientEventId:'TEST-stable-click'}});
 let acknowledged=false;const pending=write().then(()=>{acknowledged=true;});const rejection=expect(pending).rejects.toThrow('INTAKE_PENDING_STORAGE_ABORTED');
 await new Promise<void>(resolve=>queueMicrotask(()=>queueMicrotask(resolve)));expect(acknowledged).toBe(false);
 tx.error=new Error('TEST disk full');tx.onabort?.();await rejection;expect(acknowledged).toBe(false);expect(db.close).toHaveBeenCalledTimes(1);
 const retry=write();await new Promise<void>(resolve=>queueMicrotask(()=>queueMicrotask(resolve)));tx.oncomplete?.();await retry;expect(db.close).toHaveBeenCalledTimes(2);
});
it('retired anonymous queues cannot write or erase originals',async()=>{
 const open=vi.fn();vi.stubGlobal('indexedDB',{open});
 await expect(IndexedDBHelper.pushToQueue('ORDER_STATUS_UPDATE',{})).rejects.toThrow('OFFLINE_LEGACY_READ_ONLY');
 await expect(IndexedDBHelper.clearQueue()).rejects.toThrow('OFFLINE_LEGACY_READ_ONLY');
 await expect(offlineOutbox.clearAll()).rejects.toThrow('OFFLINE_LEGACY_READ_ONLY');
 await expect(syncQueue.add('order','TEST-id','UPDATE',{})).rejects.toThrow('OFFLINE_LEGACY_READ_ONLY');
 await expect(syncQueue.remove('TEST-id')).rejects.toThrow('OFFLINE_LEGACY_READ_ONLY');expect(open).not.toHaveBeenCalled();
});
it('does not misreport unavailable historical storage as an empty outbox',async()=>{
 vi.stubGlobal('indexedDB',{open:()=>{const opened={error:new Error('TEST storage unavailable'),onerror:null as null|(()=>void)};queueMicrotask(()=>opened.onerror?.());return opened;}});
 await expect(offlineOutbox.getAllItems()).rejects.toThrow('TEST storage unavailable');
});
