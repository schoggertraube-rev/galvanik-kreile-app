import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render} from '@testing-library/react';
const ports=vi.hoisted(()=>({readLog:vi.fn(),install:vi.fn(()=>vi.fn()),record:vi.fn()}));
vi.mock('@/lib/auth/PermissionsContext',()=>({usePermissions:()=>({status:'authenticated',offlineScope:'TEST-idle-scope'})}));
vi.mock('@/app/actions/logging.actions',()=>({getProtocolLogAction:ports.readLog,recordProtocolClicksAction:ports.record}));
vi.mock('@/modules/logging/public',()=>({installProtocolClickCapture:ports.install}));
import {ProtocolClickCapture} from '@/components/ProtocolClickCapture';
import {IntakeDraftList} from '@/modules/eingang/public';
afterEach(()=>{cleanup();vi.clearAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
it('draft focus and change reads remain immediate while the initial read waits for idle',async()=>{
 let idle:IdleRequestCallback|undefined;
 vi.stubGlobal('requestIdleCallback',(callback:IdleRequestCallback)=>{idle=callback;return 1;});vi.stubGlobal('cancelIdleCallback',vi.fn());
 const readDrafts=vi.fn(async()=>({code:'OK' as const,drafts:[]}));
 const discardDraft=vi.fn(async()=>({code:'OK' as const,drafts:[]}));
 const view=render(<IntakeDraftList readDrafts={readDrafts} discardDraft={discardDraft}/>);
 expect(readDrafts).not.toHaveBeenCalled();
 await act(async()=>{fireEvent(window,new Event('focus'));});expect(readDrafts).toHaveBeenCalledOnce();
 await act(async()=>{fireEvent(window,new Event('kreile:intake-drafts-changed'));});expect(readDrafts).toHaveBeenCalledTimes(2);
 await act(async()=>{idle?.({didTimeout:false,timeRemaining:()=>20});});expect(readDrafts).toHaveBeenCalledTimes(3);
 view.unmount();await act(async()=>{idle?.({didTimeout:true,timeRemaining:()=>0});});expect(readDrafts).toHaveBeenCalledTimes(3);
});
it('protocol capture installs immediately and upgrades from the actual settings action only after idle',async()=>{
 let idle:IdleRequestCallback|undefined;
 vi.stubGlobal('requestIdleCallback',(callback:IdleRequestCallback)=>{idle=callback;return 2;});vi.stubGlobal('cancelIdleCallback',vi.fn());
 ports.readLog.mockResolvedValue({code:'OK',enabled:true,scope:'TEST-idle-scope'});
 render(<ProtocolClickCapture/>);
 expect(ports.install).toHaveBeenCalledWith('TEST-idle-scope',ports.record,false);expect(ports.readLog).not.toHaveBeenCalled();
 await act(async()=>{idle?.({didTimeout:false,timeRemaining:()=>20});});
 expect(ports.readLog).toHaveBeenCalledWith({capture:true});expect(ports.install).toHaveBeenLastCalledWith('TEST-idle-scope',ports.record);
});
it('unmount cancels the deferred protocol settings read without removing any retained click source',async()=>{
 vi.useFakeTimers();vi.stubGlobal('requestIdleCallback',undefined);
 const view=render(<ProtocolClickCapture/>);view.unmount();
 await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});expect(ports.readLog).not.toHaveBeenCalled();expect(ports.install).toHaveBeenCalledOnce();
});
