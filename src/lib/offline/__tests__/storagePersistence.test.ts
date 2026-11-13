import {afterEach,expect,it,vi} from 'vitest';
const original=Object.getOwnPropertyDescriptor(navigator,'storage');
function capability(value:StorageManager){Object.defineProperty(navigator,'storage',{configurable:true,get:()=>value});}
afterEach(()=>{if(original)Object.defineProperty(navigator,'storage',original);else Reflect.deleteProperty(navigator,'storage');vi.restoreAllMocks();vi.unstubAllGlobals();});
it.each([true,false])('requests persistence once and preserves the actual platform answer %s',async granted=>{
 vi.resetModules();const persist=vi.fn(async()=>granted);capability({persist} as unknown as StorageManager);
 const persistence=await import('../storagePersistence');expect(persistence.readStoragePersistence()).toBe('UNKNOWN');
 expect(await Promise.all([persistence.requestStoragePersistence(),persistence.requestStoragePersistence()])).toEqual([granted?'GRANTED':'DENIED',granted?'GRANTED':'DENIED']);expect(persist).toHaveBeenCalledOnce();
});
it('missing or failing capability is explicitly unavailable, never silently persistent',async()=>{
 vi.resetModules();capability({} as StorageManager);const persistence=await import('../storagePersistence');expect(await persistence.requestStoragePersistence()).toBe('UNAVAILABLE');
 vi.resetModules();capability({persist:async()=>{throw new DOMException('TEST denied','SecurityError');}} as unknown as StorageManager);const failed=await import('../storagePersistence');expect(await failed.requestStoragePersistence()).toBe('UNAVAILABLE');
});
