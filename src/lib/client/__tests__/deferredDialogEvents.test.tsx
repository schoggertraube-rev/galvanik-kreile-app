import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render} from '@testing-library/react';
import {useEffect} from 'react';
import {createDeferredDialogEvents,withDeferredDialogReady,importWithRetry,deferredDialogUnavailable} from '../deferredDialogEvents';
const stops:Array<()=>void>=[];
it('254 K1 drops the failed group and its Escape without blocking the next original receiver',async()=>{
 const bridge=createDeferredDialogEvents(vi.fn());stops.push(bridge.attach());const received=vi.fn(),escape=vi.fn();
 const read=(event:Event)=>received((event as CustomEvent).detail.ziel);
 window.addEventListener('kreile:oeffne',read);window.addEventListener('keydown',escape);
 stops.push(()=>{window.removeEventListener('kreile:oeffne',read);window.removeEventListener('keydown',escape);});
 window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'original',arg:'TEST-failed'},cancelable:true}));
 fireEvent.keyDown(window,{key:'Escape'});
 window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'reklamation',arg:'TEST-retained'},cancelable:true}));
 bridge.drop('object');bridge.ready('complaint');await act(async()=>{});
 expect(received).toHaveBeenCalledExactlyOnceWith('reklamation');expect(escape).not.toHaveBeenCalled();
 fireEvent.keyDown(window,{key:'Escape'});expect(escape).toHaveBeenCalledOnce();
});
it('254 K1 retries two rejected imports at 1000ms intervals and returns the third actual result',async()=>{
 vi.useFakeTimers();
 try{
  const start=Date.now(),calls:number[]=[];
  const load=vi.fn(()=>{calls.push(Date.now()-start);return calls.length<3?Promise.reject(new Error('SYNTHETISCH import failure')):Promise.resolve('loaded');});
  const pending=importWithRetry(load);expect(load).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(999);expect(load).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1);expect(load).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1000);expect(await pending).toBe('loaded');expect(calls).toEqual([0,1000,2000]);
 }finally{vi.useRealTimers();}
});
it('254 K1 forwards the third rejected import without a fourth attempt',async()=>{
 vi.useFakeTimers();
 try{
  const failure=new Error('SYNTHETISCH permanent import failure'),load=vi.fn(()=>Promise.reject(failure));
  const rejected=expect(importWithRetry(load)).rejects.toBe(failure);
  await vi.advanceTimersByTimeAsync(2000);await rejected;
  await vi.advanceTimersByTimeAsync(10000);expect(load).toHaveBeenCalledTimes(3);
 }finally{vi.useRealTimers();}
});
it('254 K1 publishes the original failed group after mounting the unavailable component',()=>{
 const failed=vi.fn(),Unavailable=deferredDialogUnavailable('object');
 render(<Unavailable onReceiverFailed={failed}/>);expect(failed).toHaveBeenCalledExactlyOnceWith('object');
});
afterEach(()=>{cleanup();for(const stop of stops.splice(0))stop();});
it('retains early real DOM events and original arguments until the mounted receiver effect is ready',async()=>{
 const load=vi.fn(),receive=vi.fn(),bridge=createDeferredDialogEvents(load);stops.push(bridge.attach());
 const detail={intent:'DIRECT_INTAKE',prefill:{sourceItemId:'TEST-original',sourceVersion:7}};
 window.dispatchEvent(new CustomEvent('path1:global-create-open',{detail}));expect(load).toHaveBeenCalledOnce();expect(receive).not.toHaveBeenCalled();
 function Receiver(){useEffect(()=>{const read=(event:Event)=>receive((event as CustomEvent).detail);window.addEventListener('path1:global-create-open',read);return()=>window.removeEventListener('path1:global-create-open',read);},[]);return null;}
 const Ready=withDeferredDialogReady(Receiver,'create');render(<Ready onReceiverReady={bridge.ready}/>);
 await act(async()=>{});
 expect(receive).toHaveBeenCalledExactlyOnceWith(detail);expect(receive.mock.calls[0][0]).toBe(detail);
 window.dispatchEvent(new CustomEvent('path1:global-create-open',{detail}));expect(receive).toHaveBeenCalledTimes(2);expect(load).toHaveBeenCalledOnce();
});
it('keeps click order across separately loaded receivers, acknowledges handling and leaves other navigation alone',async()=>{
 const bridge=createDeferredDialogEvents(vi.fn());stops.push(bridge.attach());const seen:string[]=[];
 const read=(event:Event)=>{seen.push((event as CustomEvent).detail.ziel);event.preventDefault();};
 window.addEventListener('kreile:oeffne',read);stops.push(()=>window.removeEventListener('kreile:oeffne',read));
 expect(window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'original',arg:'TEST-first'},cancelable:true}))).toBe(false);
 expect(window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'reklamation',arg:'TEST-second'},cancelable:true}))).toBe(false);
 bridge.ready('complaint');await act(async()=>{});expect(seen).toEqual([]);bridge.ready('object');await act(async()=>{});expect(seen).toEqual(['original','reklamation']);
 window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'auftrag',arg:'TEST-existing-route'}}));expect(seen.at(-1)).toBe('auftrag');
});
it('retains a nested command emitted by a ready receiver until the other original receiver mounts',async()=>{
 const bridge=createDeferredDialogEvents(vi.fn());stops.push(bridge.attach());const receive=vi.fn();
 const original=()=>window.dispatchEvent(new CustomEvent('path1:global-create-open',{detail:{intent:'QUOTE'}}));
 window.addEventListener('kreile:oeffne',original);window.addEventListener('path1:global-create-open',receive);
 stops.push(()=>{window.removeEventListener('kreile:oeffne',original);window.removeEventListener('path1:global-create-open',receive);});
 window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'mailein',arg:'TEST-mail'},cancelable:true}));
 bridge.ready('message');await act(async()=>{});expect(receive).not.toHaveBeenCalled();bridge.ready('create');await act(async()=>{});expect(receive).toHaveBeenCalledOnce();
});
it('detaches cleanly and can reattach during StrictMode without duplicating a click',()=>{
 const load=vi.fn(),bridge=createDeferredDialogEvents(load);const stop=bridge.attach();stop();stops.push(bridge.attach());
 window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'rechnungein',arg:'TEST-invoice'},cancelable:true}));expect(load).toHaveBeenCalledOnce();
});
it('retains the early N keystroke for the original keyboard receiver without inventing a create command',async()=>{
 const load=vi.fn(),bridge=createDeferredDialogEvents(load);stops.push(bridge.attach());
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'n',code:'KeyN',bubbles:true,cancelable:true}));
 expect(load).toHaveBeenCalledOnce();const received=vi.fn(),command=vi.fn();
 const read=(event:KeyboardEvent)=>received({key:event.key,code:event.code});
 window.addEventListener('keydown',read);window.addEventListener('path1:global-create-open',command);
 stops.push(()=>{window.removeEventListener('keydown',read);window.removeEventListener('path1:global-create-open',command);});
 bridge.ready('create');await act(async()=>{});expect(received).toHaveBeenCalledExactlyOnceWith({key:'n',code:'KeyN'});expect(command).not.toHaveBeenCalled();
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'n'}));expect(received).toHaveBeenCalledTimes(2);expect(load).toHaveBeenCalledOnce();
});
it('does not retain typing, modified or repeated N, or N above an already visible dialog',()=>{
 const load=vi.fn(),bridge=createDeferredDialogEvents(load);stops.push(bridge.attach());
 const input=document.createElement('input');document.body.append(input);
 input.dispatchEvent(new KeyboardEvent('keydown',{key:'n',bubbles:true}));input.remove();
 for(const modifier of ['ctrlKey','metaKey','altKey','repeat'])window.dispatchEvent(new KeyboardEvent('keydown',{key:'n',[modifier]:true}));
 const dialog=document.createElement('section');dialog.setAttribute('role','dialog');dialog.getClientRects=()=>[{}] as unknown as DOMRectList;document.body.append(dialog);
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'n'}));dialog.remove();
 expect(load).not.toHaveBeenCalled();
});
