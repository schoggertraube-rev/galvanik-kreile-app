import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {SyncProvider,useSync} from '../SyncContext';
const state=vi.hoisted(()=>({scope:'a'.repeat(64),status:'authenticated'}));
const ports=vi.hoisted(()=>({read:vi.fn(),retain:vi.fn(),sync:vi.fn(async(...args:unknown[])=>{void args;return {secured:0,acknowledged:0,blocked:1};})}));
vi.mock('@/lib/auth/PermissionsContext',()=>({usePermissions:()=>({offlineScope:state.scope,status:state.status,hasArea:()=>false})}));
vi.mock('@/app/actions/eingang.actions',()=>({prepareIntakeFileAction:vi.fn(),finishIntakeFileAction:vi.fn(),saveIntakeNoteAction:vi.fn()}));
vi.mock('@/modules/eingang/public',()=>({uploadIntakeOriginal:vi.fn()}));
vi.mock('../syncPendingFiles',()=>({syncPendingFiles:ports.sync}));
vi.mock('../pendingStore',()=>({readPendingEntries:ports.read,retainQuarantinedPending:ports.retain}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
function Count(){const {outboxItems}=useSync();return <output data-testid="pending">{outboxItems.length}</output>;}
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
