// Isolated rendering of the actual login consumer; the real PIN Action/Auth/DB
// and native browser failures are covered by offline_login_storage.browser.
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {StartScreenClient} from '../StartScreenClient';
import {OFFLINE_DEVICE_STATUS_COPY} from '@/ui/situationCatalog';
const ports=vi.hoisted(()=>({pin:vi.fn(()=>new Promise(()=>{}))}));
vi.mock('@/hooks/usePageView',()=>({usePageView:()=>{}}));
vi.mock('@/hooks/useHydrated',()=>({useHydrated:()=>true}));
vi.mock('next/navigation',()=>({useSearchParams:()=>new URLSearchParams()}));
vi.mock('next/image',()=>({default:()=>null}));
vi.mock('@/app/actions/auth.actions',()=>({loginWithPin:ports.pin}));
vi.mock('@/app/actions/auth',()=>({login:vi.fn()}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();ports.pin.mockClear();});
it('shows the canonical storage warning while the PIN request still starts exactly once',async()=>{
 vi.stubGlobal('indexedDB',undefined);
 render(<StartScreenClient users={[{loginHandle:'TEST-synthetic-handle',fullName:'TEST storage',shortCode:'TS',designation:'TEST',role:'meister',emailLoginAvailable:false}]}/>);
 for(const digit of ['7','6','5','4'])fireEvent.keyDown(window,{key:digit});
 await waitFor(()=>expect(ports.pin).toHaveBeenCalledExactlyOnceWith('TEST-synthetic-handle','7654'));
 expect(screen.getByRole('alert')).toHaveTextContent(OFFLINE_DEVICE_STATUS_COPY.unavailable);
 fireEvent.keyDown(window,{key:'4'});expect(ports.pin).toHaveBeenCalledTimes(1);
});
