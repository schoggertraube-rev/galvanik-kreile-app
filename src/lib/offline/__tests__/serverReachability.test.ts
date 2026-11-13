import {afterEach,beforeEach,expect,it,vi} from 'vitest';
let network:typeof import('../serverReachability');
let stop:(()=>void)|undefined;
let fetcher:ReturnType<typeof vi.fn>;
beforeEach(async()=>{vi.resetModules();vi.useFakeTimers();vi.spyOn(navigator,'onLine','get').mockReturnValue(true);fetcher=vi.fn(async()=>new Response(null,{status:204}));vi.stubGlobal('fetch',fetcher);network=await import('../serverReachability');stop=network.installServerReachability();});
afterEach(()=>{stop?.();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('a failed actual fetch makes the single predicate offline until a successful 30s heartbeat',async()=>{
 fetcher.mockRejectedValueOnce(new TypeError('TEST network failure'));
 await expect(window.fetch('/TEST-server')).rejects.toThrow('TEST network failure');expect(network.readServerReachability()).toBe(false);
 await window.fetch('/TEST-normal-success');expect(network.readServerReachability()).toBe(false);
 await vi.advanceTimersByTimeAsync(29_999);expect(fetcher).toHaveBeenCalledTimes(2);
 await vi.advanceTimersByTimeAsync(1);expect(fetcher.mock.calls[2][0]).toBe('/api/offline/heartbeat');expect(fetcher.mock.calls[2][1]).toMatchObject({method:'GET',cache:'no-store'});expect(network.readServerReachability()).toBe(true);
});
it.each([502,503,504])('HTTP %s marks the server unreachable',async status=>{fetcher.mockResolvedValueOnce(new Response(null,{status}));await window.fetch('/TEST-server');expect(network.readServerReachability()).toBe(false);});
it.each([400,401,403,409,422])('HTTP %s remains a business/auth response, not offline',async status=>{fetcher.mockResolvedValueOnce(new Response(null,{status}));await window.fetch('/TEST-server');expect(network.readServerReachability()).toBe(true);await vi.advanceTimersByTimeAsync(30_000);expect(fetcher).toHaveBeenCalledOnce();});
it('a twelve-second Action finishes with its original signal while a successful heartbeat keeps it online',async()=>{
 const controller=new AbortController(),init={method:'POST',body:'TEST original Action bytes',keepalive:true,signal:controller.signal};
 fetcher.mockImplementationOnce(()=>new Promise(resolve=>setTimeout(()=>resolve(new Response('TEST actual reply',{status:200})),12_000)));
 const request=window.fetch('/TEST-action',init);
 await vi.advanceTimersByTimeAsync(7_999);expect(fetcher).toHaveBeenCalledOnce();expect(network.readServerReachability()).toBe(true);
 await vi.advanceTimersByTimeAsync(1);expect(fetcher.mock.calls[0][1]).toBe(init);expect(fetcher.mock.calls[1][0]).toBe('/api/offline/heartbeat');expect(controller.signal.aborted).toBe(false);expect(network.readServerReachability()).toBe(true);
 await vi.advanceTimersByTimeAsync(4_000);expect(await(await request).text()).toBe('TEST actual reply');expect(controller.signal.aborted).toBe(false);expect(network.readServerReachability()).toBe(true);
});
it('a failed independent heartbeat marks offline but never cancels a twelve-second Action',async()=>{
 const controller=new AbortController();let completed=false;
 fetcher.mockImplementationOnce(()=>new Promise(resolve=>setTimeout(()=>{completed=true;resolve(new Response(null,{status:200}));},12_000)));
 fetcher.mockRejectedValueOnce(new TypeError('TEST blocked heartbeat'));
 const request=window.fetch('/TEST-action',{signal:controller.signal});
 await vi.advanceTimersByTimeAsync(7_999);expect(network.readServerReachability()).toBe(true);
 await vi.advanceTimersByTimeAsync(1);expect(network.readServerReachability()).toBe(false);expect(completed).toBe(false);expect(controller.signal.aborted).toBe(false);
 await vi.advanceTimersByTimeAsync(4_000);expect((await request).status).toBe(200);expect(network.readServerReachability()).toBe(false);expect(controller.signal.aborted).toBe(false);
});
it('only the heartbeat timeout establishes failure when the main request remains unanswered',async()=>{
 let signal:AbortSignal|undefined;
 fetcher.mockImplementationOnce((_input:unknown,init?:RequestInit)=>{signal=init?.signal??undefined;return new Promise(()=>{});});
 fetcher.mockImplementationOnce((_input:unknown,init:RequestInit)=>new Promise((_resolve,reject)=>init.signal?.addEventListener('abort',()=>reject(new DOMException('TEST health deadline','AbortError')))));
 void window.fetch('/TEST-still-working');
 await vi.advanceTimersByTimeAsync(15_999);expect(network.readServerReachability()).toBe(true);expect(signal).toBeUndefined();
 await vi.advanceTimersByTimeAsync(1);expect(network.readServerReachability()).toBe(false);expect(signal).toBeUndefined();
});
it('an explicit navigation abort and an external-provider failure do not declare the app offline',async()=>{
 const controller=new AbortController();controller.abort();fetcher.mockRejectedValueOnce(new DOMException('TEST navigation','AbortError'));
 await expect(window.fetch('/TEST-server',{signal:controller.signal})).rejects.toThrow();expect(network.readServerReachability()).toBe(true);
 fetcher.mockRejectedValueOnce(new TypeError('TEST external'));await expect(window.fetch('https://TEST-external.invalid')).rejects.toThrow();expect(network.readServerReachability()).toBe(true);
});
it('WLAN online alone does not recover; failed heartbeats retry and a confirmed one recovers',async()=>{
 const radio=vi.spyOn(navigator,'onLine','get');radio.mockReturnValue(false);window.dispatchEvent(new Event('offline'));expect(network.readServerReachability()).toBe(false);
 radio.mockReturnValue(true);fetcher.mockResolvedValueOnce(new Response(null,{status:503}));window.dispatchEvent(new Event('online'));await vi.advanceTimersByTimeAsync(0);expect(network.readServerReachability()).toBe(false);
 await vi.advanceTimersByTimeAsync(30_000);expect(network.readServerReachability()).toBe(true);
});
it('the approved heartbeat is a no-store 204 with no data or authentication change',async()=>{const {GET}=await import('@/app/api/offline/heartbeat/route');const reply=await GET();expect(reply.status).toBe(204);expect(reply.headers.get('cache-control')).toContain('no-store');expect(await reply.text()).toBe('');});
it('the failed online reader immediately selects the existing cache, and the next read stays there',async()=>{
 fetcher.mockRejectedValueOnce(new TypeError('TEST app unavailable'));const device=vi.fn(async()=>({source:'TEST existing device response'}));
 const online=vi.fn(async()=>{await window.fetch('/TEST-server');return {source:'TEST online'};});
 expect(await network.readWithDeviceFallback(online,device,true)).toEqual({source:'TEST existing device response'});
 expect(await network.readWithDeviceFallback(online,device,true)).toEqual({source:'TEST existing device response'});expect(online).toHaveBeenCalledOnce();expect(device).toHaveBeenCalledTimes(2);
});
it('a business denial is returned unchanged, without reading a device replacement',async()=>{
 fetcher.mockResolvedValueOnce(new Response(null,{status:401}));const device=vi.fn(async()=>({code:'OK'}));
 expect(await network.readWithDeviceFallback(async()=>{await window.fetch('/TEST-server');return {code:'UNAUTHORIZED'};},device,true)).toEqual({code:'UNAUTHORIZED'});expect(device).not.toHaveBeenCalled();
});
it.each([400,401,403,409,422])('a heartbeat HTTP %s confirms recovery while preserving the actual denial for authorization',async status=>{
 fetcher.mockRejectedValueOnce(new TypeError('TEST server outage'));await expect(window.fetch('/TEST-server')).rejects.toThrow();expect(network.readServerReachability()).toBe(false);
 fetcher.mockResolvedValueOnce(new Response(null,{status}));await vi.advanceTimersByTimeAsync(30_000);expect(network.readServerReachability()).toBe(true);
});
