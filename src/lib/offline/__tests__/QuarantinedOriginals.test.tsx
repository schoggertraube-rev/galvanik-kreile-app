import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QuarantinedOriginals} from '../QuarantinedOriginals';
import {OFFLINE_RECONCILIATION_COPY} from '@/ui/situationCatalog';
import {canonicalJson} from '@/lib/domain/canonicalJson';
const state=vi.hoisted(()=>({scope:'a'.repeat(64),allowed:true,entries:[] as Array<{id:string;capturedAt?:string;payload:Record<string,unknown>}>}));
const ports=vi.hoisted(()=>({scope:vi.fn(),adopt:vi.fn(),open:vi.fn()}));
vi.mock('../SyncContext',()=>({useSync:()=>({quarantinedOriginals:state.entries})}));
vi.mock('@/lib/auth/PermissionsContext',()=>({usePermissions:()=>({hasArea:()=>state.allowed,offlineScope:state.scope,status:'authenticated'})}));
vi.mock('@/app/actions/eingang.actions',()=>({getIntakePendingScopeAction:ports.scope}));
vi.mock('../pendingStore',async importOriginal=>({...await importOriginal<typeof import('../pendingStore')>(),adoptQuarantinedOriginal:ports.adopt}));
vi.mock('@/modules/eingang/public',()=>({getIntakeDeviceId:()=> 'TEST-device',requestGlobalCreate:ports.open}));
afterEach(()=>{cleanup();vi.clearAllMocks();vi.restoreAllMocks();state.allowed=true;state.entries=[];state.scope='a'.repeat(64);});
it('PL13:55 shows the bound original customer and amount only with money rights, without mutable/current replacement data',()=>{
 // Synthetic consumer envelope; actual receipt/reference is tested against DB.
 const id='11111111-1111-4111-8111-111111111111',at='2026-11-14T10:00:00.000Z';
 const original={kind:'workshop',command:'credit.payout',id,itemId:'TEST-customer',deviceCapturedAt:at,input:{customerId:'TEST-customer',clientEventId:id,amount:4000,expectedCreditVersion:1,method:'bar',reference:null,note:null}};
 const rejection={scope:state.scope,eventId:'22222222-2222-4222-8222-222222222222',taskId:'33333333-3333-4333-8333-333333333333',actorId:'44444444-4444-4444-8444-444444444444',clientEventId:id,deviceCapturedAt:at,rejection:'CONFLICT',originalCanonical:canonicalJson({command:original.command,input:original.input,deviceCapturedAt:at}),subject:{kind:'customer',id:'TEST-customer',label:'TEST Originalkunde',amountCents:4000}};
 state.entries=[{id:'rejected:'+id,capturedAt:at,payload:{reason:'WORKSHOP_REJECTED_WITHOUT_EFFECT',original:{...original,rejection}}}];
 const before=JSON.stringify(state.entries),view=render(<QuarantinedOriginals onClose={()=>{}}/>);
 expect(screen.getByText(/TEST Originalkunde · 40,00/)).toBeInTheDocument();
 state.allowed=false;view.rerender(<QuarantinedOriginals onClose={()=>{}}/>);
 expect(screen.queryByText(/TEST Originalkunde/)).toBeNull();expect(screen.getByText(OFFLINE_RECONCILIATION_COPY.rejected)).toBeInTheDocument();expect(JSON.stringify(state.entries)).toBe(before);
});
it('PL14Nov10:20 shows the retained known rejection without raw money/receipt metadata or an unrelated intake takeover',()=>{
 // Explicit synthetic consumer boundary; the receipt itself is proved in the real replay tests.
 const id='11111111-1111-4111-8111-111111111111',at='2026-11-14T10:00:00.000Z';
 state.entries=[{id:'rejected:'+id,capturedAt:at,payload:{reason:'WORKSHOP_REJECTED_WITHOUT_EFFECT',original:{kind:'workshop',command:'credit.payout',id,itemId:'TEST-customer',deviceCapturedAt:at,input:{customerId:'TEST-customer',clientEventId:id,amount:4000,expectedCreditVersion:1,method:'bar',reference:null,note:'TEST private memo'}}}}];
 const before=JSON.stringify(state.entries),view=render(<QuarantinedOriginals onClose={()=>{}}/>);
 expect(screen.getByText(OFFLINE_RECONCILIATION_COPY.rejected)).toBeInTheDocument();
 expect(screen.getByText(OFFLINE_RECONCILIATION_COPY.originalCommand['credit.payout'])).toBeInTheDocument();
 expect(view.container.querySelector('pre')).toBeNull();expect(screen.queryByText(/TEST private memo/)).toBeNull();
 expect(screen.queryByRole('button',{name:'Als Eingang übernehmen'})).not.toBeInTheDocument();expect(JSON.stringify(state.entries)).toBe(before);
});
it('shows one and many actual projected originals, without a discard action',()=>{
 state.entries=[{id:'TEST-one',payload:{original:{text:'TEST original one'}}},{id:'TEST-two',payload:{original:{text:'TEST original two'}}}];
 render(<QuarantinedOriginals onClose={()=>{}}/>);
 expect(screen.getByText(/TEST original one/)).toBeInTheDocument();expect(screen.getByText(/TEST original two/)).toBeInTheDocument();
 expect(screen.getAllByText('Als Eingang übernehmen')).toHaveLength(2);expect(screen.queryByText(/Verwerfen/)).not.toBeInTheDocument();
});
it('PL15:50 displays bounded readable rows, file names and the explicit unreadable state without exposing raw records',()=>{
 const long='TEST '.repeat(60),payload={original:{text:long,deviceCapturedAt:'2026-11-13T10:00:00Z'},secretMetadata:'TEST internal retained'};
 state.entries=[{id:'TEST-note',payload},{id:'TEST-file',payload:{original:{file:new File(['TEST bytes'],'TEST-photo.png',{type:'image/png'})}}},{id:'TEST-unknown',payload:{opaque:42}}];
 const before=JSON.stringify(payload);const view=render(<QuarantinedOriginals onClose={()=>{}}/>);
 expect(screen.getByText(/Notiz ·/).textContent).toContain(long.slice(0,200));expect(screen.getByText(/Notiz ·/).textContent).not.toContain(long.slice(0,201));
 expect(screen.getByText('Datei · TEST-photo.png')).toBeInTheDocument();expect(screen.getByText('Inhalt nicht lesbar – das Original bleibt gespeichert.')).toBeInTheDocument();
 expect(view.container.querySelector('pre')).toBeNull();expect(screen.queryByText(/TEST internal retained/)).toBeNull();expect(JSON.stringify(payload)).toBe(before);
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
 expect(ports.adopt).toHaveBeenCalledWith(state.scope,'TEST-selected','TEST-device',expect.any(Function));expect(close).toHaveBeenCalledOnce();
});
it('offline takeover uses the existing login namespace without simulating a server reply',async()=>{
 vi.spyOn(navigator,'onLine','get').mockReturnValue(false);state.entries=[{id:'TEST-offline',payload:{text:'TEST offline original'}}];ports.adopt.mockResolvedValue({code:'OK',original:{itemId:'TEST-offline-target'}});
 render(<QuarantinedOriginals onClose={()=>{}}/>);fireEvent.click(screen.getByText('Als Eingang übernehmen'));
 await waitFor(()=>expect(ports.open).toHaveBeenCalledWith({intent:'DIRECT_INTAKE',pendingOriginalId:'TEST-offline-target'}));expect(ports.scope).not.toHaveBeenCalled();
});
it('double click keeps one pending adoption and a late old-login reply cannot bind it',async()=>{
 state.entries=[{id:'TEST-late',payload:{text:'TEST delayed original'}}];let release:(value:unknown)=>void=()=>{};ports.scope.mockReturnValue(new Promise(resolve=>{release=resolve;}));const close=vi.fn();
 const view=render(<QuarantinedOriginals onClose={close}/>);fireEvent.click(screen.getByText('Als Eingang übernehmen'));fireEvent.click(screen.getByText('Als Eingang übernehmen'));await waitFor(()=>expect(ports.scope).toHaveBeenCalledOnce());
 const oldScope=state.scope;state.scope='b'.repeat(64);view.rerender(<QuarantinedOriginals onClose={close}/>);release({code:'OK',scope:oldScope});
 await waitFor(()=>expect(screen.getByText('Als Eingang übernehmen')).toBeEnabled());expect(ports.adopt).not.toHaveBeenCalled();expect(ports.open).not.toHaveBeenCalled();expect(close).not.toHaveBeenCalled();
});
it('a changed server login never adopts, never closes and retains the visible original',async()=>{
 state.entries=[{id:'TEST-held',payload:{text:'TEST never discarded'}}];ports.scope.mockResolvedValue({code:'OK',scope:'b'.repeat(64)});const close=vi.fn();
 render(<QuarantinedOriginals onClose={close}/>);fireEvent.click(screen.getByText('Als Eingang übernehmen'));
 await waitFor(()=>expect(screen.getByRole('alert')).toBeInTheDocument());expect(ports.adopt).not.toHaveBeenCalled();expect(ports.open).not.toHaveBeenCalled();expect(close).not.toHaveBeenCalled();expect(screen.getByText(/TEST never discarded/)).toBeInTheDocument();
});
