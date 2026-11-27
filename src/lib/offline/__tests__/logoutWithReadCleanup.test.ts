import {afterEach,expect,it,vi} from 'vitest';
const ports=vi.hoisted(()=>({logout:vi.fn(),cleanup:vi.fn(),sync:vi.fn()}));
vi.mock('../syncOriginals',()=>({syncOriginals:ports.sync}));
vi.mock('@/app/actions/auth',()=>({logout:ports.logout}));
vi.mock('../logoutReadState',()=>({clearLoggedOutReadState:ports.cleanup}));
import {logoutWithReadCleanup,readLogoutNotice} from '../logoutWithReadCleanup';
import {CACHE_SCOPE_COOKIE,readCacheScopeMarker} from '../cacheScopeMarker';
function setLoginScope(scope:string){document.cookie=`${CACHE_SCOPE_COOKIE}=${scope}; Path=/`;}
afterEach(()=>{
 vi.clearAllMocks();vi.useRealTimers();
 delete document.documentElement.dataset.offlineScope;
 delete document.documentElement.dataset.offlineLoginScope;
 for(const cookie of document.cookie.split(';')){
  const name=cookie.trim().split('=')[0];
  if(name.startsWith('kreile_offline_'))document.cookie=`${name}=; Path=/; Max-Age=0`;
 }
});
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
it('fences the expired session immediately and keeps the original queue for the next valid login',async()=>{
 const scope='d'.repeat(64);
 const state=document.documentElement.dataset;
 state.authStatus='authenticated';state.offlineScope=scope;state.offlineLoginScope='e'.repeat(64);
 setLoginScope('e'.repeat(64));
 ports.logout.mockImplementation(async()=>{
  expect(state.authStatus).toBe('error');
  expect(state.offlineScope).toBeUndefined();
  expect(state.offlineLoginScope).toBeUndefined();
  expect(readCacheScopeMarker()).toBeNull();
  return {ok:true};
 });
 ports.cleanup.mockResolvedValue({cacheCleared:true,pendingCount:2});
 const sessionScope='e'.repeat(64);
 await logoutWithReadCleanup('inactivity',sessionScope);
 expect(ports.sync).not.toHaveBeenCalled();
 expect(ports.logout).toHaveBeenCalledExactlyOnceWith({sessionScope});
 expect(ports.cleanup).toHaveBeenCalledWith(scope,sessionScope);
 expect(state.authStatus).toBe('unauthenticated');
 expect(readLogoutNotice()).toContain('sobald du wieder angemeldet und online bist');
});
it('reopens the same confirmed read partition without clearing its pending originals',async()=>{
 const state=document.documentElement.dataset;
 const scope='a'.repeat(64),sessionScope='b'.repeat(64);
 state.authStatus='authenticated';state.offlineScope=scope;state.offlineLoginScope=sessionScope;
 setLoginScope(sessionScope);
 ports.logout.mockImplementationOnce(async()=>{
  expect(state.authStatus).toBe('error');
  expect(state.offlineScope).toBeUndefined();
  expect(readCacheScopeMarker()).toBeNull();
  return {ok:false,code:'ACTIVE',inactivity:{minutes:2,lastSeen:50000,expiresAt:170000,sessionScope}};
 });
 expect(await logoutWithReadCleanup('inactivity',sessionScope)).toMatchObject({ok:false,code:'ACTIVE'});
 expect(state.authStatus).toBe('authenticated');
 expect(state.offlineScope).toBe(scope);
 expect(state.offlineLoginScope).toBe(sessionScope);
 expect(readCacheScopeMarker()).toBe(sessionScope);
 expect(ports.cleanup).not.toHaveBeenCalled();
 expect(ports.sync).not.toHaveBeenCalled();
});

it('ignores the old expiry response after the browser switches login',async()=>{
 const state=document.documentElement.dataset;
 const scope='a'.repeat(64),previous='b'.repeat(64),current='c'.repeat(64);
 state.authStatus='authenticated';state.offlineScope=scope;state.offlineLoginScope=previous;
 setLoginScope(previous);
 ports.logout.mockImplementationOnce(async()=>{
  setLoginScope(current);
  state.authStatus='authenticated';state.offlineScope=scope;state.offlineLoginScope=current;
  return {ok:true,remoteSignOut:'success'};
 });
 expect(await logoutWithReadCleanup('inactivity',previous)).toEqual({ok:false,code:'SESSION_CHANGED'});
 expect(ports.cleanup).not.toHaveBeenCalled();
 expect(state.authStatus).toBe('authenticated');
 expect(state.offlineLoginScope).toBe(current);
 expect(readCacheScopeMarker()).toBe(current);
});
it('leaves a newer login alone when the old ACTIVE response arrives late',async()=>{
 const state=document.documentElement.dataset;
 const scope='a'.repeat(64),sessionScope='b'.repeat(64),newLogin='c'.repeat(64);
 state.authStatus='authenticated';state.offlineScope=scope;state.offlineLoginScope=sessionScope;
 setLoginScope(sessionScope);
 ports.logout.mockImplementationOnce(async()=>{
  expect(readCacheScopeMarker()).toBeNull();
  setLoginScope(newLogin);
  return {ok:false,code:'ACTIVE',inactivity:{minutes:2,lastSeen:50000,expiresAt:170000,sessionScope}};
 });
 expect(await logoutWithReadCleanup('inactivity',sessionScope)).toEqual({ok:false,code:'SESSION_CHANGED'});
 expect(readCacheScopeMarker()).toBe(newLogin);
 expect(state.offlineLoginScope).toBeUndefined();
 expect(ports.cleanup).not.toHaveBeenCalled();
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
