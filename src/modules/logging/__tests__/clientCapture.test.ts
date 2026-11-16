// @vitest-environment jsdom
// Controlled DOM/transport unit boundaries, not a browser/Appstart acceptance.
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {installProtocolClickCapture,observeProtocolCommand} from '../public';
import type {ClickFact} from '../public';
import * as reachability from '@/lib/offline/serverReachability';
import {runServerAction} from '@/lib/client/runServerAction';
let online=false;
const cleanups:Array<()=>void>=[];
beforeEach(()=>{vi.useFakeTimers();online=false;vi.spyOn(reachability,'readServerReachability').mockImplementation(()=>online);document.body.innerHTML='<button data-spec-id="rechte.rechte-speichern">TEST command</button>';history.replaceState({},'','/orders/TEST-object?PRIVATE_QUERY');});
afterEach(()=>{for(const stop of cleanups.splice(0))stop();vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();document.body.innerHTML='';});
const scope=()=>randomUUID().replaceAll('-','').repeat(2);
const press=(detail=1)=>document.querySelector('button')!.dispatchEvent(new MouseEvent('click',{bubbles:true,detail}));
const reconnect=async()=>{online=true;window.dispatchEvent(new Event('online'));await vi.advanceTimersByTimeAsync(0);};

it('buffers a real command response offline, then acknowledges the exact hang/repeat fact through the one reachability predicate',async()=>{
 const batches:ClickFact[][]=[],partition=scope();
 cleanups.push(installProtocolClickCapture(partition,async entries=>{batches.push(structuredClone(entries));return {code:'OK',accepted:entries.map(row=>row.id)};}));
 let release!:()=>void,execution:ReturnType<typeof runServerAction>|undefined;
 const blocked=new Promise<void>(resolve=>{release=resolve;});
 document.querySelector('button')!.addEventListener('click',()=>{execution=runServerAction(async()=>{await blocked;return {code:'OK'};});});
 press(2);await vi.advanceTimersByTimeAsync(3500);expect(batches).toHaveLength(0);
 release();expect(await execution).toEqual({ok:true,value:{code:'OK'}});expect(batches).toHaveLength(0);
 await reconnect();expect(batches).toHaveLength(1);
 expect(batches[0]).toMatchObject([{target:'rechte.rechte-speichern',route:'/orders/:id',durationMs:3500,clickCount:2,outcome:'success',deviceClass:'unknown'}]);
 expect(JSON.stringify(batches)).not.toContain('PRIVATE_QUERY');
 await reconnect();expect(batches).toHaveLength(1);
});

it('a background command after native dispatch cannot turn a local click into a fabricated successful server response',async()=>{
 const batches:ClickFact[][]=[];
 cleanups.push(installProtocolClickCapture(scope(),async entries=>{batches.push(structuredClone(entries));return {code:'OK',accepted:entries.map(row=>row.id)};}));
 press();expect(await observeProtocolCommand(async()=>({code:'OK'}))).toEqual({code:'OK'});
 await vi.advanceTimersByTimeAsync(0);await reconnect();
 expect(batches[0]).toMatchObject([{outcome:null,durationMs:null}]);
});

it('a failed acknowledgement retains immutable click metadata for the next registrar retry',async()=>{
 const partition=scope(),attempts:ClickFact[][]=[];
 const stop=installProtocolClickCapture(partition,async entries=>{attempts.push(structuredClone(entries));return {code:'UNAVAILABLE'};});cleanups.push(stop);
 press();await vi.advanceTimersByTimeAsync(0);await reconnect();expect(attempts).toHaveLength(1);stop();
 cleanups.push(installProtocolClickCapture(partition,async entries=>{attempts.push(structuredClone(entries));return {code:'OK',accepted:entries.map(row=>row.id)};}));
 await vi.advanceTimersByTimeAsync(0);expect(attempts).toHaveLength(2);expect(attempts[1]).toEqual(attempts[0]);
});

it('an in-flight old login is never sent under a new login; returning to its actual scope retains the original',async()=>{
 const old=scope(),next=scope(),oldSend=vi.fn(async(entries:ClickFact[])=>({code:'OK',accepted:entries.map(row=>row.id)})),newSend=vi.fn(async(entries:ClickFact[])=>({code:'OK',accepted:entries.map(row=>row.id)}));
 const stop=installProtocolClickCapture(old,oldSend);cleanups.push(stop);
 let release!:()=>void,execution:Promise<unknown>|undefined;
 const blocked=new Promise<void>(resolve=>{release=resolve;});
 document.querySelector('button')!.addEventListener('click',()=>{execution=observeProtocolCommand(async()=>{await blocked;return {code:'OK'};});});
 press();stop();const stopNext=installProtocolClickCapture(next,newSend);cleanups.push(stopNext);release();await execution;await reconnect();
 expect(oldSend).not.toHaveBeenCalled();expect(newSend).not.toHaveBeenCalled();stopNext();
 cleanups.push(installProtocolClickCapture(old,oldSend));await vi.advanceTimersByTimeAsync(0);
 expect(oldSend).toHaveBeenCalledTimes(1);expect(oldSend.mock.calls[0][0]).toMatchObject([{outcome:'success'}]);
});

it('an actual command AbortError remains the same exception and records cancellation without reading its text',async()=>{
 const batches:ClickFact[][]=[];
 cleanups.push(installProtocolClickCapture(scope(),async entries=>{batches.push(structuredClone(entries));return {code:'OK',accepted:entries.map(row=>row.id)};}));
 const failure=new DOMException('TEST PRIVATE_ABORT_BODY','AbortError');let execution:Promise<unknown>|undefined;
 document.querySelector('button')!.addEventListener('click',()=>{execution=observeProtocolCommand(async()=>{throw failure;}).catch(error=>error);});
 press();expect(await execution).toBe(failure);await reconnect();
 expect(batches[0]).toMatchObject([{outcome:'cancelled'}]);expect(JSON.stringify(batches)).not.toContain('PRIVATE_ABORT_BODY');
});
