import {afterEach,expect,it,vi} from 'vitest';
import {scheduleIdleRead} from '../scheduleIdleRead';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('uses the idle deadline without blocking a separate immediate event path',()=>{
 let idle:IdleRequestCallback|undefined;
 const request=vi.fn((callback:IdleRequestCallback)=>{idle=callback;return 9;});
 vi.stubGlobal('requestIdleCallback',request);vi.stubGlobal('cancelIdleCallback',vi.fn());
 const read=vi.fn(),cancel=scheduleIdleRead(read,2000);
 expect(request).toHaveBeenCalledWith(expect.any(Function),{timeout:2000});expect(read).not.toHaveBeenCalled();
 idle?.({didTimeout:false,timeRemaining:()=>20});expect(read).toHaveBeenCalledOnce();cancel();
});
it('fallback preserves both idle timeout and additional sync delay, and cancellation stops work',async()=>{
 vi.useFakeTimers();vi.stubGlobal('requestIdleCallback',undefined);
 const read=vi.fn();const cancel=scheduleIdleRead(read,2000,10000);
 await vi.advanceTimersByTimeAsync(11999);expect(read).not.toHaveBeenCalled();
 await vi.advanceTimersByTimeAsync(1);expect(read).toHaveBeenCalledOnce();cancel();
 const cancelled=scheduleIdleRead(read,2000,10000);
 await vi.advanceTimersByTimeAsync(2000);cancelled();await vi.advanceTimersByTimeAsync(10000);expect(read).toHaveBeenCalledOnce();
});
it('a cancelled idle callback remains harmless even if already queued by the browser',()=>{
 let idle:IdleRequestCallback|undefined;const cancelIdle=vi.fn(),read=vi.fn();
 vi.stubGlobal('requestIdleCallback',(callback:IdleRequestCallback)=>{idle=callback;return 7;});vi.stubGlobal('cancelIdleCallback',cancelIdle);
 const cancel=scheduleIdleRead(read,2000);cancel();idle?.({didTimeout:true,timeRemaining:()=>0});
 expect(cancelIdle).toHaveBeenCalledWith(7);expect(read).not.toHaveBeenCalled();
});
