import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {SyncProvider,useSync} from '../SyncContext';
const state=vi.hoisted(()=>({scope:'a'.repeat(64),status:'authenticated',offline24h:false}));
const ports=vi.hoisted(()=>({read:vi.fn(),retain:vi.fn(),readStand:vi.fn(),refreshStand:vi.fn(async()=>({code:'DISABLED'})),sync:vi.fn(async(...args:unknown[])=>{void args;return {secured:0,acknowledged:0,blocked:1};})}));
vi.mock('@/lib/auth/PermissionsContext',()=>({usePermissions:()=>({offlineScope:state.scope,status:state.status,offline24h:state.offline24h,hasArea:()=>false})}));
// Projection boundaries only; the actual Action/IDB source writer is exercised
// independently by offline_device_stand_atomic.browser.integration.test.ts.
vi.mock('../collectDeviceStand',()=>({refreshDeviceStand:ports.refreshStand}));
// Consumer projection only; the real fetch/heartbeat predicate has its own
// transport tests and is exercised in the actual Next browser smoke.
vi.mock('../serverReachability',()=>({installServerReachability:()=>()=>{},readServerReachability:()=>navigator.onLine,serverReachabilitySnapshot:()=>true,subscribeServerReachability:(listener:()=>void)=>{window.addEventListener('online',listener);window.addEventListener('offline',listener);return()=>{window.removeEventListener('online',listener);window.removeEventListener('offline',listener);};}}));
vi.mock('../devicePortRead',()=>({readDeviceStandResponse:ports.readStand}));
vi.mock('@/app/actions/eingang.actions',()=>({prepareIntakeFileAction:vi.fn(),finishIntakeFileAction:vi.fn(),saveIntakeNoteAction:vi.fn()}));
vi.mock('@/app/actions/offlineWorkshop.actions',()=>({replayOfflineWorkshopAction:vi.fn()}));
vi.mock('@/modules/eingang/public',()=>({uploadIntakeOriginal:vi.fn()}));
vi.mock('../syncPendingFiles',()=>({syncPendingFiles:ports.sync}));
vi.mock('../pendingStore',()=>({readPendingEntries:ports.read,retainQuarantinedPending:ports.retain}));
afterEach(()=>{cleanup();state.offline24h=false;vi.clearAllMocks();vi.restoreAllMocks();vi.useRealTimers();});
it('pagehide and hidden flush the same queue with keepalive, and stop after unmount',async()=>{
 state.scope='8'.repeat(64);state.status='authenticated';ports.read.mockResolvedValue([]);
 const view=render(<SyncProvider><Count/></SyncProvider>);
 await waitFor(()=>expect(ports.sync).toHaveBeenCalled());ports.sync.mockClear();
 fireEvent(window,new Event('pagehide'));
 expect(ports.sync).toHaveBeenCalledWith(state.scope,expect.any(Object),{flushDelayed:true,keepalive:true,workshopOnly:true});
 vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');fireEvent(document,new Event('visibilitychange'));
 expect(ports.sync).toHaveBeenCalledTimes(2);
 view.unmount();fireEvent(window,new Event('pagehide'));expect(ports.sync).toHaveBeenCalledTimes(2);
});
it('offline leaving never sends the retained queue',async()=>{
 state.scope='9'.repeat(64);state.status='authenticated';ports.read.mockResolvedValue([]);
 vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
 render(<SyncProvider><Count/></SyncProvider>);fireEvent(window,new Event('pagehide'));
 expect(ports.sync).not.toHaveBeenCalled();
});
it('a newly committed delayed original waits until its actual deadline',async()=>{
 vi.useFakeTimers();state.scope='0'.repeat(64);state.status='authenticated';ports.read.mockResolvedValue([]);
 render(<SyncProvider><Count/></SyncProvider>);await act(async()=>{await Promise.resolve();});ports.sync.mockClear();
 ports.read.mockResolvedValue([{id:'TEST-delay',kind:'workshop',itemId:'TEST-order',notBefore:new Date(Date.now()+10000).toISOString()}]);
 await act(async()=>{window.dispatchEvent(new Event('kreile-pending-changed'));await Promise.resolve();});
 await act(async()=>{await vi.advanceTimersByTimeAsync(9999);});expect(ports.sync).not.toHaveBeenCalled();
 await act(async()=>{await vi.advanceTimersByTimeAsync(1);});expect(ports.sync).toHaveBeenCalledOnce();
 expect(ports.sync.mock.calls[0][2]).toEqual({flushDelayed:false,keepalive:false,workshopOnly:false});
});
function Count(){const {outboxItems}=useSync();return <output data-testid="pending">{outboxItems.length}</output>;}
function StorageState(){const {pendingStorageUnavailable}=useSync();return <output data-testid="storage">{pendingStorageUnavailable?'unavailable':'readable'}</output>;}
function StandState(){const {deviceStand}=useSync();return <output data-testid="stand">{deviceStand.code}</output>;}
it('restarts the same full reader when the real login shell becomes ready after the initial read, ignoring another login',async()=>{
 state.scope='4'.repeat(64);state.status='authenticated';state.offline24h=true;document.cookie='kreile_offline_cache_scope='+('4'.repeat(64))+'; Path=/';
 ports.read.mockResolvedValue([]);ports.readStand.mockResolvedValue({code:'EMPTY',reason:'NO_STAND'});ports.refreshStand.mockResolvedValueOnce({code:'STALE'}).mockResolvedValue({code:'STORED'});
 render(<SyncProvider><StandState/></SyncProvider>);await waitFor(()=>expect(ports.refreshStand).toHaveBeenCalledOnce());
 fireEvent(window,new CustomEvent('kreile-offline-shell-ready',{detail:{scope:'3'.repeat(64),loginScope:'3'.repeat(64)}}));expect(ports.refreshStand).toHaveBeenCalledOnce();
 fireEvent(window,new CustomEvent('kreile-offline-shell-ready',{detail:{scope:state.scope,loginScope:'4'.repeat(64)}}));
 await waitFor(()=>expect(ports.refreshStand).toHaveBeenCalledTimes(2));expect(ports.retain).not.toHaveBeenCalled();
});
it('ignores an older failed refresh after a newer successful same-login refresh',async()=>{
 state.scope='5'.repeat(64);state.status='authenticated';state.offline24h=true;document.cookie='kreile_offline_cache_scope='+('5'.repeat(64))+'; Path=/';
 ports.read.mockResolvedValue([{id:'TEST-retained-race',itemId:'TEST-item',kind:'note'}]);ports.readStand.mockResolvedValue({code:'OK',serverReadAt:'2026-11-13T09:30:00.000Z',cacheGeneration:4});
 let release:(value:{code:string})=>void=()=>{};const first=new Promise<{code:string}>(resolve=>{release=resolve;});
 ports.refreshStand.mockImplementationOnce(()=>first).mockResolvedValueOnce({code:'STORED'});
 render(<SyncProvider><Count/><StandState/><Retry/></SyncProvider>);
 await waitFor(()=>expect(ports.refreshStand).toHaveBeenCalledTimes(1));
 fireEvent.click(screen.getByText('TEST retry'));await waitFor(()=>expect(ports.refreshStand).toHaveBeenCalledTimes(2));
 await act(async()=>{window.dispatchEvent(new Event('kreile-device-stand-changed'));});
 await waitFor(()=>expect(screen.getByTestId('stand').textContent).toBe('COMPLETE'));
 await act(async()=>{release({code:'SOURCE_INCOMPLETE'});await first;});
 expect(screen.getByTestId('stand').textContent).toBe('COMPLETE');expect(screen.getByTestId('pending')).toHaveTextContent('1');
});
it('marks a failed complete refresh incomplete while retaining the previous confirmed source and originals',async()=>{
 state.scope='6'.repeat(64);state.status='authenticated';state.offline24h=true;document.cookie='kreile_offline_cache_scope='+('6'.repeat(64))+'; Path=/';
 ports.read.mockResolvedValue([{id:'TEST-kept-before-write-failure',itemId:'TEST-item',kind:'note'}]);
 ports.readStand.mockResolvedValue({code:'OK',serverReadAt:'2026-11-13T09:30:00.000Z',cacheGeneration:3});ports.refreshStand.mockResolvedValueOnce({code:'SOURCE_INCOMPLETE'});
 render(<SyncProvider><Count/><StandState/></SyncProvider>);
 await waitFor(()=>expect(screen.getByTestId('stand')).toHaveTextContent('INCOMPLETE'));
 expect(screen.getByTestId('pending')).toHaveTextContent('1');expect(ports.retain).not.toHaveBeenCalled();expect(ports.readStand).toHaveBeenCalledWith(state.scope,true);
});
it('retains confirmed originals and exposes storage failure instead of an empty successful queue',async()=>{
 state.scope='7'.repeat(64);state.status='authenticated';ports.read.mockResolvedValue([{id:'TEST-kept',itemId:'TEST-item',kind:'note'}]);
 render(<SyncProvider><Count/><StorageState/></SyncProvider>);
 await waitFor(()=>expect(screen.getByTestId('pending')).toHaveTextContent('1'));
 ports.read.mockRejectedValue(new Error('TEST_IDB_READ_FAILED'));window.dispatchEvent(new Event('kreile-pending-changed'));
 await waitFor(()=>expect(screen.getByTestId('storage')).toHaveTextContent('unavailable'));
 expect(screen.getByTestId('pending')).toHaveTextContent('1');expect(ports.retain).not.toHaveBeenCalled();
});
function Kinds(){const {outboxItems}=useSync();return <output data-testid="kinds">{outboxItems.map(item=>item.entityType+':'+item.status).join(',')}</output>;}
it('counts a retained workshop original as a pending item, never as a sent mail',async()=>{
 state.scope='f'.repeat(64);state.status='authenticated';ports.read.mockResolvedValue([{id:'TEST-workshop',itemId:'TEST-order',kind:'workshop'},{id:'TEST-unknown',kind:'quarantine',capturedAt:''}]);
 render(<SyncProvider><Count/><Kinds/></SyncProvider>);
 await waitFor(()=>expect(screen.getByTestId('pending')).toHaveTextContent('2'));
 expect(screen.getByTestId('kinds')).toHaveTextContent('item:queued,communication_draft:conflict');
 expect(ports.retain).not.toHaveBeenCalled();
});
it('reads the existing original queue and responds to committed original changes',async()=>{
 state.scope='a'.repeat(64);state.status='authenticated';
 ports.read.mockResolvedValue([{id:'TEST-photo',itemId:'TEST-item',kind:'file'},{id:'TEST-note',itemId:'TEST-item',kind:'note'}]);
 render(<SyncProvider><Count/></SyncProvider>);
 await waitFor(()=>expect(screen.getByTestId('pending')).toHaveTextContent('2'));
 expect(ports.read).toHaveBeenCalledWith(state.scope);
 ports.read.mockResolvedValue([{id:'TEST-note',itemId:'TEST-item',kind:'note'}]);
 window.dispatchEvent(new Event('kreile-pending-changed'));
 await waitFor(()=>expect(screen.getByTestId('pending')).toHaveTextContent('1'));
});
it('does not show the previous login queue or let a late prior read overwrite a switched login',async()=>{
 let finish:(value:unknown[])=>void=()=>{};
 state.scope='c'.repeat(64);state.status='authenticated';ports.read.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const view=render(<SyncProvider><Count/></SyncProvider>);
 state.scope='d'.repeat(64);ports.read.mockResolvedValue([]);
 view.rerender(<SyncProvider><Count/></SyncProvider>);
 await waitFor(()=>expect(ports.read).toHaveBeenCalledWith(state.scope));
 finish([{id:'TEST-previous',kind:'file',itemId:'TEST-old'}]);
 await waitFor(()=>expect(screen.getByTestId('pending')).toHaveTextContent('0'));
 state.status='unauthenticated';view.rerender(<SyncProvider><Count/></SyncProvider>);
 expect(screen.getByTestId('pending')).toHaveTextContent('0');
});

function Retry(){const {syncNow}=useSync();return <button onClick={()=>void syncNow()}>TEST retry</button>;}
it('manual retry uses the real scoped transport instead of reporting a snapshot refresh as sync',async()=>{
 state.scope='e'.repeat(64);state.status='authenticated';ports.read.mockResolvedValue([{id:'TEST-note',kind:'note',itemId:'TEST-item'}]);
 render(<SyncProvider><Count/><Retry/></SyncProvider>);
 await waitFor(()=>expect(ports.sync).toHaveBeenCalledTimes(1));
 fireEvent.click(screen.getByText('TEST retry'));
 await waitFor(()=>expect(ports.sync).toHaveBeenCalledTimes(2));
 expect(ports.sync.mock.calls[1][0]).toBe(state.scope);
 expect(screen.getByTestId('pending')).toHaveTextContent('1');
});
