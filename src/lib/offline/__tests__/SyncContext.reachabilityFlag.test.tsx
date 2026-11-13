import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
const state=vi.hoisted(()=>({offline24h:false}));
const ports=vi.hoisted(()=>({sync:vi.fn(async(...args:unknown[])=>{void args;return {secured:0,acknowledged:0,blocked:0};})}));
vi.mock('@/lib/auth/PermissionsContext',()=>({usePermissions:()=>({offlineScope:'b'.repeat(64),status:'authenticated',offline24h:state.offline24h})}));
// Isolated root-composition probe; no Action/SQL/receipt result is claimed here.
vi.mock('../pendingStore',()=>({readPendingEntries:async()=>[],retainQuarantinedPending:vi.fn()}));
vi.mock('../collectDeviceStand',()=>({refreshDeviceStand:async()=>({code:'DISABLED'})}));
vi.mock('../devicePortRead',()=>({readDeviceStandResponse:async()=>({code:'EMPTY',reason:'NO_SHELL'})}));
vi.mock('../syncOriginals',()=>({syncOriginals:ports.sync}));
import {SyncProvider,useSync} from '../SyncContext';
function State(){const {isOnline,syncNow}=useSync();return <><output data-testid="online">{isOnline?'online':'offline'}</output><button onClick={()=>void syncNow()}>TEST sync</button></>;}
beforeEach(()=>{state.offline24h=false;vi.spyOn(navigator,'onLine','get').mockReturnValue(true);});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();ports.sync.mockClear();});
it('flag OFF preserves fetch, online badge, manual sync and pagehide flush after a real 503 response',async()=>{
 const fetcher=vi.fn(async()=>new Response(null,{status:503}));vi.stubGlobal('fetch',fetcher);
 const view=render(<SyncProvider><State/></SyncProvider>);
 await waitFor(()=>expect(ports.sync).toHaveBeenCalled());
 expect(window.fetch).toBe(fetcher);
 await act(async()=>{expect((await window.fetch('/TEST-503')).status).toBe(503);});
 expect(screen.getByTestId('online').textContent).toBe('online');
 ports.sync.mockClear();fireEvent.click(screen.getByRole('button',{name:'TEST sync'}));
 await waitFor(()=>expect(ports.sync).toHaveBeenCalledOnce());
 ports.sync.mockClear();fireEvent(window,new Event('pagehide'));
 expect(ports.sync).toHaveBeenCalledOnce();expect(ports.sync.mock.calls[0][2]).toMatchObject({flushDelayed:true,keepalive:true});
 state.offline24h=true;view.rerender(<SyncProvider><State/></SyncProvider>);
 expect(window.fetch).not.toBe(fetcher);
 await act(async()=>{await window.fetch('/TEST-enabled-503');});
 await waitFor(()=>expect(screen.getByTestId('online').textContent).toBe('offline'));
 state.offline24h=false;view.rerender(<SyncProvider><State/></SyncProvider>);
 await waitFor(()=>expect(screen.getByTestId('online').textContent).toBe('online'));expect(window.fetch).toBe(fetcher);
});
