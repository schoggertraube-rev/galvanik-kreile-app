import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {AppShell} from '@/ui/kr';
import {DeviceStandStatus} from '../DeviceStandStatus';
const state=vi.hoisted(()=>({enabled:true,online:false,pending:0,quarantine:0,storage:false,persistence:'GRANTED',stand:{code:'COMPLETE',serverReadAt:'2026-11-13T11:59:00.000Z'}}));
vi.mock('@/lib/auth/PermissionsContext',()=>({usePermissions:()=>({offline24h:state.enabled})}));
vi.mock('../SyncContext',()=>({useSync:()=>({isOnline:state.online,deviceStand:state.stand,pendingStorageUnavailable:state.storage,storagePersistence:state.persistence,outboxItems:[...Array.from({length:state.pending},(_,id)=>({id,status:'queued'})),...Array.from({length:state.quarantine},(_,id)=>({id,status:'conflict'}))]})}));
vi.mock('../QuarantinedOriginals',()=>({QuarantinedOriginals:({onClose}:{onClose:()=>void})=><button onClick={onClose}>TEST existing originals view</button>}));
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-13T12:00:00Z'));Object.assign(state,{enabled:true,online:false,pending:0,quarantine:0,storage:false,persistence:'GRANTED',stand:{code:'COMPLETE',serverReadAt:'2026-11-13T11:59:00.000Z'}});});
afterEach(()=>{cleanup();vi.useRealTimers();});
it.each(['handy','tablet','desktop'] as const)('places one actual status row directly after the real %s head',geraet=>{
 render(<AppShell geraet={geraet} variante="buero" aktiv="kunden" kuerzel="T" suche={null} plus={null} onNav={()=>{}} onStart={()=>{}} onKonto={()=>{}} zustand={<DeviceStandStatus/>}><span>TEST body</span></AppShell>);
 const line=screen.getByRole('status',{name:'Netzwerkstatus'});expect(line.previousElementSibling?.tagName).toBe('HEADER');expect(line).toHaveAttribute('data-spec-id','offline.zeile');expect(line).toHaveTextContent('Offline – Stand 12:59, 0 Änderungen warten');expect(screen.getAllByRole('status',{name:'Netzwerkstatus'})).toHaveLength(1);
});
it('flag off and online clean add no line; real online waiting still shows its count',()=>{
 state.enabled=false;const view=render(<DeviceStandStatus/>);expect(screen.queryByRole('status')).toBeNull();state.enabled=true;state.online=true;view.rerender(<DeviceStandStatus/>);expect(screen.queryByRole('status')).toBeNull();state.pending=2;view.rerender(<DeviceStandStatus/>);expect(screen.getByRole('status')).toHaveTextContent('2 lokal ausstehend');
});
it('separates quarantine from the pending count and opens the existing view',()=>{state.pending=1;state.quarantine=2;render(<DeviceStandStatus/>);expect(screen.getByRole('status')).toHaveTextContent('1 Änderungen warten');fireEvent.click(screen.getByRole('button',{name:'2 Eingaben zurückgehalten - tippe zum Zuordnen'}));expect(screen.getByText('TEST existing originals view')).toBeInTheDocument();});
it('expired and unavailable states remain visible; denied persistence uses the PL catalog',()=>{state.stand.serverReadAt='2026-11-12T11:59:00Z';const view=render(<DeviceStandStatus/>);expect(screen.getByRole('status')).toHaveAttribute('data-tone','warn');expect(screen.getByRole('status')).toHaveTextContent('Seit über 24 Stunden kein Netz');state.storage=true;view.rerender(<DeviceStandStatus/>);expect(screen.getByRole('status')).toHaveTextContent('Offline-Speicher auf diesem Gerät nicht verfügbar');state.persistence='DENIED';view.rerender(<DeviceStandStatus/>);expect(screen.getByRole('status')).toHaveTextContent('Dieses Gerät kann Offline-Daten selbst löschen – Eingaben gehen sofort raus, sobald Netz da ist');});
