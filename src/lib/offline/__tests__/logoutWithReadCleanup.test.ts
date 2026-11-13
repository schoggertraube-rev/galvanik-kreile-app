import {afterEach,expect,it,vi} from 'vitest';
const ports=vi.hoisted(()=>({logout:vi.fn(),cleanup:vi.fn(),sync:vi.fn()}));
vi.mock('../syncOriginals',()=>({syncOriginals:ports.sync}));
vi.mock('@/app/actions/auth',()=>({logout:ports.logout}));
vi.mock('../logoutReadState',()=>({clearLoggedOutReadState:ports.cleanup}));
import {logoutWithReadCleanup,readLogoutNotice} from '../logoutWithReadCleanup';
afterEach(()=>{vi.clearAllMocks();vi.useRealTimers();delete document.documentElement.dataset.offlineScope;});
it('ends the actual session before local cleanup and publishes the exact queue notice',async()=>{
 const scope='a'.repeat(64);document.documentElement.dataset.offlineScope=scope;
 ports.logout.mockResolvedValue({ok:true,remoteSignOut:'success'});
 ports.cleanup.mockImplementation(async()=>{expect(ports.logout).toHaveBeenCalledOnce();expect(document.documentElement.dataset.authStatus).toBe('unauthenticated');return {cacheCleared:true,pendingCount:2};});
 await logoutWithReadCleanup();
 expect(ports.cleanup).toHaveBeenCalledWith(scope);
 expect(readLogoutNotice()).toBe('2 Aktionen warten auf Netz - sie gehen raus, sobald du wieder angemeldet und online bist');
});
it('flushes delayed originals under the current session before logout, without keepalive',async()=>{
 const scope='b'.repeat(64);document.documentElement.dataset.offlineScope=scope;
 ports.sync.mockImplementation(async(partition,current,options)=>{expect(partition).toBe(scope);expect(current()).toBe(scope);expect(options).toEqual({flushDelayed:true,workshopOnly:true});expect(ports.logout).not.toHaveBeenCalled();});
 ports.logout.mockResolvedValue({ok:true});ports.cleanup.mockResolvedValue({cacheCleared:true,pendingCount:0});
 await logoutWithReadCleanup();expect(ports.sync).toHaveBeenCalledOnce();expect(ports.logout).toHaveBeenCalledOnce();
});
it('a failed flush retains the pending notice and still allows logout',async()=>{
 document.documentElement.dataset.offlineScope='c'.repeat(64);ports.sync.mockRejectedValue(Error('TEST_NETWORK_LOST'));
 ports.logout.mockResolvedValue({ok:true});ports.cleanup.mockResolvedValue({cacheCleared:true,pendingCount:1});
 await logoutWithReadCleanup();expect(ports.logout).toHaveBeenCalledOnce();expect(readLogoutNotice()).toBe('1 Aktionen warten auf Netz - sie gehen raus, sobald du wieder angemeldet und online bist');
});
it('a blocked local store cannot hold the logged-out user indefinitely',async()=>{
 vi.useFakeTimers();ports.logout.mockResolvedValue({ok:true});ports.cleanup.mockReturnValue(new Promise(()=>{}));
 const logout=logoutWithReadCleanup();await vi.advanceTimersByTimeAsync(1500);await logout;
 expect(readLogoutNotice()).toBe('Du bist abgemeldet. Die gespeicherten Daten auf diesem Gerät werden beim nächsten Start gelöscht.');
});
it('still fences local reading state after a lost server response without claiming logout success',async()=>{
 const failure=Error('TEST lost logout response');ports.logout.mockRejectedValue(failure);
 document.documentElement.dataset.offlineScope='a'.repeat(64);
 ports.cleanup.mockResolvedValue({cacheCleared:true,pendingCount:1});
 await expect(logoutWithReadCleanup()).rejects.toBe(failure);
 expect(ports.cleanup).toHaveBeenCalledWith('a'.repeat(64));
 expect(document.documentElement.dataset.authStatus).toBe('error');
 expect(document.documentElement.dataset.offlineScope).toBeUndefined();
 expect(readLogoutNotice()).toBe('');
});
