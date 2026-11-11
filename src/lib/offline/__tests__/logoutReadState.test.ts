import {afterEach,expect,it,vi} from 'vitest';
const ports=vi.hoisted(()=>({revoke:vi.fn(),read:vi.fn()}));
vi.mock('../pendingStore',()=>({revokePendingShells:ports.revoke,readPendingEntries:ports.read}));
import {clearLoggedOutReadState,privateReadCachePrefix} from '../logoutReadState';
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
it('removes only this actor reading caches and leaves originals and public/foreign caches untouched',async()=>{
 const scope='a'.repeat(64),remove=vi.fn(async()=>true);
 ports.revoke.mockResolvedValue({loginScopes:['TEST-login'],quarantined:0});
 ports.read.mockResolvedValue([{id:'TEST-original',actor:'TEST-original-actor'}]);
 vi.stubGlobal('caches',{keys:async()=>[privateReadCachePrefix(scope)+'1','kreile-private-'+ 'b'.repeat(64)+'-1','kreile-static-assets-v1'],delete:remove});
 expect(await clearLoggedOutReadState(scope)).toEqual({cacheCleared:true,pendingCount:1});
 expect(remove).toHaveBeenCalledExactlyOnceWith(privateReadCachePrefix(scope)+'1');
 expect(ports.read).toHaveBeenCalledExactlyOnceWith(scope);
});
it('reports local failure instead of blocking logout or inventing an empty queue',async()=>{
 ports.revoke.mockRejectedValue(Error('TEST-IDB'));
 ports.read.mockRejectedValue(Error('TEST-read'));
 vi.stubGlobal('caches',{keys:async()=>{throw Error('TEST-cache');}});
 expect(await clearLoggedOutReadState('a'.repeat(64))).toEqual({cacheCleared:false,pendingCount:null});
});
