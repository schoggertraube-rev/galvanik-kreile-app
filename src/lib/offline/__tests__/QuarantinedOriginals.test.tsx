import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QuarantinedOriginals} from '../QuarantinedOriginals';
const state=vi.hoisted(()=>({scope:'a'.repeat(64),allowed:true,entries:[] as Array<{id:string;payload:Record<string,unknown>}>}));
const ports=vi.hoisted(()=>({scope:vi.fn(),adopt:vi.fn(),open:vi.fn()}));
vi.mock('../SyncContext',()=>({useSync:()=>({quarantinedOriginals:state.entries})}));
vi.mock('@/lib/auth/PermissionsContext',()=>({usePermissions:()=>({hasArea:()=>state.allowed,offlineScope:state.scope,status:'authenticated'})}));
vi.mock('@/app/actions/eingang.actions',()=>({getIntakePendingScopeAction:ports.scope}));
vi.mock('../pendingStore',()=>({adoptQuarantinedOriginal:ports.adopt}));
vi.mock('@/modules/eingang/public',()=>({getIntakeDeviceId:()=> 'TEST-device',requestGlobalCreate:ports.open}));
afterEach(()=>{cleanup();vi.clearAllMocks();state.allowed=true;state.entries=[];});
it('shows one and many actual projected originals, without a discard action',()=>{
 state.entries=[{id:'TEST-one',payload:{original:{text:'TEST original one'}}},{id:'TEST-two',payload:{original:{text:'TEST original two'}}}];
 render(<QuarantinedOriginals onClose={()=>{}}/>);
 expect(screen.getByText(/TEST original one/)).toBeInTheDocument();expect(screen.getByText(/TEST original two/)).toBeInTheDocument();
 expect(screen.getAllByText('Als Eingang übernehmen')).toHaveLength(2);expect(screen.queryByText(/Verwerfen/)).not.toBeInTheDocument();
});
it('retains the original view without Eingang and offers no takeover button',()=>{
 state.allowed=false;state.entries=[{id:'TEST-one',payload:{text:'TEST retained without right'}}];render(<QuarantinedOriginals onClose={()=>{}}/>);
 expect(screen.getByText('Zuordnen kann, wer den Eingang bearbeiten darf')).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Als Eingang übernehmen'})).not.toBeInTheDocument();
 expect(screen.getByText(/TEST retained without right/)).toBeInTheDocument();expect(ports.adopt).not.toHaveBeenCalled();
});
it('opens the existing capture dialog for exactly the retained original, after server scope confirmation',async()=>{
 state.entries=[{id:'TEST-selected',payload:{text:'TEST selected original'}}];ports.scope.mockResolvedValue({code:'OK',scope:state.scope});ports.adopt.mockResolvedValue({code:'OK',original:{itemId:'TEST-real-target'}});const close=vi.fn();
 render(<QuarantinedOriginals onClose={close}/>);fireEvent.click(screen.getByText('Als Eingang übernehmen'));
 await waitFor(()=>expect(ports.open).toHaveBeenCalledWith({intent:'DIRECT_INTAKE',pendingOriginalId:'TEST-real-target'}));
 expect(ports.adopt).toHaveBeenCalledWith(state.scope,'TEST-selected','TEST-device');expect(close).toHaveBeenCalledOnce();
});
it('a changed server login never adopts, never closes and retains the visible original',async()=>{
 state.entries=[{id:'TEST-held',payload:{text:'TEST never discarded'}}];ports.scope.mockResolvedValue({code:'OK',scope:'b'.repeat(64)});const close=vi.fn();
 render(<QuarantinedOriginals onClose={close}/>);fireEvent.click(screen.getByText('Als Eingang übernehmen'));
 await waitFor(()=>expect(screen.getByRole('alert')).toBeInTheDocument());expect(ports.adopt).not.toHaveBeenCalled();expect(ports.open).not.toHaveBeenCalled();expect(close).not.toHaveBeenCalled();expect(screen.getByText(/TEST never discarded/)).toBeInTheDocument();
});
