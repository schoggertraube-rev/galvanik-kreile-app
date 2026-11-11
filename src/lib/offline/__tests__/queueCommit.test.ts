import {afterEach,expect,it,vi} from 'vitest';
import {IndexedDBHelper} from '../IndexedDBHelper';
import {offlineOutbox,type OfflineOutboxItem} from '../OfflineOutbox';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

it.each(['legacy','outbox'] as const)('%s does not acknowledge a rolled-back offline write',async kind=>{
 const request={onsuccess:null as null|(()=>void)};
 const tx={oncomplete:null as null|(()=>void),onabort:null as null|(()=>void),onerror:null as null|(()=>void),error:null as Error|null,objectStore:()=>({add:()=>request,put:()=>request})};
 const db={close:vi.fn(),transaction:()=>tx};
 if(kind==='legacy')vi.spyOn(IndexedDBHelper,'getDB').mockResolvedValue(db as unknown as IDBDatabase);
 else vi.stubGlobal('indexedDB',{open:()=>{const opened={result:db,onsuccess:null as null|(()=>void)};queueMicrotask(()=>opened.onsuccess?.());return opened;}});
 const write=()=>kind==='legacy'?IndexedDBHelper.pushToQueue('ORDER_STATUS_UPDATE',{clientEventId:'TEST-stable-click'}):offlineOutbox.saveItem({id:'TEST-stable-click',entityType:'order',actionType:'update',localEntityId:'TEST-order',payload:{clientEventId:'TEST-stable-click'},status:'queued',retryCount:0,createdAt:'2026-11-10T00:00:00Z',updatedAt:'2026-11-10T00:00:00Z'} satisfies OfflineOutboxItem);
 let acknowledged=false;
 const pending=write().then(()=>{acknowledged=true;});
 const rejection=expect(pending).rejects.toThrow('TEST disk full');
 await new Promise<void>(resolve=>queueMicrotask(()=>queueMicrotask(resolve)));
 request.onsuccess?.();await Promise.resolve();expect(acknowledged).toBe(false);
 tx.error=new Error('TEST disk full');tx.onabort?.();await rejection;
 expect(acknowledged).toBe(false);expect(db.close).toHaveBeenCalledTimes(1);
 // The same pending business payload can be retried; only commit acknowledges it.
 tx.error=null;const retry=write();await new Promise<void>(resolve=>queueMicrotask(()=>queueMicrotask(resolve)));
 tx.oncomplete?.();await retry;expect(db.close).toHaveBeenCalledTimes(2);
});

it('does not misreport unavailable pending storage as an empty outbox',async()=>{
 vi.stubGlobal('indexedDB',{open:()=>{const opened={error:new Error('TEST storage unavailable'),onerror:null as null|(()=>void)};queueMicrotask(()=>opened.onerror?.());return opened;}});
 await expect(offlineOutbox.getAllItems()).rejects.toThrow('TEST storage unavailable');
});
