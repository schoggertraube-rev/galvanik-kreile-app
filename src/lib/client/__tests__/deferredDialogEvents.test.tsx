import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render} from '@testing-library/react';
import {useEffect} from 'react';
import {createDeferredDialogEvents,withDeferredDialogReady} from '../deferredDialogEvents';
const stops:Array<()=>void>=[];
afterEach(()=>{cleanup();for(const stop of stops.splice(0))stop();});
it('retains early real DOM events and original arguments until the mounted receiver effect is ready',()=>{
 const load=vi.fn(),receive=vi.fn(),bridge=createDeferredDialogEvents(load);stops.push(bridge.attach());
 const detail={intent:'DIRECT_INTAKE',prefill:{sourceItemId:'TEST-original',sourceVersion:7}};
 window.dispatchEvent(new CustomEvent('path1:global-create-open',{detail}));expect(load).toHaveBeenCalledOnce();expect(receive).not.toHaveBeenCalled();
 function Receiver(){useEffect(()=>{const read=(event:Event)=>receive((event as CustomEvent).detail);window.addEventListener('path1:global-create-open',read);return()=>window.removeEventListener('path1:global-create-open',read);},[]);return null;}
 const Ready=withDeferredDialogReady(Receiver,'create');render(<Ready onReceiverReady={bridge.ready}/>);
 expect(receive).toHaveBeenCalledExactlyOnceWith(detail);expect(receive.mock.calls[0][0]).toBe(detail);
 window.dispatchEvent(new CustomEvent('path1:global-create-open',{detail}));expect(receive).toHaveBeenCalledTimes(2);expect(load).toHaveBeenCalledOnce();
});
it('keeps click order across separately loaded receivers, acknowledges handling and leaves other navigation alone',()=>{
 const bridge=createDeferredDialogEvents(vi.fn());stops.push(bridge.attach());const seen:string[]=[];
 const read=(event:Event)=>{seen.push((event as CustomEvent).detail.ziel);event.preventDefault();};
 window.addEventListener('kreile:oeffne',read);stops.push(()=>window.removeEventListener('kreile:oeffne',read));
 expect(window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'original',arg:'TEST-first'},cancelable:true}))).toBe(false);
 expect(window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'reklamation',arg:'TEST-second'},cancelable:true}))).toBe(false);
 bridge.ready('complaint');expect(seen).toEqual([]);bridge.ready('object');expect(seen).toEqual(['original','reklamation']);
 window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'auftrag',arg:'TEST-existing-route'}}));expect(seen.at(-1)).toBe('auftrag');
});
it('retains a nested command emitted by a ready receiver until the other original receiver mounts',()=>{
 const bridge=createDeferredDialogEvents(vi.fn());stops.push(bridge.attach());const receive=vi.fn();
 const original=()=>window.dispatchEvent(new CustomEvent('path1:global-create-open',{detail:{intent:'QUOTE'}}));
 window.addEventListener('kreile:oeffne',original);window.addEventListener('path1:global-create-open',receive);
 stops.push(()=>{window.removeEventListener('kreile:oeffne',original);window.removeEventListener('path1:global-create-open',receive);});
 window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'mailein',arg:'TEST-mail'},cancelable:true}));
 bridge.ready('message');expect(receive).not.toHaveBeenCalled();bridge.ready('create');expect(receive).toHaveBeenCalledOnce();
});
it('detaches cleanly and can reattach during StrictMode without duplicating a click',()=>{
 const load=vi.fn(),bridge=createDeferredDialogEvents(load);const stop=bridge.attach();stop();stops.push(bridge.attach());
 window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'rechnungein',arg:'TEST-invoice'},cancelable:true}));expect(load).toHaveBeenCalledOnce();
});
