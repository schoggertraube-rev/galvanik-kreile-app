import {afterEach,expect,it,vi} from 'vitest';
const ports=vi.hoisted(()=>({logout:vi.fn(),cleanup:vi.fn()}));
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
 expect(readLogoutNotice()).toBe('Du bist abgemeldet. 2 Eingaben warten noch auf Netz und werden übertragen, sobald es da ist.');
});
it('a blocked local store cannot hold the logged-out user indefinitely',async()=>{
 vi.useFakeTimers();ports.logout.mockResolvedValue({ok:true});ports.cleanup.mockReturnValue(new Promise(()=>{}));
 const logout=logoutWithReadCleanup();await vi.advanceTimersByTimeAsync(1500);await logout;
 expect(readLogoutNotice()).toBe('Du bist abgemeldet. Die gespeicherten Daten auf diesem Gerät werden beim nächsten Start gelöscht.');
});
